// Synthetic UI only: no exported conversation, account data, or live API requests.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const bundle = await readFile(new URL('../dist/spicychat-tools.user.js', import.meta.url), 'utf8');
const bot = '11111111-1111-4111-8111-111111111111';
const chat = '22222222-2222-4222-8222-222222222222';
const messages = ['33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'];
const html = `<!doctype html><html><head><style>
body{margin:32px;font:16px sans-serif}button,[role=menuitem]{padding:8px;cursor:pointer}textarea{width:500px;height:80px}[role=menu]{position:fixed;left:40px;top:100px;background:white;z-index:50;border:1px solid;min-width:240px}[role=menuitem]{display:block}#composer{margin-top:40px}.flex{display:flex}.relative{position:relative}[id^=message-]{margin:12px}
</style></head><body><button aria-label="chat-dropdown">Chat menu</button>
<div id="thread">${messages.map((id, i) => `<div id="message-${id}"><div class="flex justify-between items-center gap-md${i ? ' flex-row-reverse' : ''}"><span>${i ? 'You' : 'Character'}</span><div class="relative"><button aria-label="message-dropdown">Message menu</button></div></div><div class="[overflow-wrap:anywhere]"><p>${i ? 'Second plain message' : 'First <em>formatted</em> message'}</p></div></div>`).join('')}</div>
<div id="composer" class="flex items-end gap-sm w-full"><button aria-label="Plus-button">+</button><div class="w-full flex"><div class="grow border-1 border-solid border-gray-5 rounded-[13px] py-sm px-2 bg-gray-3"><div class="flex flex-1 items-end gap-1"><textarea placeholder="Message..."></textarea></div></div></div><button aria-label="send-message">Send</button></div>
<img width="20" height="20" src="https://cdn.nd-api.com/conversations/${chat}/fixture.png">
</body></html>`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const errors = []; const scenarios = []; const requests = [];
try {
const context = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
await context.route('**/*', async route => {
    const req = route.request();
    if (req.url().startsWith('https://spicychat.ai/chat/')) return route.fulfill({ contentType: 'text/html', body: html });
    if (req.resourceType() === 'image') return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1cAAAAASUVORK5CYII=', 'base64') });
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
async function fixture(disabled = {}) {
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) errors.push(msg.text()); });
    await page.goto(`https://spicychat.ai/chat/${bot}/${chat}`);
    await page.evaluate(({ disabled, bot, chat }) => {
        __gm.set('spchat-tweaks:settings:v1', { active: true, modules: { summary: false, tts: false, ...disabled }, endpoints: {} });
        __gm.set(`tm-sc-chat-branches-v1:bot:${bot}`, { nodes: [{ conversationId: chat, characterId: bot, title: 'Fixture root', kind: 'root', createdAt: Date.now() }] });
        document.querySelector('[id^=message-]').append(document.querySelector('img'));
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
        document.querySelector('[aria-label=send-message]').onclick = () => __actions.send++;
        // Native menus live in a body portal, have role items rather than buttons,
        // and expose text instead of the old English aria labels.
        for (const button of document.querySelectorAll('[aria-label$=dropdown], [aria-label=Plus-button]')) button.addEventListener('click', () => {
            const existing = document.querySelector('[role=menu]');
            if (existing?.__trigger === button) { existing.remove(); return; }
            existing?.remove();
            const kind = button.getAttribute('aria-label');
            const labels = kind === 'message-dropdown' ? ['Copy', 'Edit'] : kind === 'chat-dropdown' ? ['View Saved Chats', 'Start New Chat', 'Remove Messages'] : ['Generate Image', 'Suggest Reply', 'Web Search', 'Command (OOC)'];
            const menu = document.createElement('div'); menu.setAttribute('role', 'menu'); menu.__trigger = button;
            for (const label of labels) {
                const item = document.createElement('div'); item.setAttribute('role', 'menuitem'); item.tabIndex = 0; item.textContent = label;
                item.onclick = () => { if (label === 'Remove Messages') removalMode(); if (label === 'Suggest Reply') __actions.suggest++; if (label === 'Generate Image') __actions.image++; menu.remove(); };
                menu.append(item);
            }
            if (window.__inlineMenus) button.parentElement.append(menu); else document.body.append(menu);
        });
    }, { disabled, bot, chat });
    await page.addScriptTag({ content: bundle });
    await page.locator('.tm-sc-emoji-trigger').waitFor();
    return page;
}
const page = await fixture();
const draft = page.locator('textarea[placeholder="Message..."]');
await draft.fill('Saved draft'); await page.locator('.tm-sc-save-current-text').click();
await page.waitForFunction(bot => __gm.get(`tm-sc-saved-texts-v1:bot:${bot}`)?.length === 1, bot);
await page.locator('.tm-sc-open-saved-texts').click();
await page.locator('.tm-sc-saved-card').waitFor();
await draft.fill(''); await page.getByRole('button', { name: 'Вставить', exact: true }).click();
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
await draft.fill(''); await page.locator('.tm-sc-generate-image-shortcut').click();
await page.waitForFunction(() => __actions.image === 1);
scenarios.push('persistent-lightbulb-with-draft', 'image-shortcut');
await page.locator('[aria-label=Plus-button]').click();
await page.locator('.tm-sc-response-length-menu-item').click();
await page.locator('.tm-sc-response-length-slider').fill('420');
await page.locator('.tm-sc-response-model-select').selectOption('deepseek-v4pro');
await page.locator('.tm-sc-response-length-save').click();
await page.locator('[aria-label=Plus-button]').click();
await page.locator('.tm-sc-persistent-command-menu-item').click();
await page.getByLabel('Текст постоянной команды', { exact: true }).fill('Fixture command');
await page.locator('.tm-sc-persistent-command-save').click();
await page.evaluate(async chat => {
    await fetch('https://prod.nd-api.com/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer synthetic-session' }, body: JSON.stringify({ conversation_id: chat, message: 'Hello', inference_model: 'qwenplus-character', inference_settings: { max_new_tokens: 200 } }) });
}, chat);
const generated = JSON.parse(requests.findLast(req => req.url.endsWith('/chat') && req.method === 'POST').body);
assert.equal(generated.inference_settings.max_new_tokens, 420); assert.equal(generated.inference_model, 'deepseek-v4pro'); assert.equal(generated.message, 'Hello\n\n/cmd Fixture command');
scenarios.push('plus-portal-token-model-command-settings', 'generation-request-rewrite');
await page.locator(`#message-${messages[0]} [aria-label=message-dropdown]`).click();
await page.locator('.tm-sc-save-history-message').click();
await page.waitForFunction(bot => __gm.get(`tm-sc-saved-texts-v1:bot:${bot}`)?.length === 2, bot);
assert.equal(await page.evaluate(bot => __gm.get(`tm-sc-saved-texts-v1:bot:${bot}`)[1].text, bot), 'First *formatted* message');
await page.waitForFunction(() => !document.querySelector('[role=menu]'));
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
    const menu = document.querySelector('[role=menu]');
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
await standaloneSave.evaluate(() => document.querySelector('#composer').replaceWith(document.querySelector('#composer').cloneNode(true)));
await standaloneSave.locator('.tm-sc-save-current-text').waitFor();
assert.equal(await standaloneSave.locator('.tm-sc-suggest-reply-shortcut').count(), 1);
assert.equal(await standaloneSave.locator('.tm-sc-emoji-trigger').count(), 1);
scenarios.push('composer-remount-without-duplicate-controls');
scenarios.push('bookmarks-without-saved-texts-or-quick-delete');
const inline = await fixture({ 'saved-texts': false, 'quick-delete': false });
await inline.evaluate(() => { window.__inlineMenus = true; });
await bookmark(inline, 1, 'Inline owner');
assert.equal(await inline.locator(`#message-${messages[0]} .tm-sc-message-bookmark-marker`).count(), 0);
scenarios.push('inline-menu-with-neighboring-messages');
assert.deepEqual(errors, []);
console.log(JSON.stringify({ result: 'PASS', scenarios, errors }));
} finally { await browser.close(); }
