// Synthetic UI only: no exported conversation, account data, or live API requests.
// The desktop message column leaves a right gutter for the requested floating panel.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const browserName = process.env.TEST_BROWSER || 'chromium';
const browserType = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright')[browserName];
if (!browserType) throw new Error('Unsupported browser: ' + browserName);
const bundle = await readFile(process.env.FEATURE_BUNDLE || new URL('../dist/spicychat-tools.user.js', import.meta.url), 'utf8');
const bot = '11111111-1111-4111-8111-111111111111';
const chat = '22222222-2222-4222-8222-222222222222';
const messages = ['33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'];
const html = `<!doctype html><html><head><style>
body{margin:32px;font:16px sans-serif}button,[role=menuitem]{padding:8px;cursor:pointer}textarea{width:500px;height:80px}[data-fixture-menu]{position:fixed;left:40px;top:100px;background:white;z-index:50;border:1px solid;min-width:240px}[role=menuitem]{display:block}#composer{margin-top:40px}#thread{max-width:1000px}.flex{display:flex}.relative{position:relative}[id^=message-]{margin:12px}
</style></head><body><button aria-label="chat-dropdown">Chat menu</button>
<div id="thread">${messages.map((id, i) => `<div id="message-${id}"><div class="flex justify-between items-center gap-md${i ? ' flex-row-reverse' : ''}"><span>${i ? 'You' : 'Character'}</span><div class="relative"><button aria-label="message-dropdown">Message menu</button></div></div><div class="[overflow-wrap:anywhere]"><p>${i ? 'Second plain message' : 'First <em>formatted</em> message'}</p></div></div>`).join('')}</div>
<div id="composer" class="flex items-end gap-sm w-full"><button aria-label="Plus-button">+</button><div data-tooltip-content="Generate image"><button aria-label="Generate image" data-testid="ImageGenerationButton">Image</button></div><div class="w-full flex"><div class="grow border-1 border-solid border-gray-5 rounded-[13px] py-sm px-2 bg-gray-3"><div class="flex flex-1 items-end gap-1"><textarea placeholder="Message..."></textarea></div></div></div><button aria-label="send-message">Send</button></div>
<img width="20" height="20" src="https://cdn.nd-api.com/conversations/${chat}/fixture.png">
</body></html>`;
const browser = await browserType.launch({ headless: true, firefoxUserPrefs: browserName === 'firefox' && process.env.TEST_FIREFOX_NO_SANDBOX === '1' ? { 'security.sandbox.content.level': 0 } : undefined, executablePath: browserName === 'chromium' ? process.env.CHROMIUM_EXECUTABLE || undefined : undefined, args: browserName === 'chromium' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [] });
const errors = []; const scenarios = []; const requests = [];
try {
const context = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
await context.route('**/*', async route => {
    const req = route.request();
    if (req.url().startsWith('https://spicychat.ai/chat/')) return route.fulfill({ contentType: 'text/html', body: html });
    if (req.resourceType() === 'image') return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGMMSKn4z8DAwMDEAAUAIMACL7pOGm8AAAAASUVORK5CYII=', 'base64') });
    requests.push({ url: req.url(), method: req.method(), body: req.postData() });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ messages: messages.map((id, i) => ({ id, conversation_id: chat, content: `Fixture ${i}`, role: i ? 'user' : 'bot', createdAt: `2026-10-01T${i ? '14' : '10'}:00:00Z` })), conversations: [] }), headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
});
await context.addInitScript(() => {
    const db = new Map(); window.__gm = db; window.unsafeWindow = window;
    window.GM_getValue = (key, fallback) => db.has(key) ? structuredClone(db.get(key)) : fallback;
    window.GM_setValue = (key, value) => db.set(key, structuredClone(value));
    window.GM_listValues = () => [...db.keys()]; window.GM_deleteValue = key => db.delete(key);
    window.GM_registerMenuCommand = () => {}; window.GM_addStyle = css => { const node = document.createElement('style'); node.textContent = css; document.documentElement.append(node); };
    window.GM_xmlhttpRequest = () => { throw Error('Unexpected external handler'); };
    window.confirm = () => true; window.alert = text => { throw Error(text); };
});
async function fixture(disabled = {}, seed = {}) {
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) errors.push(msg.text()); });
    await page.goto(`https://spicychat.ai/chat/${bot}/${chat}`);
    await page.evaluate(({ disabled, bot, chat, seed }) => {
        __gm.set('spchat-tweaks:settings:v1', { active: true, modules: { summary: false, tts: false, ...disabled }, endpoints: { summary: { url: 'https://example.test/summary', token: 'fixture-summary' }, tts: { url: 'https://example.test/tts', token: 'fixture-tts' } } });
        __gm.set(`tm-sc-chat-branches-v1:bot:${bot}`, { nodes: [{ conversationId: chat, characterId: bot, title: 'Fixture root', kind: 'root', createdAt: Date.now() }] });
        if (seed.graph) __gm.set(`tm-sc-chat-branches-v1:bot:${bot}`, seed.graph);
        document.querySelector('[id^=message-]').append(document.querySelector('img'));
        window.__composerMarkup = document.querySelector('#composer').outerHTML;
        window.__remountComposer = () => { const template = document.createElement('template'); template.innerHTML = __composerMarkup; document.querySelector('#composer').replaceWith(template.content.firstElementChild); };
        window.__actions = { image: 0, suggest: 0, send: 0, remove: 0 };
        function removalMode() {
            let selected = null;
            const bar = document.createElement('div');
            const remove = document.createElement('button'); remove.textContent = 'Remove'; remove.disabled = true;
            const cancel = document.createElement('button'); cancel.textContent = 'Cancel';
            const cleanup = () => { bar.remove(); document.querySelectorAll('[data-fixture-surface]').forEach(node => node.remove()); };
            cancel.onclick = cleanup;
            remove.onclick = () => {
                const all = [...document.querySelectorAll('[id^=message-]')];
                all.slice(all.indexOf(selected)).forEach(node => node.remove());
                __actions.remove++; cleanup();
            };
            bar.append(remove, cancel); document.body.append(bar);
            for (const message of document.querySelectorAll('[id^=message-]')) {
                const surface = document.createElement('div'); surface.className = 'w-full flex mb-lg bg-transparent items-center'; surface.dataset.fixtureSurface = 'true'; surface.textContent = 'Select';
                surface.onclick = () => { selected = message; remove.disabled = false; }; message.append(surface);
            }
        }
        document.querySelector('[data-testid=ImageGenerationButton]').onclick = () => __actions.image++;
        document.querySelector('[aria-label=send-message]').onclick = () => __actions.send++;
        window.addEventListener('pointerdown', event => {
            const menu = document.querySelector('[data-fixture-menu]');
            if (menu && !menu.contains(event.target) && !menu.__trigger.contains(event.target)) menu.remove();
        }, true);
        // Native menus live in a body portal, have role items rather than buttons,
        // and expose text instead of the old English aria labels.
        for (const button of document.querySelectorAll('[aria-label$=dropdown], [aria-label=Plus-button]')) button.addEventListener('click', () => {
            const existing = document.querySelector('[data-fixture-menu]');
            if (existing?.__trigger === button) { existing.remove(); return; }
            existing?.remove();
            const kind = button.getAttribute('aria-label');
            const labels = kind === 'message-dropdown' ? ['Copy', 'Edit'] : kind === 'chat-dropdown' ? ['View Saved Chats', 'Start New Chat', 'Remove Messages'] : ['Generate Image', 'Suggest Reply', 'Web Search', 'Command (OOC)'];
            const menu = document.createElement('div'); menu.dataset.fixtureMenu = 'true'; if (!window.__plainMenus) menu.setAttribute('role', 'menu'); menu.__trigger = button;
            for (const label of labels) {
                const item = document.createElement('div'); item.setAttribute('role', 'menuitem'); item.tabIndex = 0; item.textContent = label;
                if (window.__inlineStyles) item.style.cssText = 'padding-left:19px;font-size:17px';
                item.onclick = () => { if (label === 'Remove Messages') removalMode(); if (label === 'Suggest Reply') __actions.suggest++; if (label === 'Generate Image') __actions.image++; menu.remove(); };
                menu.append(item);
            }
            if (window.__inlineMenus) button.parentElement.append(menu); else document.body.append(menu);
        });
    }, { disabled, bot, chat, seed });
    await page.addScriptTag({ content: bundle.replaceAll("shadowMode = 'closed'", "shadowMode = 'open'") });
    await page.locator('.tm-sc-emoji-trigger').waitFor();
    return page;
}
const nativeOnly = await fixture({ buttons: false });
await nativeOnly.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
assert.equal(await nativeOnly.locator('.tm-sc-response-length-menu-item, .tm-sc-persistent-command-menu-item').count(), 0, 'visible native image button must not be treated as an open menu');
await nativeOnly.evaluate(() => { window.__plainMenus = true; });
await nativeOnly.locator('[aria-label=Plus-button]').click();
await nativeOnly.locator('[data-fixture-menu]').waitFor();
assert.equal(await nativeOnly.locator('.tm-sc-response-length-menu-item, .tm-sc-persistent-command-menu-item').count(), 0);
await nativeOnly.locator('#thread').click({ position: { x: 2, y: 2 } });
assert.equal(await nativeOnly.locator('.tm-sc-response-length-menu-item, .tm-sc-persistent-command-menu-item').count(), 0);
scenarios.push('visible-native-image-control-is-not-a-menu');
const page = await fixture();
await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
assert.equal(await page.locator('.tm-sc-response-length-menu-item, .tm-sc-persistent-command-menu-item').count(), 0, 'closed menus must not inject settings into composer controls');
const draft = page.locator('textarea[placeholder="Message..."]');
await draft.fill('Saved draft'); await page.locator('.tm-sc-save-current-text').click();
await page.waitForFunction(bot => __gm.get(`tm-sc-saved-texts-v1:bot:${bot}`)?.length === 1, bot);
await draft.fill('');
await page.locator('.tm-sc-open-saved-texts').click();
await page.locator('.tm-sc-saved-card').waitFor();
await page.getByRole('button', { name: 'Вставить', exact: true }).click();
assert.equal(await draft.inputValue(), 'Saved draft');
await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
await page.keyboard.press('Escape');
await draft.fill('BeforeAfter'); await draft.evaluate(node => node.setSelectionRange(6, 6));
await page.locator('.tm-sc-emoji-trigger').click();
const emoji = page.locator('.tm-sc-emoji-item').first(); const glyph = await emoji.getAttribute('aria-label'); await emoji.click();
assert.equal(await draft.inputValue(), `Before${glyph}After`); await page.keyboard.press('Escape');
scenarios.push('save-and-reuse-draft', 'emoji-at-caret');
await page.locator('.tm-sc-suggest-reply-shortcut').click();
await page.waitForFunction(() => __actions.suggest === 1);
assert.equal(await draft.inputValue(), `Before${glyph}After`);
assert.equal(await page.locator('.tm-sc-generate-image-shortcut').isVisible(), false, 'image shortcut must hide with a draft, as its original handler intends');
await draft.fill(''); await page.locator('.tm-sc-generate-image-shortcut').click();
await page.waitForFunction(() => __actions.image === 1);
scenarios.push('persistent-lightbulb-with-draft', 'image-shortcut');
const chatPanel = page.locator('#spchat-chat-panel');
assert.equal(await chatPanel.locator('input[type=range]').getAttribute('max'), '300');
await chatPanel.locator('.tm-sc-response-length-slider').fill('280');
await chatPanel.locator('.tm-sc-response-model-select').selectOption('deepseek-v4pro');
await chatPanel.locator('.manual > summary').click();
await chatPanel.getByLabel('Текст постоянной команды', { exact: true }).fill('Fixture command');
await page.evaluate(async chat => {
    await fetch('https://prod.nd-api.com/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer synthetic-session' }, body: JSON.stringify({ conversation_id: chat, message: 'Hello', inference_model: 'qwenplus-character', inference_settings: { max_new_tokens: 200 } }) });
}, chat);
const generated = JSON.parse(requests.findLast(req => req.url.endsWith('/chat') && req.method === 'POST').body);
assert.equal(generated.inference_settings.max_new_tokens, 280); assert.equal(generated.inference_model, 'deepseek-v4pro'); assert.equal(generated.message, 'Hello\n\n/cmd Fixture command');
await chatPanel.locator('.tm-sc-response-model-select').selectOption('');
await chatPanel.getByRole('button', { name: 'Как на сайте', exact: true }).click();
await page.evaluate(async chat => fetch('https://prod.nd-api.com/chat', { method: 'POST', body: JSON.stringify({ conversation_id: chat, inference_model: 'qwenplus-character', inference_settings: { max_new_tokens: 200 }, message: 'Site defaults' }) }), chat);
const defaults = JSON.parse(requests.findLast(req => req.url.endsWith('/chat') && req.method === 'POST').body);
assert.equal(defaults.inference_model, 'qwenplus-character'); assert.equal(defaults.inference_settings.max_new_tokens, 200);
await chatPanel.locator('.tm-sc-response-model-select').selectOption('deepseek-v4pro');
await chatPanel.locator('.tm-sc-response-length-slider').fill('280');
scenarios.push('top-right-panel-token-model-command-autosave', 'generation-request-rewrite', 'per-chat-model-and-token-default-reset');
// Persistent panel stays accessible while native menus retain dismissal.
assert.equal(await chatPanel.getByRole('button', { name: 'Сохранить', exact: true }).count(), 0);
await page.locator('#thread').click({ position: { x: 2, y: 2 } });
assert.equal(await chatPanel.isVisible(), true);
await page.keyboard.press('Escape');
assert.equal(await chatPanel.isVisible(), true);
await page.locator('[aria-label=Plus-button]').click();
await page.locator('[data-fixture-menu]').waitFor();
assert.equal(await page.locator('.tm-sc-response-length-menu-item, .tm-sc-persistent-command-menu-item').count(), 0);
await page.locator('#thread').click({ position: { x: 2, y: 2 } });
await page.waitForFunction(() => !document.querySelector('[data-fixture-menu]'));
scenarios.push('persistent-panel-and-no-plus-menu-duplicates', 'native-menu-dismissal-without-duplicates');

