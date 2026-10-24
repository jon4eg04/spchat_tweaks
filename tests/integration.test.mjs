import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

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
        ['tm-sc-per-chat-inference-model-v1', JSON.stringify({ conversation: 'glm51' })],
        ['tm-sc-per-chat-persistent-command-v1', JSON.stringify({ conversation: 'Keep this command' })],
    ]);
    const sandboxWindow = { fetch: untouchedSandboxFetch };
    const sandbox = {
        window: sandboxWindow, unsafeWindow: page, URL, Symbol, console,
        location: { origin: 'https://spicychat.ai', pathname: '/chat/bot/conversation' },
        localStorage: { getItem: key => storage.get(key) ?? null },
        document: { readyState: 'loading', addEventListener() {} },
    };
    vm.runInNewContext(source.replace('export default ', '') + '\ninit({});', sandbox);
    assert.equal(sandboxWindow.fetch, untouchedSandboxFetch);
    const body = JSON.stringify({ conversation_id: 'conversation', inference_settings: { max_new_tokens: 100 }, inference_model: 'old', message: 'Hello' });
    await page.fetch('https://prod.nd-api.com/chat', { method: 'POST', body });
    const xhr = new XHR(); xhr.open('POST', 'https://prod.nd-api.com/chat'); xhr.send(body);
    assert.equal(calls.length, 2);
    for (const call of calls) {
        assert.equal(call.inference_settings.max_new_tokens, 440);
        assert.equal(call.inference_model, 'glm51');
        assert.equal(call.message, 'Hello\n\n/cmd Keep this command');
    }
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
        createDomAdapters: () => ({}),
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
        createDomAdapters: () => ({}),
        location: { hostname: 'spicychat.ai' }, localStorage: {},
        document: { readyState: 'complete' }, GM_registerMenuCommand() {}, console: { error() {} },
    });
    assert.deepEqual(calls, ['emoji', 'buttons', 'saved-texts']);
});
