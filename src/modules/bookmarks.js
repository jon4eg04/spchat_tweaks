// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
export default function init(runtime) {
    'use strict';

    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const INSTANCE_KEY = '__spicyChatMessageBookmarksV1';
    if (window[INSTANCE_KEY]) return;
    window[INSTANCE_KEY] = true;

    const MESSAGE_SELECTOR = 'div[id^="message-"]';
    const MESSAGE_DROPDOWN_SELECTOR = 'button[aria-label="message-dropdown" i]';
    const SAVED_TEXT_MENU_ITEM_SELECTOR = '.tm-sc-save-history-message';
    const CHAT_DROPDOWN_SELECTOR = 'button[aria-label="chat-dropdown" i]';
    const MESSAGE_TEXT_CLASS_TOKEN = '[overflow-wrap:anywhere]';

    const STYLE_ID = 'tm-sc-message-bookmarks-style';
    const MESSAGE_MENU_ITEM_CLASS = 'tm-sc-add-message-bookmark';
    const CHAT_MENU_ITEM_CLASS = 'tm-sc-open-message-bookmarks';
    const MARKER_CLASS = 'tm-sc-message-bookmark-marker';
    const HIGHLIGHT_CLASS = 'tm-sc-message-bookmark-highlight';
    const PANEL_ID = 'tm-sc-message-bookmarks-panel';
    const EDITOR_ID = 'tm-sc-message-bookmarks-editor';
    const MARKER_POPOVER_ID = 'tm-sc-message-bookmark-popover';
    const HISTORY_SEARCH_ID = 'tm-sc-message-bookmark-history-search';
    const TOAST_ID = 'tm-sc-message-bookmarks-toast';
    const ROUTE_CHANGE_EVENT = 'tm-sc-route-change';
    const CHAT_MENU_ITEM_ORDER = [
        'tm-sc-open-message-bookmarks',
        'tm-sc-open-conversation-gallery',
        'tm-sc-open-gpt-summary',
        'tm-sc-open-chat-branches',
    ];
    const STORAGE_PREFIX = 'tm-sc-message-bookmarks-v1:conversation:';
    const LOAD_PREVIOUS_SELECTOR = '[data-translate-key="chat:page.action.loadPreviousMessages"]';
    const HISTORY_BATCH_TIMEOUT = 25000;
    const TITLE_MAX_LENGTH = 100;

    let activeStorageKey = null;
    let activeContext = null;
    let entries = [];
    let contextLoadToken = 0;
    let storageQueue = Promise.resolve();
    let ensureScheduled = false;

    let panel = null;
    let panelList = null;
    let panelCount = null;
    let panelAnchor = null;
    let panelConfirmDeleteId = null;

    let editor = null;
    let editorTitle = null;
    let editorInput = null;
    let editorState = null;

    let markerPopover = null;
    let markerPopoverState = null;
    let markerPopoverCloseTimer = null;
    let markerPopoverPinned = false;

    let historySearchOverlay = null;
    let historySearchTitle = null;
    let historySearchStatus = null;
    let historySearchBatches = null;
    let historySearchMessages = null;
    let historySearchCancelButton = null;
    let historySearchRetryButton = null;
    let historySearchCloseButton = null;
    let historySearchState = null;
    let historySearchToken = 0;

    let toastTimer = null;
    let scrollAnimationToken = 0;
    let timestampBackfillScheduled = false;
    let rootObserver = null;
    let retryTimer = null;
    let retryDelay = 250;

    const moscowDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });

    const icons = {
        bookmark: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 3h12a2 2 0 0 1 2 2v16l-8-5-8 5V5a2 2 0 0 1 2-2z"></path>
            </svg>`,
        bookmarkFilled: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                 viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.6"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 3h12a2 2 0 0 1 2 2v16l-8-5-8 5V5a2 2 0 0 1 2-2z"></path>
            </svg>`,
        pencil: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
            </svg>`,
        trash: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"></path><path d="M8 6V4h8v2"></path>
                <path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v5"></path><path d="M14 11v5"></path>
            </svg>`,
        close: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="m18 6-12 12"></path><path d="m6 6 12 12"></path>
            </svg>`,
    };

    function normalizeMessageTimestamp(value) {
        if (value === null || value === undefined || value === '') return null;

        let timestamp = Number(value);
        if (!Number.isFinite(timestamp) && typeof value === 'string') {
            timestamp = Date.parse(value);
        }
        if (!Number.isFinite(timestamp) || timestamp <= 0) return null;

        // Страховка на случай, если API когда-нибудь начнёт отдавать секунды вместо миллисекунд.
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

    function toDomMessageId(rawId) {
        if (typeof rawId !== 'string' || !rawId.trim()) return null;
        const id = rawId.trim();
        return id.startsWith('message-') ? id : `message-${id}`;
    }

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${PANEL_ID}[hidden],
            #${EDITOR_ID}[hidden],
            #${MARKER_POPOVER_ID}[hidden],
            #${HISTORY_SEARCH_ID}[hidden],
            #${TOAST_ID}[hidden] {
                display: none !important;
            }

            #${HISTORY_SEARCH_ID} [hidden] {
                display: none !important;
            }

            .${MARKER_CLASS} {
                appearance: none !important;
                box-sizing: border-box !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                vertical-align: middle !important;
                width: 20px !important;
                min-width: 20px !important;
                height: 28px !important;
                padding: 0 !important;
                margin: 0 !important;
                color: #f5b942 !important;
                background: transparent !important;
                border: 0 !important;
                border-radius: 9999px !important;
                cursor: pointer !important;
                line-height: 1 !important;
                transition: color 120ms ease, background-color 120ms ease, transform 120ms ease !important;
            }

            .${MARKER_CLASS}:hover,
            .${MARKER_CLASS}:focus-visible,
            .${MARKER_CLASS}[aria-expanded="true"] {
                color: #ffd66b !important;
                background: rgba(245, 185, 66, 0.13) !important;
                transform: translateY(-1px) !important;
                outline: none !important;
            }

            #${PANEL_ID},
            #${MARKER_POPOVER_ID},
            .tm-sc-bookmark-editor-card {
                box-sizing: border-box !important;
                color: #1f2937 !important;
                background: #ffffff !important;
                border: 1px solid rgba(17, 24, 39, 0.12) !important;
                box-shadow: 0 16px 44px rgba(0, 0, 0, 0.24) !important;
                font-family: inherit !important;
            }

            .dark #${PANEL_ID},
            .dark #${MARKER_POPOVER_ID},
            .dark .tm-sc-bookmark-editor-card {
                color: #f3f4f6 !important;
                background: #27272a !important;
                border-color: rgba(255, 255, 255, 0.12) !important;
            }

            #${PANEL_ID} {
                position: fixed !important;
                z-index: 10020 !important;
                width: min(390px, calc(100vw - 24px)) !important;
                max-height: min(68vh, 640px) !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
                border-radius: 14px !important;
            }

            .tm-sc-bookmarks-panel-header {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 12px !important;
                padding: 14px 14px 11px !important;
                border-bottom: 1px solid rgba(17, 24, 39, 0.1) !important;
            }

            .dark .tm-sc-bookmarks-panel-header {
                border-bottom-color: rgba(255, 255, 255, 0.1) !important;
            }

            .tm-sc-bookmarks-panel-heading {
                display: flex !important;
                align-items: baseline !important;
                gap: 8px !important;
                min-width: 0 !important;
            }

            .tm-sc-bookmarks-panel-title {
                margin: 0 !important;
                font-size: 16px !important;
                line-height: 1.25 !important;
                font-weight: 650 !important;
            }

            .tm-sc-bookmarks-panel-count {
                color: #6b7280 !important;
                font-size: 12px !important;
            }

            .dark .tm-sc-bookmarks-panel-count {
                color: #a1a1aa !important;
            }

            .tm-sc-bookmarks-close,
            .tm-sc-bookmark-icon-button {
                appearance: none !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                flex: 0 0 auto !important;
                padding: 0 !important;
                color: inherit !important;
                background: transparent !important;
                border: 0 !important;
                border-radius: 8px !important;
                cursor: pointer !important;
            }

            .tm-sc-bookmarks-close {
                width: 30px !important;
                height: 30px !important;
            }

            .tm-sc-bookmark-icon-button {
                width: 31px !important;
                height: 31px !important;
            }

            .tm-sc-bookmarks-close:hover,
            .tm-sc-bookmark-icon-button:hover {
                background: rgba(107, 114, 128, 0.13) !important;
            }

            .tm-sc-bookmark-icon-button.is-danger {
                color: #dc2626 !important;
            }

            .dark .tm-sc-bookmark-icon-button.is-danger {
                color: #f87171 !important;
            }

            .tm-sc-bookmarks-list {
                min-height: 0 !important;
                overflow-y: auto !important;
                padding: 9px !important;
                scrollbar-width: thin !important;
            }

            .tm-sc-bookmark-card {
                display: grid !important;
                grid-template-columns: minmax(0, 1fr) auto !important;
                align-items: center !important;
                gap: 9px !important;
                margin: 0 0 7px !important;
                padding: 10px !important;
                background: rgba(107, 114, 128, 0.065) !important;
                border: 1px solid transparent !important;
                border-radius: 11px !important;
                transition: background-color 120ms ease, border-color 120ms ease !important;
            }

            .tm-sc-bookmark-card:last-child {
                margin-bottom: 0 !important;
            }

            .tm-sc-bookmark-card:hover {
                background: rgba(124, 58, 237, 0.08) !important;
                border-color: rgba(124, 58, 237, 0.2) !important;
            }

            .dark .tm-sc-bookmark-card {
                background: rgba(255, 255, 255, 0.055) !important;
            }

            .dark .tm-sc-bookmark-card:hover {
                background: rgba(167, 139, 250, 0.1) !important;
                border-color: rgba(167, 139, 250, 0.25) !important;
            }

            .tm-sc-bookmark-card-main {
                min-width: 0 !important;
                cursor: pointer !important;
                border-radius: 7px !important;
                outline: none !important;
            }

            .tm-sc-bookmark-card-main:focus-visible {
                box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.4) !important;
            }

            .tm-sc-bookmark-card-title {
                margin: 0 0 4px !important;
                overflow: hidden !important;
                color: inherit !important;
                font-size: 14px !important;
                line-height: 1.3 !important;
                font-weight: 650 !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }

            .tm-sc-bookmark-card-excerpt {
                display: -webkit-box !important;
                margin: 0 !important;
                overflow: hidden !important;
                color: #6b7280 !important;
                font-size: 12.5px !important;
                line-height: 1.35 !important;
                overflow-wrap: anywhere !important;
                -webkit-box-orient: vertical !important;
                -webkit-line-clamp: 2 !important;
            }

            .dark .tm-sc-bookmark-card-excerpt {
                color: #a1a1aa !important;
            }

            .tm-sc-bookmark-card-meta {
                margin-top: 5px !important;
                color: #9ca3af !important;
                font-size: 10.5px !important;
                line-height: 1.2 !important;
            }

            .tm-sc-bookmark-card-actions {
                display: flex !important;
                align-items: center !important;
                gap: 2px !important;
            }

            .tm-sc-bookmark-confirm {
                display: flex !important;
                align-items: center !important;
                gap: 5px !important;
            }

            .tm-sc-bookmark-confirm-label {
                color: #dc2626 !important;
                font-size: 11px !important;
                white-space: nowrap !important;
            }

            .dark .tm-sc-bookmark-confirm-label {
                color: #fca5a5 !important;
            }

            .tm-sc-bookmark-confirm-button,
            .tm-sc-bookmark-editor-button {
                appearance: none !important;
                border: 0 !important;
                border-radius: 8px !important;
                cursor: pointer !important;
                font-family: inherit !important;
                font-weight: 600 !important;
            }

            .tm-sc-bookmark-confirm-button {
                padding: 6px 8px !important;
                font-size: 11px !important;
            }

            .tm-sc-bookmark-confirm-button.is-yes {
                color: #ffffff !important;
                background: #dc2626 !important;
            }

            .tm-sc-bookmark-confirm-button.is-no {
                color: inherit !important;
                background: rgba(107, 114, 128, 0.15) !important;
            }

            .tm-sc-bookmarks-empty {
                padding: 32px 18px !important;
                color: #6b7280 !important;
                font-size: 13px !important;
                line-height: 1.45 !important;
                text-align: center !important;
            }

            .dark .tm-sc-bookmarks-empty {
                color: #a1a1aa !important;
            }

            #${EDITOR_ID} {
                position: fixed !important;
                inset: 0 !important;
                z-index: 10050 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 18px !important;
                background: rgba(0, 0, 0, 0.38) !important;
                backdrop-filter: blur(2px) !important;
            }

            .tm-sc-bookmark-editor-card {
                width: min(410px, calc(100vw - 28px)) !important;
                padding: 17px !important;
                border-radius: 14px !important;
            }

            .tm-sc-bookmark-editor-title {
                margin: 0 0 12px !important;
                color: inherit !important;
                font-size: 16px !important;
                line-height: 1.3 !important;
                font-weight: 650 !important;
            }

            .tm-sc-bookmark-editor-input {
                box-sizing: border-box !important;
                width: 100% !important;
                height: 40px !important;
                padding: 0 11px !important;
                color: inherit !important;
                background: rgba(107, 114, 128, 0.08) !important;
                border: 1px solid rgba(107, 114, 128, 0.28) !important;
                border-radius: 9px !important;
                outline: none !important;
                font-family: inherit !important;
                font-size: 14px !important;
            }

            .tm-sc-bookmark-editor-input:focus {
                border-color: #8b5cf6 !important;
                box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.16) !important;
            }

            .tm-sc-bookmark-editor-actions {
                display: flex !important;
                justify-content: flex-end !important;
                gap: 8px !important;
                margin-top: 14px !important;
            }

            .tm-sc-bookmark-editor-button {
                min-height: 36px !important;
                padding: 0 13px !important;
                font-size: 13px !important;
            }

            .tm-sc-bookmark-editor-button.is-cancel {
                color: inherit !important;
                background: rgba(107, 114, 128, 0.14) !important;
            }

            .tm-sc-bookmark-editor-button.is-save {
                color: #ffffff !important;
                background: #7c3aed !important;
            }

            .tm-sc-bookmark-editor-button.is-save:hover {
                background: #6d28d9 !important;
            }

            #${MARKER_POPOVER_ID} {
                position: fixed !important;
                z-index: 10040 !important;
                width: min(286px, calc(100vw - 20px)) !important;
                padding: 11px !important;
                border-radius: 11px !important;
            }

            .tm-sc-bookmark-popover-title {
                margin: 0 0 9px !important;
                overflow: hidden !important;
                color: inherit !important;
                font-size: 13px !important;
                line-height: 1.35 !important;
                font-weight: 650 !important;
                overflow-wrap: anywhere !important;
            }

            .tm-sc-bookmark-popover-actions {
                display: flex !important;
                justify-content: flex-end !important;
                gap: 4px !important;
            }

            #${HISTORY_SEARCH_ID} {
                position: fixed !important;
                inset: 0 !important;
                z-index: 10080 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 18px !important;
                background: rgba(0, 0, 0, 0.3) !important;
                backdrop-filter: blur(1.5px) !important;
                font-family: inherit !important;
            }

            .tm-sc-history-search-card {
                box-sizing: border-box !important;
                width: min(430px, calc(100vw - 28px)) !important;
                padding: 18px !important;
                color: #1f2937 !important;
                background: #ffffff !important;
                border: 1px solid rgba(17, 24, 39, 0.12) !important;
                border-radius: 15px !important;
                box-shadow: 0 20px 58px rgba(0, 0, 0, 0.34) !important;
            }

            .dark .tm-sc-history-search-card {
                color: #f3f4f6 !important;
                background: #27272a !important;
                border-color: rgba(255, 255, 255, 0.13) !important;
            }

            .tm-sc-history-search-title {
                margin: 0 0 7px !important;
                color: inherit !important;
                font-size: 17px !important;
                line-height: 1.3 !important;
                font-weight: 680 !important;
            }

            .tm-sc-history-search-status {
                min-height: 38px !important;
                margin: 0 0 13px !important;
                color: #6b7280 !important;
                font-size: 13px !important;
                line-height: 1.45 !important;
            }

            .dark .tm-sc-history-search-status {
                color: #b4b4bd !important;
            }

            .tm-sc-history-progress-track {
                position: relative !important;
                height: 7px !important;
                overflow: hidden !important;
                background: rgba(107, 114, 128, 0.18) !important;
                border-radius: 9999px !important;
            }

            .tm-sc-history-progress-bar {
                position: absolute !important;
                top: 0 !important;
                bottom: 0 !important;
                left: -46% !important;
                width: 46% !important;
                background: linear-gradient(90deg, #7c3aed, #c4b5fd, #7c3aed) !important;
                border-radius: inherit !important;
                animation: tm-sc-history-progress 1.15s ease-in-out infinite !important;
            }

            #${HISTORY_SEARCH_ID}.is-success .tm-sc-history-progress-bar,
            #${HISTORY_SEARCH_ID}.is-error .tm-sc-history-progress-bar {
                left: 0 !important;
                width: 100% !important;
                animation: none !important;
            }

            #${HISTORY_SEARCH_ID}.is-success .tm-sc-history-progress-bar {
                background: #22c55e !important;
            }

            #${HISTORY_SEARCH_ID}.is-error .tm-sc-history-progress-bar {
                background: #ef4444 !important;
            }

            .tm-sc-history-search-metrics {
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 7px 15px !important;
                margin-top: 10px !important;
                color: #6b7280 !important;
                font-size: 11.5px !important;
                line-height: 1.3 !important;
            }

            .dark .tm-sc-history-search-metrics {
                color: #a1a1aa !important;
            }

            .tm-sc-history-search-actions {
                display: flex !important;
                justify-content: flex-end !important;
                gap: 8px !important;
                margin-top: 16px !important;
            }

            .tm-sc-history-search-button {
                appearance: none !important;
                min-height: 36px !important;
                padding: 0 13px !important;
                color: inherit !important;
                background: rgba(107, 114, 128, 0.14) !important;
                border: 0 !important;
                border-radius: 8px !important;
                cursor: pointer !important;
                font-family: inherit !important;
                font-size: 13px !important;
                font-weight: 620 !important;
            }

            .tm-sc-history-search-button.is-primary {
                color: #ffffff !important;
                background: #7c3aed !important;
            }

            .tm-sc-history-search-button:hover {
                filter: brightness(1.06) !important;
            }

            @keyframes tm-sc-history-progress {
                0% { transform: translateX(0); }
                100% { transform: translateX(318%); }
            }

            #${TOAST_ID} {
                position: fixed !important;
                left: 50% !important;
                bottom: 24px !important;
                z-index: 10070 !important;
                transform: translateX(-50%) !important;
                padding: 9px 13px !important;
                color: #ffffff !important;
                background: rgba(17, 24, 39, 0.94) !important;
                border: 1px solid rgba(255, 255, 255, 0.13) !important;
                border-radius: 10px !important;
                box-shadow: 0 10px 32px rgba(0, 0, 0, 0.3) !important;
                font-size: 13px !important;
                line-height: 1.3 !important;
                pointer-events: none !important;
            }

            .${HIGHLIGHT_CLASS} {
                position: relative !important;
                z-index: 1 !important;
                isolation: isolate !important;
            }

            .${HIGHLIGHT_CLASS}::after {
                content: "" !important;
                position: absolute !important;
                inset: -3px !important;
                z-index: 3 !important;
                border: 3px solid rgba(196, 181, 253, 0.98) !important;
                border-radius: inherit !important;
                background: rgba(139, 92, 246, 0.1) !important;
                box-shadow: 0 0 0 4px rgba(167, 139, 250, 0.48), 0 0 34px rgba(139, 92, 246, 0.58) !important;
                opacity: 0;
                pointer-events: none !important;
                animation: tm-sc-bookmark-flash 1.3s ease-in-out both !important;
            }

            @keyframes tm-sc-bookmark-flash {
                0% {
                    opacity: 0;
                }
                28% {
                    opacity: 1;
                }
                100% {
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
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
            console.warn('[Message Bookmarks] Не удалось прочитать данные Tampermonkey.', error);
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

    function makeId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function normalizeEntries(value) {
        if (!Array.isArray(value)) return [];
        const now = Date.now();

        return value
            .filter((entry) => entry && typeof entry === 'object' && typeof entry.messageId === 'string')
            .map((entry, index) => ({
                id: typeof entry.id === 'string' && entry.id ? entry.id : `legacy-${now}-${index}`,
                messageId: entry.messageId,
                title: typeof entry.title === 'string' && entry.title.trim()
                    ? entry.title.trim().slice(0, TITLE_MAX_LENGTH)
                    : 'Закладка',
                excerpt: typeof entry.excerpt === 'string' ? entry.excerpt : '',
                fullText: typeof entry.fullText === 'string' ? entry.fullText : '',
                author: typeof entry.author === 'string' && entry.author.trim() ? entry.author.trim() : 'Сообщение',
                messageCreatedAt: normalizeMessageTimestamp(entry.messageCreatedAt),
                createdAt: Number.isFinite(Number(entry.createdAt)) ? Number(entry.createdAt) : now - index,
                updatedAt: Number.isFinite(Number(entry.updatedAt)) ? Number(entry.updatedAt) : now - index,
            }))
            .filter((entry, index, array) => (
                array.findIndex((candidate) => candidate.messageId === entry.messageId) === index
            ));
    }

    async function readEntries(key) {
        return normalizeEntries(await readValue(key, []));
    }

    function updateEntries(key, updater) {
        const operation = storageQueue.then(async () => {
            const latest = await readEntries(key);
            const next = normalizeEntries(updater(latest));
            await writeValue(key, next);
            return next;
        });

        storageQueue = operation.catch(() => undefined);
        return operation;
    }

    function getCapturedMessageTimestamp(messageId) {
        const message = getMessageElement(messageId);
        const time = message?.querySelector('time.tm-sc-message-sent-at[datetime]');
        return normalizeMessageTimestamp(time?.dateTime);
    }

    function scheduleTimestampBackfill() {
        if (timestampBackfillScheduled) return;
        timestampBackfillScheduled = true;

        window.setTimeout(() => {
            timestampBackfillScheduled = false;
            void backfillBookmarkTimestamps();
        }, 0);
    }

    async function backfillBookmarkTimestamps() {
        if (!activeStorageKey || !entries.length) return;
        const storageKey = activeStorageKey;
        const needsBackfill = entries.some((entry) => {
            const captured = getCapturedMessageTimestamp(entry.messageId);
            return captured && captured !== entry.messageCreatedAt;
        });
        if (!needsBackfill) return;

        try {
            const updated = await updateEntries(storageKey, (latest) => latest.map((entry) => {
                const captured = getCapturedMessageTimestamp(entry.messageId);
                return captured && captured !== entry.messageCreatedAt
                    ? { ...entry, messageCreatedAt: captured }
                    : entry;
            }));

            if (activeStorageKey !== storageKey) return;
            entries = updated;
            if (panel && !panel.hidden) renderPanel();
        } catch (error) {
            console.warn('[Message Bookmarks] Не удалось дописать время старым закладкам.', error);
        }
    }

    function ensureContext() {
        const context = getChatContext();
        const nextKey = context?.storageKey || null;
        if (nextKey === activeStorageKey) return;

        activeContext = context;
        activeStorageKey = nextKey;
        entries = [];
        contextLoadToken += 1;
        const token = contextLoadToken;

        closePanel();
        closeEditor();
        closeMarkerPopover();
        cancelHistorySearch();
        removeAllMarkers();

        if (!nextKey) return;

        void readEntries(nextKey).then((loaded) => {
            if (token !== contextLoadToken || activeStorageKey !== nextKey) return;
            entries = loaded;
            scheduleTimestampBackfill();
            ensureBookmarkMarkers();
            if (panel && !panel.hidden) renderPanel();
        }).catch((error) => {
            console.error('[Message Bookmarks] Не удалось загрузить закладки.', error);
        });
    }

    function getEntry(messageId) {
        return entries.find((entry) => entry.messageId === messageId) || null;
    }

    function getMessageElement(messageId) {
        const element = document.getElementById(messageId);
        return element && element.matches(MESSAGE_SELECTOR) ? element : null;
    }

    function getMessageRoot(node) {
        const root = node?.closest?.(MESSAGE_SELECTOR);
        return root && root.id ? root : null;
    }

    function findMessageTextContainer(message) {
        if (!message) return null;
        return Array.from(message.querySelectorAll('[class]')).find((element) => (
            element.classList.contains(MESSAGE_TEXT_CLASS_TOKEN)
        )) || null;
    }

    function findMessageBubble(message) {
        if (!message) return null;

        const textContainer = findMessageTextContainer(message);
        const dropdown = message.querySelector(MESSAGE_DROPDOWN_SELECTOR);
        if (!textContainer) return message;
        if (!dropdown) return textContainer.parentElement?.parentElement || message;

        let candidate = textContainer.parentElement;
        while (candidate && candidate !== message) {
            if (candidate.contains(dropdown)) return candidate;
            candidate = candidate.parentElement;
        }

        return message;
    }

    function normalizePlainText(value) {
        return String(value || '')
            .replace(/\u00a0/g, ' ')
            .replace(/\r\n?/g, '\n')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n[ \t]+/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function extractMessageData(message) {
        const textContainer = findMessageTextContainer(message);
        const fullText = normalizePlainText(textContainer?.innerText || textContainer?.textContent || '');
        const excerpt = fullText.replace(/\s+/g, ' ').trim().slice(0, 240);
        const botName = message.querySelector('a[href^="/chatbot/"] p')?.textContent?.trim();
        const author = botName || 'Вы';
        const defaultTitle = (excerpt || `${author}: сообщение`).slice(0, 72);

        return { fullText, excerpt, author, defaultTitle };
    }

    function formatMessageDateTime(timestamp) {
        const normalized = normalizeMessageTimestamp(timestamp);
        if (!normalized) return '';

        try {
            const parts = Object.fromEntries(
                moscowDateTimeFormatter.formatToParts(new Date(normalized))
                    .map((part) => [part.type, part.value]),
            );
            return `${parts.day}.${parts.month}.${parts.year}, ${parts.hour}:${parts.minute}`;
        } catch (_error) {
            return '';
        }
    }

    function cloneMenuButton(template, className, ariaLabel, labelText, icon) {
        const button = template.cloneNode(true);
        button.className = template.className;
        button.classList.remove(
            'tm-sc-save-history-message',
            MESSAGE_MENU_ITEM_CLASS,
            CHAT_MENU_ITEM_CLASS,
        );
        button.classList.add(className);
        button.removeAttribute('target');
        button.removeAttribute('data-tm-saving');
        button.disabled = false;
        button.type = 'button';
        button.setAttribute('aria-label', ariaLabel);

        const oldIcon = button.querySelector('svg');
        if (oldIcon) oldIcon.outerHTML = icon;
        else button.insertAdjacentHTML('afterbegin', icon);

        const labels = Array.from(button.querySelectorAll('p, span'));
        const primaryLabel = labels[0];
        if (primaryLabel) primaryLabel.textContent = labelText;
        for (const extra of labels.slice(1)) extra.remove();

        return button;
    }

    function closeMessageMenu(message) {
        const dropdown = message?.querySelector(MESSAGE_DROPDOWN_SELECTOR);
        if (dropdown?.isConnected) dropdown.click();
    }

    function ensureMessageMenuItems() {
        for (const saveItem of document.querySelectorAll(SAVED_TEXT_MENU_ITEM_SELECTOR)) {
            const message = getMessageRoot(saveItem);
            const menu = saveItem.parentElement;
            if (!message || !menu) continue;

            let button = menu.querySelector(`.${MESSAGE_MENU_ITEM_CLASS}`);
            if (!button) {
                button = cloneMenuButton(
                    saveItem,
                    MESSAGE_MENU_ITEM_CLASS,
                    'Добавить сообщение в закладки',
                    'Добавить в закладки',
                    icons.bookmark,
                );
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();

                    const currentMessage = getMessageRoot(button);
                    if (!currentMessage) return;
                    const messageId = currentMessage.id;
                    closeMessageMenu(currentMessage);
                    window.setTimeout(() => openEditorForMessage(messageId), 0);
                });
            }

            if (saveItem.nextElementSibling !== button) saveItem.after(button);
        }
    }

    function findChatMenu(dropdown) {
        const wrapper = dropdown?.parentElement;
        if (wrapper) {
            const directSibling = dropdown.nextElementSibling;
            if (directSibling?.querySelector('button[aria-label="View Saved Chats" i]')) {
                return directSibling;
            }

            const nestedMenu = Array.from(wrapper.children).find((child) => (
                child !== dropdown
                && child.querySelector?.('button[aria-label="View Saved Chats" i]')
            ));
            if (nestedMenu) return nestedMenu;
        }

        // В актуальной версии SpicyChat меню рендерится через React-портал
        // и не является ни соседом, ни потомком кнопки chat-dropdown.
        const portalMenus = Array.from(
            document.querySelectorAll('button[aria-label="View Saved Chats" i]'),
        ).map((button) => button.parentElement).filter((menu) => (
            menu
            && menu.querySelector('button[aria-label="Start New Chat" i]')
            && menu.querySelector('button[aria-label="Remove Messages" i]')
        ));

        const visibleMenu = portalMenus.find((menu) => {
            const rect = menu.getBoundingClientRect();
            const style = getComputedStyle(menu);
            return (
                rect.width > 0
                && rect.height > 0
                && style.display !== 'none'
                && style.visibility !== 'hidden'
            );
        });

        return visibleMenu || portalMenus[0] || null;
    }

    function normalizeCustomChatMenuOrder(menu) {
        const desired = CHAT_MENU_ITEM_ORDER
            .map((className) => menu.querySelector(`.${className}`))
            .filter(Boolean);
        if (!desired.length) return;

        const currentPrefix = Array.from(menu.children).slice(0, desired.length);
        if (desired.every((item, index) => currentPrefix[index] === item)) return;

        const customClasses = new Set(CHAT_MENU_ITEM_ORDER);
        const firstNative = Array.from(menu.children).find((item) => (
            !Array.from(customClasses).some((className) => item.classList.contains(className))
        )) || null;
        for (const item of desired) menu.insertBefore(item, firstNative);
    }

    function ensureChatMenuItems() {
        for (const dropdown of document.querySelectorAll(CHAT_DROPDOWN_SELECTOR)) {
            const menu = findChatMenu(dropdown);
            if (!menu) continue;

            let button = menu.querySelector(`.${CHAT_MENU_ITEM_CLASS}`);
            if (!button) {
                const template = menu.querySelector('button[aria-label="View Saved Chats" i]')
                    || menu.querySelector('button');
                if (!template) continue;

                button = cloneMenuButton(
                    template,
                    CHAT_MENU_ITEM_CLASS,
                    'Закладки',
                    'Закладки',
                    icons.bookmark,
                );
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();

                    panelAnchor = dropdown;
                    dropdown.click();
                    window.setTimeout(() => openPanel(dropdown), 0);
                });
                menu.insertBefore(button, menu.firstElementChild);
            }

            normalizeCustomChatMenuOrder(menu);
        }
    }

    function removeAllMarkers() {
        for (const marker of document.querySelectorAll(`.${MARKER_CLASS}`)) marker.remove();
    }

    function makeMarker(entry, dropdown) {
        const marker = document.createElement('button');
        marker.type = 'button';
        marker.className = MARKER_CLASS;
        marker.dataset.messageId = entry.messageId;
        marker.setAttribute('aria-label', entry.title);
        marker.setAttribute('aria-haspopup', 'dialog');
        marker.setAttribute('aria-expanded', 'false');
        marker.innerHTML = icons.bookmarkFilled;

        marker.addEventListener('mouseenter', () => {
            cancelMarkerPopoverClose();
            openMarkerPopover(marker, false);
        });
        marker.addEventListener('mouseleave', scheduleMarkerPopoverClose);
        marker.addEventListener('focus', () => openMarkerPopover(marker, false));
        marker.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            markerPopoverPinned = !(markerPopoverState?.marker === marker && markerPopoverPinned);
            if (markerPopoverPinned) openMarkerPopover(marker, true);
            else closeMarkerPopover();
        });

        dropdown.before(marker);
        return marker;
    }

    function ensureBookmarkMarkers() {
        const existingMessageIds = new Set(entries.map((entry) => entry.messageId));
        for (const marker of document.querySelectorAll(`.${MARKER_CLASS}`)) {
            if (!existingMessageIds.has(marker.dataset.messageId) || !getMessageRoot(marker)) marker.remove();
        }

        for (const entry of entries) {
            const message = getMessageElement(entry.messageId);
            if (!message) continue;

            const dropdown = message.querySelector(MESSAGE_DROPDOWN_SELECTOR);
            if (!dropdown) continue;

            let marker = Array.from(message.querySelectorAll(`.${MARKER_CLASS}`)).find((candidate) => (
                candidate.dataset.messageId === entry.messageId
            ));
            if (!marker) marker = makeMarker(entry, dropdown);

            marker.setAttribute('aria-label', entry.title);
            marker.dataset.messageId = entry.messageId;
            if (marker.nextElementSibling !== dropdown) dropdown.before(marker);
        }
    }

    function ensureEditor() {
        if (editor?.isConnected) return editor;

        editor = document.createElement('div');
        editor.id = EDITOR_ID;
        editor.hidden = true;
        editor.innerHTML = `
            <form class="tm-sc-bookmark-editor-card" novalidate>
                <h2 class="tm-sc-bookmark-editor-title">Название закладки</h2>
                <input class="tm-sc-bookmark-editor-input" type="text" maxlength="${TITLE_MAX_LENGTH}"
                       autocomplete="off" aria-label="Название закладки">
                <div class="tm-sc-bookmark-editor-actions">
                    <button class="tm-sc-bookmark-editor-button is-cancel" type="button">Отмена</button>
                    <button class="tm-sc-bookmark-editor-button is-save" type="submit">Сохранить</button>
                </div>
            </form>
        `;

        editorTitle = editor.querySelector('.tm-sc-bookmark-editor-title');
        editorInput = editor.querySelector('.tm-sc-bookmark-editor-input');

        editor.addEventListener('pointerdown', (event) => {
            if (event.target === editor) closeEditor();
        });
        editor.querySelector('.is-cancel').addEventListener('click', closeEditor);
        editor.querySelector('form').addEventListener('submit', (event) => {
            event.preventDefault();
            void saveEditorValue();
        });

        document.body.appendChild(editor);
        return editor;
    }

    function openEditorForMessage(messageId) {
        const message = getMessageElement(messageId);
        if (!message || !activeStorageKey) return;

        const current = getEntry(messageId);
        const messageData = extractMessageData(message);
        openEditor({
            storageKey: activeStorageKey,
            messageId,
            currentEntry: current,
            messageData,
        });
    }

    function openEditorForEntry(entry) {
        if (!entry || !activeStorageKey) return;
        const message = getMessageElement(entry.messageId);
        const messageData = message
            ? extractMessageData(message)
            : {
                fullText: entry.fullText,
                excerpt: entry.excerpt,
                author: entry.author,
                defaultTitle: entry.title,
            };

        openEditor({
            storageKey: activeStorageKey,
            messageId: entry.messageId,
            currentEntry: entry,
            messageData,
        });
    }

    function openEditor(state) {
        ensureEditor();
        editorState = state;
        editorTitle.textContent = state.currentEntry ? 'Изменить название закладки' : 'Название закладки';
        editorInput.value = state.currentEntry?.title || state.messageData.defaultTitle || 'Закладка';
        editor.hidden = false;

        requestAnimationFrame(() => {
            editorInput.focus({ preventScroll: true });
            editorInput.select();
        });
    }

    function closeEditor() {
        if (!editor) return;
        editor.hidden = true;
        editorState = null;
    }

    async function saveEditorValue() {
        if (!editorState) return;

        const state = editorState;
        const rawTitle = editorInput.value.trim();
        const fallbackTitle = state.messageData.defaultTitle || 'Закладка';
        const title = (rawTitle || fallbackTitle).slice(0, TITLE_MAX_LENGTH);
        const now = Date.now();
        const wasExisting = Boolean(state.currentEntry);

        try {
            const updated = await updateEntries(state.storageKey, (latest) => {
                const existingIndex = latest.findIndex((entry) => entry.messageId === state.messageId);
                const nextEntry = {
                    id: existingIndex >= 0 ? latest[existingIndex].id : makeId(),
                    messageId: state.messageId,
                    title,
                    excerpt: state.messageData.excerpt || latest[existingIndex]?.excerpt || '',
                    fullText: state.messageData.fullText || latest[existingIndex]?.fullText || '',
                    author: state.messageData.author || latest[existingIndex]?.author || 'Сообщение',
                    messageCreatedAt: (
                        getCapturedMessageTimestamp(state.messageId)
                        || latest[existingIndex]?.messageCreatedAt
                        || null
                    ),
                    createdAt: existingIndex >= 0 ? latest[existingIndex].createdAt : now,
                    updatedAt: now,
                };

                if (existingIndex < 0) return [nextEntry, ...latest];
                const result = latest.slice();
                result[existingIndex] = nextEntry;
                return result;
            });

            if (activeStorageKey === state.storageKey) {
                entries = updated;
                ensureBookmarkMarkers();
                if (panel && !panel.hidden) renderPanel();
            }

            closeEditor();
            closeMarkerPopover();
            showToast(wasExisting ? 'Название закладки изменено' : 'Закладка добавлена');
        } catch (error) {
            console.error('[Message Bookmarks] Не удалось сохранить закладку.', error);
        }
    }

    async function deleteBookmark(entryId) {
        if (!activeStorageKey || !entryId) return;
        const storageKey = activeStorageKey;

        try {
            const updated = await updateEntries(storageKey, (latest) => (
                latest.filter((entry) => entry.id !== entryId)
            ));

            if (activeStorageKey !== storageKey) return;
            entries = updated;
            panelConfirmDeleteId = null;
            closeMarkerPopover();
            ensureBookmarkMarkers();
            if (panel && !panel.hidden) renderPanel();
            showToast('Закладка удалена');
        } catch (error) {
            console.error('[Message Bookmarks] Не удалось удалить закладку.', error);
        }
    }

    function ensurePanel() {
        if (panel?.isConnected) return panel;

        panel = document.createElement('section');
        panel.id = PANEL_ID;
        panel.hidden = true;
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Закладки');
        panel.innerHTML = `
            <header class="tm-sc-bookmarks-panel-header">
                <div class="tm-sc-bookmarks-panel-heading">
                    <h2 class="tm-sc-bookmarks-panel-title">Закладки</h2>
                    <span class="tm-sc-bookmarks-panel-count"></span>
                </div>
                <button class="tm-sc-bookmarks-close" type="button" aria-label="Закрыть">${icons.close}</button>
            </header>
            <div class="tm-sc-bookmarks-list"></div>
        `;

        panelList = panel.querySelector('.tm-sc-bookmarks-list');
        panelCount = panel.querySelector('.tm-sc-bookmarks-panel-count');
        panel.querySelector('.tm-sc-bookmarks-close').addEventListener('click', closePanel);
        document.body.appendChild(panel);
        return panel;
    }

    function openPanel(anchor) {
        ensureContext();
        if (!activeStorageKey) return;
        ensurePanel();
        panelAnchor = anchor || panelAnchor;
        panelConfirmDeleteId = null;
        renderPanel();
        panel.hidden = false;
        positionPanel();
    }

    function closePanel() {
        if (!panel) return;
        panel.hidden = true;
        panelConfirmDeleteId = null;
    }

    function positionPanel() {
        if (!panel || panel.hidden || !panelAnchor?.isConnected) return;

        const rect = panelAnchor.getBoundingClientRect();
        const width = Math.min(390, window.innerWidth - 24);
        const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width));
        const top = Math.min(window.innerHeight - 80, Math.max(12, rect.bottom + 8));
        panel.style.left = `${Math.round(left)}px`;
        panel.style.top = `${Math.round(top)}px`;
    }

    function makeIconButton(label, icon, danger = false) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `tm-sc-bookmark-icon-button${danger ? ' is-danger' : ''}`;
        button.setAttribute('aria-label', label);
        button.title = label;
        button.innerHTML = icon;
        return button;
    }

    function makeConfirmControls(entry, onCancel) {
        const wrapper = document.createElement('div');
        wrapper.className = 'tm-sc-bookmark-confirm';

        const label = document.createElement('span');
        label.className = 'tm-sc-bookmark-confirm-label';
        label.textContent = 'Удалить?';

        const yes = document.createElement('button');
        yes.type = 'button';
        yes.className = 'tm-sc-bookmark-confirm-button is-yes';
        yes.textContent = 'Да';
        yes.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            void deleteBookmark(entry.id);
        });

        const no = document.createElement('button');
        no.type = 'button';
        no.className = 'tm-sc-bookmark-confirm-button is-no';
        no.textContent = 'Нет';
        no.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
        });

        wrapper.append(label, yes, no);
        return wrapper;
    }

    function renderPanel() {
        if (!panelList || !panelCount) return;

        const sorted = entries.slice().sort((a, b) => {
            const aMessageTime = normalizeMessageTimestamp(a.messageCreatedAt);
            const bMessageTime = normalizeMessageTimestamp(b.messageCreatedAt);

            if (aMessageTime && bMessageTime && aMessageTime !== bMessageTime) {
                return bMessageTime - aMessageTime;
            }
            if (aMessageTime && !bMessageTime) return -1;
            if (!aMessageTime && bMessageTime) return 1;
            return b.createdAt - a.createdAt;
        });
        panelCount.textContent = sorted.length ? String(sorted.length) : '';
        panelList.replaceChildren();

        if (!sorted.length) {
            const empty = document.createElement('div');
            empty.className = 'tm-sc-bookmarks-empty';
            empty.textContent = 'Закладок пока нет.';
            panelList.appendChild(empty);
            return;
        }

        for (const entry of sorted) {
            const card = document.createElement('article');
            card.className = 'tm-sc-bookmark-card';

            const main = document.createElement('div');
            main.className = 'tm-sc-bookmark-card-main';
            main.tabIndex = 0;
            main.setAttribute('role', 'button');
            main.setAttribute('aria-label', `Перейти к закладке ${entry.title}`);

            const title = document.createElement('h3');
            title.className = 'tm-sc-bookmark-card-title';
            title.textContent = entry.title;

            const excerpt = document.createElement('p');
            excerpt.className = 'tm-sc-bookmark-card-excerpt';
            excerpt.textContent = entry.excerpt || 'Сообщение';

            const meta = document.createElement('div');
            meta.className = 'tm-sc-bookmark-card-meta';
            meta.textContent = [
                entry.author,
                formatMessageDateTime(entry.messageCreatedAt) || 'Время сообщения пока неизвестно',
            ].filter(Boolean).join(' · ');

            main.append(title, excerpt, meta);
            main.addEventListener('click', () => navigateToEntry(entry));
            main.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigateToEntry(entry);
                }
            });

            const actions = document.createElement('div');
            actions.className = 'tm-sc-bookmark-card-actions';

            if (panelConfirmDeleteId === entry.id) {
                actions.appendChild(makeConfirmControls(entry, () => {
                    panelConfirmDeleteId = null;
                    renderPanel();
                }));
            } else {
                const editButton = makeIconButton('Изменить название', icons.pencil);
                editButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openEditorForEntry(entry);
                });

                const deleteButton = makeIconButton('Удалить закладку', icons.trash, true);
                deleteButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    panelConfirmDeleteId = entry.id;
                    renderPanel();
                });
                actions.append(editButton, deleteButton);
            }

            card.append(main, actions);
            panelList.appendChild(card);
        }
    }

    function ensureHistorySearchOverlay() {
        if (historySearchOverlay?.isConnected) return historySearchOverlay;

        historySearchOverlay = document.createElement('div');
        historySearchOverlay.id = HISTORY_SEARCH_ID;
        historySearchOverlay.hidden = true;
        historySearchOverlay.innerHTML = `
            <section class="tm-sc-history-search-card" role="dialog" aria-modal="true"
                     aria-labelledby="tm-sc-history-search-title">
                <h2 id="tm-sc-history-search-title" class="tm-sc-history-search-title">Ищу сообщение в истории</h2>
                <p class="tm-sc-history-search-status" aria-live="polite"></p>
                <div class="tm-sc-history-progress-track" aria-hidden="true">
                    <div class="tm-sc-history-progress-bar"></div>
                </div>
                <div class="tm-sc-history-search-metrics">
                    <span class="tm-sc-history-search-batches">Загружено пачек: 0</span>
                    <span class="tm-sc-history-search-messages">Проверено сообщений: 0</span>
                </div>
                <div class="tm-sc-history-search-actions">
                    <button class="tm-sc-history-search-button is-cancel" type="button">Отменить</button>
                    <button class="tm-sc-history-search-button is-primary is-retry" type="button" hidden>Повторить</button>
                    <button class="tm-sc-history-search-button is-close" type="button" hidden>Закрыть</button>
                </div>
            </section>
        `;

        historySearchTitle = historySearchOverlay.querySelector('.tm-sc-history-search-title');
        historySearchStatus = historySearchOverlay.querySelector('.tm-sc-history-search-status');
        historySearchBatches = historySearchOverlay.querySelector('.tm-sc-history-search-batches');
        historySearchMessages = historySearchOverlay.querySelector('.tm-sc-history-search-messages');
        historySearchCancelButton = historySearchOverlay.querySelector('.is-cancel');
        historySearchRetryButton = historySearchOverlay.querySelector('.is-retry');
        historySearchCloseButton = historySearchOverlay.querySelector('.is-close');

        historySearchCancelButton.addEventListener('click', cancelHistorySearch);
        historySearchCloseButton.addEventListener('click', cancelHistorySearch);
        historySearchRetryButton.addEventListener('click', () => {
            const entry = historySearchState?.entry;
            if (entry) void startHistorySearch(entry);
        });

        document.body.appendChild(historySearchOverlay);
        return historySearchOverlay;
    }

    function updateHistorySearchSeen(state) {
        for (const message of document.querySelectorAll(MESSAGE_SELECTOR)) {
            if (message.id) state.seenIds.add(message.id);
        }
    }

    function renderHistorySearchProgress(state, statusText) {
        ensureHistorySearchOverlay();
        updateHistorySearchSeen(state);
        historySearchStatus.textContent = statusText;
        historySearchBatches.textContent = `Загружено пачек: ${state.batches}`;
        historySearchMessages.textContent = `Проверено сообщений: ${state.seenIds.size}`;
    }

    function showHistorySearchLoading(state, statusText = 'Проверяю уже загруженные сообщения…') {
        ensureHistorySearchOverlay();
        historySearchOverlay.classList.remove('is-success', 'is-error');
        historySearchTitle.textContent = 'Ищу сообщение в истории';
        historySearchCancelButton.hidden = false;
        historySearchRetryButton.hidden = true;
        historySearchCloseButton.hidden = true;
        renderHistorySearchProgress(state, statusText);
        historySearchOverlay.hidden = false;
    }

    function showHistorySearchSuccess(state) {
        ensureHistorySearchOverlay();
        historySearchOverlay.classList.remove('is-error');
        historySearchOverlay.classList.add('is-success');
        historySearchTitle.textContent = 'Сообщение найдено';
        historySearchCancelButton.hidden = true;
        historySearchRetryButton.hidden = true;
        historySearchCloseButton.hidden = true;
        renderHistorySearchProgress(state, 'Перехожу к закладке…');
    }

    function showHistorySearchError(state, title, statusText, allowRetry) {
        ensureHistorySearchOverlay();
        historySearchOverlay.classList.remove('is-success');
        historySearchOverlay.classList.add('is-error');
        historySearchTitle.textContent = title;
        historySearchCancelButton.hidden = true;
        historySearchRetryButton.hidden = !allowRetry;
        historySearchCloseButton.hidden = false;
        renderHistorySearchProgress(state, statusText);
        historySearchOverlay.hidden = false;
    }

    function invalidateHistorySearch() {
        historySearchToken += 1;
        const previousState = historySearchState;
        if (previousState?.cancelWaiters) {
            for (const cancelWaiter of Array.from(previousState.cancelWaiters)) cancelWaiter();
            previousState.cancelWaiters.clear();
        }
        return historySearchToken;
    }

    function cancelHistorySearch() {
        invalidateHistorySearch();
        historySearchState = null;
        if (historySearchOverlay) {
            historySearchOverlay.hidden = true;
            historySearchOverlay.classList.remove('is-success', 'is-error');
        }
    }

    function registerHistorySearchCancelWaiter(state, callback) {
        state.cancelWaiters.add(callback);
        return () => state.cancelWaiters.delete(callback);
    }

    function getLoadedMessageIds() {
        return Array.from(document.querySelectorAll(MESSAGE_SELECTOR), (message) => message.id).filter(Boolean);
    }

    function getLoadedMessagesSignature() {
        const ids = getLoadedMessageIds();
        return [
            ids.length,
            ...ids.slice(0, 4),
            ...ids.slice(-4),
        ].join('|');
    }

    function findLoadPreviousButton() {
        const buttons = Array.from(document.querySelectorAll(LOAD_PREVIOUS_SELECTOR))
            .map((label) => label.closest('button'))
            .filter((button, index, array) => (
                button?.isConnected && array.indexOf(button) === index
            ));

        return buttons.find((button) => (
            !button.disabled && button.getAttribute('aria-disabled') !== 'true'
        )) || buttons[0] || null;
    }

    function isLoadPreviousButtonReady(button) {
        return Boolean(
            button?.isConnected
            && !button.disabled
            && button.getAttribute('aria-disabled') !== 'true'
        );
    }

    function captureHistoryViewport() {
        const messages = Array.from(document.querySelectorAll(MESSAGE_SELECTOR));
        if (!messages.length) return null;

        const seedMessage = messages[messages.length - 1];
        const scroller = findScrollContainer(seedMessage);
        const rootScroller = isRootScroller(scroller);
        const scrollerRect = rootScroller
            ? { top: 0, bottom: window.innerHeight }
            : scroller.getBoundingClientRect();

        const candidates = messages.filter((message) => {
            if (findScrollContainer(message) !== scroller) return false;
            const rect = message.getBoundingClientRect();
            return rect.bottom > scrollerRect.top && rect.top < scrollerRect.bottom;
        });

        const anchor = (candidates.length ? candidates : messages).reduce((best, message) => {
            if (!best) return message;
            const bestDistance = Math.abs(best.getBoundingClientRect().top - scrollerRect.top);
            const currentDistance = Math.abs(message.getBoundingClientRect().top - scrollerRect.top);
            return currentDistance < bestDistance ? message : best;
        }, null);

        return anchor ? {
            anchorId: anchor.id,
            anchorTop: anchor.getBoundingClientRect().top,
            scroller,
        } : null;
    }

    function restoreHistoryViewport(snapshot) {
        if (!snapshot) return;
        const anchor = getMessageElement(snapshot.anchorId);
        if (!anchor) return;

        const currentScroller = findScrollContainer(anchor);
        const scroller = snapshot.scroller?.isConnected ? snapshot.scroller : currentScroller;
        const delta = anchor.getBoundingClientRect().top - snapshot.anchorTop;
        if (Math.abs(delta) > 0.5) {
            setScrollTop(scroller, getScrollTop(scroller) + delta);
        }
    }

    function waitForHistoryBatch(state, beforeSignature, viewportSnapshot) {
        return new Promise((resolve) => {
            let finished = false;
            let changed = false;
            let lastSignature = beforeSignature;
            let settleTimer = null;
            let timeoutTimer = null;
            let unregisterCancel = () => {};

            const cleanup = () => {
                observer.disconnect();
                if (settleTimer) window.clearTimeout(settleTimer);
                if (timeoutTimer) window.clearTimeout(timeoutTimer);
                unregisterCancel();
            };

            const finish = (kind) => {
                if (finished) return;
                finished = true;
                cleanup();
                resolve({ kind, changed });
            };

            const finishSettledBatch = () => {
                if (state.token !== historySearchToken) {
                    finish('cancelled');
                    return;
                }

                restoreHistoryViewport(viewportSnapshot);
                updateHistorySearchSeen(state);
                if (getMessageElement(state.entry.messageId)) finish('found');
                else finish('loaded');
            };

            const inspect = () => {
                if (state.token !== historySearchToken) {
                    finish('cancelled');
                    return;
                }

                updateHistorySearchSeen(state);
                const currentSignature = getLoadedMessagesSignature();
                const signatureChanged = currentSignature !== lastSignature;
                if (signatureChanged) {
                    changed = true;
                    lastSignature = currentSignature;
                    restoreHistoryViewport(viewportSnapshot);
                }

                if (getMessageElement(state.entry.messageId)) {
                    restoreHistoryViewport(viewportSnapshot);
                    renderHistorySearchProgress(state, 'Сообщение найдено. Завершаю поиск…');
                    finish('found');
                    return;
                }

                if (!signatureChanged) return;
                renderHistorySearchProgress(state, 'Получена новая пачка. Проверяю сообщения…');

                if (settleTimer) window.clearTimeout(settleTimer);
                settleTimer = window.setTimeout(finishSettledBatch, 420);
            };

            const observer = new MutationObserver(inspect);
            observer.observe(document.documentElement, { childList: true, subtree: true });
            unregisterCancel = registerHistorySearchCancelWaiter(state, () => finish('cancelled'));

            timeoutTimer = window.setTimeout(() => {
                if (state.token !== historySearchToken) {
                    finish('cancelled');
                    return;
                }

                restoreHistoryViewport(viewportSnapshot);
                updateHistorySearchSeen(state);
                if (getMessageElement(state.entry.messageId)) finish('found');
                else if (changed) finish('loaded');
                else finish('timeout');
            }, HISTORY_BATCH_TIMEOUT);

            inspect();
        });
    }

    function waitForNextLoadControl(state, timeout = 2800) {
        return new Promise((resolve) => {
            let finished = false;
            let timeoutTimer = null;
            let unregisterCancel = () => {};

            const cleanup = () => {
                observer.disconnect();
                if (timeoutTimer) window.clearTimeout(timeoutTimer);
                unregisterCancel();
            };

            const finish = (result) => {
                if (finished) return;
                finished = true;
                cleanup();
                resolve(result);
            };

            const inspect = () => {
                if (state.token !== historySearchToken) {
                    finish({ kind: 'cancelled' });
                    return;
                }

                if (getMessageElement(state.entry.messageId)) {
                    finish({ kind: 'found' });
                    return;
                }

                const button = findLoadPreviousButton();
                if (isLoadPreviousButtonReady(button)) finish({ kind: 'button', button });
            };

            const observer = new MutationObserver(inspect);
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['disabled', 'aria-disabled'],
            });
            unregisterCancel = registerHistorySearchCancelWaiter(state, () => finish({ kind: 'cancelled' }));

            timeoutTimer = window.setTimeout(() => {
                if (state.token !== historySearchToken) {
                    finish({ kind: 'cancelled' });
                    return;
                }

                if (getMessageElement(state.entry.messageId)) {
                    finish({ kind: 'found' });
                    return;
                }

                const button = findLoadPreviousButton();
                if (isLoadPreviousButtonReady(button)) finish({ kind: 'button', button });
                else if (button) finish({ kind: 'stalled' });
                else finish({ kind: 'end' });
            }, timeout);

            inspect();
        });
    }

    function waitForHistorySearchDelay(state, delay) {
        return new Promise((resolve) => {
            const timer = window.setTimeout(() => {
                unregisterCancel();
                resolve(state.token === historySearchToken);
            }, delay);
            const unregisterCancel = registerHistorySearchCancelWaiter(state, () => {
                window.clearTimeout(timer);
                unregisterCancel();
                resolve(false);
            });
        });
    }

    async function completeHistorySearch(state) {
        if (state.token !== historySearchToken) return;
        showHistorySearchSuccess(state);
        const shouldContinue = await waitForHistorySearchDelay(state, 260);
        if (!shouldContinue || state.token !== historySearchToken) return;

        historySearchOverlay.hidden = true;
        historySearchOverlay.classList.remove('is-success', 'is-error');
        historySearchState = null;
        navigateToLoadedMessage(state.entry.messageId);
    }

    async function startHistorySearch(entry) {
        if (!entry) return;

        const token = invalidateHistorySearch();
        const state = {
            token,
            entry,
            batches: 0,
            seenIds: new Set(getLoadedMessageIds()),
            cancelWaiters: new Set(),
        };
        historySearchState = state;
        showHistorySearchLoading(state);

        try {
            while (state.token === historySearchToken) {
                if (getMessageElement(entry.messageId)) {
                    await completeHistorySearch(state);
                    return;
                }

                renderHistorySearchProgress(
                    state,
                    state.batches
                        ? 'Ищу следующую пачку предыдущих сообщений…'
                        : 'Ищу кнопку загрузки предыдущих сообщений…',
                );

                const control = await waitForNextLoadControl(state);
                if (control.kind === 'cancelled') return;
                if (control.kind === 'found') {
                    await completeHistorySearch(state);
                    return;
                }
                if (control.kind === 'end') {
                    showHistorySearchError(
                        state,
                        'Сообщение не найдено',
                        'Вся доступная история загружена. Возможно, сообщение было удалено.',
                        false,
                    );
                    return;
                }
                if (control.kind === 'stalled') {
                    showHistorySearchError(
                        state,
                        'Поиск приостановлен',
                        'Кнопка загрузки не стала активной. Можно повторить попытку.',
                        true,
                    );
                    return;
                }

                const viewportSnapshot = captureHistoryViewport();
                const beforeSignature = getLoadedMessagesSignature();
                renderHistorySearchProgress(state, `Загружаю пачку ${state.batches + 1}…`);

                try {
                    control.button.click();
                } catch (error) {
                    console.error('[Message Bookmarks] Не удалось нажать Load Previous Messages.', error);
                    showHistorySearchError(
                        state,
                        'Не удалось продолжить поиск',
                        'Кнопка загрузки исчезла раньше клика. Попробуй ещё раз.',
                        true,
                    );
                    return;
                }

                const batchResult = await waitForHistoryBatch(state, beforeSignature, viewportSnapshot);
                if (batchResult.kind === 'cancelled') return;
                if (batchResult.changed) state.batches += 1;
                updateHistorySearchSeen(state);

                if (batchResult.kind === 'found') {
                    await completeHistorySearch(state);
                    return;
                }
                if (batchResult.kind === 'timeout') {
                    showHistorySearchError(
                        state,
                        'Загрузка не отвечает',
                        'Новая пачка сообщений не появилась. Можно повторить поиск с текущего места.',
                        true,
                    );
                    return;
                }

                renderHistorySearchProgress(state, 'Пачка загружена. Продолжаю поиск…');
            }
        } catch (error) {
            console.error('[Message Bookmarks] Ошибка фонового поиска сообщения.', error);
            if (state.token === historySearchToken) {
                showHistorySearchError(
                    state,
                    'Поиск остановлен',
                    'Во время загрузки истории произошла ошибка. Можно повторить попытку.',
                    true,
                );
            }
        }
    }

    function navigateToLoadedMessage(messageId) {
        if (!getMessageElement(messageId)) return;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => smoothScrollToMessage(messageId));
        });
    }

    function navigateToEntry(entry) {
        closePanel();
        if (getMessageElement(entry.messageId)) {
            navigateToLoadedMessage(entry.messageId);
            return;
        }

        void startHistorySearch(entry);
    }

    function isRootScroller(element) {
        return (
            element === document.scrollingElement
            || element === document.documentElement
            || element === document.body
        );
    }

    function findScrollContainer(element) {
        let node = element?.parentElement;

        while (node && node !== document.body && node !== document.documentElement) {
            const style = getComputedStyle(node);
            const canScroll = /^(auto|scroll|overlay)$/.test(style.overflowY);
            if (canScroll && node.scrollHeight > node.clientHeight + 2) return node;
            node = node.parentElement;
        }

        return document.scrollingElement || document.documentElement;
    }

    function getScrollTop(scroller) {
        if (!isRootScroller(scroller)) return scroller.scrollTop;
        const root = document.scrollingElement || document.documentElement;
        return root.scrollTop || window.scrollY || document.body.scrollTop || 0;
    }

    function setScrollTop(scroller, value) {
        const nextValue = Math.max(0, value);
        if (!isRootScroller(scroller)) {
            scroller.scrollTop = nextValue;
            return;
        }

        const root = document.scrollingElement || document.documentElement;
        root.scrollTop = nextValue;
        if (document.body !== root) document.body.scrollTop = nextValue;
    }

    function getCenteredScrollTop(target, scroller) {
        const currentTop = getScrollTop(scroller);
        const targetRect = target.getBoundingClientRect();
        const rootScroller = isRootScroller(scroller);
        const viewportTop = rootScroller ? 0 : scroller.getBoundingClientRect().top;
        const viewportHeight = rootScroller ? window.innerHeight : scroller.clientHeight;
        const targetCenterInsideViewport = targetRect.top - viewportTop + (targetRect.height / 2);
        const desiredTop = currentTop + targetCenterInsideViewport - (viewportHeight / 2);
        const scrollHeight = rootScroller
            ? Math.max(
                document.documentElement.scrollHeight,
                document.body.scrollHeight,
                scroller.scrollHeight,
            )
            : scroller.scrollHeight;
        const maxTop = Math.max(0, scrollHeight - viewportHeight);
        return Math.max(0, Math.min(maxTop, desiredTop));
    }

    function easeInOutCubic(progress) {
        return progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    }

    function smoothScrollToMessage(messageId) {
        const target = getMessageElement(messageId);
        if (!target) return;

        const token = ++scrollAnimationToken;
        const scroller = findScrollContainer(target);
        const startTop = getScrollTop(scroller);
        const destinationTop = getCenteredScrollTop(target, scroller);
        const distance = Math.abs(destinationTop - startTop);

        if (distance < 2) {
            highlightMessage(messageId);
            return;
        }

        const duration = Math.min(950, Math.max(520, 420 + distance * 0.16));
        const startedAt = performance.now();

        const animate = (now) => {
            if (token !== scrollAnimationToken || !getMessageElement(messageId)) return;

            const progress = Math.min(1, (now - startedAt) / duration);
            const easedProgress = easeInOutCubic(progress);
            setScrollTop(scroller, startTop + (destinationTop - startTop) * easedProgress);

            if (progress < 1) {
                requestAnimationFrame(animate);
                return;
            }

            setScrollTop(scroller, destinationTop);
            window.setTimeout(() => {
                if (token === scrollAnimationToken) highlightMessage(messageId);
            }, 90);
        };

        requestAnimationFrame(animate);
    }

    function highlightMessage(messageId) {
        const message = getMessageElement(messageId);
        const target = findMessageBubble(message);
        if (!target) return;

        for (const highlighted of document.querySelectorAll(`.${HIGHLIGHT_CLASS}`)) {
            highlighted.classList.remove(HIGHLIGHT_CLASS);
        }

        target.classList.remove(HIGHLIGHT_CLASS);
        void target.offsetWidth;
        target.classList.add(HIGHLIGHT_CLASS);

        window.setTimeout(() => {
            const currentMessage = getMessageElement(messageId);
            findMessageBubble(currentMessage)?.classList.remove(HIGHLIGHT_CLASS);
        }, 1350);
    }

    function ensureMarkerPopover() {
        if (markerPopover?.isConnected) return markerPopover;

        markerPopover = document.createElement('div');
        markerPopover.id = MARKER_POPOVER_ID;
        markerPopover.hidden = true;
        markerPopover.setAttribute('role', 'dialog');
        markerPopover.addEventListener('mouseenter', cancelMarkerPopoverClose);
        markerPopover.addEventListener('mouseleave', scheduleMarkerPopoverClose);
        document.body.appendChild(markerPopover);
        return markerPopover;
    }

    function openMarkerPopover(marker, pinned) {
        const entry = getEntry(marker.dataset.messageId);
        if (!entry) return;

        ensureMarkerPopover();
        const sameMarker = markerPopoverState?.marker === marker;
        markerPopoverPinned = Boolean(pinned) || (sameMarker && markerPopoverPinned);
        markerPopoverState = { marker, entryId: entry.id, confirmDelete: false };
        renderMarkerPopover();
        markerPopover.hidden = false;
        marker.setAttribute('aria-expanded', 'true');
        positionMarkerPopover(marker);
    }

    function renderMarkerPopover() {
        if (!markerPopoverState || !markerPopover) return;
        const entry = entries.find((candidate) => candidate.id === markerPopoverState.entryId);
        if (!entry) {
            closeMarkerPopover();
            return;
        }

        markerPopover.replaceChildren();

        const title = document.createElement('div');
        title.className = 'tm-sc-bookmark-popover-title';
        title.textContent = entry.title;
        markerPopover.appendChild(title);

        const actions = document.createElement('div');
        actions.className = 'tm-sc-bookmark-popover-actions';

        if (markerPopoverState.confirmDelete) {
            actions.appendChild(makeConfirmControls(entry, () => {
                if (!markerPopoverState) return;
                markerPopoverState.confirmDelete = false;
                renderMarkerPopover();
                positionMarkerPopover(markerPopoverState.marker);
            }));
        } else {
            const editButton = makeIconButton('Изменить название', icons.pencil);
            editButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                openEditorForEntry(entry);
                closeMarkerPopover();
            });

            const deleteButton = makeIconButton('Удалить закладку', icons.trash, true);
            deleteButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!markerPopoverState) return;
                markerPopoverState.confirmDelete = true;
                markerPopoverPinned = true;
                renderMarkerPopover();
                positionMarkerPopover(markerPopoverState.marker);
            });
            actions.append(editButton, deleteButton);
        }

        markerPopover.appendChild(actions);
    }

    function positionMarkerPopover(marker) {
        if (!markerPopover || markerPopover.hidden || !marker?.isConnected) return;

        const rect = marker.getBoundingClientRect();
        const width = Math.min(286, window.innerWidth - 20);
        const measuredHeight = markerPopover.offsetHeight || 90;
        const left = Math.max(10, Math.min(window.innerWidth - width - 10, rect.right - width));
        const preferredTop = rect.bottom + 7;
        const top = preferredTop + measuredHeight <= window.innerHeight - 10
            ? preferredTop
            : Math.max(10, rect.top - measuredHeight - 7);

        markerPopover.style.left = `${Math.round(left)}px`;
        markerPopover.style.top = `${Math.round(top)}px`;
    }

    function cancelMarkerPopoverClose() {
        if (!markerPopoverCloseTimer) return;
        window.clearTimeout(markerPopoverCloseTimer);
        markerPopoverCloseTimer = null;
    }

    function scheduleMarkerPopoverClose() {
        cancelMarkerPopoverClose();
        if (markerPopoverPinned) return;
        markerPopoverCloseTimer = window.setTimeout(closeMarkerPopover, 180);
    }

    function closeMarkerPopover() {
        cancelMarkerPopoverClose();
        if (markerPopoverState?.marker?.isConnected) {
            markerPopoverState.marker.setAttribute('aria-expanded', 'false');
        }
        if (markerPopover) markerPopover.hidden = true;
        markerPopoverState = null;
        markerPopoverPinned = false;
    }

    function ensureToast() {
        let toast = document.getElementById(TOAST_ID);
        if (toast) return toast;

        toast = document.createElement('div');
        toast.id = TOAST_ID;
        toast.hidden = true;
        toast.setAttribute('role', 'status');
        document.body.appendChild(toast);
        return toast;
    }

    function showToast(text) {
        const toast = ensureToast();
        if (toastTimer) window.clearTimeout(toastTimer);
        toast.textContent = text;
        toast.hidden = false;
        toastTimer = window.setTimeout(() => {
            toast.hidden = true;
            toastTimer = null;
        }, 1200);
    }

    function scheduleEnsure() {
        if (ensureScheduled) return;
        ensureScheduled = true;
        requestAnimationFrame(runDomPass);
    }

    function nodeTouchesBookmarkSurface(node, includeDescendants = true) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
        if (node.closest?.(`#${PANEL_ID}, #${EDITOR_ID}, #${MARKER_POPOVER_ID}, #${HISTORY_SEARCH_ID}, #${TOAST_ID}`)) {
            return false;
        }
        const selector = [
            MESSAGE_SELECTOR,
            MESSAGE_DROPDOWN_SELECTOR,
            SAVED_TEXT_MENU_ITEM_SELECTOR,
            CHAT_DROPDOWN_SELECTOR,
            'button[aria-label="View Saved Chats" i]',
            'time.tm-sc-message-sent-at[datetime]',
            `.${MARKER_CLASS}`,
        ].join(', ');
        return (
            node.matches?.(selector)
            || (includeDescendants && Boolean(node.querySelector?.(selector)))
        );
    }

    function handleRootMutations(records) {
        const timestampAdded = records.some((record) => Array.from(record.addedNodes).some((node) => (
            node?.nodeType === Node.ELEMENT_NODE
            && (
                node.matches?.('time.tm-sc-message-sent-at[datetime]')
                || node.querySelector?.('time.tm-sc-message-sent-at[datetime]')
            )
        )));
        if (timestampAdded) scheduleTimestampBackfill();
        const relevant = records.some((record) => (
            nodeTouchesBookmarkSurface(record.target, false)
            || Array.from(record.addedNodes).some((node) => nodeTouchesBookmarkSurface(node, true))
            || Array.from(record.removedNodes).some((node) => nodeTouchesBookmarkSurface(node, true))
        ));
        if (relevant) scheduleEnsure();
    }

    function ensureAll() {
        ensureContext();
        ensureMessageMenuItems();
        ensureChatMenuItems();
        ensureBookmarkMarkers();
    }

    document.addEventListener('pointerdown', (event) => {
        if (panel && !panel.hidden && !panel.contains(event.target)) {
            if (!event.target.closest(`.${CHAT_MENU_ITEM_CLASS}`)) closePanel();
        }

        if (markerPopover && !markerPopover.hidden) {
            const clickedMarker = event.target.closest(`.${MARKER_CLASS}`);
            if (!markerPopover.contains(event.target) && clickedMarker !== markerPopoverState?.marker) {
                closeMarkerPopover();
            }
        }
    }, true);

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (historySearchOverlay && !historySearchOverlay.hidden) {
            cancelHistorySearch();
            return;
        }
        if (editor && !editor.hidden) {
            closeEditor();
            return;
        }
        if (markerPopover && !markerPopover.hidden) {
            closeMarkerPopover();
            return;
        }
        closePanel();
    });

    window.addEventListener('resize', () => {
        positionPanel();
        if (markerPopoverState?.marker) positionMarkerPopover(markerPopoverState.marker);
    }, { passive: true });

    window.addEventListener('scroll', () => {
        positionPanel();
        if (markerPopoverState?.marker) positionMarkerPopover(markerPopoverState.marker);
    }, { passive: true, capture: true });

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
            ensureAll();

            if (!rootObserver) {
                rootObserver = new MutationObserver(handleRootMutations);
                rootObserver.observe(document.documentElement, { childList: true, subtree: true });
            }
            resetRetry();
        } catch (error) {
            rootObserver?.disconnect();
            rootObserver = null;
            console.error('[Message Bookmarks] DOM-инициализация сорвалась, повторю автоматически.', error);
            scheduleRetry();
        }
    }

    function startDomFeatures() {
        runDomPass();
    }

    // createdAt нужно перехватить до первого запроса истории, поэтому сам перехватчик
    // запускается на document-start, а работа с DOM откладывается до готовности страницы.
    installRouteChangeSignal();
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