await page.locator(`#message-${messages[0]} [aria-label=message-dropdown]`).click();
await page.locator('.tm-sc-save-history-message').click();
await page.waitForFunction(bot => __gm.get(`tm-sc-saved-texts-v1:bot:${bot}`)?.length === 2, bot);
assert.equal(await page.evaluate(bot => __gm.get(`tm-sc-saved-texts-v1:bot:${bot}`)[1].text, bot), 'First *formatted* message');
await page.waitForFunction(() => !document.querySelector('[data-fixture-menu]'));
async function bookmark(page, index, title) {
    await page.locator(`#message-${messages[index]} [aria-label=message-dropdown]`).click();
    await page.locator('.tm-sc-add-message-bookmark').click();
    await page.getByLabel('Название закладки', { exact: true }).fill(title);
    await page.locator('.tm-sc-bookmark-editor-button.is-save').click();
    await page.locator(`#message-${messages[index]} .tm-sc-message-bookmark-marker`).waitFor();
}
await bookmark(page, 0, 'First bookmark'); await bookmark(page, 1, 'Second bookmark');
scenarios.push('formatted-message-save', 'bookmark-owning-message');
await page.locator('[aria-label=chat-dropdown]').click();
for (const selector of ['.tm-sc-open-message-bookmarks', '.tm-sc-open-conversation-gallery', '.tm-sc-open-chat-branches']) await page.locator(selector).waitFor();
await page.locator('.tm-sc-open-message-bookmarks').click();
await page.locator('.tm-sc-bookmark-card').first().waitFor(); assert.equal(await page.locator('.tm-sc-bookmark-card').count(), 2);
await page.locator('.tm-sc-bookmarks-close').click();
await page.locator('[aria-label=chat-dropdown]').click(); await page.locator('.tm-sc-open-conversation-gallery').click();
await page.locator('.tm-sc-gallery-tile').first().click();
await page.locator('.tm-sc-gallery-viewer-close').click(); await page.locator('.tm-sc-gallery-close').click();
await page.locator('[aria-label=chat-dropdown]').click(); await page.locator('.tm-sc-open-chat-branches').click();
await page.locator('.tm-sc-branch-card').first().waitFor();
await page.locator('.tm-sc-branches-close').click();
scenarios.push('chat-portal-bookmark-list', 'gallery-and-image-viewer', 'branches-tree');
await page.evaluate(async ({ bot, chat }) => { await fetch(`https://prod.nd-api.com/characters/${bot}/messages/${chat}`, { headers: { Authorization: 'Bearer synthetic-session' } }); }, { bot, chat });
await page.locator('.tm-sc-message-sent-at').first().waitFor();
await page.waitForFunction(() => document.querySelectorAll('.tm-sc-message-sent-at').length === 2);
await page.locator('.tm-sc-message-session-divider').waitFor();
assert.equal(await page.locator('.sc-quick-delete-button:not(.sc-quick-replay-button)').count(), 2);
assert.equal(await page.locator('.sc-quick-replay-button').count(), 1);
scenarios.push('captured-timestamps-and-session-break', 'delete-and-replay-controls');
await page.locator('.sc-quick-replay-button').click();
await page.waitForFunction(() => __actions.remove === 1 && __actions.send === 1);
assert.equal(await draft.inputValue(), 'Fixture 1');
assert.equal(await page.locator('[id^=message-]').count(), 1);
await page.locator('.sc-quick-delete-button').click();
await page.waitForFunction(() => __actions.remove === 2);
assert.equal(await page.locator('[id^=message-]').count(), 0);
scenarios.push('native-chain-delete', 'replay-original-user-text');
const independent = await fixture({ 'saved-texts': false, 'quick-delete': false });
// This scenario deliberately has no saved-text toolbar.
await bookmark(independent, 1, 'Independent bookmark');
// Reuse the exact portal element with its injected bookmark item for another message.
await independent.locator(`#message-${messages[1]} [aria-label=message-dropdown]`).click();
await independent.locator('.tm-sc-add-message-bookmark').waitFor();
await independent.evaluate(() => {
    const menu = document.querySelector('[data-fixture-menu]');
    menu.__trigger = document.querySelector('[id^=message-] [aria-label=message-dropdown]');
    menu.__trigger.addEventListener('click', event => event.stopImmediatePropagation(), true);
    menu.__trigger.click();
});
await independent.locator('.tm-sc-add-message-bookmark').click();
await independent.getByLabel('Название закладки', { exact: true }).fill('Reused portal owner');
await independent.locator('.tm-sc-bookmark-editor-button.is-save').click();
await independent.locator(`#message-${messages[0]} .tm-sc-message-bookmark-marker`).waitFor();
scenarios.push('reused-portal-owner');
const standaloneSave = await fixture({ 'quick-delete': false });
await standaloneSave.locator(`#message-${messages[1]} [aria-label=message-dropdown]`).click();
await standaloneSave.locator('.tm-sc-save-history-message').click();
await standaloneSave.waitForFunction(bot => __gm.get(`tm-sc-saved-texts-v1:bot:${bot}`)?.[0]?.text === 'Second plain message', bot);
scenarios.push('save-message-without-quick-delete');
await standaloneSave.evaluate(() => __remountComposer());
await standaloneSave.locator('.tm-sc-save-current-text').waitFor();
assert.equal(await standaloneSave.locator('.tm-sc-suggest-reply-shortcut').count(), 1);
assert.equal(await standaloneSave.locator('.tm-sc-emoji-trigger').count(), 1);
await standaloneSave.locator('.tm-sc-open-saved-texts').click();
await standaloneSave.locator('.tm-sc-saved-search').waitFor({ state: 'visible' });
await standaloneSave.keyboard.press('Escape');
scenarios.push('composer-remount-with-working-controls');
scenarios.push('bookmarks-without-saved-texts-or-quick-delete');
const inline = await fixture({ 'saved-texts': false, 'quick-delete': false });
await inline.evaluate(() => { window.__inlineMenus = true; });
await bookmark(inline, 1, 'Inline owner');
assert.equal(await inline.locator(`#message-${messages[0]} .tm-sc-message-bookmark-marker`).count(), 0);
scenarios.push('inline-menu-with-neighboring-messages');
const complete = await fixture({ summary: true, tts: true });
await complete.evaluate(() => { window.__inlineStyles = true; });
await complete.locator('[aria-label=chat-dropdown]').click();
for (const name of ['tm-sc-open-message-bookmarks', 'tm-sc-open-conversation-gallery', 'tm-sc-open-gpt-summary', 'tm-sc-open-chat-branches']) {
    await complete.locator('.' + name).waitFor();
    assert.equal(await complete.locator('.' + name).count(), 1, name + ' must identify exactly its own action');
}
scenarios.push('all-eleven-modules-menu-isolation');
for (const name of ['tm-sc-open-message-bookmarks', 'tm-sc-open-conversation-gallery', 'tm-sc-open-gpt-summary', 'tm-sc-open-chat-branches']) {
    assert.equal(await complete.locator('.' + name).evaluate(node => getComputedStyle(node).paddingLeft), '19px');
}
scenarios.push('native-menu-inline-styles-preserved');
await complete.evaluate(() => {
    window.__handlerRequests = []; window.__played = 0; window.__aborted = 0;
    window.AudioContext = class {
        state = 'running'; destination = {};
        async resume() {} async decodeAudioData() { return { duration: 0.01 }; }
        createBufferSource() { const source = { connect() {}, start() { __played++; setTimeout(() => source.onended?.(), 5); }, stop() { source.onended?.(); } }; return source; }
    };
    window.GM_xmlhttpRequest = options => {
        const data = JSON.parse(options.data); __handlerRequests.push({ url: options.url, headers: options.headers, data });
        const timer = window.__holdRequests ? null : setTimeout(() => {
            const payload = data.stage ? { ok: true, summary: '## Fixture summary\n\nTwo invented messages.', usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } }
                : data.action === 'prepare' ? { ok: true, segments: [{ text: 'First segment' }, { text: 'Second segment' }] }
                : { ok: true, audio: 'AQID' };
            options.onload({ status: 200, responseText: JSON.stringify(payload) });
        }, 10);
        return { abort() { clearTimeout(timer); __aborted++; options.onabort?.(); } };
    };
    document.querySelector('[data-fixture-menu]')?.remove();
    for (const message of document.querySelectorAll('[id^=message-]')) {
        const volume = document.createElement('button'); volume.setAttribute('aria-label', 'Volume2-button'); volume.textContent = 'Speak'; message.querySelector('.relative').append(volume);
    }
});
await complete.evaluate(async ({ bot, chat }) => (await fetch(`https://prod.nd-api.com/characters/${bot}/messages/${chat}`, { headers: { Authorization: 'Bearer synthetic-session' } })).json(), { bot, chat });
await complete.locator('[aria-label=chat-dropdown]').click(); await complete.locator('.tm-sc-open-gpt-summary').click();
await complete.getByText('Two invented messages.', { exact: true }).waitFor();
assert.equal(await complete.evaluate(() => __handlerRequests.filter(x => x.data.stage).length), 1);
assert.equal(await complete.evaluate(() => __handlerRequests[0].headers['X-Spicy-Summary-Token']), 'fixture-summary');
await complete.keyboard.press('Escape');
await complete.locator('[aria-label=chat-dropdown]').click(); await complete.locator('.tm-sc-open-gpt-summary').click();
await complete.getByText('Two invented messages.', { exact: true }).waitFor();
assert.equal(await complete.evaluate(() => __handlerRequests.filter(x => x.data.stage).length), 1, 'reopening must use the existing summary');
await complete.keyboard.press('Escape');
scenarios.push('summary-generation-and-cache-with-local-endpoint');
await complete.locator('.tm-sc-inworld-tts-button').first().click();
await complete.waitForFunction(() => __played === 2 && document.querySelector('#tm-sc-inworld-tts-log').textContent.includes('Озвучка завершена'));
assert.deepEqual(await complete.evaluate(() => __handlerRequests.filter(x => x.url.endsWith('/tts')).map(x => x.data.action)), ['prepare', 'synthesize', 'synthesize']);
await complete.locator('.tm-sc-inworld-tts-button').first().click();
await complete.waitForFunction(() => __played === 4 && document.querySelector('#tm-sc-inworld-tts-log').textContent.includes('Озвучка завершена'));
assert.equal(await complete.evaluate(() => __handlerRequests.filter(x => x.url.endsWith('/tts')).length), 3);
await complete.evaluate(() => { window.__holdRequests = true; });
await complete.locator('.tm-sc-inworld-tts-button').nth(1).click();
await complete.waitForFunction(() => __handlerRequests.filter(x => x.url.endsWith('/tts')).length === 4);
await complete.locator('.tm-sc-inworld-tts-button').nth(1).click();
assert.equal(await complete.evaluate(() => __aborted), 1);
scenarios.push('tts-prepare-synthesize-ordered-playback-cache-cancel');
const manage = await fixture({}, { graph: { nodes: [
    { conversationId: chat, characterId: bot, title: 'Root', kind: 'root', createdAt: 1 },
    { conversationId: '55555555-5555-4555-8555-555555555555', characterId: bot, title: 'Child branch', kind: 'partial', parentId: chat, forkMessageId: messages[0], createdAt: 2 },
] } });
await manage.evaluate(bot => {
    __gm.set(`tm-sc-saved-texts-v1:bot:${bot}`, [
        { id: 'alpha', text: 'Alpha text', createdAt: 10, pinned: false },
        { id: 'beta', text: 'Beta text', createdAt: 20, pinned: false },
    ]);
}, bot);
await manage.locator('.tm-sc-open-saved-texts').click();
await manage.locator('.tm-sc-saved-card').first().waitFor();
await manage.locator('[data-entry-id=alpha]').getByRole('button', { name: 'Закрепить', exact: true }).click();
await manage.waitForFunction(() => document.querySelector('.tm-sc-saved-card')?.dataset.entryId === 'alpha');
await manage.locator('.tm-sc-saved-search').fill('Beta');
assert.equal(await manage.locator('.tm-sc-saved-card').count(), 1);
await manage.getByRole('button', { name: 'Удалить', exact: true }).click();
assert.equal(await manage.evaluate(bot => __gm.get(`tm-sc-saved-texts-v1:bot:${bot}`).length, bot), 2);
await manage.getByRole('button', { name: 'Подтвердить удаление', exact: true }).click();
await manage.waitForFunction(bot => __gm.get(`tm-sc-saved-texts-v1:bot:${bot}`).length === 1, bot);
await manage.keyboard.press('Escape');
scenarios.push('saved-text-search-pin-confirmed-delete');
await bookmark(manage, 0, 'Editable bookmark');
await manage.locator('[aria-label=chat-dropdown]').click(); await manage.locator('.tm-sc-open-message-bookmarks').click();
await manage.getByRole('button', { name: 'Изменить название', exact: true }).click();
await manage.getByLabel('Название закладки', { exact: true }).fill('Renamed bookmark');
await manage.locator('.tm-sc-bookmark-editor-button.is-save').click();
await manage.waitForFunction(() => document.querySelector('.tm-sc-message-bookmark-marker')?.getAttribute('aria-label') === 'Renamed bookmark');
await manage.locator('[aria-label=chat-dropdown]').click(); await manage.locator('.tm-sc-open-message-bookmarks').click();
await manage.getByText('Renamed bookmark', { exact: true }).waitFor();
await manage.getByRole('button', { name: 'Удалить закладку', exact: true }).click();
assert.equal(await manage.locator('.tm-sc-message-bookmark-marker').count(), 1);
await manage.locator('.tm-sc-bookmark-confirm-button.is-yes').click();
await manage.waitForFunction(() => !document.querySelector('.tm-sc-message-bookmark-marker'));
await manage.keyboard.press('Escape');
scenarios.push('bookmark-rename-and-confirmed-delete');
await manage.locator('[aria-label=chat-dropdown]').click(); await manage.locator('.tm-sc-open-chat-branches').click();
await manage.getByText('Child branch', { exact: true }).waitFor();
await manage.locator('.tm-sc-branch-toggle').first().click();
await manage.waitForFunction(() => !document.querySelector('.tm-sc-branch-card.is-child') && document.querySelectorAll('.tm-sc-branch-card').length === 1);
await manage.locator('.tm-sc-branch-toggle').first().click();
await manage.getByText('Child branch', { exact: true }).waitFor();
const child = manage.locator('.tm-sc-branch-card').filter({ hasText: 'Child branch' });
await child.getByRole('button', { name: 'Переименовать в дереве', exact: true }).click();
await manage.locator('.tm-sc-branches-editor-input').fill('Renamed child'); await manage.locator('.tm-sc-branches-editor-save').click();
await manage.getByText('Renamed child', { exact: true }).waitFor();
await manage.locator('.tm-sc-branches-search').fill('Renamed');
assert.equal(await manage.getByText('Renamed child', { exact: true }).count(), 1);
await manage.keyboard.press('Escape');
scenarios.push('branch-collapse-rename-search');
await manage.evaluate(({ bot }) => { history.pushState(null, '', `/chat/${bot}/66666666-6666-4666-8666-666666666666`); }, { bot });
await manage.locator('.tm-sc-open-saved-texts').click();
await manage.locator('.tm-sc-saved-search').fill('');
await manage.getByText('Alpha text', { exact: true }).waitFor();
assert.equal(await manage.locator('.tm-sc-message-bookmark-marker').count(), 0);
await manage.keyboard.press('Escape');
scenarios.push('spa-route-keeps-bot-library-and-isolates-conversation-state');
// Real React rows reproduce the supplied wd -> X -> div callback contract.
const modelPage = await fixture();
for (const [packageName, file] of [['react', 'react.production.min.js'], ['react-dom', 'react-dom.production.min.js']]) {
    const base = new URL('../node_modules/' + packageName + '/umd/', import.meta.url);
    await modelPage.addScriptTag({ content: await readFile(new URL(file, base), 'utf8') });
}
await modelPage.evaluate(() => {
    localStorage.setItem('tm-sc-per-chat-inference-model-v1', JSON.stringify({ 'old-conversation': 'glm45' }));
    localStorage.setItem('fixture-native-model', 'qwenplus-character');
    window.__selectedNative = 'qwenplus-character'; window.__nativeModelClicks = 0; window.__exploreClicks = 0;
    const h = React.createElement;
    const Flex = ({ onClick, children, ...props }) => h('div', { ...props, onClick }, children);
    function NativeModelRow({ model, activeModel, clickHandler }) {
        const onClick = () => !model.isDisabled && clickHandler({ id: model.id, name: model.name });
        return h(Flex, { onClick, className: 'cursor-pointer px-[18px] py-[10px]', 'data-native-model': model.id },
            h('div', null, h('div', null, h('p', null, model.name), h('div', null, h('p', null, 'Fixture badge'))), h('p', { className: 'text-gray-10 line-clamp-2' }, 'Invented description')),
            activeModel === model.id && h('svg', { className: 'lucide-check', width: '20', height: '20' }, h('path', { d: 'M20 6 9 17l-5-5' })));
    }
    function ModelApp() {
        const [activeModel, setActiveModel] = React.useState(() => localStorage.getItem('fixture-native-model'));
        const [open, setOpen] = React.useState(false);
        const [nativeMimo, setNativeMimo] = React.useState(false);
        const [toast, setToast] = React.useState('');
        window.__openQuickModels = (native = false) => { setNativeMimo(native); setOpen(true); };
        window.__setActiveModel = id => { setActiveModel(id); window.__selectedNative = id; };
        const select = React.useCallback(({ id, name }) => {
            setActiveModel(id); window.__selectedNative = id; window.__nativeModelClicks++;
            localStorage.setItem('fixture-native-model', id); setToast(name); setOpen(false);
        }, []);
        const choices = [
            { name: 'Qwen Plus Character', id: 'qwenplus-character' }, { name: 'Glam 5.1', id: 'glm51' },
            { name: 'Deepseek V4 Pro', id: 'deepseek-v4pro' }, { name: 'Qwen3 235B 2507', id: 'unwanted' }, { name: 'Codex 24B', id: 'unwanted-codex' },
            ...(nativeMimo ? [{ name: 'MiMo V2.6 Pro', id: 'mimo-v26-pro' }] : []),
        ];
        return h(React.Fragment, null,
            h('div', { id: 'native-model-toast' }, toast),
            open && h('div', { id: 'native-model-menu', 'data-testid': 'Dropdown-Panel', style: { position: 'fixed', right: '20px', top: '20px', background: 'white', zIndex: 100, maxWidth: '330px' } },
                h('div', { style: { display: 'flex', flexDirection: 'column' } },
                    h('div', null, h('p', null, 'Available models')),
                    ...choices.map(model => h(NativeModelRow, { key: model.id, model, activeModel, clickHandler: select })),
                    h('div'),
                    h(Flex, { className: 'cursor-pointer px-[18px] py-[10px]', onClick: () => {
                        window.__exploreClicks++; const full = document.createElement('div'); full.id = 'native-full-models'; document.body.append(full); setOpen(false);
                    } }, h('p', null, 'Explore all models'), h('p', null, 'Find your ideal model')),
                    h(Flex, { className: 'cursor-pointer px-[18px] py-[10px]' }, h('p', null, 'Generation Settings')))));
    }
    const root = document.createElement('section'); document.body.append(root);
    ReactDOM.createRoot(root).render(h(ModelApp));
});
await modelPage.waitForFunction(() => typeof __openQuickModels === 'function');
await modelPage.evaluate(() => __openQuickModels());
const quickModelNames = ['Deepseek V4 Pro', 'Qwen Plus Character', 'Glam 5.1', 'MiMo V2.6 Pro'];
const mimoShortcut = modelPage.locator('[data-sc-quick-model="mimo-v26-pro"]');
await mimoShortcut.waitFor();
const readQuickModels = () => modelPage.evaluate(() => [...document.querySelectorAll('#native-model-menu .cursor-pointer')]
    .filter(row => getComputedStyle(row).display !== 'none' && !['Explore all models', 'Generation Settings'].includes(row.querySelector('p')?.textContent))
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
    .map(row => row.querySelector('p').textContent));
