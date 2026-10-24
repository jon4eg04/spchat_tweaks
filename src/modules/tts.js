// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
export default function init(runtime) {
    'use strict';

    const INSTANCE_KEY = '__spicyChatInworldEmotionalTtsV1';
    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (pageWindow[INSTANCE_KEY]) return;
    pageWindow[INSTANCE_KEY] = true;



    const NATIVE_VOLUME_SELECTOR = 'button[aria-label="Volume2-button" i]';
    const MESSAGE_SELECTOR = 'div[id^="message-"]';
    const MESSAGE_TEXT_CLASS_TOKEN = '[overflow-wrap:anywhere]';
    const CUSTOM_BUTTON_CLASS = 'tm-sc-inworld-tts-button';
    const STYLE_ID = 'tm-sc-inworld-tts-style';
    const LOG_ID = 'tm-sc-inworld-tts-log';
    const INTERNAL_RESPONSE_CONSUMER_FLAG = '__tmScConsumesJsonResponse';
    const MAX_LOG_LINES = 6;
    const MAX_AUDIO_CACHE_ITEMS = 12;
    const TTS_CONCURRENCY = 2;

    const capturedMessages = new Map();
    const inspectedResponses = new WeakSet();
    const audioCache = new Map();
    const logEntries = [];
    let currentJob = null;
    let jobSerial = 0;
    let audioContext = null;
    let rootObserver = null;
    let scanScheduled = false;

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

    function isMessageApiRequest(rawUrl, method) {
        if (!isSpicyApiUrl(rawUrl)) return false;
        try {
            const url = new URL(rawUrl, location.href);
            const path = url.pathname.replace(/\/+$/, '');
            const normalizedMethod = String(method || 'GET').toUpperCase();
            return (
                (normalizedMethod === 'POST' && path === '/chat')
                || /\/messages(?:\/|$)/i.test(path)
                || /\/conversations(?:\/|$)/i.test(path)
            );
        } catch (_error) {
            return false;
        }
    }

    function captureMessageRecords(payload) {
        const visited = new WeakSet();

        const walk = (value, depth) => {
            if (!value || typeof value !== 'object' || depth > 12 || visited.has(value)) return;
            visited.add(value);

            if (Array.isArray(value)) {
                value.forEach((item) => walk(item, depth + 1));
                return;
            }

            const id = typeof value.id === 'string' ? value.id.trim() : '';
            const role = value.role === 'bot' || value.role === 'assistant'
                ? 'bot'
                : value.role === 'user'
                    ? 'user'
                    : '';
            const content = typeof value.content === 'string' ? value.content : '';

            if (id && role && content) {
                const previous = capturedMessages.get(id);
                capturedMessages.set(id, {
                    id,
                    role,
                    content,
                    conversationId: typeof value.conversation_id === 'string'
                        ? value.conversation_id
                        : previous?.conversationId || '',
                    createdAt: Number(value.createdAt || value.created_at) || previous?.createdAt || Date.now(),
                });
            }

            Object.values(value).forEach((child) => walk(child, depth + 1));
        };

        walk(payload, 0);
    }

    function inspectResponse(response) {
        if (!response || response.ok === false || inspectedResponses.has(response)) return;
        inspectedResponses.add(response);
        let hooked = false;

        try {
            const originalJson = response.json;
            if (typeof originalJson === 'function') {
                response.json = function (...args) {
                    return Promise.resolve(originalJson.apply(this, args)).then((payload) => {
                        captureMessageRecords(payload);
                        return payload;
                    });
                };
                hooked = true;
            }
        } catch (_error) {
            // У некоторых реализаций Response методы только для чтения.
        }

        try {
            const originalText = response.text;
            if (typeof originalText === 'function') {
                response.text = function (...args) {
                    return Promise.resolve(originalText.apply(this, args)).then((text) => {
                        try {
                            captureMessageRecords(JSON.parse(text));
                        } catch (_error) {
                            // Не-JSON ответ не относится к сообщениям.
                        }
                        return text;
                    });
                };
                hooked = true;
            }
        } catch (_error) {
            // См. комментарий выше.
        }

        if (!hooked && typeof response.clone === 'function') {
            try {
                const clone = response.clone();
                Promise.resolve(clone.json()).then(captureMessageRecords).catch(() => undefined);
            } catch (_error) {
                // Поток уже мог быть занят.
            }
        }
    }

    function installApiCapture() {
        const originalFetch = pageWindow.fetch;
        if (typeof originalFetch === 'function') {
            pageWindow.fetch = function (input, options = {}) {
                const url = readRequestUrl(input);
                const method = options?.method || input?.method || 'GET';
                const result = Reflect.apply(originalFetch, this, arguments);

                if (
                    isMessageApiRequest(url, method)
                    && options?.[INTERNAL_RESPONSE_CONSUMER_FLAG] !== true
                ) {
                    return Promise.resolve(result).then((response) => {
                        inspectResponse(response);
                        return response;
                    });
                }
                return result;
            };
        }

        try {
            const prototype = pageWindow.XMLHttpRequest?.prototype;
            if (!prototype) return;
            const originalOpen = prototype.open;
            const originalSend = prototype.send;

            prototype.open = function (method, url) {
                this.__tmScInworldTtsUrl = readRequestUrl(url);
                this.__tmScInworldTtsMethod = String(method || 'GET');
                return Reflect.apply(originalOpen, this, arguments);
            };

            prototype.send = function (...args) {
                if (isMessageApiRequest(this.__tmScInworldTtsUrl, this.__tmScInworldTtsMethod)) {
                    this.addEventListener('load', () => {
                        try {
                            const payload = this.responseType === 'json'
                                ? this.response
                                : JSON.parse(this.responseText || '');
                            captureMessageRecords(payload);
                        } catch (_error) {
                            // Не-JSON ответ.
                        }
                    }, { once: true });
                }
                return Reflect.apply(originalSend, this, args);
            };
        } catch (error) {
            console.warn('[Inworld TTS] Не удалось подключиться к XHR.', error);
        }
    }

    function addStyles() {
        if (!document.head || document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .${CUSTOM_BUTTON_CLASS}.tm-sc-inworld-tts-active {
                color: rgb(124 58 237) !important;
                background: rgba(124, 58, 237, 0.14) !important;
                box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.18) !important;
            }
            .${CUSTOM_BUTTON_CLASS}.tm-sc-inworld-tts-busy svg {
                animation: tm-sc-inworld-tts-pulse 1s ease-in-out infinite !important;
            }
            @keyframes tm-sc-inworld-tts-pulse {
                0%, 100% { opacity: 0.45; transform: scale(0.92); }
                50% { opacity: 1; transform: scale(1); }
            }
            #${LOG_ID} {
                position: fixed !important;
                right: 16px !important;
                bottom: 16px !important;
                z-index: 2147483000 !important;
                width: min(350px, calc(100vw - 32px)) !important;
                box-sizing: border-box !important;
                padding: 10px 12px !important;
                color: #e4e4e7 !important;
                background: rgba(20, 20, 23, 0.92) !important;
                border: 1px solid rgba(255, 255, 255, 0.12) !important;
                border-radius: 11px !important;
                box-shadow: 0 12px 34px rgba(0, 0, 0, 0.34) !important;
                backdrop-filter: blur(9px) !important;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
                pointer-events: none !important;
            }
            #${LOG_ID}[hidden] { display: none !important; }
            #${LOG_ID} .tm-sc-inworld-log-title {
                margin-bottom: 5px !important;
                color: #c4b5fd !important;
                font-size: 12px !important;
                line-height: 1.25 !important;
                font-weight: 700 !important;
            }
            #${LOG_ID} .tm-sc-inworld-log-lines {
                display: flex !important;
                flex-direction: column !important;
                gap: 3px !important;
            }
            #${LOG_ID} .tm-sc-inworld-log-line {
                overflow: hidden !important;
                color: #d4d4d8 !important;
                font-size: 11px !important;
                line-height: 1.35 !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }
            #${LOG_ID} .tm-sc-inworld-log-line[data-kind="success"] { color: #86efac !important; }
            #${LOG_ID} .tm-sc-inworld-log-line[data-kind="error"] { color: #fca5a5 !important; }
            #${LOG_ID} .tm-sc-inworld-log-time { color: #71717a !important; }
        `;
        document.head.appendChild(style);
    }

    function ensureLog() {
        if (!document.body) return null;
        let log = document.getElementById(LOG_ID);
        if (log) return log;

        log = document.createElement('aside');
        log.id = LOG_ID;
        log.hidden = true;
        log.innerHTML = `
            <div class="tm-sc-inworld-log-title">Inworld TTS</div>
            <div class="tm-sc-inworld-log-lines"></div>
        `;
        document.body.appendChild(log);
        return log;
    }

    function addLog(text, kind = 'info') {
        const log = ensureLog();
        if (!log) return;
        log.hidden = false;
        const now = new Date();
        logEntries.push({
            text: String(text || ''),
            kind,
            time: now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
        while (logEntries.length > MAX_LOG_LINES) logEntries.shift();

        const lines = log.querySelector('.tm-sc-inworld-log-lines');
        lines.replaceChildren(...logEntries.map((entry) => {
            const line = document.createElement('div');
            line.className = 'tm-sc-inworld-log-line';
            line.dataset.kind = entry.kind;
            const time = document.createElement('span');
            time.className = 'tm-sc-inworld-log-time';
            time.textContent = `${entry.time} `;
            line.append(time, document.createTextNode(entry.text));
            line.title = entry.text;
            return line;
        }));
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

    function plainFromMarkdown(value) {
        return normalizePlainText(value)
            .replace(/\\\*/g, '*')
            .replace(/\*+/g, '')
            .replace(/`+/g, '')
            .replace(/^>\s?/gm, '')
            .replace(/\[(.*?)\]\([^)]*\)/g, '$1');
    }

    function findMessageTextContainer(message) {
        return Array.from(message?.querySelectorAll?.('[class]') || []).find((element) => (
            element.classList.contains(MESSAGE_TEXT_CLASS_TOKEN)
        )) || null;
    }

    function visibleMessageText(message) {
        const container = findMessageTextContainer(message);
        return normalizePlainText(container?.innerText || container?.textContent || '');
    }

    function messageIdFromElement(message) {
        return String(message?.id || '').replace(/^message-/, '');
    }

    function findOriginalContent(message) {
        const messageId = messageIdFromElement(message);
        const exact = capturedMessages.get(messageId);
        if (exact?.role === 'bot' && exact.content) {
            return { text: exact.content, exact: true };
        }

        const visible = visibleMessageText(message);
        if (visible) {
            const candidates = Array.from(capturedMessages.values())
                .filter((record) => record.role === 'bot' && record.content)
                .sort((left, right) => right.createdAt - left.createdAt);
            const normalizedVisible = visible.replace(/\s+/g, ' ').trim();
            const matched = candidates.find((record) => (
                plainFromMarkdown(record.content).replace(/\s+/g, ' ').trim() === normalizedVisible
            ));
            if (matched) return { text: matched.content, exact: true };
            return { text: visible, exact: false };
        }

        return { text: '', exact: false };
    }

    function endpointRequest(payload, job, timeout = 90_000) {
        const { url: ENDPOINT_URL, token: CLIENT_TOKEN } = runtime.getEndpoint('tts');
        return new Promise((resolve, reject) => {
            if (job.cancelled) {
                reject(new DOMException('Операция отменена.', 'AbortError'));
                return;
            }

            let requestHandle = null;
            let settled = false;
            const finish = (callback, value) => {
                if (settled) return;
                settled = true;
                if (requestHandle) job.requests.delete(requestHandle);
                callback(value);
            };

            requestHandle = GM_xmlhttpRequest({
                method: 'POST',
                url: ENDPOINT_URL,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'X-Spicy-TTS-Token': CLIENT_TOKEN,
                },
                data: JSON.stringify(payload),
                timeout,
                anonymous: true,
                onload(response) {
                    let data = null;
                    try {
                        data = JSON.parse(response.responseText || '{}');
                    } catch (_error) {
                        finish(reject, new Error(`Обработчик вернул не JSON (HTTP ${response.status || 0}).`));
                        return;
                    }

                    if (response.status < 200 || response.status >= 300 || !data?.ok) {
                        finish(reject, new Error(data?.error || `Ошибка обработчика HTTP ${response.status || 0}.`));
                        return;
                    }
                    finish(resolve, data);
                },
                onerror() {
                    finish(reject, new Error('Не удалось связаться с настроенным обработчиком.'));
                },
                ontimeout() {
                    finish(reject, new Error('Сервер озвучки слишком долго не отвечает.'));
                },
                onabort() {
                    finish(reject, new DOMException('Операция отменена.', 'AbortError'));
                },
            });
            job.requests.add(requestHandle);
        });
    }

    function base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes.buffer;
    }

    function ensureAudioContext() {
        if (!audioContext || audioContext.state === 'closed') {
            const Context = pageWindow.AudioContext || pageWindow.webkitAudioContext;
            if (!Context) throw new Error('Браузер не поддерживает Web Audio API.');
            audioContext = new Context();
        }
        if (audioContext.state === 'suspended') void audioContext.resume();
        return audioContext;
    }

    function setButtonState(button, state) {
        button?.classList.toggle('tm-sc-inworld-tts-active', state !== 'idle');
        button?.classList.toggle('tm-sc-inworld-tts-busy', state === 'busy');
        if (button) {
            button.title = state === 'idle'
                ? 'Озвучить через Inworld'
                : 'Остановить озвучку';
        }
    }

    function stopJob(job, log = true) {
        if (!job || job.cancelled) return;
        job.cancelled = true;
        for (const request of job.requests) {
            try { request.abort(); } catch (_error) { /* ignore */ }
        }
        job.requests.clear();
        for (const source of job.sources) {
            try { source.stop(); } catch (_error) { /* ignore */ }
        }
        job.sources.clear();
        setButtonState(job.button, 'idle');
        if (log) addLog('Озвучка остановлена');
        if (currentJob === job) currentJob = null;
    }

    function cacheAudio(key, buffers) {
        if (audioCache.has(key)) audioCache.delete(key);
        audioCache.set(key, buffers.map((buffer) => buffer.slice(0)));
        while (audioCache.size > MAX_AUDIO_CACHE_ITEMS) {
            audioCache.delete(audioCache.keys().next().value);
        }
    }

    function hashText(value) {
        let hash = 2166136261;
        for (let index = 0; index < value.length; index += 1) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }

    async function synthesizeAll(segments, job) {
        const results = new Array(segments.length);
        let nextIndex = 0;
        let completed = 0;

        const worker = async () => {
            while (!job.cancelled) {
                const index = nextIndex;
                nextIndex += 1;
                if (index >= segments.length) return;

                addLog(`Inworld: отправлен фрагмент ${index + 1}/${segments.length}`);
                const response = await endpointRequest({
                    action: 'synthesize',
                    segment: segments[index],
                }, job);
                if (job.cancelled) throw new DOMException('Операция отменена.', 'AbortError');
                results[index] = base64ToArrayBuffer(response.audio);
                completed += 1;
                addLog(`Inworld: готово ${completed}/${segments.length}`);
            }
        };

        const workers = Array.from(
            { length: Math.min(TTS_CONCURRENCY, segments.length) },
            () => worker(),
        );
        await Promise.all(workers);
        return results;
    }

    async function playBuffer(buffer, job, index, total) {
        if (job.cancelled) throw new DOMException('Операция отменена.', 'AbortError');
        const context = ensureAudioContext();
        if (context.state === 'suspended') await context.resume();
        const decoded = await context.decodeAudioData(buffer.slice(0));
        if (job.cancelled) throw new DOMException('Операция отменена.', 'AbortError');

        addLog(`Воспроизведение ${index + 1}/${total}`);
        await new Promise((resolve, reject) => {
            const source = context.createBufferSource();
            source.buffer = decoded;
            source.connect(context.destination);
            job.sources.add(source);
            source.onended = () => {
                job.sources.delete(source);
                if (job.cancelled) reject(new DOMException('Операция отменена.', 'AbortError'));
                else resolve();
            };
            try {
                source.start();
            } catch (error) {
                job.sources.delete(source);
                reject(error);
            }
        });
    }

    async function playBuffers(buffers, job) {
        setButtonState(job.button, 'playing');
        for (let index = 0; index < buffers.length; index += 1) {
            await playBuffer(buffers[index], job, index, buffers.length);
            if (index + 1 < buffers.length && !job.cancelled) {
                await new Promise((resolve) => pageWindow.setTimeout(resolve, 65));
            }
        }
    }

    async function startTts(message, button) {
        if (currentJob && currentJob.button === button && !currentJob.cancelled) {
            stopJob(currentJob);
            return;
        }
        if (currentJob) stopJob(currentJob, false);

        let context;
        try {
            context = ensureAudioContext();
            void context.resume();
        } catch (error) {
            addLog(error.message, 'error');
            return;
        }

        const job = {
            serial: ++jobSerial,
            button,
            requests: new Set(),
            sources: new Set(),
            cancelled: false,
        };
        currentJob = job;
        setButtonState(button, 'busy');

        try {
            addLog('Получаю исходный текст сообщения…');
            const original = findOriginalContent(message);
            if (!original.text) throw new Error('Не удалось получить текст этого сообщения.');
            if (!original.exact) {
                addLog('Markdown из API не найден: использую видимый текст', 'error');
            }

            const cacheKey = `${messageIdFromElement(message)}:${hashText(original.text)}`;
            const cached = audioCache.get(cacheKey);
            let buffers;

            if (cached?.length) {
                addLog(`Аудио взято из кеша: ${cached.length} фрагм.`, 'success');
                buffers = cached.map((buffer) => buffer.slice(0));
            } else {
                addLog('OpenAI: отправлен запрос на разметку');
                const prepared = await endpointRequest({
                    action: 'prepare',
                    text: original.text,
                }, job);
                if (job.cancelled) return;
                const segments = Array.isArray(prepared.segments) ? prepared.segments : [];
                if (!segments.length) throw new Error('OpenAI не подготовил ни одного фрагмента.');
                addLog(`OpenAI: разметка готова, фрагментов ${segments.length}`, 'success');

                buffers = await synthesizeAll(segments, job);
                if (job.cancelled) return;
                cacheAudio(cacheKey, buffers);
            }

            addLog('Начинаю воспроизведение');
            await playBuffers(buffers, job);
            if (job.cancelled) return;
            addLog('Озвучка завершена', 'success');
        } catch (error) {
            if (error?.name !== 'AbortError' && !job.cancelled) {
                console.error('[Inworld TTS]', error);
                addLog(error?.message || 'Неизвестная ошибка озвучки.', 'error');
            }
        } finally {
            if (currentJob === job && !job.cancelled) {
                setButtonState(button, 'idle');
                currentJob = null;
            }
        }
    }

    function replaceNativeButton(nativeButton) {
        if (!nativeButton?.isConnected || nativeButton.classList.contains(CUSTOM_BUTTON_CLASS)) return;
        const message = nativeButton.closest(MESSAGE_SELECTOR);
        if (!message?.id) return;

        const button = nativeButton.cloneNode(true);
        button.classList.add(CUSTOM_BUTTON_CLASS);
        button.setAttribute('aria-label', 'Озвучить через Inworld');
        button.title = 'Озвучить через Inworld';
        button.type = 'button';
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            void startTts(message, button);
        }, true);

        nativeButton.replaceWith(button);
    }

    function scanButtons() {
        scanScheduled = false;
        if (!document.documentElement || !document.head || !document.body) return;
        addStyles();
        ensureLog();
        document.querySelectorAll(NATIVE_VOLUME_SELECTOR).forEach(replaceNativeButton);

        if (!rootObserver) {
            rootObserver = new MutationObserver((records) => {
                const relevant = records.some((record) => (
                    (record.type === 'attributes' && record.target?.matches?.(NATIVE_VOLUME_SELECTOR))
                    || Array.from(record.addedNodes).some((node) => (
                        node?.nodeType === Node.ELEMENT_NODE
                        && (node.matches?.(NATIVE_VOLUME_SELECTOR) || node.querySelector?.(NATIVE_VOLUME_SELECTOR))
                    ))
                ));
                if (relevant) scheduleScan();
            });
            rootObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['aria-label'],
            });
        }
    }

    function scheduleScan() {
        if (scanScheduled) return;
        scanScheduled = true;
        requestAnimationFrame(scanButtons);
    }

    installApiCapture();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleScan, { once: true });
    }
    scheduleScan();
    window.addEventListener('pageshow', scheduleScan);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) scheduleScan();
    });
}
