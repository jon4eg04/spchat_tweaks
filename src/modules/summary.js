// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
export default function init(runtime) {
    'use strict';

    const INSTANCE_KEY = '__spicyChatGptSummaryV1';
    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (pageWindow[INSTANCE_KEY]) return;
    pageWindow[INSTANCE_KEY] = true;


    const CHAT_DROPDOWN_SELECTOR = 'button[aria-label="chat-dropdown" i]';
    const MESSAGE_SELECTOR = 'div[id^="message-"]';
    const MENU_ITEM_CLASS = 'tm-sc-open-gpt-summary';
    const BOOKMARK_MENU_ITEM_CLASS = 'tm-sc-open-message-bookmarks';
    const GALLERY_MENU_ITEM_CLASS = 'tm-sc-open-conversation-gallery';
    const OVERLAY_ID = 'tm-sc-gpt-summary-overlay';
    const STYLE_ID = 'tm-sc-gpt-summary-style';
    const CACHE_PREFIX = 'tm-sc-gpt-summary-v1.1:';
    const PAGE_SIZE = 50;
    const MAX_HISTORY_PAGES = 1000;
    const CHUNK_CHARACTER_LIMIT = 110000;
    const ENDPOINT_TIMEOUT = 290000;
    const API_WAIT_TIMEOUT = 10000;
    const XHR_URL_KEY = '__tmScGptSummaryUrl';
    const INTERNAL_RESPONSE_CONSUMER_FLAG = '__tmScConsumesJsonResponse';
    const ROUTE_CHANGE_EVENT = 'tm-sc-route-change';
    const CHAT_MENU_ITEM_ORDER = [
        'tm-sc-open-message-bookmarks',
        'tm-sc-open-conversation-gallery',
        'tm-sc-open-gpt-summary',
        'tm-sc-open-chat-branches',
    ];
    const API_HEADER_NAMES = new Set([
        'authorization',
        'x-guest-userid',
        'x-country',
        'x-app-id',
        'x-app-version',
        'x-platform',
        'x-platform-os',
        'accept',
        'content-type',
    ]);

    const apiHeaders = new Map();
    let apiOrigin = '';
    let apiNativeFetch = null;
    let capturedConversationInfo = null;
    let activeContext = null;
    let ensureScheduled = false;
    let rootObserver = null;
    let retryTimer = null;
    let retryDelay = 250;
    let runSerial = 0;
    let running = false;

    let overlay = null;
    let statusNode = null;
    let metricsNode = null;
    let progressTrack = null;
    let progressBar = null;
    let resultNode = null;
    let emptyNode = null;
    let refreshButton = null;
    let copyButton = null;
    let lastSummary = '';

    const moscowDateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });
    const integerFormatter = new Intl.NumberFormat('ru-RU');

    const icons = {
        summary: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <path d="M14 2v6h6"></path><path d="M8 13h8"></path><path d="M8 17h6"></path>
                <path d="m9 9 .7-1.5L11.2 7l-1.5-.5L9 5l-.7 1.5L6.8 7l1.5.5z"></path>
            </svg>`,
        close: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="m18 6-12 12"></path><path d="m6 6 12 12"></path>
            </svg>`,
        refresh: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"></path>
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"></path>
            </svg>`,
        copy: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2"></rect>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
            </svg>`,
    };

    function getChatContext() {
        const parts = location.pathname.split('/').filter(Boolean);
        const chatIndex = parts.indexOf('chat');
        if (chatIndex < 0 || !parts[chatIndex + 1] || !parts[chatIndex + 2]) return null;
        const characterId = parts[chatIndex + 1];
        const conversationId = parts[chatIndex + 2];
        return {
            characterId,
            conversationId,
            key: `${characterId}:${conversationId}`,
        };
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

    function ensureContext() {
        const next = getChatContext();
        if (next?.key === activeContext?.key) return;
        runSerial += 1;
        running = false;
        activeContext = next;
        capturedConversationInfo = null;
        lastSummary = '';
        if (overlay && !overlay.hidden) closeOverlay();
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

    function isSpicyApiUrl(rawUrl) {
        try {
            const url = new URL(rawUrl, location.href);
            return url.hostname === 'nd-api.com' || url.hostname.endsWith('.nd-api.com');
        } catch (_error) {
            return false;
        }
    }

    function headerEntries(source) {
        if (!source) return [];
        const entries = [];
        try {
            if (typeof source.forEach === 'function') {
                source.forEach((value, name) => entries.push([name, value]));
                return entries;
            }
            if (Array.isArray(source)) return source;
            if (typeof source === 'object') return Object.entries(source);
        } catch (_error) {
            return [];
        }
        return entries;
    }

    function rememberApiAccess(rawUrl, ...headerSources) {
        if (!isSpicyApiUrl(rawUrl)) return;
        try {
            apiOrigin = new URL(rawUrl, location.href).origin;
        } catch (_error) {
            return;
        }

        for (const source of headerSources) {
            for (const [rawName, rawValue] of headerEntries(source)) {
                const name = String(rawName || '').toLowerCase();
                if (!API_HEADER_NAMES.has(name) || rawValue === undefined || rawValue === null) continue;
                apiHeaders.set(name, String(rawValue));
            }
        }
    }

    function captureConversationPayload(payload) {
        ensureContext();
        if (!activeContext || !payload || typeof payload !== 'object') return;
        if (payload.conversation_id !== activeContext.conversationId || !Array.isArray(payload.messages)) return;

        capturedConversationInfo = {
            totalMessages: Math.max(
                capturedConversationInfo?.totalMessages || 0,
                Number(payload.num_messages) || 0,
            ),
            chatTitle: typeof payload.label === 'string' && payload.label.trim()
                ? payload.label.trim()
                : capturedConversationInfo?.chatTitle || '',
            userName: typeof payload.userPersona?.name === 'string'
                ? payload.userPersona.name.trim()
                : capturedConversationInfo?.userName || '',
        };
    }

    function installApiCapture() {
        const originalFetch = pageWindow.fetch;
        if (typeof originalFetch === 'function') {
            apiNativeFetch = originalFetch;
            pageWindow.fetch = function (input, options = {}) {
                const requestUrl = readRequestUrl(input);
                if (isSpicyApiUrl(requestUrl)) {
                    rememberApiAccess(requestUrl, input?.headers, options?.headers);
                }
                return Reflect.apply(originalFetch, this, arguments);
            };
        }

        try {
            const prototype = pageWindow.XMLHttpRequest?.prototype;
            if (!prototype) return;
            const originalOpen = prototype.open;
            const originalSetRequestHeader = prototype.setRequestHeader;
            const originalSend = prototype.send;

            prototype.open = function (...args) {
                this[XHR_URL_KEY] = readRequestUrl(args[1]);
                if (isSpicyApiUrl(this[XHR_URL_KEY])) rememberApiAccess(this[XHR_URL_KEY]);
                return Reflect.apply(originalOpen, this, args);
            };

            prototype.setRequestHeader = function (name, value) {
                if (isSpicyApiUrl(this[XHR_URL_KEY])) {
                    rememberApiAccess(this[XHR_URL_KEY], { [name]: value });
                }
                return Reflect.apply(originalSetRequestHeader, this, arguments);
            };

            prototype.send = function (...args) {
                return Reflect.apply(originalSend, this, args);
            };
        } catch (error) {
            console.warn('[GPT Summary] Не удалось подключиться к XMLHttpRequest.', error);
        }
    }

    function hasApiAccess() {
        return Boolean(apiNativeFetch && apiOrigin && apiHeaders.get('authorization'));
    }

    function sleep(milliseconds) {
        return new Promise((resolve) => pageWindow.setTimeout(resolve, milliseconds));
    }

    async function waitForApiAccess(serial) {
        const startedAt = Date.now();
        while (!hasApiAccess() && Date.now() - startedAt < API_WAIT_TIMEOUT) {
            if (serial !== runSerial) throw new Error('Операция отменена.');
            await sleep(160);
        }
        if (!hasApiAccess()) {
            throw new Error('Не удалось поймать сессию SpicyChat. Обнови страницу и попробуй ещё раз.');
        }
    }

    async function fetchApiJson(path) {
        if (!hasApiAccess()) throw new Error('Сессия API SpicyChat ещё не обнаружена.');
        const url = new URL(path, `${apiOrigin}/`).toString();
        const headers = Object.fromEntries(apiHeaders);
        headers.accept = 'application/json';

        const response = await Reflect.apply(apiNativeFetch, pageWindow, [url, {
            method: 'GET',
            headers,
            mode: 'cors',
            credentials: 'omit',
            [INTERNAL_RESPONSE_CONSUMER_FLAG]: true,
        }]);
        if (!response?.ok) throw new Error(`SpicyChat вернул HTTP ${response?.status || 0}.`);
        const payload = await response.json();
        captureConversationPayload(payload);
        return payload;
    }

    function normalizeTimestamp(value) {
        if (value === null || value === undefined || value === '') return 0;
        let timestamp = Number(value);
        if (!Number.isFinite(timestamp) && typeof value === 'string') timestamp = Date.parse(value);
        if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
        return timestamp < 100000000000 ? timestamp * 1000 : timestamp;
    }

    function normalizeMessageId(value) {
        return typeof value === 'string' ? value.trim().replace(/^message-/, '') : '';
    }

    function getVisibleMessageIds() {
        return new Set(Array.from(document.querySelectorAll(MESSAGE_SELECTOR), (message) => (
            normalizeMessageId(message.id)
        )).filter(Boolean));
    }

    function chooseActiveMessages(rawMessages) {
        const visibleIds = getVisibleMessageIds();
        const regularParents = new Set();
        const alternativeGroups = new Map();

        for (const message of rawMessages) {
            const id = normalizeMessageId(message?.id);
            if (!id) continue;
            const groupKey = `${message?.role || ''}:${message?.prevId || message?.prev_id || '__root__'}`;
            if (message?.is_alternative === true) {
                if (!alternativeGroups.has(groupKey)) alternativeGroups.set(groupKey, []);
                alternativeGroups.get(groupKey).push(message);
            } else {
                regularParents.add(groupKey);
            }
        }

        const chosenAlternativeIds = new Set();
        for (const [groupKey, alternatives] of alternativeGroups) {
            const visible = alternatives.find((message) => visibleIds.has(normalizeMessageId(message.id)));
            if (visible) {
                chosenAlternativeIds.add(normalizeMessageId(visible.id));
            } else if (!regularParents.has(groupKey) && alternatives[0]) {
                chosenAlternativeIds.add(normalizeMessageId(alternatives[0].id));
            }
        }

        return rawMessages.filter((message) => (
            message?.is_alternative !== true
            || chosenAlternativeIds.has(normalizeMessageId(message?.id))
        ));
    }

    function normalizeHistoryMessage(message) {
        if (!message || typeof message !== 'object') return null;
        const id = normalizeMessageId(message.id);
        const role = message.role === 'user' ? 'user' : message.role === 'bot' ? 'bot' : '';
        if (!id || !role) return null;
        let content = typeof message.content === 'string' ? message.content.trim() : '';
        if (!content) content = '[Сообщение без текста: возможно, изображение или вложение.]';
        return {
            id,
            role,
            content: content.replace(/\u0000/g, ''),
            createdAt: normalizeTimestamp(message.createdAt || message.created_at),
            prevId: normalizeMessageId(message.prevId || message.prev_id),
            isAlternative: message.is_alternative === true,
        };
    }

    async function fetchCompleteHistory(context, serial) {
        const rawMessages = [];
        const seen = new Set();
        let lastId = '';
        let total = capturedConversationInfo?.totalMessages || 0;
        let page = 0;

        while (page < MAX_HISTORY_PAGES) {
            if (serial !== runSerial) throw new Error('Операция отменена.');
            const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
            if (lastId) query.set('last_id', lastId);
            const payload = await fetchApiJson(
                `/characters/${encodeURIComponent(context.characterId)}/messages/`
                + `${encodeURIComponent(context.conversationId)}?${query}`,
            );
            const batch = Array.isArray(payload?.messages) ? payload.messages : [];
            total = Math.max(total, Number(payload?.num_messages) || 0, seen.size);

            let added = 0;
            for (const message of batch) {
                const id = normalizeMessageId(message?.id);
                if (!id || seen.has(id)) continue;
                seen.add(id);
                const normalized = normalizeHistoryMessage(message);
                if (normalized) {
                    rawMessages.push(normalized);
                    added += 1;
                }
            }

            const knownTotal = Math.max(total, seen.size);
            const ratio = knownTotal ? Math.min(1, seen.size / knownTotal) : 0;
            setProgress(
                4 + ratio * 36,
                `Загружаю историю: ${seen.size} / ${knownTotal || '?'}`,
                `Пачка ${page + 1}`,
            );

            if (batch.length < PAGE_SIZE || !added) break;
            const nextLastId = normalizeMessageId(batch.at(-1)?.id);
            if (!nextLastId || nextLastId === lastId) break;
            lastId = nextLastId;
            page += 1;
            await sleep(55);
        }

        const messages = chooseActiveMessages(rawMessages).reverse();
        return {
            messages,
            apiRecordCount: rawMessages.length,
            reportedTotal: total,
            userName: capturedConversationInfo?.userName || 'Пользователь',
            chatTitle: capturedConversationInfo?.chatTitle || '',
        };
    }

    function formatMoscowDateTime(timestamp) {
        if (!timestamp) return 'время неизвестно';
        try {
            return moscowDateTimeFormatter.format(new Date(timestamp));
        } catch (_error) {
            return 'время неизвестно';
        }
    }

    function getBotName() {
        const names = Array.from(document.querySelectorAll('a[href^="/chatbot/"] p'))
            .map((node) => node.textContent?.trim())
            .filter(Boolean);
        return names.at(-1) || 'Персонаж';
    }

    function buildMessageBlocks(history) {
        const botName = getBotName();
        const userName = history.userName || 'Пользователь';
        return history.messages.map((message, index) => {
            const author = message.role === 'user' ? userName : botName;
            const date = formatMoscowDateTime(message.createdAt);
            return `${index + 1}. [${date}, Москва] ${author}:\n${message.content}`;
        });
    }

    function splitLongBlock(block, limit) {
        if (block.length <= limit) return [block];
        const parts = [];
        for (let offset = 0; offset < block.length; offset += limit) {
            parts.push(block.slice(offset, offset + limit));
        }
        return parts;
    }

    function splitIntoChunks(blocks) {
        const chunks = [];
        let current = [];
        let currentLength = 0;

        const flush = () => {
            if (!current.length) return;
            chunks.push(current.join('\n\n'));
            current = [];
            currentLength = 0;
        };

        for (const originalBlock of blocks) {
            for (const block of splitLongBlock(originalBlock, CHUNK_CHARACTER_LIMIT - 200)) {
                const addedLength = block.length + (current.length ? 2 : 0);
                if (current.length && currentLength + addedLength > CHUNK_CHARACTER_LIMIT) flush();
                current.push(block);
                currentLength += block.length + (current.length > 1 ? 2 : 0);
            }
        }
        flush();
        return chunks;
    }

    function historyFingerprint(messages) {
        let hash = 2166136261;
        const update = (text) => {
            for (let index = 0; index < text.length; index += 1) {
                hash ^= text.charCodeAt(index);
                hash = Math.imul(hash, 16777619);
            }
        };
        for (const message of messages) {
            update(message.id);
            update(String(message.createdAt));
            update(message.role);
            update(message.content);
        }
        return `${messages.length}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
    }

    async function readCache(key) {
        try {
            if (typeof GM_getValue === 'function') {
                return await Promise.resolve(GM_getValue(key, null));
            }
        } catch (_error) {
            return null;
        }
        return null;
    }

    async function writeCache(key, value) {
        try {
            if (typeof GM_setValue === 'function') await Promise.resolve(GM_setValue(key, value));
        } catch (error) {
            console.warn('[GPT Summary] Не удалось сохранить пересказ в кеш.', error);
        }
    }

    function endpointRequest(stage, content) {
        const { url: ENDPOINT_URL, token: CLIENT_TOKEN } = runtime.getEndpoint('summary');
        return new Promise((resolve, reject) => {
            let settled = false;
            const finish = (callback, value) => {
                if (settled) return;
                settled = true;
                callback(value);
            };

            GM_xmlhttpRequest({
                method: 'POST',
                url: ENDPOINT_URL,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'X-Spicy-Summary-Token': CLIENT_TOKEN,
                },
                data: JSON.stringify({ stage, content }),
                timeout: ENDPOINT_TIMEOUT,
                anonymous: true,
                onload(response) {
                    let payload = null;
                    try {
                        payload = JSON.parse(response.responseText || '{}');
                    } catch (_error) {
                        const error = new Error(`Обработчик вернул не JSON (HTTP ${response.status || 0}).`);
                        error.retryable = response.status >= 500 || !response.status;
                        finish(reject, error);
                        return;
                    }

                    if (response.status < 200 || response.status >= 300 || !payload?.ok) {
                        const error = new Error(payload?.error || `Ошибка обработчика HTTP ${response.status || 0}.`);
                        error.retryable = response.status === 429 || response.status >= 500 || !response.status;
                        finish(reject, error);
                        return;
                    }
                    finish(resolve, payload);
                },
                onerror() {
                    const error = new Error('Не удалось связаться с настроенным обработчиком.');
                    error.retryable = true;
                    finish(reject, error);
                },
                ontimeout() {
                    const error = new Error('Обработчик слишком долго не отвечает.');
                    error.retryable = true;
                    finish(reject, error);
                },
            });
        });
    }

    async function endpointRequestWithRetry(stage, content, serial) {
        let lastError = null;
        for (let attempt = 1; attempt <= 2; attempt += 1) {
            if (serial !== runSerial) throw new Error('Операция отменена.');
            try {
                return await endpointRequest(stage, content);
            } catch (error) {
                lastError = error;
                if (!error?.retryable || attempt === 2) throw error;
                await sleep(1400 * attempt);
            }
        }
        throw lastError || new Error('Неизвестная ошибка обработчика.');
    }

    function addUsage(total, usage) {
        total.input_tokens += Math.max(0, Number(usage?.input_tokens) || 0);
        total.output_tokens += Math.max(0, Number(usage?.output_tokens) || 0);
        total.total_tokens += Math.max(0, Number(usage?.total_tokens) || 0);
    }

    async function makeSummary(chunks, serial) {
        const usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
        if (chunks.length === 1) {
            setProgress(72, 'OpenAI читает историю и собирает пересказ…', 'Один запрос');
            const result = await endpointRequestWithRetry('final', chunks[0], serial);
            addUsage(usage, result.usage);
            return { summary: result.summary, usage, chunkCount: 1 };
        }

        const notes = [];
        for (let index = 0; index < chunks.length; index += 1) {
            const percent = 43 + ((index / chunks.length) * 43);
            setProgress(
                percent,
                `OpenAI обрабатывает часть ${index + 1} из ${chunks.length}…`,
                `Готово частей: ${index} / ${chunks.length}`,
            );
            const result = await endpointRequestWithRetry('chunk', chunks[index], serial);
            addUsage(usage, result.usage);
            notes.push(`=== ЧАСТЬ ${index + 1} ИЗ ${chunks.length} ===\n${result.summary}`);
        }

        setProgress(92, 'Собираю промежуточные конспекты в единый пересказ…', `${chunks.length} частей`);
        const finalResult = await endpointRequestWithRetry('final', notes.join('\n\n'), serial);
        addUsage(usage, finalResult.usage);
        return { summary: finalResult.summary, usage, chunkCount: chunks.length };
    }

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${OVERLAY_ID}[hidden] { display: none !important; }
            #${OVERLAY_ID} {
                position: fixed !important;
                inset: 0 !important;
                z-index: 10250 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 24px !important;
                background: rgba(0, 0, 0, 0.6) !important;
                backdrop-filter: blur(3px) !important;
                font-family: inherit !important;
            }
            .tm-sc-summary-shell {
                box-sizing: border-box !important;
                display: flex !important;
                flex-direction: column !important;
                width: min(900px, calc(100vw - 48px)) !important;
                height: min(850px, calc(100vh - 48px)) !important;
                min-height: 430px !important;
                overflow: hidden !important;
                color: #18181b !important;
                background: #ffffff !important;
                border: 1px solid rgba(17, 24, 39, 0.14) !important;
                border-radius: 18px !important;
                box-shadow: 0 28px 90px rgba(0, 0, 0, 0.5) !important;
            }
            .dark .tm-sc-summary-shell {
                color: #f4f4f5 !important;
                background: #202023 !important;
                border-color: rgba(255, 255, 255, 0.13) !important;
            }
            .tm-sc-summary-header {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 14px !important;
                padding: 16px 18px 13px !important;
                border-bottom: 1px solid rgba(113, 113, 122, 0.17) !important;
            }
            .tm-sc-summary-title {
                margin: 0 !important;
                color: inherit !important;
                font-size: 20px !important;
                line-height: 1.25 !important;
                font-weight: 720 !important;
            }
            .tm-sc-summary-actions {
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
            }
            .tm-sc-summary-button {
                appearance: none !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 7px !important;
                height: 38px !important;
                padding: 0 12px !important;
                color: inherit !important;
                background: rgba(113, 113, 122, 0.11) !important;
                border: 0 !important;
                border-radius: 10px !important;
                cursor: pointer !important;
                font-family: inherit !important;
                font-size: 13px !important;
                font-weight: 650 !important;
            }
            .tm-sc-summary-button:hover:not(:disabled) { background: rgba(124, 58, 237, 0.17) !important; }
            .tm-sc-summary-button:disabled { cursor: default !important; opacity: 0.45 !important; }
            .tm-sc-summary-close { width: 38px !important; padding: 0 !important; }
            .tm-sc-summary-progress-area {
                padding: 11px 18px 12px !important;
                border-bottom: 1px solid rgba(113, 113, 122, 0.14) !important;
            }
            .tm-sc-summary-progress-copy {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 14px !important;
                margin-bottom: 8px !important;
                color: #71717a !important;
                font-size: 12px !important;
                line-height: 1.35 !important;
            }
            .dark .tm-sc-summary-progress-copy { color: #b4b4bd !important; }
            .tm-sc-summary-status { overflow-wrap: anywhere !important; }
            .tm-sc-summary-metrics { flex: 0 0 auto !important; white-space: nowrap !important; }
            .tm-sc-summary-progress-track {
                position: relative !important;
                height: 7px !important;
                overflow: hidden !important;
                background: rgba(113, 113, 122, 0.18) !important;
                border-radius: 9999px !important;
            }
            .tm-sc-summary-progress-bar {
                position: absolute !important;
                inset: 0 auto 0 0 !important;
                width: 0 !important;
                background: linear-gradient(90deg, #7c3aed, #a78bfa) !important;
                border-radius: inherit !important;
                transition: width 300ms ease, background 180ms ease !important;
            }
            .tm-sc-summary-progress-track.is-complete .tm-sc-summary-progress-bar { background: #22c55e !important; }
            .tm-sc-summary-progress-track.is-error .tm-sc-summary-progress-bar { background: #ef4444 !important; }
            .tm-sc-summary-content {
                position: relative !important;
                flex: 1 1 auto !important;
                min-height: 0 !important;
                overflow: auto !important;
                padding: 24px 28px 30px !important;
                overscroll-behavior: contain !important;
            }
            .tm-sc-summary-empty {
                position: absolute !important;
                inset: 0 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 40px !important;
                color: #71717a !important;
                font-size: 14px !important;
                text-align: center !important;
            }
            .tm-sc-summary-empty[hidden] { display: none !important; }
            .dark .tm-sc-summary-empty { color: #a1a1aa !important; }
            .tm-sc-summary-result { max-width: 780px !important; margin: 0 auto !important; }
            .tm-sc-summary-result[hidden] { display: none !important; }
            .tm-sc-summary-result h2,
            .tm-sc-summary-result h3 {
                margin: 24px 0 9px !important;
                color: inherit !important;
                line-height: 1.3 !important;
                font-weight: 720 !important;
            }
            .tm-sc-summary-result h2:first-child,
            .tm-sc-summary-result h3:first-child { margin-top: 0 !important; }
            .tm-sc-summary-result h2 { font-size: 19px !important; }
            .tm-sc-summary-result h3 { font-size: 16px !important; }
            .tm-sc-summary-result p,
            .tm-sc-summary-result li {
                color: inherit !important;
                font-size: 14.5px !important;
                line-height: 1.65 !important;
            }
            .tm-sc-summary-result p { margin: 0 0 11px !important; white-space: pre-wrap !important; }
            .tm-sc-summary-result ul,
            .tm-sc-summary-result ol { margin: 7px 0 14px 22px !important; padding: 0 !important; }
            .tm-sc-summary-result li { margin: 4px 0 !important; padding-left: 3px !important; }
            .tm-sc-summary-error {
                padding: 14px 16px !important;
                color: #991b1b !important;
                background: rgba(239, 68, 68, 0.11) !important;
                border: 1px solid rgba(239, 68, 68, 0.24) !important;
                border-radius: 11px !important;
                font-size: 14px !important;
                line-height: 1.5 !important;
                white-space: pre-wrap !important;
            }
            .dark .tm-sc-summary-error { color: #fecaca !important; }
        `;
        document.head.appendChild(style);
    }

    function ensureOverlay() {
        if (overlay?.isConnected) return overlay;
        overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.hidden = true;
        overlay.innerHTML = `
            <section class="tm-sc-summary-shell" role="dialog" aria-modal="true" aria-labelledby="tm-sc-summary-title">
                <header class="tm-sc-summary-header">
                    <h2 id="tm-sc-summary-title" class="tm-sc-summary-title">Пересказ диалога</h2>
                    <div class="tm-sc-summary-actions">
                        <button class="tm-sc-summary-button tm-sc-summary-copy" type="button">${icons.copy}<span>Скопировать</span></button>
                        <button class="tm-sc-summary-button tm-sc-summary-refresh" type="button">${icons.refresh}<span>Пересказать заново</span></button>
                        <button class="tm-sc-summary-button tm-sc-summary-close" type="button" aria-label="Закрыть">${icons.close}</button>
                    </div>
                </header>
                <div class="tm-sc-summary-progress-area">
                    <div class="tm-sc-summary-progress-copy">
                        <span class="tm-sc-summary-status" aria-live="polite">Готово к запуску</span>
                        <span class="tm-sc-summary-metrics"></span>
                    </div>
                    <div class="tm-sc-summary-progress-track" role="progressbar" aria-label="Подготовка пересказа" aria-valuemin="0" aria-valuemax="100">
                        <div class="tm-sc-summary-progress-bar"></div>
                    </div>
                </div>
                <div class="tm-sc-summary-content">
                    <div class="tm-sc-summary-empty">Здесь появится пересказ истории</div>
                    <article class="tm-sc-summary-result" hidden></article>
                </div>
            </section>
        `;

        statusNode = overlay.querySelector('.tm-sc-summary-status');
        metricsNode = overlay.querySelector('.tm-sc-summary-metrics');
        progressTrack = overlay.querySelector('.tm-sc-summary-progress-track');
        progressBar = overlay.querySelector('.tm-sc-summary-progress-bar');
        resultNode = overlay.querySelector('.tm-sc-summary-result');
        emptyNode = overlay.querySelector('.tm-sc-summary-empty');
        refreshButton = overlay.querySelector('.tm-sc-summary-refresh');
        copyButton = overlay.querySelector('.tm-sc-summary-copy');

        overlay.querySelector('.tm-sc-summary-close').addEventListener('click', closeOverlay);
        overlay.addEventListener('pointerdown', (event) => {
            if (event.target === overlay) closeOverlay();
        });
        refreshButton.addEventListener('click', () => {
            if (!running) void generateSummary({ force: true });
        });
        copyButton.addEventListener('click', async () => {
            if (!lastSummary) return;
            try {
                await navigator.clipboard.writeText(lastSummary);
                const label = copyButton.querySelector('span');
                if (label) label.textContent = 'Скопировано';
                window.setTimeout(() => {
                    if (label) label.textContent = 'Скопировать';
                }, 1100);
            } catch (_error) {
                setStatusOnly('Не удалось скопировать автоматически');
            }
        });

        document.body.appendChild(overlay);
        updateActionState();
        return overlay;
    }

    function openOverlay() {
        ensureOverlay();
        overlay.hidden = false;
    }

    function closeOverlay() {
        if (overlay) overlay.hidden = true;
    }

    function updateActionState() {
        if (refreshButton) refreshButton.disabled = running;
        if (copyButton) copyButton.disabled = running || !lastSummary;
    }

    function setStatusOnly(status, metrics = metricsNode?.textContent || '') {
        if (statusNode) statusNode.textContent = status;
        if (metricsNode) metricsNode.textContent = metrics;
    }

    function setProgress(percent, status, metrics = '') {
        ensureOverlay();
        const normalized = Math.max(0, Math.min(100, Number(percent) || 0));
        progressBar.style.setProperty('width', `${normalized}%`, 'important');
        progressTrack.setAttribute('aria-valuenow', String(Math.round(normalized)));
        progressTrack.classList.remove('is-complete', 'is-error');
        setStatusOnly(status, metrics);
    }

    function showLoading() {
        lastSummary = '';
        if (resultNode) {
            resultNode.hidden = true;
            resultNode.replaceChildren();
        }
        if (emptyNode) {
            emptyNode.hidden = false;
            emptyNode.textContent = 'Готовлю пересказ истории…';
        }
        updateActionState();
    }

    function renderMarkdown(text) {
        const fragment = document.createDocumentFragment();
        let list = null;
        let listType = '';
        let paragraphLines = [];

        const flushParagraph = () => {
            if (!paragraphLines.length) return;
            const paragraph = document.createElement('p');
            paragraph.textContent = paragraphLines.join(' ');
            fragment.appendChild(paragraph);
            paragraphLines = [];
        };
        const closeList = () => {
            list = null;
            listType = '';
        };

        for (const rawLine of String(text || '').split(/\r?\n/)) {
            const line = rawLine.trim();
            const heading = line.match(/^(#{1,3})\s+(.+)$/);
            const unordered = line.match(/^[-*•]\s+(.+)$/);
            const ordered = line.match(/^\d+[.)]\s+(.+)$/);

            if (heading) {
                flushParagraph();
                closeList();
                const node = document.createElement(heading[1].length <= 2 ? 'h2' : 'h3');
                node.textContent = heading[2];
                fragment.appendChild(node);
            } else if (unordered || ordered) {
                flushParagraph();
                const nextType = unordered ? 'ul' : 'ol';
                if (!list || listType !== nextType) {
                    list = document.createElement(nextType);
                    listType = nextType;
                    fragment.appendChild(list);
                }
                const item = document.createElement('li');
                item.textContent = (unordered || ordered)[1];
                list.appendChild(item);
            } else if (!line) {
                flushParagraph();
                closeList();
            } else {
                closeList();
                paragraphLines.push(line);
            }
        }
        flushParagraph();
        return fragment;
    }

    function showSummary(summary, details) {
        lastSummary = summary;
        emptyNode.hidden = true;
        resultNode.hidden = false;
        resultNode.replaceChildren(renderMarkdown(summary));
        progressBar.style.setProperty('width', '100%', 'important');
        progressTrack.setAttribute('aria-valuenow', '100');
        progressTrack.classList.remove('is-error');
        progressTrack.classList.add('is-complete');
        setStatusOnly(details.status, details.metrics);
        updateActionState();
    }

    function showError(error) {
        lastSummary = '';
        resultNode.hidden = false;
        resultNode.replaceChildren();
        const box = document.createElement('div');
        box.className = 'tm-sc-summary-error';
        box.textContent = error?.message || 'Неизвестная ошибка.';
        resultNode.appendChild(box);
        emptyNode.hidden = true;
        progressTrack.classList.remove('is-complete');
        progressTrack.classList.add('is-error');
        setStatusOnly('Пересказ не создан', 'Можно попробовать ещё раз');
        updateActionState();
    }

    function formatUsage(usage) {
        const total = Math.max(0, Number(usage?.total_tokens) || 0);
        if (!total) return '';
        return `${integerFormatter.format(total)} токенов`;
    }

    async function generateSummary({ force }) {
        ensureContext();
        if (!activeContext || running) return;
        openOverlay();
        running = true;
        const serial = ++runSerial;
        showLoading();
        setProgress(2, 'Подключаюсь к истории SpicyChat…');

        try {
            await waitForApiAccess(serial);
            const contextAtStart = { ...activeContext };
            const history = await fetchCompleteHistory(contextAtStart, serial);
            if (serial !== runSerial || contextAtStart.key !== activeContext?.key) return;
            if (!history.messages.length) throw new Error('В этом диалоге не нашлось сообщений для пересказа.');

            const fingerprint = historyFingerprint(history.messages);
            const cacheKey = `${CACHE_PREFIX}${contextAtStart.key}`;
            const cached = force ? null : await readCache(cacheKey);
            if (
                cached
                && cached.fingerprint === fingerprint
                && typeof cached.summary === 'string'
                && cached.summary.trim()
            ) {
                running = false;
                showSummary(cached.summary, {
                    status: 'Показан сохранённый пересказ',
                    metrics: `${history.messages.length} сообщений · ${formatUsage(cached.usage) || 'из кеша'}`,
                });
                return;
            }

            const blocks = buildMessageBlocks(history);
            const chunks = splitIntoChunks(blocks);
            setProgress(
                42,
                `История загружена: ${history.messages.length} сообщений`,
                `Частей для обработки: ${chunks.length}`,
            );
            const generated = await makeSummary(chunks, serial);
            if (serial !== runSerial || contextAtStart.key !== activeContext?.key) return;

            await writeCache(cacheKey, {
                fingerprint,
                summary: generated.summary,
                generatedAt: Date.now(),
                messageCount: history.messages.length,
                chunkCount: generated.chunkCount,
                usage: generated.usage,
            });

            running = false;
            showSummary(generated.summary, {
                status: 'Пересказ готов',
                metrics: `${history.messages.length} сообщений · ${generated.chunkCount} частей · ${formatUsage(generated.usage)}`,
            });
        } catch (error) {
            if (serial !== runSerial) return;
            running = false;
            showError(error);
        }
    }

    function cloneMenuButton(template) {
        const button = template.cloneNode(true);
        button.classList.add(MENU_ITEM_CLASS);
        button.setAttribute('aria-label', 'Пересказать чат');
        button.removeAttribute('data-testid');
        button.querySelector('svg')?.remove();
        button.insertAdjacentHTML('afterbegin', icons.summary);
        const labels = Array.from(button.querySelectorAll('p, span'));
        if (labels[0]) labels[0].textContent = 'Пересказать чат';
        for (const extra of labels.slice(1)) extra.remove();
        return button;
    }

    function findChatMenu(dropdown) {
        const wrapper = dropdown?.parentElement;
        if (wrapper) {
            const directSibling = dropdown.nextElementSibling;
            if (directSibling?.querySelector('button[aria-label="View Saved Chats" i]')) return directSibling;
            const nested = Array.from(wrapper.children).find((child) => (
                child !== dropdown
                && child.querySelector?.('button[aria-label="View Saved Chats" i]')
            ));
            if (nested) return nested;
        }

        const menus = Array.from(document.querySelectorAll('button[aria-label="View Saved Chats" i]'))
            .map((button) => button.parentElement)
            .filter((menu) => (
                menu
                && menu.querySelector('button[aria-label="Start New Chat" i]')
                && menu.querySelector('button[aria-label="Remove Messages" i]')
            ));
        return menus.find((menu) => {
            const rect = menu.getBoundingClientRect();
            const style = getComputedStyle(menu);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        }) || menus[0] || null;
    }

    function normalizeCustomChatMenuOrder(menu) {
        const desired = CHAT_MENU_ITEM_ORDER
            .map((className) => menu.querySelector(`.${className}`))
            .filter(Boolean);
        if (!desired.length) return;
        const currentPrefix = Array.from(menu.children).slice(0, desired.length);
        if (desired.every((item, index) => currentPrefix[index] === item)) return;

        const firstNative = Array.from(menu.children).find((item) => (
            !CHAT_MENU_ITEM_ORDER.some((className) => item.classList.contains(className))
        )) || null;
        for (const item of desired) menu.insertBefore(item, firstNative);
    }

    function ensureChatMenuItem() {
        for (const dropdown of document.querySelectorAll(CHAT_DROPDOWN_SELECTOR)) {
            const menu = findChatMenu(dropdown);
            if (!menu) continue;

            let button = menu.querySelector(`.${MENU_ITEM_CLASS}`);
            if (!button) {
                const template = (
                    menu.querySelector(`.${GALLERY_MENU_ITEM_CLASS}`)
                    || menu.querySelector(`.${BOOKMARK_MENU_ITEM_CLASS}`)
                    || menu.querySelector('button[aria-label="View Saved Chats" i]')
                    || menu.querySelector('button')
                );
                if (!template) continue;
                button = cloneMenuButton(template);
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    dropdown.click();
                    window.setTimeout(() => {
                        openOverlay();
                        if (!running && !lastSummary) void generateSummary({ force: false });
                    }, 0);
                });
                menu.insertBefore(button, menu.firstElementChild);
            }

            normalizeCustomChatMenuOrder(menu);
        }
    }

    function scheduleEnsure() {
        if (ensureScheduled) return;
        ensureScheduled = true;
        requestAnimationFrame(runDomPass);
    }

    function nodeTouchesSummarySurface(node, includeDescendants = true) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
        if (node.closest?.(`#${OVERLAY_ID}`)) return false;
        const selector = `${CHAT_DROPDOWN_SELECTOR}, button[aria-label="View Saved Chats" i]`;
        return node.matches?.(selector) || (includeDescendants && Boolean(node.querySelector?.(selector)));
    }

    function handleRootMutations(records) {
        const relevant = records.some((record) => (
            nodeTouchesSummarySurface(record.target, false)
            || Array.from(record.addedNodes).some((node) => nodeTouchesSummarySurface(node, true))
            || Array.from(record.removedNodes).some((node) => nodeTouchesSummarySurface(node, true))
        ));
        if (relevant) scheduleEnsure();
    }

    function handleKeydown(event) {
        if (overlay && !overlay.hidden && event.key === 'Escape') {
            event.preventDefault();
            closeOverlay();
        }
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
            ensureContext();
            ensureOverlay();
            ensureChatMenuItem();

            if (!rootObserver) {
                rootObserver = new MutationObserver(handleRootMutations);
                rootObserver.observe(document.documentElement, { childList: true, subtree: true });
            }
            window.addEventListener('keydown', handleKeydown, true);
            resetRetry();
        } catch (error) {
            rootObserver?.disconnect();
            rootObserver = null;
            window.removeEventListener('keydown', handleKeydown, true);
            console.error('[Chat Summary] DOM-инициализация сорвалась, повторю автоматически.', error);
            scheduleRetry();
        }
    }

    function startDomFeatures() {
        runDomPass();
    }

    function cleanup() {
        runSerial += 1;
        running = false;
        rootObserver?.disconnect();
        rootObserver = null;
        ensureScheduled = false;
        resetRetry();
        window.removeEventListener('keydown', handleKeydown, true);
    }

    installApiCapture();
    installRouteChangeSignal();
    window.addEventListener('pagehide', cleanup);
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
