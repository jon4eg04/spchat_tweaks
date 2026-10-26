export const QUICK_COMMANDS_KEY = 'spchat-tweaks:quick-commands:v1';
export const MANUAL_COMMANDS_KEY = 'tm-sc-per-chat-persistent-command-v1';

export function commandText(value) {
    return typeof value === 'string' ? value.trim().replace(/^\/cmd(?:\s+|$)/i, '').trim() : '';
}

export function validateQuickCommands(raw) {
    const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!record(raw) || raw.schema !== 1 || !Array.isArray(raw.commands) || !record(raw.selections)) {
        throw new Error('Не удалось прочитать библиотеку быстрых команд. Данные не изменены.');
    }
    const seen = new Set();
    const commands = raw.commands.map(item => {
        if (!record(item) || typeof item.id !== 'string' || !/^[\w-]{1,80}$/.test(item.id)
            || seen.has(item.id) || typeof item.name !== 'string' || !item.name.trim()
            || typeof item.text !== 'string' || !commandText(item.text)) {
            throw new Error('Некорректная запись в библиотеке быстрых команд.');
        }
        seen.add(item.id);
        return { id: item.id, name: item.name.trim(), text: commandText(item.text) };
    });
    const selections = Object.create(null);
    for (const [conversation, ids] of Object.entries(raw.selections)) {
        if (!conversation.trim() || !Array.isArray(ids) || ids.some(id => typeof id !== 'string')) {
            throw new Error('Некорректный выбор быстрых команд для чата.');
        }
        const known = [...new Set(ids)].filter(id => seen.has(id));
        if (known.length) selections[conversation] = known;
    }
    return { schema: 1, commands, selections };
}

export function createQuickCommands(gm) {
    const listeners = new Set();
    const read = () => validateQuickCommands(gm.get(QUICK_COMMANDS_KEY, { schema: 1, commands: [], selections: {} }));
    const emit = () => {
        for (const listener of listeners) {
            try { listener(); } catch (error) { console.warn('[Quick Commands] Не удалось обновить интерфейс.', error); }
        }
    };
    const write = data => { gm.set(QUICK_COMMANDS_KEY, validateQuickCommands(data)); emit(); };
    const selected = (data, conversation) => data.selections[conversation] || [];
    return {
        list: () => read().commands,
        selectedIds: conversation => selected(read(), conversation),
        snapshot(conversation) {
            const data = read();
            return { commands: data.commands, selectedIds: selected(data, conversation) };
        },
        setSelectedIds(conversation, ids) {
            if (typeof conversation !== 'string' || !conversation.trim()) throw new Error('Открой конкретный сохранённый диалог.');
            if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) throw new Error('Не удалось прочитать выбранные команды.');
            const data = read();
            const known = new Set(data.commands.map(command => command.id));
            const chosen = [...new Set(ids)].filter(id => known.has(id));
            if (chosen.length) data.selections[conversation] = chosen;
            else delete data.selections[conversation];
            write(data);
        },
        active(conversation) {
            const data = read();
            const ids = new Set(selected(data, conversation));
            return data.commands.filter(command => ids.has(command.id));
        },
        upsert({ id, name, text }) {
            if (typeof name !== 'string' || !name.trim()) throw new Error('Укажи название команды.');
            if (!commandText(text)) throw new Error('Введи текст команды.');
            const data = read();
            let index = id ? data.commands.findIndex(command => command.id === id) : -1;
            if (id && index < 0) throw new Error('Команда уже удалена. Открой библиотеку заново.');
            if (!id) {
                do { id = crypto.randomUUID(); } while (data.commands.some(command => command.id === id));
                index = data.commands.length;
            }
            data.commands[index] = { id, name: name.trim(), text: commandText(text) };
            write(data);
            return id;
        },
        remove(id) {
            const data = read();
            data.commands = data.commands.filter(command => command.id !== id);
            for (const [conversation, ids] of Object.entries(data.selections)) {
                const remaining = ids.filter(value => value !== id);
                if (remaining.length) data.selections[conversation] = remaining;
                else delete data.selections[conversation];
            }
            write(data);
        },
        saveChat(conversation, ids, manual, storage) {
            if (typeof conversation !== 'string' || !conversation.trim()) throw new Error('Открой конкретный сохранённый диалог.');
            if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) throw new Error('Не удалось прочитать выбранные команды.');
            const data = read();
            const known = new Set(data.commands.map(command => command.id));
            const chosen = [...new Set(ids)].filter(id => known.has(id));
            if (chosen.length) data.selections[conversation] = chosen;
            else delete data.selections[conversation];
            const beforeLocal = storage.getItem(MANUAL_COMMANDS_KEY);
            const manualMap = JSON.parse(beforeLocal || '{}');
            if (!manualMap || typeof manualMap !== 'object' || Array.isArray(manualMap)) throw new Error('Не удалось прочитать сохранённые ручные команды.');
            // Define rather than assign so even a malformed conversation key cannot
            // invoke Object.prototype.__proto__ on imported local JSON.
            const text = commandText(manual);
            if (text) Object.defineProperty(manualMap, conversation, { value: text, enumerable: true, writable: true, configurable: true });
            else delete manualMap[conversation];
            const beforeGm = gm.get(QUICK_COMMANDS_KEY, undefined);
            let gmAttempted = false;
            try {
                storage.setItem(MANUAL_COMMANDS_KEY, JSON.stringify(manualMap));
                gmAttempted = true;
                gm.set(QUICK_COMMANDS_KEY, validateQuickCommands(data));
            } catch (error) {
                let failed = false;
                try {
                    if (beforeLocal === null) storage.removeItem(MANUAL_COMMANDS_KEY);
                    else storage.setItem(MANUAL_COMMANDS_KEY, beforeLocal);
                } catch { failed = true; }
                if (gmAttempted) {
                    try {
                        if (beforeGm === undefined) gm.delete(QUICK_COMMANDS_KEY);
                        else gm.set(QUICK_COMMANDS_KEY, beforeGm);
                    } catch { failed = true; }
                }
                if (failed) throw new Error('Сохранение команд не завершено, откат не полностью удался. Проверь настройки чата.');
                throw error;
            }
            emit();
        },
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    };
}
