// Always-available per-conversation controls; persistence stays in the feature.
export function createChatPanel({ getContext, read, save, models, minTokens, maxTokens, tokenStep, initialTokens, shadowMode = 'closed' }) {
    const host = document.createElement('div'); host.id = 'spchat-chat-panel';
    const root = host.attachShadow({ mode: shadowMode });
    const style = document.createElement('style');
    style.textContent = `
        :host { all: initial; position: fixed; right: 18px; top: 72px; z-index: 90; width: min(290px, calc(100vw - 24px)); color-scheme: dark; font: 13px/1.45 system-ui, sans-serif; color: #f1f1f6; }
        :host([hidden]), [hidden] { display: none !important; }
        * { box-sizing: border-box; }
        details.panel { background: #22242ef2; border: 1px solid #484a5b; border-radius: 12px; box-shadow: 0 8px 28px #0005; max-height: calc(100dvh - 90px); overflow-y: auto; }
        summary { cursor: pointer; }
        .heading { padding: 12px 32px 12px 14px; position: relative; list-style: none; font-weight: 650; }
        .heading::-webkit-details-marker { display: none; }
        .heading::after { content: '▾'; position: absolute; right: 14px; top: 12px; }
        .panel:not([open]) > .heading::after { content: '▸'; }
        .compact { display: block; color: #c5c5d5; font-size: 11px; font-weight: 400; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .panel[open] > .heading .compact { display: none; }
        .body { padding: 0 14px 12px; }
        .field { display: block; margin: 0 0 12px; }
        .label { display: block; color: #c5c5d5; margin-bottom: 5px; }
        select, textarea, button, input { font: inherit; }
        select, textarea { width: 100%; color: #f4f4fa; background: #151720; border: 1px solid #505467; border-radius: 7px; padding: 8px; }
        select { cursor: pointer; }
        textarea { margin-top: 8px; min-height: 90px; resize: vertical; }
        input[type=range] { width: 100%; margin: 6px 0 0; accent-color: #a395f7; }
        input[type=checkbox] { accent-color: #a395f7; flex-shrink: 0; margin: 3px 0 0; }
        button { color: #d4ccff; cursor: pointer; background: transparent; border: 0; padding: 0; font-size: 11px; text-decoration: underline; }
        :focus-visible { outline: 2px solid #b7a9ff; outline-offset: 2px; }
        .token-head { display: flex; justify-content: space-between; gap: 10px; }
        .token-head .label { margin: 0; }
        fieldset { min-inline-size: 0; margin: 0; padding: 0; border: 0; }
        legend { color: #c5c5d5; margin-bottom: 5px; }
        .commands { max-height: 180px; overflow-y: auto; }
        .command { display: flex; align-items: flex-start; gap: 8px; padding: 4px 0; overflow-wrap: anywhere; cursor: pointer; }
        .empty, .hint { color: #a7a8bb; font-size: 11px; margin: 6px 0; }
        .manual { margin-top: 10px; }
        .manual > summary { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: #d4ccff; }
        .error { color: #ffb6ab; font-size: 12px; margin-top: 8px; overflow-wrap: anywhere; }
        @media(max-width: 540px) { :host { right: 12px; top: 64px; width: min(280px, calc(100vw - 24px)); } details.panel { max-height: calc(100dvh - 80px); } }
    `;
    for (const type of ['keydown', 'keyup', 'keypress']) root.addEventListener(type, event => event.stopPropagation());
    const panel = document.createElement('details'); panel.className = 'panel'; panel.open = true;
    const heading = document.createElement('summary'); heading.className = 'heading';
    heading.append(document.createTextNode('Настройки чата'));
    const compactSettings = document.createElement('span'); compactSettings.className = 'compact';
    const compactCommands = document.createElement('span'); compactCommands.className = 'compact';
    const compactManual = document.createElement('span'); compactManual.className = 'compact';
    heading.append(compactSettings, compactCommands, compactManual);
    const body = document.createElement('div'); body.className = 'body';
    const modelLabel = document.createElement('label'); modelLabel.className = 'field';
    const modelCaption = document.createElement('span'); modelCaption.className = 'label'; modelCaption.textContent = 'Модель для чата';
    const model = document.createElement('select'); model.className = 'tm-sc-response-model-select'; model.setAttribute('aria-label', 'Модель для этого диалога');
    for (const item of models) { const option = document.createElement('option'); option.value = item.id; option.textContent = item.label; model.append(option); }
    modelLabel.append(modelCaption, model);
    const tokenLabel = document.createElement('div'); tokenLabel.className = 'field';
    const tokenHead = document.createElement('span'); tokenHead.className = 'token-head';
    const tokenCaption = document.createElement('span'); tokenCaption.className = 'label';
    const siteTokens = document.createElement('button'); siteTokens.type = 'button'; siteTokens.textContent = 'Как на сайте';
    const range = document.createElement('input'); range.type = 'range'; range.min = String(minTokens); range.max = String(maxTokens); range.step = String(tokenStep);
    range.className = 'tm-sc-response-length-slider'; range.setAttribute('aria-label', 'Токенов на ответ');
    tokenHead.append(tokenCaption, siteTokens); tokenLabel.append(tokenHead, range);
    const commandsField = document.createElement('fieldset');
    const legend = document.createElement('legend'); legend.textContent = 'Быстрые команды';
    const commands = document.createElement('div'); commands.className = 'commands';
    const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'Добавь команды в SC Tools → Быстрые команды.';
    commandsField.append(legend, commands, empty);
    const manualDetails = document.createElement('details'); manualDetails.className = 'manual';
    const manualCaption = document.createElement('summary');
    const manual = document.createElement('textarea'); manual.className = 'tm-sc-persistent-command-input'; manual.setAttribute('aria-label', 'Текст постоянной команды'); manual.placeholder = 'Ручная команда без /cmd';
    manualDetails.append(manualCaption, manual);
    const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = 'Сохраняется сразу · каждая команда — отдельная /cmd';
    const status = document.createElement('div'); status.className = 'error'; status.setAttribute('role', 'status');
    body.append(modelLabel, tokenLabel, commandsField, manualDetails, hint, status); panel.append(heading, body); root.append(style, panel);

    let conversation = '';
    let signature = '';
    const rows = new Map();
    const errors = new Map();
    const preview = value => value.replace(/\s+/g, ' ').trim() || 'не задана';
    const showErrors = () => { const text = [...errors.values()].join(' '); if (status.textContent !== text) status.textContent = text; };

    function refresh() {
        if (!host.isConnected && document.body) document.body.append(host);
        const current = getContext()?.conversationId || '';
        host.hidden = !current;
        if (!current) { conversation = ''; signature = ''; delete host.dataset.scConversation; return; }
        const changedChat = current !== conversation;
        try {
            const state = read(current);
            if (errors.delete('read')) { signature = ''; showErrors(); }
            for (const control of [model, range, manual, siteTokens]) control.disabled = false;
            const nextSignature = JSON.stringify(state);
            if (!changedChat && nextSignature === signature) return;
            conversation = current; host.dataset.scConversation = current; signature = nextSignature;
            if (changedChat) { errors.clear(); showErrors(); manualDetails.open = false; }
            const legacy = model.querySelector('[data-legacy-model]');
            if (state.model === 'glm45' && !legacy) {
                const option = document.createElement('option'); option.value = 'glm45'; option.textContent = 'Glam 4.6 (сохранено ранее)'; option.dataset.legacyModel = ''; model.append(option);
            } else if (state.model !== 'glm45') legacy?.remove();
            model.value = state.model;
            range.value = String(state.limit ?? initialTokens);
            tokenCaption.textContent = state.limit === null ? 'Ответ: токены сайта' : `Ответ: ${state.limit} токенов`;
            siteTokens.hidden = state.limit === null;
            if (changedChat || (!errors.has('manual') && root.activeElement !== manual)) manual.value = state.manual;
            manualCaption.textContent = `Ручная: ${preview(state.manual)}`; manualCaption.title = state.manual;
            const selected = new Set(state.selectedIds);
            const present = new Set(state.commands.map(item => item.id));
            for (const [id, row] of rows) if (!present.has(id)) { row.label.remove(); rows.delete(id); }
            for (const [index, item] of state.commands.entries()) {
                let row = rows.get(item.id);
                if (!row) {
                    const label = document.createElement('label'); label.className = 'command';
                    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = item.id;
                    const name = document.createTextNode(''); label.append(checkbox, name);
                    row = { label, checkbox, name }; rows.set(item.id, row);
                    checkbox.addEventListener('change', () => commit('commands', id => {
                        const ids = [...commands.querySelectorAll('input:checked')].map(input => input.value);
                        save.commands(id, ids);
                    }));
                }
                row.name.textContent = item.name; row.checkbox.checked = selected.has(item.id); row.checkbox.disabled = false;
                if (commands.children[index] !== row.label) commands.insertBefore(row.label, commands.children[index] || null);
            }
            empty.hidden = state.commands.length > 0;
            compactSettings.textContent = `${model.selectedOptions[0]?.textContent || 'Модель сайта'} · ${state.limit === null ? 'токены сайта' : state.limit + ' токенов'}`;
            compactCommands.textContent = 'Команды: ' + (state.commands.filter(item => selected.has(item.id)).map(item => item.name).join(', ') || 'не выбраны');
            compactManual.textContent = `Ручная: ${preview(state.manual)}`;
        } catch (error) {
            for (const control of [model, range, manual, siteTokens, ...commands.querySelectorAll('input')]) control.disabled = true;
            if (changedChat) { model.value = ''; manual.value = ''; commands.replaceChildren(); rows.clear(); manualCaption.textContent = 'Ручная: недоступна'; compactSettings.textContent = 'Не удалось прочитать настройки'; compactCommands.textContent = ''; compactManual.textContent = ''; }
            errors.set('read', error.message || 'Не удалось прочитать настройки чата.'); showErrors();
        }
    }

    function commit(field, action) {
        const current = getContext()?.conversationId || '';
        // A SPA navigation may precede its first DOM mutation. Never save an old
        // control's value into the newly opened conversation.
        if (!current || current !== conversation) { signature = ''; refresh(); return; }
        try { action(current); errors.delete(field); }
        catch (error) { errors.set(field, error.message || 'Не удалось сохранить настройку.'); }
        signature = ''; refresh(); showErrors();
    }
    model.addEventListener('change', () => commit('model', id => save.model(id, model.value)));
    range.addEventListener('input', () => commit('tokens', id => save.limit(id, Number(range.value))));
    range.addEventListener('pointerup', () => commit('tokens', id => save.limit(id, Number(range.value))));
    siteTokens.addEventListener('click', event => { event.preventDefault(); commit('tokens', id => save.limit(id, null)); });
    manual.addEventListener('input', () => commit('manual', id => save.manual(id, manual.value)));
    window.addEventListener('storage', () => { signature = ''; refresh(); });
    window.addEventListener('popstate', refresh);
    window.addEventListener('pageshow', refresh);
    // Covers pushState/replaceState and GM changes from other open tabs without
    // wrapping the site's history methods or exposing suite state to the page.
    window.setInterval(refresh, 500);
    refresh();
    return { refresh };
}
