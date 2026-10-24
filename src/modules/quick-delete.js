// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
export default function init(runtime) {
    'use strict';

    const pageWindow = unsafeWindow;
    const capturedHeaders = new Map();
    const capturedMessages = new Map();
    const inspectedResponses = new WeakSet();
    const STYLE_ID = 'sc-quick-delete-style';
    const INTERNAL_RESPONSE_CONSUMER_FLAG = '__tmScConsumesJsonResponse';
    let rootObserver = null;
    let retryTimer = null;
    let retryDelay = 250;
    let ensureScheduled = false;

    const usefulHeaders = new Set([
        'authorization',
        'x-guest-userid',
        'x-country',
        'x-app-id',
        'x-app-version',
        'x-platform',
        'x-platform-os',
        'accept',
        'content-type'
    ]);

    function rememberHeader(name, value) {
        const normalizedName = String(name).toLowerCase();

        if (usefulHeaders.has(normalizedName)) {
            capturedHeaders.set(
                normalizedName,
                String(value)
            );
        }
    }

    function rememberHeaders(headers) {
        if (!headers) {
            return false;
        }

        try {
            const parsedHeaders =
                new pageWindow.Headers(headers);

            parsedHeaders.forEach((value, name) => {
                rememberHeader(name, value);
            });
        } catch (error) {
            console.debug(
                '[SpicyChat Quick Delete] Не удалось прочитать заголовки:',
                error
            );
        }
    }

    function readRequestUrl(input) {
        if (typeof input === 'string') {
            return input;
        }

        if (input && typeof input.url === 'string') {
            return input.url;
        }

        return '';
    }

    function isSpicyApiUrl(rawUrl) {
        try {
            const url = new URL(rawUrl, location.href);

            return (
                url.hostname === 'nd-api.com' ||
                url.hostname.endsWith('.nd-api.com')
            );
        } catch (_error) {
            return false;
        }
    }

    function isGenerationApiRequest(rawUrl, method) {
        if (String(method || 'GET').toUpperCase() !== 'POST') {
            return false;
        }

        try {
            const url = new URL(rawUrl, location.href);

            return (
                isSpicyApiUrl(url.href) &&
                url.pathname.replace(/\/+$/, '') === '/chat'
            );
        } catch (_error) {
            return false;
        }
    }

    function isHistoryApiRequest(rawUrl, method) {
        if (String(method || 'GET').toUpperCase() !== 'GET') {
            return false;
        }

        try {
            const url = new URL(rawUrl, location.href);

            return (
                isSpicyApiUrl(url.href) &&
                /^\/characters\/[^/]+\/messages\/[^/]+\/?$/.test(
                    url.pathname
                )
            );
        } catch (_error) {
            return false;
        }
    }

    /*
     * Сайт отдаёт все перегенерации как отдельные
     * сообщения с разными id, но одинаковым prev_id.
     * Для обычного удаления нужны связи, а для кнопки
     * повтора — ещё и исходный Markdown-текст.
     */
    function captureMessageRecords(payload) {
        const visited = new WeakSet();

        const walk = (value, depth) => {
            if (
                !value ||
                typeof value !== 'object' ||
                depth > 10 ||
                visited.has(value)
            ) {
                return;
            }

            visited.add(value);

            if (Array.isArray(value)) {
                value.forEach(item => walk(item, depth + 1));
                return;
            }

            const isMessage = (
                typeof value.id === 'string' &&
                typeof value.conversation_id === 'string' &&
                (value.role === 'user' || value.role === 'bot') &&
                (
                    typeof value.prev_id === 'string' ||
                    value.prev_id === null
                )
            );

            if (isMessage) {
                const previous = capturedMessages.get(value.id);
                const nextContent =
                    typeof value.content === 'string'
                        ? value.content
                        : '';

                capturedMessages.set(value.id, {
                    id: value.id,
                    conversationId: value.conversation_id,
                    prevId: value.prev_id,
                    role: value.role,
                    content:
                        nextContent.length > 0
                            ? nextContent
                            : previous?.content || '',
                    isAlternative:
                        value.is_alternative === true,
                    createdAt:
                        Number(value.createdAt) || 0
                });
            }

            Object.values(value).forEach(
                child => walk(child, depth + 1)
            );
        };

        walk(payload, 0);
    }

    function inspectMessageResponse(response) {
        if (
            !response ||
            response.ok === false ||
            inspectedResponses.has(response)
        ) {
            return false;
        }

        inspectedResponses.add(response);

        let hooked = false;

        try {
            const originalJson = response.json;

            if (typeof originalJson === 'function') {
                response.json = function (...args) {
                    return Promise.resolve(
                        originalJson.apply(this, args)
                    ).then(payload => {
                        captureMessageRecords(payload);
                        return payload;
                    });
                };
                hooked = true;
            }
        } catch (_error) {
            // Некоторые полифилы делают метод только для чтения.
        }

        try {
            const originalText = response.text;

            if (typeof originalText === 'function') {
                response.text = function (...args) {
                    return Promise.resolve(
                        originalText.apply(this, args)
                    ).then(text => {
                        try {
                            captureMessageRecords(JSON.parse(text));
                        } catch (_error) {
                            // Не-JSON текст не относится к сообщениям.
                        }

                        return text;
                    });
                };
                hooked = true;
            }
        } catch (_error) {
            // Некоторые полифилы делают метод только для чтения.
        }

        /*
         * Редкий резерв для неизменяемого Response. Для обычной
         * загрузки истории он не нужен: сайт сам вызывает json().
         */
        if (!hooked && response.clone) {
            try {
                const clone = response.clone();

                Promise.resolve(clone.json())
                    .then(captureMessageRecords)
                    .catch(() => undefined);
            } catch (_error) {
                // Потоки и не-JSON ответы просто пропускаем.
            }
        }
    }

    /*
     * Перехватываем запросы сайта, чтобы автоматически
     * получить заголовок авторизации.
     */
    const originalFetch = pageWindow.fetch;

    pageWindow.fetch = function (input, options = {}) {
        const requestUrl = readRequestUrl(input);
        const requestMethod =
            options.method || input?.method || 'GET';

        try {
            if (isSpicyApiUrl(requestUrl)) {
                rememberHeaders(input?.headers);
                rememberHeaders(options?.headers);
            }
        } catch (error) {
            console.debug(
                '[SpicyChat Quick Delete] Ошибка перехвата fetch:',
                error
            );
        }

        const result = originalFetch.apply(this, arguments);

        if (
            (
                isGenerationApiRequest(requestUrl, requestMethod) ||
                isHistoryApiRequest(requestUrl, requestMethod)
            ) &&
            options?.[INTERNAL_RESPONSE_CONSUMER_FLAG] !== true
        ) {
            return Promise.resolve(result).then(response => {
                inspectMessageResponse(response);
                return response;
            });
        }

        return result;
    };

    /*
     * На случай, если сайт отправляет запросы
     * через XMLHttpRequest.
     */
    const originalXhrOpen =
        pageWindow.XMLHttpRequest.prototype.open;

    const originalSetRequestHeader =
        pageWindow.XMLHttpRequest.prototype.setRequestHeader;

    const originalXhrSend =
        pageWindow.XMLHttpRequest.prototype.send;

    pageWindow.XMLHttpRequest.prototype.open = function (
        method,
        url
    ) {
        this.__scQuickDeleteUrl = String(url);
        this.__scQuickDeleteMethod = String(method || 'GET');

        return originalXhrOpen.apply(
            this,
            arguments
        );
    };

    pageWindow.XMLHttpRequest.prototype.setRequestHeader =
        function (name, value) {
            if (
                isSpicyApiUrl(
                    this.__scQuickDeleteUrl
                )
            ) {
                rememberHeader(name, value);
            }

            return originalSetRequestHeader.apply(
                this,
                arguments
            );
        };

    pageWindow.XMLHttpRequest.prototype.send =
        function () {
            const xhr = this;
            const requestUrl =
                xhr.__scQuickDeleteUrl || '';

            if (
                isGenerationApiRequest(
                    requestUrl,
                    xhr.__scQuickDeleteMethod
                ) ||
                isHistoryApiRequest(
                    requestUrl,
                    xhr.__scQuickDeleteMethod
                )
            ) {
                xhr.addEventListener(
                    'loadend',
                    () => {
                        try {
                            const contentType =
                                xhr.getResponseHeader?.(
                                    'content-type'
                                ) || '';

                            if (
                                contentType &&
                                !contentType.includes('json')
                            ) {
                                return;
                            }

                            const payload =
                                xhr.responseType === 'json'
                                    ? xhr.response
                                    : JSON.parse(xhr.responseText);

                            captureMessageRecords(payload);
                        } catch (_error) {
                            // Потоки и не-JSON ответы пропускаем.
                        }
                    },
                    { once: true }
                );
            }

            return originalXhrSend.apply(
                this,
                arguments
            );
        };

    function getChatContext() {
        const parts = location.pathname
            .split('/')
            .filter(Boolean);

        const chatIndex = parts.indexOf('chat');

        if (
            chatIndex === -1 ||
            !parts[chatIndex + 1] ||
            !parts[chatIndex + 2]
        ) {
            return null;
        }

        /*
         * Адрес страницы:
         * /chat/ID_БОТА/ID_ДИАЛОГА
         */
        return {
            characterId: parts[chatIndex + 1],
            conversationId: parts[chatIndex + 2]
        };
    }

    function getMessages() {
        return Array.from(
            document.querySelectorAll(
                '[id^="message-"]'
            )
        ).filter(element => {
            return /^message-[0-9a-f-]{36}$/i.test(
                element.id
            );
        });
    }

    function getMessageId(element) {
        return element.id.replace(
            /^message-/,
            ''
        );
    }

    function getRequestHeaders() {
        const headers = {};

        for (const [name, value] of capturedHeaders) {
            headers[name] = value;
        }

        headers.accept =
            'application/json, text/plain, */*';

        headers['content-type'] =
            'application/json';

        return headers;
    }

    function getHistoryEndpoint(context, lastId = '') {
        /*
         * Хвостовой `&` обязателен: без него API SpicyChat
         * в реальном HAR отвечал HTTP 500.
         */
        const query = lastId
            ? `limit=50&last_id=${encodeURIComponent(lastId)}`
            : 'limit=50&';

        return (
            'https://prod.nd-api.com/characters/' +
            `${encodeURIComponent(context.characterId)}/messages/` +
            `${encodeURIComponent(context.conversationId)}?${query}`
        );
    }

    async function refreshMessageRecordsForDeletion(context, visibleIds) {
        for (const [id, record] of capturedMessages) {
            if (record.conversationId !== context.conversationId) {
                capturedMessages.delete(id);
            }
        }
        const remainingIds = new Set(visibleIds);
        let lastId = '';
        let boundaryPageRequested = false;

        try {
            for (let page = 0; page < 1000; page += 1) {
                const endpoint =
                    getHistoryEndpoint(context, lastId);
                const response = await originalFetch.call(pageWindow, endpoint, {
                    method: 'GET',
                    headers: getRequestHeaders(),
                    [INTERNAL_RESPONSE_CONSUMER_FLAG]: true,
                });
                if (!response.ok) return false;

                const payload = await response.json();
                captureMessageRecords(payload);
                const batch = Array.isArray(payload?.messages) ? payload.messages : [];
                for (const message of batch) remainingIds.delete(message?.id);

                if (batch.length < 50) {
                    return remainingIds.size === 0;
                }
                if (!remainingIds.size) {
                    if (boundaryPageRequested) return true;
                    boundaryPageRequested = true;
                }
                const nextLastId = batch.at(-1)?.id;
                if (!nextLastId || nextLastId === lastId) return true;
                lastId = nextLastId;
                await new Promise((resolve) => pageWindow.setTimeout(resolve, 0));
            }
            return true;
        } catch (error) {
            console.debug(
                '[SpicyChat Quick Delete] Не удалось обновить структуру сообщений:',
                error
            );
            return false;
        }
    }

    async function loadOriginalUserContent(context, messageId) {
        const cached = capturedMessages.get(messageId);

        if (
            cached?.conversationId === context.conversationId &&
            cached.role === 'user' &&
            typeof cached.content === 'string' &&
            cached.content.length > 0
        ) {
            return cached.content;
        }

        let lastId = '';

        try {
            for (let page = 0; page < 1000; page += 1) {
                const response = await originalFetch.call(
                    pageWindow,
                    getHistoryEndpoint(context, lastId),
                    {
                        method: 'GET',
                        headers: getRequestHeaders(),
                        [INTERNAL_RESPONSE_CONSUMER_FLAG]: true
                    }
                );

                if (!response.ok) return null;

                const payload = await response.json();
                captureMessageRecords(payload);

                const batch = Array.isArray(payload?.messages)
                    ? payload.messages
                    : [];

                const originalMessage = batch.find(message => (
                    message?.id === messageId &&
                    message?.role === 'user' &&
                    typeof message?.content === 'string'
                ));

                if (originalMessage) {
                    return originalMessage.content;
                }

                if (batch.length < 50) return null;

                const nextLastId = batch.at(-1)?.id;
                if (!nextLastId || nextLastId === lastId) return null;

                lastId = nextLastId;
                await new Promise(resolve => {
                    pageWindow.setTimeout(resolve, 0);
                });
            }
        } catch (error) {
            console.debug(
                '[SpicyChat Quick Delete] Не удалось получить исходник:',
                error
            );
        }

        return null;
    }

    function expandIdsWithAlternatives(
        visibleIds,
        conversationId
    ) {
        const allIds = new Set(visibleIds);
        const siblingGroups = new Map();

        for (const record of capturedMessages.values()) {
            if (
                record.conversationId !== conversationId ||
                !record.prevId
            ) {
                continue;
            }

            const groupKey =
                `${record.role}:${record.prevId}`;

            if (!siblingGroups.has(groupKey)) {
                siblingGroups.set(groupKey, []);
            }

            siblingGroups.get(groupKey).push(record.id);
        }

        for (const visibleId of visibleIds) {
            const record = capturedMessages.get(visibleId);

            if (
                !record ||
                record.conversationId !== conversationId ||
                !record.prevId
            ) {
                continue;
            }

            const groupKey =
                `${record.role}:${record.prevId}`;

            for (
                const siblingId of
                siblingGroups.get(groupKey) || []
            ) {
                allIds.add(siblingId);
            }
        }

        return Array.from(allIds);
    }

    function normalizeButtonText(value) {
        return String(value || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLocaleLowerCase();
    }

    function isElementVisible(element) {
        if (
            !element ||
            !element.isConnected ||
            element.hidden
        ) {
            return false;
        }

        let current = element;

        while (
            current &&
            current !== document.documentElement
        ) {
            const style =
                pageWindow.getComputedStyle(current);

            if (
                style.display === 'none' ||
                style.visibility === 'hidden'
            ) {
                return false;
            }

            current = current.parentElement;
        }

        return true;
    }

    /*
     * Ждём только после клика пользователя. MutationObserver отключается
     * сразу после результата и не создаёт никакой фоновой нагрузки.
     */
    function waitForValue(readValue, timeout = 2500) {
        return new Promise(resolve => {
            let finished = false;
            let observer = null;
            let timer = null;

            const finish = value => {
                if (finished) return;
                finished = true;
                observer?.disconnect();
                if (timer) pageWindow.clearTimeout(timer);
                resolve(value || null);
            };

            const check = () => {
                let value = null;

                try {
                    value = readValue();
                } catch (_error) {
                    value = null;
                }

                if (value) finish(value);
            };

            check();
            if (finished) return;

            observer = new pageWindow.MutationObserver(check);
            observer.observe(
                document.documentElement,
                { childList: true, subtree: true, attributes: true }
            );

            timer = pageWindow.setTimeout(
                () => finish(null),
                timeout
            );
        });
    }

    function findVisibleButton(predicate) {
        return Array.from(
            document.querySelectorAll('button')
        ).find(button => (
            isElementVisible(button) &&
            predicate(button)
        )) || null;
    }

    function findChatDropdownButton() {
        return findVisibleButton(button => (
            normalizeButtonText(
                button.getAttribute('aria-label')
            ) === 'chat-dropdown'
        ));
    }

    function findRemoveMessagesMenuItem() {
        return findVisibleButton(button => {
            const ariaLabel = normalizeButtonText(
                button.getAttribute('aria-label')
            );
            const text = normalizeButtonText(
                button.textContent
            );

            return (
                ariaLabel === 'remove messages' ||
                ariaLabel === 'удалить сообщения' ||
                text === 'remove messages' ||
                text === 'удалить сообщения'
            );
        });
    }

    function findRemovalActionButton(action) {
        const acceptedText = action === 'confirm'
            ? new Set(['remove', 'удалить'])
            : new Set(['cancel', 'отмена']);

        return findVisibleButton(button => {
            if (
                button.closest('[id^="message-"]') ||
                button.classList.contains('sc-quick-delete-button')
            ) {
                return false;
            }

            return acceptedText.has(
                normalizeButtonText(button.textContent)
            );
        });
    }

    function findMessageSelectionSurface(message) {
        return message?.querySelector(
            'div.w-full.flex.mb-lg.bg-transparent.items-center'
        ) || null;
    }

    async function cancelNativeRemovalMode() {
        const cancelButton =
            findRemovalActionButton('cancel');

        if (cancelButton && !cancelButton.disabled) {
            cancelButton.click();
            await new Promise(resolve => {
                pageWindow.setTimeout(resolve, 0);
            });
        }
    }

    /*
     * Главный путь: поручаем удаление штатному React-состоянию сайта.
     * Именно оно знает полный список скрытых перегенераций и корректно
     * обрабатывает обычное сообщение, у которого версия всего одна.
     */
    async function deleteThroughNativeUi(selectedMessageId) {
        const dropdownButton =
            findChatDropdownButton();

        if (!dropdownButton) return 'unavailable';

        dropdownButton.click();

        const removeMenuItem = await waitForValue(
            findRemoveMessagesMenuItem
        );

        if (!removeMenuItem) {
            dropdownButton.click();
            return 'unavailable';
        }

        removeMenuItem.click();

        const removalButton = await waitForValue(
            () => findRemovalActionButton('confirm')
        );

        if (!removalButton) {
            await cancelNativeRemovalMode();
            return 'unavailable';
        }

        const currentMessage = document.getElementById(
            `message-${selectedMessageId}`
        );
        const selectionSurface =
            findMessageSelectionSurface(currentMessage);

        if (!selectionSurface) {
            await cancelNativeRemovalMode();
            return 'unavailable';
        }

        selectionSurface.click();

        const enabledRemovalButton = await waitForValue(() => {
            const candidate =
                findRemovalActionButton('confirm');

            if (
                !candidate ||
                candidate.disabled ||
                candidate.getAttribute('aria-disabled') === 'true'
            ) {
                return null;
            }

            return candidate;
        });

        if (!enabledRemovalButton) {
            await cancelNativeRemovalMode();
            return 'unavailable';
        }

        enabledRemovalButton.click();

        const removed = await waitForValue(
            () => !document.getElementById(
                `message-${selectedMessageId}`
            ),
            15000
        );

        return removed ? 'completed' : 'started';
    }

    async function deleteDirectly(
        context,
        ids,
        messagesToDelete
    ) {
        const endpoint =
            'https://prod.nd-api.com/conversations/' +
            `${context.conversationId}/messages`;

        const response = await originalFetch.call(
            pageWindow,
            endpoint,
            {
                method: 'DELETE',
                headers: getRequestHeaders(),
                body: JSON.stringify({ ids })
            }
        );

        if (!response.ok) {
            const responseText = await response
                .text()
                .catch(() => '');

            throw new Error(
                `HTTP ${response.status} ` +
                `${response.statusText}\n` +
                responseText
            );
        }

        for (const message of messagesToDelete) {
            message.remove();
        }

        for (const id of ids) {
            capturedMessages.delete(id);
        }
    }

    function setActionButtonBusy(button, busy) {
        if (!button) return;

        if (!button.dataset.scIdleHtml) {
            button.dataset.scIdleHtml = button.innerHTML;
        }

        button.disabled = busy;
        button.innerHTML = busy
            ? '…'
            : button.dataset.scIdleHtml;
    }

    function findComposerTextarea() {
        const candidates = Array.from(
            document.querySelectorAll(
                'textarea[placeholder="Message..."]'
            )
        ).filter(textarea => (
            isElementVisible(textarea) &&
            !textarea.disabled
        ));

        return candidates.at(-1) || null;
    }

    function setNativeTextareaValue(textarea, value) {
        const prototype = Object.getPrototypeOf(textarea);
        const descriptor = Object.getOwnPropertyDescriptor(
            prototype,
            'value'
        );

        if (descriptor?.set) {
            descriptor.set.call(textarea, value);
        } else {
            textarea.value = value;
        }
    }

    function dispatchFallbackInput(textarea, content) {
        setNativeTextareaValue(textarea, content);

        const inputEvent =
            typeof pageWindow.InputEvent === 'function'
                ? new pageWindow.InputEvent('input', {
                    bubbles: true,
                    inputType: 'insertText',
                    data: content
                })
                : new pageWindow.Event('input', {
                    bubbles: true
                });

        textarea.dispatchEvent(inputEvent);
    }

    function insertThroughBrowserEditing(textarea, content) {
        textarea.focus({ preventScroll: true });
        textarea.setSelectionRange(0, textarea.value.length);

        let inserted = false;

        try {
            inserted = document.execCommand(
                'insertText',
                false,
                content
            );
        } catch (_error) {
            inserted = false;
        }

        if (!inserted || textarea.value !== content) {
            /*
             * Резерв для браузеров без execCommand. На Firefox
             * основной путь выше создаёт настоящую операцию
             * редактирования, которую принимает React.
             */
            dispatchFallbackInput(textarea, content);
        }

        if (textarea.value === content) {
            textarea.focus({ preventScroll: true });
            textarea.setSelectionRange(
                content.length,
                content.length
            );
        }

        return textarea.value === content;
    }

    function delay(milliseconds) {
        return new Promise(resolve => {
            pageWindow.setTimeout(resolve, milliseconds);
        });
    }

    async function insertAndSendOriginal(content) {
        let textarea = await waitForValue(
            findComposerTextarea,
            5000
        );

        if (!textarea) return 'failed';

        let contentAccepted = false;

        /*
         * После штатного удаления composer иногда монтируется заново.
         * Двух попыток достаточно: первая — в найденное поле, вторая —
         * только если React успел заменить его сразу после вставки.
         */
        for (let attempt = 0; attempt < 2; attempt += 1) {
            insertThroughBrowserEditing(textarea, content);
            await delay(120);

            const currentTextarea = findComposerTextarea();

            if (
                currentTextarea === textarea &&
                textarea.value === content
            ) {
                contentAccepted = true;
                break;
            }

            textarea = currentTextarea || await waitForValue(
                findComposerTextarea,
                1500
            );

            if (!textarea) break;
        }

        if (!contentAccepted) return 'failed';

        const sendButton = await waitForValue(() => {
            const candidates = Array.from(
                document.querySelectorAll(
                    'button[aria-label="send-message" i]'
                )
            );

            return candidates.find(candidate => (
                candidate.isConnected &&
                !candidate.disabled &&
                candidate.getAttribute('aria-disabled') !== 'true'
            )) || null;
        }, 5000);

        if (!sendButton) {
            const currentTextarea = findComposerTextarea();

            return (
                currentTextarea === textarea &&
                currentTextarea.value === content
            )
                ? 'inserted'
                : 'failed';
        }

        sendButton.click();
        return 'sent';
    }

    async function replayUserMessage(message, button) {
        const context = getChatContext();

        if (!context) {
            alert('Не удалось определить текущий диалог.');
            return false;
        }

        setActionButtonBusy(button, true);

        const content = await loadOriginalUserContent(
            context,
            getMessageId(message)
        );

        if (typeof content !== 'string' || !content.length) {
            setActionButtonBusy(button, false);
            alert(
                'Не удалось получить исходный текст сообщения.\n\n' +
                'Ничего не удалено.'
            );
            return false;
        }

        setActionButtonBusy(button, false);

        const deleted = await deleteFromMessage(
            message,
            button,
            'replay'
        );

        if (!deleted) return;

        const sendResult = await insertAndSendOriginal(content);

        if (sendResult === 'inserted') {
            alert(
                'Сообщение удалено, а исходный текст ' +
                'вставлен в поле ввода.\n\n' +
                'Автоотправка не сработала — нажми Enter.'
            );
        } else if (sendResult === 'failed') {
            alert(
                'Сообщение удалено, но React не принял ' +
                'автоматическую вставку текста.'
            );
        }
    }

    async function deleteFromMessage(
        selectedMessage,
        button,
        action = 'delete'
    ) {
        const context = getChatContext();

        if (!context) {
            alert(
                'Не удалось определить ID бота или диалога.'
            );

            return false;
        }

        const messages = getMessages();

        const selectedIndex =
            messages.indexOf(selectedMessage);

        if (selectedIndex === -1) {
            alert(
                'Не удалось определить выбранное сообщение.'
            );

            return false;
        }

        /*
         * Выбранное сообщение и все сообщения после него.
         */
        const messagesToDelete =
            messages.slice(selectedIndex);

        const visibleIds =
            messagesToDelete.map(getMessageId);

        if (!visibleIds.length) {
            return false;
        }

        const question = action === 'replay'
            ? 'Удалить это сообщение и все следующие, ' +
                'затем отправить его заново?'
            : 'Удалить выбранное сообщение и все следующие?';

        const confirmed = confirm(
            `${question}\n\n` +
            `Видимых сообщений: ${visibleIds.length}`
        );

        if (!confirmed) {
            return false;
        }

        setActionButtonBusy(button, true);

        try {
            const nativeResult =
                await deleteThroughNativeUi(
                    getMessageId(selectedMessage)
                );

            if (nativeResult === 'completed') {
                return true;
            }

            if (nativeResult === 'started') {
                throw new Error(
                    'Штатное удаление запущено, но сайт ' +
                    'не подтвердил завершение. Обнови страницу ' +
                    'перед повторной попыткой.'
                );
            }

            /*
             * Резервный API-путь нужен лишь если сайт
             * изменит разметку штатного режима удаления.
             */
            if (!capturedHeaders.has('authorization')) {
                throw new Error(
                    'Не удалось запустить штатное удаление, ' +
                    'а токен для резервного способа ещё не получен.'
                );
            }

            const recordsRefreshed =
                await refreshMessageRecordsForDeletion(
                    context,
                    visibleIds
                );

            let ids = visibleIds;

            if (recordsRefreshed) {
                ids = expandIdsWithAlternatives(
                    visibleIds,
                    context.conversationId
                );
            } else {
                const deleteVisibleOnly = confirm(
                    'Не удалось проверить скрытые версии.\n\n' +
                    'Удалить только видимые сообщения?'
                );

                if (!deleteVisibleOnly) {
                    setActionButtonBusy(button, false);
                    return false;
                }
            }

            await deleteDirectly(
                context,
                ids,
                messagesToDelete
            );

            return true;
        } catch (error) {
            console.error(
                '[SpicyChat Quick Delete]',
                error
            );

            alert(
                'Не удалось удалить сообщения.\n\n' +
                error.message
            );

            setActionButtonBusy(button, false);
            return false;
        }
    }

    function addDeleteButton(message) {
        if (
            message.dataset
                .scQuickDeleteAdded === 'true'
        ) {
            return;
        }

        /*
         * Ищем верхнюю строку сообщения,
         * содержащую имя, аватар и три точки.
         */
        const headerRows = Array.from(
            message.querySelectorAll(
                'div.flex.justify-between.items-center.gap-md'
            )
        );

        const headerRow =
            headerRows.find(element => {
                return element.querySelector(
                    ':scope > div.relative'
                );
            });

        if (!headerRow) {
            return;
        }

        /*
         * Контейнер штатной кнопки с тремя точками.
         */
        const controlsContainer =
            headerRow.querySelector(
                ':scope > div.relative'
            );

        if (!controlsContainer) {
            return;
        }

        message.dataset.scQuickDeleteAdded =
            'true';

        controlsContainer.classList.add(
            'sc-quick-delete-controls'
        );

        const button =
            document.createElement('button');

        button.type = 'button';

        button.className =
            'sc-quick-delete-button';

        button.textContent = '🗑';

        button.title =
            'Удалить это и все следующие сообщения';

        button.addEventListener(
            'click',
            event => {
                event.preventDefault();
                event.stopPropagation();

                deleteFromMessage(
                    message,
                    button
                );
            }
        );

        /*
         * В своих сообщениях направление строки обратное.
         *
         * Поэтому корзина добавляется по-разному,
         * чтобы три точки всегда оставались
         * на привычном внешнем краю сообщения.
         */
        const isOwnMessage =
            headerRow.classList.contains(
                'flex-row-reverse'
            );

        if (isOwnMessage) {
            /*
             * Моё сообщение:
             * внешний край ← три точки, корзина, повтор
             */
            controlsContainer.appendChild(
                button
            );

            const replayButton =
                document.createElement('button');

            replayButton.type = 'button';
            replayButton.className =
                'sc-quick-delete-button sc-quick-replay-button';
            replayButton.title =
                'Удалить цепочку и отправить это сообщение заново';
            replayButton.setAttribute(
                'aria-label',
                'Повторить сообщение'
            );
            replayButton.innerHTML = `
                <svg aria-hidden="true" width="18" height="18"
                     viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 0 0-15.5-6.2L3 8"></path>
                    <path d="M3 3v5h5"></path>
                    <path d="M3 12a9 9 0 0 0 15.5 6.2L21 16"></path>
                    <path d="M16 16h5v5"></path>
                </svg>
            `;

            replayButton.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                replayUserMessage(message, replayButton);
            });

            controlsContainer.appendChild(
                replayButton
            );
        } else {
            /*
             * Сообщение бота:
             * корзина, три точки → внешний край
             */
            controlsContainer.prepend(
                button
            );
        }
    }

    function scanMessages() {
        getMessages().forEach(
            addDeleteButton
        );
    }

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;

        style.textContent = `
            .sc-quick-delete-controls {
                display: flex !important;
                align-items: center;
                gap: 6px;
            }

            .sc-quick-delete-button {
                position: static;
                z-index: 9999;

                width: 30px;
                height: 30px;
                padding: 0;

                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;

                color: #fff;
                background: rgba(25, 25, 25, 0.55);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;

                font-size: 15px;
                cursor: pointer;
                opacity: 0.55;

                transition:
                    opacity 120ms ease,
                    background 120ms ease;
            }

            .sc-quick-delete-button:hover {
                opacity: 1;
                background: #c62828;
            }

            .sc-quick-replay-button:hover {
                background: #2563a9;
            }

            .sc-quick-replay-button svg {
                display: block;
                pointer-events: none;
            }

            .sc-quick-delete-button:disabled {
                cursor: wait;
                opacity: 1;
            }
        `;

        document.head.appendChild(style);
    }

    function scheduleDomPass() {
        if (ensureScheduled) return;
        ensureScheduled = true;
        requestAnimationFrame(runDomPass);
    }

    function nodeTouchesMessage(node, includeDescendants = true) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
        const selector = [
            '[id^="message-"]',
            'button[aria-label="message-dropdown" i]',
            'div.flex.justify-between.items-center.gap-md',
        ].join(', ');
        return (
            node.matches?.(selector)
            || (includeDescendants && Boolean(node.querySelector?.(selector)))
        );
    }

    function handleRootMutations(records) {
        const relevant = records.some((record) => (
            nodeTouchesMessage(record.target, false)
            || Array.from(record.addedNodes).some((node) => nodeTouchesMessage(node, true))
            || Array.from(record.removedNodes).some((node) => nodeTouchesMessage(node, true))
        ));
        if (relevant) scheduleDomPass();
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
            scanMessages();

            if (!rootObserver) {
                rootObserver = new MutationObserver(handleRootMutations);
                rootObserver.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }
            resetRetry();
        } catch (error) {
            rootObserver?.disconnect();
            rootObserver = null;
            console.error('[SpicyChat Quick Delete] DOM-инициализация сорвалась, повторю автоматически.', error);
            scheduleRetry();
        }
    }

    function start() {
        runDomPass();
    }

    window.addEventListener('pageshow', start);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) start();
    });
    if (
        document.readyState === 'loading'
    ) {
        document.addEventListener(
            'DOMContentLoaded',
            start,
            { once: true }
        );
    }
    start();
}
