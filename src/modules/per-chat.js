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
    const GENERATION_PATH = '/chat';
    const MIN_TOKENS = 100;
    const MAX_TOKENS = 500;
    const TOKEN_STEP = 20;
    const INITIAL_TOKENS = 300;
    const INFERENCE_MODELS = [
        { id: '', label: 'Как выбрано на сайте' },
        ...runtime.models,
    ];
    const INFERENCE_MODEL_IDS = new Set(
        [...INFERENCE_MODELS.map(({ id }) => id).filter(Boolean), 'glm45'], // Retain earlier saved overrides.
    );
    const XHR_META = Symbol('tmScResponseLengthRequest');

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
        const limit = value === null ? null : normalizeTokenLimit(value);
        if (!id || (value !== null && limit === null)) return false;

        const settings = readSettings();
        if (limit === null) delete settings[id];
        else settings[id] = limit;
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

    function getActiveCommands(conversationId) {
        try { return runtime.quickCommands.active(conversationId); }
        catch (error) {
            console.warn('[Quick Commands] Не удалось прочитать быстрые команды.', error);
            return [];
        }
    }

    function getCommandTexts(conversationId) {
        return [getSavedCommand(conversationId), ...getActiveCommands(conversationId).map(command => command.text)].filter(Boolean);
    }

    function saveManualCommand(conversationId, value) {
        const id = normalizeConversationId(conversationId);
        if (!id) throw new Error('Открой конкретный сохранённый диалог.');
        let commands;
        try { commands = JSON.parse(localStorage.getItem(COMMAND_STORAGE_KEY) || '{}'); }
        catch { throw new Error('Не удалось прочитать ручные команды. Данные не изменены.'); }
        if (!commands || typeof commands !== 'object' || Array.isArray(commands)) throw new Error('Не удалось прочитать ручные команды. Данные не изменены.');
        const text = normalizeCommand(value);
        if (text) Object.defineProperty(commands, id, { value: text, enumerable: true, writable: true, configurable: true });
        else delete commands[id];
        localStorage.setItem(COMMAND_STORAGE_KEY, JSON.stringify(commands));
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
            const commandTexts = getCommandTexts(conversationId);
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

            if (commandTexts.length && typeof payload.message === 'string' && payload.message.trim()) {
                const commandSuffix = commandTexts.map(text => `/cmd ${text}`).join('\n\n');
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

    let panel = null;
    function startUi() {
        if (panel) { panel.refresh(); return; }
        panel = runtime.createChatPanel({
            getContext: getCurrentChatContext,
            models: INFERENCE_MODELS,
            minTokens: MIN_TOKENS, maxTokens: MAX_TOKENS, tokenStep: TOKEN_STEP, initialTokens: INITIAL_TOKENS,
            read(conversation) {
                const library = runtime.quickCommands.snapshot(conversation);
                return { model: getSavedModel(conversation), limit: getSavedLimit(conversation), manual: getSavedCommand(conversation), ...library };
            },
            save: {
                model(conversation, value) { if (!saveModel(conversation, value)) throw new Error('Не удалось сохранить модель.'); },
                limit(conversation, value) { if (!saveLimit(conversation, value)) throw new Error('Не удалось сохранить лимит ответа.'); },
                manual: saveManualCommand,
                commands: (conversation, ids) => runtime.quickCommands.setSelectedIds(conversation, ids),
            },
        });
    }
    runtime.quickCommands.subscribe(() => panel?.refresh());
    installNetworkOverride();
    runtime.onDomReady(startUi);
    runtime.dom?.subscribe(() => panel?.refresh());
}
