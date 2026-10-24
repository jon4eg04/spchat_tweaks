import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, SETTINGS_KEY, MIGRATION_KEY } from '../src/core/settings.js';
import { metadata, decodeStorageValue, planLegacyImport, applyImport, planSuiteImport, exportSuite } from '../src/core/migration.js';
import { readZip } from '../src/core/zip.js';

import { catalog, memory, makeLegacy, zip } from './fixtures.mjs';

test('fresh install stays inactive, with no configured addresses or tokens', () => {
    const store = createStore(catalog, memory());
    assert.equal(store.settings.active, false);
    assert.equal(Object.keys(store.settings.modules).length, 11);
    assert.deepEqual(store.settings.endpoints.summary, { url: '', token: '' });
    assert.throws(() => store.getEndpoint('summary'), /Сначала укажи/);
});

test('parses real Tampermonkey typed storage values, including Cyrillic and booleans', () => {
    assert.deepEqual(decodeStorageValue('o{"имя":"Привет","list":[1,2]}'), { имя: 'Привет', list: [1, 2] });
    assert.equal(decodeStorageValue('bfalse'), false);
    assert.equal(decodeStorageValue('n12'), 12);
    assert.equal(decodeStorageValue('shello'), 'hello');
    assert.deepEqual(decodeStorageValue({ list: [] }), { list: [] });
    assert.throws(() => decodeStorageValue('unknown-format'));
});

test('ZIP import combines all 11 modules, typed GM data, page settings, enabled state, and local credentials', async () => {
    const files = await readZip(zip(makeLegacy()));
    const key = 'tm-sc-per-chat-persistent-command-v1';
    const local = memory({ [key]: JSON.stringify({ fixture: 'Keep this command' }), 'unrelated-site-key': 'must stay local' });
    const plan = planLegacyImport(files, catalog, local);
    assert.equal(plan.rows.length, 11);
    assert.equal(plan.modules.bookmarks, false);
    assert.deepEqual(plan.endpoints.summary, { url: 'https://example.test/summary', token: 'fixture-value-summary' });
    assert.equal(Object.keys(plan.values).length, 5);
    assert.equal(plan.local[key], local.getItem(key));
    assert.equal(Object.hasOwn(plan.values, 'unrelated-account-data'), false);
    assert.equal(Object.hasOwn(plan.local, 'unrelated-site-key'), false);
    const gm = memory(); const store = createStore(catalog, gm);
    const result = applyImport(plan, store, local);
    assert.equal(result.modules, 11);
    assert.equal(store.settings.active, false);
    assert.equal(store.settings.modules.bookmarks, false);
    assert.equal(store.getEndpoint('tts').url, 'https://example.test/tts');
    assert.deepEqual(gm.get('tm-sc-saved-texts-v1:bot:fixture'), [{ label: 'saved-texts', value: 42 }]);
    assert.equal(gm.get(MIGRATION_KEY).modules.length, 11);
    assert.equal(local.getItem(key), JSON.stringify({ fixture: 'Keep this command' }));
});

test('stored ZIP entries and Unicode filenames work; irrelevant files are ignored', async () => {
    const files = new Map([['Папка/Закладки.user.js', '// ==UserScript=='], ['private.txt', 'not imported']]);
    const result = await readZip(zip(files, 0));
    assert.equal(result.size, 1);
    assert.equal(result.get('Папка/Закладки.user.js'), '// ==UserScript==');
});

test('corrupt, truncated, encrypted, and duplicate ZIP entries are rejected', async () => {
    const fixture = zip(new Map([['a.user.js', 'hello']]), 0);
    const corrupt = Buffer.from(fixture); corrupt[30 + 'a.user.js'.length] ^= 1;
    await assert.rejects(readZip(corrupt), /целостности/);
    await assert.rejects(readZip(fixture.subarray(0, -5)), /ZIP/);
    const encrypted = Buffer.from(fixture); encrypted.writeUInt16LE(1, 6); encrypted.writeUInt16LE(1, 39 + 5 + 8);
    await assert.rejects(readZip(encrypted));
    const duplicate = zip(new Map([['a.user.js', 'first'], ['b.user.js', 'second']]));
    await assert.rejects(readZip(Buffer.from(duplicate.toString('latin1').replaceAll('b.user.js', 'a.user.js'), 'latin1')), /повторяющиеся/);
});

