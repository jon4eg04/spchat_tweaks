// The library editor belongs to SC Tools; chat popups only choose saved entries.
export function createCommandManager({ container, library }) {
    let editing = null;
    const list = document.createElement('div'); list.className = 'quick-command-list';
    const editor = document.createElement('div'); editor.className = 'quick-command-editor';
    const field = (title, tag, name) => {
        const label = document.createElement('label'); label.className = 'field'; label.textContent = title;
        const input = document.createElement(tag); input.name = name;
        if (tag === 'input') input.type = 'text';
        else input.rows = 5;
        label.append(input); editor.append(label);
        return input;
    };
    const name = field('Название команды', 'input', 'quick-command-name');
    const text = field('Текст команды', 'textarea', 'quick-command-text');
    const notice = document.createElement('p'); notice.className = 'status'; notice.setAttribute('role', 'status');
    const actions = document.createElement('div'); actions.className = 'actions';
    const makeButton = (title, handler) => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = title;
        button.addEventListener('click', () => {
            notice.textContent = ''; notice.className = 'status';
            try { handler(); } catch (error) { notice.className = 'status error'; notice.textContent = error.message || 'Не удалось сохранить команду.'; }
        });
        return button;
    };
    const reset = () => { editing = null; name.value = ''; text.value = ''; save.textContent = 'Добавить команду'; cancel.hidden = true; };
    const save = makeButton('Добавить команду', () => {
        library.upsert({ id: editing, name: name.value, text: text.value }); reset(); render(); notice.textContent = 'Команда сохранена.';
    });
    save.className = 'primary';
    const cancel = makeButton('Отмена', reset); cancel.hidden = true;
    actions.append(save, cancel); editor.append(actions, notice); container.append(list, editor);

    function render() {
        list.replaceChildren();
        try {
            const commands = library.list();
            if (!commands.length) {
                const empty = document.createElement('p'); empty.textContent = 'Команд пока нет. Добавь первую ниже.'; list.append(empty);
            }
            for (const command of commands) {
                const card = document.createElement('div'); card.className = 'quick-command-card'; card.dataset.commandId = command.id;
                const heading = document.createElement('h3'); heading.textContent = command.name;
                const preview = document.createElement('p'); preview.className = 'quick-command-text'; preview.textContent = command.text;
                const buttons = document.createElement('div'); buttons.className = 'actions';
                buttons.append(makeButton('Редактировать', () => {
                    // Refresh the entry in case another tab has changed it.
                    const current = library.list().find(item => item.id === command.id);
                    if (!current) { render(); throw new Error('Команда уже удалена.'); }
                    editing = current.id; name.value = current.name; text.value = current.text;
                    save.textContent = 'Сохранить команду'; cancel.hidden = false; name.focus();
                }), makeButton('Удалить', () => {
                    library.remove(command.id);
                    if (editing === command.id) reset();
                    render(); notice.textContent = 'Команда удалена.';
                }));
                card.append(heading, preview, buttons); list.append(card);
            }
            save.disabled = false;
        } catch (error) {
            const warning = document.createElement('p'); warning.className = 'error'; warning.textContent = error.message;
            list.append(warning); save.disabled = true;
        }
    }
    return { refresh() { reset(); render(); notice.textContent = ''; } };
}
