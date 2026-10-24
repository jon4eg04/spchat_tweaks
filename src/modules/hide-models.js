// Optional feature based on Hide selected model blocks v1.1 (namespace: local).
export default function init(runtime) {
    const targetTexts = ['Qwen3 235B 2507', 'Codex 24B'];
    const hiddenRows = new Map();
    const pendingRoots = new Set();
    let scheduled = false;
    const models = runtime.models;
    const shortcutAttribute = 'data-sc-quick-model';

    function title(row) { return row?.querySelector('p')?.textContent.trim() || ''; }
    function quickRows(panel) {
        return [...panel.querySelectorAll('div.cursor-pointer')].filter(row =>
            row.classList.contains('px-[18px]') && row.classList.contains('py-[10px]'));
    }
    function nativeBinding(rows) {
        for (const row of rows) {
            const expected = models.find(model => model.label === title(row));
            if (!expected) continue;
            const binding = runtime.nativeModels.read(row, expected);
            if (binding) return binding;
        }
        return null;
    }

    function updateShortcutState(shortcut, model, binding) {
        const disabled = !binding;
        const state = disabled ? 'true' : 'false';
        if (shortcut.getAttribute('aria-disabled') !== state) shortcut.setAttribute('aria-disabled', state);
        shortcut.tabIndex = disabled ? -1 : 0;
        shortcut.title = disabled ? 'Не удалось подключить штатный выбор модели. Перезагрузи страницу.' : '';
        const check = shortcut.querySelector('[data-sc-model-check]');
        const selected = binding?.activeModel === model.id;
        if (selected && !check) {
            // Same check icon, size and color as the supplied native row.
            const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            for (const [name, value] of Object.entries({ width: '20', height: '20', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'lucide lucide-check inline-flex items-center justify-center text-blue-10', 'data-sc-model-check': 'true', 'aria-hidden': 'true' })) icon.setAttribute(name, value);
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M20 6 9 17l-5-5'); icon.append(path); shortcut.append(icon);
        } else if (!selected) check?.remove();
    }

    function updateQuickMenus() {
        for (const panel of document.querySelectorAll('[data-testid="Dropdown-Panel"]')) {
            const rows = quickRows(panel);
            const explore = rows.find(row => title(row) === 'Explore all models');
            if (!explore) continue; // Never rewrite unrelated dropdowns or the full chooser.
            const list = explore.parentElement;
            const nativeRows = rows.filter(row => row.parentElement === list && !row.hasAttribute(shortcutAttribute));
            const binding = nativeBinding(nativeRows);
            const firstControl = [...list.children].find(row => title(row) === 'Available models');
            if (firstControl && firstControl.style.order !== '-10') firstControl.style.order = '-10';
            for (const row of nativeRows) {
                const label = title(row);
                if (row === explore || label === 'Generation Settings') continue;
                const index = models.findIndex(model => model.label === label);
                row.toggleAttribute('data-sc-excluded-model', index < 0);
                if (index < 0) hideRow(row);
                else if (row.style.order !== String(index - 9)) row.style.order = String(index - 9);
            }
            for (const [index, model] of models.entries()) {
                const native = nativeRows.find(row => title(row) === model.label);
                let shortcut = list.querySelector(`[${shortcutAttribute}="${model.id}"]`);
                if (native) { shortcut?.remove(); continue; }
                if (shortcut) { updateShortcutState(shortcut, model, binding); continue; }
                const template = nativeRows.find(row => models.some(item => item.label === title(row)));
                if (!template) continue;
                shortcut = template.cloneNode(true);
                shortcut.removeAttribute('id');
                shortcut.removeAttribute('data-sc-excluded-model');
                shortcut.removeAttribute('data-hidden-by-tampermonkey');
                shortcut.style.removeProperty('display');
                shortcut.style.order = String(index - 9);
                shortcut.setAttribute(shortcutAttribute, model.id);
                shortcut.setAttribute('role', 'menuitem');
                shortcut.tabIndex = 0;
                const heading = shortcut.querySelector('p');
                heading.textContent = model.label;
                const description = shortcut.querySelector('p.text-gray-10');
                if (description && model.description) description.textContent = model.description;
                // Keep native typography without copying another model's badges/check.
                for (const paragraph of [...shortcut.querySelectorAll('p')]) {
                    if (paragraph === heading || (paragraph === description && model.description)) continue;
                    paragraph.remove();
                }
                shortcut.querySelectorAll('svg, [id]').forEach(node => node.remove());
                // Badges have wrappers that would otherwise leave empty bordered boxes.
                for (const node of [...shortcut.querySelectorAll('div')].reverse()) if (!node.textContent.trim()) node.remove();
                shortcut.addEventListener('click', event => {
                    event.preventDefault(); event.stopPropagation();
                    // Resolve again after any intervening React updates; never
                    // retain a callback from a previous opening of the menu.
                    const currentRows = quickRows(panel).filter(row => !row.hasAttribute(shortcutAttribute));
                    const current = panel.isConnected && nativeBinding(currentRows);
                    if (!current) { updateShortcutState(shortcut, model, null); return; }
                    current.select(model);
                });
                shortcut.addEventListener('keydown', event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault(); event.stopPropagation(); shortcut.click();
                    }
                });
                updateShortcutState(shortcut, model, binding);
                list.insertBefore(shortcut, explore);
            }
        }
    }

    function hasTargetText(element) {
        const text = element.textContent || '';
        return targetTexts.some(target => text.includes(target));
    }

    function findRow(element) {
        for (let current = element; current && current !== document.body; current = current.parentElement) {
            if (current.tagName === 'DIV' && current.classList.contains('cursor-pointer')
                && current.classList.contains('px-[18px]') && current.classList.contains('py-[10px]')) return current;
        }
        return element.closest('div.cursor-pointer');
    }

    function hideParagraph(paragraph) {
        if (!hasTargetText(paragraph)) return;
        const row = findRow(paragraph);
        if (!row) return;
        hideRow(row);
    }

    function hideRow(row) {
        if (!hiddenRows.has(row)) hiddenRows.set(row, {
            display: row.style.getPropertyValue('display'),
            priority: row.style.getPropertyPriority('display'),
            marker: row.getAttribute('data-hidden-by-tampermonkey'),
        });
        row.style.setProperty('display', 'none', 'important');
        row.dataset.hiddenByTampermonkey = 'true';
    }

    function scan(root) {
        // querySelectorAll excludes root itself; newly inserted <p> nodes matter too.
        if (root.matches?.('p')) hideParagraph(root);
        root.querySelectorAll?.('p').forEach(hideParagraph);
    }

    function flush() {
        scheduled = false;
        for (const root of pendingRoots) if (root === document || root.isConnected) scan(root);
        pendingRoots.clear();
        updateQuickMenus();
        // React can reuse a model row for a different model. Restore its original styling.
        for (const [row, previous] of hiddenRows) {
            if (!row.isConnected) { hiddenRows.delete(row); continue; }
            if (row.hasAttribute('data-sc-excluded-model') || Array.from(row.querySelectorAll('p')).some(hasTargetText)) continue;
            if (previous.display) row.style.setProperty('display', previous.display, previous.priority);
            else row.style.removeProperty('display');
            if (previous.marker === null) row.removeAttribute('data-hidden-by-tampermonkey');
            else row.setAttribute('data-hidden-by-tampermonkey', previous.marker);
            hiddenRows.delete(row);
        }
    }

    function schedule() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(flush);
    }

    scan(document);
    updateQuickMenus();
    const observer = new MutationObserver(mutations => {
        let changed = false;
        for (const mutation of mutations) {
            const target = mutation.target.nodeType === Node.TEXT_NODE ? mutation.target.parentElement : mutation.target;
            const paragraph = target?.closest?.('p');
            if (paragraph) { pendingRoots.add(paragraph); changed = true; }
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) { pendingRoots.add(node); changed = true; }
            }
            if (mutation.removedNodes.length) changed = true;
        }
        if (changed) schedule();
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true, characterData: true });
}
