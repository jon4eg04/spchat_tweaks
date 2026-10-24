// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
export default function init(runtime) {
    'use strict';

    // Previously @grant none: network overrides must still target the page.
    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    const INSTANCE_KEY = '__tmScPerChatResponseLengthV1';
    if (window[INSTANCE_KEY]) return;
    window[INSTANCE_KEY] = true;

    const STORAGE_KEY = 'tm-sc-per-chat-response-length-v1';
    const MODEL_STORAGE_KEY = 'tm-sc-per-chat-inference-model-v1';
    const COMMAND_STORAGE_KEY = 'tm-sc-per-chat-persistent-command-v1';
    const STYLE_ID = 'tm-sc-per-chat-response-length-style';
    const POPUP_ID = 'tm-sc-response-length-popup';
    const COMMAND_POPUP_ID = 'tm-sc-persistent-command-popup';
    const MENU_ITEM_CLASS = 'tm-sc-response-length-menu-item';
    const COMMAND_MENU_ITEM_CLASS = 'tm-sc-persistent-command-menu-item';
    const PLUS_BUTTON_SELECTOR = 'button[aria-label="Plus-button"], button[aria-label="Plus button"]';
    const NATIVE_MENU_ITEM_SELECTOR = [
        'button[aria-label="Generate Image"]',
        'button[aria-label="Web Search"]',
        'button[aria-label="Command (OOC)"]',
    ].join(', ');
    const GENERATION_PATH = '/chat';
    const MIN_TOKENS = 100;
    const MAX_TOKENS = 500;
    const TOKEN_STEP = 20;
    const INITIAL_TOKENS = 300;
    const INFERENCE_MODELS = [
        { id: '', label: 'Как выбрано на сайте' },
        { id: 'qwenplus-character', label: 'Qwen Plus Character' },
        { id: 'deepseek-v4pro', label: 'Deepseek V4 Pro' },
        { id: 'glm51', label: 'Glam 5.1' },
        { id: 'glm45', label: 'Glam 4.6' },
    ];
    const INFERENCE_MODEL_IDS = new Set(
        INFERENCE_MODELS.map(({ id }) => id).filter(Boolean),
    );
    const XHR_META = Symbol('tmScResponseLengthRequest');

    let popup = null;
    let popupAnchor = null;
    let commandPopup = null;
    let commandPopupAnchor = null;
    let rootObserver = null;
    let ensureScheduled = false;
    let observerRetryTimer = null;
    let observerRetryDelay = 250;
    let uiStarted = false;

    function normalizeConversationId(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    function normalizeTokenLimit(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return null;
        const rounded = Math.round(number);
        return Math.min(MAX_TOKENS, Math.max(MIN_TOKENS, rounded));
    }

    function readSettings() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

            const normalized = {};
            for (const [conversationId, rawLimit] of Object.entries(parsed)) {
                const id = normalizeConversationId(conversationId);
                const limit = normalizeTokenLimit(rawLimit);
                if (id && limit !== null) normalized[id] = limit;
            }
            return normalized;
        } catch (_error) {
            return {};
        }
    }

    function getSavedLimit(conversationId) {
        const id = normalizeConversationId(conversationId);
        if (!id) return null;
        return readSettings()[id] ?? null;
    }

    function saveLimit(conversationId, value) {
        const id = normalizeConversationId(conversationId);
        const limit = normalizeTokenLimit(value);
        if (!id || limit === null) return false;

        const settings = readSettings();
        settings[id] = limit;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            return true;
        } catch (error) {
            console.warn('[Response Length] Не удалось сохранить настройку.', error);
            return false;
        }
    }

    function normalizeInferenceModel(value) {
        return typeof value === 'string' && INFERENCE_MODEL_IDS.has(value) ? value : '';
    }

    function readModels() {
        try {
            const parsed = JSON.parse(localStorage.getItem(MODEL_STORAGE_KEY) || '{}');
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

            const normalized = {};
            for (const [conversationId, rawModel] of Object.entries(parsed)) {
                const id = normalizeConversationId(conversationId);
                const model = normalizeInferenceModel(rawModel);
                if (id && model) normalized[id] = model;
            }
            return normalized;
        } catch (_error) {
            return {};
        }
    }

    function getSavedModel(conversationId) {
        const id = normalizeConversationId(conversationId);
        if (!id) return '';
        return readModels()[id] || '';
    }

    function saveModel(conversationId, value) {
        const id = normalizeConversationId(conversationId);
        if (!id) return false;

        const rawModel = typeof value === 'string' ? value : '';
        const model = normalizeInferenceModel(rawModel);
        if (rawModel && !model) return false;

        const models = readModels();
        if (model) models[id] = model;
        else delete models[id];
        try {
            localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(models));
            return true;
        } catch (error) {
            console.warn('[Inference Model] Не удалось сохранить модель.', error);
            return false;
        }
    }

    function getModelLabel(modelId) {
        return INFERENCE_MODELS.find(({ id }) => id === modelId)?.label
            || INFERENCE_MODELS[0].label;
    }

    function normalizeCommand(value) {
        if (typeof value !== 'string') return '';
        return value.trim().replace(/^\/cmd(?:\s+|$)/i, '').trim();
    }

    function readCommands() {
        try {
            const parsed = JSON.parse(localStorage.getItem(COMMAND_STORAGE_KEY) || '{}');
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

            const normalized = {};
            for (const [conversationId, rawCommand] of Object.entries(parsed)) {
                const id = normalizeConversationId(conversationId);
                const command = normalizeCommand(rawCommand);
                if (id && command) normalized[id] = command;
            }
            return normalized;
        } catch (_error) {
            return {};
        }
    }

    function getSavedCommand(conversationId) {
        const id = normalizeConversationId(conversationId);
        if (!id) return '';
        return readCommands()[id] || '';
    }

    function saveCommand(conversationId, value) {
        const id = normalizeConversationId(conversationId);
        const command = normalizeCommand(value);
        if (!id || !command) return false;

        const commands = readCommands();
        commands[id] = command;
        try {
            localStorage.setItem(COMMAND_STORAGE_KEY, JSON.stringify(commands));
            return true;
        } catch (error) {
            console.warn('[Persistent Command] Не удалось сохранить команду.', error);
            return false;
        }
    }

    function deleteCommand(conversationId) {
        const id = normalizeConversationId(conversationId);
        if (!id) return false;

        const commands = readCommands();
        delete commands[id];
        try {
            localStorage.setItem(COMMAND_STORAGE_KEY, JSON.stringify(commands));
            return true;
        } catch (error) {
            console.warn('[Persistent Command] Не удалось удалить команду.', error);
            return false;
        }
    }

    function getCurrentChatContext() {
        const parts = location.pathname.split('/').filter(Boolean);
        if (parts[0] !== 'chat' || !parts[2]) return null;
        return {
            characterId: parts[1] || '',
            conversationId: normalizeConversationId(parts[2]),
        };
    }

    function readRequestUrl(input) {
        if (typeof input === 'string') return input;
        if (input instanceof URL) return input.href;
        return typeof input?.url === 'string' ? input.url : '';
    }

    function isGenerationRequest(rawUrl, method) {
        if (String(method || 'GET').toUpperCase() !== 'POST') return false;
        try {
            const url = new URL(rawUrl, location.origin);
            const trustedHost = url.hostname === 'nd-api.com' || url.hostname.endsWith('.nd-api.com');
            return trustedHost && url.pathname.replace(/\/+$/, '') === GENERATION_PATH;
        } catch (_error) {
            return false;
        }
    }

    function rewriteGenerationBody(body) {
        if (typeof body !== 'string' || !body) return body;

        try {
            const payload = JSON.parse(body);
            const conversationId = normalizeConversationId(payload?.conversation_id);
            const savedLimit = getSavedLimit(conversationId);
            const savedModel = getSavedModel(conversationId);
            const savedCommand = getSavedCommand(conversationId);
            let changed = false;

            if (
                savedLimit !== null
                && payload?.inference_settings
                && typeof payload.inference_settings === 'object'
                && Object.prototype.hasOwnProperty.call(payload.inference_settings, 'max_new_tokens')
                && payload.inference_settings.max_new_tokens !== savedLimit
            ) {
                payload.inference_settings.max_new_tokens = savedLimit;
                changed = true;
            }

            if (
                savedModel
                && typeof payload.inference_model === 'string'
                && payload.inference_model !== savedModel
            ) {
                payload.inference_model = savedModel;
                changed = true;
            }

            if (savedCommand && typeof payload.message === 'string' && payload.message.trim()) {
                const commandSuffix = `/cmd ${savedCommand}`;
                const originalMessage = payload.message.trimEnd();
                if (!originalMessage.endsWith(commandSuffix)) {
                    payload.message = `${originalMessage}\n\n${commandSuffix}`;
                    changed = true;
                }
            }

            return changed ? JSON.stringify(payload) : body;
        } catch (_error) {
            return body;
        }
    }

    function installNetworkOverride() {
        try {
            const originalFetch = pageWindow.fetch;
            if (typeof originalFetch === 'function') {
                pageWindow.fetch = function (input, options) {
                    const method = options?.method || input?.method || 'GET';
                    const rawUrl = readRequestUrl(input);
                    if (!isGenerationRequest(rawUrl, method)) {
                        return Reflect.apply(originalFetch, this, arguments);
                    }

                    if (typeof options?.body === 'string') {
                        const rewrittenBody = rewriteGenerationBody(options.body);
                        if (rewrittenBody === options.body) {
                            return Reflect.apply(originalFetch, this, arguments);
                        }
                        return Reflect.apply(originalFetch, this, [
                            input,
                            { ...options, body: rewrittenBody },
                        ]);
                    }

                    if (input && typeof input.clone === 'function' && options?.body === undefined) {
                        const receiver = this;
                        let clone;
                        try {
                            clone = input.clone();
                        } catch (_error) {
                            return Reflect.apply(originalFetch, receiver, arguments);
                        }

                        const originalArguments = options === undefined ? [input] : [input, options];
                        return clone.text().then((body) => {
                            try {
                                const rewrittenBody = rewriteGenerationBody(body);
                                if (rewrittenBody === body) {
                                    return Reflect.apply(originalFetch, receiver, originalArguments);
                                }

                                const RequestConstructor = pageWindow.Request;
                                if (typeof RequestConstructor !== 'function') {
                                    return Reflect.apply(originalFetch, receiver, originalArguments);
                                }
                                const replacement = new RequestConstructor(input, {
                                    ...(options || {}),
                                    body: rewrittenBody,
                                });
                                return Reflect.apply(originalFetch, receiver, [replacement]);
                            } catch (_error) {
                                return Reflect.apply(originalFetch, receiver, originalArguments);
                            }
                        }, () => Reflect.apply(originalFetch, receiver, originalArguments));
                    }

                    return Reflect.apply(originalFetch, this, arguments);
                };
            }
        } catch (error) {
            console.warn('[Response Length] Не удалось подключиться к fetch.', error);
        }

        try {
            const prototype = pageWindow.XMLHttpRequest?.prototype;
            if (!prototype) return;
            const originalOpen = prototype.open;
            const originalSend = prototype.send;

            prototype.open = function (method, url) {
                this[XHR_META] = {
                    method: String(method || 'GET'),
                    url: readRequestUrl(url),
                };
                return Reflect.apply(originalOpen, this, arguments);
            };

            prototype.send = function (body) {
                const meta = this[XHR_META];
                if (meta && isGenerationRequest(meta.url, meta.method) && typeof body === 'string') {
                    const rewrittenBody = rewriteGenerationBody(body);
                    if (rewrittenBody !== body) {
                        return Reflect.apply(originalSend, this, [rewrittenBody]);
                    }
                }
                return Reflect.apply(originalSend, this, arguments);
            };
        } catch (error) {
            console.warn('[Response Length] Не удалось подключиться к XMLHttpRequest.', error);
        }
    }

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${POPUP_ID}[hidden],
            #${COMMAND_POPUP_ID}[hidden] {
                display: none !important;
            }

            #${POPUP_ID},
            #${COMMAND_POPUP_ID} {
                position: fixed !important;
                z-index: 2147483646 !important;
                box-sizing: border-box !important;
                width: min(340px, calc(100vw - 24px)) !important;
                padding: 18px !important;
                color: #ffffff !important;
                background: #292929 !important;
                border: 1px solid rgba(255, 255, 255, 0.14) !important;
                border-radius: 14px !important;
                box-shadow: 0 14px 45px rgba(0, 0, 0, 0.48) !important;
                font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
            }

            #${POPUP_ID} .tm-sc-response-length-title,
            #${COMMAND_POPUP_ID} .tm-sc-persistent-command-title {
                margin: 0 !important;
                color: #ffffff !important;
                font-size: 18px !important;
                font-weight: 700 !important;
                line-height: 1.25 !important;
            }

            #${POPUP_ID} .tm-sc-response-length-caption,
            #${COMMAND_POPUP_ID} .tm-sc-persistent-command-caption {
                margin: 5px 0 16px !important;
                color: rgba(255, 255, 255, 0.62) !important;
                font-size: 13px !important;
                line-height: 1.35 !important;
            }

            #${POPUP_ID} .tm-sc-response-length-value-row {
                display: flex !important;
                align-items: baseline !important;
                justify-content: space-between !important;
                gap: 12px !important;
                margin-bottom: 9px !important;
            }

            #${POPUP_ID} .tm-sc-response-length-value-label {
                color: rgba(255, 255, 255, 0.76) !important;
                font-size: 14px !important;
            }

            #${POPUP_ID} .tm-sc-response-length-value {
                min-width: 54px !important;
                color: #ffffff !important;
                font-size: 20px !important;
                font-weight: 700 !important;
                text-align: right !important;
            }

            #${POPUP_ID} .tm-sc-response-length-slider {
                appearance: auto !important;
                box-sizing: border-box !important;
                width: 100% !important;
                margin: 2px 0 5px !important;
                accent-color: #258cf4 !important;
                cursor: pointer !important;
            }

            #${POPUP_ID} .tm-sc-response-length-scale {
                display: flex !important;
                justify-content: space-between !important;
                margin-bottom: 16px !important;
                color: rgba(255, 255, 255, 0.48) !important;
                font-size: 12px !important;
            }

            #${POPUP_ID} .tm-sc-response-model-field {
                margin-bottom: 17px !important;
            }

            #${POPUP_ID} .tm-sc-response-model-label {
                display: block !important;
                margin-bottom: 7px !important;
                color: rgba(255, 255, 255, 0.76) !important;
                font-size: 14px !important;
            }

            #${POPUP_ID} .tm-sc-response-model-select {
                appearance: auto !important;
                box-sizing: border-box !important;
                width: 100% !important;
                min-height: 40px !important;
                padding: 8px 10px !important;
                color: #ffffff !important;
                color-scheme: dark !important;
                background: rgba(0, 0, 0, 0.24) !important;
                border: 1px solid rgba(255, 255, 255, 0.18) !important;
                border-radius: 9px !important;
                outline: none !important;
                font: inherit !important;
                font-size: 14px !important;
                cursor: pointer !important;
            }

            #${POPUP_ID} .tm-sc-response-model-select:focus {
                border-color: #258cf4 !important;
                box-shadow: 0 0 0 2px rgba(37, 140, 244, 0.2) !important;
            }

            #${POPUP_ID} .tm-sc-response-model-select option {
                color: #ffffff !important;
                background: #292929 !important;
            }

            #${POPUP_ID} .tm-sc-response-length-save {
                appearance: none !important;
                box-sizing: border-box !important;
                width: 100% !important;
                min-height: 40px !important;
                padding: 9px 16px !important;
                color: #ffffff !important;
                background: #2869aa !important;
                border: 0 !important;
                border-radius: 9px !important;
                cursor: pointer !important;
                font: inherit !important;
                font-size: 15px !important;
                font-weight: 650 !important;
                transition: background-color 120ms ease, opacity 120ms ease !important;
            }

            #${POPUP_ID} .tm-sc-response-length-save:hover {
                background: #327bc4 !important;
            }

            #${POPUP_ID} .tm-sc-response-length-save:disabled {
                opacity: 0.45 !important;
                cursor: default !important;
            }

            #${POPUP_ID} .tm-sc-response-length-error,
            #${COMMAND_POPUP_ID} .tm-sc-persistent-command-error {
                margin: 0 0 12px !important;
                color: #ff9d9d !important;
                font-size: 13px !important;
                line-height: 1.35 !important;
            }

            .${MENU_ITEM_CLASS},
            .${COMMAND_MENU_ITEM_CLASS} {
                box-sizing: border-box !important;
                width: 340px !important;
                max-width: calc(100vw - 24px) !important;
                overflow: hidden !important;
            }

            .${MENU_ITEM_CLASS} .tm-sc-response-length-menu-copy,
            .${COMMAND_MENU_ITEM_CLASS} .tm-sc-response-length-menu-copy {
                display: flex !important;
                width: 0 !important;
                min-width: 0 !important;
                flex: 1 1 auto !important;
                flex-direction: column !important;
                align-items: flex-start !important;
                gap: 1px !important;
            }

            .${MENU_ITEM_CLASS} .tm-sc-response-length-menu-title,
            .${COMMAND_MENU_ITEM_CLASS} .tm-sc-response-length-menu-title {
                color: inherit !important;
                font: inherit !important;
                line-height: 1.25 !important;
            }

            .${MENU_ITEM_CLASS} .tm-sc-response-length-menu-value,
            .${COMMAND_MENU_ITEM_CLASS} .tm-sc-response-length-menu-value {
                max-width: 100% !important;
                overflow: hidden !important;
                color: rgba(255, 255, 255, 0.58) !important;
                font-size: 12px !important;
                line-height: 1.25 !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }

            #${COMMAND_POPUP_ID} .tm-sc-persistent-command-input {
                box-sizing: border-box !important;
                width: 100% !important;
                min-height: 130px !important;
                resize: vertical !important;
                margin: 0 0 14px !important;
                padding: 11px 12px !important;
                color: #ffffff !important;
                caret-color: #ffffff !important;
                background: rgba(0, 0, 0, 0.24) !important;
                border: 1px solid rgba(255, 255, 255, 0.18) !important;
                border-radius: 9px !important;
                outline: none !important;
                font: inherit !important;
                font-size: 14px !important;
                line-height: 1.4 !important;
            }

            #${COMMAND_POPUP_ID} .tm-sc-persistent-command-input:focus {
                border-color: #258cf4 !important;
                box-shadow: 0 0 0 2px rgba(37, 140, 244, 0.2) !important;
            }

            #${COMMAND_POPUP_ID} .tm-sc-persistent-command-actions {
                display: grid !important;
                grid-template-columns: 1fr 1fr !important;
                gap: 9px !important;
            }

            #${COMMAND_POPUP_ID} .tm-sc-persistent-command-save,
            #${COMMAND_POPUP_ID} .tm-sc-persistent-command-delete {
                appearance: none !important;
                box-sizing: border-box !important;
                min-height: 40px !important;
                padding: 9px 12px !important;
                color: #ffffff !important;
                border: 0 !important;
                border-radius: 9px !important;
                cursor: pointer !important;
                font: inherit !important;
                font-size: 14px !important;
                font-weight: 650 !important;
                transition: background-color 120ms ease, opacity 120ms ease !important;
            }

            #${COMMAND_POPUP_ID} .tm-sc-persistent-command-save {
                background: #2869aa !important;
            }

            #${COMMAND_POPUP_ID} .tm-sc-persistent-command-save:hover {
                background: #327bc4 !important;
            }

            #${COMMAND_POPUP_ID} .tm-sc-persistent-command-delete {
                background: rgba(255, 255, 255, 0.1) !important;
            }

            #${COMMAND_POPUP_ID} .tm-sc-persistent-command-delete:hover {
                background: rgba(255, 90, 90, 0.2) !important;
            }

            #${COMMAND_POPUP_ID} .tm-sc-persistent-command-save:disabled,
            #${COMMAND_POPUP_ID} .tm-sc-persistent-command-delete:disabled {
                opacity: 0.45 !important;
                cursor: default !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function createTokenIcon() {
        const namespace = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(namespace, 'svg');
        svg.setAttribute('width', '20');
        svg.setAttribute('height', '20');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('aria-hidden', 'true');
        svg.classList.add('lucide', 'lucide-gauge', 'inline-flex', 'items-center', 'justify-center');

        const path = document.createElementNS(namespace, 'path');
        path.setAttribute('d', 'M12 14l4-4');
        const arc = document.createElementNS(namespace, 'path');
        arc.setAttribute('d', 'M3.34 19a10 10 0 1 1 17.32 0');
        const base = document.createElementNS(namespace, 'path');
        base.setAttribute('d', 'M5 19h14');
        svg.append(path, arc, base);
        return svg;
    }

    function createCommandIcon() {
        const namespace = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(namespace, 'svg');
        svg.setAttribute('width', '20');
        svg.setAttribute('height', '20');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('aria-hidden', 'true');
        svg.classList.add('lucide', 'lucide-terminal-square', 'inline-flex', 'items-center', 'justify-center');

        const frame = document.createElementNS(namespace, 'rect');
        frame.setAttribute('x', '3');
        frame.setAttribute('y', '3');
        frame.setAttribute('width', '18');
        frame.setAttribute('height', '18');
        frame.setAttribute('rx', '2');
        const chevron = document.createElementNS(namespace, 'path');
        chevron.setAttribute('d', 'm7 8 4 4-4 4');
        const line = document.createElementNS(namespace, 'path');
        line.setAttribute('d', 'M13 16h4');
        svg.append(frame, chevron, line);
        return svg;
    }

    function updateMenuItem(item) {
        const context = getCurrentChatContext();
        const savedLimit = context ? getSavedLimit(context.conversationId) : null;
        const savedModel = context ? getSavedModel(context.conversationId) : '';
        const value = item.querySelector('.tm-sc-response-length-menu-value');
        if (!value) return;
        if (savedLimit === null && !savedModel) {
            value.textContent = 'Для этого чата не задано';
            return;
        }
        const tokenLabel = savedLimit === null ? 'токены сайта' : `${savedLimit} токенов`;
        value.textContent = `${tokenLabel} · ${getModelLabel(savedModel)}`;
    }

    function updateCommandMenuItem(item) {
        const context = getCurrentChatContext();
        const savedCommand = context ? getSavedCommand(context.conversationId) : '';
        const value = item.querySelector('.tm-sc-response-length-menu-value');
        if (!value) return;
        value.textContent = savedCommand || 'Для этого чата не задана';
    }

    function updateAllMenuItems() {
        for (const item of document.querySelectorAll(`.${MENU_ITEM_CLASS}`)) updateMenuItem(item);
        for (const item of document.querySelectorAll(`.${COMMAND_MENU_ITEM_CLASS}`)) {
            updateCommandMenuItem(item);
        }
    }

    function findOpenPlusMenu(plusButton) {
        const portal = runtime.dom?.plusMenu(plusButton);
        if (portal) return portal;
        let host = plusButton?.parentElement || null;
        for (let depth = 0; host && depth < 4; depth += 1) {
            for (const child of host.children) {
                if (!(child instanceof HTMLElement) || child.contains(plusButton)) continue;
                if (
                    child.matches(NATIVE_MENU_ITEM_SELECTOR)
                    || child.querySelector(NATIVE_MENU_ITEM_SELECTOR)
                ) return child;
            }
            host = host.parentElement;
        }
        return null;
    }

    function createMenuItem(referenceButton, plusButton) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `${referenceButton.className || ''} ${MENU_ITEM_CLASS}`.trim();
        item.setAttribute('aria-label', 'Длина ответа и модель');
        item.appendChild(createTokenIcon());

        const copy = document.createElement('div');
        copy.className = 'tm-sc-response-length-menu-copy';
        const title = document.createElement('span');
        title.className = 'tm-sc-response-length-menu-title';
        title.textContent = 'Ответ и модель';
        const value = document.createElement('span');
        value.className = 'tm-sc-response-length-menu-value';
        copy.append(title, value);
        item.appendChild(copy);
        updateMenuItem(item);

        item.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            try {
                plusButton.click();
            } catch (_error) {
                // Окно всё равно откроется, даже если штатное меню не закрылось.
            }
            window.setTimeout(() => openPopup(plusButton), 0);
        });
        return item;
    }

    function createCommandMenuItem(referenceButton, plusButton) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `${referenceButton.className || ''} ${COMMAND_MENU_ITEM_CLASS}`.trim();
        item.setAttribute('aria-label', 'Постоянная команда для чата');
        item.appendChild(createCommandIcon());

        const copy = document.createElement('div');
        copy.className = 'tm-sc-response-length-menu-copy';
        const title = document.createElement('span');
        title.className = 'tm-sc-response-length-menu-title';
        title.textContent = 'Постоянная команда';
        const value = document.createElement('span');
        value.className = 'tm-sc-response-length-menu-value';
        copy.append(title, value);
        item.appendChild(copy);
        updateCommandMenuItem(item);

        item.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            try {
                plusButton.click();
            } catch (_error) {
                // Окно всё равно откроется, даже если штатное меню не закрылось.
            }
            window.setTimeout(() => openCommandPopup(plusButton), 0);
        });
        return item;
    }

    function ensureMenuItems() {
        ensureScheduled = false;
        for (const plusButton of document.querySelectorAll(PLUS_BUTTON_SELECTOR)) {
            const menu = findOpenPlusMenu(plusButton);
            if (!menu) continue;
            const referenceButton = menu.querySelector(NATIVE_MENU_ITEM_SELECTOR)
                || runtime.dom?.findAction(menu, 'image') || runtime.dom?.findAction(menu, 'command')
                || runtime.dom?.findAction(menu, 'suggest') || runtime.dom?.findAction(menu, 'search');
            if (!referenceButton) continue;

            const existingItem = menu.querySelector(`.${MENU_ITEM_CLASS}`);
            if (existingItem) {
                updateMenuItem(existingItem);
            } else {
                menu.appendChild(createMenuItem(referenceButton, plusButton));
            }

            const existingCommandItem = menu.querySelector(`.${COMMAND_MENU_ITEM_CLASS}`);
            if (existingCommandItem) {
                updateCommandMenuItem(existingCommandItem);
            } else {
                menu.appendChild(createCommandMenuItem(referenceButton, plusButton));
            }
        }
    }

    function scheduleEnsureMenuItems() {
        if (ensureScheduled) return;
        ensureScheduled = true;
        window.requestAnimationFrame(ensureMenuItems);
    }

    function updatePopupValue() {
        if (!popup) return;
        const slider = popup.querySelector('.tm-sc-response-length-slider');
        const output = popup.querySelector('.tm-sc-response-length-value');
        if (slider && output) output.textContent = slider.value;
    }

    function createPopup() {
        if (popup?.isConnected) return popup;
        addStyles();

        popup = document.createElement('section');
        popup.id = POPUP_ID;
        popup.hidden = true;
        popup.setAttribute('role', 'dialog');
        popup.setAttribute('aria-label', 'Настройки ответа для текущего чата');

        const title = document.createElement('h2');
        title.className = 'tm-sc-response-length-title';
        title.textContent = 'Настройки ответа';
        const caption = document.createElement('p');
        caption.className = 'tm-sc-response-length-caption';
        caption.textContent = 'Значения применяются только к этому диалогу.';

        const error = document.createElement('p');
        error.className = 'tm-sc-response-length-error';
        error.hidden = true;

        const valueRow = document.createElement('div');
        valueRow.className = 'tm-sc-response-length-value-row';
        const valueLabel = document.createElement('span');
        valueLabel.className = 'tm-sc-response-length-value-label';
        valueLabel.textContent = 'Максимум токенов';
        const output = document.createElement('output');
        output.className = 'tm-sc-response-length-value';
        output.textContent = String(INITIAL_TOKENS);
        valueRow.append(valueLabel, output);

        const slider = document.createElement('input');
        slider.className = 'tm-sc-response-length-slider';
        slider.type = 'range';
        slider.min = String(MIN_TOKENS);
        slider.max = String(MAX_TOKENS);
        slider.step = String(TOKEN_STEP);
        slider.value = String(INITIAL_TOKENS);
        slider.setAttribute('aria-label', 'Максимальная длина ответа в токенах');
        slider.addEventListener('input', updatePopupValue);

        const scale = document.createElement('div');
        scale.className = 'tm-sc-response-length-scale';
        scale.innerHTML = `<span>${MIN_TOKENS}</span><span>${MAX_TOKENS}</span>`;

        const modelField = document.createElement('div');
        modelField.className = 'tm-sc-response-model-field';
        const modelLabel = document.createElement('label');
        modelLabel.className = 'tm-sc-response-model-label';
        modelLabel.textContent = 'Модель';
        const modelSelect = document.createElement('select');
        modelSelect.className = 'tm-sc-response-model-select';
        modelSelect.setAttribute('aria-label', 'Модель для этого диалога');
        for (const model of INFERENCE_MODELS) {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.label;
            modelSelect.appendChild(option);
        }
        modelLabel.appendChild(modelSelect);
        modelField.appendChild(modelLabel);

        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'tm-sc-response-length-save';
        save.textContent = 'Сохранить';
        save.addEventListener('click', () => {
            const conversationId = popup.dataset.conversationId || '';
            if (
                !saveLimit(conversationId, slider.value)
                || !saveModel(conversationId, modelSelect.value)
            ) {
                error.hidden = false;
                error.textContent = 'Не удалось сохранить настройки этого диалога.';
                return;
            }
            updateAllMenuItems();
            closePopup();
        });

        popup.append(title, caption, error, valueRow, slider, scale, modelField, save);
        document.body.appendChild(popup);
        return popup;
    }

    function createCommandPopup() {
        if (commandPopup?.isConnected) return commandPopup;
        addStyles();

        commandPopup = document.createElement('section');
        commandPopup.id = COMMAND_POPUP_ID;
        commandPopup.hidden = true;
        commandPopup.setAttribute('role', 'dialog');
        commandPopup.setAttribute('aria-label', 'Постоянная команда для текущего чата');

        const title = document.createElement('h2');
        title.className = 'tm-sc-persistent-command-title';
        title.textContent = 'Постоянная команда';
        const caption = document.createElement('p');
        caption.className = 'tm-sc-persistent-command-caption';
        caption.textContent = 'Будет дописываться к каждому твоему сообщению. /cmd вводить не нужно.';

        const error = document.createElement('p');
        error.className = 'tm-sc-persistent-command-error';
        error.hidden = true;

        const input = document.createElement('textarea');
        input.className = 'tm-sc-persistent-command-input';
        input.placeholder = 'Например: пиши коротко и не описывай действия за моего персонажа';
        input.setAttribute('aria-label', 'Текст постоянной команды');

        const actions = document.createElement('div');
        actions.className = 'tm-sc-persistent-command-actions';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'tm-sc-persistent-command-delete';
        remove.textContent = 'Удалить';
        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'tm-sc-persistent-command-save';
        save.textContent = 'Сохранить';
        actions.append(remove, save);

        const updateButtons = () => {
            const hasConversation = Boolean(commandPopup.dataset.conversationId);
            save.disabled = !hasConversation || !normalizeCommand(input.value);
            remove.disabled = !hasConversation || !getSavedCommand(
                commandPopup.dataset.conversationId || '',
            );
        };
        input.addEventListener('input', () => {
            error.hidden = true;
            updateButtons();
        });
        save.addEventListener('click', () => {
            const conversationId = commandPopup.dataset.conversationId || '';
            if (!saveCommand(conversationId, input.value)) {
                error.hidden = false;
                error.textContent = 'Введи текст команды.';
                updateButtons();
                return;
            }
            updateAllMenuItems();
            closeCommandPopup();
        });
        remove.addEventListener('click', () => {
            const conversationId = commandPopup.dataset.conversationId || '';
            if (!deleteCommand(conversationId)) {
                error.hidden = false;
                error.textContent = 'Не удалось определить текущий диалог.';
                return;
            }
            input.value = '';
            updateAllMenuItems();
            closeCommandPopup();
        });

        commandPopup.append(title, caption, error, input, actions);
        commandPopup.updateButtons = updateButtons;
        document.body.appendChild(commandPopup);
        return commandPopup;
    }

    function positionPopup() {
        if (!popup || popup.hidden || !popupAnchor?.isConnected) return;
        const anchorRect = popupAnchor.getBoundingClientRect();
        const popupRect = popup.getBoundingClientRect();
        const margin = 12;
        const left = Math.min(
            window.innerWidth - popupRect.width - margin,
            Math.max(margin, anchorRect.left),
        );
        const above = anchorRect.top - popupRect.height - 10;
        const top = above >= margin
            ? above
            : Math.min(window.innerHeight - popupRect.height - margin, anchorRect.bottom + 10);
        popup.style.left = `${Math.max(margin, left)}px`;
        popup.style.top = `${Math.max(margin, top)}px`;
    }

    function openPopup(anchor) {
        closeCommandPopup();
        const panel = createPopup();
        const context = getCurrentChatContext();
        const savedLimit = context ? getSavedLimit(context.conversationId) : null;
        const savedModel = context ? getSavedModel(context.conversationId) : '';
        const slider = panel.querySelector('.tm-sc-response-length-slider');
        const modelSelect = panel.querySelector('.tm-sc-response-model-select');
        const save = panel.querySelector('.tm-sc-response-length-save');
        const error = panel.querySelector('.tm-sc-response-length-error');

        panel.dataset.conversationId = context?.conversationId || '';
        slider.value = String(savedLimit ?? INITIAL_TOKENS);
        modelSelect.value = savedModel;
        save.disabled = !context?.conversationId;
        error.hidden = Boolean(context?.conversationId);
        error.textContent = context?.conversationId
            ? ''
            : 'Открой конкретный сохранённый диалог, чтобы задать настройки.';
        updatePopupValue();

        popupAnchor = anchor;
        panel.hidden = false;
        panel.style.visibility = 'hidden';
        positionPopup();
        panel.style.visibility = '';
        window.requestAnimationFrame(positionPopup);
    }

    function closePopup() {
        if (!popup) return;
        popup.hidden = true;
        popupAnchor = null;
    }

    function positionCommandPopup() {
        if (!commandPopup || commandPopup.hidden || !commandPopupAnchor?.isConnected) return;
        const anchorRect = commandPopupAnchor.getBoundingClientRect();
        const popupRect = commandPopup.getBoundingClientRect();
        const margin = 12;
        const left = Math.min(
            window.innerWidth - popupRect.width - margin,
            Math.max(margin, anchorRect.left),
        );
        const above = anchorRect.top - popupRect.height - 10;
        const top = above >= margin
            ? above
            : Math.min(window.innerHeight - popupRect.height - margin, anchorRect.bottom + 10);
        commandPopup.style.left = `${Math.max(margin, left)}px`;
        commandPopup.style.top = `${Math.max(margin, top)}px`;
    }

    function openCommandPopup(anchor) {
        closePopup();
        const panel = createCommandPopup();
        const context = getCurrentChatContext();
        const savedCommand = context ? getSavedCommand(context.conversationId) : '';
        const input = panel.querySelector('.tm-sc-persistent-command-input');
        const error = panel.querySelector('.tm-sc-persistent-command-error');

        panel.dataset.conversationId = context?.conversationId || '';
        input.value = savedCommand;
        error.hidden = Boolean(context?.conversationId);
        error.textContent = context?.conversationId
            ? ''
            : 'Открой конкретный сохранённый диалог, чтобы задать ему команду.';
        panel.updateButtons?.();

        commandPopupAnchor = anchor;
        panel.hidden = false;
        panel.style.visibility = 'hidden';
        positionCommandPopup();
        panel.style.visibility = '';
        window.requestAnimationFrame(positionCommandPopup);
        window.setTimeout(() => input.focus(), 0);
    }

    function closeCommandPopup() {
        if (!commandPopup) return;
        commandPopup.hidden = true;
        commandPopupAnchor = null;
    }

    function handleRootMutations(records) {
        for (const record of records) {
            for (const node of record.addedNodes) {
                if (!(node instanceof Element)) continue;
                if (
                    node.matches(PLUS_BUTTON_SELECTOR)
                    || node.matches(NATIVE_MENU_ITEM_SELECTOR)
                    || node.querySelector(PLUS_BUTTON_SELECTOR)
                    || node.querySelector(NATIVE_MENU_ITEM_SELECTOR)
                ) {
                    scheduleEnsureMenuItems();
                    return;
                }
            }
        }
    }

    function scheduleObserverRetry() {
        if (observerRetryTimer) return;
        const delay = observerRetryDelay;
        observerRetryDelay = Math.min(observerRetryDelay * 2, 4000);
        observerRetryTimer = window.setTimeout(() => {
            observerRetryTimer = null;
            ensureRootObserver();
        }, delay);
    }

    function ensureRootObserver() {
        if (!document.documentElement) {
            scheduleObserverRetry();
            return;
        }
        try {
            if (!rootObserver) rootObserver = new MutationObserver(handleRootMutations);
            rootObserver.observe(document.documentElement, { childList: true, subtree: true });
            observerRetryDelay = 250;
            if (observerRetryTimer) {
                window.clearTimeout(observerRetryTimer);
                observerRetryTimer = null;
            }
        } catch (error) {
            rootObserver = null;
            console.warn('[Response Length] DOM ещё не готов, повторяю подключение.', error);
            scheduleObserverRetry();
        }
    }

    function startUi() {
        if (!document.documentElement) return;
        if (uiStarted) {
            ensureRootObserver();
            scheduleEnsureMenuItems();
            return;
        }
        uiStarted = true;
        addStyles();
        createPopup();
        createCommandPopup();

        document.addEventListener('click', (event) => {
            const plusButton = event.target instanceof Element
                ? event.target.closest(PLUS_BUTTON_SELECTOR)
                : null;
            if (plusButton) window.setTimeout(scheduleEnsureMenuItems, 0);
        }, true);

        document.addEventListener('pointerdown', (event) => {
            const insideTokenPopup = popup && !popup.hidden && popup.contains(event.target);
            const insideCommandPopup = commandPopup
                && !commandPopup.hidden
                && commandPopup.contains(event.target);
            if (insideTokenPopup || insideCommandPopup) return;
            closePopup();
            closeCommandPopup();
        }, true);

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && popup && !popup.hidden) closePopup();
            if (event.key === 'Escape' && commandPopup && !commandPopup.hidden) {
                closeCommandPopup();
            }
        }, true);

        window.addEventListener('resize', positionPopup, { passive: true });
        window.addEventListener('resize', positionCommandPopup, { passive: true });
        window.addEventListener('storage', (event) => {
            if (
                event.key === STORAGE_KEY
                || event.key === MODEL_STORAGE_KEY
                || event.key === COMMAND_STORAGE_KEY
            ) {
                updateAllMenuItems();
            }
        });
        window.addEventListener('popstate', () => {
            closePopup();
            closeCommandPopup();
        });
        window.addEventListener('pageshow', () => {
            ensureRootObserver();
            scheduleEnsureMenuItems();
        });
        ensureRootObserver();
        scheduleEnsureMenuItems();
    }

    installNetworkOverride();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startUi, { once: true });
    } else {
        startUi();
    }
    runtime.dom?.subscribe(scheduleEnsureMenuItems);

}
