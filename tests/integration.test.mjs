import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createQuickCommands } from '../src/core/quick-commands.js';
import { memory } from './fixtures.mjs';
import { QUICK_MODELS } from '../src/core/models.js';

test('per-chat module still overrides the page fetch and XHR after gaining a userscript sandbox', async () => {
    const source = await readFile(new URL('../src/modules/per-chat.js', import.meta.url), 'utf8');
    const calls = [];
    const untouchedSandboxFetch = () => { throw new Error('must not patch or call sandbox fetch'); };
    class XHR {
        open(method, url) { this.url = url; }
        send(body) { calls.push(JSON.parse(body)); }
    }
    const page = {
        fetch: async (_url, options) => { calls.push(JSON.parse(options.body)); return { ok: true }; },
        XMLHttpRequest: XHR,
    };
    const storage = new Map([
        ['tm-sc-per-chat-response-length-v1', JSON.stringify({ conversation: 440 })],
        ['tm-sc-per-chat-inference-model-v1', JSON.stringify({ conversation: 'mimo-v26-pro' })],
        ['tm-sc-per-chat-persistent-command-v1', JSON.stringify({ conversation: 'Keep this command' })],
    ]);
    const sandboxWindow = { fetch: untouchedSandboxFetch };
    const sandbox = {
        window: sandboxWindow, unsafeWindow: page, URL, Symbol, console, QUICK_MODELS, quickCommands: createQuickCommands(memory()),
        location: { origin: 'https://spicychat.ai', pathname: '/chat/bot/conversation' },
        localStorage: { getItem: key => storage.get(key) ?? null },
        document: { readyState: 'loading', addEventListener() {} },
    };
    vm.runInNewContext(source.replace('export default ', '') + '\ninit({ quickCommands, models: QUICK_MODELS, onDomReady() {} });', sandbox);
    assert.equal(sandboxWindow.fetch, untouchedSandboxFetch);
    const body = JSON.stringify({ conversation_id: 'conversation', inference_settings: { max_new_tokens: 100 }, inference_model: 'old', message: 'Hello' });
    await page.fetch('https://prod.nd-api.com/chat', { method: 'POST', body });
    const xhr = new XHR(); xhr.open('POST', 'https://prod.nd-api.com/chat'); xhr.send(body);
    assert.equal(calls.length, 2);
    for (const call of calls) {
        assert.equal(call.inference_settings.max_new_tokens, 300);
        assert.equal(call.inference_model, 'mimo-v26-pro');
        assert.equal(call.message, 'Hello\n\n/cmd Keep this command');
    }
    assert.equal(JSON.parse(storage.get('tm-sc-per-chat-response-length-v1')).conversation, 440, 'legacy values are capped without rewriting saved data');
});

test('all module files parse independently and the release has no runtime imports', async () => {
    const catalog = JSON.parse(await readFile(new URL('../src/modules.json', import.meta.url), 'utf8'));
    for (const module of catalog) {
        const source = await readFile(new URL(`../src/modules/${module.id}.js`, import.meta.url), 'utf8');
        new vm.Script(source.replace('export default ', ''));
    }
    const bundle = await readFile(new URL('../dist/spicychat-tools.user.js', import.meta.url), 'utf8');
    new vm.Script(bundle);
    assert.equal(/^import /m.test(bundle), false);
    assert.equal(bundle.includes('@require'), false);
    assert.equal((bundle.match(/\/\/ ==UserScript==/g) || []).length, 1);
});

test('only the legacy hider runs on additional SpicyChat subdomains', async () => {
    const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
    const catalog = JSON.parse(await readFile(new URL('../src/modules.json', import.meta.url), 'utf8'));
    const calls = [];
    vm.runInNewContext(source, {
        MODULE_CATALOG: catalog, SUITE_VERSION: 'test',
        FEATURE_INITIALIZERS: Object.fromEntries(catalog.map(module => [module.id, () => calls.push(module.id)])),
        createStore: () => ({ settings: { active: true, modules: Object.fromEntries(catalog.map(module => [module.id, true])) } }),
        createInterface: () => ({ start() {}, open() {} }),
        createDomAdapters: () => ({}), createNativeModelAdapter: () => ({}), createChatPanel: () => ({}), createQuickCommands: () => ({}),
        QUICK_MODELS, onDomReady: callback => callback(),
        location: { hostname: 'other.spicychat.ai' }, localStorage: {},
        document: { readyState: 'complete' }, GM_registerMenuCommand() {}, console,
    });
    assert.deepEqual(calls, ['hide-models']);
});

