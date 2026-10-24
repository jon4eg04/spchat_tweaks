import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../src/core/dom.js', import.meta.url), 'utf8')).replace(/^export /gm, '');
function fixture({ ready = false } = {}) {
    const listeners = new Map(), timers = new Map(); let next = 0, calls = 0;
    const target = name => ({
        addEventListener: (event, fn) => listeners.set(name + ':' + event, fn),
        removeEventListener: event => listeners.delete(name + ':' + event),
    });
    const document = { ...target('document'), body: ready ? {} : null, readyState: ready ? 'complete' : 'loading' };
    const window = { ...target('window'), setTimeout: fn => { timers.set(++next, fn); return next; }, clearTimeout: id => timers.delete(id) };
    vm.runInNewContext(source + '\nonDomReady(() => record());', { document, window, record: () => calls++ });
    return { document, listeners, timers, calls: () => calls, tick() { const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); } };
}
test('missing DOMContentLoaded cannot disable the whole idle phase', () => {
    const f = fixture();
    f.tick(); assert.equal(f.calls(), 0); assert.equal(f.timers.size, 1);
    f.document.body = {}; f.document.readyState = 'complete';
    f.tick();
    assert.equal(f.calls(), 1); assert.equal(f.timers.size, 0); assert.equal(f.listeners.size, 0);
});
test('already-ready DOM starts once without leaving a retry timer', () => {
    const f = fixture({ ready: true });
    assert.equal(f.calls(), 1); assert.equal(f.timers.size, 0); assert.equal(f.listeners.size, 0);
});
