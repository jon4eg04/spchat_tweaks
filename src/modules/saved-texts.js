// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
export default function init(runtime) {
    'use strict';

    const INSTANCE_KEY = '__spicyChatSavedTextsV1';
    if (window[INSTANCE_KEY]) return;
    window[INSTANCE_KEY] = true;

    const TEXTAREA_SELECTOR = 'textarea[placeholder="Message..."]';
    const EMOJI_WRAP_SELECTOR = '#tm-sc-emoji-trigger-wrap';
    const TOOLBAR_ID = 'tm-sc-saved-texts-toolbar';
    const POPUP_ID = 'tm-sc-saved-texts-popup';
    const STYLE_ID = 'tm-sc-saved-texts-style';
    const STORAGE_PREFIX = 'tm-sc-saved-texts-v1:bot:';
    const DELETE_CONFIRM_MS = 2600;
    const MESSAGE_DROPDOWN_SELECTOR = 'button[aria-label="message-dropdown" i]';
    const MESSAGE_TEXT_CLASS_TOKEN = '[overflow-wrap:anywhere]';
    const MESSAGE_SAVE_ITEM_CLASS = 'tm-sc-save-history-message';

    let toolbar = null;
    let openButton = null;
    let saveButton = null;
    let popup = null;
    let searchInput = null;
    let listElement = null;
    let countElement = null;
    let currentBotId = null;
    let loadedBotId = null;
    let entries = [];
    let savedSelection = null;
    let confirmDeleteId = null;
    let confirmDeleteTimer = null;
    let ensureScheduled = false;
    let loadSequence = 0;
    let storageQueue = Promise.resolve();
    let rootObserver = null;
    let retryTimer = null;
    let retryDelay = 250;
    let activeTextarea = null;
    const toolbarFlashTimers = new WeakMap();

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const css = `
            #${TOOLBAR_ID} {
                display: flex !important;
                flex: 0 0 auto !important;
                align-items: flex-end !important;
                align-self: flex-end !important;
                gap: 0 !important;
                margin-bottom: 4px !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button {
                appearance: none !important;
                box-sizing: border-box !important;
                width: 36px !important;
                height: 36px !important;
                min-width: 36px !important;
                padding: 0 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                position: relative !important;
                overflow: visible !important;
                color: rgba(255, 255, 255, 0.9) !important;
                background: transparent !important;
                border: 0 !important;
                border-radius: 9999px !important;
                cursor: pointer !important;
                line-height: 1 !important;
                transition: background-color 120ms ease, color 120ms ease, transform 120ms ease !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button:hover,
            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[aria-expanded="true"] {
                color: #ffffff !important;
                background: rgba(255, 255, 255, 0.11) !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button:active {
                transform: scale(0.94) !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button:focus-visible {
                outline: 2px solid #1687f8 !important;
                outline-offset: 2px !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]::before,
            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]::after {
                position: absolute !important;
                left: 50% !important;
                z-index: 2147483647 !important;
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
                transition: opacity 120ms ease, transform 120ms ease, visibility 0s linear 120ms !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]::before {
                content: attr(data-tm-tooltip) !important;
                bottom: calc(100% + 13px) !important;
                padding: 10px 14px !important;
                color: #ffffff !important;
                background: #070707 !important;
                border: 1px solid rgba(255, 255, 255, 0.24) !important;
                border-radius: 11px !important;
                box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3) !important;
                font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
                font-size: 15px !important;
                font-weight: 500 !important;
                line-height: 1.2 !important;
                letter-spacing: 0 !important;
                text-transform: none !important;
                white-space: nowrap !important;
                transform: translate(-50%, 4px) !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]::after {
                content: "" !important;
                bottom: calc(100% + 8px) !important;
                width: 10px !important;
                height: 10px !important;
                background: #070707 !important;
                border-right: 1px solid rgba(255, 255, 255, 0.24) !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.24) !important;
                transform: translate(-50%, 4px) rotate(45deg) !important;
            }

            @media (hover: hover) and (pointer: fine) {
                #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]:hover::before,
                #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]:hover::after {
                    opacity: 1 !important;
                    visibility: visible !important;
                    transition-delay: 320ms !important;
                }

                #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]:hover::before {
                    transform: translate(-50%, 0) !important;
                }

                #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]:hover::after {
                    transform: translate(-50%, 0) rotate(45deg) !important;
                }
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]:focus-visible::before,
            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]:focus-visible::after {
                opacity: 1 !important;
                visibility: visible !important;
                transition-delay: 0ms !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]:focus-visible::before {
                transform: translate(-50%, 0) !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]:focus-visible::after {
                transform: translate(-50%, 0) rotate(45deg) !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button.is-success {
                color: #72e49a !important;
                background: rgba(46, 190, 99, 0.16) !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button.is-error {
                color: #ff7777 !important;
                background: rgba(255, 70, 70, 0.14) !important;
            }

            #${POPUP_ID} {
                position: fixed !important;
                z-index: 2147483646 !important;
                box-sizing: border-box !important;
                width: min(440px, calc(100vw - 20px)) !important;
                height: min(540px, calc(100vh - 92px)) !important;
                min-height: 300px !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
                color: #f5f5f5 !important;
                color-scheme: dark !important;
                background: #1b1b1d !important;
                border: 1px solid rgba(255, 255, 255, 0.13) !important;
                border-radius: 16px !important;
                box-shadow: 0 18px 55px rgba(0, 0, 0, 0.58), 0 4px 14px rgba(0, 0, 0, 0.34) !important;
                font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
                user-select: none !important;
            }

            #${POPUP_ID}[hidden] {
                display: none !important;
            }

            #${POPUP_ID} .tm-sc-saved-header {
                box-sizing: border-box !important;
                min-height: 52px !important;
                padding: 0 12px 0 16px !important;
                display: flex !important;
                flex: 0 0 auto !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 10px !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.09) !important;
            }

            #${POPUP_ID} .tm-sc-saved-title-wrap {
                min-width: 0 !important;
                display: flex !important;
                align-items: baseline !important;
                gap: 8px !important;
            }

            #${POPUP_ID} .tm-sc-saved-title {
                overflow: hidden !important;
                color: #f5f5f5 !important;
                font-size: 14px !important;
                font-weight: 650 !important;
                line-height: 1.2 !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }

            #${POPUP_ID} .tm-sc-saved-count {
                color: rgba(255, 255, 255, 0.48) !important;
                font-size: 12px !important;
            }

            #${POPUP_ID} .tm-sc-saved-close {
                appearance: none !important;
                width: 32px !important;
                height: 32px !important;
                min-width: 32px !important;
                padding: 0 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: rgba(255, 255, 255, 0.7) !important;
                background: transparent !important;
                border: 0 !important;
                border-radius: 9px !important;
                cursor: pointer !important;
                font: 25px/1 ui-sans-serif, system-ui, sans-serif !important;
            }

            #${POPUP_ID} .tm-sc-saved-close:hover {
                color: #fff !important;
                background: rgba(255, 255, 255, 0.1) !important;
            }

            #${POPUP_ID} .tm-sc-saved-search-wrap {
                box-sizing: border-box !important;
                padding: 10px 12px !important;
                display: flex !important;
                flex: 0 0 auto !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.07) !important;
            }

            #${POPUP_ID} .tm-sc-saved-search {
                appearance: none !important;
                box-sizing: border-box !important;
                width: 100% !important;
                height: 38px !important;
                padding: 0 12px !important;
                color: #f4f4f5 !important;
                background: rgba(255, 255, 255, 0.07) !important;
                border: 1px solid rgba(255, 255, 255, 0.11) !important;
                border-radius: 10px !important;
                outline: 0 !important;
                font: 13px/1.2 Inter, ui-sans-serif, system-ui, sans-serif !important;
                user-select: text !important;
            }

            #${POPUP_ID} .tm-sc-saved-search::placeholder {
                color: rgba(255, 255, 255, 0.42) !important;
            }

            #${POPUP_ID} .tm-sc-saved-search:focus {
                border-color: rgba(39, 143, 255, 0.8) !important;
                box-shadow: 0 0 0 2px rgba(22, 135, 248, 0.15) !important;
            }

            #${POPUP_ID} .tm-sc-saved-list {
                box-sizing: border-box !important;
                padding: 10px !important;
                display: flex !important;
                flex: 1 1 auto !important;
                flex-direction: column !important;
                gap: 8px !important;
                overflow-x: hidden !important;
                overflow-y: auto !important;
                overscroll-behavior: contain !important;
                scrollbar-color: rgba(255, 255, 255, 0.24) transparent !important;
                scrollbar-width: thin !important;
            }

            #${POPUP_ID} .tm-sc-saved-card {
                box-sizing: border-box !important;
                padding: 11px 11px 9px !important;
                display: flex !important;
                flex: 0 0 auto !important;
                flex-direction: column !important;
                gap: 9px !important;
                background: rgba(255, 255, 255, 0.055) !important;
                border: 1px solid rgba(255, 255, 255, 0.09) !important;
                border-radius: 12px !important;
                transition: border-color 100ms ease, background-color 100ms ease !important;
            }

            #${POPUP_ID} .tm-sc-saved-card:hover {
                background: rgba(255, 255, 255, 0.075) !important;
                border-color: rgba(255, 255, 255, 0.14) !important;
            }

            #${POPUP_ID} .tm-sc-saved-card.is-pinned {
                border-color: rgba(39, 143, 255, 0.36) !important;
                box-shadow: inset 3px 0 0 rgba(39, 143, 255, 0.72) !important;
            }

            #${POPUP_ID} .tm-sc-saved-preview {
                appearance: none !important;
                box-sizing: border-box !important;
                width: 100% !important;
                min-width: 0 !important;
                padding: 0 !important;
                display: -webkit-box !important;
                overflow: hidden !important;
                color: rgba(255, 255, 255, 0.91) !important;
                background: transparent !important;
                border: 0 !important;
                cursor: pointer !important;
                font: 13px/1.45 Inter, ui-sans-serif, system-ui, sans-serif !important;
                text-align: left !important;
                overflow-wrap: anywhere !important;
                white-space: pre-wrap !important;
                -webkit-box-orient: vertical !important;
                -webkit-line-clamp: 5 !important;
                user-select: text !important;
            }

            #${POPUP_ID} .tm-sc-saved-card.is-expanded .tm-sc-saved-preview {
                display: block !important;
                overflow: visible !important;
                -webkit-line-clamp: unset !important;
            }

            #${POPUP_ID} .tm-sc-saved-actions {
                display: flex !important;
                align-items: center !important;
                justify-content: flex-end !important;
                gap: 6px !important;
            }

            #${POPUP_ID} .tm-sc-saved-action {
                appearance: none !important;
                box-sizing: border-box !important;
                min-width: 32px !important;
                height: 30px !important;
                padding: 0 8px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 5px !important;
                color: rgba(255, 255, 255, 0.72) !important;
                background: transparent !important;
                border: 0 !important;
                border-radius: 8px !important;
                cursor: pointer !important;
                font: 12px/1 Inter, ui-sans-serif, system-ui, sans-serif !important;
                transition: color 100ms ease, background-color 100ms ease !important;
            }

            #${POPUP_ID} .tm-sc-saved-action:hover {
                color: #ffffff !important;
                background: rgba(255, 255, 255, 0.1) !important;
            }

            #${POPUP_ID} .tm-sc-saved-action.is-primary {
                color: #a9d4ff !important;
                background: rgba(22, 135, 248, 0.14) !important;
            }

            #${POPUP_ID} .tm-sc-saved-action.is-primary:hover {
                color: #ffffff !important;
                background: rgba(22, 135, 248, 0.28) !important;
            }

            #${POPUP_ID} .tm-sc-saved-action.is-active {
                color: #6eb8ff !important;
                background: rgba(22, 135, 248, 0.16) !important;
            }

            #${POPUP_ID} .tm-sc-saved-action.is-danger:hover,
            #${POPUP_ID} .tm-sc-saved-action.is-confirming {
                color: #ff8c8c !important;
                background: rgba(255, 70, 70, 0.14) !important;
            }

            #${POPUP_ID} .tm-sc-saved-empty,
            #${POPUP_ID} .tm-sc-saved-loading {
                box-sizing: border-box !important;
                min-height: 150px !important;
                padding: 46px 20px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: rgba(255, 255, 255, 0.5) !important;
                font-size: 13px !important;
                line-height: 1.45 !important;
                text-align: center !important;
            }

            #${POPUP_ID} svg,
            #${TOOLBAR_ID} svg {
                pointer-events: none !important;
            }
        `;

        if (typeof GM_addStyle === 'function') {
            const style = GM_addStyle(css);
            if (style) style.id = STYLE_ID;
        } else {
            const style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = css;
            document.head.appendChild(style);
        }
    }

    function isVisible(element) {
        if (!element || !element.isConnected) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0
            && rect.height > 0
            && style.display !== 'none'
            && style.visibility !== 'hidden';
    }

    function findTextarea() {
        const candidates = Array.from(document.querySelectorAll(TEXTAREA_SELECTOR)).filter(isVisible);
        return candidates.length ? candidates[candidates.length - 1] : null;
    }

    function findInputWrapper(textarea) {
        const wrapper = textarea.closest('div.w-full.flex');
        if (wrapper && wrapper.parentElement) return wrapper;

        let node = textarea.parentElement;
        for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
            if (node.parentElement && getComputedStyle(node.parentElement).display === 'flex') return node;
        }
        return null;
    }

    function getBotId() {
        const parts = location.pathname.split('/').filter(Boolean);
        if (parts[0] !== 'chat' || !parts[1]) return null;
        return parts[1];
    }

    function getStorageKey(botId) {
        return `${STORAGE_PREFIX}${botId}`;
    }

    async function readValue(key, fallbackValue) {
        try {
            if (typeof GM_getValue === 'function') {
                const value = await Promise.resolve(GM_getValue(key, fallbackValue));
                return value === undefined ? fallbackValue : value;
            }
        } catch (error) {
            console.warn('[Saved Texts] Не удалось прочитать данные Tampermonkey.', error);
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

    function normalizeEntries(value) {
        if (!Array.isArray(value)) return [];
        const now = Date.now();
        return value
            .filter((entry) => entry && typeof entry === 'object' && typeof entry.text === 'string')
            .map((entry, index) => ({
                id: typeof entry.id === 'string' && entry.id
                    ? entry.id
                    : `legacy-${now}-${index}`,
                text: entry.text,
                pinned: Boolean(entry.pinned),
                createdAt: Number.isFinite(Number(entry.createdAt)) ? Number(entry.createdAt) : now - index,
                pinnedAt: Number.isFinite(Number(entry.pinnedAt)) ? Number(entry.pinnedAt) : 0,
            }));
    }

    async function readEntries(botId) {
        return normalizeEntries(await readValue(getStorageKey(botId), []));
    }

    function updateEntries(botId, updater) {
        const operation = storageQueue.then(async () => {
            const latest = await readEntries(botId);
            const next = normalizeEntries(updater(latest));
            await writeValue(getStorageKey(botId), next);
            return next;
        });
        storageQueue = operation.catch(() => undefined);
        return operation;
    }

    function makeId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function flashToolbarButton(button, stateClass, duration = 800) {
        if (!button || !button.isConnected) return;

        const previousTimer = toolbarFlashTimers.get(button);
        if (previousTimer) window.clearTimeout(previousTimer);

        const defaultTooltip = button.dataset.tmTooltipDefault || button.dataset.tmTooltip || '';
        button.dataset.tmTooltip = stateClass === 'is-success' ? 'Сохранено' : defaultTooltip;
        button.classList.remove('is-success', 'is-error');
        button.classList.add(stateClass);

        const timer = window.setTimeout(() => {
            if (button.isConnected) {
                button.classList.remove(stateClass);
                button.dataset.tmTooltip = defaultTooltip;
            }
            toolbarFlashTimers.delete(button);
        }, duration);
        toolbarFlashTimers.set(button, timer);
    }

    function findMessageTextContainer(controls) {
        const message = controls.closest('[id^="message-"]');
        return message && Array.from(message.querySelectorAll('[class]')).find(element =>
            element.classList.contains(MESSAGE_TEXT_CLASS_TOKEN)) || null;
    }

    function serializeFormattedNode(node) {
        if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const element = node;
        const tag = element.tagName;

        if (tag === 'BR') return '\n';
        if (tag === 'IMG') return element.getAttribute('alt') || '';
        if (tag === 'PRE') {
            const code = (element.textContent || '').replace(/^\n+|\n+$/g, '');
            return `\`\`\`\n${code}\n\`\`\``;
        }

        const inner = Array.from(element.childNodes).map(serializeFormattedNode).join('');
        if (!inner) return '';

        if (tag === 'EM' || tag === 'I') return `*${inner}*`;
        if (tag === 'STRONG' || tag === 'B') return `**${inner}**`;
        if (tag === 'DEL' || tag === 'S') return `~~${inner}~~`;
        if (tag === 'CODE') return `\`${inner.replace(/`/g, '\\`')}\``;
        if (tag === 'BLOCKQUOTE') {
            return inner.split('\n').map((line) => `> ${line}`).join('\n');
        }
        if (tag === 'LI') return `- ${inner}\n`;
        if (tag === 'A') {
            const href = element.getAttribute('href');
            if (href && inner.trim() && href !== inner.trim()) return `[${inner}](${href})`;
        }

        return inner;
    }

    function normalizeMessageText(text) {
        return text
            .replace(/\u00a0/g, ' ')
            .replace(/\r\n?/g, '\n')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n[ \t]+/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function extractMessageText(controls) {
        const container = findMessageTextContainer(controls);
        if (!container) return '';

        const blocks = Array.from(container.children)
            .map((child) => normalizeMessageText(serializeFormattedNode(child)))
            .filter(Boolean);

        if (blocks.length) return blocks.join('\n\n');
        return normalizeMessageText(serializeFormattedNode(container));
    }

    const messageMenuIcons = {
        idle: `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round">
                 <path d="M6 3h12a2 2 0 0 1 2 2v16l-8-5-8 5V5a2 2 0 0 1 2-2z"></path>
                 <path d="M12 7v6"></path><path d="M9 10h6"></path>
               </svg>`,
        saving: `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round">
                   <path d="M12 2v4"></path><path d="m16.2 7.8 2.9-2.9"></path>
                   <path d="M18 12h4"></path><path d="m16.2 16.2 2.9 2.9"></path>
                   <path d="M12 18v4"></path><path d="m4.9 19.1 2.9-2.9"></path>
                   <path d="M2 12h4"></path><path d="m4.9 4.9 2.9 2.9"></path>
                 </svg>`,
        success: `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                       viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round">
                    <path d="m5 12 4 4L19 6"></path>
                  </svg>`,
        error: `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                     viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="9"></circle>
                  <path d="m9 9 6 6"></path><path d="m15 9-6 6"></path>
                </svg>`,
    };

    function setMessageMenuButtonState(button, state) {
        const stateData = {
            idle: { label: 'Сохранить', aria: 'Сохранить сообщение' },
            saving: { label: 'Сохраняю…', aria: 'Сохранение сообщения' },
            success: { label: 'Сохранено', aria: 'Сообщение сохранено' },
            error: { label: 'Не удалось сохранить', aria: 'Не удалось сохранить сообщение' },
        }[state];

        button.setAttribute('aria-label', stateData.aria);
        const oldIcon = button.querySelector('svg');
        if (oldIcon) oldIcon.outerHTML = messageMenuIcons[state];
        else button.insertAdjacentHTML('afterbegin', messageMenuIcons[state]);

        const label = button.querySelector('p') || button.querySelector('span');
        if (label) label.textContent = stateData.label;
        else { const span = document.createElement('span'); span.textContent = stateData.label; button.append(span); }
    }

    async function storeSavedText(botId, text) {
        const entry = {
            id: makeId(),
            text,
            pinned: false,
            createdAt: Date.now(),
            pinnedAt: 0,
        };

        const updated = await updateEntries(botId, (latest) => [...latest, entry]);
        if (getBotId() === botId) {
            entries = updated;
            loadedBotId = botId;
            if (popup && !popup.hidden) renderEntries();
        }
        return entry;
    }

    async function saveHistoryMessage(button, controls) {
        if (button.dataset.tmSaving === 'true') return;

        const botId = getBotId();
        const text = extractMessageText(controls);
        if (!botId || !text) {
            setMessageMenuButtonState(button, 'error');
            window.setTimeout(() => {
                if (button.isConnected) setMessageMenuButtonState(button, 'idle');
            }, 1200);
            return;
        }

        button.dataset.tmSaving = 'true';
        button.disabled = true;
        setMessageMenuButtonState(button, 'saving');

        try {
            await storeSavedText(botId, text);
            setMessageMenuButtonState(button, 'success');
            flashToolbarButton(saveButton, 'is-success');

            window.setTimeout(() => {
                if (!button.isConnected) return;
                const dropdownButton = controls.querySelector(MESSAGE_DROPDOWN_SELECTOR);
                dropdownButton?.click();
            }, 650);
        } catch (error) {
            console.error('[Saved Texts] Не удалось сохранить сообщение из истории.', error);
            button.dataset.tmSaving = 'false';
            button.disabled = false;
            setMessageMenuButtonState(button, 'error');
            window.setTimeout(() => {
                if (button.isConnected) setMessageMenuButtonState(button, 'idle');
            }, 1200);
        }
    }

    function ensureMessageSaveMenuItems() {
        for (const context of runtime.dom?.messageMenus() || []) {
            if (context.menu.querySelector(`.${MESSAGE_SAVE_ITEM_CLASS}`)) continue;
            const template = runtime.dom.findAction(context.menu, 'edit') || context.template;
            const button = runtime.dom.cloneMenuButton(template);
            button.classList.add(MESSAGE_SAVE_ITEM_CLASS);
            setMessageMenuButtonState(button, 'idle');
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                const message = runtime.dom.messageFor(button);
                const controls = message?.querySelector(MESSAGE_DROPDOWN_SELECTOR)?.parentElement;
                if (controls) void saveHistoryMessage(button, controls);
            });
            context.menu.appendChild(button);
        }
    }

    function createToolbar() {
        const container = document.createElement('div');
        container.id = TOOLBAR_ID;

        const libraryButton = document.createElement('button');
        libraryButton.type = 'button';
        libraryButton.className = 'tm-sc-saved-toolbar-button tm-sc-open-saved-texts';
        libraryButton.setAttribute('aria-label', 'Открыть сохранённые тексты');
        libraryButton.setAttribute('aria-haspopup', 'dialog');
        libraryButton.setAttribute('aria-expanded', 'false');
        libraryButton.dataset.tmTooltip = 'Сохранённые тексты';
        libraryButton.dataset.tmTooltipDefault = 'Сохранённые тексты';
        libraryButton.innerHTML = `
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <rect width="14" height="15" x="5" y="6" rx="2"></rect>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                <path d="M9 11h6"></path>
                <path d="M9 15h6"></path>
            </svg>
        `;
        libraryButton.addEventListener('mousedown', (event) => event.preventDefault());
        libraryButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            togglePopup();
        });

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'tm-sc-saved-toolbar-button tm-sc-save-current-text';
        addButton.setAttribute('aria-label', 'Сохранить текущий текст');
        addButton.dataset.tmTooltip = 'Сохранить текущий текст';
        addButton.dataset.tmTooltipDefault = 'Сохранить текущий текст';
        addButton.innerHTML = `
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 3h12a2 2 0 0 1 2 2v16l-8-5-8 5V5a2 2 0 0 1 2-2z"></path>
                <path d="M12 7v6"></path>
                <path d="M9 10h6"></path>
            </svg>
        `;
        addButton.addEventListener('mousedown', (event) => event.preventDefault());
        addButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            void saveCurrentText();
        });

        container.append(libraryButton, addButton);
        toolbar = container;
        openButton = libraryButton;
        saveButton = addButton;
        return container;
    }

    function ensureToolbar() {
        ensureScheduled = false;
        ensureMessageSaveMenuItems();

        const botId = getBotId();
        if (botId !== currentBotId) {
            currentBotId = botId;
            loadedBotId = null;
            entries = [];
            closePopup();
        }

        const textarea = findTextarea();
        const inputWrapper = textarea && findInputWrapper(textarea);
        const row = inputWrapper && inputWrapper.parentElement;
        const oldToolbar = document.getElementById(TOOLBAR_ID);

        if (!botId || !textarea || !inputWrapper || !row) {
            activeTextarea = null;
            if (oldToolbar) oldToolbar.remove();
            toolbar = null;
            openButton = null;
            saveButton = null;
            return;
        }

        activeTextarea = textarea;
        row.style.setProperty('column-gap', '0px', 'important');

        let activeToolbar = oldToolbar;
        if (!activeToolbar || activeToolbar.parentElement !== row) {
            if (activeToolbar) activeToolbar.remove();
            activeToolbar = createToolbar();
        } else {
            toolbar = activeToolbar;
            openButton = activeToolbar.querySelector('.tm-sc-open-saved-texts');
            saveButton = activeToolbar.querySelector('.tm-sc-save-current-text');
        }

        // Держим пару кнопок непосредственно перед эмодзи. Если эмодзи-пикера нет — перед полем.
        const emojiWrap = row.querySelector(EMOJI_WRAP_SELECTOR);
        const anchor = emojiWrap || inputWrapper;
        if (activeToolbar.parentElement !== row || activeToolbar.nextElementSibling !== anchor) {
            row.insertBefore(activeToolbar, anchor);
        }

        if (!popup) createPopup();
    }

    function scheduleEnsureToolbar() {
        if (ensureScheduled) return;
        ensureScheduled = true;
        requestAnimationFrame(ensureDomFeatures);
    }

    function nodeContainsSavedTextsFeature(node, includeDescendants = true) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
        const selector = [
            TEXTAREA_SELECTOR,
            'button[aria-label="Copy" i], [role="menu"]',
            `#${TOOLBAR_ID}`,
            EMOJI_WRAP_SELECTOR,
        ].join(', ');
        return node.matches?.(selector) || (includeDescendants && Boolean(node.querySelector?.(selector)));
    }

    function handleRootMutations(records) {
        const relevant = Boolean(activeTextarea && !activeTextarea.isConnected) || records.some((record) => (
            nodeContainsSavedTextsFeature(record.target, false)
            || Array.from(record.addedNodes).some((node) => nodeContainsSavedTextsFeature(node, true))
            || Array.from(record.removedNodes).some((node) => nodeContainsSavedTextsFeature(node, true))
        ));
        if (relevant) scheduleEnsureToolbar();
    }

    function createPopup() {
        popup = document.createElement('section');
        popup.id = POPUP_ID;
        popup.hidden = true;
        popup.setAttribute('role', 'dialog');
        popup.setAttribute('aria-label', 'Сохранённые тексты');

        const header = document.createElement('div');
        header.className = 'tm-sc-saved-header';

        const titleWrap = document.createElement('div');
        titleWrap.className = 'tm-sc-saved-title-wrap';

        const title = document.createElement('div');
        title.className = 'tm-sc-saved-title';
        title.textContent = 'Сохранённые тексты';

        countElement = document.createElement('span');
        countElement.className = 'tm-sc-saved-count';
        countElement.textContent = '0';

        titleWrap.append(title, countElement);

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'tm-sc-saved-close';
        closeButton.setAttribute('aria-label', 'Закрыть');
        closeButton.title = 'Закрыть';
        closeButton.textContent = '×';
        closeButton.addEventListener('click', closePopup);

        header.append(titleWrap, closeButton);

        const searchWrap = document.createElement('div');
        searchWrap.className = 'tm-sc-saved-search-wrap';

        searchInput = document.createElement('input');
        searchInput.type = 'search';
        searchInput.className = 'tm-sc-saved-search';
        searchInput.placeholder = 'Поиск по сохранённым текстам…';
        searchInput.autocomplete = 'off';
        searchInput.spellcheck = false;
        searchInput.addEventListener('input', renderEntries);
        searchWrap.appendChild(searchInput);

        listElement = document.createElement('div');
        listElement.className = 'tm-sc-saved-list';

        popup.append(header, searchWrap, listElement);
        document.body.appendChild(popup);
    }

    function sortEntries(items) {
        return items.slice().sort((left, right) => {
            if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
            if (left.pinned) {
                return (right.pinnedAt || right.createdAt) - (left.pinnedAt || left.createdAt);
            }
            return right.createdAt - left.createdAt;
        });
    }

    function iconButton(label, className, svg) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `tm-sc-saved-action ${className}`;
        button.setAttribute('aria-label', label);
        button.title = label;
        button.innerHTML = svg;
        button.addEventListener('mousedown', (event) => event.preventDefault());
        return button;
    }

    function renderEntries() {
        if (!listElement || !searchInput) return;
        countElement.textContent = String(entries.length);

        const query = searchInput.value.trim().toLocaleLowerCase();
        const visibleEntries = sortEntries(entries).filter((entry) => (
            !query || entry.text.toLocaleLowerCase().includes(query)
        ));

        const fragment = document.createDocumentFragment();
        for (const entry of visibleEntries) {
            const card = document.createElement('article');
            card.className = `tm-sc-saved-card${entry.pinned ? ' is-pinned' : ''}`;
            card.dataset.entryId = entry.id;

            const preview = document.createElement('button');
            preview.type = 'button';
            preview.className = 'tm-sc-saved-preview';
            preview.textContent = entry.text;
            preview.title = 'Развернуть или свернуть текст';
            preview.setAttribute('aria-expanded', 'false');
            preview.addEventListener('click', () => {
                const expanded = card.classList.toggle('is-expanded');
                preview.setAttribute('aria-expanded', String(expanded));
            });

            const actions = document.createElement('div');
            actions.className = 'tm-sc-saved-actions';

            const insertButton = iconButton(
                'Вставить',
                'is-primary',
                `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path>
                 </svg><span>Вставить</span>`,
            );
            insertButton.addEventListener('click', () => insertSavedText(entry.text));

            const pinButton = iconButton(
                entry.pinned ? 'Открепить' : 'Закрепить',
                entry.pinned ? 'is-active' : '',
                `<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 17v5"></path><path d="M5 17h14"></path>
                    <path d="m6 3 2 7-2 3h12l-2-3 2-7z"></path>
                 </svg>`,
            );
            pinButton.addEventListener('click', () => void togglePinned(entry.id));

            const confirming = confirmDeleteId === entry.id;
            const deleteButton = iconButton(
                confirming ? 'Подтвердить удаление' : 'Удалить',
                `is-danger${confirming ? ' is-confirming' : ''}`,
                confirming
                    ? '<span>Точно?</span>'
                    : `<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none"
                           stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                         <path d="M3 6h18"></path><path d="M8 6V4h8v2"></path>
                         <path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v5"></path><path d="M14 11v5"></path>
                       </svg>`,
            );
            deleteButton.addEventListener('click', () => void requestDelete(entry.id));

            actions.append(insertButton, pinButton, deleteButton);
            card.append(preview, actions);
            fragment.appendChild(card);
        }

        listElement.replaceChildren(fragment);

        if (!visibleEntries.length) {
            const empty = document.createElement('div');
            empty.className = 'tm-sc-saved-empty';
            empty.textContent = entries.length
                ? 'По этому запросу ничего не найдено.'
                : 'Здесь пока пусто. Сохрани текущий текст соседней кнопкой.';
            listElement.appendChild(empty);
        }
    }

    function showLoading() {
        if (!listElement) return;
        const loading = document.createElement('div');
        loading.className = 'tm-sc-saved-loading';
        loading.textContent = 'Загружаю сохранённые тексты…';
        listElement.replaceChildren(loading);
    }

    function rememberTextareaSelection(textarea) {
        savedSelection = {
            textarea,
            start: typeof textarea.selectionStart === 'number' ? textarea.selectionStart : textarea.value.length,
            end: typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : textarea.value.length,
        };
    }

    async function openPopup() {
        const textarea = findTextarea();
        const botId = getBotId();
        if (!textarea || !botId) return;

        rememberTextareaSelection(textarea);
        currentBotId = botId;
        searchInput.value = '';
        confirmDeleteId = null;
        popup.hidden = false;
        openButton?.setAttribute('aria-expanded', 'true');
        showLoading();
        requestAnimationFrame(() => {
            positionPopup();
            searchInput.focus({ preventScroll: true });
        });

        const sequence = ++loadSequence;
        try {
            const loaded = await readEntries(botId);
            if (sequence !== loadSequence || getBotId() !== botId || popup.hidden) return;
            entries = loaded;
            loadedBotId = botId;
            renderEntries();
        } catch (error) {
            console.error('[Saved Texts] Не удалось загрузить сохранённые тексты.', error);
            if (sequence === loadSequence && !popup.hidden) {
                listElement.textContent = 'Не удалось загрузить сохранённые тексты.';
            }
        }
    }

    function closePopup() {
        if (!popup || popup.hidden) return;
        popup.hidden = true;
        loadSequence += 1;
        openButton?.setAttribute('aria-expanded', 'false');
        confirmDeleteId = null;
        if (confirmDeleteTimer) window.clearTimeout(confirmDeleteTimer);
        confirmDeleteTimer = null;
    }

    function togglePopup() {
        if (!popup || popup.hidden) void openPopup();
        else closePopup();
    }

    function positionPopup() {
        if (!popup || popup.hidden || !openButton || !openButton.isConnected) return;

        const margin = 10;
        const gap = 10;
        const buttonRect = openButton.getBoundingClientRect();
        const popupRect = popup.getBoundingClientRect();

        let left = buttonRect.left;
        let top = buttonRect.top - popupRect.height - gap;
        left = Math.max(margin, Math.min(left, window.innerWidth - popupRect.width - margin));
        if (top < margin) top = buttonRect.bottom + gap;
        top = Math.max(margin, Math.min(top, window.innerHeight - popupRect.height - margin));

        popup.style.left = `${Math.round(left)}px`;
        popup.style.top = `${Math.round(top)}px`;
    }

    async function saveCurrentText() {
        const textarea = findTextarea();
        const botId = getBotId();
        const button = saveButton;

        if (!textarea || !botId || !textarea.value.trim()) {
            flashToolbarButton(button, 'is-error');
            return;
        }

        try {
            await storeSavedText(botId, textarea.value);
            flashToolbarButton(button, 'is-success');
        } catch (error) {
            console.error('[Saved Texts] Не удалось сохранить текст.', error);
            flashToolbarButton(button, 'is-error');
        }
    }

    async function togglePinned(entryId) {
        const botId = getBotId();
        if (!botId) return;

        try {
            const updated = await updateEntries(botId, (latest) => latest.map((entry) => {
                if (entry.id !== entryId) return entry;
                const pinned = !entry.pinned;
                return { ...entry, pinned, pinnedAt: pinned ? Date.now() : 0 };
            }));
            if (getBotId() === botId) {
                entries = updated;
                loadedBotId = botId;
                renderEntries();
            }
        } catch (error) {
            console.error('[Saved Texts] Не удалось изменить закрепление.', error);
        }
    }

    async function requestDelete(entryId) {
        if (confirmDeleteId !== entryId) {
            confirmDeleteId = entryId;
            if (confirmDeleteTimer) window.clearTimeout(confirmDeleteTimer);
            confirmDeleteTimer = window.setTimeout(() => {
                confirmDeleteId = null;
                confirmDeleteTimer = null;
                if (popup && !popup.hidden) renderEntries();
            }, DELETE_CONFIRM_MS);
            renderEntries();
            return;
        }

        const botId = getBotId();
        if (!botId) return;
        confirmDeleteId = null;
        if (confirmDeleteTimer) window.clearTimeout(confirmDeleteTimer);
        confirmDeleteTimer = null;

        try {
            const updated = await updateEntries(botId, (latest) => (
                latest.filter((entry) => entry.id !== entryId)
            ));
            if (getBotId() === botId) {
                entries = updated;
                loadedBotId = botId;
                renderEntries();
            }
        } catch (error) {
            console.error('[Saved Texts] Не удалось удалить текст.', error);
        }
    }

    function setNativeTextareaValue(textarea, value) {
        const prototype = Object.getPrototypeOf(textarea);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        if (descriptor && descriptor.set) descriptor.set.call(textarea, value);
        else textarea.value = value;
    }

    function insertSavedText(text) {
        const textarea = findTextarea();
        if (!textarea) return;

        const remembered = savedSelection && savedSelection.textarea === textarea
            ? savedSelection
            : null;
        const rawStart = remembered
            ? remembered.start
            : (typeof textarea.selectionStart === 'number' ? textarea.selectionStart : textarea.value.length);
        const rawEnd = remembered
            ? remembered.end
            : (typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : rawStart);
        const start = Math.max(0, Math.min(rawStart, textarea.value.length));
        const end = Math.max(start, Math.min(rawEnd, textarea.value.length));
        const nextValue = textarea.value.slice(0, start) + text + textarea.value.slice(end);
        const maxLength = textarea.maxLength > 0 ? textarea.maxLength : Infinity;

        if (nextValue.length > maxLength) {
            console.warn('[Saved Texts] Текст не помещается в ограничение поля ввода.');
            return;
        }

        textarea.focus({ preventScroll: true });
        textarea.setSelectionRange(start, end);

        let insertedWithCommand = false;
        try {
            insertedWithCommand = document.execCommand('insertText', false, text);
        } catch (_error) {
            insertedWithCommand = false;
        }

        const nextCursorPosition = start + text.length;
        if (!insertedWithCommand || textarea.value !== nextValue) {
            setNativeTextareaValue(textarea, nextValue);
            const inputEvent = typeof InputEvent === 'function'
                ? new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })
                : new Event('input', { bubbles: true });
            textarea.dispatchEvent(inputEvent);
        }

        closePopup();
        requestAnimationFrame(() => {
            if (!textarea.isConnected) return;
            textarea.focus({ preventScroll: true });
            textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
        });
    }

    document.addEventListener('pointerdown', (event) => {
        if (!popup || popup.hidden) return;
        if (popup.contains(event.target)) return;
        if (openButton && openButton.contains(event.target)) return;
        closePopup();
    }, true);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closePopup();
    });

    window.addEventListener('resize', positionPopup, { passive: true });
    window.addEventListener('scroll', (event) => {
        if (popup && !popup.hidden && !popup.contains(event.target)) positionPopup();
    }, { passive: true, capture: true });

    function scheduleRetry() {
        if (retryTimer) return;
        const delay = retryDelay;
        retryDelay = Math.min(8000, retryDelay * 2);
        retryTimer = window.setTimeout(() => {
            retryTimer = null;
            ensureDomFeatures();
        }, delay);
    }

    function resetRetry() {
        if (retryTimer) window.clearTimeout(retryTimer);
        retryTimer = null;
        retryDelay = 250;
    }

    function ensureDomFeatures() {
        ensureScheduled = false;
        if (!document.documentElement || !document.head || !document.body) return;

        try {
            addStyles();
            ensureToolbar();

            if (!rootObserver) {
                rootObserver = new MutationObserver(handleRootMutations);
                rootObserver.observe(document.documentElement, { childList: true, subtree: true });
            }
            resetRetry();
        } catch (error) {
            rootObserver?.disconnect();
            rootObserver = null;
            console.error('[Saved Texts] Инициализация сорвалась, повторю автоматически.', error);
            scheduleRetry();
        }
    }

    ensureDomFeatures();

    window.addEventListener('pageshow', ensureDomFeatures);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) ensureDomFeatures();
    });
    runtime.dom?.subscribe(scheduleEnsureToolbar);

}
