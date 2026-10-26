import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuickCommands, QUICK_COMMANDS_KEY, MANUAL_COMMANDS_KEY, validateQuickCommands } from '../src/core/quick-commands.js';
import { createStore } from '../src/core/settings.js';
import { exportSuite, planSuiteImport, applyImport } from '../src/core/migration.js';
import { memory, catalog } from './fixtures.mjs';

function fixture() {
    const gm = memory(), local = memory();
    return { gm, local, api: createQuickCommands(gm) };
}

test('library CRUD keeps stable selection IDs; editing applies immediately and deleting clears all chats', () => {
    const { api, gm, local } = fixture();
    const first = api.upsert({ name: ' First ', text: ' /cmd First instruction ' });
    const second = api.upsert({ name: 'Second', text: 'Second instruction' });
    const inactive = api.upsert({ name: 'Inactive', text: 'Do not send this' });
    api.saveChat('one', [second, first, second], 'Manual instruction', local);
    api.saveChat('two', [first], '', local);
    assert.deepEqual(api.active('one').map(item => item.id), [first, second]);
    assert.deepEqual(api.active('one').map(item => item.text), ['First instruction', 'Second instruction']);
    api.upsert({ id: first, name: 'Renamed', text: 'Edited instruction' });
    assert.equal(api.active('two')[0].text, 'Edited instruction');
    assert.equal(api.active('one')[0].name, 'Renamed');
    api.remove(first);
    assert.deepEqual(api.selectedIds('one'), [second]);
    assert.deepEqual(api.active('two'), []);
    assert.equal(gm.get(QUICK_COMMANDS_KEY).selections.two, undefined);
    assert.equal(JSON.parse(local.getItem(MANUAL_COMMANDS_KEY)).one, 'Manual instruction');
    assert.equal(api.list().some(item => item.id === inactive), true);
});

test('empty manual text and no checked commands can be saved to disable everything for one chat', () => {
    const { api, local } = fixture();
    const id = api.upsert({ name: 'Command', text: 'Text' });
    api.saveChat('one', [id], 'Manual', local);
    api.saveChat('two', [id], 'Other chat', local);
    api.saveChat('one', [], '', local);
    assert.deepEqual(api.active('one'), []);
    assert.equal(JSON.parse(local.getItem(MANUAL_COMMANDS_KEY)).one, undefined);
    assert.equal(JSON.parse(local.getItem(MANUAL_COMMANDS_KEY)).two, 'Other chat');
    assert.equal(api.active('two').length, 1);
});

test('a failed or partially written GM save rolls back both manual text and checkbox selections', () => {
    const { api, gm, local } = fixture();
    const id = api.upsert({ name: 'Command', text: 'Text' });
    api.saveChat('one', [], 'Before', local);
    const beforeGm = gm.get(QUICK_COMMANDS_KEY), beforeLocal = local.getItem(MANUAL_COMMANDS_KEY);
    const set = gm.set; let fail = true;
    gm.set = (key, value) => { set(key, value); if (fail) { fail = false; throw Error('GM quota'); } };
    assert.throws(() => api.saveChat('one', [id], 'After', local), /GM quota/);
    assert.deepEqual(gm.get(QUICK_COMMANDS_KEY), beforeGm);
    assert.equal(local.getItem(MANUAL_COMMANDS_KEY), beforeLocal);
});

test('a partial local-storage failure cannot activate new choices or erase earlier manual text', () => {
    const { api, gm, local } = fixture();
    const id = api.upsert({ name: 'Command', text: 'Text' });
    api.saveChat('one', [], 'Before', local);
    const before = gm.get(QUICK_COMMANDS_KEY);
    const set = local.setItem; let fail = true;
    local.setItem = (key, value) => { set(key, value); if (fail) { fail = false; throw Error('local quota'); } };
    assert.throws(() => api.saveChat('one', [id], 'After', local), /local quota/);
    assert.deepEqual(gm.get(QUICK_COMMANDS_KEY), before);
    assert.deepEqual(JSON.parse(local.getItem(MANUAL_COMMANDS_KEY)), { one: 'Before' });
});

test('malformed library and imports are rejected without overwriting stored data', () => {
    const { api, gm } = fixture();
    assert.throws(() => api.upsert({ name: ' ', text: 'Text' }), /название/);
    assert.throws(() => api.upsert({ name: 'Name', text: '/cmd ' }), /текст/);
    const malformed = { schema: 1, commands: [{ id: 'same', name: 'Name', text: 'Text' }, { id: 'same', name: 'Name', text: 'Text' }], selections: {} };
    gm.set(QUICK_COMMANDS_KEY, malformed);
    assert.throws(() => api.remove('same'), /Некорректная/);
    assert.deepEqual(gm.get(QUICK_COMMANDS_KEY), malformed);
    const backup = { format: 'spchat-tweaks-backup', schema: 1, values: { [QUICK_COMMANDS_KEY]: malformed }, local: {}, settings: {} };
    assert.throws(() => planSuiteImport(backup, catalog), /Некорректная/);
    assert.throws(() => validateQuickCommands({ schema: 1, commands: [], selections: { one: 'wrong' } }), /выбор/);
});

test('backup round trip includes library, selected IDs and legacy manual text; default reimport preserves newer library', () => {
    const { api, gm, local } = fixture();
    const id = api.upsert({ name: '<b>Literal title</b>', text: 'Text' });
    api.saveChat('one', [id], 'Manual', local);
    // A same-named site key is not a Tampermonkey command library.
    local.setItem(QUICK_COMMANDS_KEY, JSON.stringify({ unrelated: true }));
    const backup = exportSuite(createStore(catalog, gm), catalog, local);
    assert.equal(Object.hasOwn(backup.values, QUICK_COMMANDS_KEY), true);
    assert.equal(Object.hasOwn(backup.local, QUICK_COMMANDS_KEY), false);
    const targetGm = memory(), targetLocal = memory(), target = createStore(catalog, targetGm);
    applyImport(planSuiteImport(JSON.parse(JSON.stringify(backup)), catalog), target, targetLocal);
    const restored = createQuickCommands(targetGm);
    assert.equal(restored.active('one')[0].id, id);
    assert.equal(JSON.parse(targetLocal.getItem(MANUAL_COMMANDS_KEY)).one, 'Manual');
    restored.upsert({ id, name: 'New name', text: 'New text' });
    applyImport(planSuiteImport(backup, catalog), target, targetLocal);
    assert.equal(restored.active('one')[0].text, 'New text');
});

test('immediate checkbox writes leave manual text and other chats unchanged', () => {
    const { api, gm, local } = fixture();
    const id = api.upsert({ name: 'Command', text: 'Text' });
    api.saveChat('one', [], 'Manual', local);
    api.saveChat('two', [id], 'Other manual', local);
    const manualBefore = local.getItem(MANUAL_COMMANDS_KEY);
    api.setSelectedIds('one', [id]);
    assert.deepEqual(api.snapshot('one').selectedIds, [id]);
    assert.equal(api.active('two').length, 1);
    assert.equal(local.getItem(MANUAL_COMMANDS_KEY), manualBefore);
    api.setSelectedIds('one', []);
    assert.deepEqual(api.selectedIds('one'), []);
    assert.deepEqual(api.selectedIds('two'), [id]);
    const before = gm.get(QUICK_COMMANDS_KEY);
    const set = gm.set;
    gm.set = () => { throw Error('Quota'); };
    assert.throws(() => api.setSelectedIds('one', [id]), /Quota/);
    gm.set = set;
    assert.deepEqual(gm.get(QUICK_COMMANDS_KEY), before);
});
