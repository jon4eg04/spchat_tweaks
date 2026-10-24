// Optional feature based on Hide selected model blocks v1.1 (namespace: local).
export default function init(runtime) {
    const targetTexts = ['Qwen3 235B 2507', 'Codex 24B'];
    const hiddenRows = new Map();
    const pendingRoots = new Set();
    let scheduled = false;

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
        // React can reuse a model row for a different model. Restore its original styling.
        for (const [row, previous] of hiddenRows) {
            if (!row.isConnected) { hiddenRows.delete(row); continue; }
            if (Array.from(row.querySelectorAll('p')).some(hasTargetText)) continue;
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
    const observer = new MutationObserver(mutations => {
        let changed = false;
        for (const mutation of mutations) {
            const target = mutation.target.nodeType === Node.TEXT_NODE ? mutation.target.parentElement : mutation.target;
            const paragraph = target?.closest?.('p');
            if (paragraph) { pendingRoots.add(paragraph); changed = true; }
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) { pendingRoots.add(node); changed = true; }
            }
            if (mutation.removedNodes.length && hiddenRows.size) changed = true;
        }
        if (changed) schedule();
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true, characterData: true });
}
