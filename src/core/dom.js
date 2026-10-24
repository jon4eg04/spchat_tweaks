// Shared discovery for inline menus and portals. No page data or credentials persist here.
export function createDomAdapters() {
    const triggerSelectors = {
        message: 'button[aria-label="message-dropdown" i]',
        chat: 'button[aria-label="chat-dropdown" i]',
        plus: 'button[aria-label="Plus-button" i], button[aria-label="Plus button" i]',
    };
    const items = 'button, [role="menuitem"]';
    const active = { message: null, chat: null, plus: null };
    const owners = new WeakMap();
    const listeners = new Set();
    let frame = null;
    let observing = false;

    const visible = node => {
        if (!node?.isConnected || node.closest('[hidden],[aria-hidden="true"]')) return false;
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const native = node => !node.closest('[id^="tm-sc-"], #spchat-tools-settings')
        && !Array.from(node.classList).some(name => name.startsWith('tm-sc-') || name.startsWith('sc-quick-'));
    const names = {
        copy: /^(copy|copy message|копировать|скопировать|скопировать сообщение)$/i,
        edit: /^(edit|edit message|редактировать|изменить)$/i,
        image: /^(generate image|image generation|создать изображение|сгенерировать изображение)$/i,
        suggest: /^(autogenerate|suggest reply|suggest response|предложить ответ|сгенерировать ответ)$/i,
        search: /^(web search|search the web|поиск в интернете)$/i,
        command: /^(command \(ooc\)|command|команда \(ooc\)|команда)$/i,
        remove: /^(remove messages|удалить сообщения)$/i,
        saved: /^(view saved chats|saved chats|сохранённые чаты|сохраненные чаты)$/i,
        newChat: /^(start new chat|new chat|начать новый чат|новый чат)$/i,
    };
    const icons = { copy: '.lucide-copy', edit: '.lucide-pencil, .lucide-square-pen', image: '.lucide-image, .lucide-image-plus', suggest: '.lucide-lightbulb', search: '.lucide-globe', command: '.lucide-terminal' };
    function isAction(node, action) {
        if (!native(node)) return false;
        const labels = [node.getAttribute('aria-label'), node.getAttribute('title'), node.textContent]
            .filter(Boolean).map(text => text.replace(/\s+/g, ' ').trim());
        if (labels.some(label => names[action]?.test(label))) return true;
        if (action === 'image' && node.getAttribute('data-testid') === 'ImageGenerationButton') return true;
        return Boolean(icons[action] && node.querySelector(icons[action]));
    }
    function findAction(scope, action, mustBeVisible = false) {
        const candidates = scope?.querySelectorAll ? Array.from(scope.querySelectorAll(items)) : [];
        if (scope?.matches?.(items)) candidates.unshift(scope);
        return candidates.find(node => isAction(node, action) && (!mustBeVisible || visible(node))) || null;
    }
    function notify() {
        if (frame !== null) return;
        frame = requestAnimationFrame(() => {
            frame = null;
            for (const callback of listeners) {
                try { callback(); } catch (error) { console.error('[SpicyChat Tools] Menu refresh failed.', error); }
            }
        });
    }
    function remember(event) {
        if (!(event.target instanceof Element)) return;
        for (const [kind, selector] of Object.entries(triggerSelectors)) {
            const button = event.target.closest(selector);
            if (!button) continue;
            for (const key of Object.keys(active)) active[key] = null;
            active[kind] = button;
            notify();
            break;
        }
    }
    function start() {
        if (observing) return;
        observing = true;
        document.addEventListener('pointerdown', remember, true);
        document.addEventListener('click', remember, true);
        const selector = `${items}, [role="menu"], textarea, ${Object.values(triggerSelectors).join(',')}`;
        const touches = node => node?.nodeType === Node.ELEMENT_NODE && (node.matches(selector) || node.querySelector(selector));
        new MutationObserver(records => {
            if (records.some(record => (record.type === 'attributes' && record.target.matches(selector))
                || Array.from(record.addedNodes).some(touches) || Array.from(record.removedNodes).some(touches))) notify();
        }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-expanded', 'aria-label', 'data-state'] });
    }
    function menuContainer(item) {
        const menu = item.closest('[role="menu"], [data-radix-menu-content]');
        if (menu) return menu;
        return item.parentElement;
    }
    function findMenu(kind, button) {
        const actions = kind === 'message' ? ['copy', 'edit'] : kind === 'chat' ? ['saved', 'newChat'] : ['image', 'suggest', 'search', 'command'];
        const fits = menu => menu && visible(menu) && actions.some(action => findAction(menu, action));
        const controlled = button?.getAttribute('aria-controls');
        if (controlled) {
            const menu = document.getElementById(controlled);
            if (fits(menu)) return menu;
        }
        const boundary = kind === 'message' ? button?.closest('[id^="message-"]') : null;
        let host = button?.parentElement;
        for (let depth = 0; host && depth < 4 && host !== document.body; depth++, host = host.parentElement) {
            for (const child of host.children) if (!child.contains(button) && fits(child)) return child;
            if (host === boundary) break;
        }
        if (active[kind] !== button) return null;
        for (const item of document.querySelectorAll(items)) {
            if (!visible(item) || !actions.some(action => isAction(item, action))) continue;
            const menu = menuContainer(item);
            if (fits(menu)) return menu;
        }
        return null;
    }
    function messageMenus() {
        const result = [];
        const seen = new Set();
        for (const button of document.querySelectorAll(triggerSelectors.message)) {
            const message = button.closest('[id^="message-"]');
            if (!message) continue;
            const menu = findMenu('message', button);
            const template = findAction(menu, 'copy') || findAction(menu, 'edit');
            if (!menu || !template || seen.has(menu)) continue;
            seen.add(menu);
            if (owners.has(menu) && owners.get(menu) !== message) {
                for (const item of menu.querySelectorAll('.tm-sc-save-history-message, .tm-sc-add-message-bookmark')) item.remove();
            }
            owners.set(menu, message);
            result.push({ message, menu, template, controls: button.parentElement });
        }
        return result;
    }
    function messageFor(node) {
        const direct = node?.closest?.('[id^="message-"]');
        if (direct) return direct;
        for (let current = node; current; current = current.parentElement) {
            const owner = owners.get(current);
            if (owner?.isConnected) return owner;
        }
        return null;
    }
    return {
        subscribe(callback) { start(); listeners.add(callback); },
        findAction, messageMenus, messageFor,
        plusMenu: button => findMenu('plus', button),
        chatMenu: button => findMenu('chat', button),
        composerAction(action) {
            const textarea = document.querySelector('textarea[placeholder="Message..."]');
            let scope = textarea?.parentElement;
            while (scope && !scope.querySelector(triggerSelectors.plus)) scope = scope.parentElement;
            return findAction(scope, action);
        },
        cloneMenuButton(template) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = Array.from(template.classList).filter(name => !name.startsWith('tm-sc-') && !name.startsWith('sc-quick-')).join(' ');
            button.innerHTML = template.innerHTML;
            if (!button.querySelector('p, span')) {
                const icon = button.querySelector('svg')?.cloneNode(true);
                const label = document.createElement('span');
                label.textContent = template.textContent.trim();
                button.replaceChildren(...(icon ? [icon] : []), label);
            }
            if (template.getAttribute('role') === 'menuitem') button.setAttribute('role', 'menuitem');
            return button;
        },
    };
}