assert.deepEqual(await readQuickModels(), quickModelNames);
assert.equal(await modelPage.locator('[data-native-model=unwanted]').isVisible(), false);
assert.equal(await modelPage.locator('[data-native-model=unwanted-codex]').isVisible(), false);
assert.equal(await mimoShortcut.getAttribute('aria-disabled'), 'false');
assert.equal(await mimoShortcut.locator('.lucide-check').count(), 0, 'never copy another model selection check');
await mimoShortcut.click();
await modelPage.waitForFunction(() => __selectedNative === 'mimo-v26-pro' && __nativeModelClicks === 1);
await modelPage.locator('#native-model-menu').waitFor({ state: 'detached' });
assert.equal(await modelPage.locator('#native-model-toast').textContent(), 'MiMo V2.6 Pro');
assert.equal(await modelPage.evaluate(() => localStorage.getItem('fixture-native-model')), 'mimo-v26-pro');
assert.equal(await modelPage.evaluate(() => __exploreClicks), 0, 'MiMo must never open Explore all models');
assert.equal(await modelPage.locator('#native-full-models').count(), 0);
await modelPage.evaluate(() => __openQuickModels());
await mimoShortcut.locator('[data-sc-model-check]').waitFor();
assert.equal(await modelPage.locator('#native-model-menu .lucide-check').count(), 1);
await modelPage.evaluate(() => __setActiveModel('glm51'));
await mimoShortcut.locator('[data-sc-model-check]').waitFor({ state: 'detached' });
await modelPage.evaluate(() => __setActiveModel('mimo-v26-pro'));
await mimoShortcut.locator('[data-sc-model-check]').waitFor();
await modelPage.evaluate(() => document.body.append(document.createElement('div')));
await modelPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
assert.equal(await mimoShortcut.count(), 1);
assert.equal(await mimoShortcut.locator('[data-sc-model-check]').count(), 1);
await modelPage.locator('[data-native-model=deepseek-v4pro]').click();
assert.equal(await modelPage.evaluate(() => __selectedNative), 'deepseek-v4pro', 'native choices retain their handler');
await modelPage.evaluate(() => __openQuickModels());
await mimoShortcut.waitFor();
assert.equal(await mimoShortcut.locator('[data-sc-model-check]').count(), 0);
await mimoShortcut.press('Enter');
await modelPage.waitForFunction(() => __selectedNative === 'mimo-v26-pro' && !document.querySelector('#native-model-menu'));
await modelPage.evaluate(() => __openQuickModels(true));
await modelPage.waitForFunction(() => { const row = document.querySelector('[data-native-model=unwanted]'); return row && getComputedStyle(row).display === 'none'; });
assert.equal(await mimoShortcut.count(), 0, 'site-provided MiMo replaces our row without duplication');
assert.deepEqual(await readQuickModels(), quickModelNames);
assert.equal(await modelPage.locator('[data-native-model="mimo-v26-pro"] .lucide-check').count(), 1);
await modelPage.locator('[data-native-model="mimo-v26-pro"]').click();
assert.equal(await modelPage.evaluate(() => __exploreClicks), 0);
scenarios.push('four-ordered-native-models', 'react-native-mimo-selection-without-full-chooser', 'native-model-persistence-toast-and-dismissal', 'selected-check-on-reopen-and-react-alternate-update', 'native-model-handlers-retained', 'model-menu-reopen-and-native-deduplication', 'mimo-keyboard-selection');

