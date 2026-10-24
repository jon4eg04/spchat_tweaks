import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { makeLegacy, zip } from './fixtures.mjs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(root + 'test-results', { recursive: true });
await writeFile(root + 'test-results/migration-fixture.zip', zip(makeLegacy()));
const bundle = await readFile(root + 'dist/spicychat-tools.user.js', 'utf8');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
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
assert.equal(await page.getByRole('checkbox').count(), 12);
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
await page.getByText('Найдено модулей: 11 из 11.', { exact: false }).waitFor();
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
});
await active.addScriptTag({ content: bundle });
await active.waitForFunction(() => document.querySelector('#tm-sc-emoji-trigger-wrap'));
await active.evaluate(async () => {
    await fetch('https://prod.nd-api.com/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fixture-local-value' }, body: JSON.stringify({ conversation_id: 'conversation-fixture', message: 'Hello', inference_settings: { max_new_tokens: 200 } }) });
});
assert.equal(apiRequests.at(-1).inference_settings.max_new_tokens, 420);
assert.equal(apiRequests.at(-1).message, 'Hello\n\n/cmd fixture-command');
assert.equal(errors.length, 0, errors.join('\n'));
await active.screenshot({ path: root + 'test-results/modules.png' });
console.log(JSON.stringify({ result: 'PASS', scenarios: ['fresh-install-ui', 'activation-confirmation', 'zip-picker-preview-import', 'all-11-modules-start', 'combined-fetch-chain', 'per-chat-generation-rewrite'], errors }));
} finally { await browser.close(); }
