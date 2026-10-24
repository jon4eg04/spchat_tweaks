import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createNativeModelAdapter } from '../src/core/native-models.js';

const expected = { id: 'deepseek-v4pro', label: 'Deepseek V4 Pro' };
const mimo = { id: 'mimo-v26-pro', label: 'MiMo V2.6 Pro' };
function rowFixture({ activeModel = 'glm51', ...overrides } = {}) {
    const calls = [];
    const onClick = () => {};
    const props = { model: { id: expected.id, name: expected.label }, activeModel, clickHandler: value => calls.push(value), ...overrides };
    const owner = { memoizedProps: props, child: { memoizedProps: { onClick } } };
    const row = { '__reactProps$random': { onClick }, '__reactFiber$random': { return: owner } };
    return { row, calls, owner, onClick, props };
}
function adapter() {
    const PageObject = vm.runInNewContext('Object');
    globalThis.unsafeWindow = { Object: PageObject };
    return { api: createNativeModelAdapter(), PageObject };
}

test('native quick selection invokes the observed id/name callback with a page-realm payload', () => {
    const { api, PageObject } = adapter();
    const { row, calls } = rowFixture();
    const binding = api.read(row, expected);
    assert.equal(binding.activeModel, 'glm51');
    binding.select(mimo);
    assert.equal(calls.length, 1);
    assert.equal(Object.getPrototypeOf(calls[0]), PageObject.prototype);
    assert.deepEqual({ ...calls[0] }, { id: 'mimo-v26-pro', name: 'MiMo V2.6 Pro' });
});

test('live DOM onClick identifies the committed alternate instead of stale selected state', () => {
    const { api } = adapter();
    const f = rowFixture();
    f.owner.alternate = { memoizedProps: { ...f.props, activeModel: mimo.id }, child: { memoizedProps: { onClick: () => {} } } };
    f.row.__reactProps$random.onClick = f.owner.alternate.child.memoizedProps.onClick;
    assert.equal(api.read(f.row, expected).activeModel, mimo.id);
});

test('Firefox wrapper is unwrapped before enumerating React expandos', () => {
    const { api } = adapter();
    const f = rowFixture();
    const wrapper = new Proxy({ wrappedJSObject: f.row }, { ownKeys() { throw Error('Xray hides page expandos'); } });
    assert.equal(api.read(wrapper, expected).activeModel, 'glm51');
});

test('locked, disabled, action and unrelated rows cannot supply a selection callback', () => {
    const { api } = adapter();
    for (const props of [
        { isLocked: true }, { action() {} }, { model: { id: expected.id, name: expected.label, isDisabled: true } },
        { model: { id: 'unrelated', name: expected.label } }, { clickHandler: null },
    ]) assert.equal(api.read(rowFixture(props).row, expected), null);
    assert.equal(api.read({}, expected), null);
});
