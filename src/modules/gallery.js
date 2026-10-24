// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
export default function init(runtime) {
    'use strict';

    const INSTANCE_KEY = '__spicyChatConversationGalleryV1';
    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (pageWindow[INSTANCE_KEY]) return;
    pageWindow[INSTANCE_KEY] = true;

    const MESSAGE_SELECTOR = 'div[id^="message-"]';
    const CHAT_DROPDOWN_SELECTOR = 'button[aria-label="chat-dropdown" i]';
    const BOOKMARK_MENU_ITEM_CLASS = 'tm-sc-open-message-bookmarks';
    const MENU_ITEM_CLASS = 'tm-sc-open-conversation-gallery';
    const STYLE_ID = 'tm-sc-conversation-gallery-style';
    const GALLERY_ID = 'tm-sc-conversation-gallery';
    const VIEWER_ID = 'tm-sc-conversation-gallery-viewer';
    const XHR_URL_KEY = '__tmScGalleryRequestUrl';
    const INTERNAL_RESPONSE_CONSUMER_FLAG = '__tmScConsumesJsonResponse';
    const ROUTE_CHANGE_EVENT = 'tm-sc-route-change';
    const HISTORY_PAGE_SIZE = 50;
    const MAX_HISTORY_PAGES = 1000;
    const API_WAIT_TIMEOUT = 8000;
    const CHAT_MENU_ITEM_ORDER = [
        'tm-sc-open-message-bookmarks',
        'tm-sc-open-conversation-gallery',
        'tm-sc-open-gpt-summary',
        'tm-sc-open-chat-branches',
    ];

    const sourceImages = new Map();
    const galleryImages = new Map();
    const messageMetaById = new Map();
    const capturedMessageIds = new Set();
    const capturedHeaders = new Map();
    let apiOrigin = '';
    const usefulHeaders = new Set([
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

    let activeContext = null;
    let totalApiRecordCount = null;
    let ensureScheduled = false;
    let renderScheduled = false;
    let rootObserver = null;
    let retryTimer = null;
    let retryDelay = 250;

    let galleryOverlay = null;
    let galleryGrid = null;
    let galleryEmpty = null;
    let galleryCount = null;
    let galleryStatus = null;
    let galleryMetrics = null;
    let galleryProgressBar = null;
    let galleryProgressTrack = null;
    let galleryRefreshButton = null;
    let galleryAnchor = null;
    const tileByKey = new Map();

    let viewerOverlay = null;
    let viewerImage = null;
    let viewerCounter = null;
    let viewerState = null;
    let viewerCurrentKey = null;
    let viewerLoader = null;
    let viewerLoadToken = 0;

    let scanToken = 0;
    let scanState = null;

    const moscowDateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });

    const icons = {
        gallery: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <path d="m21 15-5-5L5 21"></path>
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
        left: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="30" height="30"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="m15 18-6-6 6-6"></path>
            </svg>`,
        right: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="30" height="30"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="m9 18 6-6-6-6"></path>
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

        invalidateScan();
        closeViewer();
        closeGallery(false);
        activeContext = next;
        totalApiRecordCount = null;
        sourceImages.clear();
        galleryImages.clear();
        messageMetaById.clear();
        capturedMessageIds.clear();
        tileByKey.clear();
        if (galleryGrid) galleryGrid.replaceChildren();
        scheduleRender();
    }

    function normalizeTimestamp(value) {
        if (value === null || value === undefined || value === '') return 0;
        let timestamp = Number(value);
        if (!Number.isFinite(timestamp) && typeof value === 'string') timestamp = Date.parse(value);
        if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
        return timestamp < 100000000000 ? timestamp * 1000 : timestamp;
    }

    function normalizeMessageId(rawId) {
        if (typeof rawId !== 'string') return '';
        return rawId.trim().replace(/^message-/, '');
    }

    function normalizeConversationImageUrl(rawValue) {
        if (typeof rawValue !== 'string') return null;
        let raw = rawValue.trim().replace(/[),.;]+$/, '');
        if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return null;

        const mediaPathPattern = /(?:^|\/)(?:conversations|chat_user_images)\//i;

        if (raw.startsWith('//')) raw = `https:${raw}`;
        if (!/^https?:\/\//i.test(raw)) {
            const pathMatch = raw.match(mediaPathPattern);
            if (!pathMatch || pathMatch.index === undefined) return null;
            const mediaPath = raw.slice(pathMatch.index).replace(/^\/+/, '');
            raw = `https://cdn.nd-api.com/${mediaPath}`;
        }

        try {
            const url = new URL(raw);
            const trustedHost = (
                url.hostname === 'nd-api.com'
                || url.hostname.endsWith('.nd-api.com')
            );
            const isConversationImage = url.pathname.includes('/conversations/');
            const isUserImage = url.pathname.includes('/chat_user_images/');
            if (!trustedHost || (!isConversationImage && !isUserImage)) return null;

            const key = `${url.origin}${url.pathname}`;
            const full = new URL(url.href);
            for (const parameter of [
                'class',
                'width',
                'height',
                'aspect_ratio',
                'crop_gravity',
            ]) {
                full.searchParams.delete(parameter);
            }

            const preview = new URL(full.href);
            if (isConversationImage) preview.searchParams.set('class', 'image500x650');

            return {
                key,
                fullUrl: full.href,
                previewUrl: preview.href,
            };
        } catch (_error) {
            return null;
        }
    }

    function extractConversationImageUrls(value) {
        if (
            typeof value !== 'string'
            || (!value.includes('conversations/') && !value.includes('chat_user_images/'))
        ) return [];
        const found = new Map();
        const direct = normalizeConversationImageUrl(value);
        if (direct) found.set(direct.key, direct);

        const matches = value.match(
            /(?:https?:\/\/[^\s"'<>\\]+)?\/?(?:conversations|chat_user_images)\/[^\s"'<>\\]+/gi,
        ) || [];
        for (const match of matches) {
            const normalized = normalizeConversationImageUrl(match);
            if (normalized) found.set(normalized.key, normalized);
        }

        return Array.from(found.values());
    }

    function collectImageUrlsFromMessage(message) {
        const found = new Map();
        const visited = new WeakSet();

        const walk = (value, depth, keyHint = '') => {
            if (depth > 6 || value === null || value === undefined) return;

            if (typeof value === 'string') {
                if (/image|url|src|content/i.test(keyHint) || value.includes('conversations/')) {
                    for (const normalized of extractConversationImageUrls(value)) {
                        found.set(normalized.key, normalized);
                    }
                }
                return;
            }

            if (typeof value !== 'object' || visited.has(value)) return;
            visited.add(value);

            if (Array.isArray(value)) {
                for (const item of value) walk(item, depth + 1, keyHint);
                return;
            }

            for (const [key, child] of Object.entries(value)) {
                walk(child, depth + 1, key);
            }
        };

        walk(message, 0);
        return Array.from(found.values());
    }

    function formatMoscowDateTime(timestamp) {
        if (!timestamp) return '';
        try {
            return moscowDateTimeFormatter.format(new Date(timestamp));
        } catch (_error) {
            return '';
        }
    }

    function recordSourceImage({
        normalized,
        messageId = '',
        conversationId = '',
        createdAt = 0,
        isAlternative = false,
        domOrder = -1,
        source = 'api',
    }) {
        if (!normalized || !activeContext) return;
        if (conversationId && conversationId !== activeContext.conversationId) return;

        const now = Date.now();
        const existing = sourceImages.get(normalized.key);
        const entry = existing || {
            key: normalized.key,
            fullUrl: normalized.fullUrl,
            previewUrl: normalized.previewUrl,
            messageId,
            conversationId: conversationId || activeContext.conversationId,
            createdAt,
            isAlternative,
            domOrder,
            discoveredAt: now,
            sources: new Set(),
            messageIds: new Set(),
        };

        entry.fullUrl = normalized.fullUrl || entry.fullUrl;
        entry.previewUrl = normalized.previewUrl || entry.previewUrl;
        if (createdAt > entry.createdAt) entry.createdAt = createdAt;
        if (domOrder > entry.domOrder) entry.domOrder = domOrder;
        if (messageId) {
            entry.messageIds.add(messageId);
            if (!entry.messageId || createdAt >= entry.createdAt) entry.messageId = messageId;
        }
        entry.isAlternative = entry.isAlternative || isAlternative;
        entry.sources.add(source);
        sourceImages.set(entry.key, entry);

        if (galleryOverlay && !galleryOverlay.hidden) {
            galleryImages.set(entry.key, entry);
            scheduleRender();
        }
    }

    function captureApiPayload(payload) {
        ensureContext();
        if (!activeContext || !payload || typeof payload !== 'object') return;
        const envelope = [payload, payload.data, payload.conversation]
            .find((candidate) => candidate && Array.isArray(candidate.messages));
        if (!envelope) return;

        const envelopeConversationId = typeof envelope.conversation_id === 'string'
            ? envelope.conversation_id
            : activeContext.conversationId;
        if (envelopeConversationId !== activeContext.conversationId) return;
        totalApiRecordCount = Math.max(
            totalApiRecordCount || 0,
            Number(envelope.num_messages) || 0,
        );
        let changed = false;
        for (const value of envelope.messages) {
            if (!value || typeof value !== 'object') continue;
            const messageId = normalizeMessageId(value.id);
            const conversationId = typeof value.conversation_id === 'string'
                ? value.conversation_id
                : activeContext.conversationId;
            const isMessage = (
                messageId
                && conversationId === activeContext.conversationId
                && (value.role === 'bot' || value.role === 'user')
            );

            if (isMessage) {
                const createdAt = normalizeTimestamp(value.createdAt);
                const isAlternative = value.is_alternative === true;
                messageMetaById.set(messageId, {
                    createdAt,
                    isAlternative,
                    role: value.role,
                });
                capturedMessageIds.add(messageId);

                for (const normalized of collectImageUrlsFromMessage(value)) {
                    recordSourceImage({
                        normalized,
                        messageId,
                        conversationId,
                        createdAt,
                        isAlternative,
                        source: 'api',
                    });
                    changed = true;
                }
            }
        }
        if (changed || scanState) scheduleRender();
    }

    function readRequestUrl(input) {
        if (typeof input === 'string') return input;
        if (input && typeof input.url === 'string') return input.url;
        return '';
    }

    function isSpicyApiUrl(rawUrl) {
        try {
            const url = new URL(rawUrl, location.href);
            return url.hostname === 'nd-api.com' || url.hostname.endsWith('.nd-api.com');
        } catch (_error) {
            return false;
        }
    }

    function rememberHeader(name, value) {
        const normalizedName = String(name).toLowerCase();
        if (usefulHeaders.has(normalizedName)) capturedHeaders.set(normalizedName, String(value));
    }

    function rememberHeaders(headers) {
        if (!headers) return;
        try {
            const parsed = new pageWindow.Headers(headers);
            parsed.forEach((value, name) => rememberHeader(name, value));
        } catch (_error) {
            // Нестандартный объект заголовков просто пропускаем.
        }
    }

    function rememberApiAccess(rawUrl, ...headerSources) {
        if (!isSpicyApiUrl(rawUrl)) return;
        try {
            const url = new URL(rawUrl, location.href);
            if (url.hostname !== 'cdn.nd-api.com') apiOrigin = url.origin;
        } catch (_error) {
            return;
        }
        for (const headers of headerSources) rememberHeaders(headers);
    }

    function hasApiAccess() {
        return Boolean(typeof originalFetch === 'function' && apiOrigin && capturedHeaders.get('authorization'));
    }

    function getRequestHeaders() {
        const headers = Object.fromEntries(capturedHeaders);
        headers.accept = 'application/json, text/plain, */*';
        return headers;
    }

    const originalFetch = pageWindow.fetch;
    if (typeof originalFetch === 'function') {
        pageWindow.fetch = function (input, options = {}) {
            const requestUrl = readRequestUrl(input);
            if (isSpicyApiUrl(requestUrl)) {
                rememberApiAccess(requestUrl, input?.headers, options?.headers);
            }

            return Reflect.apply(originalFetch, this, arguments);
        };
    }

    try {
        const xhrPrototype = pageWindow.XMLHttpRequest?.prototype;
        if (xhrPrototype) {
            const originalOpen = xhrPrototype.open;
            const originalSetRequestHeader = xhrPrototype.setRequestHeader;
            const originalSend = xhrPrototype.send;

            xhrPrototype.open = function (...args) {
                this[XHR_URL_KEY] = readRequestUrl(args[1]);
                if (isSpicyApiUrl(this[XHR_URL_KEY])) rememberApiAccess(this[XHR_URL_KEY]);
                return Reflect.apply(originalOpen, this, args);
            };

            xhrPrototype.setRequestHeader = function (name, value) {
                if (isSpicyApiUrl(this[XHR_URL_KEY])) {
                    rememberApiAccess(this[XHR_URL_KEY], { [name]: value });
                }
                return Reflect.apply(originalSetRequestHeader, this, arguments);
            };

            xhrPrototype.send = function (...args) {
                return Reflect.apply(originalSend, this, args);
            };
        }
    } catch (error) {
        console.debug('[Conversation Gallery] Не удалось подключиться к XHR.', error);
    }

    async function fetchHistoryPage(lastId = '') {
        if (!activeContext || !hasApiAccess()) {
            const error = new Error('Не удалось получить авторизацию SpicyChat.');
            error.code = 'NO_API_SESSION';
            throw error;
        }
        const query = new URLSearchParams({ limit: String(HISTORY_PAGE_SIZE) });
        if (lastId) query.set('last_id', lastId);
        const path = (
            `/characters/${encodeURIComponent(activeContext.characterId)}/messages/`
            + `${encodeURIComponent(activeContext.conversationId)}?${query}`
        );
        const endpoint = new URL(path, `${apiOrigin}/`).toString();
        const response = await Reflect.apply(originalFetch, pageWindow, [endpoint, {
            method: 'GET',
            headers: getRequestHeaders(),
            mode: 'cors',
            credentials: 'omit',
            [INTERNAL_RESPONSE_CONSUMER_FLAG]: true,
        }]);
        if (!response?.ok) {
            const details = await response?.text?.().catch(() => '');
            const suffix = String(details || '').replace(/\s+/g, ' ').trim().slice(0, 180);
            const error = new Error(
                `SpicyChat вернул HTTP ${response?.status || 0}${suffix ? `: ${suffix}` : ''}.`,
            );
            error.status = response?.status || 0;
            throw error;
        }
        const payload = await response.json();
        captureApiPayload(payload);
        return payload;
    }

    async function waitForApiAccess(state) {
        const startedAt = Date.now();
        while (!hasApiAccess() && Date.now() - startedAt < API_WAIT_TIMEOUT) {
            if (state.token !== scanToken) throw new Error('Операция отменена.');
            state.status = 'Жду авторизацию SpicyChat…';
            scheduleRender();
            await new Promise((resolve) => pageWindow.setTimeout(resolve, 160));
        }
        if (!hasApiAccess()) {
            const error = new Error('Не удалось поймать авторизацию SpicyChat за 8 секунд.');
            error.code = 'NO_API_SESSION';
            throw error;
        }
    }

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${GALLERY_ID}[hidden], #${VIEWER_ID}[hidden] { display: none !important; }

            #${GALLERY_ID} {
                position: fixed !important;
                inset: 0 !important;
                z-index: 10100 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 24px !important;
                background: rgba(0, 0, 0, 0.58) !important;
                backdrop-filter: blur(3px) !important;
                font-family: inherit !important;
            }

            .tm-sc-gallery-shell {
                box-sizing: border-box !important;
                display: flex !important;
                flex-direction: column !important;
                width: min(1180px, calc(100vw - 48px)) !important;
                height: min(840px, calc(100vh - 48px)) !important;
                min-height: 360px !important;
                overflow: hidden !important;
                color: #18181b !important;
                background: #ffffff !important;
                border: 1px solid rgba(17, 24, 39, 0.14) !important;
                border-radius: 18px !important;
                box-shadow: 0 28px 90px rgba(0, 0, 0, 0.48) !important;
            }

            .dark .tm-sc-gallery-shell {
                color: #f4f4f5 !important;
                background: #202023 !important;
                border-color: rgba(255, 255, 255, 0.13) !important;
            }

            .tm-sc-gallery-header {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 16px !important;
                padding: 16px 18px 13px !important;
                border-bottom: 1px solid rgba(113, 113, 122, 0.17) !important;
            }

            .tm-sc-gallery-heading {
                display: flex !important;
                align-items: baseline !important;
                gap: 9px !important;
                min-width: 0 !important;
            }

            .tm-sc-gallery-title {
                margin: 0 !important;
                color: inherit !important;
                font-size: 20px !important;
                line-height: 1.25 !important;
                font-weight: 700 !important;
            }

            .tm-sc-gallery-count {
                color: #71717a !important;
                font-size: 13px !important;
                font-variant-numeric: tabular-nums !important;
            }

            .dark .tm-sc-gallery-count { color: #a1a1aa !important; }

            .tm-sc-gallery-actions {
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
            }

            .tm-sc-gallery-refresh,
            .tm-sc-gallery-close {
                appearance: none !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 7px !important;
                height: 38px !important;
                color: inherit !important;
                background: rgba(113, 113, 122, 0.11) !important;
                border: 0 !important;
                border-radius: 10px !important;
                cursor: pointer !important;
                font-family: inherit !important;
                font-size: 13px !important;
                font-weight: 620 !important;
            }

            .tm-sc-gallery-refresh { padding: 0 12px !important; }
            .tm-sc-gallery-close { width: 38px !important; padding: 0 !important; }
            .tm-sc-gallery-refresh:hover, .tm-sc-gallery-close:hover {
                background: rgba(124, 58, 237, 0.17) !important;
            }

            .tm-sc-gallery-progress-area {
                padding: 11px 18px 12px !important;
                border-bottom: 1px solid rgba(113, 113, 122, 0.14) !important;
            }

            .tm-sc-gallery-progress-copy {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 12px !important;
                margin-bottom: 8px !important;
                color: #71717a !important;
                font-size: 12px !important;
                line-height: 1.3 !important;
            }

            .dark .tm-sc-gallery-progress-copy { color: #b4b4bd !important; }
            .tm-sc-gallery-status { overflow-wrap: anywhere !important; }
            .tm-sc-gallery-metrics {
                flex: 0 0 auto !important;
                font-variant-numeric: tabular-nums !important;
                white-space: nowrap !important;
            }

            .tm-sc-gallery-progress-track {
                position: relative !important;
                height: 6px !important;
                overflow: hidden !important;
                background: rgba(113, 113, 122, 0.18) !important;
                border-radius: 9999px !important;
            }

            .tm-sc-gallery-progress-track::after {
                content: "" !important;
                position: absolute !important;
                inset: 0 !important;
                z-index: 2 !important;
                pointer-events: none !important;
                background: repeating-linear-gradient(
                    to right,
                    transparent 0,
                    transparent calc(10% - 1px),
                    rgba(255, 255, 255, 0.34) calc(10% - 1px),
                    rgba(255, 255, 255, 0.34) 10%
                ) !important;
            }

            .tm-sc-gallery-progress-bar {
                position: absolute !important;
                inset: 0 auto 0 0 !important;
                z-index: 1 !important;
                width: 0 !important;
                background: linear-gradient(90deg, #7c3aed, #a78bfa) !important;
                border-radius: inherit !important;
                transition: width 260ms ease !important;
            }

            .tm-sc-gallery-progress-track.is-indeterminate .tm-sc-gallery-progress-bar {
                left: -38% !important;
                width: 38% !important;
                animation: tm-sc-gallery-progress 1.1s ease-in-out infinite !important;
            }

            .tm-sc-gallery-progress-track.is-complete .tm-sc-gallery-progress-bar {
                width: 100% !important;
                background: #22c55e !important;
            }

            .tm-sc-gallery-content {
                position: relative !important;
                flex: 1 1 auto !important;
                min-height: 0 !important;
                overflow: auto !important;
                overscroll-behavior: contain !important;
                padding: 14px !important;
            }

            .tm-sc-gallery-grid {
                display: grid !important;
                grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)) !important;
                gap: 11px !important;
                align-items: start !important;
            }

            .tm-sc-gallery-tile {
                appearance: none !important;
                position: relative !important;
                box-sizing: border-box !important;
                display: block !important;
                width: 100% !important;
                padding: 0 !important;
                overflow: hidden !important;
                background: #e4e4e7 !important;
                border: 1px solid rgba(113, 113, 122, 0.2) !important;
                border-radius: 11px !important;
                cursor: zoom-in !important;
                aspect-ratio: 500 / 650 !important;
                transition: transform 130ms ease, border-color 130ms ease, box-shadow 130ms ease !important;
            }

            .dark .tm-sc-gallery-tile { background: #303036 !important; }
            .tm-sc-gallery-tile:hover {
                z-index: 1 !important;
                transform: translateY(-2px) !important;
                border-color: rgba(139, 92, 246, 0.72) !important;
                box-shadow: 0 9px 24px rgba(0, 0, 0, 0.24) !important;
            }

            .tm-sc-gallery-tile img {
                display: block !important;
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
                background: inherit !important;
            }

            .tm-sc-gallery-tile-badge {
                position: absolute !important;
                right: 7px !important;
                bottom: 7px !important;
                max-width: calc(100% - 14px) !important;
                overflow: hidden !important;
                padding: 4px 6px !important;
                color: #ffffff !important;
                background: rgba(17, 24, 39, 0.72) !important;
                border-radius: 6px !important;
                font-size: 10.5px !important;
                line-height: 1.1 !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
                pointer-events: none !important;
            }

            .tm-sc-gallery-empty {
                position: absolute !important;
                inset: 0 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 30px !important;
                color: #71717a !important;
                font-size: 14px !important;
                text-align: center !important;
                pointer-events: none !important;
            }

            .tm-sc-gallery-empty[hidden] { display: none !important; }

            .dark .tm-sc-gallery-empty { color: #a1a1aa !important; }

            #${VIEWER_ID} {
                position: fixed !important;
                inset: 0 !important;
                z-index: 10120 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 24px 84px !important;
                background: rgba(0, 0, 0, 0.91) !important;
                backdrop-filter: blur(5px) !important;
            }

            .tm-sc-gallery-viewer-image {
                display: block !important;
                max-width: min(1200px, calc(100vw - 170px)) !important;
                max-height: calc(100vh - 70px) !important;
                object-fit: contain !important;
                border-radius: 8px !important;
                box-shadow: 0 22px 76px rgba(0, 0, 0, 0.62) !important;
                opacity: 1 !important;
                transition: opacity 150ms ease !important;
            }

            #${VIEWER_ID}.is-loading .tm-sc-gallery-viewer-image,
            #${VIEWER_ID}.is-error .tm-sc-gallery-viewer-image { opacity: 0 !important; }

            .tm-sc-gallery-viewer-state {
                position: fixed !important;
                left: 50% !important;
                top: 50% !important;
                display: none !important;
                transform: translate(-50%, -50%) !important;
                padding: 9px 12px !important;
                color: #ffffff !important;
                background: rgba(39, 39, 42, 0.82) !important;
                border: 1px solid rgba(255, 255, 255, 0.16) !important;
                border-radius: 9px !important;
                font-size: 13px !important;
                pointer-events: none !important;
            }

            #${VIEWER_ID}.is-loading .tm-sc-gallery-viewer-state,
            #${VIEWER_ID}.is-error .tm-sc-gallery-viewer-state { display: block !important; }

            .tm-sc-gallery-viewer-close,
            .tm-sc-gallery-viewer-nav {
                appearance: none !important;
                position: fixed !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: #ffffff !important;
                background: rgba(39, 39, 42, 0.72) !important;
                border: 1px solid rgba(255, 255, 255, 0.18) !important;
                cursor: pointer !important;
                backdrop-filter: blur(4px) !important;
            }

            .tm-sc-gallery-viewer-close {
                top: 18px !important;
                right: 18px !important;
                width: 42px !important;
                height: 42px !important;
                border-radius: 12px !important;
            }

            .tm-sc-gallery-viewer-nav {
                top: 50% !important;
                width: 52px !important;
                height: 72px !important;
                transform: translateY(-50%) !important;
                border-radius: 14px !important;
            }

            .tm-sc-gallery-viewer-nav.is-prev { left: 18px !important; }
            .tm-sc-gallery-viewer-nav.is-next { right: 18px !important; }
            .tm-sc-gallery-viewer-nav:hover,
            .tm-sc-gallery-viewer-close:hover { background: rgba(124, 58, 237, 0.78) !important; }
            .tm-sc-gallery-viewer-nav:disabled { opacity: 0.28 !important; cursor: default !important; }

            .tm-sc-gallery-viewer-counter {
                position: fixed !important;
                left: 50% !important;
                bottom: 17px !important;
                transform: translateX(-50%) !important;
                padding: 6px 10px !important;
                color: #ffffff !important;
                background: rgba(17, 24, 39, 0.76) !important;
                border-radius: 8px !important;
                font-size: 12px !important;
                font-variant-numeric: tabular-nums !important;
            }

            @keyframes tm-sc-gallery-progress {
                from { transform: translateX(0); }
                to { transform: translateX(365%); }
            }
        `;
        document.head.appendChild(style);
    }

    function cloneMenuButton(template) {
        const button = runtime.dom.cloneMenuButton(template);
        button.classList.remove(BOOKMARK_MENU_ITEM_CLASS, MENU_ITEM_CLASS);
        button.classList.add(MENU_ITEM_CLASS);
        button.removeAttribute('target');
        button.disabled = false;
        button.type = 'button';
        button.setAttribute('aria-label', 'Галерея');

        const oldIcon = button.querySelector('svg');
        if (oldIcon) oldIcon.outerHTML = icons.gallery;
        else button.insertAdjacentHTML('afterbegin', icons.gallery);

        const labels = Array.from(button.querySelectorAll('p, span'));
        if (labels[0]) labels[0].textContent = 'Галерея';
        for (const extra of labels.slice(1)) extra.remove();
        return button;
    }

    function findChatMenu(dropdown) {
        return runtime.dom.chatMenu(dropdown);
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
                    menu.querySelector(`.${BOOKMARK_MENU_ITEM_CLASS}`)
                    || menu.querySelector('button[aria-label="View Saved Chats" i]')
                    || menu.querySelector('button, [role="menuitem"]')
                );
                if (!template) continue;

                button = cloneMenuButton(template);
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    galleryAnchor = dropdown;
                    dropdown.click();
                    window.setTimeout(() => openGallery(dropdown), 0);
                });
                menu.insertBefore(button, menu.firstElementChild);
            }

            normalizeCustomChatMenuOrder(menu);
        }
    }

    function ensureGallery() {
        if (galleryOverlay?.isConnected) return galleryOverlay;
        galleryOverlay = document.createElement('div');
        galleryOverlay.id = GALLERY_ID;
        galleryOverlay.hidden = true;
        galleryOverlay.innerHTML = `
            <section class="tm-sc-gallery-shell" role="dialog" aria-modal="true" aria-labelledby="tm-sc-gallery-title">
                <header class="tm-sc-gallery-header">
                    <div class="tm-sc-gallery-heading">
                        <h2 id="tm-sc-gallery-title" class="tm-sc-gallery-title">Галерея</h2>
                        <span class="tm-sc-gallery-count"></span>
                    </div>
                    <div class="tm-sc-gallery-actions">
                        <button class="tm-sc-gallery-refresh" type="button">${icons.refresh}<span>Обновить</span></button>
                        <button class="tm-sc-gallery-close" type="button" aria-label="Закрыть">${icons.close}</button>
                    </div>
                </header>
                <div class="tm-sc-gallery-progress-area">
                    <div class="tm-sc-gallery-progress-copy">
                        <span class="tm-sc-gallery-status" aria-live="polite">Готово к сканированию</span>
                        <span class="tm-sc-gallery-metrics"></span>
                    </div>
                    <div class="tm-sc-gallery-progress-track" role="progressbar" aria-label="Загрузка истории">
                        <div class="tm-sc-gallery-progress-bar"></div>
                    </div>
                </div>
                <div class="tm-sc-gallery-content">
                    <div class="tm-sc-gallery-grid"></div>
                    <div class="tm-sc-gallery-empty">Пока изображений нет</div>
                </div>
            </section>
        `;

        galleryGrid = galleryOverlay.querySelector('.tm-sc-gallery-grid');
        galleryEmpty = galleryOverlay.querySelector('.tm-sc-gallery-empty');
        galleryCount = galleryOverlay.querySelector('.tm-sc-gallery-count');
        galleryStatus = galleryOverlay.querySelector('.tm-sc-gallery-status');
        galleryMetrics = galleryOverlay.querySelector('.tm-sc-gallery-metrics');
        galleryProgressBar = galleryOverlay.querySelector('.tm-sc-gallery-progress-bar');
        galleryProgressTrack = galleryOverlay.querySelector('.tm-sc-gallery-progress-track');
        galleryRefreshButton = galleryOverlay.querySelector('.tm-sc-gallery-refresh');

        galleryOverlay.querySelector('.tm-sc-gallery-close').addEventListener('click', () => closeGallery());
        galleryRefreshButton.addEventListener('click', () => void startGalleryScan({ reset: true }));
        galleryOverlay.addEventListener('pointerdown', (event) => {
            if (event.target === galleryOverlay) closeGallery();
        });
        document.body.appendChild(galleryOverlay);
        return galleryOverlay;
    }

    function ensureViewer() {
        if (viewerOverlay?.isConnected) return viewerOverlay;
        viewerOverlay = document.createElement('div');
        viewerOverlay.id = VIEWER_ID;
        viewerOverlay.hidden = true;
        viewerOverlay.innerHTML = `
            <button class="tm-sc-gallery-viewer-close" type="button" aria-label="Закрыть">${icons.close}</button>
            <button class="tm-sc-gallery-viewer-nav is-prev" type="button" aria-label="Предыдущее изображение">${icons.left}</button>
            <img class="tm-sc-gallery-viewer-image" alt="Изображение из диалога">
            <button class="tm-sc-gallery-viewer-nav is-next" type="button" aria-label="Следующее изображение">${icons.right}</button>
            <div class="tm-sc-gallery-viewer-state" aria-live="polite">Загрузка изображения…</div>
            <div class="tm-sc-gallery-viewer-counter"></div>
        `;

        viewerImage = viewerOverlay.querySelector('.tm-sc-gallery-viewer-image');
        viewerCounter = viewerOverlay.querySelector('.tm-sc-gallery-viewer-counter');
        viewerState = viewerOverlay.querySelector('.tm-sc-gallery-viewer-state');
        viewerOverlay.querySelector('.tm-sc-gallery-viewer-close').addEventListener('click', closeViewer);
        viewerOverlay.querySelector('.is-prev').addEventListener('click', () => navigateViewer(-1));
        viewerOverlay.querySelector('.is-next').addEventListener('click', () => navigateViewer(1));
        viewerOverlay.addEventListener('pointerdown', (event) => {
            if (event.target === viewerOverlay) closeViewer();
        });
        document.body.appendChild(viewerOverlay);
        return viewerOverlay;
    }

    function getSortedGalleryEntries() {
        return Array.from(galleryImages.values()).sort((a, b) => (
            (b.createdAt - a.createdAt)
            || (b.domOrder - a.domOrder)
            || (b.discoveredAt - a.discoveredAt)
            || a.key.localeCompare(b.key)
        ));
    }

    function createTile(entry) {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'tm-sc-gallery-tile';
        tile.dataset.imageKey = entry.key;
        tile.innerHTML = `
            <img loading="lazy" decoding="async" alt="Изображение из диалога">
            <span class="tm-sc-gallery-tile-badge"></span>
        `;
        tile.addEventListener('click', () => openViewer(tile.dataset.imageKey));
        return tile;
    }

    function setTextIfChanged(element, text) {
        if (element && element.textContent !== text) element.textContent = text;
    }

    function renderGallery() {
        renderScheduled = false;
        if (!galleryOverlay?.isConnected) return;

        const sorted = getSortedGalleryEntries();
        const desiredKeys = new Set(sorted.map((entry) => entry.key));
        for (const [key, tile] of tileByKey) {
            if (desiredKeys.has(key)) continue;
            tile.remove();
            tileByKey.delete(key);
        }

        for (const [index, entry] of sorted.entries()) {
            let tile = tileByKey.get(entry.key);
            if (!tile) {
                tile = createTile(entry);
                tileByKey.set(entry.key, tile);
            }

            const image = tile.querySelector('img');
            const badge = tile.querySelector('.tm-sc-gallery-tile-badge');
            if (image.getAttribute('src') !== entry.previewUrl) image.src = entry.previewUrl;
            const dateLabel = formatMoscowDateTime(entry.createdAt);
            const badgeLabel = dateLabel || (entry.isAlternative ? 'Вариант ответа' : 'Изображение');
            const title = dateLabel ? `${dateLabel} по Москве` : 'Открыть изображение';
            setTextIfChanged(badge, badgeLabel);
            if (tile.title !== title) tile.title = title;

            const currentTile = galleryGrid.children[index] || null;
            if (currentTile !== tile) galleryGrid.insertBefore(tile, currentTile);
        }

        setTextIfChanged(galleryCount, sorted.length ? String(sorted.length) : '');
        galleryEmpty.hidden = sorted.length > 0;
        if (!sorted.length) {
            setTextIfChanged(galleryEmpty, scanState?.running
                ? 'Ищу изображения в истории…'
                : 'В этом диалоге изображения пока не найдены');
        }

        renderScanProgress();
        if (viewerOverlay && !viewerOverlay.hidden) refreshViewer();
    }

    function scheduleRender() {
        if (renderScheduled) return;
        renderScheduled = true;
        requestAnimationFrame(renderGallery);
    }

    function hydrateGalleryFromSources() {
        for (const [key, entry] of sourceImages) galleryImages.set(key, entry);
        scheduleRender();
    }

    function getDomMessageTimestamp(messageId, message) {
        const captured = messageMetaById.get(messageId)?.createdAt || 0;
        if (captured) return captured;
        const time = message.querySelector('time.tm-sc-message-sent-at[datetime]');
        return time ? normalizeTimestamp(time.dateTime) : 0;
    }

    function scanDomImages() {
        ensureContext();
        if (!activeContext) return;
        const messages = Array.from(document.querySelectorAll(MESSAGE_SELECTOR));

        messages.forEach((message, domOrder) => {
            const messageId = normalizeMessageId(message.id);
            if (!messageId) return;
            const meta = messageMetaById.get(messageId);
            const createdAt = getDomMessageTimestamp(messageId, message);

            for (const image of message.querySelectorAll('img')) {
                const normalized = normalizeConversationImageUrl(image.currentSrc || image.src);
                if (!normalized) continue;
                recordSourceImage({
                    normalized,
                    messageId,
                    conversationId: activeContext.conversationId,
                    createdAt,
                    isAlternative: meta?.isAlternative === true,
                    domOrder,
                    source: 'dom',
                });
            }
        });

        scheduleRender();
    }

    function openGallery(anchor) {
        ensureContext();
        if (!activeContext) return;
        ensureGallery();
        ensureViewer();
        galleryAnchor = anchor || galleryAnchor;
        galleryOverlay.hidden = false;
        hydrateGalleryFromSources();
        scanDomImages();
        void startGalleryScan({ reset: false });
    }

    function closeGallery(cancelLoading = true) {
        if (cancelLoading) invalidateScan();
        closeViewer();
        if (galleryOverlay) galleryOverlay.hidden = true;
    }

    function openViewer(key) {
        if (!galleryImages.has(key)) return;
        ensureViewer();
        viewerCurrentKey = key;
        viewerOverlay.hidden = false;
        refreshViewer();
    }

    function closeViewer() {
        viewerLoadToken += 1;
        if (viewerLoader) {
            viewerLoader.onload = null;
            viewerLoader.onerror = null;
            viewerLoader = null;
        }
        viewerCurrentKey = null;
        if (viewerImage) {
            viewerImage.removeAttribute('src');
            delete viewerImage.dataset.imageKey;
            delete viewerImage.dataset.targetUrl;
            delete viewerImage.dataset.fallback;
        }
        if (viewerOverlay) {
            viewerOverlay.classList.remove('is-loading', 'is-error');
            viewerOverlay.hidden = true;
        }
    }

    function loadViewerEntry(entry) {
        const token = ++viewerLoadToken;
        if (viewerLoader) {
            viewerLoader.onload = null;
            viewerLoader.onerror = null;
        }

        viewerImage.removeAttribute('src');
        viewerImage.dataset.imageKey = entry.key;
        viewerImage.dataset.targetUrl = entry.fullUrl;
        viewerImage.dataset.fallback = 'false';
        viewerOverlay.classList.remove('is-error');
        viewerOverlay.classList.add('is-loading');
        viewerState.textContent = 'Загрузка изображения…';

        const attempt = (url, isFallback) => {
            if (token !== viewerLoadToken || viewerCurrentKey !== entry.key) return;
            const loader = new pageWindow.Image();
            viewerLoader = loader;
            loader.onload = () => {
                if (token !== viewerLoadToken || viewerCurrentKey !== entry.key) return;
                viewerLoader = null;
                viewerImage.dataset.fallback = String(isFallback);
                viewerImage.src = url;
                viewerOverlay.classList.remove('is-loading', 'is-error');
            };
            loader.onerror = () => {
                if (token !== viewerLoadToken || viewerCurrentKey !== entry.key) return;
                viewerLoader = null;
                if (!isFallback && entry.previewUrl && entry.previewUrl !== url) {
                    attempt(entry.previewUrl, true);
                    return;
                }
                viewerOverlay.classList.remove('is-loading');
                viewerOverlay.classList.add('is-error');
                viewerState.textContent = 'Не удалось загрузить изображение';
            };
            loader.src = url;
        };

        attempt(entry.fullUrl, false);
    }

    function refreshViewer() {
        if (!viewerOverlay || viewerOverlay.hidden || !viewerCurrentKey) return;
        const sorted = getSortedGalleryEntries();
        const index = sorted.findIndex((entry) => entry.key === viewerCurrentKey);
        if (index < 0) {
            closeViewer();
            return;
        }

        const entry = sorted[index];
        const currentRequestMatches = (
            viewerImage.dataset.imageKey === entry.key
            && viewerImage.dataset.targetUrl === entry.fullUrl
        );
        if (!currentRequestMatches) loadViewerEntry(entry);
        viewerCounter.textContent = `${index + 1} / ${sorted.length}`;
        viewerOverlay.querySelector('.is-prev').disabled = sorted.length < 2;
        viewerOverlay.querySelector('.is-next').disabled = sorted.length < 2;
    }

    function navigateViewer(direction) {
        const sorted = getSortedGalleryEntries();
        if (sorted.length < 2 || !viewerCurrentKey) return;
        const currentIndex = sorted.findIndex((entry) => entry.key === viewerCurrentKey);
        if (currentIndex < 0) return;
        const nextIndex = (currentIndex + direction + sorted.length) % sorted.length;
        viewerCurrentKey = sorted[nextIndex].key;
        refreshViewer();
    }

    function getLoadedMessageIds() {
        return Array.from(document.querySelectorAll(MESSAGE_SELECTOR), (message) => message.id).filter(Boolean);
    }

    function invalidateScan() {
        scanToken += 1;
        const previous = scanState;
        if (previous) previous.running = false;
        scanState = null;
        scheduleRender();
        return scanToken;
    }

    function getProgressPercent() {
        if (!totalApiRecordCount || totalApiRecordCount <= 0) return null;
        const rawPercent = Math.min(100, (capturedMessageIds.size / totalApiRecordCount) * 100);
        return rawPercent >= 100 ? 100 : Math.floor(rawPercent / 10) * 10;
    }

    function renderScanProgress() {
        if (!galleryProgressTrack) return;
        const percent = getProgressPercent();
        const state = scanState;
        const running = state?.running === true;
        const complete = state?.statusType === 'complete';

        galleryProgressTrack.classList.toggle('is-indeterminate', running && percent === null);
        galleryProgressTrack.classList.toggle('is-complete', complete);
        if (complete) galleryProgressBar.style.setProperty('width', '100%', 'important');
        else if (percent !== null) galleryProgressBar.style.setProperty('width', `${percent}%`, 'important');
        else if (!running) galleryProgressBar.style.setProperty('width', '0%', 'important');
        else galleryProgressBar.style.removeProperty('width');

        galleryProgressTrack.setAttribute('aria-valuemin', '0');
        galleryProgressTrack.setAttribute('aria-valuemax', '100');
        if (percent !== null) galleryProgressTrack.setAttribute('aria-valuenow', String(complete ? 100 : percent));
        else galleryProgressTrack.removeAttribute('aria-valuenow');

        setTextIfChanged(galleryStatus, state?.status || 'Готово к сканированию');
        const loadedMessages = Math.max(
            new Set(getLoadedMessageIds()).size,
            capturedMessageIds.size,
        );
        const displayedPercent = complete ? 100 : percent;
        const progressLabel = displayedPercent === null ? '' : ` · прогресс: ${displayedPercent}%`;
        const batches = state?.batches || 0;
        setTextIfChanged(galleryMetrics, (
            `Изображений: ${galleryImages.size} · `
            + `сообщений загружено: ${loadedMessages}`
            + progressLabel
            + ' · '
            + `пачек: ${batches}`
        ));
    }

    async function startGalleryScan({ reset }) {
        ensureContext();
        if (!activeContext) return;
        ensureGallery();
        const token = invalidateScan();
        const state = {
            token,
            running: true,
            statusType: 'loading',
            status: reset ? 'Очищаю галерею и запускаю новый скан…' : 'Проверяю загруженные сообщения…',
            batches: 0,
        };
        scanState = state;

        if (reset) {
            closeViewer();
            galleryImages.clear();
            tileByKey.clear();
            galleryGrid?.replaceChildren();
            renderGallery();
            await new Promise((resolve) => requestAnimationFrame(resolve));
            if (token !== scanToken) return;
        }

        hydrateGalleryFromSources();
        scanDomImages();
        scheduleRender();

        try {
            await waitForApiAccess(state);
            if (state.token !== scanToken) return;
            let lastId = '';
            for (let page = 0; page < MAX_HISTORY_PAGES && state.token === scanToken; page += 1) {
                state.status = `Загружаю пачку ${page + 1}…`;
                scheduleRender();

                const beforeCount = capturedMessageIds.size;
                const payload = await fetchHistoryPage(lastId);
                if (state.token !== scanToken) return;
                const batch = Array.isArray(payload?.messages) ? payload.messages : [];
                const added = Math.max(0, capturedMessageIds.size - beforeCount);
                state.batches = page + 1;
                hydrateGalleryFromSources();
                state.status = 'Пачка загружена. Галерея обновлена';
                scheduleRender();

                if (batch.length < HISTORY_PAGE_SIZE || !added) break;
                const nextLastId = normalizeMessageId(batch.at(-1)?.id);
                if (!nextLastId || nextLastId === lastId) break;
                lastId = nextLastId;
                await new Promise((resolve) => pageWindow.setTimeout(resolve, 0));
            }

            if (state.token !== scanToken) return;
            state.running = false;
            state.statusType = 'complete';
            state.status = 'Вся доступная история проверена';
            scheduleRender();
        } catch (error) {
            console.error('[Conversation Gallery] Ошибка сканирования истории.', error);
            if (state.token === scanToken) {
                state.running = false;
                state.statusType = 'paused';
                state.status = error?.code === 'NO_API_SESSION'
                    ? 'Не удалось получить авторизацию SpicyChat. Обнови страницу и повтори'
                    : `Ошибка сканирования: ${error?.message || 'неизвестная ошибка'}`;
                scheduleRender();
            }
        }
    }

    function isOwnGalleryMutation(target) {
        const element = target?.nodeType === 1 ? target : target?.parentElement;
        return Boolean(element?.closest?.(`#${GALLERY_ID}, #${VIEWER_ID}`));
    }

    let visibleMessagesDirty = false;

    function scheduleEnsure(scanVisibleMessages = false) {
        visibleMessagesDirty ||= scanVisibleMessages;
        if (ensureScheduled) return;
        ensureScheduled = true;
        requestAnimationFrame(() => {
            const shouldScan = visibleMessagesDirty;
            visibleMessagesDirty = false;
            runDomPass(shouldScan);
        });
    }

    function nodeTouchesGallerySurface(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return { relevant: false, messages: false };
        if (node.closest?.(`#${GALLERY_ID}, #${VIEWER_ID}`)) return { relevant: false, messages: false };

        const menuSelector = `${CHAT_DROPDOWN_SELECTOR}, button[aria-label="View Saved Chats" i]`;
        const isMessageImage = Boolean(node.closest?.(MESSAGE_SELECTOR)) && (
            node.matches?.('img') || Boolean(node.querySelector?.('img'))
        );
        const messages = Boolean(
            node.matches?.(MESSAGE_SELECTOR)
            || isMessageImage
            || node.querySelector?.(MESSAGE_SELECTOR)
        );
        const menu = Boolean(node.matches?.(menuSelector) || node.querySelector?.(menuSelector));
        return { relevant: messages || menu, messages };
    }

    function handleRootMutations(records) {
        let relevant = false;
        let messages = false;
        for (const record of records) {
            if (isOwnGalleryMutation(record.target)) continue;
            const nodes = [record.target, ...record.addedNodes, ...record.removedNodes];
            for (const node of nodes) {
                const result = nodeTouchesGallerySurface(node);
                relevant ||= result.relevant;
                messages ||= result.messages;
                if (relevant && messages) break;
            }
            if (relevant && messages) break;
        }
        if (relevant) scheduleEnsure(messages);
    }

    function handleKeydown(event) {
        if (viewerOverlay && !viewerOverlay.hidden) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeViewer();
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                navigateViewer(-1);
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                navigateViewer(1);
            }
            return;
        }

        if (galleryOverlay && !galleryOverlay.hidden && event.key === 'Escape') {
            event.preventDefault();
            closeGallery();
        }
    }

    function scheduleRetry() {
        if (retryTimer) return;
        const delay = retryDelay;
        retryDelay = Math.min(8000, retryDelay * 2);
        retryTimer = window.setTimeout(() => {
            retryTimer = null;
            runDomPass(false);
        }, delay);
    }

    function resetRetry() {
        if (retryTimer) window.clearTimeout(retryTimer);
        retryTimer = null;
        retryDelay = 250;
    }

    function runDomPass(scanVisibleMessages = false) {
        ensureScheduled = false;
        if (!document.documentElement || !document.head || !document.body) return;

        try {
            addStyles();
            ensureContext();
            ensureGallery();
            ensureViewer();
            ensureChatMenuItem();
            if (scanVisibleMessages && galleryOverlay && !galleryOverlay.hidden) scanDomImages();

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
            console.error('[Conversation Gallery] DOM-инициализация сорвалась, повторю автоматически.', error);
            scheduleRetry();
        }
    }

    function startDomFeatures() {
        runDomPass();
    }

    function cleanup() {
        invalidateScan();
        rootObserver?.disconnect();
        rootObserver = null;
        ensureScheduled = false;
        visibleMessagesDirty = false;
        resetRetry();
        window.removeEventListener('keydown', handleKeydown, true);
    }

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
    runtime.dom?.subscribe(scheduleEnsure);

}
