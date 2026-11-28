import test from 'node:test';
import assert from 'node:assert/strict';
import { collectChatExport, createChatHistoryApi } from '../src/core/chat-history.js';

const context = { characterId: 'bot', conversationId: 'chat' };

function startExport(fetchPage, onProgress = () => {}, signal = new AbortController().signal) {
    return collectChatExport({ async waitForAccess(check) { check(); }, fetchPage }, context, { signal, onProgress });
}

test('export follows a short API page when more records are expected and orders mixed timestamp formats', async () => {
    const oldest = { id: 'oldest', createdAt: 1700000000 };
    const newest = { id: 'newest', created_at: '2024-11-28T00:00:00Z' };
    const undated = { id: 'undated' };
    const middle = { id: 'middle', createdAt: 1710000000000 };
    const cursors = [];
    const progress = [];
    const result = await startExport(async (_context, cursor) => {
        cursors.push(cursor);
        if (!cursor) return { num_messages: 4, messages: [middle, undated, newest] };
        return { messages: [newest, oldest] };
    }, (...args) => progress.push(args));
    assert.deepEqual(cursors, ['', 'newest']);
    assert.deepEqual(progress, [[3, 4], [4, 4]]);
    assert.deepEqual(result.messages, [oldest, middle, undated, newest]);
});

test('export rejects stalled pagination and a mismatched conversation instead of returning a partial file', async () => {
    await assert.rejects(startExport(async () => ({ num_messages: 2, messages: [{ id: 'same' }] })), /не вернул следующую страницу/);
    await assert.rejects(startExport(async () => ({ conversation_id: 'other', messages: [] })), /неожиданный ответ/);
});

test('export does not use an in-flight page after cancellation', async () => {
    const controller = new AbortController();
    await assert.rejects(startExport(async () => {
        controller.abort();
        return { messages: [{ id: 'too-late' }] };
    }, () => assert.fail('cancelled export reported progress'), controller.signal), { name: 'AbortError' });
});

test('history API captures the native XHR session and scopes headers to their HTTPS origin', async () => {
    const requests = [];
    class Xhr { open() {} setRequestHeader() {} }
    const page = {
        location: { href: 'https://spicychat.ai/chat/bot/chat' }, XMLHttpRequest: Xhr,
        async fetch(url, options) {
            requests.push({ url, options });
            return { ok: true, async json() { return { messages: [] }; } };
        },
    };
    const api = createChatHistoryApi(page);
    const request = new Xhr();
    request.open('GET', 'https://prod.nd-api.com/characters/bot/messages/chat');
    request.setRequestHeader('Authorization', 'Bearer synthetic');
    request.setRequestHeader('X-App-Id', 'fixture');
    request.setRequestHeader('X-Other', 'page-only');
    await page.fetch('https://cdn.nd-api.com/image', { headers: { Authorization: 'Bearer wrong-origin' } });
    await page.fetch('http://nd-api.com/page', { headers: { Authorization: 'Bearer unsafe-origin' } });
    await api.waitForAccess(() => {});
    await api.fetchPage(context, 'cursor');
    const last = requests.at(-1);
    assert.equal(last.url, 'https://prod.nd-api.com/characters/bot/messages/chat?limit=50&last_id=cursor');
    assert.deepEqual(last.options.headers, { authorization: 'Bearer synthetic', 'x-app-id': 'fixture', accept: 'application/json' });
});
