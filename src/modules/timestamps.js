// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
export default function init(runtime) {
    'use strict';

    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const INSTANCE_KEY = '__spicyChatMessageTimestampsV1';
    if (window[INSTANCE_KEY]) return;
    window[INSTANCE_KEY] = true;

    const MESSAGE_SELECTOR = 'div[id^="message-"]';
    const MESSAGE_DROPDOWN_SELECTOR = 'button[aria-label="message-dropdown" i]';
    const TIMESTAMP_CLASS = 'tm-sc-message-sent-at';
    const SESSION_DIVIDER_CLASS = 'tm-sc-message-session-divider';
    const STYLE_ID = 'tm-sc-message-sent-at-style';
    const XHR_URL_KEY = '__tmScVisibleTimestampRequestUrl';
    const STORAGE_PREFIX = 'tm-sc-message-timestamps-v1:conversation:';
    const SESSION_GAP_MS = 2 * 60 * 60 * 1000;
    const CACHE_WRITE_DELAY = 450;
    const INTERNAL_RESPONSE_CONSUMER_FLAG = '__tmScConsumesJsonResponse';
    const ROUTE_CHANGE_EVENT = 'tm-sc-route-change';

    const timestampByMessageId = new Map();
    const moscowDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });

    let ensureScheduled = false;
    let rootObserver = null;
    let retryTimer = null;
    let retryDelay = 250;
    let activeContext = null;
    let activeStorageKey = null;
    let contextLoadToken = 0;
    let cacheLoaded = false;
    let cacheDirty = false;
    let cacheWriteTimer = null;
    let cacheWriteQueue = Promise.resolve();

    function normalizeTimestamp(value) {
        if (value === null || value === undefined || value === '') return null;

        let timestamp = Number(value);
        if (!Number.isFinite(timestamp) && typeof value === 'string') {
            timestamp = Date.parse(value);
        }
        if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
        return timestamp < 100000000000 ? timestamp * 1000 : timestamp;
    }

    function installRouteChangeSignal() {
        const key = '__tmScRouteChangeSignalV1';
        if (pageWindow[key]) return;
        const dispatch = () => pageWindow.dispatchEvent(new pageWindow.Event(ROUTE_CHANGE_EVENT));
        for (const method of ['pushState', 'replaceState']) {
            const original = pageWindow.history?.[method];
            if (typeof original !== 'function') continue;
            pageWindow.history[method] = function (...args) {
                const result = Reflect.apply(original, this, args);
                dispatch();
                return result;
            };
        }
        pageWindow.addEventListener('popstate', dispatch);
        pageWindow.addEventListener('hashchange', dispatch);
        pageWindow[key] = true;
    }

    function getChatContext() {
        const parts = location.pathname.split('/').filter(Boolean);
        if (parts[0] !== 'chat' || !parts[1]) return null;

        const botId = parts[1];
        const conversationId = parts[2] || 'default';
        return {
            botId,
            conversationId,
            storageKey: `${STORAGE_PREFIX}${botId}:${conversationId}`,
        };
    }

    async function readValue(key, fallbackValue) {
        try {
            if (typeof GM_getValue === 'function') {
                const value = await Promise.resolve(GM_getValue(key, fallbackValue));
                return value === undefined ? fallbackValue : value;
            }
        } catch (error) {
            console.warn('[Message Timestamps] Не удалось прочитать кеш Tampermonkey.', error);
        }

        try {
            const raw = localStorage.getItem(key);
            return raw === null ? fallbackValue : JSON.parse(raw);
        } catch (_error) {
            return fallbackValue;
        }
    }

    async function writeValue(key, value) {
        if (typeof GM_setValue === 'function') {
            await Promise.resolve(GM_setValue(key, value));
            return;
        }
        localStorage.setItem(key, JSON.stringify(value));
    }

    function normalizeCache(value) {
        const source = value && typeof value === 'object' && !Array.isArray(value)
            ? (value.timestamps && typeof value.timestamps === 'object' ? value.timestamps : value)
            : {};
        const normalized = new Map();

        for (const [rawMessageId, rawTimestamp] of Object.entries(source)) {
            const messageId = toDomMessageId(rawMessageId);
            const timestamp = normalizeTimestamp(rawTimestamp);
            if (messageId && timestamp) normalized.set(messageId, timestamp);
        }

        return normalized;
    }

    function makeCacheSnapshot() {
        return {
            version: 1,
            updatedAt: Date.now(),
            timestamps: Object.fromEntries(timestampByMessageId),
        };
    }

    function queueCacheWrite(storageKey, snapshot) {
        if (!storageKey) return;

        const operation = cacheWriteQueue.then(() => writeValue(storageKey, snapshot));
        cacheWriteQueue = operation.catch((error) => {
            console.warn('[Message Timestamps] Не удалось сохранить кеш.', error);
        });
    }

    function flushTimestampCache() {
        if (cacheWriteTimer) {
            window.clearTimeout(cacheWriteTimer);
            cacheWriteTimer = null;
        }
        if (!activeStorageKey || !cacheLoaded || !cacheDirty) return;

        const storageKey = activeStorageKey;
        const snapshot = makeCacheSnapshot();
        cacheDirty = false;
        queueCacheWrite(storageKey, snapshot);
    }

    function scheduleCacheWrite() {
        cacheDirty = true;
        if (!activeStorageKey || !cacheLoaded) return;
        if (cacheWriteTimer) window.clearTimeout(cacheWriteTimer);
        cacheWriteTimer = window.setTimeout(flushTimestampCache, CACHE_WRITE_DELAY);
    }

    function removeInjectedTimelineUi() {
        for (const time of document.querySelectorAll(`.${TIMESTAMP_CLASS}`)) time.remove();
        for (const divider of document.querySelectorAll(`.${SESSION_DIVIDER_CLASS}`)) divider.remove();
    }

    function ensureContext() {
        const context = getChatContext();
        const nextStorageKey = context?.storageKey || null;
        if (nextStorageKey === activeStorageKey) return;

        flushTimestampCache();
        if (cacheWriteTimer) {
            window.clearTimeout(cacheWriteTimer);
            cacheWriteTimer = null;
        }

        activeContext = context;
        activeStorageKey = nextStorageKey;
        contextLoadToken += 1;
        const token = contextLoadToken;
        timestampByMessageId.clear();
        cacheLoaded = false;
        cacheDirty = false;
        removeInjectedTimelineUi();

        if (!nextStorageKey) {
            scheduleEnsure();
            return;
        }

        void readValue(nextStorageKey, { version: 1, timestamps: {} }).then((stored) => {
            if (token !== contextLoadToken || activeStorageKey !== nextStorageKey) return;

            const cached = normalizeCache(stored);
            for (const [messageId, timestamp] of cached) {
                if (!timestampByMessageId.has(messageId)) {
                    timestampByMessageId.set(messageId, timestamp);
                }
            }

            cacheLoaded = true;
            if (cacheDirty) scheduleCacheWrite();
            scheduleEnsure();
        }).catch((error) => {
            console.warn('[Message Timestamps] Не удалось загрузить кеш.', error);
            if (token !== contextLoadToken || activeStorageKey !== nextStorageKey) return;
            cacheLoaded = true;
            if (cacheDirty) scheduleCacheWrite();
            scheduleEnsure();
        });
    }

    function toDomMessageId(rawId) {
        if (typeof rawId !== 'string' || !rawId.trim()) return null;
        const id = rawId.trim();
        return id.startsWith('message-') ? id : `message-${id}`;
    }

    function readRequestUrl(input) {
        if (typeof input === 'string') return input;
        if (input && typeof input.url === 'string') return input.url;
        try {
            return String(input || '');
        } catch (_error) {
            return '';
        }
    }

    function isMessageApiUrl(rawUrl) {
        try {
            const url = new URL(rawUrl, location.href);
            const trustedHost = url.hostname === 'nd-api.com' || url.hostname.endsWith('.nd-api.com');
            return trustedHost && (
                /\/characters\/[^/]+\/messages\/[^/]+/i.test(url.pathname)
                || /\/conversations\/[^/]+\/messages(?:\/|$)/i.test(url.pathname)
            );
        } catch (_error) {
            return false;
        }
    }

    function getMoscowParts(timestamp) {
        const normalized = normalizeTimestamp(timestamp);
        if (!normalized) return null;

        try {
            return Object.fromEntries(
                moscowDateTimeFormatter.formatToParts(new Date(normalized))
                    .map((part) => [part.type, part.value]),
            );
        } catch (_error) {
            return null;
        }
    }

    function formatMoscowDateTime(timestamp) {
        const parts = getMoscowParts(timestamp);
        if (!parts) return '';
        return `${parts.day}.${parts.month}.${parts.year}, ${parts.hour}:${parts.minute}`;
    }

    function formatMoscowDate(timestamp) {
        const parts = getMoscowParts(timestamp);
        if (!parts) return '';
        return `${parts.day}.${parts.month}.${parts.year}`;
    }

    function getMoscowDateKey(timestamp) {
        const parts = getMoscowParts(timestamp);
        if (!parts) return '';
        return `${parts.year}-${parts.month}-${parts.day}`;
    }

    function formatElapsedTime(milliseconds) {
        const totalMinutes = Math.max(0, Math.round(milliseconds / 60000));
        const days = Math.floor(totalMinutes / 1440);
        const hours = Math.floor((totalMinutes % 1440) / 60);
        const minutes = totalMinutes % 60;

        if (days > 0) {
            return [
                `${days} д`,
                hours ? `${hours} ч` : '',
            ].filter(Boolean).join(' ');
        }

        return [
            hours ? `${hours} ч` : '',
            minutes ? `${minutes} мин` : '',
        ].filter(Boolean).join(' ') || 'меньше минуты';
    }

    function makeSessionDividerLabel(previousTimestamp, currentTimestamp) {
        const previous = normalizeTimestamp(previousTimestamp);
        const current = normalizeTimestamp(currentTimestamp);
        if (!previous || !current || current <= previous) return '';

        const gap = current - previous;
        const dateChanged = getMoscowDateKey(previous) !== getMoscowDateKey(current);
        const isLongGap = gap > SESSION_GAP_MS;
        if (!dateChanged && !isLongGap) return '';

        const dateLabel = dateChanged ? formatMoscowDate(current) : '';
        const elapsedLabel = isLongGap ? formatElapsedTime(gap) : '';

        if (dateLabel && elapsedLabel) return `${dateLabel} · прошло ${elapsedLabel}`;
        if (dateLabel) return dateLabel;
        if (elapsedLabel) return `Прошло ${elapsedLabel}`;
        return '';
    }

    function captureTimestamps(payload) {
        ensureContext();
        if (!activeStorageKey) return;

        const found = new Map();
        const visited = new WeakSet();

        const walk = (value, depth) => {
            if (!value || typeof value !== 'object' || depth > 10) return;
            if (visited.has(value)) return;
            visited.add(value);

            if (Array.isArray(value)) {
                for (const item of value) walk(item, depth + 1);
                return;
            }

            const messageId = toDomMessageId(value.id);
            const timestamp = normalizeTimestamp(value.createdAt);
            const conversationId = typeof value.conversation_id === 'string'
                ? value.conversation_id
                : null;
            const belongsToCurrentConversation = (
                !conversationId
                || !activeContext?.conversationId
                || conversationId === activeContext.conversationId
            );
            const looksLikeMessage = (
                typeof value.content === 'string'
                && (
                    value.role === 'bot'
                    || value.role === 'user'
                    || typeof value.conversation_id === 'string'
                    || typeof value.character_id === 'string'
                )
            );

            if (messageId && timestamp && looksLikeMessage && belongsToCurrentConversation) {
                found.set(messageId, timestamp);
            }
            for (const child of Object.values(value)) walk(child, depth + 1);
        };

        walk(payload, 0);
        if (!found.size) return;

        let changed = false;
        for (const [messageId, timestamp] of found) {
            if (timestampByMessageId.get(messageId) === timestamp) continue;
            timestampByMessageId.set(messageId, timestamp);
            changed = true;
        }

        if (changed) {
            scheduleCacheWrite();
            scheduleEnsure();
        }
    }

    function inspectFetchResponse(response, requestUrl) {
        if (!isMessageApiUrl(requestUrl) || !response?.clone) return;

        try {
            const contentType = response.headers?.get?.('content-type') || '';
            if (contentType && !/json/i.test(contentType)) return;
            const clone = response.clone();
            void Promise.resolve(clone.json()).then(captureTimestamps).catch(() => undefined);
        } catch (_error) {
            // Не-JSON ответы и потоки просто пропускаем.
        }
    }

    function installTimestampCapture() {
        try {
            const originalFetch = pageWindow.fetch;
            if (typeof originalFetch === 'function') {
                pageWindow.fetch = function (...args) {
                    const requestUrl = readRequestUrl(args[0]);
                    const result = Reflect.apply(originalFetch, this, args);
                    if (
                        isMessageApiUrl(requestUrl)
                        && args[1]?.[INTERNAL_RESPONSE_CONSUMER_FLAG] !== true
                    ) {
                        void Promise.resolve(result).then(
                            (response) => inspectFetchResponse(response, requestUrl),
                            () => undefined,
                        );
                    }
                    return result;
                };
            }
        } catch (error) {
            console.warn('[Message Timestamps] Не удалось подключиться к fetch.', error);
        }

        try {
            const xhrPrototype = pageWindow.XMLHttpRequest?.prototype;
            if (!xhrPrototype) return;

            const originalOpen = xhrPrototype.open;
            const originalSend = xhrPrototype.send;

            xhrPrototype.open = function (...args) {
                this[XHR_URL_KEY] = readRequestUrl(args[1]);
                return Reflect.apply(originalOpen, this, args);
            };

            xhrPrototype.send = function (...args) {
                const xhr = this;
                const requestUrl = xhr[XHR_URL_KEY] || '';

                if (isMessageApiUrl(requestUrl)) {
                    xhr.addEventListener('loadend', () => {
                        try {
                            const responseUrl = xhr.responseURL || requestUrl;
                            if (!isMessageApiUrl(responseUrl)) return;
                            const contentType = xhr.getResponseHeader?.('content-type') || '';
                            if (contentType && !/json/i.test(contentType)) return;

                            const payload = xhr.responseType === 'json'
                                ? xhr.response
                                : JSON.parse(xhr.responseText);
                            captureTimestamps(payload);
                        } catch (_error) {
                            // Не-JSON ответы и потоки просто пропускаем.
                        }
                    }, { once: true });
                }

                return Reflect.apply(originalSend, this, args);
            };
        } catch (error) {
            console.warn('[Message Timestamps] Не удалось подключиться к XHR.', error);
        }
    }

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .${TIMESTAMP_CLASS} {
                box-sizing: border-box !important;
                display: inline-flex !important;
                align-items: center !important;
                align-self: center !important;
                flex: 0 0 auto !important;
                margin-left: auto !important;
                padding: 0 2px !important;
                color: #71717a !important;
                font-family: inherit !important;
                font-size: 12px !important;
                font-weight: 400 !important;
                font-variant-numeric: tabular-nums !important;
                line-height: 1.2 !important;
                white-space: nowrap !important;
                cursor: default !important;
                user-select: none !important;
            }

            .dark .${TIMESTAMP_CLASS} {
                color: #a1a1aa !important;
            }

            .${SESSION_DIVIDER_CLASS} {
                box-sizing: border-box !important;
                display: flex !important;
                align-items: center !important;
                gap: 12px !important;
                width: min(800px, calc(100% - 24px)) !important;
                margin: 4px auto 18px !important;
                padding: 0 12px !important;
                color: #71717a !important;
                font-family: inherit !important;
                font-size: 11.5px !important;
                font-weight: 500 !important;
                font-variant-numeric: tabular-nums !important;
                line-height: 1.25 !important;
                white-space: nowrap !important;
                pointer-events: none !important;
                user-select: none !important;
            }

            .${SESSION_DIVIDER_CLASS}::before,
            .${SESSION_DIVIDER_CLASS}::after {
                content: "" !important;
                flex: 1 1 auto !important;
                height: 1px !important;
                background: rgba(113, 113, 122, 0.28) !important;
            }

            .dark .${SESSION_DIVIDER_CLASS} {
                color: #a1a1aa !important;
            }

            .dark .${SESSION_DIVIDER_CLASS}::before,
            .dark .${SESSION_DIVIDER_CLASS}::after {
                background: rgba(161, 161, 170, 0.24) !important;
            }
        `;
        document.head.appendChild(style);
    }

    function findHeaderParts(message) {
        const dropdown = message.querySelector(MESSAGE_DROPDOWN_SELECTOR);
        if (!dropdown) return null;

        const knownControls = (
            dropdown.closest('.sc-quick-delete-controls')
            || dropdown.closest('.relative')
        );
        if (knownControls?.parentElement && message.contains(knownControls.parentElement)) {
            return { header: knownControls.parentElement, controls: knownControls };
        }

        let controls = dropdown.parentElement;
        while (controls?.parentElement && controls.parentElement !== message) {
            const header = controls.parentElement;
            const hasIdentitySibling = Array.from(header.children).some((child) => (
                child !== controls
                && Boolean(child.querySelector?.('img, a[href^="/chatbot/"]'))
            ));
            if (hasIdentitySibling) return { header, controls };
            controls = header;
        }

        return null;
    }

    function ensureMessageTimestamp(message) {
        const timestamp = timestampByMessageId.get(message.id);
        let time = message.querySelector(`.${TIMESTAMP_CLASS}`);

        if (!timestamp) {
            if (time) time.remove();
            return;
        }

        const parts = findHeaderParts(message);
        if (!parts) return;

        const label = formatMoscowDateTime(timestamp);
        if (!label) return;

        if (!time) {
            time = document.createElement('time');
            time.className = TIMESTAMP_CLASS;
        }

        const isoDate = new Date(timestamp).toISOString();
        const title = `Отправлено ${label} по Москве`;
        if (time.dataset.messageId !== message.id) time.dataset.messageId = message.id;
        if (time.dateTime !== isoDate) time.dateTime = isoDate;
        if (time.textContent !== label) time.textContent = label;
        if (time.title !== title) time.title = title;
        if (time.getAttribute('aria-label') !== title) time.setAttribute('aria-label', title);

        if (time.parentElement !== parts.header || time.nextElementSibling !== parts.controls) {
            parts.header.insertBefore(time, parts.controls);
        }
    }

    function ensureSessionDividers(messages) {
        const desired = new Map();

        for (let index = 1; index < messages.length; index += 1) {
            const previousMessage = messages[index - 1];
            const currentMessage = messages[index];
            const previousTimestamp = timestampByMessageId.get(previousMessage.id);
            const currentTimestamp = timestampByMessageId.get(currentMessage.id);
            const label = makeSessionDividerLabel(previousTimestamp, currentTimestamp);

            if (label) desired.set(currentMessage.id, { message: currentMessage, label });
        }

        const existingByMessageId = new Map();
        for (const divider of document.querySelectorAll(`.${SESSION_DIVIDER_CLASS}`)) {
            const messageId = divider.dataset.beforeMessageId || '';
            if (!messageId || existingByMessageId.has(messageId)) {
                divider.remove();
                continue;
            }
            existingByMessageId.set(messageId, divider);
        }

        for (const [messageId, divider] of existingByMessageId) {
            if (desired.has(messageId)) continue;
            divider.remove();
            existingByMessageId.delete(messageId);
        }

        for (const [messageId, item] of desired) {
            let divider = existingByMessageId.get(messageId);
            if (!divider) {
                divider = document.createElement('div');
                divider.className = SESSION_DIVIDER_CLASS;
                divider.dataset.beforeMessageId = messageId;
                divider.setAttribute('role', 'separator');
            }

            if (divider.textContent !== item.label) divider.textContent = item.label;
            divider.setAttribute('aria-label', item.label);

            if (
                divider.parentElement !== item.message.parentElement
                || divider.nextElementSibling !== item.message
            ) {
                item.message.before(divider);
            }
        }
    }

    function ensureAllTimestamps() {
        ensureContext();
        const messages = Array.from(document.querySelectorAll(MESSAGE_SELECTOR));
        for (const message of messages) {
            ensureMessageTimestamp(message);
        }
        ensureSessionDividers(messages);
    }

    function scheduleEnsure() {
        if (ensureScheduled) return;
        ensureScheduled = true;
        requestAnimationFrame(runDomPass);
    }

    function nodeContainsMessage(node, includeDescendants = true) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
        const selector = `${MESSAGE_SELECTOR}, ${MESSAGE_DROPDOWN_SELECTOR}`;
        return (
            node.matches?.(selector)
            || (includeDescendants && Boolean(node.querySelector?.(selector)))
        );
    }

    function isTimelineMutation(record) {
        const element = record.target?.nodeType === Node.ELEMENT_NODE
            ? record.target
            : record.target?.parentElement;
        return Boolean(element?.closest?.(`.${TIMESTAMP_CLASS}, .${SESSION_DIVIDER_CLASS}`));
    }

    function handleRootMutations(records) {
        if (records.length && records.every(isTimelineMutation)) return;
        const relevant = records.some((record) => (
            nodeContainsMessage(record.target, false)
            || Array.from(record.addedNodes).some((node) => nodeContainsMessage(node, true))
            || Array.from(record.removedNodes).some((node) => nodeContainsMessage(node, true))
        ));
        if (relevant) scheduleEnsure();
    }

    function scheduleRetry() {
        if (retryTimer) return;
        const delay = retryDelay;
        retryDelay = Math.min(8000, retryDelay * 2);
        retryTimer = window.setTimeout(() => {
            retryTimer = null;
            runDomPass();
        }, delay);
    }

    function resetRetry() {
        if (retryTimer) window.clearTimeout(retryTimer);
        retryTimer = null;
        retryDelay = 250;
    }

    function runDomPass() {
        ensureScheduled = false;
        if (!document.documentElement || !document.head || !document.body) return;

        try {
            addStyles();
            ensureAllTimestamps();

            if (!rootObserver) {
                rootObserver = new MutationObserver(handleRootMutations);
                rootObserver.observe(document.documentElement, { childList: true, subtree: true });
            }
            resetRetry();
        } catch (error) {
            rootObserver?.disconnect();
            rootObserver = null;
            console.error('[Message Timestamps] DOM-инициализация сорвалась, повторю автоматически.', error);
            scheduleRetry();
        }
    }

    function startDomFeatures() {
        runDomPass();
    }

    ensureContext();
    installTimestampCapture();
    installRouteChangeSignal();
    window.addEventListener('pagehide', flushTimestampCache);
    window.addEventListener(ROUTE_CHANGE_EVENT, startDomFeatures);
    window.addEventListener('pageshow', startDomFeatures);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) startDomFeatures();
    });
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startDomFeatures, { once: true });
    }
    startDomFeatures();
}