assert.deepEqual(await modelPage.locator('.tm-sc-response-model-select option').allTextContents(), ['Как выбрано на сайте', ...quickModelNames]);
await modelPage.locator('.tm-sc-response-model-select').selectOption('mimo-v26-pro');
assert.deepEqual(await modelPage.evaluate(() => JSON.parse(localStorage.getItem('tm-sc-per-chat-inference-model-v1'))), { 'old-conversation': 'glm45', [chat]: 'mimo-v26-pro' });
await modelPage.evaluate(async chat => fetch('https://prod.nd-api.com/chat', { method: 'POST', body: JSON.stringify({ conversation_id: chat, inference_model: 'glm51', message: 'Model test' }) }), chat);
assert.equal(JSON.parse(requests.findLast(req => req.url.endsWith('/chat') && req.method === 'POST').body).inference_model, 'mimo-v26-pro');
scenarios.push('shared-per-chat-model-list', 'per-chat-mimo-request-and-legacy-storage-preservation');
// Manage the real library UI, then select multiple independent CMDs per chat.
const commandsPage = await fixture();
const otherChat = '77777777-7777-4777-8777-777777777777';
await commandsPage.evaluate(({ chat, otherChat }) => {
    localStorage.setItem('tm-sc-per-chat-persistent-command-v1', JSON.stringify({ [chat]: 'Existing manual', [otherChat]: 'Other manual' }));
}, { chat, otherChat });
const settings = commandsPage.locator('#spchat-tools-settings');
const manager = settings.locator('section').filter({ has: commandsPage.locator('[name=quick-command-name]') });
const commandPopup = commandsPage.locator('#spchat-chat-panel');
async function openCommands() {
    await commandPopup.waitFor({ state: 'visible' });
    await commandsPage.waitForFunction(() => document.querySelector('#spchat-chat-panel')?.dataset.scConversation === location.pathname.split('/').at(-1));
    if ((await commandPopup.locator('.panel').getAttribute('open')) === null) await commandPopup.locator('.heading').click();
    if ((await commandPopup.locator('.manual').getAttribute('open')) === null) await commandPopup.locator('.manual > summary').click();
}
async function addQuick(name, text) {
    await manager.getByLabel('Название команды', { exact: true }).fill(name);
    await manager.getByLabel('Текст команды', { exact: true }).fill(text);
    await manager.getByRole('button', { name: 'Добавить команду', exact: true }).click();
}
async function generateCommands(conversation = chat) {
    await commandsPage.evaluate(async conversation => fetch('https://prod.nd-api.com/chat', { method: 'POST', body: JSON.stringify({ conversation_id: conversation, message: 'Commands test' }) }), conversation);
    return JSON.parse(requests.findLast(request => request.url.endsWith('/chat') && request.method === 'POST').body).message;
}
await settings.getByRole('button', { name: 'SC Tools', exact: true }).click();
await manager.getByRole('button', { name: 'Добавить команду', exact: true }).click();
await manager.getByRole('status').filter({ hasText: 'Укажи название команды.' }).waitFor();
assert.equal(await commandsPage.evaluate(() => __gm.has('spchat-tweaks:quick-commands:v1')), false);
await addQuick('First <b>title</b>', '/cmd First quick text');
await addQuick('Second quick', 'Second quick text');
await addQuick('Not selected', 'Do not send');
assert.equal(await manager.locator('.quick-command-card').count(), 3);
assert.equal(await manager.getByRole('status').textContent(), 'Команда сохранена.');
assert.equal(await manager.locator('.quick-command-card h3 b').count(), 0, 'stored names are displayed as literal text');
await settings.getByRole('button', { name: 'Закрыть', exact: true }).click();
await openCommands();
assert.equal(await commandPopup.getByLabel('Текст постоянной команды', { exact: true }).inputValue(), 'Existing manual');
assert.equal(await commandPopup.getByRole('checkbox').count(), 3);
await commandPopup.getByRole('checkbox', { name: 'First <b>title</b>', exact: true }).check();
await commandPopup.getByRole('checkbox', { name: 'Second quick', exact: true }).check();
assert.equal(await commandPopup.getByRole('button', { name: 'Сохранить', exact: true }).count(), 0);
const separateCommands = 'Commands test\n\n/cmd Existing manual\n\n/cmd First quick text\n\n/cmd Second quick text';
assert.equal(await generateCommands(), separateCommands);
await openCommands();
assert.equal(await commandPopup.getByRole('checkbox', { name: 'First <b>title</b>', exact: true }).isChecked(), true);
assert.equal(await commandPopup.getByRole('checkbox', { name: 'Second quick', exact: true }).isChecked(), true);
assert.equal(await commandPopup.getByRole('checkbox', { name: 'Not selected', exact: true }).isChecked(), false);
await commandPopup.getByRole('checkbox', { name: 'Second quick', exact: true }).uncheck();
assert.equal(await generateCommands(), 'Commands test\n\n/cmd Existing manual\n\n/cmd First quick text', 'a checkbox applies immediately');
await commandsPage.keyboard.press('Escape');
assert.equal(await generateCommands(), 'Commands test\n\n/cmd Existing manual\n\n/cmd First quick text', 'Escape does not undo autosaved changes');
await commandPopup.getByRole('checkbox', { name: 'Second quick', exact: true }).check();
const modelsBeforeNavigation = await commandsPage.evaluate(() => localStorage.getItem('tm-sc-per-chat-inference-model-v1'));
await commandsPage.evaluate(({ bot, otherChat }) => {
    history.pushState(null, '', `/chat/${bot}/${otherChat}`);
    const select = document.querySelector('#spchat-chat-panel').shadowRoot.querySelector('select');
    select.value = 'glm51'; select.dispatchEvent(new Event('change', { bubbles: true }));
}, { bot, otherChat });
assert.equal(await commandsPage.evaluate(() => localStorage.getItem('tm-sc-per-chat-inference-model-v1')), modelsBeforeNavigation, 'a stale control must not save into the newly opened chat');
await openCommands();
assert.equal(await commandPopup.getByLabel('Текст постоянной команды', { exact: true }).inputValue(), 'Other manual');
assert.equal(await commandPopup.locator('input:checked').count(), 0);
await commandPopup.getByRole('checkbox', { name: 'Not selected', exact: true }).check();
assert.equal(await generateCommands(otherChat), 'Commands test\n\n/cmd Other manual\n\n/cmd Do not send');
assert.equal(await generateCommands(chat), separateCommands, 'another chat does not change the first selection');
await commandsPage.evaluate(({ bot, chat }) => history.pushState(null, '', `/chat/${bot}/${chat}`), { bot, chat });
await settings.getByRole('button', { name: 'SC Tools', exact: true }).click();
const firstCard = manager.locator('.quick-command-card').filter({ hasText: 'First <b>title</b>' });
await firstCard.getByRole('button', { name: 'Редактировать', exact: true }).click();
await manager.getByLabel('Название команды', { exact: true }).fill('Renamed quick');
await manager.getByLabel('Текст команды', { exact: true }).fill('Changed quick text');
await manager.getByRole('button', { name: 'Сохранить команду', exact: true }).click();
await manager.locator('.quick-command-card').filter({ hasText: 'Second quick' }).getByRole('button', { name: 'Удалить', exact: true }).click();
assert.equal(await manager.locator('.quick-command-card').count(), 2);
const [downloaded] = await Promise.all([
    commandsPage.waitForEvent('download', { timeout: 15000 }),
    settings.getByRole('button', { name: 'Скачать копию настроек и данных', exact: true }).click(),
]);
const commandsBackup = JSON.parse(await readFile(await downloaded.path(), 'utf8'));
assert.equal(commandsBackup.values['spchat-tweaks:quick-commands:v1'].commands.length, 2);
assert.equal(commandsBackup.values['spchat-tweaks:quick-commands:v1'].selections[chat].length, 1);
await settings.getByRole('button', { name: 'Закрыть', exact: true }).click();
assert.equal(await generateCommands(), 'Commands test\n\n/cmd Existing manual\n\n/cmd Changed quick text');
await openCommands();
assert.equal(await commandPopup.getByRole('checkbox', { name: 'Renamed quick', exact: true }).isChecked(), true);
assert.equal(await commandPopup.getByRole('checkbox', { name: 'Second quick', exact: true }).count(), 0);
await commandsPage.setViewportSize({ width: 520, height: 700 });
await commandPopup.locator('.heading').click();
assert.match(await commandPopup.locator('.compact').first().textContent(), /токенов|токены сайта/);
assert.match(await commandPopup.locator('.compact').nth(1).textContent(), /Renamed quick/);
assert.match(await commandPopup.locator('.compact').nth(2).textContent(), /Existing manual/);
await commandsPage.screenshot({ path: new URL('../test-results/chat-panel-collapsed-' + browserName + '.png', import.meta.url).pathname });
await commandPopup.locator('.heading').click();
const commandBounds = await commandPopup.boundingBox();
assert.ok(commandBounds.x >= 0 && commandBounds.x + commandBounds.width <= 520 && commandBounds.height <= 676);
await commandsPage.screenshot({ path: new URL('../test-results/quick-commands-' + browserName + '.png', import.meta.url).pathname });
await commandPopup.getByLabel('Текст постоянной команды', { exact: true }).fill('');
assert.equal(await generateCommands(), 'Commands test\n\n/cmd Changed quick text', 'manual deletion retains checked quick commands');
await openCommands();
await commandPopup.getByRole('checkbox', { name: 'Renamed quick', exact: true }).uncheck();
assert.equal(await generateCommands(), 'Commands test', 'empty manual plus no checks disables all commands');
// Typing persists synchronously, without blur or a Save button.
await commandPopup.getByLabel('Текст постоянной команды', { exact: true }).pressSequentially('Typed manual');
assert.equal(await generateCommands(), 'Commands test\n\n/cmd Typed manual');
await commandsPage.evaluate(() => { window.__pageEnter = 0; document.addEventListener('keydown', event => { if (event.key === 'Enter') __pageEnter++; }); });
await commandPopup.getByLabel('Текст постоянной команды', { exact: true }).press('Enter');
assert.equal(await commandsPage.evaluate(() => __pageEnter), 0, 'typing a command must not trigger page-level send shortcuts');
await commandPopup.getByLabel('Текст постоянной команды', { exact: true }).pressSequentially('Second line');
assert.equal(await generateCommands(), 'Commands test\n\n/cmd Typed manual\nSecond line');
await commandPopup.getByLabel('Текст постоянной команды', { exact: true }).fill('Typed manual');
const modelBeforeFailure = await commandPopup.locator('select').inputValue();
await commandsPage.evaluate(() => {
    window.__storageSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
        if (key === 'tm-sc-per-chat-inference-model-v1') throw Error('Fixture quota');
        return __storageSet.call(this, key, value);
    };
});
await commandPopup.locator('select').selectOption('glm51');
await commandPopup.getByRole('status').filter({ hasText: 'Не удалось сохранить модель' }).waitFor();
assert.equal(await commandPopup.locator('select').inputValue(), modelBeforeFailure, 'a failed save restores the actual selected model');
await commandsPage.evaluate(() => { Storage.prototype.setItem = __storageSet; });
await commandPopup.locator('select').selectOption('glm51');
assert.equal(await commandPopup.getByRole('status').textContent(), '');
await commandsPage.evaluate(() => document.querySelector('#spchat-chat-panel').remove());
await commandPopup.waitFor({ state: 'visible' });
assert.equal(await commandsPage.locator('#spchat-chat-panel').count(), 1);
await commandsPage.evaluate(() => history.pushState(null, '', '/'));
await commandPopup.waitFor({ state: 'hidden' });
await commandsPage.evaluate(({ bot, chat }) => history.pushState(null, '', `/chat/${bot}/${chat}`), { bot, chat });
await openCommands();
assert.equal(await commandPopup.getByLabel('Текст постоянной команды', { exact: true }).inputValue(), 'Typed manual');
assert.equal(await commandPopup.locator('select').inputValue(), 'glm51');
scenarios.push('immediate-manual-typing-no-blur', 'panel-save-failure-restores-state', 'spa-navigation-guard-and-panel-remount');
scenarios.push('quick-command-library-create-edit-delete', 'multiple-independent-cmds-and-manual-preserved', 'quick-command-autosave-and-chat-isolation', 'quick-command-edit-delete-applies-without-retoggling', 'quick-command-backup-and-mobile-layout');
assert.deepEqual(errors, []);
console.log(JSON.stringify({ result: 'PASS', scenarios, errors }));
} catch (error) {
    console.error(JSON.stringify({ uiErrors: errors }));
    const current = browser.contexts().flatMap(context => context.pages()).at(-1);
    if (current) {
        try { await current.screenshot({ path: new URL('../test-results/feature-failure-' + browserName + '.png', import.meta.url).pathname, timeout: 3000 }); } catch {}
    }
    throw error;
} finally { await browser.close(); }
