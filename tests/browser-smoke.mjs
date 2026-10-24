import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { catalog, makeLegacy, zip } from './fixtures.mjs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const browserName = process.env.TEST_BROWSER || 'chromium';
const browserType = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright')[browserName];
if (!browserType) throw new Error('Unsupported browser: ' + browserName);
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(root + 'test-results', { recursive: true });
await writeFile(root + 'test-results/migration-fixture.zip', zip(makeLegacy()));
const bundle = await readFile(root + 'dist/spicychat-tools.user.js', 'utf8');
const browser = await browserType.launch({ headless: true, firefoxUserPrefs: browserName === 'firefox' && process.env.TEST_FIREFOX_NO_SANDBOX === '1' ? { 'security.sandbox.content.level': 0 } : undefined, executablePath: browserName === 'chromium' ? process.env.CHROMIUM_EXECUTABLE || undefined : undefined, args: browserName === 'chromium' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [] });
try {
const errors = []; const apiRequests = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
await context.route('https://spicychat.ai/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><title>SpicyChat fixture</title></head><body><div style="display:flex"><div class="w-full flex"><textarea placeholder="Message..."></textarea></div></div><button aria-label="Plus-button">+</button><button aria-label="chat-dropdown">Menu</button></body></html>' }));
await context.route('https://prod.nd-api.com/**', async route => {
    if (route.request().method() === 'POST') apiRequests.push(route.request().postDataJSON());
    await route.fulfill({ contentType: 'application/json', body: '{"ok":true}', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS' } });
});
await context.addInitScript(() => {
    const db = new Map();
    window.__gm = db;
    window.unsafeWindow = window;
    window.GM_getValue = (key, fallback) => db.has(key) ? structuredClone(db.get(key)) : fallback;
    window.GM_setValue = (key, value) => db.set(key, structuredClone(value));
    window.GM_listValues = () => [...db.keys()];
    window.GM_deleteValue = key => db.delete(key);
    window.GM_registerMenuCommand = (name, callback) => { window.__menu = callback; };
    window.GM_addStyle = css => { const style = document.createElement('style'); style.textContent = css; document.documentElement.append(style); };
    window.GM_xmlhttpRequest = () => { throw new Error('Unexpected handler request'); };
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && message.text().includes('SpicyChat')) errors.push(message.text()); });
await page.goto('https://spicychat.ai/chat/bot-fixture/conversation-fixture');
// Open shadow root only in the test copy, to exercise the real settings UI.
await page.evaluate(() => localStorage.setItem('tm-sc-per-chat-persistent-command-v1', JSON.stringify({ fixture: 'saved command' })));
await page.addScriptTag({ content: bundle.replace("shadowMode = 'closed'", "shadowMode = 'open'") });
await page.getByRole('dialog').waitFor();
assert.equal(await page.getByRole('checkbox').count(), catalog.length + 1);
assert.equal(await page.locator('[name="summary-url"]').inputValue(), '');
await page.screenshot({ path: root + 'test-results/settings.png' });
assert.equal(await page.evaluate(() => window.__gm.size), 0, 'opening fresh settings must not touch user data');
await page.locator('[name="summary-url"]').fill('https://example.test/summary');
await page.locator('[name="summary-token"]').fill('fixture-local-value');
// Prevent the fixture navigation while verifying that the activation confirmation is required.
await page.getByRole('button', { name: 'Запустить комплект', exact: true }).click();
await page.getByRole('status').filter({ hasText: 'Сначала отключи' }).waitFor();
assert.equal(await page.evaluate(() => window.__gm.has('spchat-tweaks:settings:v1')), false);
// Exercise the actual ZIP picker, preview, and import handlers in the browser.
await page.locator('input[type=file]').setInputFiles(root + 'test-results/migration-fixture.zip');
await page.getByText('Найдено основных модулей: 11 из 11.', { exact: false }).waitFor();
await page.getByRole('button', { name: 'Перенести данные', exact: true }).click();
await page.getByRole('status').filter({ hasText: 'Перенос завершён' }).waitFor();
assert.equal(await page.locator('[name="summary-url"]').inputValue(), 'https://example.test/summary');
assert.equal(await page.locator('[name="summary-token"]').inputValue(), 'fixture-value-summary');
assert.equal(await page.locator('[name="module-bookmarks"]').isChecked(), false);
assert.equal(await page.evaluate(() => window.__gm.get('spchat-tweaks:settings:v1').active), false);
assert.equal(await page.evaluate(() => localStorage.getItem('tm-sc-per-chat-persistent-command-v1')), JSON.stringify({ fixture: 'saved command' }));
await page.screenshot({ path: root + 'test-results/import.png' });
// Start a new page with all modules enabled and seeded per-chat settings.
const active = await context.newPage();
active.on('pageerror', error => errors.push(error.message));
active.on('console', message => { if (message.type() === 'error' && message.text().includes('SpicyChat')) errors.push(message.text()); });
await active.goto('https://spicychat.ai/chat/bot-fixture/conversation-fixture');
await active.evaluate(() => {
    window.__gm.set('spchat-tweaks:settings:v1', { active: true, modules: {}, endpoints: {} });
    localStorage.setItem('tm-sc-per-chat-response-length-v1', JSON.stringify({ 'conversation-fixture': 420 }));
    localStorage.setItem('tm-sc-per-chat-persistent-command-v1', JSON.stringify({ 'conversation-fixture': 'fixture-command' }));
    const models = document.createElement('section');
    models.innerHTML = '<div id="qwen-row" class="cursor-pointer px-[18px] py-[10px]" style="display:grid!important"><p>Qwen3 235B 2507</p></div><div id="codex-row" class="cursor-pointer"><p>Codex 24B</p></div><div id="allowed-row" class="cursor-pointer"><p>Qwen Plus Character</p></div><p id="outside-row">Codex 24B</p><div id="insert-row" class="cursor-pointer" style="display:flex"></div>';
    document.body.append(models);
});
await active.addScriptTag({ content: bundle });
await active.waitForFunction(() => document.querySelector('#tm-sc-emoji-trigger-wrap'));
await active.waitForFunction(() => getComputedStyle(document.querySelector('#qwen-row')).display === 'none' && getComputedStyle(document.querySelector('#codex-row')).display === 'none');
assert.notEqual(await active.locator('#allowed-row').evaluate(node => getComputedStyle(node).display), 'none');
assert.notEqual(await active.locator('#outside-row').evaluate(node => getComputedStyle(node).display), 'none');
await active.evaluate(() => {
    const paragraph = document.createElement('p'); paragraph.textContent = 'Codex 24B';
    document.querySelector('#insert-row').append(paragraph);
});
await active.waitForFunction(() => getComputedStyle(document.querySelector('#insert-row')).display === 'none');
await active.evaluate(() => {
    document.querySelector('#qwen-row p').firstChild.data = 'Different model';
    document.querySelector('#insert-row p').textContent = 'Also allowed';
});
await active.waitForFunction(() => getComputedStyle(document.querySelector('#qwen-row')).display === 'grid' && getComputedStyle(document.querySelector('#insert-row')).display === 'flex');
assert.equal(await active.locator('#qwen-row').evaluate(node => node.style.getPropertyPriority('display')), 'important');
await active.evaluate(async () => {
    await fetch('https://prod.nd-api.com/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fixture-local-value' }, body: JSON.stringify({ conversation_id: 'conversation-fixture', message: 'Hello', inference_settings: { max_new_tokens: 200 } }) });
});
assert.equal(apiRequests.at(-1).inference_settings.max_new_tokens, 420);
assert.equal(apiRequests.at(-1).message, 'Hello\n\n/cmd fixture-command');
const disabled = await context.newPage();
disabled.on('pageerror', error => errors.push(error.message));
await disabled.goto('https://spicychat.ai/chat/bot-fixture/conversation-fixture');
await disabled.evaluate(() => {
    window.__gm.set('spchat-tweaks:settings:v1', { active: true, modules: { 'hide-models': false }, endpoints: {} });
    const row = document.createElement('div'); row.id = 'disabled-hider-row'; row.className = 'cursor-pointer'; row.innerHTML = '<p>Codex 24B</p>';
    document.body.append(row);
});
await disabled.addScriptTag({ content: bundle });
await disabled.waitForFunction(() => document.querySelector('#tm-sc-emoji-trigger-wrap'));
assert.notEqual(await disabled.locator('#disabled-hider-row').evaluate(node => getComputedStyle(node).display), 'none');
// Exercise the actual document-start timing, before the page has a body.
const earlyContext = await browser.newContext();
await earlyContext.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div style="display:flex"><div class="w-full flex"><textarea placeholder="Message..."></textarea></div></div><button aria-label="Plus-button">+</button><div data-testid="Dropdown-Panel"><div class="flex flex-col"><div id="early-qwen-row" class="cursor-pointer px-[18px] py-[10px]"><div class="flex flex-col"><div class="flex"><p>Qwen3 235B 2507</p></div><p>Invented model description</p></div></div><div id="early-allowed-row" class="cursor-pointer px-[18px] py-[10px]"><p>Qwen Plus Character</p></div></div></div></body></html>' }));
const earlySetup = () => {
    const docAdd = document.addEventListener.bind(document);
    const winAdd = window.addEventListener.bind(window);
    document.addEventListener = (type, ...args) => { if (!['DOMContentLoaded', 'readystatechange'].includes(type)) docAdd(type, ...args); };
    window.addEventListener = (type, ...args) => { if (!['load', 'pageshow'].includes(type)) winAdd(type, ...args); };
    const db = new Map([['spchat-tweaks:settings:v1', { active: true, modules: { summary: false, tts: false }, endpoints: {} }]]);
    window.unsafeWindow = window;
    window.GM_getValue = (key, fallback) => db.has(key) ? structuredClone(db.get(key)) : fallback;
    window.GM_setValue = (key, value) => db.set(key, structuredClone(value));
    window.GM_listValues = () => [...db.keys()]; window.GM_deleteValue = key => db.delete(key);
    window.GM_registerMenuCommand = () => {};
    window.GM_addStyle = css => { const style = document.createElement('style'); style.textContent = css; document.documentElement.append(style); return style; };
    window.GM_xmlhttpRequest = () => { throw new Error('Unexpected handler request'); };
};
await earlyContext.addInitScript({ content: `(${earlySetup})();\n${bundle}` });
const early = await earlyContext.newPage();
early.on('pageerror', error => errors.push(error.message));
await early.goto('https://spicychat.ai/chat/bot-fixture/conversation-fixture');
for (const selector of ['#spchat-tools-settings', '.tm-sc-emoji-trigger', '.tm-sc-suggest-reply-shortcut', '.tm-sc-open-saved-texts', '.tm-sc-save-current-text']) {
    await early.locator(selector).waitFor({ state: selector === '#spchat-tools-settings' ? 'attached' : 'visible' });
    assert.equal(await early.locator(selector).count(), 1);
}
await early.waitForFunction(() => getComputedStyle(document.querySelector('#early-qwen-row')).display === 'none');
assert.notEqual(await early.locator('#early-allowed-row').evaluate(node => getComputedStyle(node).display), 'none');
await earlyContext.close();
assert.equal(errors.length, 0, errors.join('\n'));
await active.screenshot({ path: root + 'test-results/modules.png' });
console.log(JSON.stringify({ result: 'PASS', scenarios: ['fresh-install-ui', 'activation-confirmation', 'zip-picker-preview-import', 'all-modules-start', 'combined-fetch-chain', 'per-chat-generation-rewrite', 'hidden-models-initial-and-dynamic', 'reused-model-row-restored', 'model-hiding-toggle', 'document-start-before-body-with-missing-ready-events'], errors }));
} finally { await browser.close(); }
