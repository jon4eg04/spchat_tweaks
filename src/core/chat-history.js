export const CHAT_HISTORY_PAGE_SIZE = 50;

export function normalizeChatMessageId(value) {
    return typeof value === 'string' ? value.trim().replace(/^message-/, '') : '';
}

// Capture the site's session at document-start for the two history consumers.
export function createChatHistoryApi(pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window) {
    const headerNames = new Set([
        'authorization', 'x-guest-userid', 'x-country', 'x-app-id', 'x-app-version',
        'x-platform', 'x-platform-os', 'accept', 'content-type',
    ]);
    const headersByOrigin = new Map();
    const xhrOrigins = new WeakMap();
    const originalFetch = pageWindow.fetch;
    let sessionOrigin = '';

    function getApiOrigin(input) {
        try {
            const url = new URL(input?.url ?? input, pageWindow.location.href);
            if (url.protocol === 'https:' && url.hostname !== 'cdn.nd-api.com'
                && (url.hostname === 'nd-api.com' || url.hostname.endsWith('.nd-api.com'))) return url.origin;
        } catch { /* Requests outside the history API are ignored. */ }
        return '';
    }

    function rememberHeader(origin, rawName, value) {
        const name = String(rawName).toLowerCase();
        if (!headerNames.has(name) || value == null) return;
        if (!headersByOrigin.has(origin)) headersByOrigin.set(origin, new Map());
        headersByOrigin.get(origin).set(name, String(value));
        if (name === 'authorization' && value) sessionOrigin = origin;
    }

    function rememberHeaders(origin, source) {
        if (!source) return;
        try {
            if (!Array.isArray(source) && typeof source.forEach === 'function') {
                source.forEach((value, name) => rememberHeader(origin, name, value));
            } else {
                for (const [name, value] of Array.isArray(source) ? source : Object.entries(source)) {
                    rememberHeader(origin, name, value);
                }
            }
        } catch { /* A nonstandard header value must not stop the site's request. */ }
    }

    if (typeof originalFetch === 'function') {
        pageWindow.fetch = function (input, options) {
            const origin = getApiOrigin(input);
            if (origin) rememberHeaders(origin, options?.headers ?? input?.headers);
            return Reflect.apply(originalFetch, this, arguments);
        };
    }

    try {
        const prototype = pageWindow.XMLHttpRequest?.prototype;
        if (prototype) {
            const originalOpen = prototype.open;
            const originalSetRequestHeader = prototype.setRequestHeader;
            prototype.open = function (method, url) {
                xhrOrigins.set(this, getApiOrigin(url));
                return Reflect.apply(originalOpen, this, arguments);
            };
            prototype.setRequestHeader = function (name, value) {
                const origin = xhrOrigins.get(this);
                if (origin) rememberHeader(origin, name, value);
                return Reflect.apply(originalSetRequestHeader, this, arguments);
            };
        }
    } catch (error) {
        console.warn('[SpicyChat Tools] Не удалось подключить историю к XMLHttpRequest.', error);
    }

    function hasAccess() {
        return typeof originalFetch === 'function' && Boolean(headersByOrigin.get(sessionOrigin)?.get('authorization'));
    }

    async function waitForAccess(checkCurrent) {
        const deadline = Date.now() + 10000;
        while (!hasAccess() && Date.now() < deadline) {
            checkCurrent();
            await new Promise(resolve => pageWindow.setTimeout(resolve, 160));
        }
        checkCurrent();
        if (!hasAccess()) throw new Error('Не удалось поймать сессию SpicyChat. Обнови страницу и попробуй ещё раз.');
    }

    async function fetchPage({ characterId, conversationId }, lastId, signal) {
        if (!hasAccess()) throw new Error('Сессия API SpicyChat ещё не обнаружена.');
        const query = new URLSearchParams({ limit: String(CHAT_HISTORY_PAGE_SIZE) });
        if (lastId) query.set('last_id', lastId);
        const path = `/characters/${encodeURIComponent(characterId)}/messages/${encodeURIComponent(conversationId)}?${query}`;
        const headers = Object.fromEntries(headersByOrigin.get(sessionOrigin));
        headers.accept = 'application/json';
        const options = {
            method: 'GET', headers, mode: 'cors', credentials: 'omit',
            __tmScConsumesJsonResponse: true,
        };
        if (signal) options.signal = AbortSignal.any([signal, AbortSignal.timeout(30000)]);
        const response = await Reflect.apply(originalFetch, pageWindow, [new URL(path, sessionOrigin).href, options]);
        if (!response?.ok) throw new Error(`SpicyChat вернул HTTP ${response?.status || 0}.`);
        return await response.json();
    }

    return { fetchPage, waitForAccess };
}

function exportMessageTime(message) {
    const value = message.createdAt ?? message.created_at;
    if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
    const number = Number(value);
    const time = Number.isFinite(number) ? (number < 100000000000 ? number * 1000 : number) : Date.parse(value);
    return Number.isFinite(time) && time > 0 ? time : null;
}

export async function collectChatExport(api, context, { signal, onProgress }) {
    await api.waitForAccess(() => signal.throwIfAborted());
    const messages = new Map();
    const cursors = new Set();
    let lastId = '';
    let title = null;

    while (true) {
        signal.throwIfAborted();
        const payload = await api.fetchPage(context, lastId, signal);
        signal.throwIfAborted();
        const batch = payload?.messages;
        if (!Array.isArray(batch) || (payload.conversation_id && payload.conversation_id !== context.conversationId)) {
            throw new Error('SpicyChat вернул неожиданный ответ при загрузке истории.');
        }
        if (title === null && typeof payload.label === 'string') title = payload.label;

        const previousCount = messages.size;
        for (const message of batch) {
            const id = normalizeChatMessageId(message?.id);
            if (!id) throw new Error('SpicyChat вернул сообщение без идентификатора.');
            if (!messages.has(id)) messages.set(id, message);
        }
        onProgress(messages.size);

        // The reported count can exceed the available history. The API ends
        // pagination with a short page (empty when the last page was full).
        if (batch.length < CHAT_HISTORY_PAGE_SIZE) break;
        lastId = normalizeChatMessageId(batch.at(-1)?.id);
        if (!lastId || cursors.has(lastId) || messages.size === previousCount) {
            throw new Error('SpicyChat не вернул следующую страницу истории. Попробуй скачать чат ещё раз.');
        }
        cursors.add(lastId);
        await new Promise(resolve => setTimeout(resolve, 55));
    }

    // The API pages run newest-first. Preserve that order reversed for equal
    // timestamps and keep undated records in their API positions.
    const oldestFirst = [...messages.values()].reverse().map(message => ({ message, time: exportMessageTime(message) }));
    const dated = oldestFirst.filter(entry => entry.time !== null).sort((left, right) => left.time - right.time);
    let dateIndex = 0;
    return {
        schemaVersion: 1,
        characterId: context.characterId,
        conversationId: context.conversationId,
        title,
        messages: oldestFirst.map(entry => entry.time === null ? entry.message : dated[dateIndex++].message),
    };
}