test('incorrect archive formats and duplicate legacy scripts never modify data', () => {
    const local = memory();
    assert.throws(() => planLegacyImport(new Map(), catalog, local), /не найдены/);
    const files = makeLegacy(); files.set('duplicate.user.js', files.get('emoji.user.js'));
    assert.throws(() => planLegacyImport(files, catalog, local), /несколько версий/);
    assert.throws(() => planSuiteImport({ scripts: [] }, catalog), /выбери ZIP/);
});

test('does not overwrite newer suite data or a configured handler on a repeated import', () => {
    const key = 'tm-sc-message-bookmarks-v1:conversation:fixture';
    const gm = memory({ [key]: [{ text: 'newer' }] }); const local = memory();
    const store = createStore(catalog, gm);
    const settings = store.settings; settings.endpoints.summary = { url: 'https://example.test/new', token: 'new-value' };
    store.save(settings);
    const result = applyImport(planLegacyImport(makeLegacy(), catalog, local), store, local);
    assert.equal(result.skipped, 1);
    assert.deepEqual(gm.get(key), [{ text: 'newer' }]);
    assert.equal(store.getEndpoint('summary').token, 'new-value');
});

test('failed import rolls back GM values, local data, settings, and import status', () => {
    const gm = memory(); const local = memory(); const store = createStore(catalog, gm);
    const plan = planLegacyImport(makeLegacy(), catalog, local);
    plan.local['tm-spicychat-emoji-picker-state-v1'] = '{}';
    plan.endpoints.summary.url = 'http://example.test/not-https';
    assert.throws(() => applyImport(plan, store, local), /HTTPS/);
    assert.equal(gm.list().length, 0);
    assert.equal(local.length, 0);
    assert.equal(store.settings.active, false);
});

test('storage write failure is rolled back, including partial writes', () => {
    const gm = memory(); const local = memory(); const store = createStore(catalog, gm);
    const original = gm.set; let writes = 0;
    gm.set = (key, value) => { if (++writes === 2) throw new Error('quota exceeded'); return original(key, value); };
    assert.throws(() => applyImport(planLegacyImport(makeLegacy(), catalog, local), store, local), /quota/);
    assert.equal(gm.list().length, 0);
});

test('local-storage fallback, settings reload, and full suite export/import round trip preserve data', () => {
    const local = memory({ 'tm-sc-saved-texts-v1:bot:local': JSON.stringify([{ text: 'local fallback' }]) });
    const gm = memory(); const store = createStore(catalog, gm);
    applyImport(planLegacyImport(makeLegacy(), catalog, local), store, local);
    const config = store.settings; config.active = true; config.modules.emoji = false; store.save(config);
    assert.equal(createStore(catalog, gm).settings.modules.emoji, false);
    assert.deepEqual(gm.get('tm-sc-saved-texts-v1:bot:local'), [{ text: 'local fallback' }]);
    const exported = JSON.parse(JSON.stringify(exportSuite(store, catalog, local)));
    assert.equal(Object.hasOwn(exported.values, SETTINGS_KEY), false);
    const target = createStore(catalog, memory()); const otherLocal = memory();
    applyImport(planSuiteImport(exported, catalog), target, otherLocal);
    assert.equal(target.settings.active, false);
    assert.equal(target.settings.modules.emoji, false);
    assert.equal(target.getEndpoint('tts').token, 'fixture-value-tts');
    assert.deepEqual(JSON.parse(JSON.stringify(exportSuite(target, catalog, otherLocal).values)), exported.values);
});

test('only exact legacy identities and allowlisted data keys are imported', () => {
    const files = makeLegacy();
    files.set('evil.user.js', '// ==UserScript==\n// @name SpicyChat — Emoji Picker\n// @namespace https://evil.test\n// ==/UserScript==');
    const storage = JSON.parse(files.get('bookmarks.storage.json'));
    storage.data.__proto__ = 'o{"polluted":true}';
    storage.data['spchat-tweaks:settings:v1'] = 'o{"active":true}';
    files.set('bookmarks.storage.json', JSON.stringify(storage));
    const plan = planLegacyImport(files, catalog, memory());
    assert.equal(plan.rows.length, 11);
    assert.equal(Object.hasOwn(plan.values, 'spchat-tweaks:settings:v1'), false);
    assert.equal({}.polluted, undefined);
    assert.equal(metadata('not a userscript'), null);
});
