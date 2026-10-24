// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
export default function init(runtime) {
    'use strict';

    const INSTANCE_KEY = '__spicyChatSuggestReplyShortcutV1';
    if (window[INSTANCE_KEY]) return;
    window[INSTANCE_KEY] = true;

    const TEXTAREA_SELECTOR = 'textarea[placeholder="Message..."]';
    const NATIVE_SUGGEST_SELECTOR = 'button[aria-label="autogenerate" i]';
    const NATIVE_IMAGE_SELECTOR = 'button[data-testid="ImageGenerationButton"], button[aria-label="Generate image"]';
    const PLUS_BUTTON_SELECTOR = 'button[aria-label="Plus-button"], button[aria-label="Plus button"]';
    const MENU_SUGGEST_SELECTOR = 'button[aria-label="Suggest Reply"]';
    const MENU_IMAGE_SELECTOR = 'button[aria-label="Generate Image"]';
    const SAVED_TEXTS_WRAP_SELECTOR = '#tm-sc-saved-texts-toolbar';
    const EMOJI_PICKER_WRAP_SELECTOR = '#tm-sc-emoji-trigger-wrap';
    const WRAP_ID = 'tm-sc-action-shortcuts-wrap';
    const STYLE_ID = 'tm-sc-action-shortcuts-style';

    let imageButton = null;
    let suggestButton = null;
    let ensureScheduled = false;
    let actionInProgress = false;
    let rootObserver = null;
    let retryTimer = null;
    let retryDelay = 250;
    let activeTextarea = null;

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const css = `
            [data-tm-sc-custom-action-hidden="true"] {
                display: none !important;
            }

            #${WRAP_ID} {
                display: flex !important;
                flex: 0 0 auto !important;
                gap: 0 !important;
                align-items: flex-end !important;
                align-self: flex-end !important;
                margin-bottom: 4px !important;
            }

            #${WRAP_ID} .tm-sc-action-shortcut {
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

            #${WRAP_ID} .tm-sc-action-shortcut:hover,
            #${WRAP_ID} .tm-sc-action-shortcut.is-busy {
                color: #ffffff !important;
                background: rgba(255, 255, 255, 0.11) !important;
            }

            #${WRAP_ID} .tm-sc-action-shortcut:active {
                transform: scale(0.94) !important;
            }

            #${WRAP_ID} .tm-sc-action-shortcut:focus-visible {
                outline: 2px solid #1687f8 !important;
                outline-offset: 2px !important;
            }

            #${WRAP_ID} .tm-sc-action-shortcut[hidden] {
                display: none !important;
            }

            #${WRAP_ID} .tm-sc-action-shortcut[data-tm-tooltip]::before,
            #${WRAP_ID} .tm-sc-action-shortcut[data-tm-tooltip]::after {
                position: absolute !important;
                left: 50% !important;
                z-index: 2147483647 !important;
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
                transition: opacity 120ms ease, transform 120ms ease, visibility 0s linear 120ms !important;
            }

            #${WRAP_ID} .tm-sc-action-shortcut[data-tm-tooltip]::before {
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

            #${WRAP_ID} .tm-sc-action-shortcut[data-tm-tooltip]::after {
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
                #${WRAP_ID} .tm-sc-action-shortcut[data-tm-tooltip]:hover::before,
                #${WRAP_ID} .tm-sc-action-shortcut[data-tm-tooltip]:hover::after {
                    opacity: 1 !important;
                    visibility: visible !important;
                    transition-delay: 320ms !important;
                }

                #${WRAP_ID} .tm-sc-action-shortcut[data-tm-tooltip]:hover::before {
                    transform: translate(-50%, 0) !important;
                }

                #${WRAP_ID} .tm-sc-action-shortcut[data-tm-tooltip]:hover::after {
                    transform: translate(-50%, 0) rotate(45deg) !important;
                }
            }

            #${WRAP_ID} .tm-sc-action-shortcut[data-tm-tooltip]:focus-visible::before,
            #${WRAP_ID} .tm-sc-action-shortcut[data-tm-tooltip]:focus-visible::after {
                opacity: 1 !important;
                visibility: visible !important;
                transition-delay: 0ms !important;
            }

            #${WRAP_ID} .tm-sc-action-shortcut[data-tm-tooltip]:focus-visible::before {
                transform: translate(-50%, 0) !important;
            }

            #${WRAP_ID} .tm-sc-action-shortcut[data-tm-tooltip]:focus-visible::after {
                transform: translate(-50%, 0) rotate(45deg) !important;
            }

            #${WRAP_ID} .tm-sc-action-shortcut.is-busy svg {
                animation: tm-sc-suggest-reply-pulse 700ms ease-in-out infinite alternate !important;
            }

            #${WRAP_ID} .tm-sc-action-shortcut.is-error {
                color: #ff6b6b !important;
                background: rgba(255, 75, 75, 0.12) !important;
            }

            @keyframes tm-sc-suggest-reply-pulse {
                from { opacity: 0.48; transform: scale(0.88); }
                to { opacity: 1; transform: scale(1.04); }
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

    function findVisibleElement(selector) {
        const candidates = Array.from(document.querySelectorAll(selector)).filter(isVisible);
        return candidates.length ? candidates[candidates.length - 1] : null;
    }

    function findTextarea() {
        return findVisibleElement(TEXTAREA_SELECTOR);
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

    function findComposerScope(textarea) {
        let node = textarea && textarea.parentElement;
        for (let depth = 0; node && depth < 10; depth += 1, node = node.parentElement) {
            if (node.querySelector(PLUS_BUTTON_SELECTOR)) return node;
        }
        return document;
    }

    function getNativeControlShell(container, button) {
        const tooltipShell = button && button.closest('div[data-tooltip-content]');
        if (tooltipShell && tooltipShell !== container && container.contains(tooltipShell)) {
            return tooltipShell;
        }

        const parent = button && button.parentElement;
        if (
            parent
            && parent !== container
            && parent.childElementCount === 1
            && parent.firstElementChild === button
        ) {
            return parent;
        }
        return button;
    }

    function getNativeButtons(container, selector) {
        return Array.from(container.querySelectorAll(selector)).filter((button) => (
            !button.closest(`#${WRAP_ID}`)
        ));
    }

    function hideNativeControls(container) {
        for (const selector of [NATIVE_IMAGE_SELECTOR, NATIVE_SUGGEST_SELECTOR]) {
            for (const button of getNativeButtons(container, selector)) {
                const shell = getNativeControlShell(container, button);
                if (!shell) continue;
                shell.dataset.tmScCustomActionHidden = 'true';
                shell.style.setProperty('display', 'none', 'important');
            }
        }
    }

    function findNativeButtonInComposer(selector) {
        const textarea = findTextarea();
        if (!textarea) return null;

        const composerScope = findComposerScope(textarea);
        const buttons = getNativeButtons(composerScope, selector);
        return buttons.length ? buttons[buttons.length - 1] : null;
    }

    function createActionButtons() {
        const wrap = document.createElement('div');
        wrap.id = WRAP_ID;

        const image = document.createElement('button');
        image.type = 'button';
        image.className = 'tm-sc-action-shortcut tm-sc-generate-image-shortcut';
        image.setAttribute('aria-label', 'Создать изображение');
        image.dataset.tmTooltip = 'Создать изображение';
        image.innerHTML = `
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2"></rect>
                <circle cx="9" cy="9" r="2"></circle>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
            </svg>
        `;

        const suggest = document.createElement('button');
        suggest.type = 'button';
        suggest.className = 'tm-sc-action-shortcut tm-sc-suggest-reply-shortcut';
        suggest.setAttribute('aria-label', 'Suggest Reply в один клик');
        suggest.dataset.tmTooltip = 'Предложить ответ';
        suggest.innerHTML = `
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 14c.2-1 .7-1.7 1.5-2.5a6 6 0 0 0-9-8 6 6 0 0 0 0 8c.8.8 1.3 1.5 1.5 2.5"></path>
                <path d="M9 18h6"></path>
                <path d="M10 22h4"></path>
            </svg>
        `;

        for (const button of [image, suggest]) {
            button.addEventListener('mousedown', (event) => event.preventDefault());
        }

        image.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            void activateImageGeneration();
        });

        suggest.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            void activateSuggestReply();
        });

        wrap.append(image, suggest);
        imageButton = image;
        suggestButton = suggest;
        return wrap;
    }

    function removeActionButtons() {
        const wrap = document.getElementById(WRAP_ID);
        if (wrap) wrap.remove();
        imageButton = null;
        suggestButton = null;
    }

    function ensureActionButtons() {
        ensureScheduled = false;

        const textarea = findTextarea();
        const inputWrapper = textarea && findInputWrapper(textarea);
        const row = inputWrapper && inputWrapper.parentElement;
        if (!textarea || !inputWrapper || !row) {
            activeTextarea = null;
            removeActionButtons();
            return;
        }

        activeTextarea = textarea;
        row.style.setProperty('column-gap', '0px', 'important');
        hideNativeControls(findComposerScope(textarea));

        let wrap = document.getElementById(WRAP_ID);
        if (!wrap || wrap.parentElement !== row) {
            if (wrap) wrap.remove();
            wrap = createActionButtons();
        } else {
            imageButton = wrap.querySelector('.tm-sc-generate-image-shortcut');
            suggestButton = wrap.querySelector('.tm-sc-suggest-reply-shortcut');
            if (!imageButton || !suggestButton) {
                wrap.remove();
                wrap = createActionButtons();
            }
        }

        imageButton.hidden = textarea.value.length > 0;

        const savedTextsWrap = row.querySelector(SAVED_TEXTS_WRAP_SELECTOR);
        const emojiWrap = row.querySelector(EMOJI_PICKER_WRAP_SELECTOR);
        const anchor = savedTextsWrap || emojiWrap || inputWrapper;
        if (wrap.parentElement !== row || wrap.nextElementSibling !== anchor) {
            row.insertBefore(wrap, anchor);
        }
    }

    function scheduleEnsureActionButtons() {
        if (ensureScheduled) return;
        ensureScheduled = true;
        requestAnimationFrame(ensureDomFeatures);
    }

    function nodeContainsActionFeature(node, includeDescendants = true) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
        const selector = [
            TEXTAREA_SELECTOR,
            NATIVE_SUGGEST_SELECTOR,
            NATIVE_IMAGE_SELECTOR,
            PLUS_BUTTON_SELECTOR,
            `#${WRAP_ID}`,
            SAVED_TEXTS_WRAP_SELECTOR,
            EMOJI_PICKER_WRAP_SELECTOR,
        ].join(', ');
        return node.matches?.(selector) || (includeDescendants && Boolean(node.querySelector?.(selector)));
    }

    function handleRootMutations(records) {
        const relevant = Boolean(activeTextarea && !activeTextarea.isConnected) || records.some((record) => (
            nodeContainsActionFeature(record.target, false)
            || Array.from(record.addedNodes).some((node) => nodeContainsActionFeature(node, true))
            || Array.from(record.removedNodes).some((node) => nodeContainsActionFeature(node, true))
        ));
        if (relevant) scheduleEnsureActionButtons();
    }

    function waitForVisibleElement(selector, timeout = 1600, action = null) {
        const startedAt = Date.now();
        return new Promise((resolve) => {
            const check = () => {
                const plus = findVisibleElement(PLUS_BUTTON_SELECTOR);
                const element = findVisibleElement(selector)
                    || (action && runtime.dom?.findAction(runtime.dom.plusMenu(plus), action, true));
                if (element) {
                    resolve(element);
                    return;
                }
                if (Date.now() - startedAt >= timeout) {
                    resolve(null);
                    return;
                }
                requestAnimationFrame(check);
            };
            check();
        });
    }

    function showTemporaryError(button) {
        if (!button || !button.isConnected) return;
        button.classList.add('is-error');
        window.setTimeout(() => {
            if (button.isConnected) button.classList.remove('is-error');
        }, 900);
    }

    async function activateAction({ button, nativeSelector, menuSelector, actionName }) {
        if (actionInProgress) return;
        actionInProgress = true;

        if (button) button.classList.add('is-busy');

        try {
            const action = actionName === 'Suggest Reply' ? 'suggest' : 'image';
            const nativeButton = findNativeButtonInComposer(nativeSelector) || runtime.dom?.composerAction(action);
            if (nativeButton) {
                if (!nativeButton.disabled) nativeButton.click();
                return;
            }

            const plus = findVisibleElement(PLUS_BUTTON_SELECTOR);
            let menuItem = findVisibleElement(menuSelector) || runtime.dom?.findAction(runtime.dom.plusMenu(plus), action, true);
            if (!menuItem) {
                const plusButton = findVisibleElement(PLUS_BUTTON_SELECTOR);
                if (!plusButton) {
                    console.warn(`[Custom action buttons] Не найдена кнопка Plus button для действия: ${actionName}.`);
                    showTemporaryError(button);
                    return;
                }

                plusButton.click();
                menuItem = await waitForVisibleElement(menuSelector, 1600, action);
            }

            if (menuItem && !menuItem.disabled) menuItem.click();
            else {
                console.warn(`[Custom action buttons] Не найден пункт меню для действия: ${actionName}.`);
                showTemporaryError(button);
            }
        } finally {
            actionInProgress = false;
            if (button && button.isConnected) button.classList.remove('is-busy');
        }
    }

    function activateImageGeneration() {
        return activateAction({
            button: imageButton,
            nativeSelector: NATIVE_IMAGE_SELECTOR,
            menuSelector: MENU_IMAGE_SELECTOR,
            actionName: 'Generate Image',
        });
    }

    function activateSuggestReply() {
        return activateAction({
            button: suggestButton,
            nativeSelector: NATIVE_SUGGEST_SELECTOR,
            menuSelector: MENU_SUGGEST_SELECTOR,
            actionName: 'Suggest Reply',
        });
    }

    document.addEventListener('input', (event) => {
        if (event.target && event.target.matches(TEXTAREA_SELECTOR)) scheduleEnsureActionButtons();
    }, true);

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
            ensureActionButtons();

            if (!rootObserver) {
                rootObserver = new MutationObserver(handleRootMutations);
                rootObserver.observe(document.documentElement, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['aria-label', 'data-testid'],
                });
            }
            resetRetry();
        } catch (error) {
            rootObserver?.disconnect();
            rootObserver = null;
            console.error('[Custom action buttons] Инициализация сорвалась, повторю автоматически.', error);
            scheduleRetry();
        }
    }

    ensureDomFeatures();

    window.addEventListener('pageshow', ensureDomFeatures);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) ensureDomFeatures();
    });
    runtime.dom?.subscribe(scheduleEnsureActionButtons);

}