test('a settings-window error cannot prevent composer features from starting', async () => {
    const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
    const catalog = [{ id: 'emoji', phase: 'dom' }, { id: 'buttons', phase: 'dom' }, { id: 'saved-texts', phase: 'dom' }];
    const calls = [];
    vm.runInNewContext(source, {
        MODULE_CATALOG: catalog, SUITE_VERSION: 'test',
        FEATURE_INITIALIZERS: Object.fromEntries(catalog.map(module => [module.id, () => calls.push(module.id)])),
        createStore: () => ({ settings: { active: true, modules: Object.fromEntries(catalog.map(module => [module.id, true])) } }),
        createInterface: () => ({ start() { throw new Error('settings fixture failure'); }, open() {} }),
        createDomAdapters: () => ({}), createNativeModelAdapter: () => ({}), createChatPanel: () => ({}), createQuickCommands: () => ({}),
        QUICK_MODELS, onDomReady: callback => callback(),
        location: { hostname: 'spicychat.ai' }, localStorage: {},
        document: { readyState: 'complete' }, GM_registerMenuCommand() {}, console: { error() {} },
    });
    assert.deepEqual(calls, ['emoji', 'buttons', 'saved-texts']);
});

test('each enabled quick command and manual command becomes a separate CMD in fetch and XHR; edits/deletes apply to the next request', async () => {
    const source = await readFile(new URL('../src/modules/per-chat.js', import.meta.url), 'utf8');
    const gm = memory(), local = memory();
    const quickCommands = createQuickCommands(gm);
    const first = quickCommands.upsert({ name: 'First name', text: 'First text' });
    const second = quickCommands.upsert({ name: 'Second name', text: 'Second text' });
    quickCommands.upsert({ name: 'Off name', text: 'Never send' });
    quickCommands.saveChat('one', [second, first], 'Manual text', local);
    const calls = [];
    class XHR { open() {} send(body) { calls.push(JSON.parse(body)); } }
    const page = { Object, fetch: async (_url, options) => { calls.push(JSON.parse(options.body)); return { ok: true }; }, XMLHttpRequest: XHR };
    vm.runInNewContext(source.replace('export default ', '') + '\ninit({ quickCommands, models: QUICK_MODELS, onDomReady() {} });', {
        window: {}, unsafeWindow: page, localStorage: local, quickCommands, QUICK_MODELS, URL, Symbol, console,
        location: { origin: 'https://spicychat.ai', pathname: '/chat/bot/one' }, document: { querySelectorAll: () => [] },
    });
    const send = async (conversation_id, message) => page.fetch('https://prod.nd-api.com/chat', { method: 'POST', body: JSON.stringify({ conversation_id, message }) });
    const expected = 'Hello\n\n/cmd Manual text\n\n/cmd First text\n\n/cmd Second text';
    await send('one', 'Hello');
    assert.equal(calls.at(-1).message, expected);
    const xhr = new XHR(); xhr.open('POST', 'https://prod.nd-api.com/chat'); xhr.send(JSON.stringify({ conversation_id: 'one', message: 'Hello' }));
    assert.equal(calls.at(-1).message, expected);
    await send('one', expected);
    assert.equal(calls.at(-1).message, expected, 'interceptor chaining must not append the suffix again');
    await send('two', 'Hello'); assert.equal(calls.at(-1).message, 'Hello');
    await send('one', ''); assert.equal(calls.at(-1).message, '');
    quickCommands.upsert({ id: first, name: 'Renamed', text: 'Changed' });
    quickCommands.remove(second);
    await send('one', 'Hello');
    assert.equal(calls.at(-1).message, 'Hello\n\n/cmd Manual text\n\n/cmd Changed');
    quickCommands.saveChat('one', [first], '', local);
    await send('one', 'Hello'); assert.equal(calls.at(-1).message, 'Hello\n\n/cmd Changed');
    quickCommands.saveChat('one', [], '', local);
    await send('one', 'Hello'); assert.equal(calls.at(-1).message, 'Hello');
});

test('panel manual autosave preserves other chats and refuses to overwrite malformed legacy data', async () => {
    const source = await readFile(new URL('../src/modules/per-chat.js', import.meta.url), 'utf8');
    const local = memory(), quickCommands = createQuickCommands(memory());
    let panel;
    vm.runInNewContext(source.replace('export default ', '') + '\ninit(runtime);', {
        window: {}, unsafeWindow: {}, localStorage: local, URL, Symbol, console,
        location: { origin: 'https://spicychat.ai', pathname: '/chat/bot/one' },
        runtime: { quickCommands, models: QUICK_MODELS, onDomReady: callback => callback(), createChatPanel: options => { panel = options; return { refresh() {} }; } },
    });
    const key = 'tm-sc-per-chat-persistent-command-v1';
    local.setItem(key, JSON.stringify({ two: 'Other manual', extra: { preserved: true } }));
    panel.save.manual('one', '/cmd New text');
    assert.deepEqual(JSON.parse(local.getItem(key)), { one: 'New text', two: 'Other manual', extra: { preserved: true } });
    panel.save.manual('one', '');
    assert.equal(JSON.parse(local.getItem(key)).two, 'Other manual');
    local.setItem(key, 'broken JSON');
    assert.throws(() => panel.save.manual('one', 'Do not replace'), /Данные не изменены/);
    assert.equal(local.getItem(key), 'broken JSON');
});
