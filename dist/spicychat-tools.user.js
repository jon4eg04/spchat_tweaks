// ==UserScript==
// @name         SpicyChat Tools
// @namespace    https://github.com/jon4eg04/spchat_tweaks
// @version      1.0.11
// @description  Единый комплект из 12 функций SpicyChat с локальными настройками и переносом старых данных.
// @homepageURL  https://github.com/jon4eg04/spchat_tweaks
// @supportURL   https://github.com/jon4eg04/spchat_tweaks/issues
// @match        https://spicychat.ai/*
// @match        https://www.spicychat.ai/*
// @match        https://*.spicychat.ai/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      *
// @updateURL    https://raw.githubusercontent.com/jon4eg04/spchat_tweaks/main/dist/spicychat-tools.meta.js
// @downloadURL  https://raw.githubusercontent.com/jon4eg04/spchat_tweaks/main/dist/spicychat-tools.user.js
// ==/UserScript==


(function () {
'use strict';

const SUITE_VERSION = "1.0.11";

const MODULE_CATALOG = [
  {
    "id": "per-chat",
    "title": "Настройки для каждого чата",
    "phase": "start",
    "version": "1.3.1",
    "legacyName": "SpicyChat — Настройки для каждого чата",
    "legacyNamespace": "https://spicychat.ai/",
    "storageKeys": [
      "tm-sc-per-chat-response-length-v1",
      "tm-sc-per-chat-inference-model-v1",
      "tm-sc-per-chat-persistent-command-v1",
      "spchat-tweaks:quick-commands:v1"
    ]
  },
  {
    "id": "quick-delete",
    "title": "Быстрое удаление сообщений",
    "phase": "start",
    "version": "2.2.0",
    "legacyName": "SpicyChat — быстрое удаление сообщений",
    "legacyNamespace": "spicychat-quick-delete",
    "storageKeys": []
  },
  {
    "id": "timestamps",
    "title": "Время сообщений",
    "phase": "start",
    "version": "1.2.0",
    "legacyName": "SpicyChat — Время сообщений",
    "legacyNamespace": "https://spicychat.ai/",
    "storageKeys": [
      "tm-sc-message-timestamps-v1:conversation:"
    ]
  },
  {
    "id": "gallery",
    "title": "Галерея изображений диалога",
    "phase": "start",
    "version": "1.1.2",
    "legacyName": "SpicyChat — Галерея изображений диалога",
    "legacyNamespace": "https://spicychat.ai/",
    "storageKeys": []
  },
  {
    "id": "branches",
    "title": "Дерево чатов",
    "phase": "start",
    "version": "1.3.0",
    "legacyName": "SpicyChat — Дерево чатов",
    "legacyNamespace": "https://spicychat.ai/",
    "storageKeys": [
      "tm-sc-chat-branches-v1:bot:"
    ]
  },
  {
    "id": "bookmarks",
    "title": "Закладки сообщений",
    "phase": "start",
    "version": "1.3.0",
    "legacyName": "SpicyChat — Закладки сообщений",
    "legacyNamespace": "https://spicychat.ai/",
    "storageKeys": [
      "tm-sc-message-bookmarks-v1:conversation:"
    ]
  },
  {
    "id": "summary",
    "title": "Пересказ диалога через OpenAI",
    "phase": "start",
    "version": "1.2.0",
    "legacyName": "SpicyChat — Пересказ диалога через OpenAI",
    "legacyNamespace": "https://spicychat.ai/",
    "storageKeys": [
      "tm-sc-gpt-summary-v1.1:"
    ]
  },
  {
    "id": "tts",
    "title": "Эмоциональная озвучка Inworld",
    "phase": "start",
    "version": "1.0.0",
    "legacyName": "SpicyChat — эмоциональная озвучка Inworld",
    "legacyNamespace": "https://spicychat.ai/",
    "storageKeys": []
  },
  {
    "id": "emoji",
    "title": "Emoji Picker",
    "phase": "dom",
    "version": "1.3.0",
    "legacyName": "SpicyChat — Emoji Picker",
    "legacyNamespace": "https://spicychat.ai/",
    "storageKeys": [
      "tm-spicychat-emoji-picker-state-v1"
    ]
  },
  {
    "id": "buttons",
    "title": "Кнопки изображения и Suggest Reply",
    "phase": "dom",
    "version": "2.1.0",
    "legacyName": "SpicyChat — Кнопки изображения и Suggest Reply",
    "legacyNamespace": "https://spicychat.ai/",
    "storageKeys": []
  },
  {
    "id": "saved-texts",
    "title": "Сохранённые тексты",
    "phase": "dom",
    "version": "1.3.0",
    "legacyName": "SpicyChat — Сохранённые тексты",
    "legacyNamespace": "https://spicychat.ai/",
    "storageKeys": [
      "tm-sc-saved-texts-v1:bot:"
    ]
  },
  {
    "id": "hide-models",
    "title": "Скрытие ненужных моделей",
    "phase": "dom",
    "version": "1.1",
    "legacyName": "Hide selected model blocks",
    "legacyNamespace": "local",
    "legacyOptional": true,
    "matchesSubdomains": true,
    "storageKeys": []
  }
];

// ---- src/core/settings.js ----

const SETTINGS_KEY = 'spchat-tweaks:settings:v1';
const MIGRATION_KEY = 'spchat-tweaks:last-import:v1';

function defaultSettings(catalog) {
    return {
        schema: 1,
        active: false,
        modules: Object.fromEntries(catalog.map(({ id }) => [id, true])),
        endpoints: { summary: { url: '', token: '' }, tts: { url: '', token: '' } },
    };
}

function validateEndpoint(value = {}) {
    const url = typeof value.url === 'string' ? value.url.trim() : '';
    const token = typeof value.token === 'string' ? value.token.trim() : '';
    if (url) {
        let parsed;
        try { parsed = new URL(url); } catch { throw new Error('Укажи полный HTTPS-адрес обработчика.'); }
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) {
            throw new Error('Нужен HTTPS-адрес без пароля в ссылке и без #фрагмента.');
        }
    }
    if (/[\r\n]/.test(token)) throw new Error('Токен не должен содержать переносы строк.');
    return { url, token };
}

function normalizeSettings(raw, catalog) {
    const value = defaultSettings(catalog);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return value;
    value.active = raw.active === true;
    for (const { id } of catalog) {
        if (typeof raw.modules?.[id] === 'boolean') value.modules[id] = raw.modules[id];
    }
    for (const id of ['summary', 'tts']) value.endpoints[id] = validateEndpoint(raw.endpoints?.[id]);
    return value;
}

function createStore(catalog, gm) {
    let current = normalizeSettings(gm.get(SETTINGS_KEY, null), catalog);
    return {
        gm,
        get settings() { return structuredClone(current); },
        save(raw) {
            const normalized = normalizeSettings(raw, catalog);
            gm.set(SETTINGS_KEY, normalized);
            current = normalized;
            return structuredClone(current);
        },
        reload() { current = normalizeSettings(gm.get(SETTINGS_KEY, null), catalog); },
        getEndpoint(id) {
            const endpoint = current.endpoints[id];
            if (!endpoint?.url || !endpoint?.token) {
                throw new Error('Сначала укажи адрес и токен обработчика в настройках SpicyChat Tools.');
            }
            return { ...endpoint };
        },
    };
}


// ---- src/core/zip.js ----

// Minimal ZIP reader for local Tampermonkey backups. No code is executed.
const MAX_ARCHIVE = 128 * 1024 * 1024;
const MAX_ENTRY = 64 * 1024 * 1024;
const MAX_TOTAL = 128 * 1024 * 1024;
const decoder = new TextDecoder('utf-8', { fatal: true });

function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
}

async function readZip(bytes) {
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    if (bytes.length > MAX_ARCHIVE) throw new Error('Архив больше 128 МБ. Экспортируй только нужные скрипты.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const ensure = (offset, size) => {
        if (!Number.isSafeInteger(offset) || offset < 0 || offset + size > bytes.length) {
            throw new Error('Архив ZIP повреждён или обрезан.');
        }
    };
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
        if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) {
            end = i; break;
        }
    }
    if (end < 0) throw new Error('Не найден ZIP-архив. Выбери резервную копию Tampermonkey.');
    const count = view.getUint16(end + 10, true);
    const size = view.getUint32(end + 12, true);
    let offset = view.getUint32(end + 16, true);
    if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)
        || count !== view.getUint16(end + 8, true) || count === 65535
        || offset === 0xffffffff || size === 0xffffffff) throw new Error('ZIP64 и многотомные архивы не поддерживаются.');
    ensure(offset, size);
    const directoryEnd = offset + size;
    if (directoryEnd > end) throw new Error('Некорректный каталог ZIP.');
    const files = new Map();
    let total = 0;
    for (let index = 0; index < count; index++) {
        ensure(offset, 46);
        if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('Некорректная запись ZIP.');
        const flags = view.getUint16(offset + 8, true);
        const method = view.getUint16(offset + 10, true);
        const crc = view.getUint32(offset + 16, true);
        const compressedSize = view.getUint32(offset + 20, true);
        const originalSize = view.getUint32(offset + 24, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const local = view.getUint32(offset + 42, true);
        ensure(offset + 46, nameLength + extraLength + commentLength);
        const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
        offset += 46 + nameLength + extraLength + commentLength;
        if (offset > directoryEnd) throw new Error('Каталог ZIP выходит за границы.');
        if (!/\.(?:user\.js|storage\.json|options\.json)$/.test(name)) continue;
        if (files.has(name)) throw new Error('Архив содержит повторяющиеся имена файлов.');
        if (flags & 1) throw new Error('Зашифрованный ZIP не поддерживается.');
        if (originalSize > MAX_ENTRY || (total += originalSize) > MAX_TOTAL) {
            throw new Error('В архиве слишком много данных. Экспортируй только скрипты SpicyChat.');
        }
        ensure(local, 30);
        if (view.getUint32(local, true) !== 0x04034b50) throw new Error('Повреждён заголовок файла ZIP.');
        if (view.getUint16(local + 8, true) !== method || (view.getUint16(local + 6, true) & 1)) {
            throw new Error('Несогласованные заголовки ZIP.');
        }
        const dataOffset = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
        ensure(dataOffset, compressedSize);
        if (dataOffset + compressedSize > directoryEnd - size) throw new Error('Данные ZIP перекрывают каталог.');
        const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
        let content;
        if (method === 0) content = compressed;
        else if (method === 8) {
            let stream;
            try { stream = new DecompressionStream('deflate-raw'); }
            catch { throw new Error('Для импорта ZIP нужен актуальный Firefox или Chrome.'); }
            const reader = new Blob([compressed]).stream().pipeThrough(stream).getReader();
            const chunks = [];
            let length = 0;
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    length += value.length;
                    if (length > originalSize || length > MAX_ENTRY) {
                        await reader.cancel();
                        throw new Error('Распакованный файл превышает заявленный размер.');
                    }
                    chunks.push(value);
                }
            } finally { reader.releaseLock(); }
            content = new Uint8Array(length);
            let position = 0;
            for (const chunk of chunks) { content.set(chunk, position); position += chunk.length; }
        } else throw new Error('Неподдерживаемое сжатие ZIP. Используй штатный экспорт Tampermonkey.');
        if (content.length !== originalSize || crc32(content) !== crc) throw new Error('Проверка целостности ZIP не пройдена.');
        files.set(name, decoder.decode(content));
    }
    return files;
}


// ---- src/core/quick-commands.js ----

const QUICK_COMMANDS_KEY = 'spchat-tweaks:quick-commands:v1';
const MANUAL_COMMANDS_KEY = 'tm-sc-per-chat-persistent-command-v1';

function commandText(value) {
    return typeof value === 'string' ? value.trim().replace(/^\/cmd(?:\s+|$)/i, '').trim() : '';
}

function validateQuickCommands(raw) {
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

function createQuickCommands(gm) {
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


// ---- src/core/migration.js ----


const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function allowedStorageKey(key, module) {
    if (typeof key !== 'string' || forbidden.has(key) || key.length > 300) return false;
    return module.storageKeys.some(prefix => prefix.endsWith(':') ? key.startsWith(prefix) : key === prefix);
}

function decodeStorageValue(value) {
    // Tampermonkey backups store typed strings; some exports already contain JSON values.
    if (typeof value !== 'string') return value;
    const body = value.slice(1);
    switch (value[0]) {
        case 'o': return JSON.parse(body);
        case 's': return body;
        case 'b':
            if (body !== 'true' && body !== 'false') throw new Error('Повреждено логическое значение в резервной копии.');
            return body === 'true';
        case 'n': {
            const number = Number(body);
            if (!body || !Number.isFinite(number)) throw new Error('Повреждено числовое значение в резервной копии.');
            return number;
        }
        default: throw new Error('Неизвестный формат данных Tampermonkey. Исходные данные не изменены.');
    }
}

function metadata(source) {
    const header = source.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/)?.[1];
    if (!header) return null;
    const get = name => header.match(new RegExp('^//\\s*@' + name + '\\s+(.+)$', 'm'))?.[1].trim() || '';
    return { name: get('name'), namespace: get('namespace'), version: get('version') };
}

function readConstant(source, name) {
    // Parse only literal assignments. Never eval imported JavaScript.
    const expression = new RegExp('\\bconst\\s+' + name + '\\s*=\\s*([\x27\x22])((?:\\\\.|(?!\\1)[^\\\\\\r\\n])*)\\1\\s*;');
    const match = source.match(expression);
    if (!match) return '';
    if (match[1] === '"') return JSON.parse('"' + match[2] + '"');
    return match[2].replace(/\\(u[0-9a-fA-F]{4}|[\\'"/nrtbf])/g, (_, escape) => {
        if (escape[0] === 'u') return String.fromCharCode(parseInt(escape.slice(1), 16));
        return ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' })[escape] ?? escape;
    });
}

function planLegacyImport(files, catalog, localStorage) {
    const plan = { kind: 'legacy', values: Object.create(null), local: Object.create(null), modules: {}, endpoints: {}, rows: [], warnings: [] };
    const seen = new Set();
    for (const [name, source] of files) {
        if (!name.endsWith('.user.js')) continue;
        const meta = metadata(source);
        const module = catalog.find(item => item.legacyName === meta?.name && item.legacyNamespace === meta.namespace);
        if (!module) continue;
        if (seen.has(module.id)) throw new Error('В архиве несколько версий одного модуля. Оставь в экспорте только текущие 11 скриптов.');
        seen.add(module.id);
        const stem = name.slice(0, -'.user.js'.length);
        let enabled = true;
        if (files.has(stem + '.options.json')) {
            const options = JSON.parse(files.get(stem + '.options.json'));
            enabled = ![false, 0].includes(options.settings?.enabled ?? options.enabled ?? true);
        }
        plan.modules[module.id] = enabled;
        let keys = 0;
        const storageName = stem + '.storage.json';
        if (files.has(storageName)) {
            const storage = JSON.parse(files.get(storageName));
            if (!isRecord(storage.data)) throw new Error('У файла данных Tampermonkey нет объекта data.');
            for (const [key, raw] of Object.entries(storage.data)) {
                if (!allowedStorageKey(key, module)) continue;
                const value = decodeStorageValue(raw);
                if (!value || typeof value !== 'object') throw new Error('Данные модуля имеют неожиданный формат. Импорт остановлен.');
                plan.values[key] = key === QUICK_COMMANDS_KEY ? validateQuickCommands(value) : value;
                keys++;
            }
        } else if (module.storageKeys.length && !['emoji', 'per-chat'].includes(module.id)) {
            plan.warnings.push(`${module.title}: файла данных нет. Проверь, что при экспорте включены данные скриптов.`);
        }
        let localKeys = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key === QUICK_COMMANDS_KEY || !allowedStorageKey(key, module)) continue;
            const raw = localStorage.getItem(key);
            if (raw === null) continue;
            const value = JSON.parse(raw);
            if (!value || typeof value !== 'object') throw new Error('Не удалось прочитать локальные данные SpicyChat.');
            plan.local[key] = raw;
            // Four legacy modules used localStorage only if GM storage was unavailable.
            if (!['emoji', 'per-chat'].includes(module.id) && !Object.hasOwn(plan.values, key)) plan.values[key] = value;
            localKeys++;
        }
        if (['summary', 'tts'].includes(module.id)) {
            const url = readConstant(source, 'ENDPOINT_URL');
            const token = readConstant(source, 'CLIENT_TOKEN');
            if (url || token) plan.endpoints[module.id] = { url, token };
            if (!url || !token) plan.warnings.push(`${module.title}: адрес и токен нужно указать в настройках.`);
        }
        plan.rows.push({ id: module.id, title: module.title, enabled, keys, localKeys, version: meta.version });
    }
    if (!seen.size) throw new Error('В архиве не найдены исходные скрипты SpicyChat из нашего комплекта.');
    for (const item of catalog) if (!item.legacyOptional && !seen.has(item.id)) plan.warnings.push(`${item.title}: скрипт отсутствует в архиве.`);
    return plan;
}

function planSuiteImport(raw, catalog) {
    if (!isRecord(raw) || raw.format !== 'spchat-tweaks-backup' || raw.schema !== 1
        || !isRecord(raw.values) || !isRecord(raw.local) || !isRecord(raw.settings)) {
        throw new Error('Для переезда из Tampermonkey выбери ZIP. JSON поддерживается для копий SpicyChat Tools.');
    }
    const plan = { kind: 'suite', values: Object.create(null), local: Object.create(null), modules: {}, endpoints: {}, rows: [], warnings: [] };
    for (const module of catalog) {
        plan.modules[module.id] = raw.settings.modules?.[module.id] !== false;
        let keys = 0;
        let localKeys = 0;
        for (const [key, value] of Object.entries(raw.values)) if (allowedStorageKey(key, module)) {
            if (!value || typeof value !== 'object') throw new Error('Некорректное значение в резервной копии.');
            plan.values[key] = key === QUICK_COMMANDS_KEY ? validateQuickCommands(value) : value;
            keys++;
        }
        for (const [key, value] of Object.entries(raw.local)) if (key !== QUICK_COMMANDS_KEY && allowedStorageKey(key, module)) {
            if (typeof value !== 'string') throw new Error('Некорректные локальные данные в резервной копии.');
            const decoded = JSON.parse(value);
            if (!decoded || typeof decoded !== 'object') throw new Error('Некорректные локальные данные.');
            plan.local[key] = value;
            localKeys++;
        }
        plan.rows.push({ id: module.id, title: module.title, enabled: plan.modules[module.id], keys, localKeys });
    }
    for (const id of ['summary', 'tts']) if (isRecord(raw.settings.endpoints?.[id])) {
        plan.endpoints[id] = raw.settings.endpoints[id];
    }
    return plan;
}

function applyImport(plan, store, localStorage, { overwrite = false, now = Date.now } = {}) {
    const gm = store.gm;
    const oldKeys = new Set(gm.list());
    const oldValues = new Map();
    const oldLocal = new Map();
    const before = store.settings;
    const settings = store.settings;
    let written = 0;
    let skipped = 0;
    for (const [id, enabled] of Object.entries(plan.modules)) settings.modules[id] = enabled;
    for (const [id, endpoint] of Object.entries(plan.endpoints)) {
        if (overwrite || (!settings.endpoints[id].url && !settings.endpoints[id].token)) settings.endpoints[id] = endpoint;
    }
    // A first migration never starts the features on the page with legacy scripts running.
    settings.active = before.active;
    try {
        for (const [key, value] of Object.entries(plan.values)) {
            if (oldKeys.has(key) && !overwrite) { skipped++; continue; }
            oldValues.set(key, oldKeys.has(key) ? gm.get(key) : undefined);
            gm.set(key, value);
            written++;
        }
        for (const [key, value] of Object.entries(plan.local)) {
            const current = localStorage.getItem(key);
            if (current !== null && !overwrite) continue;
            oldLocal.set(key, current);
            localStorage.setItem(key, value);
        }
        oldValues.set(SETTINGS_KEY, oldKeys.has(SETTINGS_KEY) ? gm.get(SETTINGS_KEY) : undefined);
        store.save(settings); // Validate URLs before declaring the import successful.
        oldValues.set(MIGRATION_KEY, oldKeys.has(MIGRATION_KEY) ? gm.get(MIGRATION_KEY) : undefined);
        gm.set(MIGRATION_KEY, { at: now(), kind: plan.kind, modules: plan.rows.map(row => row.id), written, skipped });
        return { written, skipped, modules: plan.rows.length };
    } catch (error) {
        let rollbackFailed = false;
        for (const [key, value] of oldValues) {
            try { if (oldKeys.has(key)) gm.set(key, value); else gm.delete(key); } catch { rollbackFailed = true; }
        }
        for (const [key, value] of oldLocal) {
            try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
            catch { rollbackFailed = true; }
        }
        store.reload();
        if (rollbackFailed) throw new Error('Импорт не завершён; откат не полностью удался. Сохрани старый ZIP и не удаляй старые скрипты.');
        throw error;
    }
}

function exportSuite(store, catalog, localStorage) {
    const values = Object.create(null);
    const local = Object.create(null);
    for (const key of store.gm.list()) if (catalog.some(module => allowedStorageKey(key, module))) values[key] = store.gm.get(key);
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== QUICK_COMMANDS_KEY && catalog.some(module => allowedStorageKey(key, module))) local[key] = localStorage.getItem(key);
    }
    return { format: 'spchat-tweaks-backup', schema: 1, exportedAt: new Date().toISOString(), settings: store.settings, values, local };
}


// ---- src/core/command-manager.js ----

// The library editor belongs to SC Tools; the chat panel only chooses saved entries.
function createCommandManager({ container, library }) {
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


// ---- src/core/ui.js ----


function createInterface({ store, catalog, storage, version, reload = () => location.reload(), quickCommands, shadowMode = 'closed' }) {
    let host;
    let root;
    let panel;
    let form;
    let status;
    let preview;
    let plan = null;
    let importedNow = false;
    let commandManager;

    const button = (text, handler, className = '') => {
        const node = document.createElement('button');
        node.type = 'button';
        node.textContent = text;
        node.className = className;
        node.addEventListener('click', handler);
        return node;
    };
    const message = (text, error = false) => {
        status.textContent = text;
        status.className = error ? 'status error' : 'status';
        const nearImport = root.querySelector('[data-import-status]');
        if (nearImport) {
            nearImport.textContent = text;
            nearImport.className = error ? 'status error' : 'status';
        }
    };
    const safely = action => async () => {
        try { await action(); } catch (error) { message(error.message || 'Операция не завершена.', true); }
    };

    function readForm() {
        const next = store.settings;
        for (const { id } of catalog) next.modules[id] = form.elements.namedItem(`module-${id}`).checked;
        for (const id of ['summary', 'tts']) next.endpoints[id] = {
            url: form.elements.namedItem(`${id}-url`).value.trim(),
            token: form.elements.namedItem(`${id}-token`).value.trim(),
        };
        return next;
    }

    function fillForm() {
        commandManager?.refresh();
        const config = store.settings;
        for (const { id } of catalog) form.elements.namedItem(`module-${id}`).checked = config.modules[id];
        for (const id of ['summary', 'tts']) {
            form.elements.namedItem(`${id}-url`).value = config.endpoints[id].url;
            form.elements.namedItem(`${id}-token`).value = config.endpoints[id].token;
        }
        root.querySelector('[data-state]').textContent = config.active ? 'Комплект включён' : 'Ожидает настройки';
        root.querySelector('[data-activate]').hidden = config.active;
        root.querySelector('[data-pause]').hidden = !config.active;
        root.querySelector('[data-confirm-row]').hidden = config.active;
    }

    function section(title, text) {
        const block = document.createElement('section');
        const heading = document.createElement('h2');
        heading.textContent = title;
        block.append(heading);
        if (text) {
            const paragraph = document.createElement('p');
            paragraph.textContent = text;
            block.append(paragraph);
        }
        form.append(block);
        return block;
    }

    async function selectBackup(file) {
        if (!file) return;
        if (file.size > 128 * 1024 * 1024) throw new Error('Файл больше 128 МБ. Экспортируй только нужные скрипты.');
        plan = null;
        importedNow = false;
        preview.replaceChildren();
        message('Читаю резервную копию локально…');
        if (/\.zip$/i.test(file.name)) {
            plan = planLegacyImport(await readZip(new Uint8Array(await file.arrayBuffer())), catalog, storage);
        } else {
            plan = planSuiteImport(JSON.parse(await file.text()), catalog);
        }
        const heading = document.createElement('p');
        const required = catalog.filter(module => !module.legacyOptional);
        const found = plan.rows.filter(row => required.some(module => module.id === row.id)).length;
        heading.textContent = `Найдено основных модулей: ${found} из ${required.length}. Дополнительных: ${plan.rows.length - found}. Проверь список перед переносом.`;
        preview.append(heading);
        const table = document.createElement('table');
        const head = document.createElement('tr');
        for (const title of ['Функция', 'Состояние', 'Данные / сайт']) {
            const th = document.createElement('th'); th.textContent = title; head.append(th);
        }
        table.append(head);
        for (const row of plan.rows) {
            const tr = document.createElement('tr');
            for (const text of [row.title, row.enabled ? 'Вкл.' : 'Выкл.', `${row.keys} / ${row.localKeys}`]) {
                const td = document.createElement('td'); td.textContent = text; tr.append(td);
            }
            table.append(tr);
        }
        preview.append(table);
        const endpointCount = Object.values(plan.endpoints).filter(item => item.url && item.token).length;
        if (endpointCount) {
            const note = document.createElement('p');
            note.textContent = `Настройки обработчиков найдены: ${endpointCount}. Токены будут сохранены только в Tampermonkey.`;
            preview.append(note);
        }
        for (const warning of plan.warnings) {
            const p = document.createElement('p'); p.className = 'warning'; p.textContent = warning; preview.append(p);
        }
        const overwriteRow = document.createElement('label');
        const overwrite = document.createElement('input');
        overwrite.type = 'checkbox';
        overwriteRow.className = 'check';
        overwriteRow.append(overwrite, document.createTextNode('Заменять уже существующие данные нового комплекта. При первом переносе не требуется.'));
        preview.append(overwriteRow);
        const apply = button('Перенести данные', safely(() => {
            if (!plan || importedNow) return;
            const result = applyImport(plan, store, storage, { overwrite: overwrite.checked });
            importedNow = true;
            apply.disabled = true;
            apply.textContent = 'Данные перенесены';
            fillForm();
            message(`Перенос завершён: модулей ${result.modules}, записей ${result.written}. Уже существовавшие записи сохранены: ${result.skipped}. Теперь отключи старые скрипты и запусти комплект.`);
        }), 'primary');
        preview.append(apply);
        message('Копия прочитана. Данные ещё не изменены.');
    }

    function mount() {
        if (host?.isConnected) return;
        host = document.createElement('div');
        host.id = 'spchat-tools-settings';
        root = host.attachShadow({ mode: shadowMode });
        const style = document.createElement('style');
        style.textContent = `
            :host { all: initial; color-scheme: dark; font: 14px/1.5 system-ui, sans-serif; }
            * { box-sizing: border-box; }
            [hidden] { display: none !important; }
            button, input, textarea { font: inherit; }
            button { cursor: pointer; border: 1px solid #454958; background: #292d3b; color: #f4f4fa; padding: 9px 13px; border-radius: 8px; }
            button:hover { background: #363b4d; }
            button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid #a9a0ff; outline-offset: 2px; }
            button:disabled { opacity: .5; cursor: default; }
            .primary { background: #7463d9; border-color: #9a8cec; }
            .primary:hover { background: #8674eb; }
            .launcher { position: fixed; right: 18px; bottom: 18px; z-index: 2147483646; box-shadow: none; font-size: 12px; }
            .backdrop { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; padding: 20px; background: #080912aa; }
            .panel { width: min(760px, 100%); max-height: calc(100dvh - 40px); overflow: auto; background: #1b1d28; color: #f4f4fa; border: 1px solid #444457; border-radius: 16px; box-shadow: 0 24px 100px #0009; }
            header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid #36384a; }
            h1 { margin: 0; font-size: 21px; } h1 small { color: #aba9c4; font-size: 12px; font-weight: 400; }
            header p { margin: 4px 0 0; font-size: 12px; color: #bdb7ed; }
            form { padding: 0 24px 24px; }
            section { padding: 20px 0; border-bottom: 1px solid #36384a; }
            h2 { margin: 0 0 10px; font-size: 16px; } p { margin: 8px 0 12px; color: #c1c1d1; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px 18px; }
            .check { display: flex; align-items: flex-start; gap: 8px; margin: 10px 0; }
            input[type=checkbox] { accent-color: #a395f7; margin-top: 4px; }
            .grid small { color: #9a9bb3; margin-left: 4px; }
            .field { display: block; margin-top: 10px; color: #c1c1d1; }
            input[type=url], input[type=password], input[type=text], textarea { display: block; width: 100%; margin-top: 5px; background: #11131d; color: #f4f4fa; border: 1px solid #454958; padding: 10px; border-radius: 7px; }
            textarea { resize: vertical; min-height: 100px; }
            .quick-command-card { padding: 12px; margin: 10px 0; border: 1px solid #454958; border-radius: 8px; }
            .quick-command-card h3 { margin: 0; overflow-wrap: anywhere; }
            .quick-command-text { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 100px; overflow: auto; }
            .endpoint { margin-top: 18px; } .endpoint h3 { margin: 0; font-size: 14px; }
            .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 15px; }
            .status { padding: 12px 0 0; color: #a8e6c8; white-space: pre-wrap; }
            .error, .warning { color: #ffbaac; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 12px 0; }
            td, th { text-align: left; padding: 7px; border-bottom: 1px solid #36384a; }
            th { color: #aba9c4; font-weight: 500; }
            @media(max-width: 540px) { .grid { grid-template-columns: 1fr; } form { padding: 0 16px 16px; } header { padding: 16px; } .backdrop { padding: 8px; } .panel { max-height: calc(100dvh - 16px); } }
        `;
        root.append(style, button('SC Tools', open, 'launcher'));
        panel = document.createElement('div');
        panel.className = 'backdrop';
        panel.hidden = true;
        const card = document.createElement('div');
        card.className = 'panel';
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');
        card.setAttribute('aria-label', 'Настройки SpicyChat Tools');
        const header = document.createElement('header');
        const title = document.createElement('div');
        const h1 = document.createElement('h1'); h1.textContent = 'SpicyChat Tools ';
        const release = document.createElement('small'); release.textContent = `v${version}`; h1.append(release);
        const state = document.createElement('p'); state.dataset.state = '';
        title.append(h1, state);
        header.append(title, button('Закрыть', close));
        form = document.createElement('form');
        form.addEventListener('submit', event => event.preventDefault());
        card.append(header, form);
        panel.append(card);
        panel.addEventListener('click', event => { if (event.target === panel) close(); });
        root.addEventListener('keydown', event => {
            if (panel.hidden) return;
            if (event.key === 'Escape') { event.stopPropagation(); close(); }
            if (event.key === 'Tab') {
                const focusable = Array.from(card.querySelectorAll('button:not(:disabled), input:not([type=hidden]), textarea')).filter(node => !node.closest('[hidden]'));
                const first = focusable[0]; const last = focusable.at(-1);
                if (event.shiftKey && root.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && root.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        });
        root.append(panel);

        const migrate = section('Переезд со старых скриптов', 'Сначала в Tampermonkey → Утилиты сохрани ZIP с данными скриптов. Открой его здесь на том же адресе SpicyChat и в том же профиле браузера. Файл обрабатывается только на твоём компьютере.');
        const picker = document.createElement('input');
        picker.type = 'file'; picker.accept = '.zip,.json'; picker.hidden = true;
        picker.addEventListener('change', safely(() => selectBackup(picker.files?.[0])));
        migrate.append(button('Выбрать резервную копию', () => { picker.value = ''; picker.click(); }), picker);
        preview = document.createElement('div'); migrate.append(preview);
        const importStatus = document.createElement('p'); importStatus.dataset.importStatus = '';
        migrate.append(importStatus);

        const features = section('Функции', 'Изменения переключателей применяются после перезагрузки страницы.');
        const grid = document.createElement('div'); grid.className = 'grid';
        for (const module of catalog) {
            const label = document.createElement('label'); label.className = 'check';
            const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.name = `module-${module.id}`;
            label.append(checkbox, document.createTextNode(module.title)); grid.append(label);
        }
        features.append(grid);

        const commands = section('Быстрые команды', 'Общая библиотека для всех чатов. В панели «Настройки чата» справа вверху отметь нужные для конкретного диалога. /cmd вводить не нужно. Изменения библиотеки сохраняются сразу. Удаление убирает команду из всех чатов.');
        commandManager = createCommandManager({ container: commands, library: quickCommands });

        const endpoints = section('Обработчики', 'Адреса и токены сохраняются в Tampermonkey. При переносе они подхватятся из старых скриптов.');
        for (const [id, title] of [['summary', 'Пересказ через OpenAI'], ['tts', 'Озвучка Inworld']]) {
            const group = document.createElement('div'); group.className = 'endpoint';
            const h3 = document.createElement('h3'); h3.textContent = title; group.append(h3);
            for (const [field, labelText, type] of [['url', 'Полный HTTPS-адрес', 'url'], ['token', 'Токен доступа', 'password']]) {
                const label = document.createElement('label'); label.className = 'field'; label.textContent = labelText;
                const input = document.createElement('input'); input.type = type; input.name = `${id}-${field}`;
                input.autocomplete = 'off'; input.spellcheck = false; input.placeholder = field === 'url' ? 'https://…' : 'Токен';
                label.append(input); group.append(label);
            }
            endpoints.append(group);
        }

        const controls = section('Запуск и резервная копия');
        const confirmRow = document.createElement('label'); confirmRow.className = 'check'; confirmRow.dataset.confirmRow = '';
        const confirm = document.createElement('input'); confirm.type = 'checkbox'; confirm.name = 'legacy-disabled';
        confirmRow.append(confirm, document.createTextNode('Я отключил старые скрипты SpicyChat в Tampermonkey. Старые вкладки закрою или перезагружу.'));
        controls.append(confirmRow);
        const actions = document.createElement('div'); actions.className = 'actions';
        const activate = button('Запустить комплект', safely(() => {
            if (!confirm.checked) throw new Error('Сначала отключи старые скрипты SpicyChat и отметь подтверждение.');
            const settings = readForm(); settings.active = true; store.save(settings); reload();
        }), 'primary');
        activate.dataset.activate = '';
        const pause = button('Приостановить комплект', safely(() => {
            const settings = readForm(); settings.active = false; store.save(settings); reload();
        }));
        pause.dataset.pause = '';
        actions.append(activate, button('Сохранить и перезагрузить', safely(() => { store.save(readForm()); reload(); })), pause);
        actions.append(button('Скачать копию настроек и данных', safely(() => {
            store.save(readForm());
            const blob = new Blob([JSON.stringify(exportSuite(store, catalog, storage), null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a'); link.href = url;
            link.download = `spchat-tweaks-backup-${new Date().toISOString().slice(0, 10)}.json`;
            link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
            message('Копия скачана. В ней есть личные данные и токены — храни её у себя.');
        })));
        controls.append(actions);
        status = document.createElement('div'); status.className = 'status'; status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite'); form.append(status);
        (document.body || document.documentElement).append(host);
        fillForm();
        const imported = store.gm.get(MIGRATION_KEY, null);
        if (imported) message(`Последний перенос: ${new Date(imported.at).toLocaleString('ru-RU')}.`);
    }

    function open() {
        if (!document.documentElement) { document.addEventListener('DOMContentLoaded', open, { once: true }); return; }
        mount();
        if (panel.hidden) fillForm();
        panel.hidden = false;
        panel.querySelector('button')?.focus();
    }
    function close() { panel.hidden = true; root.querySelector('.launcher')?.focus(); }
    function start() {
        if (!document.documentElement) { document.addEventListener('DOMContentLoaded', start, { once: true }); return; }
        mount();
        if (!store.settings.active) open();
    }
    return { start, open };
}


// ---- src/core/dom.js ----

// Shared discovery for inline menus and portals. No page data or credentials persist here.
function createDomAdapters() {
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
    const menuSelector = '[role="menu"], [data-radix-menu-content]';
    const actionsFor = kind => kind === 'message' ? ['copy', 'edit']
        : kind === 'chat' ? ['saved', 'newChat', 'remove'] : ['image', 'suggest', 'search', 'command'];
    function isMenu(menu, kind, controlled = false) {
        if (!menu || menu === document.body || menu === document.documentElement || !visible(menu)) return false;
        // A composer can contain the very same image/lightbulb buttons as a menu.
        // Neither a button, its tooltip wrapper, nor any ancestor of the input is a menu.
        if (menu.matches(items) || menu.querySelector('textarea, [contenteditable="true"], ' + Object.values(triggerSelectors).join(','))) return false;
        const actions = actionsFor(kind).filter(action => findAction(menu, action, true));
        if (!actions.length) return false;
        if (controlled || menu.matches(menuSelector)) return true;
        if (kind === 'plus') return actions.length >= 2 && (actions.includes('search') || actions.includes('command'));
        if (kind === 'chat') return actions.length >= 2;
        return actions.includes('copy');
    }
    function menuContainer(item, kind) {
        for (let menu = item?.parentElement; menu && menu !== document.body; menu = menu.parentElement) {
            if (isMenu(menu, kind)) return menu;
            if (menu.querySelector('textarea, [contenteditable="true"]')) break;
        }
        return null;
    }
    function findMenu(kind, button) {
        if (!button?.isConnected || button.getAttribute('aria-expanded') === 'false') return null;
        const controlled = button.getAttribute('aria-controls');
        if (controlled) {
            const menu = document.getElementById(controlled);
            if (isMenu(menu, kind, true)) return menu;
        }
        const boundary = kind === 'message' ? button.closest('[id^="message-"]') : null;
        let host = button.parentElement;
        for (let depth = 0; host && depth < 4 && host !== document.body; depth++, host = host.parentElement) {
            for (const child of host.children) {
                if (child.contains(button)) continue;
                // Prefer the actual menu, not a surrounding layout wrapper.
                for (const action of actionsFor(kind)) {
                    const item = findAction(child, action, true);
                    const menu = menuContainer(item, kind);
                    if (menu && child.contains(menu)) return menu;
                }
            }
            if (host === boundary) break;
        }
        if (active[kind] !== button) return null;
        for (const item of document.querySelectorAll(items)) {
            if (!visible(item) || !actionsFor(kind).some(action => isAction(item, action))) continue;
            const menu = menuContainer(item, kind);
            if (menu) return menu;
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
            for (const name of ['style', 'dir', 'lang']) {
                if (template.hasAttribute(name)) button.setAttribute(name, template.getAttribute(name));
            }
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

// Userscript injection can miss DOMContentLoaded. Keep the idle-phase features
// independent of that single event without delaying the early API interceptors.
function onDomReady(callback) {
    let finished = false;
    let timer = null;
    const check = () => {
        if (finished) return;
        if (timer !== null) window.clearTimeout(timer);
        if (!document.body || document.readyState === 'loading') {
            timer = window.setTimeout(check, 100);
            return;
        }
        finished = true;
        timer = null;
        document.removeEventListener('DOMContentLoaded', check);
        document.removeEventListener('readystatechange', check);
        window.removeEventListener('load', check);
        window.removeEventListener('pageshow', check);
        callback();
    };
    document.addEventListener('DOMContentLoaded', check);
    document.addEventListener('readystatechange', check);
    window.addEventListener('load', check);
    window.addEventListener('pageshow', check);
    check();
}


// ---- src/core/models.js ----

// The same ordered choices feed the native quick menu and per-chat overrides.
const QUICK_MODELS = Object.freeze([
    { id: 'deepseek-v4pro', label: 'Deepseek V4 Pro' },
    { id: 'qwenplus-character', label: 'Qwen Plus Character' },
    { id: 'glm51', label: 'Glam 5.1' },
    { id: 'mimo-v26-pro', label: 'MiMo V2.6 Pro', description: 'A flagship model with a natural, lively writing voice. MiMo V2.6 Pro writes dialogue that sounds like real people talking, handles banter and comedy with sharp timing, and keeps characters true to their personality. It moves the story forward on its own, avoids repetitive phrasing, and weaves in lore and world details well. Best for character-driven roleplay, adventure and fantasy stories, and multi-character scenes.' },
]);


// ---- src/core/native-models.js ----

// Narrow adapter for the native quick-model row contract supplied from the page.
// Component names and React's randomized expando suffix are deliberately ignored.
function createNativeModelAdapter() {
    const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    return {
        read(row, expected) {
            if (!row || !expected) return null;
            try {
                // Firefox userscript Xrays hide React's page-owned expandos.
                const node = row.wrappedJSObject || row;
                const keys = Object.keys(node);
                const propsKey = keys.find(key => key.startsWith('__reactProps$'));
                const fiberKey = keys.find(key => key.startsWith('__reactFiber$'));
                const onClick = node[propsKey]?.onClick;
                if (typeof onClick !== 'function') return null;
                let fiber = node[fiberKey];
                for (let depth = 0; fiber && depth < 12; depth++, fiber = fiber.return) {
                    // A DOM expando can retain the alternate after a React commit.
                    // X forwards wd's onClick unchanged, so the live host props
                    // identify the committed row without relying on fiber names.
                    for (const current of [fiber, fiber.alternate]) {
                        const props = current?.memoizedProps;
                        if (props?.model?.id !== expected.id || props.model.name !== expected.label) continue;
                        if (current.child?.memoizedProps?.onClick !== onClick) continue;
                        if (props.action || props.isLocked || props.model.isDisabled) return null;
                        if (typeof props.clickHandler !== 'function' || typeof props.activeModel !== 'string') return null;
                        return {
                            activeModel: props.activeModel,
                            select(model) {
                                // Pass a page-realm object: the page must not read
                                // privileged userscript objects through Firefox Xrays.
                                const value = new page.Object();
                                value.id = model.id;
                                value.name = model.label;
                                props.clickHandler(value);
                            },
                        };
                    }
                }
            } catch (error) {
                console.warn('[SpicyChat Tools] Не удалось прочитать обработчик выбора модели.', error);
            }
            return null;
        },
    };
}


// ---- src/core/chat-panel.js ----

// Always-available per-conversation controls; persistence stays in the feature.
function createChatPanel({ getContext, read, save, models, minTokens, maxTokens, tokenStep, initialTokens, shadowMode = 'closed' }) {
    const host = document.createElement('div'); host.id = 'spchat-chat-panel';
    const root = host.attachShadow({ mode: shadowMode });
    const style = document.createElement('style');
    style.textContent = `
        :host { all: initial; position: fixed; right: 18px; top: 72px; z-index: 90; width: min(260px, calc(100vw - 24px)); color-scheme: dark; font: 13px/1.45 system-ui, sans-serif; color: #f1f1f6; }
        :host([hidden]), [hidden] { display: none !important; }
        * { box-sizing: border-box; }
        details.panel { background: #22242ef2; border: 1px solid #484a5b; border-radius: 12px; box-shadow: none; max-height: calc(100dvh - 90px); overflow-y: auto; }
        summary { cursor: pointer; }
        .heading { padding: 9px 30px 9px 12px; position: relative; list-style: none; font-weight: 650; }
        .heading::-webkit-details-marker { display: none; }
        .heading::after { content: '▾'; position: absolute; right: 12px; top: 9px; }
        .panel:not([open]) > .heading::after { content: '▸'; }
        .compact { display: block; color: #c5c5d5; font-size: 11px; font-weight: 400; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .panel[open] > .heading .compact { display: none; }
        .body { padding: 0 12px 8px; }
        .field { display: block; margin: 0 0 8px; }
        .label { display: block; color: #c5c5d5; margin-bottom: 3px; }
        select, textarea, button, input { font: inherit; }
        select, textarea { width: 100%; color: #f4f4fa; background: #151720; border: 1px solid #505467; border-radius: 7px; padding: 6px; }
        select { cursor: pointer; }
        textarea { margin-top: 6px; min-height: 72px; resize: vertical; }
        input[type=range] { width: 100%; margin: 6px 0 0; accent-color: #a395f7; }
        input[type=checkbox] { accent-color: #a395f7; flex-shrink: 0; margin: 3px 0 0; }
        button { color: #d4ccff; cursor: pointer; background: transparent; border: 0; padding: 0; font-size: 11px; text-decoration: underline; }
        :focus-visible { outline: 2px solid #b7a9ff; outline-offset: 2px; }
        .token-head { display: flex; justify-content: space-between; gap: 10px; }
        .token-head .label { margin: 0; }
        fieldset { min-inline-size: 0; margin: 0; padding: 0; border: 0; }
        legend { color: #c5c5d5; margin-bottom: 3px; }
        .commands { max-height: 150px; overflow-y: auto; }
        .command { display: flex; align-items: flex-start; gap: 8px; padding: 3px 0; overflow-wrap: anywhere; cursor: pointer; }
        .empty, .hint { color: #a7a8bb; font-size: 11px; margin: 4px 0; }
        .manual { margin-top: 8px; }
        .manual > summary { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: #d4ccff; }
        .error { color: #ffb6ab; font-size: 12px; margin-top: 8px; overflow-wrap: anywhere; }
        @media(max-width: 540px) { :host { right: 12px; top: 64px; width: min(250px, calc(100vw - 24px)); } details.panel { max-height: calc(100dvh - 80px); } }
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


// ---- src/modules/per-chat.js ----

// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
function init_per_chat(runtime) {
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
    const MAX_TOKENS = 300;
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


// ---- src/modules/quick-delete.js ----

// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
function init_quick_delete(runtime) {
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
        const menu = runtime.dom?.chatMenu(findChatDropdownButton());
        const action = runtime.dom?.findAction(menu, 'remove', true);
        if (action) return action;
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


// ---- src/modules/timestamps.js ----

// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
function init_timestamps(runtime) {
    'use strict';

    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const INSTANCE_KEY = '__spicyChatMessageTimestampsV1';
    if (window[INSTANCE_KEY]) return;
    window[INSTANCE_KEY] = true;

    const MESSAGE_SELECTOR = 'div[id^="message-"]';
    const MESSAGE_DROPDOWN_SELECTOR = 'button[aria-label="message-dropdown" i]';
    const TIMESTAMP_CLASS = 'tm-sc-message-sent-at';
    const SESSION_DIVIDER_CLASS = 'tm-sc-message-session-divider';
    const STYLE_ID = 'tm-sc-message-sent-at-style';
    const XHR_URL_KEY = '__tmScVisibleTimestampRequestUrl';
    const STORAGE_PREFIX = 'tm-sc-message-timestamps-v1:conversation:';
    const SESSION_GAP_MS = 2 * 60 * 60 * 1000;
    const CACHE_WRITE_DELAY = 450;
    const INTERNAL_RESPONSE_CONSUMER_FLAG = '__tmScConsumesJsonResponse';
    const ROUTE_CHANGE_EVENT = 'tm-sc-route-change';

    const timestampByMessageId = new Map();
    const moscowDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });

    let ensureScheduled = false;
    let rootObserver = null;
    let retryTimer = null;
    let retryDelay = 250;
    let activeContext = null;
    let activeStorageKey = null;
    let contextLoadToken = 0;
    let cacheLoaded = false;
    let cacheDirty = false;
    let cacheWriteTimer = null;
    let cacheWriteQueue = Promise.resolve();

    function normalizeTimestamp(value) {
        if (value === null || value === undefined || value === '') return null;

        let timestamp = Number(value);
        if (!Number.isFinite(timestamp) && typeof value === 'string') {
            timestamp = Date.parse(value);
        }
        if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
        return timestamp < 100000000000 ? timestamp * 1000 : timestamp;
    }

    function installRouteChangeSignal() {
        const key = '__tmScRouteChangeSignalV1';
        if (pageWindow[key]) return;
        const dispatch = () => pageWindow.dispatchEvent(new pageWindow.Event(ROUTE_CHANGE_EVENT));
        for (const method of ['pushState', 'replaceState']) {
            const original = pageWindow.history?.[method];
            if (typeof original !== 'function') continue;
            pageWindow.history[method] = function (...args) {
                const result = Reflect.apply(original, this, args);
                dispatch();
                return result;
            };
        }
        pageWindow.addEventListener('popstate', dispatch);
        pageWindow.addEventListener('hashchange', dispatch);
        pageWindow[key] = true;
    }

    function getChatContext() {
        const parts = location.pathname.split('/').filter(Boolean);
        if (parts[0] !== 'chat' || !parts[1]) return null;

        const botId = parts[1];
        const conversationId = parts[2] || 'default';
        return {
            botId,
            conversationId,
            storageKey: `${STORAGE_PREFIX}${botId}:${conversationId}`,
        };
    }

    async function readValue(key, fallbackValue) {
        try {
            if (typeof GM_getValue === 'function') {
                const value = await Promise.resolve(GM_getValue(key, fallbackValue));
                return value === undefined ? fallbackValue : value;
            }
        } catch (error) {
            console.warn('[Message Timestamps] Не удалось прочитать кеш Tampermonkey.', error);
        }

        try {
            const raw = localStorage.getItem(key);
            return raw === null ? fallbackValue : JSON.parse(raw);
        } catch (_error) {
            return fallbackValue;
        }
    }

    async function writeValue(key, value) {
        if (typeof GM_setValue === 'function') {
            await Promise.resolve(GM_setValue(key, value));
            return;
        }
        localStorage.setItem(key, JSON.stringify(value));
    }

    function normalizeCache(value) {
        const source = value && typeof value === 'object' && !Array.isArray(value)
            ? (value.timestamps && typeof value.timestamps === 'object' ? value.timestamps : value)
            : {};
        const normalized = new Map();

        for (const [rawMessageId, rawTimestamp] of Object.entries(source)) {
            const messageId = toDomMessageId(rawMessageId);
            const timestamp = normalizeTimestamp(rawTimestamp);
            if (messageId && timestamp) normalized.set(messageId, timestamp);
        }

        return normalized;
    }

    function makeCacheSnapshot() {
        return {
            version: 1,
            updatedAt: Date.now(),
            timestamps: Object.fromEntries(timestampByMessageId),
        };
    }

    function queueCacheWrite(storageKey, snapshot) {
        if (!storageKey) return;

        const operation = cacheWriteQueue.then(() => writeValue(storageKey, snapshot));
        cacheWriteQueue = operation.catch((error) => {
            console.warn('[Message Timestamps] Не удалось сохранить кеш.', error);
        });
    }

    function flushTimestampCache() {
        if (cacheWriteTimer) {
            window.clearTimeout(cacheWriteTimer);
            cacheWriteTimer = null;
        }
        if (!activeStorageKey || !cacheLoaded || !cacheDirty) return;

        const storageKey = activeStorageKey;
        const snapshot = makeCacheSnapshot();
        cacheDirty = false;
        queueCacheWrite(storageKey, snapshot);
    }

    function scheduleCacheWrite() {
        cacheDirty = true;
        if (!activeStorageKey || !cacheLoaded) return;
        if (cacheWriteTimer) window.clearTimeout(cacheWriteTimer);
        cacheWriteTimer = window.setTimeout(flushTimestampCache, CACHE_WRITE_DELAY);
    }

    function removeInjectedTimelineUi() {
        for (const time of document.querySelectorAll(`.${TIMESTAMP_CLASS}`)) time.remove();
        for (const divider of document.querySelectorAll(`.${SESSION_DIVIDER_CLASS}`)) divider.remove();
    }

    function ensureContext() {
        const context = getChatContext();
        const nextStorageKey = context?.storageKey || null;
        if (nextStorageKey === activeStorageKey) return;

        flushTimestampCache();
        if (cacheWriteTimer) {
            window.clearTimeout(cacheWriteTimer);
            cacheWriteTimer = null;
        }

        activeContext = context;
        activeStorageKey = nextStorageKey;
        contextLoadToken += 1;
        const token = contextLoadToken;
        timestampByMessageId.clear();
        cacheLoaded = false;
        cacheDirty = false;
        removeInjectedTimelineUi();

        if (!nextStorageKey) {
            scheduleEnsure();
            return;
        }

        void readValue(nextStorageKey, { version: 1, timestamps: {} }).then((stored) => {
            if (token !== contextLoadToken || activeStorageKey !== nextStorageKey) return;

            const cached = normalizeCache(stored);
            for (const [messageId, timestamp] of cached) {
                if (!timestampByMessageId.has(messageId)) {
                    timestampByMessageId.set(messageId, timestamp);
                }
            }

            cacheLoaded = true;
            if (cacheDirty) scheduleCacheWrite();
            scheduleEnsure();
        }).catch((error) => {
            console.warn('[Message Timestamps] Не удалось загрузить кеш.', error);
            if (token !== contextLoadToken || activeStorageKey !== nextStorageKey) return;
            cacheLoaded = true;
            if (cacheDirty) scheduleCacheWrite();
            scheduleEnsure();
        });
    }

    function toDomMessageId(rawId) {
        if (typeof rawId !== 'string' || !rawId.trim()) return null;
        const id = rawId.trim();
        return id.startsWith('message-') ? id : `message-${id}`;
    }

    function readRequestUrl(input) {
        if (typeof input === 'string') return input;
        if (input && typeof input.url === 'string') return input.url;
        try {
            return String(input || '');
        } catch (_error) {
            return '';
        }
    }

    function isMessageApiUrl(rawUrl) {
        try {
            const url = new URL(rawUrl, location.href);
            const trustedHost = url.hostname === 'nd-api.com' || url.hostname.endsWith('.nd-api.com');
            return trustedHost && (
                /\/characters\/[^/]+\/messages\/[^/]+/i.test(url.pathname)
                || /\/conversations\/[^/]+\/messages(?:\/|$)/i.test(url.pathname)
            );
        } catch (_error) {
            return false;
        }
    }

    function getMoscowParts(timestamp) {
        const normalized = normalizeTimestamp(timestamp);
        if (!normalized) return null;

        try {
            return Object.fromEntries(
                moscowDateTimeFormatter.formatToParts(new Date(normalized))
                    .map((part) => [part.type, part.value]),
            );
        } catch (_error) {
            return null;
        }
    }

    function formatMoscowDateTime(timestamp) {
        const parts = getMoscowParts(timestamp);
        if (!parts) return '';
        return `${parts.day}.${parts.month}.${parts.year}, ${parts.hour}:${parts.minute}`;
    }

    function formatMoscowDate(timestamp) {
        const parts = getMoscowParts(timestamp);
        if (!parts) return '';
        return `${parts.day}.${parts.month}.${parts.year}`;
    }

    function getMoscowDateKey(timestamp) {
        const parts = getMoscowParts(timestamp);
        if (!parts) return '';
        return `${parts.year}-${parts.month}-${parts.day}`;
    }

    function formatElapsedTime(milliseconds) {
        const totalMinutes = Math.max(0, Math.round(milliseconds / 60000));
        const days = Math.floor(totalMinutes / 1440);
        const hours = Math.floor((totalMinutes % 1440) / 60);
        const minutes = totalMinutes % 60;

        if (days > 0) {
            return [
                `${days} д`,
                hours ? `${hours} ч` : '',
            ].filter(Boolean).join(' ');
        }

        return [
            hours ? `${hours} ч` : '',
            minutes ? `${minutes} мин` : '',
        ].filter(Boolean).join(' ') || 'меньше минуты';
    }

    function makeSessionDividerLabel(previousTimestamp, currentTimestamp) {
        const previous = normalizeTimestamp(previousTimestamp);
        const current = normalizeTimestamp(currentTimestamp);
        if (!previous || !current || current <= previous) return '';

        const gap = current - previous;
        const dateChanged = getMoscowDateKey(previous) !== getMoscowDateKey(current);
        const isLongGap = gap > SESSION_GAP_MS;
        if (!dateChanged && !isLongGap) return '';

        const dateLabel = dateChanged ? formatMoscowDate(current) : '';
        const elapsedLabel = isLongGap ? formatElapsedTime(gap) : '';

        if (dateLabel && elapsedLabel) return `${dateLabel} · прошло ${elapsedLabel}`;
        if (dateLabel) return dateLabel;
        if (elapsedLabel) return `Прошло ${elapsedLabel}`;
        return '';
    }

    function captureTimestamps(payload) {
        ensureContext();
        if (!activeStorageKey) return;

        const found = new Map();
        const visited = new WeakSet();

        const walk = (value, depth) => {
            if (!value || typeof value !== 'object' || depth > 10) return;
            if (visited.has(value)) return;
            visited.add(value);

            if (Array.isArray(value)) {
                for (const item of value) walk(item, depth + 1);
                return;
            }

            const messageId = toDomMessageId(value.id);
            const timestamp = normalizeTimestamp(value.createdAt);
            const conversationId = typeof value.conversation_id === 'string'
                ? value.conversation_id
                : null;
            const belongsToCurrentConversation = (
                !conversationId
                || !activeContext?.conversationId
                || conversationId === activeContext.conversationId
            );
            const looksLikeMessage = (
                typeof value.content === 'string'
                && (
                    value.role === 'bot'
                    || value.role === 'user'
                    || typeof value.conversation_id === 'string'
                    || typeof value.character_id === 'string'
                )
            );

            if (messageId && timestamp && looksLikeMessage && belongsToCurrentConversation) {
                found.set(messageId, timestamp);
            }
            for (const child of Object.values(value)) walk(child, depth + 1);
        };

        walk(payload, 0);
        if (!found.size) return;

        let changed = false;
        for (const [messageId, timestamp] of found) {
            if (timestampByMessageId.get(messageId) === timestamp) continue;
            timestampByMessageId.set(messageId, timestamp);
            changed = true;
        }

        if (changed) {
            scheduleCacheWrite();
            scheduleEnsure();
        }
    }

    function inspectFetchResponse(response, requestUrl) {
        if (!isMessageApiUrl(requestUrl) || !response?.clone) return;

        try {
            const contentType = response.headers?.get?.('content-type') || '';
            if (contentType && !/json/i.test(contentType)) return;
            const clone = response.clone();
            void Promise.resolve(clone.json()).then(captureTimestamps).catch(() => undefined);
        } catch (_error) {
            // Не-JSON ответы и потоки просто пропускаем.
        }
    }

    function installTimestampCapture() {
        try {
            const originalFetch = pageWindow.fetch;
            if (typeof originalFetch === 'function') {
                pageWindow.fetch = function (...args) {
                    const requestUrl = readRequestUrl(args[0]);
                    const result = Reflect.apply(originalFetch, this, args);
                    if (
                        isMessageApiUrl(requestUrl)
                        && args[1]?.[INTERNAL_RESPONSE_CONSUMER_FLAG] !== true
                    ) {
                        void Promise.resolve(result).then(
                            (response) => inspectFetchResponse(response, requestUrl),
                            () => undefined,
                        );
                    }
                    return result;
                };
            }
        } catch (error) {
            console.warn('[Message Timestamps] Не удалось подключиться к fetch.', error);
        }

        try {
            const xhrPrototype = pageWindow.XMLHttpRequest?.prototype;
            if (!xhrPrototype) return;

            const originalOpen = xhrPrototype.open;
            const originalSend = xhrPrototype.send;

            xhrPrototype.open = function (...args) {
                this[XHR_URL_KEY] = readRequestUrl(args[1]);
                return Reflect.apply(originalOpen, this, args);
            };

            xhrPrototype.send = function (...args) {
                const xhr = this;
                const requestUrl = xhr[XHR_URL_KEY] || '';

                if (isMessageApiUrl(requestUrl)) {
                    xhr.addEventListener('loadend', () => {
                        try {
                            const responseUrl = xhr.responseURL || requestUrl;
                            if (!isMessageApiUrl(responseUrl)) return;
                            const contentType = xhr.getResponseHeader?.('content-type') || '';
                            if (contentType && !/json/i.test(contentType)) return;

                            const payload = xhr.responseType === 'json'
                                ? xhr.response
                                : JSON.parse(xhr.responseText);
                            captureTimestamps(payload);
                        } catch (_error) {
                            // Не-JSON ответы и потоки просто пропускаем.
                        }
                    }, { once: true });
                }

                return Reflect.apply(originalSend, this, args);
            };
        } catch (error) {
            console.warn('[Message Timestamps] Не удалось подключиться к XHR.', error);
        }
    }

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .${TIMESTAMP_CLASS} {
                box-sizing: border-box !important;
                display: inline-flex !important;
                align-items: center !important;
                align-self: center !important;
                flex: 0 0 auto !important;
                margin-left: auto !important;
                padding: 0 2px !important;
                color: #71717a !important;
                font-family: inherit !important;
                font-size: 12px !important;
                font-weight: 400 !important;
                font-variant-numeric: tabular-nums !important;
                line-height: 1.2 !important;
                white-space: nowrap !important;
                cursor: default !important;
                user-select: none !important;
            }

            .dark .${TIMESTAMP_CLASS} {
                color: #a1a1aa !important;
            }

            .${SESSION_DIVIDER_CLASS} {
                box-sizing: border-box !important;
                display: flex !important;
                align-items: center !important;
                gap: 12px !important;
                width: min(800px, calc(100% - 24px)) !important;
                margin: 4px auto 18px !important;
                padding: 0 12px !important;
                color: #71717a !important;
                font-family: inherit !important;
                font-size: 11.5px !important;
                font-weight: 500 !important;
                font-variant-numeric: tabular-nums !important;
                line-height: 1.25 !important;
                white-space: nowrap !important;
                pointer-events: none !important;
                user-select: none !important;
            }

            .${SESSION_DIVIDER_CLASS}::before,
            .${SESSION_DIVIDER_CLASS}::after {
                content: "" !important;
                flex: 1 1 auto !important;
                height: 1px !important;
                background: rgba(113, 113, 122, 0.28) !important;
            }

            .dark .${SESSION_DIVIDER_CLASS} {
                color: #a1a1aa !important;
            }

            .dark .${SESSION_DIVIDER_CLASS}::before,
            .dark .${SESSION_DIVIDER_CLASS}::after {
                background: rgba(161, 161, 170, 0.24) !important;
            }
        `;
        document.head.appendChild(style);
    }

    function findHeaderParts(message) {
        const dropdown = message.querySelector(MESSAGE_DROPDOWN_SELECTOR);
        if (!dropdown) return null;

        const knownControls = (
            dropdown.closest('.sc-quick-delete-controls')
            || dropdown.closest('.relative')
        );
        if (knownControls?.parentElement && message.contains(knownControls.parentElement)) {
            return { header: knownControls.parentElement, controls: knownControls };
        }

        let controls = dropdown.parentElement;
        while (controls?.parentElement && controls.parentElement !== message) {
            const header = controls.parentElement;
            const hasIdentitySibling = Array.from(header.children).some((child) => (
                child !== controls
                && Boolean(child.querySelector?.('img, a[href^="/chatbot/"]'))
            ));
            if (hasIdentitySibling) return { header, controls };
            controls = header;
        }

        return null;
    }

    function ensureMessageTimestamp(message) {
        const timestamp = timestampByMessageId.get(message.id);
        let time = message.querySelector(`.${TIMESTAMP_CLASS}`);

        if (!timestamp) {
            if (time) time.remove();
            return;
        }

        const parts = findHeaderParts(message);
        if (!parts) return;

        const label = formatMoscowDateTime(timestamp);
        if (!label) return;

        if (!time) {
            time = document.createElement('time');
            time.className = TIMESTAMP_CLASS;
        }

        const isoDate = new Date(timestamp).toISOString();
        const title = `Отправлено ${label} по Москве`;
        if (time.dataset.messageId !== message.id) time.dataset.messageId = message.id;
        if (time.dateTime !== isoDate) time.dateTime = isoDate;
        if (time.textContent !== label) time.textContent = label;
        if (time.title !== title) time.title = title;
        if (time.getAttribute('aria-label') !== title) time.setAttribute('aria-label', title);

        if (time.parentElement !== parts.header || time.nextElementSibling !== parts.controls) {
            parts.header.insertBefore(time, parts.controls);
        }
    }

    function ensureSessionDividers(messages) {
        const desired = new Map();

        for (let index = 1; index < messages.length; index += 1) {
            const previousMessage = messages[index - 1];
            const currentMessage = messages[index];
            const previousTimestamp = timestampByMessageId.get(previousMessage.id);
            const currentTimestamp = timestampByMessageId.get(currentMessage.id);
            const label = makeSessionDividerLabel(previousTimestamp, currentTimestamp);

            if (label) desired.set(currentMessage.id, { message: currentMessage, label });
        }

        const existingByMessageId = new Map();
        for (const divider of document.querySelectorAll(`.${SESSION_DIVIDER_CLASS}`)) {
            const messageId = divider.dataset.beforeMessageId || '';
            if (!messageId || existingByMessageId.has(messageId)) {
                divider.remove();
                continue;
            }
            existingByMessageId.set(messageId, divider);
        }

        for (const [messageId, divider] of existingByMessageId) {
            if (desired.has(messageId)) continue;
            divider.remove();
            existingByMessageId.delete(messageId);
        }

        for (const [messageId, item] of desired) {
            let divider = existingByMessageId.get(messageId);
            if (!divider) {
                divider = document.createElement('div');
                divider.className = SESSION_DIVIDER_CLASS;
                divider.dataset.beforeMessageId = messageId;
                divider.setAttribute('role', 'separator');
            }

            if (divider.textContent !== item.label) divider.textContent = item.label;
            divider.setAttribute('aria-label', item.label);

            if (
                divider.parentElement !== item.message.parentElement
                || divider.nextElementSibling !== item.message
            ) {
                item.message.before(divider);
            }
        }
    }

    function ensureAllTimestamps() {
        ensureContext();
        const messages = Array.from(document.querySelectorAll(MESSAGE_SELECTOR));
        for (const message of messages) {
            ensureMessageTimestamp(message);
        }
        ensureSessionDividers(messages);
    }

    function scheduleEnsure() {
        if (ensureScheduled) return;
        ensureScheduled = true;
        requestAnimationFrame(runDomPass);
    }

    function nodeContainsMessage(node, includeDescendants = true) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
        const selector = `${MESSAGE_SELECTOR}, ${MESSAGE_DROPDOWN_SELECTOR}`;
        return (
            node.matches?.(selector)
            || (includeDescendants && Boolean(node.querySelector?.(selector)))
        );
    }

    function isTimelineMutation(record) {
        const element = record.target?.nodeType === Node.ELEMENT_NODE
            ? record.target
            : record.target?.parentElement;
        return Boolean(element?.closest?.(`.${TIMESTAMP_CLASS}, .${SESSION_DIVIDER_CLASS}`));
    }

    function handleRootMutations(records) {
        if (records.length && records.every(isTimelineMutation)) return;
        const relevant = records.some((record) => (
            nodeContainsMessage(record.target, false)
            || Array.from(record.addedNodes).some((node) => nodeContainsMessage(node, true))
            || Array.from(record.removedNodes).some((node) => nodeContainsMessage(node, true))
        ));
        if (relevant) scheduleEnsure();
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
            ensureAllTimestamps();

            if (!rootObserver) {
                rootObserver = new MutationObserver(handleRootMutations);
                rootObserver.observe(document.documentElement, { childList: true, subtree: true });
            }
            resetRetry();
        } catch (error) {
            rootObserver?.disconnect();
            rootObserver = null;
            console.error('[Message Timestamps] DOM-инициализация сорвалась, повторю автоматически.', error);
            scheduleRetry();
        }
    }

    function startDomFeatures() {
        runDomPass();
    }

    ensureContext();
    installTimestampCapture();
    installRouteChangeSignal();
    window.addEventListener('pagehide', flushTimestampCache);
    window.addEventListener(ROUTE_CHANGE_EVENT, startDomFeatures);
    window.addEventListener('pageshow', startDomFeatures);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) startDomFeatures();
    });
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startDomFeatures, { once: true });
    }
    startDomFeatures();
}


// ---- src/modules/gallery.js ----

// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
function init_gallery(runtime) {
    'use strict';

    const INSTANCE_KEY = '__spicyChatConversationGalleryV1';
    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (pageWindow[INSTANCE_KEY]) return;
    pageWindow[INSTANCE_KEY] = true;

    const MESSAGE_SELECTOR = 'div[id^="message-"]';
    const CHAT_DROPDOWN_SELECTOR = 'button[aria-label="chat-dropdown" i]';
    const BOOKMARK_MENU_ITEM_CLASS = 'tm-sc-open-message-bookmarks';
    const MENU_ITEM_CLASS = 'tm-sc-open-conversation-gallery';
    const STYLE_ID = 'tm-sc-conversation-gallery-style';
    const GALLERY_ID = 'tm-sc-conversation-gallery';
    const VIEWER_ID = 'tm-sc-conversation-gallery-viewer';
    const XHR_URL_KEY = '__tmScGalleryRequestUrl';
    const INTERNAL_RESPONSE_CONSUMER_FLAG = '__tmScConsumesJsonResponse';
    const ROUTE_CHANGE_EVENT = 'tm-sc-route-change';
    const HISTORY_PAGE_SIZE = 50;
    const MAX_HISTORY_PAGES = 1000;
    const API_WAIT_TIMEOUT = 8000;
    const CHAT_MENU_ITEM_ORDER = [
        'tm-sc-open-message-bookmarks',
        'tm-sc-open-conversation-gallery',
        'tm-sc-open-gpt-summary',
        'tm-sc-open-chat-branches',
    ];

    const sourceImages = new Map();
    const galleryImages = new Map();
    const messageMetaById = new Map();
    const capturedMessageIds = new Set();
    const capturedHeaders = new Map();
    let apiOrigin = '';
    const usefulHeaders = new Set([
        'authorization',
        'x-guest-userid',
        'x-country',
        'x-app-id',
        'x-app-version',
        'x-platform',
        'x-platform-os',
        'accept',
        'content-type',
    ]);

    let activeContext = null;
    let totalApiRecordCount = null;
    let ensureScheduled = false;
    let renderScheduled = false;
    let rootObserver = null;
    let retryTimer = null;
    let retryDelay = 250;

    let galleryOverlay = null;
    let galleryGrid = null;
    let galleryEmpty = null;
    let galleryCount = null;
    let galleryStatus = null;
    let galleryMetrics = null;
    let galleryProgressBar = null;
    let galleryProgressTrack = null;
    let galleryRefreshButton = null;
    let galleryAnchor = null;
    const tileByKey = new Map();

    let viewerOverlay = null;
    let viewerImage = null;
    let viewerCounter = null;
    let viewerState = null;
    let viewerCurrentKey = null;
    let viewerLoader = null;
    let viewerLoadToken = 0;

    let scanToken = 0;
    let scanState = null;

    const moscowDateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });

    const icons = {
        gallery: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <path d="m21 15-5-5L5 21"></path>
            </svg>`,
        close: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="m18 6-12 12"></path><path d="m6 6 12 12"></path>
            </svg>`,
        refresh: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"></path>
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"></path>
            </svg>`,
        left: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="30" height="30"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="m15 18-6-6 6-6"></path>
            </svg>`,
        right: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="30" height="30"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="m9 18 6-6-6-6"></path>
            </svg>`,
    };

    function getChatContext() {
        const parts = location.pathname.split('/').filter(Boolean);
        const chatIndex = parts.indexOf('chat');
        if (chatIndex < 0 || !parts[chatIndex + 1] || !parts[chatIndex + 2]) return null;

        const characterId = parts[chatIndex + 1];
        const conversationId = parts[chatIndex + 2];
        return {
            characterId,
            conversationId,
            key: `${characterId}:${conversationId}`,
        };
    }

    function installRouteChangeSignal() {
        const key = '__tmScRouteChangeSignalV1';
        if (pageWindow[key]) return;
        const dispatch = () => pageWindow.dispatchEvent(new pageWindow.Event(ROUTE_CHANGE_EVENT));
        for (const method of ['pushState', 'replaceState']) {
            const original = pageWindow.history?.[method];
            if (typeof original !== 'function') continue;
            pageWindow.history[method] = function (...args) {
                const result = Reflect.apply(original, this, args);
                dispatch();
                return result;
            };
        }
        pageWindow.addEventListener('popstate', dispatch);
        pageWindow.addEventListener('hashchange', dispatch);
        pageWindow[key] = true;
    }

    function ensureContext() {
        const next = getChatContext();
        if (next?.key === activeContext?.key) return;

        invalidateScan();
        closeViewer();
        closeGallery(false);
        activeContext = next;
        totalApiRecordCount = null;
        sourceImages.clear();
        galleryImages.clear();
        messageMetaById.clear();
        capturedMessageIds.clear();
        tileByKey.clear();
        if (galleryGrid) galleryGrid.replaceChildren();
        scheduleRender();
    }

    function normalizeTimestamp(value) {
        if (value === null || value === undefined || value === '') return 0;
        let timestamp = Number(value);
        if (!Number.isFinite(timestamp) && typeof value === 'string') timestamp = Date.parse(value);
        if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
        return timestamp < 100000000000 ? timestamp * 1000 : timestamp;
    }

    function normalizeMessageId(rawId) {
        if (typeof rawId !== 'string') return '';
        return rawId.trim().replace(/^message-/, '');
    }

    function normalizeConversationImageUrl(rawValue) {
        if (typeof rawValue !== 'string') return null;
        let raw = rawValue.trim().replace(/[),.;]+$/, '');
        if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return null;

        const mediaPathPattern = /(?:^|\/)(?:conversations|chat_user_images)\//i;

        if (raw.startsWith('//')) raw = `https:${raw}`;
        if (!/^https?:\/\//i.test(raw)) {
            const pathMatch = raw.match(mediaPathPattern);
            if (!pathMatch || pathMatch.index === undefined) return null;
            const mediaPath = raw.slice(pathMatch.index).replace(/^\/+/, '');
            raw = `https://cdn.nd-api.com/${mediaPath}`;
        }

        try {
            const url = new URL(raw);
            const trustedHost = (
                url.hostname === 'nd-api.com'
                || url.hostname.endsWith('.nd-api.com')
            );
            const isConversationImage = url.pathname.includes('/conversations/');
            const isUserImage = url.pathname.includes('/chat_user_images/');
            if (!trustedHost || (!isConversationImage && !isUserImage)) return null;

            const key = `${url.origin}${url.pathname}`;
            const full = new URL(url.href);
            for (const parameter of [
                'class',
                'width',
                'height',
                'aspect_ratio',
                'crop_gravity',
            ]) {
                full.searchParams.delete(parameter);
            }

            const preview = new URL(full.href);
            if (isConversationImage) preview.searchParams.set('class', 'image500x650');

            return {
                key,
                fullUrl: full.href,
                previewUrl: preview.href,
            };
        } catch (_error) {
            return null;
        }
    }

    function extractConversationImageUrls(value) {
        if (
            typeof value !== 'string'
            || (!value.includes('conversations/') && !value.includes('chat_user_images/'))
        ) return [];
        const found = new Map();
        const direct = normalizeConversationImageUrl(value);
        if (direct) found.set(direct.key, direct);

        const matches = value.match(
            /(?:https?:\/\/[^\s"'<>\\]+)?\/?(?:conversations|chat_user_images)\/[^\s"'<>\\]+/gi,
        ) || [];
        for (const match of matches) {
            const normalized = normalizeConversationImageUrl(match);
            if (normalized) found.set(normalized.key, normalized);
        }

        return Array.from(found.values());
    }

    function collectImageUrlsFromMessage(message) {
        const found = new Map();
        const visited = new WeakSet();

        const walk = (value, depth, keyHint = '') => {
            if (depth > 6 || value === null || value === undefined) return;

            if (typeof value === 'string') {
                if (/image|url|src|content/i.test(keyHint) || value.includes('conversations/')) {
                    for (const normalized of extractConversationImageUrls(value)) {
                        found.set(normalized.key, normalized);
                    }
                }
                return;
            }

            if (typeof value !== 'object' || visited.has(value)) return;
            visited.add(value);

            if (Array.isArray(value)) {
                for (const item of value) walk(item, depth + 1, keyHint);
                return;
            }

            for (const [key, child] of Object.entries(value)) {
                walk(child, depth + 1, key);
            }
        };

        walk(message, 0);
        return Array.from(found.values());
    }

    function formatMoscowDateTime(timestamp) {
        if (!timestamp) return '';
        try {
            return moscowDateTimeFormatter.format(new Date(timestamp));
        } catch (_error) {
            return '';
        }
    }

    function recordSourceImage({
        normalized,
        messageId = '',
        conversationId = '',
        createdAt = 0,
        isAlternative = false,
        domOrder = -1,
        source = 'api',
    }) {
        if (!normalized || !activeContext) return;
        if (conversationId && conversationId !== activeContext.conversationId) return;

        const now = Date.now();
        const existing = sourceImages.get(normalized.key);
        const entry = existing || {
            key: normalized.key,
            fullUrl: normalized.fullUrl,
            previewUrl: normalized.previewUrl,
            messageId,
            conversationId: conversationId || activeContext.conversationId,
            createdAt,
            isAlternative,
            domOrder,
            discoveredAt: now,
            sources: new Set(),
            messageIds: new Set(),
        };

        entry.fullUrl = normalized.fullUrl || entry.fullUrl;
        entry.previewUrl = normalized.previewUrl || entry.previewUrl;
        if (createdAt > entry.createdAt) entry.createdAt = createdAt;
        if (domOrder > entry.domOrder) entry.domOrder = domOrder;
        if (messageId) {
            entry.messageIds.add(messageId);
            if (!entry.messageId || createdAt >= entry.createdAt) entry.messageId = messageId;
        }
        entry.isAlternative = entry.isAlternative || isAlternative;
        entry.sources.add(source);
        sourceImages.set(entry.key, entry);

        if (galleryOverlay && !galleryOverlay.hidden) {
            galleryImages.set(entry.key, entry);
            scheduleRender();
        }
    }

    function captureApiPayload(payload) {
        ensureContext();
        if (!activeContext || !payload || typeof payload !== 'object') return;
        const envelope = [payload, payload.data, payload.conversation]
            .find((candidate) => candidate && Array.isArray(candidate.messages));
        if (!envelope) return;

        const envelopeConversationId = typeof envelope.conversation_id === 'string'
            ? envelope.conversation_id
            : activeContext.conversationId;
        if (envelopeConversationId !== activeContext.conversationId) return;
        totalApiRecordCount = Math.max(
            totalApiRecordCount || 0,
            Number(envelope.num_messages) || 0,
        );
        let changed = false;
        for (const value of envelope.messages) {
            if (!value || typeof value !== 'object') continue;
            const messageId = normalizeMessageId(value.id);
            const conversationId = typeof value.conversation_id === 'string'
                ? value.conversation_id
                : activeContext.conversationId;
            const isMessage = (
                messageId
                && conversationId === activeContext.conversationId
                && (value.role === 'bot' || value.role === 'user')
            );

            if (isMessage) {
                const createdAt = normalizeTimestamp(value.createdAt);
                const isAlternative = value.is_alternative === true;
                messageMetaById.set(messageId, {
                    createdAt,
                    isAlternative,
                    role: value.role,
                });
                capturedMessageIds.add(messageId);

                for (const normalized of collectImageUrlsFromMessage(value)) {
                    recordSourceImage({
                        normalized,
                        messageId,
                        conversationId,
                        createdAt,
                        isAlternative,
                        source: 'api',
                    });
                    changed = true;
                }
            }
        }
        if (changed || scanState) scheduleRender();
    }

    function readRequestUrl(input) {
        if (typeof input === 'string') return input;
        if (input && typeof input.url === 'string') return input.url;
        return '';
    }

    function isSpicyApiUrl(rawUrl) {
        try {
            const url = new URL(rawUrl, location.href);
            return url.hostname === 'nd-api.com' || url.hostname.endsWith('.nd-api.com');
        } catch (_error) {
            return false;
        }
    }

    function rememberHeader(name, value) {
        const normalizedName = String(name).toLowerCase();
        if (usefulHeaders.has(normalizedName)) capturedHeaders.set(normalizedName, String(value));
    }

    function rememberHeaders(headers) {
        if (!headers) return;
        try {
            const parsed = new pageWindow.Headers(headers);
            parsed.forEach((value, name) => rememberHeader(name, value));
        } catch (_error) {
            // Нестандартный объект заголовков просто пропускаем.
        }
    }

    function rememberApiAccess(rawUrl, ...headerSources) {
        if (!isSpicyApiUrl(rawUrl)) return;
        try {
            const url = new URL(rawUrl, location.href);
            if (url.hostname !== 'cdn.nd-api.com') apiOrigin = url.origin;
        } catch (_error) {
            return;
        }
        for (const headers of headerSources) rememberHeaders(headers);
    }

    function hasApiAccess() {
        return Boolean(typeof originalFetch === 'function' && apiOrigin && capturedHeaders.get('authorization'));
    }

    function getRequestHeaders() {
        const headers = Object.fromEntries(capturedHeaders);
        headers.accept = 'application/json, text/plain, */*';
        return headers;
    }

    const originalFetch = pageWindow.fetch;
    if (typeof originalFetch === 'function') {
        pageWindow.fetch = function (input, options = {}) {
            const requestUrl = readRequestUrl(input);
            if (isSpicyApiUrl(requestUrl)) {
                rememberApiAccess(requestUrl, input?.headers, options?.headers);
            }

            return Reflect.apply(originalFetch, this, arguments);
        };
    }

    try {
        const xhrPrototype = pageWindow.XMLHttpRequest?.prototype;
        if (xhrPrototype) {
            const originalOpen = xhrPrototype.open;
            const originalSetRequestHeader = xhrPrototype.setRequestHeader;
            const originalSend = xhrPrototype.send;

            xhrPrototype.open = function (...args) {
                this[XHR_URL_KEY] = readRequestUrl(args[1]);
                if (isSpicyApiUrl(this[XHR_URL_KEY])) rememberApiAccess(this[XHR_URL_KEY]);
                return Reflect.apply(originalOpen, this, args);
            };

            xhrPrototype.setRequestHeader = function (name, value) {
                if (isSpicyApiUrl(this[XHR_URL_KEY])) {
                    rememberApiAccess(this[XHR_URL_KEY], { [name]: value });
                }
                return Reflect.apply(originalSetRequestHeader, this, arguments);
            };

            xhrPrototype.send = function (...args) {
                return Reflect.apply(originalSend, this, args);
            };
        }
    } catch (error) {
        console.debug('[Conversation Gallery] Не удалось подключиться к XHR.', error);
    }

    async function fetchHistoryPage(lastId = '') {
        if (!activeContext || !hasApiAccess()) {
            const error = new Error('Не удалось получить авторизацию SpicyChat.');
            error.code = 'NO_API_SESSION';
            throw error;
        }
        const query = new URLSearchParams({ limit: String(HISTORY_PAGE_SIZE) });
        if (lastId) query.set('last_id', lastId);
        const path = (
            `/characters/${encodeURIComponent(activeContext.characterId)}/messages/`
            + `${encodeURIComponent(activeContext.conversationId)}?${query}`
        );
        const endpoint = new URL(path, `${apiOrigin}/`).toString();
        const response = await Reflect.apply(originalFetch, pageWindow, [endpoint, {
            method: 'GET',
            headers: getRequestHeaders(),
            mode: 'cors',
            credentials: 'omit',
            [INTERNAL_RESPONSE_CONSUMER_FLAG]: true,
        }]);
        if (!response?.ok) {
            const details = await response?.text?.().catch(() => '');
            const suffix = String(details || '').replace(/\s+/g, ' ').trim().slice(0, 180);
            const error = new Error(
                `SpicyChat вернул HTTP ${response?.status || 0}${suffix ? `: ${suffix}` : ''}.`,
            );
            error.status = response?.status || 0;
            throw error;
        }
        const payload = await response.json();
        captureApiPayload(payload);
        return payload;
    }

    async function waitForApiAccess(state) {
        const startedAt = Date.now();
        while (!hasApiAccess() && Date.now() - startedAt < API_WAIT_TIMEOUT) {
            if (state.token !== scanToken) throw new Error('Операция отменена.');
            state.status = 'Жду авторизацию SpicyChat…';
            scheduleRender();
            await new Promise((resolve) => pageWindow.setTimeout(resolve, 160));
        }
        if (!hasApiAccess()) {
            const error = new Error('Не удалось поймать авторизацию SpicyChat за 8 секунд.');
            error.code = 'NO_API_SESSION';
            throw error;
        }
    }

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${GALLERY_ID}[hidden], #${VIEWER_ID}[hidden] { display: none !important; }

            #${GALLERY_ID} {
                position: fixed !important;
                inset: 0 !important;
                z-index: 10100 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 24px !important;
                background: rgba(0, 0, 0, 0.58) !important;
                backdrop-filter: blur(3px) !important;
                font-family: inherit !important;
            }

            .tm-sc-gallery-shell {
                box-sizing: border-box !important;
                display: flex !important;
                flex-direction: column !important;
                width: min(1180px, calc(100vw - 48px)) !important;
                height: min(840px, calc(100vh - 48px)) !important;
                min-height: 360px !important;
                overflow: hidden !important;
                color: #18181b !important;
                background: #ffffff !important;
                border: 1px solid rgba(17, 24, 39, 0.14) !important;
                border-radius: 18px !important;
                box-shadow: 0 28px 90px rgba(0, 0, 0, 0.48) !important;
            }

            .dark .tm-sc-gallery-shell {
                color: #f4f4f5 !important;
                background: #202023 !important;
                border-color: rgba(255, 255, 255, 0.13) !important;
            }

            .tm-sc-gallery-header {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 16px !important;
                padding: 16px 18px 13px !important;
                border-bottom: 1px solid rgba(113, 113, 122, 0.17) !important;
            }

            .tm-sc-gallery-heading {
                display: flex !important;
                align-items: baseline !important;
                gap: 9px !important;
                min-width: 0 !important;
            }

            .tm-sc-gallery-title {
                margin: 0 !important;
                color: inherit !important;
                font-size: 20px !important;
                line-height: 1.25 !important;
                font-weight: 700 !important;
            }

            .tm-sc-gallery-count {
                color: #71717a !important;
                font-size: 13px !important;
                font-variant-numeric: tabular-nums !important;
            }

            .dark .tm-sc-gallery-count { color: #a1a1aa !important; }

            .tm-sc-gallery-actions {
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
            }

            .tm-sc-gallery-refresh,
            .tm-sc-gallery-close {
                appearance: none !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 7px !important;
                height: 38px !important;
                color: inherit !important;
                background: rgba(113, 113, 122, 0.11) !important;
                border: 0 !important;
                border-radius: 10px !important;
                cursor: pointer !important;
                font-family: inherit !important;
                font-size: 13px !important;
                font-weight: 620 !important;
            }

            .tm-sc-gallery-refresh { padding: 0 12px !important; }
            .tm-sc-gallery-close { width: 38px !important; padding: 0 !important; }
            .tm-sc-gallery-refresh:hover, .tm-sc-gallery-close:hover {
                background: rgba(124, 58, 237, 0.17) !important;
            }

            .tm-sc-gallery-progress-area {
                padding: 11px 18px 12px !important;
                border-bottom: 1px solid rgba(113, 113, 122, 0.14) !important;
            }

            .tm-sc-gallery-progress-copy {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 12px !important;
                margin-bottom: 8px !important;
                color: #71717a !important;
                font-size: 12px !important;
                line-height: 1.3 !important;
            }

            .dark .tm-sc-gallery-progress-copy { color: #b4b4bd !important; }
            .tm-sc-gallery-status { overflow-wrap: anywhere !important; }
            .tm-sc-gallery-metrics {
                flex: 0 0 auto !important;
                font-variant-numeric: tabular-nums !important;
                white-space: nowrap !important;
            }

            .tm-sc-gallery-progress-track {
                position: relative !important;
                height: 6px !important;
                overflow: hidden !important;
                background: rgba(113, 113, 122, 0.18) !important;
                border-radius: 9999px !important;
            }

            .tm-sc-gallery-progress-track::after {
                content: "" !important;
                position: absolute !important;
                inset: 0 !important;
                z-index: 2 !important;
                pointer-events: none !important;
                background: repeating-linear-gradient(
                    to right,
                    transparent 0,
                    transparent calc(10% - 1px),
                    rgba(255, 255, 255, 0.34) calc(10% - 1px),
                    rgba(255, 255, 255, 0.34) 10%
                ) !important;
            }

            .tm-sc-gallery-progress-bar {
                position: absolute !important;
                inset: 0 auto 0 0 !important;
                z-index: 1 !important;
                width: 0 !important;
                background: linear-gradient(90deg, #7c3aed, #a78bfa) !important;
                border-radius: inherit !important;
                transition: width 260ms ease !important;
            }

            .tm-sc-gallery-progress-track.is-indeterminate .tm-sc-gallery-progress-bar {
                left: -38% !important;
                width: 38% !important;
                animation: tm-sc-gallery-progress 1.1s ease-in-out infinite !important;
            }

            .tm-sc-gallery-progress-track.is-complete .tm-sc-gallery-progress-bar {
                width: 100% !important;
                background: #22c55e !important;
            }

            .tm-sc-gallery-content {
                position: relative !important;
                flex: 1 1 auto !important;
                min-height: 0 !important;
                overflow: auto !important;
                overscroll-behavior: contain !important;
                padding: 14px !important;
            }

            .tm-sc-gallery-grid {
                display: grid !important;
                grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)) !important;
                gap: 11px !important;
                align-items: start !important;
            }

            .tm-sc-gallery-tile {
                appearance: none !important;
                position: relative !important;
                box-sizing: border-box !important;
                display: block !important;
                width: 100% !important;
                padding: 0 !important;
                overflow: hidden !important;
                background: #e4e4e7 !important;
                border: 1px solid rgba(113, 113, 122, 0.2) !important;
                border-radius: 11px !important;
                cursor: zoom-in !important;
                aspect-ratio: 500 / 650 !important;
                transition: transform 130ms ease, border-color 130ms ease, box-shadow 130ms ease !important;
            }

            .dark .tm-sc-gallery-tile { background: #303036 !important; }
            .tm-sc-gallery-tile:hover {
                z-index: 1 !important;
                transform: translateY(-2px) !important;
                border-color: rgba(139, 92, 246, 0.72) !important;
                box-shadow: 0 9px 24px rgba(0, 0, 0, 0.24) !important;
            }

            .tm-sc-gallery-tile img {
                display: block !important;
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
                background: inherit !important;
            }

            .tm-sc-gallery-tile-badge {
                position: absolute !important;
                right: 7px !important;
                bottom: 7px !important;
                max-width: calc(100% - 14px) !important;
                overflow: hidden !important;
                padding: 4px 6px !important;
                color: #ffffff !important;
                background: rgba(17, 24, 39, 0.72) !important;
                border-radius: 6px !important;
                font-size: 10.5px !important;
                line-height: 1.1 !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
                pointer-events: none !important;
            }

            .tm-sc-gallery-empty {
                position: absolute !important;
                inset: 0 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 30px !important;
                color: #71717a !important;
                font-size: 14px !important;
                text-align: center !important;
                pointer-events: none !important;
            }

            .tm-sc-gallery-empty[hidden] { display: none !important; }

            .dark .tm-sc-gallery-empty { color: #a1a1aa !important; }

            #${VIEWER_ID} {
                position: fixed !important;
                inset: 0 !important;
                z-index: 10120 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 24px 84px !important;
                background: rgba(0, 0, 0, 0.91) !important;
                backdrop-filter: blur(5px) !important;
            }

            .tm-sc-gallery-viewer-image {
                display: block !important;
                max-width: min(1200px, calc(100vw - 170px)) !important;
                max-height: calc(100vh - 70px) !important;
                object-fit: contain !important;
                border-radius: 8px !important;
                box-shadow: 0 22px 76px rgba(0, 0, 0, 0.62) !important;
                opacity: 1 !important;
                transition: opacity 150ms ease !important;
            }

            #${VIEWER_ID}.is-loading .tm-sc-gallery-viewer-image,
            #${VIEWER_ID}.is-error .tm-sc-gallery-viewer-image { opacity: 0 !important; }

            .tm-sc-gallery-viewer-state {
                position: fixed !important;
                left: 50% !important;
                top: 50% !important;
                display: none !important;
                transform: translate(-50%, -50%) !important;
                padding: 9px 12px !important;
                color: #ffffff !important;
                background: rgba(39, 39, 42, 0.82) !important;
                border: 1px solid rgba(255, 255, 255, 0.16) !important;
                border-radius: 9px !important;
                font-size: 13px !important;
                pointer-events: none !important;
            }

            #${VIEWER_ID}.is-loading .tm-sc-gallery-viewer-state,
            #${VIEWER_ID}.is-error .tm-sc-gallery-viewer-state { display: block !important; }

            .tm-sc-gallery-viewer-close,
            .tm-sc-gallery-viewer-nav {
                appearance: none !important;
                position: fixed !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: #ffffff !important;
                background: rgba(39, 39, 42, 0.72) !important;
                border: 1px solid rgba(255, 255, 255, 0.18) !important;
                cursor: pointer !important;
                backdrop-filter: blur(4px) !important;
            }

            .tm-sc-gallery-viewer-close {
                top: 18px !important;
                right: 18px !important;
                width: 42px !important;
                height: 42px !important;
                border-radius: 12px !important;
            }

            .tm-sc-gallery-viewer-nav {
                top: 50% !important;
                width: 52px !important;
                height: 72px !important;
                transform: translateY(-50%) !important;
                border-radius: 14px !important;
            }

            .tm-sc-gallery-viewer-nav.is-prev { left: 18px !important; }
            .tm-sc-gallery-viewer-nav.is-next { right: 18px !important; }
            .tm-sc-gallery-viewer-nav:hover,
            .tm-sc-gallery-viewer-close:hover { background: rgba(124, 58, 237, 0.78) !important; }
            .tm-sc-gallery-viewer-nav:disabled { opacity: 0.28 !important; cursor: default !important; }

            .tm-sc-gallery-viewer-counter {
                position: fixed !important;
                left: 50% !important;
                bottom: 17px !important;
                transform: translateX(-50%) !important;
                padding: 6px 10px !important;
                color: #ffffff !important;
                background: rgba(17, 24, 39, 0.76) !important;
                border-radius: 8px !important;
                font-size: 12px !important;
                font-variant-numeric: tabular-nums !important;
            }

            @keyframes tm-sc-gallery-progress {
                from { transform: translateX(0); }
                to { transform: translateX(365%); }
            }
        `;
        document.head.appendChild(style);
    }

    function cloneMenuButton(template) {
        const button = runtime.dom.cloneMenuButton(template);
        button.classList.remove(BOOKMARK_MENU_ITEM_CLASS, MENU_ITEM_CLASS);
        button.classList.add(MENU_ITEM_CLASS);
        button.removeAttribute('target');
        button.disabled = false;
        button.type = 'button';
        button.setAttribute('aria-label', 'Галерея');

        const oldIcon = button.querySelector('svg');
        if (oldIcon) oldIcon.outerHTML = icons.gallery;
        else button.insertAdjacentHTML('afterbegin', icons.gallery);

        const labels = Array.from(button.querySelectorAll('p, span'));
        if (labels[0]) labels[0].textContent = 'Галерея';
        for (const extra of labels.slice(1)) extra.remove();
        return button;
    }

    function findChatMenu(dropdown) {
        return runtime.dom.chatMenu(dropdown);
    }

    function normalizeCustomChatMenuOrder(menu) {
        const desired = CHAT_MENU_ITEM_ORDER
            .map((className) => menu.querySelector(`.${className}`))
            .filter(Boolean);
        if (!desired.length) return;

        const currentPrefix = Array.from(menu.children).slice(0, desired.length);
        if (desired.every((item, index) => currentPrefix[index] === item)) return;

        const firstNative = Array.from(menu.children).find((item) => (
            !CHAT_MENU_ITEM_ORDER.some((className) => item.classList.contains(className))
        )) || null;
        for (const item of desired) menu.insertBefore(item, firstNative);
    }

    function ensureChatMenuItem() {
        for (const dropdown of document.querySelectorAll(CHAT_DROPDOWN_SELECTOR)) {
            const menu = findChatMenu(dropdown);
            if (!menu) continue;

            let button = menu.querySelector(`.${MENU_ITEM_CLASS}`);
            if (!button) {
                const template = (
                    menu.querySelector(`.${BOOKMARK_MENU_ITEM_CLASS}`)
                    || menu.querySelector('button[aria-label="View Saved Chats" i]')
                    || menu.querySelector('button, [role="menuitem"]')
                );
                if (!template) continue;

                button = cloneMenuButton(template);
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    galleryAnchor = dropdown;
                    dropdown.click();
                    window.setTimeout(() => openGallery(dropdown), 0);
                });
                menu.insertBefore(button, menu.firstElementChild);
            }

            normalizeCustomChatMenuOrder(menu);
        }
    }

    function ensureGallery() {
        if (galleryOverlay?.isConnected) return galleryOverlay;
        galleryOverlay = document.createElement('div');
        galleryOverlay.id = GALLERY_ID;
        galleryOverlay.hidden = true;
        galleryOverlay.innerHTML = `
            <section class="tm-sc-gallery-shell" role="dialog" aria-modal="true" aria-labelledby="tm-sc-gallery-title">
                <header class="tm-sc-gallery-header">
                    <div class="tm-sc-gallery-heading">
                        <h2 id="tm-sc-gallery-title" class="tm-sc-gallery-title">Галерея</h2>
                        <span class="tm-sc-gallery-count"></span>
                    </div>
                    <div class="tm-sc-gallery-actions">
                        <button class="tm-sc-gallery-refresh" type="button">${icons.refresh}<span>Обновить</span></button>
                        <button class="tm-sc-gallery-close" type="button" aria-label="Закрыть">${icons.close}</button>
                    </div>
                </header>
                <div class="tm-sc-gallery-progress-area">
                    <div class="tm-sc-gallery-progress-copy">
                        <span class="tm-sc-gallery-status" aria-live="polite">Готово к сканированию</span>
                        <span class="tm-sc-gallery-metrics"></span>
                    </div>
                    <div class="tm-sc-gallery-progress-track" role="progressbar" aria-label="Загрузка истории">
                        <div class="tm-sc-gallery-progress-bar"></div>
                    </div>
                </div>
                <div class="tm-sc-gallery-content">
                    <div class="tm-sc-gallery-grid"></div>
                    <div class="tm-sc-gallery-empty">Пока изображений нет</div>
                </div>
            </section>
        `;

        galleryGrid = galleryOverlay.querySelector('.tm-sc-gallery-grid');
        galleryEmpty = galleryOverlay.querySelector('.tm-sc-gallery-empty');
        galleryCount = galleryOverlay.querySelector('.tm-sc-gallery-count');
        galleryStatus = galleryOverlay.querySelector('.tm-sc-gallery-status');
        galleryMetrics = galleryOverlay.querySelector('.tm-sc-gallery-metrics');
        galleryProgressBar = galleryOverlay.querySelector('.tm-sc-gallery-progress-bar');
        galleryProgressTrack = galleryOverlay.querySelector('.tm-sc-gallery-progress-track');
        galleryRefreshButton = galleryOverlay.querySelector('.tm-sc-gallery-refresh');

        galleryOverlay.querySelector('.tm-sc-gallery-close').addEventListener('click', () => closeGallery());
        galleryRefreshButton.addEventListener('click', () => void startGalleryScan({ reset: true }));
        galleryOverlay.addEventListener('pointerdown', (event) => {
            if (event.target === galleryOverlay) closeGallery();
        });
        document.body.appendChild(galleryOverlay);
        return galleryOverlay;
    }

    function ensureViewer() {
        if (viewerOverlay?.isConnected) return viewerOverlay;
        viewerOverlay = document.createElement('div');
        viewerOverlay.id = VIEWER_ID;
        viewerOverlay.hidden = true;
        viewerOverlay.innerHTML = `
            <button class="tm-sc-gallery-viewer-close" type="button" aria-label="Закрыть">${icons.close}</button>
            <button class="tm-sc-gallery-viewer-nav is-prev" type="button" aria-label="Предыдущее изображение">${icons.left}</button>
            <img class="tm-sc-gallery-viewer-image" alt="Изображение из диалога">
            <button class="tm-sc-gallery-viewer-nav is-next" type="button" aria-label="Следующее изображение">${icons.right}</button>
            <div class="tm-sc-gallery-viewer-state" aria-live="polite">Загрузка изображения…</div>
            <div class="tm-sc-gallery-viewer-counter"></div>
        `;

        viewerImage = viewerOverlay.querySelector('.tm-sc-gallery-viewer-image');
        viewerCounter = viewerOverlay.querySelector('.tm-sc-gallery-viewer-counter');
        viewerState = viewerOverlay.querySelector('.tm-sc-gallery-viewer-state');
        viewerOverlay.querySelector('.tm-sc-gallery-viewer-close').addEventListener('click', closeViewer);
        viewerOverlay.querySelector('.is-prev').addEventListener('click', () => navigateViewer(-1));
        viewerOverlay.querySelector('.is-next').addEventListener('click', () => navigateViewer(1));
        viewerOverlay.addEventListener('pointerdown', (event) => {
            if (event.target === viewerOverlay) closeViewer();
        });
        document.body.appendChild(viewerOverlay);
        return viewerOverlay;
    }

    function getSortedGalleryEntries() {
        return Array.from(galleryImages.values()).sort((a, b) => (
            (b.createdAt - a.createdAt)
            || (b.domOrder - a.domOrder)
            || (b.discoveredAt - a.discoveredAt)
            || a.key.localeCompare(b.key)
        ));
    }

    function createTile(entry) {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'tm-sc-gallery-tile';
        tile.dataset.imageKey = entry.key;
        tile.innerHTML = `
            <img loading="lazy" decoding="async" alt="Изображение из диалога">
            <span class="tm-sc-gallery-tile-badge"></span>
        `;
        tile.addEventListener('click', () => openViewer(tile.dataset.imageKey));
        return tile;
    }

    function setTextIfChanged(element, text) {
        if (element && element.textContent !== text) element.textContent = text;
    }

    function renderGallery() {
        renderScheduled = false;
        if (!galleryOverlay?.isConnected) return;

        const sorted = getSortedGalleryEntries();
        const desiredKeys = new Set(sorted.map((entry) => entry.key));
        for (const [key, tile] of tileByKey) {
            if (desiredKeys.has(key)) continue;
            tile.remove();
            tileByKey.delete(key);
        }

        for (const [index, entry] of sorted.entries()) {
            let tile = tileByKey.get(entry.key);
            if (!tile) {
                tile = createTile(entry);
                tileByKey.set(entry.key, tile);
            }

            const image = tile.querySelector('img');
            const badge = tile.querySelector('.tm-sc-gallery-tile-badge');
            if (image.getAttribute('src') !== entry.previewUrl) image.src = entry.previewUrl;
            const dateLabel = formatMoscowDateTime(entry.createdAt);
            const badgeLabel = dateLabel || (entry.isAlternative ? 'Вариант ответа' : 'Изображение');
            const title = dateLabel ? `${dateLabel} по Москве` : 'Открыть изображение';
            setTextIfChanged(badge, badgeLabel);
            if (tile.title !== title) tile.title = title;

            const currentTile = galleryGrid.children[index] || null;
            if (currentTile !== tile) galleryGrid.insertBefore(tile, currentTile);
        }

        setTextIfChanged(galleryCount, sorted.length ? String(sorted.length) : '');
        galleryEmpty.hidden = sorted.length > 0;
        if (!sorted.length) {
            setTextIfChanged(galleryEmpty, scanState?.running
                ? 'Ищу изображения в истории…'
                : 'В этом диалоге изображения пока не найдены');
        }

        renderScanProgress();
        if (viewerOverlay && !viewerOverlay.hidden) refreshViewer();
    }

    function scheduleRender() {
        if (renderScheduled) return;
        renderScheduled = true;
        requestAnimationFrame(renderGallery);
    }

    function hydrateGalleryFromSources() {
        for (const [key, entry] of sourceImages) galleryImages.set(key, entry);
        scheduleRender();
    }

    function getDomMessageTimestamp(messageId, message) {
        const captured = messageMetaById.get(messageId)?.createdAt || 0;
        if (captured) return captured;
        const time = message.querySelector('time.tm-sc-message-sent-at[datetime]');
        return time ? normalizeTimestamp(time.dateTime) : 0;
    }

    function scanDomImages() {
        ensureContext();
        if (!activeContext) return;
        const messages = Array.from(document.querySelectorAll(MESSAGE_SELECTOR));

        messages.forEach((message, domOrder) => {
            const messageId = normalizeMessageId(message.id);
            if (!messageId) return;
            const meta = messageMetaById.get(messageId);
            const createdAt = getDomMessageTimestamp(messageId, message);

            for (const image of message.querySelectorAll('img')) {
                const normalized = normalizeConversationImageUrl(image.currentSrc || image.src);
                if (!normalized) continue;
                recordSourceImage({
                    normalized,
                    messageId,
                    conversationId: activeContext.conversationId,
                    createdAt,
                    isAlternative: meta?.isAlternative === true,
                    domOrder,
                    source: 'dom',
                });
            }
        });

        scheduleRender();
    }

    function openGallery(anchor) {
        ensureContext();
        if (!activeContext) return;
        ensureGallery();
        ensureViewer();
        galleryAnchor = anchor || galleryAnchor;
        galleryOverlay.hidden = false;
        hydrateGalleryFromSources();
        scanDomImages();
        void startGalleryScan({ reset: false });
    }

    function closeGallery(cancelLoading = true) {
        if (cancelLoading) invalidateScan();
        closeViewer();
        if (galleryOverlay) galleryOverlay.hidden = true;
    }

    function openViewer(key) {
        if (!galleryImages.has(key)) return;
        ensureViewer();
        viewerCurrentKey = key;
        viewerOverlay.hidden = false;
        refreshViewer();
    }

    function closeViewer() {
        viewerLoadToken += 1;
        if (viewerLoader) {
            viewerLoader.onload = null;
            viewerLoader.onerror = null;
            viewerLoader = null;
        }
        viewerCurrentKey = null;
        if (viewerImage) {
            viewerImage.removeAttribute('src');
            delete viewerImage.dataset.imageKey;
            delete viewerImage.dataset.targetUrl;
            delete viewerImage.dataset.fallback;
        }
        if (viewerOverlay) {
            viewerOverlay.classList.remove('is-loading', 'is-error');
            viewerOverlay.hidden = true;
        }
    }

    function loadViewerEntry(entry) {
        const token = ++viewerLoadToken;
        if (viewerLoader) {
            viewerLoader.onload = null;
            viewerLoader.onerror = null;
        }

        viewerImage.removeAttribute('src');
        viewerImage.dataset.imageKey = entry.key;
        viewerImage.dataset.targetUrl = entry.fullUrl;
        viewerImage.dataset.fallback = 'false';
        viewerOverlay.classList.remove('is-error');
        viewerOverlay.classList.add('is-loading');
        viewerState.textContent = 'Загрузка изображения…';

        const attempt = (url, isFallback) => {
            if (token !== viewerLoadToken || viewerCurrentKey !== entry.key) return;
            const loader = new pageWindow.Image();
            viewerLoader = loader;
            loader.onload = () => {
                if (token !== viewerLoadToken || viewerCurrentKey !== entry.key) return;
                viewerLoader = null;
                viewerImage.dataset.fallback = String(isFallback);
                viewerImage.src = url;
                viewerOverlay.classList.remove('is-loading', 'is-error');
            };
            loader.onerror = () => {
                if (token !== viewerLoadToken || viewerCurrentKey !== entry.key) return;
                viewerLoader = null;
                if (!isFallback && entry.previewUrl && entry.previewUrl !== url) {
                    attempt(entry.previewUrl, true);
                    return;
                }
                viewerOverlay.classList.remove('is-loading');
                viewerOverlay.classList.add('is-error');
                viewerState.textContent = 'Не удалось загрузить изображение';
            };
            loader.src = url;
        };

        attempt(entry.fullUrl, false);
    }

    function refreshViewer() {
        if (!viewerOverlay || viewerOverlay.hidden || !viewerCurrentKey) return;
        const sorted = getSortedGalleryEntries();
        const index = sorted.findIndex((entry) => entry.key === viewerCurrentKey);
        if (index < 0) {
            closeViewer();
            return;
        }

        const entry = sorted[index];
        const currentRequestMatches = (
            viewerImage.dataset.imageKey === entry.key
            && viewerImage.dataset.targetUrl === entry.fullUrl
        );
        if (!currentRequestMatches) loadViewerEntry(entry);
        viewerCounter.textContent = `${index + 1} / ${sorted.length}`;
        viewerOverlay.querySelector('.is-prev').disabled = sorted.length < 2;
        viewerOverlay.querySelector('.is-next').disabled = sorted.length < 2;
    }

    function navigateViewer(direction) {
        const sorted = getSortedGalleryEntries();
        if (sorted.length < 2 || !viewerCurrentKey) return;
        const currentIndex = sorted.findIndex((entry) => entry.key === viewerCurrentKey);
        if (currentIndex < 0) return;
        const nextIndex = (currentIndex + direction + sorted.length) % sorted.length;
        viewerCurrentKey = sorted[nextIndex].key;
        refreshViewer();
    }

    function getLoadedMessageIds() {
        return Array.from(document.querySelectorAll(MESSAGE_SELECTOR), (message) => message.id).filter(Boolean);
    }

    function invalidateScan() {
        scanToken += 1;
        const previous = scanState;
        if (previous) previous.running = false;
        scanState = null;
        scheduleRender();
        return scanToken;
    }

    function getProgressPercent() {
        if (!totalApiRecordCount || totalApiRecordCount <= 0) return null;
        const rawPercent = Math.min(100, (capturedMessageIds.size / totalApiRecordCount) * 100);
        return rawPercent >= 100 ? 100 : Math.floor(rawPercent / 10) * 10;
    }

    function renderScanProgress() {
        if (!galleryProgressTrack) return;
        const percent = getProgressPercent();
        const state = scanState;
        const running = state?.running === true;
        const complete = state?.statusType === 'complete';

        galleryProgressTrack.classList.toggle('is-indeterminate', running && percent === null);
        galleryProgressTrack.classList.toggle('is-complete', complete);
        if (complete) galleryProgressBar.style.setProperty('width', '100%', 'important');
        else if (percent !== null) galleryProgressBar.style.setProperty('width', `${percent}%`, 'important');
        else if (!running) galleryProgressBar.style.setProperty('width', '0%', 'important');
        else galleryProgressBar.style.removeProperty('width');

        galleryProgressTrack.setAttribute('aria-valuemin', '0');
        galleryProgressTrack.setAttribute('aria-valuemax', '100');
        if (percent !== null) galleryProgressTrack.setAttribute('aria-valuenow', String(complete ? 100 : percent));
        else galleryProgressTrack.removeAttribute('aria-valuenow');

        setTextIfChanged(galleryStatus, state?.status || 'Готово к сканированию');
        const loadedMessages = Math.max(
            new Set(getLoadedMessageIds()).size,
            capturedMessageIds.size,
        );
        const displayedPercent = complete ? 100 : percent;
        const progressLabel = displayedPercent === null ? '' : ` · прогресс: ${displayedPercent}%`;
        const batches = state?.batches || 0;
        setTextIfChanged(galleryMetrics, (
            `Изображений: ${galleryImages.size} · `
            + `сообщений загружено: ${loadedMessages}`
            + progressLabel
            + ' · '
            + `пачек: ${batches}`
        ));
    }

    async function startGalleryScan({ reset }) {
        ensureContext();
        if (!activeContext) return;
        ensureGallery();
        const token = invalidateScan();
        const state = {
            token,
            running: true,
            statusType: 'loading',
            status: reset ? 'Очищаю галерею и запускаю новый скан…' : 'Проверяю загруженные сообщения…',
            batches: 0,
        };
        scanState = state;

        if (reset) {
            closeViewer();
            galleryImages.clear();
            tileByKey.clear();
            galleryGrid?.replaceChildren();
            renderGallery();
            await new Promise((resolve) => requestAnimationFrame(resolve));
            if (token !== scanToken) return;
        }

        hydrateGalleryFromSources();
        scanDomImages();
        scheduleRender();

        try {
            await waitForApiAccess(state);
            if (state.token !== scanToken) return;
            let lastId = '';
            for (let page = 0; page < MAX_HISTORY_PAGES && state.token === scanToken; page += 1) {
                state.status = `Загружаю пачку ${page + 1}…`;
                scheduleRender();

                const beforeCount = capturedMessageIds.size;
                const payload = await fetchHistoryPage(lastId);
                if (state.token !== scanToken) return;
                const batch = Array.isArray(payload?.messages) ? payload.messages : [];
                const added = Math.max(0, capturedMessageIds.size - beforeCount);
                state.batches = page + 1;
                hydrateGalleryFromSources();
                state.status = 'Пачка загружена. Галерея обновлена';
                scheduleRender();

                if (batch.length < HISTORY_PAGE_SIZE || !added) break;
                const nextLastId = normalizeMessageId(batch.at(-1)?.id);
                if (!nextLastId || nextLastId === lastId) break;
                lastId = nextLastId;
                await new Promise((resolve) => pageWindow.setTimeout(resolve, 0));
            }

            if (state.token !== scanToken) return;
            state.running = false;
            state.statusType = 'complete';
            state.status = 'Вся доступная история проверена';
            scheduleRender();
        } catch (error) {
            console.error('[Conversation Gallery] Ошибка сканирования истории.', error);
            if (state.token === scanToken) {
                state.running = false;
                state.statusType = 'paused';
                state.status = error?.code === 'NO_API_SESSION'
                    ? 'Не удалось получить авторизацию SpicyChat. Обнови страницу и повтори'
                    : `Ошибка сканирования: ${error?.message || 'неизвестная ошибка'}`;
                scheduleRender();
            }
        }
    }

    function isOwnGalleryMutation(target) {
        const element = target?.nodeType === 1 ? target : target?.parentElement;
        return Boolean(element?.closest?.(`#${GALLERY_ID}, #${VIEWER_ID}`));
    }

    let visibleMessagesDirty = false;

    function scheduleEnsure(scanVisibleMessages = false) {
        visibleMessagesDirty ||= scanVisibleMessages;
        if (ensureScheduled) return;
        ensureScheduled = true;
        requestAnimationFrame(() => {
            const shouldScan = visibleMessagesDirty;
            visibleMessagesDirty = false;
            runDomPass(shouldScan);
        });
    }

    function nodeTouchesGallerySurface(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return { relevant: false, messages: false };
        if (node.closest?.(`#${GALLERY_ID}, #${VIEWER_ID}`)) return { relevant: false, messages: false };

        const menuSelector = `${CHAT_DROPDOWN_SELECTOR}, button[aria-label="View Saved Chats" i]`;
        const isMessageImage = Boolean(node.closest?.(MESSAGE_SELECTOR)) && (
            node.matches?.('img') || Boolean(node.querySelector?.('img'))
        );
        const messages = Boolean(
            node.matches?.(MESSAGE_SELECTOR)
            || isMessageImage
            || node.querySelector?.(MESSAGE_SELECTOR)
        );
        const menu = Boolean(node.matches?.(menuSelector) || node.querySelector?.(menuSelector));
        return { relevant: messages || menu, messages };
    }

    function handleRootMutations(records) {
        let relevant = false;
        let messages = false;
        for (const record of records) {
            if (isOwnGalleryMutation(record.target)) continue;
            const nodes = [record.target, ...record.addedNodes, ...record.removedNodes];
            for (const node of nodes) {
                const result = nodeTouchesGallerySurface(node);
                relevant ||= result.relevant;
                messages ||= result.messages;
                if (relevant && messages) break;
            }
            if (relevant && messages) break;
        }
        if (relevant) scheduleEnsure(messages);
    }

    function handleKeydown(event) {
        if (viewerOverlay && !viewerOverlay.hidden) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeViewer();
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                navigateViewer(-1);
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                navigateViewer(1);
            }
            return;
        }

        if (galleryOverlay && !galleryOverlay.hidden && event.key === 'Escape') {
            event.preventDefault();
            closeGallery();
        }
    }

    function scheduleRetry() {
        if (retryTimer) return;
        const delay = retryDelay;
        retryDelay = Math.min(8000, retryDelay * 2);
        retryTimer = window.setTimeout(() => {
            retryTimer = null;
            runDomPass(false);
        }, delay);
    }

    function resetRetry() {
        if (retryTimer) window.clearTimeout(retryTimer);
        retryTimer = null;
        retryDelay = 250;
    }

    function runDomPass(scanVisibleMessages = false) {
        ensureScheduled = false;
        if (!document.documentElement || !document.head || !document.body) return;

        try {
            addStyles();
            ensureContext();
            ensureGallery();
            ensureViewer();
            ensureChatMenuItem();
            if (scanVisibleMessages && galleryOverlay && !galleryOverlay.hidden) scanDomImages();

            if (!rootObserver) {
                rootObserver = new MutationObserver(handleRootMutations);
                rootObserver.observe(document.documentElement, { childList: true, subtree: true });
            }
            window.addEventListener('keydown', handleKeydown, true);
            resetRetry();
        } catch (error) {
            rootObserver?.disconnect();
            rootObserver = null;
            window.removeEventListener('keydown', handleKeydown, true);
            console.error('[Conversation Gallery] DOM-инициализация сорвалась, повторю автоматически.', error);
            scheduleRetry();
        }
    }

    function startDomFeatures() {
        runDomPass();
    }

    function cleanup() {
        invalidateScan();
        rootObserver?.disconnect();
        rootObserver = null;
        ensureScheduled = false;
        visibleMessagesDirty = false;
        resetRetry();
        window.removeEventListener('keydown', handleKeydown, true);
    }

    installRouteChangeSignal();
    window.addEventListener('pagehide', cleanup);
    window.addEventListener(ROUTE_CHANGE_EVENT, startDomFeatures);
    window.addEventListener('pageshow', startDomFeatures);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) startDomFeatures();
    });
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startDomFeatures, { once: true });
    }
    startDomFeatures();
    runtime.dom?.subscribe(scheduleEnsure);

}


// ---- src/modules/branches.js ----

// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
function init_branches(runtime) {
    'use strict';

    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const INSTANCE_KEY = '__spicyChatChatBranchesV1';
    if (pageWindow[INSTANCE_KEY]) return;
    pageWindow[INSTANCE_KEY] = true;

    const STORAGE_PREFIX = 'tm-sc-chat-branches-v1:bot:';
    const STYLE_ID = 'tm-sc-chat-branches-style';
    const DIALOG_ID = 'tm-sc-chat-branches-dialog';
    const EDITOR_ID = 'tm-sc-chat-branches-editor';
    const POPOVER_ID = 'tm-sc-chat-branches-popover';
    const MENU_ITEM_CLASS = 'tm-sc-open-chat-branches';
    const SAVED_PAGE_BUTTON_CLASS = 'tm-sc-open-saved-chat-branches';
    const MARKER_CLASS = 'tm-sc-chat-branch-marker';
    const CHAT_DROPDOWN_SELECTOR = 'button[aria-label="chat-dropdown" i]';
    const MESSAGE_DROPDOWN_SELECTOR = 'button[aria-label="message-dropdown" i]';
    const MESSAGE_SELECTOR = 'div[id^="message-"]';
    const XHR_META_KEY = '__tmScChatBranchesMeta';
    const INTERNAL_RESPONSE_CONSUMER_FLAG = '__tmScConsumesJsonResponse';
    const ROUTE_CHANGE_EVENT = 'tm-sc-route-change';
    const TITLE_MAX_LENGTH = 80;
    const HISTORY_PAGE_SIZE = 50;
    const MAX_GRAPH_CACHE_SIZE = 8;
    const CHAT_MENU_ITEM_ORDER = [
        'tm-sc-open-message-bookmarks',
        'tm-sc-open-conversation-gallery',
        'tm-sc-open-gpt-summary',
        'tm-sc-open-chat-branches',
    ];
    const API_HEADER_NAMES = new Set([
        'authorization',
        'x-guest-userid',
        'x-country',
        'x-app-id',
        'x-app-version',
        'x-platform',
        'x-platform-os',
        'accept-language',
    ]);

    const graphCache = new Map();
    const historyCache = new Map();
    let storageQueue = Promise.resolve();
    let activeContext = null;
    let activeGraph = null;
    let contextToken = 0;
    let ensureScheduled = false;
    let domLifecycleToken = 0;
    let rootObserver = null;
    let retryTimer = null;
    let retryDelay = 250;
    let savedPageButton = null;

    let apiNativeFetch = null;
    let apiOrigin = '';
    const apiHeaders = new Map();
    let relationScan = null;
    let relationScanStarting = false;
    let autoScanTimer = null;

    let dialog = null;
    let dialogTree = null;
    let dialogCount = null;
    let dialogSearch = null;
    let dialogEmpty = null;
    let dialogAnchor = null;
    let dialogScanButton = null;
    let dialogScanStatus = null;
    let dialogScanStatusText = null;
    let dialogScanProgress = null;

    let editor = null;
    let editorInput = null;
    let editorState = null;

    let markerPopover = null;
    let markerPopoverMarker = null;
    let markerPopoverCloseTimer = null;
    let markerPopoverPinned = false;

    const moscowDateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });

    const icons = {
        branches: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <circle cx="6" cy="5" r="3"></circle><circle cx="18" cy="6" r="3"></circle>
                <circle cx="6" cy="19" r="3"></circle>
                <path d="M6 8v8"></path><path d="M9 19h2a7 7 0 0 0 7-7V9"></path>
            </svg>`,
        branchSmall: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round">
                <circle cx="6" cy="5" r="2"></circle><circle cx="18" cy="6" r="2"></circle>
                <circle cx="6" cy="19" r="2"></circle>
                <path d="M6 7v10"></path><path d="M8 19h3a7 7 0 0 0 7-7V8"></path>
            </svg>`,
        close: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="m18 6-12 12"></path><path d="m6 6 12 12"></path>
            </svg>`,
        search: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path>
            </svg>`,
        messages: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="13" height="13"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"></path>
                <path d="M13 8H7"></path><path d="M17 12H7"></path>
            </svg>`,
        refresh: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"></path>
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"></path>
            </svg>`,
        pencil: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
            </svg>`,
        unlink: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="m5.17 11.75-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                <path d="m8 2 8 20"></path>
            </svg>`,
        chevron: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="m9 18 6-6-6-6"></path>
            </svg>`,
        root: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="2"></circle>
            </svg>`,
        full: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2"></rect>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
            </svg>`,
        partial: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 3v12"></path><circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="6" r="3"></circle><path d="M9 15h2a7 7 0 0 0 7-7"></path>
            </svg>`,
        orphan: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"></circle><path d="M9.5 9a2.6 2.6 0 1 1 4.5 1.8c-1 .8-2 1.3-2 2.7"></path>
                <path d="M12 17h.01"></path>
            </svg>`,
    };

    function getChatContext() {
        const parts = location.pathname.split('/').filter(Boolean);
        const chatIndex = parts.findIndex((part) => part === 'chat' || part === 'story');
        if (chatIndex < 0 || !parts[chatIndex + 1]) {
            if (parts[0] !== 'chats' || !parts[1]) return null;
            const characterId = parts[1];
            return {
                characterId,
                conversationId: '',
                routeType: 'chat',
                pageType: 'saved',
                key: `${characterId}:saved`,
            };
        }

        const characterId = parts[chatIndex + 1];
        const conversationId = parts[chatIndex + 2] || '';
        return {
            characterId,
            conversationId,
            routeType: parts[chatIndex],
            pageType: 'chat',
            key: `${characterId}:${conversationId}`,
        };
    }

    function installRouteChangeSignal() {
        const key = '__tmScRouteChangeSignalV1';
        if (pageWindow[key]) return;
        const dispatch = () => pageWindow.dispatchEvent(new pageWindow.Event(ROUTE_CHANGE_EVENT));
        for (const method of ['pushState', 'replaceState']) {
            const original = pageWindow.history?.[method];
            if (typeof original !== 'function') continue;
            pageWindow.history[method] = function (...args) {
                const result = Reflect.apply(original, this, args);
                dispatch();
                return result;
            };
        }
        pageWindow.addEventListener('popstate', dispatch);
        pageWindow.addEventListener('hashchange', dispatch);
        pageWindow[key] = true;
    }

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

    function parseJsonBody(body) {
        if (!body) return null;
        if (typeof body === 'object' && !(body instanceof pageWindow.FormData)) return body;
        if (typeof body !== 'string') return null;
        try {
            return JSON.parse(body);
        } catch (_error) {
            return null;
        }
    }

    function headerEntries(source) {
        if (!source) return [];
        const entries = [];
        try {
            if (typeof source.forEach === 'function') {
                source.forEach((value, name) => entries.push([name, value]));
                return entries;
            }
            if (Array.isArray(source)) return source;
            if (typeof source === 'object') return Object.entries(source);
        } catch (_error) {
            return [];
        }
        return entries;
    }

    function rememberApiAccess(rawUrl, ...headerSources) {
        if (!isSpicyApiUrl(rawUrl)) return;
        try {
            apiOrigin = new URL(rawUrl, location.href).origin;
        } catch (_error) {
            return;
        }

        for (const source of headerSources) {
            for (const [rawName, rawValue] of headerEntries(source)) {
                const name = String(rawName || '').toLowerCase();
                if (!API_HEADER_NAMES.has(name) || rawValue === undefined || rawValue === null) continue;
                apiHeaders.set(name, String(rawValue));
            }
        }
    }

    function hasApiAccess() {
        return Boolean(apiNativeFetch && apiOrigin && apiHeaders.get('authorization'));
    }

    function normalizeTimestamp(value) {
        if (value === null || value === undefined || value === '') return 0;
        let timestamp = Number(value);
        if (!Number.isFinite(timestamp) && typeof value === 'string') timestamp = Date.parse(value);
        if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
        return timestamp < 100000000000 ? timestamp * 1000 : timestamp;
    }

    function normalizeTitle(value, fallback = 'Чат без названия') {
        const title = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
        return (title || fallback).slice(0, TITLE_MAX_LENGTH);
    }

    function formatMoscowDateTime(timestamp) {
        if (!timestamp) return '';
        try {
            return moscowDateTimeFormatter.format(new Date(timestamp));
        } catch (_error) {
            return '';
        }
    }

    function makeDefaultTitle(kind, timestamp = Date.now()) {
        const date = formatMoscowDateTime(timestamp);
        if (kind === 'unlinked') return `Старый чат${date ? ` · ${date}` : ''}`;
        return `Новый сюжет${date ? ` · ${date}` : ''}`;
    }

    function storageKey(characterId) {
        return `${STORAGE_PREFIX}${characterId}`;
    }

    async function readValue(key, fallbackValue) {
        try {
            if (typeof GM_getValue === 'function') {
                const value = await Promise.resolve(GM_getValue(key, fallbackValue));
                return value === undefined ? fallbackValue : value;
            }
        } catch (error) {
            console.warn('[Chat Branches] Не удалось прочитать данные Tampermonkey.', error);
        }

        try {
            const raw = localStorage.getItem(key);
            return raw === null ? fallbackValue : JSON.parse(raw);
        } catch (_error) {
            return fallbackValue;
        }
    }

    async function writeValue(key, value) {
        if (typeof GM_setValue === 'function') {
            await Promise.resolve(GM_setValue(key, value));
            return;
        }
        localStorage.setItem(key, JSON.stringify(value));
    }

    function normalizeNode(value, characterId, index = 0) {
        if (!value || typeof value !== 'object') return null;
        const conversationId = typeof value.conversationId === 'string'
            ? value.conversationId.trim()
            : '';
        if (!conversationId) return null;

        const allowedKinds = new Set(['root', 'full', 'partial', 'unlinked']);
        const kind = allowedKinds.has(value.kind) ? value.kind : 'unlinked';
        const createdAt = normalizeTimestamp(value.createdAt) || (Date.now() - index);
        return {
            conversationId,
            characterId: typeof value.characterId === 'string' && value.characterId
                ? value.characterId
                : characterId,
            title: normalizeTitle(value.title, makeDefaultTitle(kind, createdAt)),
            parentId: typeof value.parentId === 'string' && value.parentId
                ? value.parentId
                : null,
            forkMessageId: typeof value.forkMessageId === 'string' && value.forkMessageId
                ? value.forkMessageId.replace(/^message-/, '')
                : null,
            forkExcerpt: typeof value.forkExcerpt === 'string'
                ? value.forkExcerpt.replace(/\s+/g, ' ').trim().slice(0, 180)
                : '',
            kind,
            createdAt,
            updatedAt: normalizeTimestamp(value.updatedAt) || createdAt,
            messageCount: Math.max(0, Number(value.messageCount) || 0),
            lastMessageId: typeof value.lastMessageId === 'string' ? value.lastMessageId : '',
            relationSource: ['captured', 'inferred'].includes(value.relationSource)
                ? value.relationSource
                : '',
            relationCheckedAt: normalizeTimestamp(value.relationCheckedAt),
            relationIgnored: value.relationIgnored === true,
        };
    }

    function normalizeGraph(value, characterId) {
        const rawNodes = Array.isArray(value?.nodes) ? value.nodes : [];
        const nodes = rawNodes
            .map((node, index) => normalizeNode(node, characterId, index))
            .filter(Boolean)
            .filter((node, index, array) => (
                array.findIndex((candidate) => candidate.conversationId === node.conversationId) === index
            ));
        const validIds = new Set(nodes.map((node) => node.conversationId));
        const collapsed = Array.isArray(value?.collapsed)
            ? [...new Set(value.collapsed.filter((id) => typeof id === 'string' && validIds.has(id)))]
            : [];

        return { version: 2, characterId, nodes, collapsed };
    }

    function setGraphCache(characterId, graph) {
        graphCache.delete(characterId);
        graphCache.set(characterId, graph);
        while (graphCache.size > MAX_GRAPH_CACHE_SIZE) {
            graphCache.delete(graphCache.keys().next().value);
        }
    }

    async function readGraph(characterId, fresh = false) {
        if (!fresh && graphCache.has(characterId)) return graphCache.get(characterId);
        const graph = normalizeGraph(
            await readValue(storageKey(characterId), null),
            characterId,
        );
        setGraphCache(characterId, graph);
        return graph;
    }

    function notifyGraphChanged(characterId, graph) {
        setGraphCache(characterId, graph);
        if (activeContext?.characterId !== characterId) return;
        activeGraph = graph;
        renderDialog();
        ensureBranchMarkers();
        scheduleAutomaticRelationScan();
    }

    function updateGraph(characterId, updater) {
        const operation = storageQueue.then(async () => {
            const latest = await readGraph(characterId, true);
            const draft = normalizeGraph(latest, characterId);
            const result = updater(draft) || draft;
            const next = normalizeGraph(result, characterId);
            await writeValue(storageKey(characterId), next);
            notifyGraphChanged(characterId, next);
            return next;
        });

        storageQueue = operation.catch(() => undefined);
        return operation;
    }

    function findNode(graph, conversationId) {
        return graph?.nodes.find((node) => node.conversationId === conversationId) || null;
    }

    function upsertNode(graph, data) {
        const index = graph.nodes.findIndex((node) => node.conversationId === data.conversationId);
        const previous = index >= 0 ? graph.nodes[index] : null;
        const merged = normalizeNode({
            ...(previous || {}),
            ...data,
            title: data.title || previous?.title,
            createdAt: data.createdAt || previous?.createdAt || Date.now(),
            updatedAt: Date.now(),
        }, data.characterId || graph.characterId);
        if (!merged) return null;
        if (index >= 0) graph.nodes[index] = merged;
        else graph.nodes.push(merged);
        return merged;
    }

    function getForkMetadata(messageId) {
        if (!messageId) return { forkExcerpt: '' };
        const message = document.getElementById(`message-${String(messageId).replace(/^message-/, '')}`);
        if (!message) return { forkExcerpt: '' };
        const textContainer = Array.from(message.querySelectorAll('[class]')).find((element) => (
            element.classList.contains('[overflow-wrap:anywhere]')
        ));
        const text = (textContainer?.innerText || textContainer?.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 180);
        return { forkExcerpt: text };
    }

    function classifyRequest(rawUrl, method) {
        if (!isSpicyApiUrl(rawUrl)) return { kind: 'other' };
        try {
            const url = new URL(rawUrl, location.href);
            const path = url.pathname.replace(/\/+$/, '');
            const normalizedMethod = String(method || 'GET').toUpperCase();

            if (normalizedMethod === 'POST' && /\/conversations\/clone$/i.test(path)) {
                return { kind: 'clone' };
            }

            const createMatch = path.match(/\/characters\/([^/]+)\/conversations$/i);
            if (normalizedMethod === 'POST' && createMatch) {
                return { kind: 'create', characterId: decodeURIComponent(createMatch[1]) };
            }

            const renameMatch = path.match(/\/conversations\/([^/]+)\/label$/i);
            if ((normalizedMethod === 'PATCH' || normalizedMethod === 'PUT') && renameMatch) {
                return { kind: 'rename', conversationId: decodeURIComponent(renameMatch[1]) };
            }

            const isConversationList = (
                normalizedMethod === 'GET'
                && /\/characters\/[^/]+\/conversations$/i.test(path)
            );
            const isSingleConversation = (
                normalizedMethod === 'GET'
                && /\/conversations\/[^/]+$/i.test(path)
            );
            return { kind: isConversationList || isSingleConversation ? 'conversations' : 'other' };
        } catch (_error) {
            return { kind: 'other' };
        }
    }

    function findResponseConversation(payload) {
        const visited = new WeakSet();
        let fallback = null;

        const walk = (value, depth) => {
            if (!value || typeof value !== 'object' || depth > 6 || visited.has(value)) return null;
            visited.add(value);

            if (!Array.isArray(value) && typeof value.id === 'string') {
                if (typeof value.character_id === 'string') return value;
                if (!fallback && (Array.isArray(value.messages) || 'label' in value)) fallback = value;
            }

            const children = Array.isArray(value) ? value : Object.values(value);
            for (const child of children) {
                const found = walk(child, depth + 1);
                if (found) return found;
            }
            return null;
        };

        return walk(payload, 0) || fallback;
    }

    function collectConversationRecords(payload) {
        const records = [];
        const visited = new WeakSet();

        const walk = (value, depth) => {
            if (!value || typeof value !== 'object' || depth > 7 || visited.has(value)) return;
            visited.add(value);

            if (Array.isArray(value)) {
                for (const item of value) walk(item, depth + 1);
                return;
            }

            const looksLikeConversation = (
                typeof value.id === 'string'
                && typeof value.character_id === 'string'
                && !value.role
                && (
                    typeof value.label === 'string'
                    || typeof value.last_message_id === 'string'
                    || Array.isArray(value.messages)
                )
            );
            if (looksLikeConversation) records.push(value);
            for (const child of Object.values(value)) walk(child, depth + 1);
        };

        walk(payload, 0);
        return records;
    }

    async function captureConversationRecords(payload) {
        const grouped = new Map();
        for (const record of collectConversationRecords(payload)) {
            if (!grouped.has(record.character_id)) grouped.set(record.character_id, []);
            grouped.get(record.character_id).push(record);
        }

        for (const [characterId, records] of grouped) {
            await updateGraph(characterId, (graph) => {
                for (const record of records) {
                    const existing = findNode(graph, record.id);
                    const createdAt = normalizeTimestamp(record.createdAt || record.created_at);
                    const messageCount = Math.max(
                        0,
                        Number(record.message_count ?? record.num_messages) || 0,
                    );
                    const lastMessageId = typeof record.last_message_id === 'string'
                        ? record.last_message_id
                        : existing?.lastMessageId || '';
                    if (existing) {
                        upsertNode(graph, {
                            ...existing,
                            title: normalizeTitle(record.label, existing.title),
                            createdAt: createdAt || existing.createdAt,
                            messageCount: messageCount || existing.messageCount,
                            lastMessageId,
                        });
                    } else {
                        upsertNode(graph, {
                            conversationId: record.id,
                            characterId,
                            title: normalizeTitle(record.label, makeDefaultTitle('unlinked', createdAt)),
                            parentId: null,
                            forkMessageId: null,
                            forkExcerpt: '',
                            kind: 'unlinked',
                            createdAt: createdAt || Date.now(),
                            messageCount,
                            lastMessageId,
                            relationCheckedAt: 0,
                        });
                    }
                }
                return graph;
            });
        }
    }

    async function processSuccessfulRequest(meta, payload) {
        if (!meta || !payload) return;
        const classification = meta.classification;
        const body = await Promise.resolve(meta.bodyPromise).catch(() => null);

        if (classification.kind === 'clone') {
            const response = findResponseConversation(payload);
            const childId = response?.id;
            const characterId = response?.character_id || meta.context?.characterId;
            const parentId = typeof body?.conversation_id === 'string' ? body.conversation_id : '';
            if (!childId || !characterId || !parentId) return;

            const cloneKind = body?.type === 'partial' ? 'partial' : 'full';
            const forkMessageId = typeof body?.message_id === 'string'
                ? body.message_id.replace(/^message-/, '')
                : null;
            const forkMeta = meta.forkMeta || { forkExcerpt: '' };

            await updateGraph(characterId, (graph) => {
                if (!findNode(graph, parentId)) {
                    upsertNode(graph, {
                        conversationId: parentId,
                        characterId,
                        title: 'Исходный чат',
                        parentId: null,
                        kind: graph.nodes.length ? 'unlinked' : 'root',
                        createdAt: Date.now() - 1,
                    });
                }

                upsertNode(graph, {
                    conversationId: childId,
                    characterId,
                    title: normalizeTitle(body?.label, makeDefaultTitle(cloneKind)),
                    parentId,
                    forkMessageId,
                    forkExcerpt: forkMeta.forkExcerpt,
                    kind: cloneKind,
                    createdAt: Date.now(),
                    relationSource: 'captured',
                    relationCheckedAt: Date.now(),
                    relationIgnored: false,
                });
                return graph;
            });
            return;
        }

        if (classification.kind === 'create') {
            const response = findResponseConversation(payload) || payload;
            const conversationId = typeof response?.id === 'string' ? response.id : '';
            const characterId = response?.character_id || classification.characterId;
            if (!conversationId || !characterId) return;

            await updateGraph(characterId, (graph) => {
                upsertNode(graph, {
                    conversationId,
                    characterId,
                    title: normalizeTitle(response?.label, makeDefaultTitle('root')),
                    parentId: null,
                    forkMessageId: null,
                    forkExcerpt: '',
                    kind: 'root',
                    createdAt: normalizeTimestamp(response?.createdAt || response?.created_at) || Date.now(),
                    relationSource: 'captured',
                    relationCheckedAt: Date.now(),
                    relationIgnored: false,
                });
                return graph;
            });
            return;
        }

        if (classification.kind === 'rename') {
            const characterId = meta.context?.characterId || activeContext?.characterId;
            const title = typeof body?.label === 'string' ? body.label : '';
            if (!characterId || !classification.conversationId || !title.trim()) return;

            await updateGraph(characterId, (graph) => {
                const node = findNode(graph, classification.conversationId);
                if (node) upsertNode(graph, { ...node, title: normalizeTitle(title) });
                return graph;
            });
            return;
        }

        if (classification.kind === 'conversations') {
            await captureConversationRecords(payload);
        }
    }

    function makeRequestMeta(rawUrl, method, bodySource) {
        const classification = classifyRequest(rawUrl, method);
        let bodyPromise;
        if (bodySource && typeof bodySource.clone === 'function' && typeof bodySource.text === 'function') {
            bodyPromise = bodySource.clone().text().then(parseJsonBody).catch(() => null);
        } else {
            bodyPromise = Promise.resolve(parseJsonBody(bodySource));
        }

        const parsedBody = parseJsonBody(bodySource);
        return {
            rawUrl,
            method,
            classification,
            context: getChatContext(),
            bodyPromise,
            forkMeta: parsedBody?.message_id ? getForkMetadata(parsedBody.message_id) : null,
            requestHeaders: new Map(),
        };
    }

    function inspectResponse(response, meta) {
        if (!response?.clone || response.ok === false || meta.classification.kind === 'other') return;
        try {
            const contentType = response.headers?.get?.('content-type') || '';
            if (contentType && !/json/i.test(contentType)) return;
            const clone = response.clone();
            void Promise.resolve(clone.json())
                .then((payload) => processSuccessfulRequest(meta, payload))
                .catch(() => undefined);
        } catch (_error) {
            // Не-JSON ответы пропускаем.
        }
    }

    function installNetworkCapture() {
        try {
            const originalFetch = pageWindow.fetch;
            if (typeof originalFetch === 'function') {
                apiNativeFetch = originalFetch;
                pageWindow.fetch = function (input, options = {}) {
                    const rawUrl = readRequestUrl(input);
                    const method = options.method || input?.method || 'GET';
                    rememberApiAccess(rawUrl, input?.headers, options.headers);
                    const classification = classifyRequest(rawUrl, method);
                    const consumesResponse = options?.[INTERNAL_RESPONSE_CONSUMER_FLAG] === true;
                    let meta = null;
                    if (!consumesResponse && classification.kind !== 'other') {
                        const needsBody = ['clone', 'create', 'rename'].includes(classification.kind);
                        const bodySource = needsBody ? (
                            options.body || (input && typeof input.clone === 'function' ? input : null)
                        ) : null;
                        meta = makeRequestMeta(rawUrl, method, bodySource);
                    }
                    const result = Reflect.apply(originalFetch, this, arguments);
                    if (meta) {
                        void Promise.resolve(result).then(
                            (response) => inspectResponse(response, meta),
                            () => undefined,
                        );
                    }
                    return result;
                };
            }
        } catch (error) {
            console.warn('[Chat Branches] Не удалось подключиться к fetch.', error);
        }

        try {
            const prototype = pageWindow.XMLHttpRequest?.prototype;
            if (!prototype) return;
            const originalOpen = prototype.open;
            const originalSend = prototype.send;
            const originalSetRequestHeader = prototype.setRequestHeader;

            prototype.open = function (method, url) {
                this[XHR_META_KEY] = makeRequestMeta(readRequestUrl(url), method || 'GET', null);
                return Reflect.apply(originalOpen, this, arguments);
            };

            if (typeof originalSetRequestHeader === 'function') {
                prototype.setRequestHeader = function (name, value) {
                    const meta = this[XHR_META_KEY];
                    const normalizedName = String(name || '').toLowerCase();
                    if (meta && API_HEADER_NAMES.has(normalizedName)) {
                        meta.requestHeaders.set(normalizedName, String(value));
                    }
                    return Reflect.apply(originalSetRequestHeader, this, arguments);
                };
            }

            prototype.send = function (body) {
                const xhr = this;
                const meta = xhr[XHR_META_KEY];
                if (meta) {
                    rememberApiAccess(meta.rawUrl, meta.requestHeaders);
                    if (meta.classification.kind !== 'other') {
                        const parsedBody = parseJsonBody(body);
                        meta.bodyPromise = Promise.resolve(parsedBody);
                        meta.forkMeta = parsedBody?.message_id ? getForkMetadata(parsedBody.message_id) : null;
                    }
                }

                if (meta && isSpicyApiUrl(meta.rawUrl)) {
                    xhr.addEventListener('loadend', () => {
                        if (xhr.status < 200 || xhr.status >= 300 || meta.classification.kind === 'other') return;
                        try {
                            const payload = xhr.responseType === 'json'
                                ? xhr.response
                                : JSON.parse(xhr.responseText);
                            void processSuccessfulRequest(meta, payload);
                        } catch (_error) {
                            // Не-JSON ответы пропускаем.
                        }
                    }, { once: true });
                }
                return Reflect.apply(originalSend, this, arguments);
            };
        } catch (error) {
            console.warn('[Chat Branches] Не удалось подключиться к XHR.', error);
        }
    }

    function sleep(milliseconds) {
        return new Promise((resolve) => pageWindow.setTimeout(resolve, milliseconds));
    }

    async function fetchApiJson(path) {
        if (!hasApiAccess()) {
            const error = new Error('Сессия API ещё не обнаружена.');
            error.code = 'NO_API_SESSION';
            throw error;
        }

        const url = new URL(path, `${apiOrigin}/`).toString();
        const headers = Object.fromEntries(apiHeaders);
        headers.accept = 'application/json';
        const response = await Reflect.apply(apiNativeFetch, pageWindow, [url, {
            method: 'GET',
            headers,
            mode: 'cors',
            credentials: 'omit',
            [INTERNAL_RESPONSE_CONSUMER_FLAG]: true,
        }]);
        if (!response?.ok) {
            const error = new Error(`SpicyChat вернул HTTP ${response?.status || 0}.`);
            error.status = response?.status || 0;
            throw error;
        }
        return response.json();
    }

    function setRelationScanUi(text, percent, running = relationScan?.running === true) {
        ensureDialog();
        if (dialogScanStatus) dialogScanStatus.hidden = !text;
        if (dialogScanStatusText) dialogScanStatusText.textContent = text || '';
        if (dialogScanProgress) {
            const normalized = Math.max(0, Math.min(100, Number(percent) || 0));
            dialogScanProgress.style.width = `${normalized}%`;
            dialogScanProgress.parentElement?.setAttribute('aria-valuenow', String(Math.round(normalized)));
        }
        if (dialogScanButton) {
            dialogScanButton.classList.toggle('is-running', running);
            dialogScanButton.innerHTML = `${icons.refresh}<span>${running ? 'Остановить' : 'Обновить связи'}</span>`;
            dialogScanButton.title = running
                ? 'Остановить восстановление связей'
                : 'Повторно проверить старые чаты и восстановить связи';
        }
    }

    function relationScanPercent() {
        if (!relationScan) return 0;
        if (relationScan.phase === 'list') return Math.min(5, relationScan.listPages * 2);
        if (relationScan.phase === 'infer') return 94;
        if (relationScan.phase === 'done') return 100;
        const total = Math.max(1, relationScan.expectedMessages);
        return 5 + Math.min(87, (relationScan.fetchedMessages / total) * 87);
    }

    function updateRelationScanStatus(text) {
        if (!relationScan) return;
        relationScan.statusText = text;
        setRelationScanUi(text, relationScanPercent(), relationScan.running);
    }

    function conversationArray(payload) {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.conversations)) return payload.conversations;
        if (Array.isArray(payload?.data)) return payload.data;
        return [];
    }

    async function fetchAllSavedConversations(characterId) {
        const records = [];
        const seen = new Set();
        let lastId = '';
        let page = 0;

        while (!relationScan?.cancelRequested && page < 200) {
            const query = new URLSearchParams({ limit: '25', sort: 'latest' });
            if (lastId) query.set('last_id', lastId);
            relationScan.phase = 'list';
            relationScan.listPages = page + 1;
            updateRelationScanStatus(`Получаю список чатов · страница ${page + 1}`);
            const payload = await fetchApiJson(
                `/v2/characters/${encodeURIComponent(characterId)}/conversations?${query}`,
            );
            const batch = conversationArray(payload);
            await captureConversationRecords(batch);

            let added = 0;
            for (const record of batch) {
                if (!record?.id || seen.has(record.id)) continue;
                seen.add(record.id);
                records.push(record);
                added += 1;
            }
            if (batch.length < 25 || !added) break;
            const nextLastId = batch.at(-1)?.id;
            if (!nextLastId || nextLastId === lastId) break;
            lastId = nextLastId;
            page += 1;
            await sleep(80);
        }
        return records;
    }

    function mediaSignature(message) {
        const picked = {};
        for (const key of ['image', 'image_url', 'imageUrl', 'images', 'attachments', 'media']) {
            if (message?.[key] !== undefined && message[key] !== null) picked[key] = message[key];
        }
        try {
            return JSON.stringify(picked);
        } catch (_error) {
            return '';
        }
    }

    function historyFingerprint(parts) {
        let first = 2166136261;
        let second = 5381;
        let length = 0;
        for (const rawPart of parts) {
            const part = String(rawPart ?? '');
            for (let index = 0; index <= part.length; index += 1) {
                const code = index < part.length ? part.charCodeAt(index) : 0;
                first = Math.imul(first ^ code, 16777619);
                second = Math.imul(second, 33) ^ code;
                length += 1;
            }
        }
        return `${first >>> 0}:${second >>> 0}:${length}`;
    }

    function normalizeHistoryMessage(message) {
        if (!message || typeof message !== 'object' || typeof message.id !== 'string') return null;
        const createdAt = normalizeTimestamp(message.createdAt || message.created_at);
        const role = typeof message.role === 'string' ? message.role : '';
        const content = typeof message.content === 'string' ? message.content : '';
        const media = mediaSignature(message);
        return {
            id: message.id,
            prevId: typeof message.prev_id === 'string' ? message.prev_id : null,
            role,
            createdAt,
            excerpt: content.replace(/\s+/g, ' ').trim().slice(0, 180),
            hasMedia: Boolean(media && media !== '{}'),
            fingerprint: historyFingerprint([role, createdAt, content, media]),
        };
    }

    async function fetchConversationHistory(node, position, total) {
        const cacheKey = [
            node.characterId,
            node.conversationId,
            node.lastMessageId,
            node.messageCount,
        ].join(':');
        if (historyCache.has(cacheKey)) return historyCache.get(cacheKey);

        const collected = [];
        const seen = new Set();
        let lastId = '';
        let page = 0;

        while (!relationScan?.cancelRequested && page < 1000) {
            const query = new URLSearchParams({ limit: String(HISTORY_PAGE_SIZE) });
            if (lastId) query.set('last_id', lastId);
            relationScan.phase = 'history';
            updateRelationScanStatus(
                `Чат ${position}/${total} · ${collected.length}/${node.messageCount || '?'} сообщений`,
            );
            const payload = await fetchApiJson(
                `/characters/${encodeURIComponent(node.characterId)}/messages/${encodeURIComponent(node.conversationId)}?${query}`,
            );
            const batch = Array.isArray(payload?.messages) ? payload.messages : [];
            let added = 0;
            for (const message of batch) {
                if (!message?.id || seen.has(message.id)) continue;
                seen.add(message.id);
                collected.push(message);
                added += 1;
            }
            relationScan.fetchedMessages += added;
            if (relationScan.fetchedMessages > relationScan.expectedMessages) {
                relationScan.expectedMessages = relationScan.fetchedMessages + 1;
            }
            updateRelationScanStatus(
                `Чат ${position}/${total} · ${collected.length}/${node.messageCount || '?'} сообщений`,
            );

            if (batch.length < HISTORY_PAGE_SIZE || !added) break;
            const nextLastId = batch.at(-1)?.id;
            if (!nextLastId || nextLastId === lastId) break;
            lastId = nextLastId;
            page += 1;
            await sleep(80);
        }

        const history = collected
            .map(normalizeHistoryMessage)
            .filter(Boolean)
            .reverse();
        historyCache.set(cacheKey, history);
        return history;
    }

    function commonPrefixLength(parentMessages, childMessages) {
        const limit = Math.min(parentMessages.length, childMessages.length);
        let length = 0;
        while (
            length < limit
            && parentMessages[length].fingerprint === childMessages[length].fingerprint
        ) length += 1;
        return length;
    }

    function historyPrefixKey(messages) {
        if (messages.length < 2) return '';
        return `${messages[0].fingerprint}|${messages[1].fingerprint}`;
    }

    function inferParentForConversation(childRecord, records) {
        const childMessages = childRecord.messages;
        if (childMessages.length < 2 || childRecord.node.relationIgnored) return null;
        let best = null;

        for (const parentRecord of records) {
            if (parentRecord === childRecord || parentRecord.messages.length < 2) continue;
            if (parentRecord.node.createdAt > childRecord.node.createdAt + 5000) continue;

            const commonLength = commonPrefixLength(parentRecord.messages, childMessages);
            if (commonLength < 2) continue;
            let directPrevHits = 0;
            let sharedUserMessages = 0;
            if (childMessages[0].role === 'user') sharedUserMessages += 1;
            for (let index = 1; index < commonLength; index += 1) {
                if (childMessages[index].prevId === parentRecord.messages[index - 1].id) {
                    directPrevHits += 1;
                }
                if (childMessages[index].role === 'user') sharedUserMessages += 1;
            }
            if (directPrevHits < 1 && (commonLength < 4 || sharedUserMessages < 1)) continue;

            const score = directPrevHits * 1000000 + commonLength * 1000
                - Math.min(999, Math.abs(childRecord.node.createdAt - parentRecord.node.createdAt) / 1000000);
            if (!best || score > best.score) {
                best = {
                    parent: parentRecord,
                    commonLength,
                    directPrevHits,
                    score,
                };
            }
        }

        if (!best) return null;
        const forkMessage = best.parent.messages[best.commonLength - 1];
        let parentMessagesAtClone = 0;
        for (const message of best.parent.messages) {
            if (!message.createdAt || message.createdAt <= childRecord.node.createdAt + 5000) {
                parentMessagesAtClone += 1;
            }
        }
        parentMessagesAtClone ||= best.parent.messages.length;
        const kind = best.commonLength >= parentMessagesAtClone ? 'full' : 'partial';
        const excerpt = forkMessage.excerpt || (forkMessage.hasMedia ? 'Изображение' : '');
        return {
            parentId: best.parent.node.conversationId,
            forkMessageId: forkMessage.id,
            forkExcerpt: excerpt,
            kind,
        };
    }

    async function applyRecoveredRelations(characterId, histories, failedIds) {
        const checkedAt = Date.now();
        const records = [...histories.entries()].map(([conversationId, messages]) => ({
            node: findNode(activeGraph, conversationId),
            messages,
        })).filter((record) => record.node && record.messages.length);
        const recordsByPrefix = new Map();
        for (const record of records) {
            const prefix = historyPrefixKey(record.messages);
            if (!prefix) continue;
            if (!recordsByPrefix.has(prefix)) recordsByPrefix.set(prefix, []);
            recordsByPrefix.get(prefix).push(record);
        }
        const recovered = new Map();
        for (let index = 0; index < records.length; index += 1) {
            const childRecord = records[index];
            const node = childRecord.node;
            if (node.parentId && node.relationSource !== 'inferred') continue;
            const candidates = recordsByPrefix.get(historyPrefixKey(childRecord.messages)) || [];
            const inferred = inferParentForConversation(childRecord, candidates);
            if (inferred) recovered.set(node.conversationId, inferred);
            if (index > 0 && index % 16 === 0) await sleep(0);
        }

        let linked = 0;
        await updateGraph(characterId, (graph) => {
            for (const node of graph.nodes) {
                const loadedMessageCount = histories.get(node.conversationId)?.length || 0;
                if (loadedMessageCount > node.messageCount) node.messageCount = loadedMessageCount;
                if (failedIds.has(node.conversationId)) continue;
                const inference = recovered.get(node.conversationId);
                if (inference && !node.relationIgnored) {
                    upsertNode(graph, {
                        ...node,
                        ...inference,
                        relationSource: 'inferred',
                        relationCheckedAt: checkedAt,
                    });
                    linked += 1;
                    continue;
                }
                if (node.parentId && node.relationSource !== 'inferred') {
                    upsertNode(graph, { ...node, relationCheckedAt: checkedAt });
                    continue;
                }
                if (histories.has(node.conversationId)) {
                    upsertNode(graph, {
                        ...node,
                        parentId: null,
                        forkMessageId: null,
                        forkExcerpt: '',
                        kind: node.relationIgnored ? 'unlinked' : 'root',
                        relationSource: node.relationIgnored ? '' : 'inferred',
                        relationCheckedAt: checkedAt,
                    });
                }
            }
            return graph;
        });
        return linked;
    }

    function clearHistoryCacheForCharacter(characterId) {
        for (const key of historyCache.keys()) {
            if (key.startsWith(`${characterId}:`)) historyCache.delete(key);
        }
    }

    async function runRelationScan(manual = false) {
        if (relationScan?.running) {
            if (manual) {
                relationScan.cancelRequested = true;
                updateRelationScanStatus('Останавливаю поиск связей…');
            }
            return;
        }
        if (relationScanStarting) return;

        relationScanStarting = true;
        try {
            await ensureContext(true);
        } finally {
            relationScanStarting = false;
        }
        const characterId = activeContext?.characterId;
        if (!characterId) return;
        if (!hasApiAccess()) {
            setRelationScanUi(
                'Не вижу активную API-сессию. Перезагрузи чат или страницу Saved Chats и попробуй ещё раз.',
                0,
                false,
            );
            return;
        }

        clearHistoryCacheForCharacter(characterId);

        relationScan = {
            running: true,
            cancelRequested: false,
            phase: 'list',
            listPages: 0,
            fetchedMessages: 0,
            expectedMessages: 1,
            statusText: '',
        };
        const histories = new Map();
        setRelationScanUi('Подготавливаю список чатов…', 0, true);

        try {
            await fetchAllSavedConversations(characterId);
            await ensureContext(true);
            const nodes = (activeGraph?.nodes || []).slice()
                .sort((a, b) => a.createdAt - b.createdAt);
            relationScan.expectedMessages = Math.max(
                nodes.length,
                nodes.reduce((sum, node) => sum + Math.max(1, node.messageCount), 0),
            );
            const failedIds = new Set();

            for (let index = 0; index < nodes.length; index += 1) {
                if (relationScan.cancelRequested) break;
                const node = nodes[index];
                try {
                    histories.set(
                        node.conversationId,
                        await fetchConversationHistory(node, index + 1, nodes.length),
                    );
                } catch (error) {
                    failedIds.add(node.conversationId);
                    if (error?.status === 401 || error?.status === 403) throw error;
                }
                await sleep(70);
            }

            if (relationScan.cancelRequested) {
                relationScan.running = false;
                setRelationScanUi('Поиск связей остановлен.', relationScanPercent(), false);
                return;
            }

            relationScan.phase = 'infer';
            updateRelationScanStatus('Сравниваю цепочки сообщений…');
            const linked = await applyRecoveredRelations(characterId, histories, failedIds);
            relationScan.phase = 'done';
            relationScan.running = false;
            const failedText = failedIds.size ? ` · не удалось проверить: ${failedIds.size}` : '';
            setRelationScanUi(
                `Готово · восстановлено связей: ${linked}${failedText}`,
                100,
                false,
            );
        } catch (error) {
            relationScan.running = false;
            const text = error?.status === 401 || error?.status === 403
                ? 'Сессия SpicyChat устарела. Перезагрузи страницу и повтори.'
                : `Не удалось восстановить связи: ${error?.message || 'неизвестная ошибка'}`;
            setRelationScanUi(text, relationScanPercent(), false);
        } finally {
            histories.clear();
            clearHistoryCacheForCharacter(characterId);
        }
    }

    function scheduleAutomaticRelationScan() {
        if (autoScanTimer || relationScanStarting || relationScan?.running || dialog?.hidden !== false) return;
        if (!hasApiAccess() || !activeGraph || activeGraph.nodes.length < 2) return;
        const needsScan = activeGraph.nodes.some((node) => !node.relationCheckedAt);
        if (!needsScan) return;
        autoScanTimer = pageWindow.setTimeout(() => {
            autoScanTimer = null;
            if (dialog?.hidden === false) void runRelationScan(false);
        }, 180);
    }

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${DIALOG_ID}[hidden], #${EDITOR_ID}[hidden], #${POPOVER_ID}[hidden] {
                display: none !important;
            }

            #${DIALOG_ID} {
                position: fixed !important;
                inset: 0 !important;
                z-index: 10200 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 24px !important;
                background: rgba(0, 0, 0, 0.58) !important;
                backdrop-filter: blur(3px) !important;
                font-family: inherit !important;
            }

            .tm-sc-branches-shell {
                box-sizing: border-box !important;
                display: flex !important;
                flex-direction: column !important;
                width: min(980px, calc(100vw - 48px)) !important;
                height: min(780px, calc(100vh - 48px)) !important;
                overflow: hidden !important;
                color: #18181b !important;
                background: #f8f8fa !important;
                border: 1px solid rgba(24, 24, 27, 0.13) !important;
                border-radius: 18px !important;
                box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42) !important;
            }

            .dark .tm-sc-branches-shell {
                color: #f4f4f5 !important;
                background: #202024 !important;
                border-color: rgba(255, 255, 255, 0.12) !important;
            }

            .tm-sc-branches-header {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 18px !important;
                padding: 18px 20px 14px !important;
                border-bottom: 1px solid rgba(113, 113, 122, 0.18) !important;
            }

            .tm-sc-branches-heading { display: flex !important; align-items: baseline !important; gap: 9px !important; }
            .tm-sc-branches-title { margin: 0 !important; font-size: 22px !important; line-height: 1.2 !important; }
            .tm-sc-branches-count {
                min-width: 24px !important; padding: 2px 7px !important; text-align: center !important;
                color: #6d28d9 !important; background: rgba(124, 58, 237, 0.12) !important;
                border-radius: 999px !important; font-size: 12px !important; font-weight: 700 !important;
            }

            .tm-sc-branches-close, .tm-sc-branches-icon-button {
                width: 34px !important; height: 34px !important; padding: 0 !important;
                display: inline-flex !important; align-items: center !important; justify-content: center !important;
                color: inherit !important; background: transparent !important;
                border: 0 !important; border-radius: 9px !important; cursor: pointer !important;
            }
            .tm-sc-branches-close:hover, .tm-sc-branches-icon-button:hover { background: rgba(124, 58, 237, 0.13) !important; }
            .tm-sc-branches-icon-button.is-danger:hover { color: #ef4444 !important; background: rgba(239, 68, 68, 0.12) !important; }

            .tm-sc-branches-toolbar { padding: 13px 20px !important; border-bottom: 1px solid rgba(113, 113, 122, 0.14) !important; }
            .tm-sc-branches-toolbar-row { display: flex !important; align-items: center !important; gap: 9px !important; }
            .tm-sc-branches-search-wrap { position: relative !important; display: block !important; flex: 1 1 auto !important; min-width: 0 !important; }
            .tm-sc-branches-search-wrap > svg {
                position: absolute !important; left: 12px !important; top: 50% !important;
                transform: translateY(-50%) !important; color: #71717a !important; pointer-events: none !important;
            }
            .tm-sc-branches-search {
                box-sizing: border-box !important; width: 100% !important; height: 40px !important;
                padding: 0 13px 0 39px !important; color: inherit !important;
                background: rgba(113, 113, 122, 0.08) !important;
                border: 1px solid rgba(113, 113, 122, 0.18) !important;
                border-radius: 10px !important; outline: none !important; font: inherit !important;
            }
            .tm-sc-branches-search:focus { border-color: rgba(124, 58, 237, 0.72) !important; box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.13) !important; }
            .tm-sc-branches-scan-button {
                height: 40px !important; padding: 0 13px !important; flex: 0 0 auto !important;
                display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 7px !important;
                color: #fff !important; background: #7c3aed !important; border: 1px solid #7c3aed !important;
                border-radius: 10px !important; cursor: pointer !important; font: inherit !important; font-size: 12px !important; font-weight: 700 !important;
            }
            .tm-sc-branches-scan-button.is-running { color: inherit !important; background: transparent !important; border-color: rgba(124, 58, 237, .55) !important; }
            .tm-sc-branches-scan-button.is-running svg { animation: tm-sc-branches-spin 1s linear infinite !important; }
            .tm-sc-branches-scan-status { margin-top: 10px !important; }
            .tm-sc-branches-scan-status[hidden] { display: none !important; }
            .tm-sc-branches-scan-text { margin-bottom: 6px !important; color: #71717a !important; font-size: 11px !important; line-height: 1.35 !important; }
            .tm-sc-branches-progress-track {
                width: 100% !important; height: 5px !important; overflow: hidden !important;
                background: rgba(113, 113, 122, .16) !important; border-radius: 999px !important;
            }
            .tm-sc-branches-progress-bar {
                width: 0; height: 100% !important; background: #7c3aed !important; border-radius: inherit !important;
                transition: width 180ms ease !important;
            }
            .${SAVED_PAGE_BUTTON_CLASS} { white-space: nowrap !important; }
            @keyframes tm-sc-branches-spin { to { transform: rotate(360deg); } }

            .tm-sc-branches-content { flex: 1 1 auto !important; overflow: auto !important; padding: 18px 20px 28px !important; }
            .tm-sc-branches-section + .tm-sc-branches-section { margin-top: 24px !important; }
            .tm-sc-branches-section-title {
                margin: 0 0 10px !important; color: #71717a !important;
                font-size: 12px !important; font-weight: 750 !important; letter-spacing: .06em !important; text-transform: uppercase !important;
            }
            .tm-sc-branches-tree { display: flex !important; flex-direction: column !important; gap: 8px !important; }
            .tm-sc-branch-node {
                position: relative !important; min-width: 0 !important; max-width: 100% !important;
                margin-left: calc(var(--depth, 0) * 28px) !important;
            }
            .tm-sc-branch-node.is-child::before {
                content: "" !important; position: absolute !important; left: -17px !important; top: -9px !important;
                width: 14px !important; height: 31px !important; border-left: 2px solid rgba(124, 58, 237, 0.3) !important;
                border-bottom: 2px solid rgba(124, 58, 237, 0.3) !important; border-radius: 0 0 0 9px !important;
            }
            .tm-sc-branch-card {
                display: flex !important; align-items: center !important; gap: 9px !important;
                box-sizing: border-box !important; width: 100% !important; min-width: 0 !important; max-width: 100% !important;
                min-height: 68px !important; padding: 8px 9px !important; overflow: hidden !important;
                background: #ffffff !important; border: 1px solid rgba(113, 113, 122, 0.17) !important;
                border-radius: 12px !important; box-shadow: 0 3px 12px rgba(0, 0, 0, 0.045) !important;
            }
            .dark .tm-sc-branch-card { background: #29292e !important; border-color: rgba(255, 255, 255, 0.1) !important; }
            .tm-sc-branch-card.is-current { border-color: rgba(124, 58, 237, 0.8) !important; box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.13) !important; }
            .tm-sc-branch-toggle {
                width: 26px !important; height: 34px !important; padding: 0 !important; flex: 0 0 26px !important;
                display: inline-flex !important; align-items: center !important; justify-content: center !important;
                color: #71717a !important; background: transparent !important; border: 0 !important; cursor: pointer !important;
                transition: transform 140ms ease !important;
            }
            .tm-sc-branch-toggle.is-open { transform: rotate(90deg) !important; }
            .tm-sc-branch-toggle.is-empty { visibility: hidden !important; }
            .tm-sc-branch-kind-icon {
                width: 34px !important; height: 34px !important; flex: 0 0 34px !important;
                display: inline-flex !important; align-items: center !important; justify-content: center !important;
                color: #7c3aed !important; background: rgba(124, 58, 237, 0.11) !important; border-radius: 10px !important;
            }
            .tm-sc-branch-main {
                display: block !important; width: 0 !important; min-width: 0 !important; max-width: 100% !important;
                flex: 1 1 0% !important; padding: 3px 4px !important; overflow: hidden !important;
                text-align: left !important; white-space: normal !important;
                color: inherit !important; background: transparent !important; border: 0 !important; cursor: pointer !important;
            }
            .tm-sc-branch-name-row { display: flex !important; align-items: center !important; gap: 7px !important; min-width: 0 !important; }
            .tm-sc-branch-name { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; font-size: 14px !important; font-weight: 720 !important; }
            .tm-sc-branch-current {
                padding: 2px 6px !important; color: #6d28d9 !important; background: rgba(124, 58, 237, 0.13) !important;
                border-radius: 999px !important; font-size: 10px !important; font-weight: 750 !important; white-space: nowrap !important;
            }
            .tm-sc-branch-meta {
                display: flex !important; align-items: center !important; gap: 7px !important;
                min-width: 0 !important; max-width: 100% !important; margin-top: 4px !important; overflow: hidden !important;
                color: #71717a !important; font-size: 11px !important; line-height: 1.35 !important;
            }
            .tm-sc-branch-meta-text {
                min-width: 0 !important; overflow: hidden !important;
                text-overflow: ellipsis !important; white-space: nowrap !important;
            }
            .tm-sc-branch-message-count {
                display: inline-flex !important; align-items: center !important; gap: 3px !important;
                flex: 0 0 auto !important; white-space: nowrap !important;
            }
            .tm-sc-branch-message-count[hidden] { display: none !important; }
            .tm-sc-branch-message-count svg { width: 13px !important; height: 13px !important; }
            .tm-sc-branch-excerpt {
                display: block !important; box-sizing: border-box !important;
                width: 100% !important; min-width: 0 !important; max-width: 100% !important;
                overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important;
            }
            .tm-sc-branch-actions { display: flex !important; align-items: center !important; flex: 0 0 auto !important; }

            .tm-sc-branches-empty { padding: 60px 20px !important; text-align: center !important; color: #71717a !important; }

            #${EDITOR_ID} {
                position: fixed !important; inset: 0 !important; z-index: 10300 !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
                background: rgba(0, 0, 0, 0.46) !important; font-family: inherit !important;
            }
            .tm-sc-branches-editor-card {
                box-sizing: border-box !important; width: min(430px, calc(100vw - 30px)) !important;
                padding: 19px !important; color: #18181b !important; background: #fff !important;
                border-radius: 14px !important; box-shadow: 0 20px 65px rgba(0, 0, 0, .4) !important;
            }
            .dark .tm-sc-branches-editor-card { color: #f4f4f5 !important; background: #29292e !important; }
            .tm-sc-branches-editor-card h2 { margin: 0 0 13px !important; font-size: 18px !important; }
            .tm-sc-branches-editor-input {
                box-sizing: border-box !important; width: 100% !important; height: 42px !important; padding: 0 12px !important;
                color: inherit !important; background: rgba(113, 113, 122, 0.08) !important;
                border: 1px solid rgba(113, 113, 122, 0.3) !important; border-radius: 9px !important; outline: none !important; font: inherit !important;
            }
            .tm-sc-branches-editor-actions { display: flex !important; justify-content: flex-end !important; gap: 8px !important; margin-top: 14px !important; }
            .tm-sc-branches-editor-actions button {
                min-width: 92px !important; height: 38px !important; padding: 0 13px !important;
                border-radius: 9px !important; border: 1px solid rgba(113, 113, 122, 0.24) !important; cursor: pointer !important; font: inherit !important;
            }
            .tm-sc-branches-editor-cancel { color: inherit !important; background: transparent !important; }
            .tm-sc-branches-editor-save { color: #fff !important; background: #7c3aed !important; border-color: #7c3aed !important; }

            .${MARKER_CLASS} {
                position: relative !important; width: 26px !important; height: 26px !important; padding: 0 !important;
                display: inline-flex !important; align-items: center !important; justify-content: center !important; flex: 0 0 26px !important;
                color: #a78bfa !important; background: rgba(124, 58, 237, 0.13) !important;
                border: 1px solid rgba(167, 139, 250, 0.3) !important; border-radius: 8px !important;
                cursor: pointer !important; transition: background 120ms ease, color 120ms ease !important;
            }
            .${MARKER_CLASS}:hover { color: #fff !important; background: #7c3aed !important; }
            .tm-sc-branch-marker-count {
                position: absolute !important; right: -5px !important; top: -6px !important; min-width: 14px !important; height: 14px !important;
                padding: 0 3px !important; display: inline-flex !important; align-items: center !important; justify-content: center !important;
                color: #fff !important; background: #7c3aed !important; border: 2px solid #29292e !important;
                border-radius: 999px !important; font-size: 9px !important; font-weight: 800 !important; line-height: 1 !important;
            }

            #${POPOVER_ID} {
                position: fixed !important; z-index: 10350 !important; box-sizing: border-box !important;
                width: min(320px, calc(100vw - 20px)) !important; padding: 10px !important;
                color: #18181b !important; background: #fff !important; border: 1px solid rgba(113, 113, 122, .2) !important;
                border-radius: 11px !important; box-shadow: 0 14px 42px rgba(0, 0, 0, .3) !important; font-family: inherit !important;
            }
            .dark #${POPOVER_ID} { color: #f4f4f5 !important; background: #29292e !important; border-color: rgba(255, 255, 255, .12) !important; }
            .tm-sc-branch-popover-title { padding: 2px 4px 8px !important; color: #71717a !important; font-size: 11px !important; font-weight: 750 !important; text-transform: uppercase !important; }
            .tm-sc-branch-popover-item {
                width: 100% !important; padding: 9px !important; display: flex !important; align-items: center !important; gap: 8px !important;
                text-align: left !important; color: inherit !important; background: transparent !important; border: 0 !important; border-radius: 8px !important; cursor: pointer !important;
            }
            .tm-sc-branch-popover-item:hover { background: rgba(124, 58, 237, .13) !important; }
            .tm-sc-branch-popover-item span { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }

            @media (max-width: 640px) {
                .tm-sc-branches-toolbar-row { align-items: stretch !important; flex-direction: column !important; }
                .tm-sc-branches-scan-button { width: 100% !important; }
            }
        `;
        document.head.appendChild(style);
    }

    function cloneMenuButton(template) {
        const button = runtime.dom.cloneMenuButton(template);
        button.classList.remove(
            'tm-sc-open-message-bookmarks',
            'tm-sc-open-conversation-gallery',
            MENU_ITEM_CLASS,
        );
        button.classList.add(MENU_ITEM_CLASS);
        button.removeAttribute('target');
        button.disabled = false;
        button.type = 'button';
        button.setAttribute('aria-label', 'Ветки чатов');

        const oldIcon = button.querySelector('svg');
        if (oldIcon) oldIcon.outerHTML = icons.branches;
        else button.insertAdjacentHTML('afterbegin', icons.branches);
        const labels = Array.from(button.querySelectorAll('p, span'));
        if (labels[0]) labels[0].textContent = 'Ветки чатов';
        for (const extra of labels.slice(1)) extra.remove();
        return button;
    }

    function findChatMenu(dropdown) {
        return runtime.dom.chatMenu(dropdown);
    }

    function normalizeCustomChatMenuOrder(menu) {
        const desired = CHAT_MENU_ITEM_ORDER
            .map((className) => menu.querySelector(`.${className}`))
            .filter(Boolean);
        if (!desired.length) return;

        const currentPrefix = Array.from(menu.children).slice(0, desired.length);
        if (desired.every((item, index) => currentPrefix[index] === item)) return;

        const firstNative = Array.from(menu.children).find((item) => (
            !CHAT_MENU_ITEM_ORDER.some((className) => item.classList.contains(className))
        )) || null;
        for (const item of desired) menu.insertBefore(item, firstNative);
    }

    function ensureChatMenuItem() {
        for (const dropdown of document.querySelectorAll(CHAT_DROPDOWN_SELECTOR)) {
            const menu = findChatMenu(dropdown);
            if (!menu) continue;
            let button = menu.querySelector(`.${MENU_ITEM_CLASS}`);
            if (!button) {
                const template = menu.querySelector('.tm-sc-open-conversation-gallery')
                    || menu.querySelector('.tm-sc-open-message-bookmarks')
                    || menu.querySelector('button[aria-label="View Saved Chats" i]')
                    || menu.querySelector('button, [role="menuitem"]');
                if (!template) continue;
                button = cloneMenuButton(template);
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    dialogAnchor = dropdown;
                    dropdown.click();
                    window.setTimeout(() => void openDialog(dropdown), 0);
                });
                menu.insertBefore(button, menu.firstElementChild);
            }

            normalizeCustomChatMenuOrder(menu);
        }
    }

    function ensureSavedChatsTreeButton() {
        const context = getChatContext();
        if (context?.pageType !== 'saved') {
            if (savedPageButton?.isConnected) savedPageButton.remove();
            savedPageButton = null;
            return;
        }

        if (savedPageButton?.isConnected) return;
        const sortButton = document.querySelector('[data-testid="ChatsSortDropdown-Trigger"]');
        if (!sortButton?.parentElement) return;
        const existing = sortButton.parentElement.querySelector(`.${SAVED_PAGE_BUTTON_CLASS}`);
        if (existing) {
            savedPageButton = existing;
            return;
        }

        const button = sortButton.cloneNode(false);
        button.type = 'button';
        button.removeAttribute('data-testid');
        button.setAttribute('aria-label', 'Открыть дерево чатов');
        button.classList.add(SAVED_PAGE_BUTTON_CLASS);
        button.innerHTML = `${icons.branches}<span>Дерево</span>`;
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            void openDialog(button);
        });
        sortButton.before(button);
        savedPageButton = button;
    }

    function ensureDialog() {
        if (dialog?.isConnected) return dialog;
        dialog = document.createElement('div');
        dialog.id = DIALOG_ID;
        dialog.hidden = true;
        dialog.innerHTML = `
            <section class="tm-sc-branches-shell" role="dialog" aria-modal="true" aria-labelledby="tm-sc-branches-title">
                <header class="tm-sc-branches-header">
                    <div class="tm-sc-branches-heading">
                        <h2 id="tm-sc-branches-title" class="tm-sc-branches-title">Ветки чатов</h2>
                        <span class="tm-sc-branches-count"></span>
                    </div>
                    <button class="tm-sc-branches-close" type="button" aria-label="Закрыть">${icons.close}</button>
                </header>
                <div class="tm-sc-branches-toolbar">
                    <div class="tm-sc-branches-toolbar-row">
                        <label class="tm-sc-branches-search-wrap">
                            ${icons.search}
                            <input class="tm-sc-branches-search" type="search" placeholder="Найти ветку по названию…" autocomplete="off">
                        </label>
                        <button class="tm-sc-branches-scan-button" type="button" title="Повторно проверить старые чаты и восстановить связи">
                            ${icons.refresh}<span>Обновить связи</span>
                        </button>
                    </div>
                    <div class="tm-sc-branches-scan-status" hidden>
                        <div class="tm-sc-branches-scan-text"></div>
                        <div class="tm-sc-branches-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                            <div class="tm-sc-branches-progress-bar"></div>
                        </div>
                    </div>
                </div>
                <div class="tm-sc-branches-content">
                    <div class="tm-sc-branches-tree-root"></div>
                    <div class="tm-sc-branches-empty" hidden>Веток пока нет.</div>
                </div>
            </section>
        `;
        dialogTree = dialog.querySelector('.tm-sc-branches-tree-root');
        dialogCount = dialog.querySelector('.tm-sc-branches-count');
        dialogSearch = dialog.querySelector('.tm-sc-branches-search');
        dialogEmpty = dialog.querySelector('.tm-sc-branches-empty');
        dialogScanButton = dialog.querySelector('.tm-sc-branches-scan-button');
        dialogScanStatus = dialog.querySelector('.tm-sc-branches-scan-status');
        dialogScanStatusText = dialog.querySelector('.tm-sc-branches-scan-text');
        dialogScanProgress = dialog.querySelector('.tm-sc-branches-progress-bar');
        dialog.querySelector('.tm-sc-branches-close').addEventListener('click', closeDialog);
        dialogSearch.addEventListener('input', renderDialog);
        dialogScanButton.addEventListener('click', () => void runRelationScan(true));
        dialog.addEventListener('pointerdown', (event) => {
            if (event.target === dialog) closeDialog();
        });
        document.body.appendChild(dialog);
        return dialog;
    }

    function nodeKindLabel(node) {
        if (node.kind === 'full') return 'Полный клон';
        if (node.kind === 'partial') return 'Частичная ветка';
        if (node.kind === 'unlinked') return 'Без связи';
        return 'Новый сюжет';
    }

    function messageCountLabel(value) {
        const count = Math.max(0, Math.trunc(Number(value) || 0));
        const mod100 = count % 100;
        const mod10 = count % 10;
        const word = mod100 >= 11 && mod100 <= 14
            ? 'сообщений'
            : mod10 === 1
                ? 'сообщение'
                : mod10 >= 2 && mod10 <= 4
                    ? 'сообщения'
                    : 'сообщений';
        return `${count} ${word}`;
    }

    function nodeKindIcon(node) {
        if (node.kind === 'full') return icons.full;
        if (node.kind === 'partial') return icons.partial;
        if (node.kind === 'unlinked') return icons.orphan;
        return icons.root;
    }

    function navigateToConversation(node) {
        if (!node?.characterId || !node?.conversationId) return;
        closeDialog();
        closeMarkerPopover();
        const route = activeContext?.routeType || 'chat';
        pageWindow.location.assign(`/${route}/${node.characterId}/${node.conversationId}`);
    }

    function makeNodeElement(node, childrenMap, depth, query, rendered, path) {
        if (path.has(node.conversationId)) return null;
        const childNodes = (childrenMap.get(node.conversationId) || []).slice()
            .sort((a, b) => a.createdAt - b.createdAt);
        const nextPath = new Set(path);
        nextPath.add(node.conversationId);
        const normalizedQuery = query.toLocaleLowerCase();
        const selfMatches = !normalizedQuery || node.title.toLocaleLowerCase().includes(normalizedQuery);
        const descendantMatches = childNodes.some((child) => nodeOrDescendantMatches(child, childrenMap, normalizedQuery, nextPath));
        if (!selfMatches && !descendantMatches) return null;

        rendered.add(node.conversationId);
        const wrapper = document.createElement('div');
        wrapper.className = `tm-sc-branch-node${depth ? ' is-child' : ''}`;
        // Узлы вложены друг в друга, поэтому каждый уровень
        // добавляет ровно один шаг отступа.
        wrapper.style.setProperty('--depth', depth ? '1' : '0');

        const card = document.createElement('article');
        card.className = 'tm-sc-branch-card';
        if (activeContext?.conversationId === node.conversationId) card.classList.add('is-current');

        const collapsed = activeGraph?.collapsed.includes(node.conversationId) && !normalizedQuery;
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = `tm-sc-branch-toggle${collapsed ? '' : ' is-open'}${childNodes.length ? '' : ' is-empty'}`;
        toggle.setAttribute('aria-label', collapsed ? 'Развернуть ветку' : 'Свернуть ветку');
        toggle.innerHTML = icons.chevron;
        toggle.addEventListener('click', (event) => {
            event.stopPropagation();
            void toggleCollapsed(node.conversationId);
        });

        const kindIcon = document.createElement('span');
        kindIcon.className = 'tm-sc-branch-kind-icon';
        kindIcon.innerHTML = nodeKindIcon(node);

        const main = document.createElement('button');
        main.type = 'button';
        main.className = 'tm-sc-branch-main';
        main.innerHTML = `
            <span class="tm-sc-branch-name-row">
                <span class="tm-sc-branch-name"></span>
                ${activeContext?.conversationId === node.conversationId ? '<span class="tm-sc-branch-current">Текущий</span>' : ''}
            </span>
            <span class="tm-sc-branch-meta">
                <span class="tm-sc-branch-meta-text"></span>
                <span class="tm-sc-branch-message-count" hidden>
                    ${icons.messages}<span class="tm-sc-branch-message-count-value"></span>
                </span>
            </span>
            ${node.forkExcerpt ? '<span class="tm-sc-branch-meta tm-sc-branch-excerpt"></span>' : ''}
        `;
        main.querySelector('.tm-sc-branch-name').textContent = node.title;
        const date = formatMoscowDateTime(node.createdAt);
        main.querySelector('.tm-sc-branch-meta-text').textContent = [nodeKindLabel(node), date && `${date} МСК`].filter(Boolean).join(' · ');
        if (node.messageCount > 0) {
            const messageCount = main.querySelector('.tm-sc-branch-message-count');
            messageCount.hidden = false;
            messageCount.title = messageCountLabel(node.messageCount);
            messageCount.setAttribute('aria-label', messageCountLabel(node.messageCount));
            messageCount.querySelector('.tm-sc-branch-message-count-value').textContent = String(node.messageCount);
        }
        if (node.forkExcerpt) main.querySelector('.tm-sc-branch-excerpt').textContent = `От: ${node.forkExcerpt}`;
        main.addEventListener('click', () => navigateToConversation(node));

        const actions = document.createElement('div');
        actions.className = 'tm-sc-branch-actions';
        const rename = document.createElement('button');
        rename.type = 'button';
        rename.className = 'tm-sc-branches-icon-button';
        rename.title = 'Переименовать в дереве';
        rename.setAttribute('aria-label', 'Переименовать в дереве');
        rename.innerHTML = icons.pencil;
        rename.addEventListener('click', () => openEditor(node));
        actions.appendChild(rename);

        if (node.parentId) {
            const unlink = document.createElement('button');
            unlink.type = 'button';
            unlink.className = 'tm-sc-branches-icon-button is-danger';
            unlink.title = 'Отвязать от родительской ветки';
            unlink.setAttribute('aria-label', 'Отвязать от родительской ветки');
            unlink.innerHTML = icons.unlink;
            unlink.addEventListener('click', () => void unlinkNode(node));
            actions.appendChild(unlink);
        }

        card.append(toggle, kindIcon, main, actions);
        wrapper.appendChild(card);

        if (!collapsed || normalizedQuery) {
            for (const child of childNodes) {
                const childElement = makeNodeElement(child, childrenMap, depth + 1, query, rendered, nextPath);
                if (childElement) wrapper.appendChild(childElement);
            }
        } else {
            markDescendantsRendered(childNodes, childrenMap, rendered, nextPath);
        }
        return wrapper;
    }

    function markDescendantsRendered(nodes, childrenMap, rendered, path) {
        for (const node of nodes) {
            if (path.has(node.conversationId)) continue;
            rendered.add(node.conversationId);
            const nextPath = new Set(path);
            nextPath.add(node.conversationId);
            markDescendantsRendered(
                childrenMap.get(node.conversationId) || [],
                childrenMap,
                rendered,
                nextPath,
            );
        }
    }

    function nodeOrDescendantMatches(node, childrenMap, query, path) {
        if (!query) return true;
        if (path.has(node.conversationId)) return false;
        if (node.title.toLocaleLowerCase().includes(query)) return true;
        const nextPath = new Set(path);
        nextPath.add(node.conversationId);
        return (childrenMap.get(node.conversationId) || [])
            .some((child) => nodeOrDescendantMatches(child, childrenMap, query, nextPath));
    }

    function appendTreeSection(container, titleText, nodes, childrenMap, query, rendered) {
        if (!nodes.length) return;
        const section = document.createElement('section');
        section.className = 'tm-sc-branches-section';
        const title = document.createElement('h3');
        title.className = 'tm-sc-branches-section-title';
        title.textContent = titleText;
        const tree = document.createElement('div');
        tree.className = 'tm-sc-branches-tree';
        for (const node of nodes) {
            const element = makeNodeElement(node, childrenMap, 0, query, rendered, new Set());
            if (element) tree.appendChild(element);
        }
        if (!tree.childElementCount) return;
        section.append(title, tree);
        container.appendChild(section);
    }

    function renderDialog() {
        if (!dialogTree || !dialogCount || !dialogEmpty || !activeGraph) return;
        const nodes = activeGraph.nodes.slice();
        dialogCount.textContent = nodes.length ? String(nodes.length) : '';
        dialogTree.replaceChildren();

        const nodeMap = new Map(nodes.map((node) => [node.conversationId, node]));
        const childrenMap = new Map();
        for (const node of nodes) {
            if (!node.parentId || !nodeMap.has(node.parentId)) continue;
            if (!childrenMap.has(node.parentId)) childrenMap.set(node.parentId, []);
            childrenMap.get(node.parentId).push(node);
        }

        const roots = nodes.filter((node) => !node.parentId && node.kind !== 'unlinked')
            .sort((a, b) => b.createdAt - a.createdAt);
        const unlinked = nodes.filter((node) => (
            node.kind === 'unlinked' || (node.parentId && !nodeMap.has(node.parentId))
        )).sort((a, b) => b.createdAt - a.createdAt);
        const query = dialogSearch?.value.trim() || '';
        const rendered = new Set();

        appendTreeSection(dialogTree, 'Сюжеты', roots, childrenMap, query, rendered);
        appendTreeSection(
            dialogTree,
            'Без связи',
            unlinked.filter((node) => !rendered.has(node.conversationId)),
            childrenMap,
            query,
            rendered,
        );

        const leftovers = query
            ? []
            : nodes.filter((node) => !rendered.has(node.conversationId));
        appendTreeSection(dialogTree, 'Остальные', leftovers, childrenMap, query, rendered);
        dialogEmpty.hidden = dialogTree.childElementCount > 0;
        if (!dialogTree.childElementCount) {
            dialogEmpty.textContent = nodes.length && query
                ? 'По этому запросу ничего не найдено.'
                : 'Веток пока нет. Создай новый чат или клонируй текущий.';
        }
    }

    async function toggleCollapsed(conversationId) {
        if (!activeContext?.characterId) return;
        await updateGraph(activeContext.characterId, (graph) => {
            const collapsed = new Set(graph.collapsed);
            if (collapsed.has(conversationId)) collapsed.delete(conversationId);
            else collapsed.add(conversationId);
            graph.collapsed = [...collapsed];
            return graph;
        });
    }

    async function unlinkNode(node) {
        if (!activeContext?.characterId || !node?.parentId) return;
        const confirmed = confirm(
            `Отвязать «${node.title}» от родительской ветки?\n\nСам чат SpicyChat удалён не будет.`,
        );
        if (!confirmed) return;
        await updateGraph(activeContext.characterId, (graph) => {
            const current = findNode(graph, node.conversationId);
            if (current) {
                upsertNode(graph, {
                    ...current,
                    parentId: null,
                    forkMessageId: null,
                    forkExcerpt: '',
                    kind: 'unlinked',
                    relationIgnored: true,
                    relationSource: '',
                    relationCheckedAt: Date.now(),
                });
            }
            return graph;
        });
    }

    async function openDialog(anchor) {
        await ensureContext(true);
        if (!activeContext?.characterId) return;
        ensureDialog();
        dialogAnchor = anchor || dialogAnchor;
        dialog.hidden = false;
        renderDialog();
        scheduleAutomaticRelationScan();
        window.setTimeout(() => dialogSearch?.focus({ preventScroll: true }), 0);
    }

    function closeDialog() {
        if (!dialog) return;
        dialog.hidden = true;
        if (dialogSearch) dialogSearch.value = '';
    }

    function ensureEditor() {
        if (editor?.isConnected) return editor;
        editor = document.createElement('div');
        editor.id = EDITOR_ID;
        editor.hidden = true;
        editor.innerHTML = `
            <form class="tm-sc-branches-editor-card" novalidate>
                <h2>Название ветки</h2>
                <input class="tm-sc-branches-editor-input" type="text" maxlength="${TITLE_MAX_LENGTH}" autocomplete="off">
                <div class="tm-sc-branches-editor-actions">
                    <button class="tm-sc-branches-editor-cancel" type="button">Отмена</button>
                    <button class="tm-sc-branches-editor-save" type="submit">Сохранить</button>
                </div>
            </form>
        `;
        editorInput = editor.querySelector('.tm-sc-branches-editor-input');
        editor.querySelector('.tm-sc-branches-editor-cancel').addEventListener('click', closeEditor);
        editor.querySelector('form').addEventListener('submit', (event) => {
            event.preventDefault();
            void saveEditor();
        });
        editor.addEventListener('pointerdown', (event) => {
            if (event.target === editor) closeEditor();
        });
        document.body.appendChild(editor);
        return editor;
    }

    function openEditor(node) {
        ensureEditor();
        editorState = { characterId: node.characterId, conversationId: node.conversationId };
        editorInput.value = node.title;
        editor.hidden = false;
        requestAnimationFrame(() => {
            editorInput.focus({ preventScroll: true });
            editorInput.select();
        });
    }

    function closeEditor() {
        if (editor) editor.hidden = true;
        editorState = null;
    }

    async function saveEditor() {
        if (!editorState) return;
        const state = editorState;
        const title = normalizeTitle(editorInput.value);
        await updateGraph(state.characterId, (graph) => {
            const node = findNode(graph, state.conversationId);
            if (node) upsertNode(graph, { ...node, title });
            return graph;
        });
        closeEditor();
    }

    function childBranchesForMessage(messageId) {
        if (!activeContext?.conversationId || !activeGraph) return [];
        const normalizedId = String(messageId || '').replace(/^message-/, '');
        return activeGraph.nodes.filter((node) => (
            node.parentId === activeContext.conversationId
            && node.forkMessageId === normalizedId
        )).sort((a, b) => a.createdAt - b.createdAt);
    }

    function makeBranchMarker(messageId, branches, dropdown) {
        const marker = document.createElement('button');
        marker.type = 'button';
        marker.className = MARKER_CLASS;
        marker.dataset.messageId = messageId;
        marker.setAttribute('aria-label', `Ветки отсюда: ${branches.map((node) => node.title).join(', ')}`);
        marker.setAttribute('aria-expanded', 'false');
        marker.innerHTML = `${icons.branchSmall}<span class="tm-sc-branch-marker-count">${branches.length}</span>`;
        marker.addEventListener('mouseenter', () => {
            cancelPopoverClose();
            openMarkerPopover(marker, false);
        });
        marker.addEventListener('mouseleave', schedulePopoverClose);
        marker.addEventListener('focus', () => openMarkerPopover(marker, false));
        marker.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            markerPopoverPinned = !(markerPopoverMarker === marker && markerPopoverPinned);
            if (markerPopoverPinned) openMarkerPopover(marker, true);
            else closeMarkerPopover();
        });

        const bookmarkMarker = dropdown.parentElement?.querySelector('.tm-sc-message-bookmark-marker');
        (bookmarkMarker || dropdown).before(marker);
        return marker;
    }

    function ensureBranchMarkers() {
        if (!activeContext?.conversationId || !activeGraph) {
            document.querySelectorAll(`.${MARKER_CLASS}`).forEach((marker) => marker.remove());
            return;
        }

        for (const marker of document.querySelectorAll(`.${MARKER_CLASS}`)) {
            const branches = childBranchesForMessage(marker.dataset.messageId);
            const message = marker.closest(MESSAGE_SELECTOR);
            if (!branches.length || !message) marker.remove();
        }

        for (const message of document.querySelectorAll(MESSAGE_SELECTOR)) {
            const messageId = message.id.replace(/^message-/, '');
            const branches = childBranchesForMessage(messageId);
            if (!branches.length) continue;
            const dropdown = message.querySelector(MESSAGE_DROPDOWN_SELECTOR);
            if (!dropdown) continue;
            let marker = Array.from(message.querySelectorAll(`.${MARKER_CLASS}`)).find((candidate) => (
                candidate.dataset.messageId === messageId
            ));
            if (!marker) marker = makeBranchMarker(messageId, branches, dropdown);
            const label = `Ветки отсюда: ${branches.map((node) => node.title).join(', ')}`;
            if (marker.getAttribute('aria-label') !== label) marker.setAttribute('aria-label', label);
            const count = marker.querySelector('.tm-sc-branch-marker-count');
            const countText = String(branches.length);
            if (count.textContent !== countText) count.textContent = countText;
            const shouldHideCount = branches.length < 2;
            if (count.hidden !== shouldHideCount) count.hidden = shouldHideCount;
        }
    }

    function ensureMarkerPopover() {
        if (markerPopover?.isConnected) return markerPopover;
        markerPopover = document.createElement('div');
        markerPopover.id = POPOVER_ID;
        markerPopover.hidden = true;
        markerPopover.addEventListener('mouseenter', cancelPopoverClose);
        markerPopover.addEventListener('mouseleave', schedulePopoverClose);
        document.body.appendChild(markerPopover);
        return markerPopover;
    }

    function openMarkerPopover(marker, pinned) {
        const branches = childBranchesForMessage(marker.dataset.messageId);
        if (!branches.length) return;
        ensureMarkerPopover();
        markerPopoverMarker = marker;
        markerPopoverPinned = Boolean(pinned) || markerPopoverPinned;
        markerPopover.replaceChildren();

        const title = document.createElement('div');
        title.className = 'tm-sc-branch-popover-title';
        title.textContent = 'Ветки отсюда';
        markerPopover.appendChild(title);
        for (const node of branches) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'tm-sc-branch-popover-item';
            button.innerHTML = `${nodeKindIcon(node)}<span></span>`;
            button.querySelector('span').textContent = node.title;
            button.addEventListener('click', () => navigateToConversation(node));
            markerPopover.appendChild(button);
        }
        markerPopover.hidden = false;
        marker.setAttribute('aria-expanded', 'true');
        positionMarkerPopover(marker);
    }

    function positionMarkerPopover(marker) {
        if (!markerPopover || markerPopover.hidden || !marker?.isConnected) return;
        const rect = marker.getBoundingClientRect();
        const width = Math.min(320, window.innerWidth - 20);
        const height = markerPopover.offsetHeight || 110;
        const left = Math.max(10, Math.min(window.innerWidth - width - 10, rect.right - width));
        const below = rect.bottom + 7;
        const top = below + height <= window.innerHeight - 10
            ? below
            : Math.max(10, rect.top - height - 7);
        markerPopover.style.left = `${Math.round(left)}px`;
        markerPopover.style.top = `${Math.round(top)}px`;
    }

    function cancelPopoverClose() {
        if (!markerPopoverCloseTimer) return;
        clearTimeout(markerPopoverCloseTimer);
        markerPopoverCloseTimer = null;
    }

    function schedulePopoverClose() {
        cancelPopoverClose();
        if (markerPopoverPinned) return;
        markerPopoverCloseTimer = window.setTimeout(closeMarkerPopover, 180);
    }

    function closeMarkerPopover() {
        cancelPopoverClose();
        if (markerPopoverMarker?.isConnected) markerPopoverMarker.setAttribute('aria-expanded', 'false');
        if (markerPopover) markerPopover.hidden = true;
        markerPopoverMarker = null;
        markerPopoverPinned = false;
    }

    async function ensureContext(force = false) {
        const next = getChatContext();
        if (!force && next?.key === activeContext?.key && activeGraph) return activeGraph;

        const token = ++contextToken;
        activeContext = next;
        activeGraph = null;
        closeMarkerPopover();
        document.querySelectorAll(`.${MARKER_CLASS}`).forEach((marker) => marker.remove());
        if (!next?.characterId) {
            closeDialog();
            return null;
        }

        activeGraph = await readGraph(next.characterId);
        if (token !== contextToken || activeContext?.key !== next.key) return;

        if (next.conversationId && !findNode(activeGraph, next.conversationId)) {
            activeGraph = await updateGraph(next.characterId, (graph) => {
                if (findNode(graph, next.conversationId)) return graph;
                upsertNode(graph, {
                    conversationId: next.conversationId,
                    characterId: next.characterId,
                    title: makeDefaultTitle(graph.nodes.length ? 'unlinked' : 'root'),
                    parentId: null,
                    forkMessageId: null,
                    forkExcerpt: '',
                    kind: graph.nodes.length ? 'unlinked' : 'root',
                    createdAt: Date.now(),
                    relationCheckedAt: 0,
                });
                return graph;
            });
        }

        if (token !== contextToken || activeContext?.key !== next.key) return;
        renderDialog();
        ensureBranchMarkers();
        scheduleAutomaticRelationScan();
        return activeGraph;
    }

    function scheduleEnsure() {
        if (ensureScheduled) return;
        ensureScheduled = true;
        requestAnimationFrame(runDomPass);
    }

    function isOwnBranchMutation(node) {
        const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
        return Boolean(element?.closest?.(
            `#${DIALOG_ID}, #${EDITOR_ID}, #${POPOVER_ID}, .${MARKER_CLASS}`,
        ));
    }

    function nodeTouchesBranchSurface(node, includeDescendants = true) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE || isOwnBranchMutation(node)) return false;
        const selector = [
            MESSAGE_SELECTOR,
            MESSAGE_DROPDOWN_SELECTOR,
            CHAT_DROPDOWN_SELECTOR,
            'button[aria-label="View Saved Chats" i]',
            '[data-testid="ChatsSortDropdown-Trigger"]',
        ].join(', ');
        return (
            node.matches?.(selector)
            || (includeDescendants && Boolean(node.querySelector?.(selector)))
        );
    }

    function handleRootMutations(records) {
        const relevant = records.some((record) => {
            if (isOwnBranchMutation(record.target)) return false;
            return (
                nodeTouchesBranchSurface(record.target, false)
                || Array.from(record.addedNodes).some((node) => nodeTouchesBranchSurface(node, true))
                || Array.from(record.removedNodes).some((node) => nodeTouchesBranchSurface(node, true))
            );
        });
        if (relevant) scheduleEnsure();
    }

    function handleKeydown(event) {
        if (event.key !== 'Escape') return;
        if (editor && !editor.hidden) {
            event.preventDefault();
            closeEditor();
        } else if (markerPopover && !markerPopover.hidden) {
            event.preventDefault();
            closeMarkerPopover();
        } else if (dialog && !dialog.hidden) {
            event.preventDefault();
            closeDialog();
        }
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
            ensureDialog();
            ensureEditor();
            ensureMarkerPopover();
            ensureChatMenuItem();
            ensureSavedChatsTreeButton();

            if (!rootObserver) {
                rootObserver = new MutationObserver(handleRootMutations);
                rootObserver.observe(document.documentElement, { childList: true, subtree: true });
            }
            document.addEventListener('keydown', handleKeydown, true);
            resetRetry();
        } catch (error) {
            rootObserver?.disconnect();
            rootObserver = null;
            document.removeEventListener('keydown', handleKeydown, true);
            console.error('[Chat Branches] DOM-инициализация сорвалась, повторю автоматически.', error);
            scheduleRetry();
            return;
        }

        const lifecycleToken = domLifecycleToken;
        void ensureContext().then(() => {
            if (
                lifecycleToken !== domLifecycleToken
                || typeof document === 'undefined'
                || !document.documentElement
            ) return;
            ensureChatMenuItem();
            ensureSavedChatsTreeButton();
            ensureBranchMarkers();
        }).catch((error) => {
            console.error('[Chat Branches] Контекст не загрузился, повторю автоматически.', error);
        });
    }

    function startDomFeatures() {
        runDomPass();
    }

    function cleanup() {
        domLifecycleToken += 1;
        rootObserver?.disconnect();
        rootObserver = null;
        ensureScheduled = false;
        resetRetry();
        if (autoScanTimer) window.clearTimeout(autoScanTimer);
        autoScanTimer = null;
        if (relationScan?.running) relationScan.cancelRequested = true;
        document.removeEventListener('keydown', handleKeydown, true);
    }

    installNetworkCapture();
    installRouteChangeSignal();
    window.addEventListener('pagehide', cleanup);
    window.addEventListener(ROUTE_CHANGE_EVENT, startDomFeatures);
    window.addEventListener('pageshow', startDomFeatures);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) startDomFeatures();
    });
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startDomFeatures, { once: true });
    }
    startDomFeatures();
    runtime.dom?.subscribe(scheduleEnsure);

}


// ---- src/modules/bookmarks.js ----

// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
function init_bookmarks(runtime) {
    'use strict';

    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const INSTANCE_KEY = '__spicyChatMessageBookmarksV1';
    if (window[INSTANCE_KEY]) return;
    window[INSTANCE_KEY] = true;

    const MESSAGE_SELECTOR = 'div[id^="message-"]';
    const MESSAGE_DROPDOWN_SELECTOR = 'button[aria-label="message-dropdown" i]';
    const SAVED_TEXT_MENU_ITEM_SELECTOR = '.tm-sc-save-history-message';
    const CHAT_DROPDOWN_SELECTOR = 'button[aria-label="chat-dropdown" i]';
    const MESSAGE_TEXT_CLASS_TOKEN = '[overflow-wrap:anywhere]';

    const STYLE_ID = 'tm-sc-message-bookmarks-style';
    const MESSAGE_MENU_ITEM_CLASS = 'tm-sc-add-message-bookmark';
    const CHAT_MENU_ITEM_CLASS = 'tm-sc-open-message-bookmarks';
    const MARKER_CLASS = 'tm-sc-message-bookmark-marker';
    const HIGHLIGHT_CLASS = 'tm-sc-message-bookmark-highlight';
    const PANEL_ID = 'tm-sc-message-bookmarks-panel';
    const EDITOR_ID = 'tm-sc-message-bookmarks-editor';
    const MARKER_POPOVER_ID = 'tm-sc-message-bookmark-popover';
    const HISTORY_SEARCH_ID = 'tm-sc-message-bookmark-history-search';
    const TOAST_ID = 'tm-sc-message-bookmarks-toast';
    const ROUTE_CHANGE_EVENT = 'tm-sc-route-change';
    const CHAT_MENU_ITEM_ORDER = [
        'tm-sc-open-message-bookmarks',
        'tm-sc-open-conversation-gallery',
        'tm-sc-open-gpt-summary',
        'tm-sc-open-chat-branches',
    ];
    const STORAGE_PREFIX = 'tm-sc-message-bookmarks-v1:conversation:';
    const LOAD_PREVIOUS_SELECTOR = '[data-translate-key="chat:page.action.loadPreviousMessages"]';
    const HISTORY_BATCH_TIMEOUT = 25000;
    const TITLE_MAX_LENGTH = 100;

    let activeStorageKey = null;
    let activeContext = null;
    let entries = [];
    let contextLoadToken = 0;
    let storageQueue = Promise.resolve();
    let ensureScheduled = false;

    let panel = null;
    let panelList = null;
    let panelCount = null;
    let panelAnchor = null;
    let panelConfirmDeleteId = null;

    let editor = null;
    let editorTitle = null;
    let editorInput = null;
    let editorState = null;

    let markerPopover = null;
    let markerPopoverState = null;
    let markerPopoverCloseTimer = null;
    let markerPopoverPinned = false;

    let historySearchOverlay = null;
    let historySearchTitle = null;
    let historySearchStatus = null;
    let historySearchBatches = null;
    let historySearchMessages = null;
    let historySearchCancelButton = null;
    let historySearchRetryButton = null;
    let historySearchCloseButton = null;
    let historySearchState = null;
    let historySearchToken = 0;

    let toastTimer = null;
    let scrollAnimationToken = 0;
    let timestampBackfillScheduled = false;
    let rootObserver = null;
    let retryTimer = null;
    let retryDelay = 250;

    const moscowDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });

    const icons = {
        bookmark: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 3h12a2 2 0 0 1 2 2v16l-8-5-8 5V5a2 2 0 0 1 2-2z"></path>
            </svg>`,
        bookmarkFilled: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                 viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.6"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 3h12a2 2 0 0 1 2 2v16l-8-5-8 5V5a2 2 0 0 1 2-2z"></path>
            </svg>`,
        pencil: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
            </svg>`,
        trash: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"></path><path d="M8 6V4h8v2"></path>
                <path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v5"></path><path d="M14 11v5"></path>
            </svg>`,
        close: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="m18 6-12 12"></path><path d="m6 6 12 12"></path>
            </svg>`,
    };

    function normalizeMessageTimestamp(value) {
        if (value === null || value === undefined || value === '') return null;

        let timestamp = Number(value);
        if (!Number.isFinite(timestamp) && typeof value === 'string') {
            timestamp = Date.parse(value);
        }
        if (!Number.isFinite(timestamp) || timestamp <= 0) return null;

        // Страховка на случай, если API когда-нибудь начнёт отдавать секунды вместо миллисекунд.
        return timestamp < 100000000000 ? timestamp * 1000 : timestamp;
    }

    function installRouteChangeSignal() {
        const key = '__tmScRouteChangeSignalV1';
        if (pageWindow[key]) return;
        const dispatch = () => pageWindow.dispatchEvent(new pageWindow.Event(ROUTE_CHANGE_EVENT));
        for (const method of ['pushState', 'replaceState']) {
            const original = pageWindow.history?.[method];
            if (typeof original !== 'function') continue;
            pageWindow.history[method] = function (...args) {
                const result = Reflect.apply(original, this, args);
                dispatch();
                return result;
            };
        }
        pageWindow.addEventListener('popstate', dispatch);
        pageWindow.addEventListener('hashchange', dispatch);
        pageWindow[key] = true;
    }

    function toDomMessageId(rawId) {
        if (typeof rawId !== 'string' || !rawId.trim()) return null;
        const id = rawId.trim();
        return id.startsWith('message-') ? id : `message-${id}`;
    }

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${PANEL_ID}[hidden],
            #${EDITOR_ID}[hidden],
            #${MARKER_POPOVER_ID}[hidden],
            #${HISTORY_SEARCH_ID}[hidden],
            #${TOAST_ID}[hidden] {
                display: none !important;
            }

            #${HISTORY_SEARCH_ID} [hidden] {
                display: none !important;
            }

            .${MARKER_CLASS} {
                appearance: none !important;
                box-sizing: border-box !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                vertical-align: middle !important;
                width: 20px !important;
                min-width: 20px !important;
                height: 28px !important;
                padding: 0 !important;
                margin: 0 !important;
                color: #f5b942 !important;
                background: transparent !important;
                border: 0 !important;
                border-radius: 9999px !important;
                cursor: pointer !important;
                line-height: 1 !important;
                transition: color 120ms ease, background-color 120ms ease, transform 120ms ease !important;
            }

            .${MARKER_CLASS}:hover,
            .${MARKER_CLASS}:focus-visible,
            .${MARKER_CLASS}[aria-expanded="true"] {
                color: #ffd66b !important;
                background: rgba(245, 185, 66, 0.13) !important;
                transform: translateY(-1px) !important;
                outline: none !important;
            }

            #${PANEL_ID},
            #${MARKER_POPOVER_ID},
            .tm-sc-bookmark-editor-card {
                box-sizing: border-box !important;
                color: #1f2937 !important;
                background: #ffffff !important;
                border: 1px solid rgba(17, 24, 39, 0.12) !important;
                box-shadow: 0 16px 44px rgba(0, 0, 0, 0.24) !important;
                font-family: inherit !important;
            }

            .dark #${PANEL_ID},
            .dark #${MARKER_POPOVER_ID},
            .dark .tm-sc-bookmark-editor-card {
                color: #f3f4f6 !important;
                background: #27272a !important;
                border-color: rgba(255, 255, 255, 0.12) !important;
            }

            #${PANEL_ID} {
                position: fixed !important;
                z-index: 10020 !important;
                width: min(390px, calc(100vw - 24px)) !important;
                max-height: min(68vh, 640px) !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
                border-radius: 14px !important;
            }

            .tm-sc-bookmarks-panel-header {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 12px !important;
                padding: 14px 14px 11px !important;
                border-bottom: 1px solid rgba(17, 24, 39, 0.1) !important;
            }

            .dark .tm-sc-bookmarks-panel-header {
                border-bottom-color: rgba(255, 255, 255, 0.1) !important;
            }

            .tm-sc-bookmarks-panel-heading {
                display: flex !important;
                align-items: baseline !important;
                gap: 8px !important;
                min-width: 0 !important;
            }

            .tm-sc-bookmarks-panel-title {
                margin: 0 !important;
                font-size: 16px !important;
                line-height: 1.25 !important;
                font-weight: 650 !important;
            }

            .tm-sc-bookmarks-panel-count {
                color: #6b7280 !important;
                font-size: 12px !important;
            }

            .dark .tm-sc-bookmarks-panel-count {
                color: #a1a1aa !important;
            }

            .tm-sc-bookmarks-close,
            .tm-sc-bookmark-icon-button {
                appearance: none !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                flex: 0 0 auto !important;
                padding: 0 !important;
                color: inherit !important;
                background: transparent !important;
                border: 0 !important;
                border-radius: 8px !important;
                cursor: pointer !important;
            }

            .tm-sc-bookmarks-close {
                width: 30px !important;
                height: 30px !important;
            }

            .tm-sc-bookmark-icon-button {
                width: 31px !important;
                height: 31px !important;
            }

            .tm-sc-bookmarks-close:hover,
            .tm-sc-bookmark-icon-button:hover {
                background: rgba(107, 114, 128, 0.13) !important;
            }

            .tm-sc-bookmark-icon-button.is-danger {
                color: #dc2626 !important;
            }

            .dark .tm-sc-bookmark-icon-button.is-danger {
                color: #f87171 !important;
            }

            .tm-sc-bookmarks-list {
                min-height: 0 !important;
                overflow-y: auto !important;
                padding: 9px !important;
                scrollbar-width: thin !important;
            }

            .tm-sc-bookmark-card {
                display: grid !important;
                grid-template-columns: minmax(0, 1fr) auto !important;
                align-items: center !important;
                gap: 9px !important;
                margin: 0 0 7px !important;
                padding: 10px !important;
                background: rgba(107, 114, 128, 0.065) !important;
                border: 1px solid transparent !important;
                border-radius: 11px !important;
                transition: background-color 120ms ease, border-color 120ms ease !important;
            }

            .tm-sc-bookmark-card:last-child {
                margin-bottom: 0 !important;
            }

            .tm-sc-bookmark-card:hover {
                background: rgba(124, 58, 237, 0.08) !important;
                border-color: rgba(124, 58, 237, 0.2) !important;
            }

            .dark .tm-sc-bookmark-card {
                background: rgba(255, 255, 255, 0.055) !important;
            }

            .dark .tm-sc-bookmark-card:hover {
                background: rgba(167, 139, 250, 0.1) !important;
                border-color: rgba(167, 139, 250, 0.25) !important;
            }

            .tm-sc-bookmark-card-main {
                min-width: 0 !important;
                cursor: pointer !important;
                border-radius: 7px !important;
                outline: none !important;
            }

            .tm-sc-bookmark-card-main:focus-visible {
                box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.4) !important;
            }

            .tm-sc-bookmark-card-title {
                margin: 0 0 4px !important;
                overflow: hidden !important;
                color: inherit !important;
                font-size: 14px !important;
                line-height: 1.3 !important;
                font-weight: 650 !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }

            .tm-sc-bookmark-card-excerpt {
                display: -webkit-box !important;
                margin: 0 !important;
                overflow: hidden !important;
                color: #6b7280 !important;
                font-size: 12.5px !important;
                line-height: 1.35 !important;
                overflow-wrap: anywhere !important;
                -webkit-box-orient: vertical !important;
                -webkit-line-clamp: 2 !important;
            }

            .dark .tm-sc-bookmark-card-excerpt {
                color: #a1a1aa !important;
            }

            .tm-sc-bookmark-card-meta {
                margin-top: 5px !important;
                color: #9ca3af !important;
                font-size: 10.5px !important;
                line-height: 1.2 !important;
            }

            .tm-sc-bookmark-card-actions {
                display: flex !important;
                align-items: center !important;
                gap: 2px !important;
            }

            .tm-sc-bookmark-confirm {
                display: flex !important;
                align-items: center !important;
                gap: 5px !important;
            }

            .tm-sc-bookmark-confirm-label {
                color: #dc2626 !important;
                font-size: 11px !important;
                white-space: nowrap !important;
            }

            .dark .tm-sc-bookmark-confirm-label {
                color: #fca5a5 !important;
            }

            .tm-sc-bookmark-confirm-button,
            .tm-sc-bookmark-editor-button {
                appearance: none !important;
                border: 0 !important;
                border-radius: 8px !important;
                cursor: pointer !important;
                font-family: inherit !important;
                font-weight: 600 !important;
            }

            .tm-sc-bookmark-confirm-button {
                padding: 6px 8px !important;
                font-size: 11px !important;
            }

            .tm-sc-bookmark-confirm-button.is-yes {
                color: #ffffff !important;
                background: #dc2626 !important;
            }

            .tm-sc-bookmark-confirm-button.is-no {
                color: inherit !important;
                background: rgba(107, 114, 128, 0.15) !important;
            }

            .tm-sc-bookmarks-empty {
                padding: 32px 18px !important;
                color: #6b7280 !important;
                font-size: 13px !important;
                line-height: 1.45 !important;
                text-align: center !important;
            }

            .dark .tm-sc-bookmarks-empty {
                color: #a1a1aa !important;
            }

            #${EDITOR_ID} {
                position: fixed !important;
                inset: 0 !important;
                z-index: 10050 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 18px !important;
                background: rgba(0, 0, 0, 0.38) !important;
                backdrop-filter: blur(2px) !important;
            }

            .tm-sc-bookmark-editor-card {
                width: min(410px, calc(100vw - 28px)) !important;
                padding: 17px !important;
                border-radius: 14px !important;
            }

            .tm-sc-bookmark-editor-title {
                margin: 0 0 12px !important;
                color: inherit !important;
                font-size: 16px !important;
                line-height: 1.3 !important;
                font-weight: 650 !important;
            }

            .tm-sc-bookmark-editor-input {
                box-sizing: border-box !important;
                width: 100% !important;
                height: 40px !important;
                padding: 0 11px !important;
                color: inherit !important;
                background: rgba(107, 114, 128, 0.08) !important;
                border: 1px solid rgba(107, 114, 128, 0.28) !important;
                border-radius: 9px !important;
                outline: none !important;
                font-family: inherit !important;
                font-size: 14px !important;
            }

            .tm-sc-bookmark-editor-input:focus {
                border-color: #8b5cf6 !important;
                box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.16) !important;
            }

            .tm-sc-bookmark-editor-actions {
                display: flex !important;
                justify-content: flex-end !important;
                gap: 8px !important;
                margin-top: 14px !important;
            }

            .tm-sc-bookmark-editor-button {
                min-height: 36px !important;
                padding: 0 13px !important;
                font-size: 13px !important;
            }

            .tm-sc-bookmark-editor-button.is-cancel {
                color: inherit !important;
                background: rgba(107, 114, 128, 0.14) !important;
            }

            .tm-sc-bookmark-editor-button.is-save {
                color: #ffffff !important;
                background: #7c3aed !important;
            }

            .tm-sc-bookmark-editor-button.is-save:hover {
                background: #6d28d9 !important;
            }

            #${MARKER_POPOVER_ID} {
                position: fixed !important;
                z-index: 10040 !important;
                width: min(286px, calc(100vw - 20px)) !important;
                padding: 11px !important;
                border-radius: 11px !important;
            }

            .tm-sc-bookmark-popover-title {
                margin: 0 0 9px !important;
                overflow: hidden !important;
                color: inherit !important;
                font-size: 13px !important;
                line-height: 1.35 !important;
                font-weight: 650 !important;
                overflow-wrap: anywhere !important;
            }

            .tm-sc-bookmark-popover-actions {
                display: flex !important;
                justify-content: flex-end !important;
                gap: 4px !important;
            }

            #${HISTORY_SEARCH_ID} {
                position: fixed !important;
                inset: 0 !important;
                z-index: 10080 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 18px !important;
                background: rgba(0, 0, 0, 0.3) !important;
                backdrop-filter: blur(1.5px) !important;
                font-family: inherit !important;
            }

            .tm-sc-history-search-card {
                box-sizing: border-box !important;
                width: min(430px, calc(100vw - 28px)) !important;
                padding: 18px !important;
                color: #1f2937 !important;
                background: #ffffff !important;
                border: 1px solid rgba(17, 24, 39, 0.12) !important;
                border-radius: 15px !important;
                box-shadow: 0 20px 58px rgba(0, 0, 0, 0.34) !important;
            }

            .dark .tm-sc-history-search-card {
                color: #f3f4f6 !important;
                background: #27272a !important;
                border-color: rgba(255, 255, 255, 0.13) !important;
            }

            .tm-sc-history-search-title {
                margin: 0 0 7px !important;
                color: inherit !important;
                font-size: 17px !important;
                line-height: 1.3 !important;
                font-weight: 680 !important;
            }

            .tm-sc-history-search-status {
                min-height: 38px !important;
                margin: 0 0 13px !important;
                color: #6b7280 !important;
                font-size: 13px !important;
                line-height: 1.45 !important;
            }

            .dark .tm-sc-history-search-status {
                color: #b4b4bd !important;
            }

            .tm-sc-history-progress-track {
                position: relative !important;
                height: 7px !important;
                overflow: hidden !important;
                background: rgba(107, 114, 128, 0.18) !important;
                border-radius: 9999px !important;
            }

            .tm-sc-history-progress-bar {
                position: absolute !important;
                top: 0 !important;
                bottom: 0 !important;
                left: -46% !important;
                width: 46% !important;
                background: linear-gradient(90deg, #7c3aed, #c4b5fd, #7c3aed) !important;
                border-radius: inherit !important;
                animation: tm-sc-history-progress 1.15s ease-in-out infinite !important;
            }

            #${HISTORY_SEARCH_ID}.is-success .tm-sc-history-progress-bar,
            #${HISTORY_SEARCH_ID}.is-error .tm-sc-history-progress-bar {
                left: 0 !important;
                width: 100% !important;
                animation: none !important;
            }

            #${HISTORY_SEARCH_ID}.is-success .tm-sc-history-progress-bar {
                background: #22c55e !important;
            }

            #${HISTORY_SEARCH_ID}.is-error .tm-sc-history-progress-bar {
                background: #ef4444 !important;
            }

            .tm-sc-history-search-metrics {
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 7px 15px !important;
                margin-top: 10px !important;
                color: #6b7280 !important;
                font-size: 11.5px !important;
                line-height: 1.3 !important;
            }

            .dark .tm-sc-history-search-metrics {
                color: #a1a1aa !important;
            }

            .tm-sc-history-search-actions {
                display: flex !important;
                justify-content: flex-end !important;
                gap: 8px !important;
                margin-top: 16px !important;
            }

            .tm-sc-history-search-button {
                appearance: none !important;
                min-height: 36px !important;
                padding: 0 13px !important;
                color: inherit !important;
                background: rgba(107, 114, 128, 0.14) !important;
                border: 0 !important;
                border-radius: 8px !important;
                cursor: pointer !important;
                font-family: inherit !important;
                font-size: 13px !important;
                font-weight: 620 !important;
            }

            .tm-sc-history-search-button.is-primary {
                color: #ffffff !important;
                background: #7c3aed !important;
            }

            .tm-sc-history-search-button:hover {
                filter: brightness(1.06) !important;
            }

            @keyframes tm-sc-history-progress {
                0% { transform: translateX(0); }
                100% { transform: translateX(318%); }
            }

            #${TOAST_ID} {
                position: fixed !important;
                left: 50% !important;
                bottom: 24px !important;
                z-index: 10070 !important;
                transform: translateX(-50%) !important;
                padding: 9px 13px !important;
                color: #ffffff !important;
                background: rgba(17, 24, 39, 0.94) !important;
                border: 1px solid rgba(255, 255, 255, 0.13) !important;
                border-radius: 10px !important;
                box-shadow: 0 10px 32px rgba(0, 0, 0, 0.3) !important;
                font-size: 13px !important;
                line-height: 1.3 !important;
                pointer-events: none !important;
            }

            .${HIGHLIGHT_CLASS} {
                position: relative !important;
                z-index: 1 !important;
                isolation: isolate !important;
            }

            .${HIGHLIGHT_CLASS}::after {
                content: "" !important;
                position: absolute !important;
                inset: -3px !important;
                z-index: 3 !important;
                border: 3px solid rgba(196, 181, 253, 0.98) !important;
                border-radius: inherit !important;
                background: rgba(139, 92, 246, 0.1) !important;
                box-shadow: 0 0 0 4px rgba(167, 139, 250, 0.48), 0 0 34px rgba(139, 92, 246, 0.58) !important;
                opacity: 0;
                pointer-events: none !important;
                animation: tm-sc-bookmark-flash 1.3s ease-in-out both !important;
            }

            @keyframes tm-sc-bookmark-flash {
                0% {
                    opacity: 0;
                }
                28% {
                    opacity: 1;
                }
                100% {
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function getChatContext() {
        const parts = location.pathname.split('/').filter(Boolean);
        if (parts[0] !== 'chat' || !parts[1]) return null;

        const botId = parts[1];
        const conversationId = parts[2] || 'default';
        return {
            botId,
            conversationId,
            storageKey: `${STORAGE_PREFIX}${botId}:${conversationId}`,
        };
    }

    async function readValue(key, fallbackValue) {
        try {
            if (typeof GM_getValue === 'function') {
                const value = await Promise.resolve(GM_getValue(key, fallbackValue));
                return value === undefined ? fallbackValue : value;
            }
        } catch (error) {
            console.warn('[Message Bookmarks] Не удалось прочитать данные Tampermonkey.', error);
        }

        try {
            const raw = localStorage.getItem(key);
            return raw === null ? fallbackValue : JSON.parse(raw);
        } catch (_error) {
            return fallbackValue;
        }
    }

    async function writeValue(key, value) {
        if (typeof GM_setValue === 'function') {
            await Promise.resolve(GM_setValue(key, value));
            return;
        }
        localStorage.setItem(key, JSON.stringify(value));
    }

    function makeId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function normalizeEntries(value) {
        if (!Array.isArray(value)) return [];
        const now = Date.now();

        return value
            .filter((entry) => entry && typeof entry === 'object' && typeof entry.messageId === 'string')
            .map((entry, index) => ({
                id: typeof entry.id === 'string' && entry.id ? entry.id : `legacy-${now}-${index}`,
                messageId: entry.messageId,
                title: typeof entry.title === 'string' && entry.title.trim()
                    ? entry.title.trim().slice(0, TITLE_MAX_LENGTH)
                    : 'Закладка',
                excerpt: typeof entry.excerpt === 'string' ? entry.excerpt : '',
                fullText: typeof entry.fullText === 'string' ? entry.fullText : '',
                author: typeof entry.author === 'string' && entry.author.trim() ? entry.author.trim() : 'Сообщение',
                messageCreatedAt: normalizeMessageTimestamp(entry.messageCreatedAt),
                createdAt: Number.isFinite(Number(entry.createdAt)) ? Number(entry.createdAt) : now - index,
                updatedAt: Number.isFinite(Number(entry.updatedAt)) ? Number(entry.updatedAt) : now - index,
            }))
            .filter((entry, index, array) => (
                array.findIndex((candidate) => candidate.messageId === entry.messageId) === index
            ));
    }

    async function readEntries(key) {
        return normalizeEntries(await readValue(key, []));
    }

    function updateEntries(key, updater) {
        const operation = storageQueue.then(async () => {
            const latest = await readEntries(key);
            const next = normalizeEntries(updater(latest));
            await writeValue(key, next);
            return next;
        });

        storageQueue = operation.catch(() => undefined);
        return operation;
    }

    function getCapturedMessageTimestamp(messageId) {
        const message = getMessageElement(messageId);
        const time = message?.querySelector('time.tm-sc-message-sent-at[datetime]');
        return normalizeMessageTimestamp(time?.dateTime);
    }

    function scheduleTimestampBackfill() {
        if (timestampBackfillScheduled) return;
        timestampBackfillScheduled = true;

        window.setTimeout(() => {
            timestampBackfillScheduled = false;
            void backfillBookmarkTimestamps();
        }, 0);
    }

    async function backfillBookmarkTimestamps() {
        if (!activeStorageKey || !entries.length) return;
        const storageKey = activeStorageKey;
        const needsBackfill = entries.some((entry) => {
            const captured = getCapturedMessageTimestamp(entry.messageId);
            return captured && captured !== entry.messageCreatedAt;
        });
        if (!needsBackfill) return;

        try {
            const updated = await updateEntries(storageKey, (latest) => latest.map((entry) => {
                const captured = getCapturedMessageTimestamp(entry.messageId);
                return captured && captured !== entry.messageCreatedAt
                    ? { ...entry, messageCreatedAt: captured }
                    : entry;
            }));

            if (activeStorageKey !== storageKey) return;
            entries = updated;
            if (panel && !panel.hidden) renderPanel();
        } catch (error) {
            console.warn('[Message Bookmarks] Не удалось дописать время старым закладкам.', error);
        }
    }

    function ensureContext() {
        const context = getChatContext();
        const nextKey = context?.storageKey || null;
        if (nextKey === activeStorageKey) return;

        activeContext = context;
        activeStorageKey = nextKey;
        entries = [];
        contextLoadToken += 1;
        const token = contextLoadToken;

        closePanel();
        closeEditor();
        closeMarkerPopover();
        cancelHistorySearch();
        removeAllMarkers();

        if (!nextKey) return;

        void readEntries(nextKey).then((loaded) => {
            if (token !== contextLoadToken || activeStorageKey !== nextKey) return;
            entries = loaded;
            scheduleTimestampBackfill();
            ensureBookmarkMarkers();
            if (panel && !panel.hidden) renderPanel();
        }).catch((error) => {
            console.error('[Message Bookmarks] Не удалось загрузить закладки.', error);
        });
    }

    function getEntry(messageId) {
        return entries.find((entry) => entry.messageId === messageId) || null;
    }

    function getMessageElement(messageId) {
        const element = document.getElementById(messageId);
        return element && element.matches(MESSAGE_SELECTOR) ? element : null;
    }

    function getMessageRoot(node) {
        const root = node?.closest?.(MESSAGE_SELECTOR) || runtime.dom?.messageFor(node);
        return root && root.id ? root : null;
    }

    function findMessageTextContainer(message) {
        if (!message) return null;
        return Array.from(message.querySelectorAll('[class]')).find((element) => (
            element.classList.contains(MESSAGE_TEXT_CLASS_TOKEN)
        )) || null;
    }

    function findMessageBubble(message) {
        if (!message) return null;

        const textContainer = findMessageTextContainer(message);
        const dropdown = message.querySelector(MESSAGE_DROPDOWN_SELECTOR);
        if (!textContainer) return message;
        if (!dropdown) return textContainer.parentElement?.parentElement || message;

        let candidate = textContainer.parentElement;
        while (candidate && candidate !== message) {
            if (candidate.contains(dropdown)) return candidate;
            candidate = candidate.parentElement;
        }

        return message;
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

    function extractMessageData(message) {
        const textContainer = findMessageTextContainer(message);
        const fullText = normalizePlainText(textContainer?.innerText || textContainer?.textContent || '');
        const excerpt = fullText.replace(/\s+/g, ' ').trim().slice(0, 240);
        const botName = message.querySelector('a[href^="/chatbot/"] p')?.textContent?.trim();
        const author = botName || 'Вы';
        const defaultTitle = (excerpt || `${author}: сообщение`).slice(0, 72);

        return { fullText, excerpt, author, defaultTitle };
    }

    function formatMessageDateTime(timestamp) {
        const normalized = normalizeMessageTimestamp(timestamp);
        if (!normalized) return '';

        try {
            const parts = Object.fromEntries(
                moscowDateTimeFormatter.formatToParts(new Date(normalized))
                    .map((part) => [part.type, part.value]),
            );
            return `${parts.day}.${parts.month}.${parts.year}, ${parts.hour}:${parts.minute}`;
        } catch (_error) {
            return '';
        }
    }

    function cloneMenuButton(template, className, ariaLabel, labelText, icon) {
        const button = runtime.dom.cloneMenuButton(template);
        button.classList.remove(
            'tm-sc-save-history-message',
            MESSAGE_MENU_ITEM_CLASS,
            CHAT_MENU_ITEM_CLASS,
        );
        button.classList.add(className);
        button.removeAttribute('target');
        button.removeAttribute('data-tm-saving');
        button.disabled = false;
        button.type = 'button';
        button.setAttribute('aria-label', ariaLabel);

        const oldIcon = button.querySelector('svg');
        if (oldIcon) oldIcon.outerHTML = icon;
        else button.insertAdjacentHTML('afterbegin', icon);

        const labels = Array.from(button.querySelectorAll('p, span'));
        const primaryLabel = labels[0];
        if (primaryLabel) primaryLabel.textContent = labelText;
        else { const span = document.createElement('span'); span.textContent = labelText; button.append(span); }
        for (const extra of labels.slice(1)) extra.remove();

        return button;
    }

    function closeMessageMenu(message) {
        const dropdown = message?.querySelector(MESSAGE_DROPDOWN_SELECTOR);
        if (dropdown?.isConnected) dropdown.click();
    }

    function ensureMessageMenuItems() {
        for (const { menu, template } of runtime.dom?.messageMenus() || []) {
            const saveItem = menu.querySelector(SAVED_TEXT_MENU_ITEM_SELECTOR) || template;

            let button = menu.querySelector(`.${MESSAGE_MENU_ITEM_CLASS}`);
            if (!button) {
                button = cloneMenuButton(
                    saveItem,
                    MESSAGE_MENU_ITEM_CLASS,
                    'Добавить сообщение в закладки',
                    'Добавить в закладки',
                    icons.bookmark,
                );
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();

                    const currentMessage = getMessageRoot(button);
                    if (!currentMessage) return;
                    const messageId = currentMessage.id;
                    closeMessageMenu(currentMessage);
                    window.setTimeout(() => openEditorForMessage(messageId), 0);
                });
            }

            if (saveItem.nextElementSibling !== button) saveItem.after(button);
        }
    }

    function findChatMenu(dropdown) {
        return runtime.dom.chatMenu(dropdown);
    }

    function normalizeCustomChatMenuOrder(menu) {
        const desired = CHAT_MENU_ITEM_ORDER
            .map((className) => menu.querySelector(`.${className}`))
            .filter(Boolean);
        if (!desired.length) return;

        const currentPrefix = Array.from(menu.children).slice(0, desired.length);
        if (desired.every((item, index) => currentPrefix[index] === item)) return;

        const customClasses = new Set(CHAT_MENU_ITEM_ORDER);
        const firstNative = Array.from(menu.children).find((item) => (
            !Array.from(customClasses).some((className) => item.classList.contains(className))
        )) || null;
        for (const item of desired) menu.insertBefore(item, firstNative);
    }

    function ensureChatMenuItems() {
        for (const dropdown of document.querySelectorAll(CHAT_DROPDOWN_SELECTOR)) {
            const menu = findChatMenu(dropdown);
            if (!menu) continue;

            let button = menu.querySelector(`.${CHAT_MENU_ITEM_CLASS}`);
            if (!button) {
                const template = menu.querySelector('button[aria-label="View Saved Chats" i]')
                    || menu.querySelector('button, [role="menuitem"]');
                if (!template) continue;

                button = cloneMenuButton(
                    template,
                    CHAT_MENU_ITEM_CLASS,
                    'Закладки',
                    'Закладки',
                    icons.bookmark,
                );
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();

                    panelAnchor = dropdown;
                    dropdown.click();
                    window.setTimeout(() => openPanel(dropdown), 0);
                });
                menu.insertBefore(button, menu.firstElementChild);
            }

            normalizeCustomChatMenuOrder(menu);
        }
    }

    function removeAllMarkers() {
        for (const marker of document.querySelectorAll(`.${MARKER_CLASS}`)) marker.remove();
    }

    function makeMarker(entry, dropdown) {
        const marker = document.createElement('button');
        marker.type = 'button';
        marker.className = MARKER_CLASS;
        marker.dataset.messageId = entry.messageId;
        marker.setAttribute('aria-label', entry.title);
        marker.setAttribute('aria-haspopup', 'dialog');
        marker.setAttribute('aria-expanded', 'false');
        marker.innerHTML = icons.bookmarkFilled;

        marker.addEventListener('mouseenter', () => {
            cancelMarkerPopoverClose();
            openMarkerPopover(marker, false);
        });
        marker.addEventListener('mouseleave', scheduleMarkerPopoverClose);
        marker.addEventListener('focus', () => openMarkerPopover(marker, false));
        marker.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            markerPopoverPinned = !(markerPopoverState?.marker === marker && markerPopoverPinned);
            if (markerPopoverPinned) openMarkerPopover(marker, true);
            else closeMarkerPopover();
        });

        dropdown.before(marker);
        return marker;
    }

    function ensureBookmarkMarkers() {
        const existingMessageIds = new Set(entries.map((entry) => entry.messageId));
        for (const marker of document.querySelectorAll(`.${MARKER_CLASS}`)) {
            if (!existingMessageIds.has(marker.dataset.messageId) || !getMessageRoot(marker)) marker.remove();
        }

        for (const entry of entries) {
            const message = getMessageElement(entry.messageId);
            if (!message) continue;

            const dropdown = message.querySelector(MESSAGE_DROPDOWN_SELECTOR);
            if (!dropdown) continue;

            let marker = Array.from(message.querySelectorAll(`.${MARKER_CLASS}`)).find((candidate) => (
                candidate.dataset.messageId === entry.messageId
            ));
            if (!marker) marker = makeMarker(entry, dropdown);

            marker.setAttribute('aria-label', entry.title);
            marker.dataset.messageId = entry.messageId;
            if (marker.nextElementSibling !== dropdown) dropdown.before(marker);
        }
    }

    function ensureEditor() {
        if (editor?.isConnected) return editor;

        editor = document.createElement('div');
        editor.id = EDITOR_ID;
        editor.hidden = true;
        editor.innerHTML = `
            <form class="tm-sc-bookmark-editor-card" novalidate>
                <h2 class="tm-sc-bookmark-editor-title">Название закладки</h2>
                <input class="tm-sc-bookmark-editor-input" type="text" maxlength="${TITLE_MAX_LENGTH}"
                       autocomplete="off" aria-label="Название закладки">
                <div class="tm-sc-bookmark-editor-actions">
                    <button class="tm-sc-bookmark-editor-button is-cancel" type="button">Отмена</button>
                    <button class="tm-sc-bookmark-editor-button is-save" type="submit">Сохранить</button>
                </div>
            </form>
        `;

        editorTitle = editor.querySelector('.tm-sc-bookmark-editor-title');
        editorInput = editor.querySelector('.tm-sc-bookmark-editor-input');

        editor.addEventListener('pointerdown', (event) => {
            if (event.target === editor) closeEditor();
        });
        editor.querySelector('.is-cancel').addEventListener('click', closeEditor);
        editor.querySelector('form').addEventListener('submit', (event) => {
            event.preventDefault();
            void saveEditorValue();
        });

        document.body.appendChild(editor);
        return editor;
    }

    function openEditorForMessage(messageId) {
        const message = getMessageElement(messageId);
        if (!message || !activeStorageKey) return;

        const current = getEntry(messageId);
        const messageData = extractMessageData(message);
        openEditor({
            storageKey: activeStorageKey,
            messageId,
            currentEntry: current,
            messageData,
        });
    }

    function openEditorForEntry(entry) {
        if (!entry || !activeStorageKey) return;
        const message = getMessageElement(entry.messageId);
        const messageData = message
            ? extractMessageData(message)
            : {
                fullText: entry.fullText,
                excerpt: entry.excerpt,
                author: entry.author,
                defaultTitle: entry.title,
            };

        openEditor({
            storageKey: activeStorageKey,
            messageId: entry.messageId,
            currentEntry: entry,
            messageData,
        });
    }

    function openEditor(state) {
        ensureEditor();
        editorState = state;
        editorTitle.textContent = state.currentEntry ? 'Изменить название закладки' : 'Название закладки';
        editorInput.value = state.currentEntry?.title || state.messageData.defaultTitle || 'Закладка';
        editor.hidden = false;

        requestAnimationFrame(() => {
            editorInput.focus({ preventScroll: true });
            editorInput.select();
        });
    }

    function closeEditor() {
        if (!editor) return;
        editor.hidden = true;
        editorState = null;
    }

    async function saveEditorValue() {
        if (!editorState) return;

        const state = editorState;
        const rawTitle = editorInput.value.trim();
        const fallbackTitle = state.messageData.defaultTitle || 'Закладка';
        const title = (rawTitle || fallbackTitle).slice(0, TITLE_MAX_LENGTH);
        const now = Date.now();
        const wasExisting = Boolean(state.currentEntry);

        try {
            const updated = await updateEntries(state.storageKey, (latest) => {
                const existingIndex = latest.findIndex((entry) => entry.messageId === state.messageId);
                const nextEntry = {
                    id: existingIndex >= 0 ? latest[existingIndex].id : makeId(),
                    messageId: state.messageId,
                    title,
                    excerpt: state.messageData.excerpt || latest[existingIndex]?.excerpt || '',
                    fullText: state.messageData.fullText || latest[existingIndex]?.fullText || '',
                    author: state.messageData.author || latest[existingIndex]?.author || 'Сообщение',
                    messageCreatedAt: (
                        getCapturedMessageTimestamp(state.messageId)
                        || latest[existingIndex]?.messageCreatedAt
                        || null
                    ),
                    createdAt: existingIndex >= 0 ? latest[existingIndex].createdAt : now,
                    updatedAt: now,
                };

                if (existingIndex < 0) return [nextEntry, ...latest];
                const result = latest.slice();
                result[existingIndex] = nextEntry;
                return result;
            });

            if (activeStorageKey === state.storageKey) {
                entries = updated;
                ensureBookmarkMarkers();
                if (panel && !panel.hidden) renderPanel();
            }

            closeEditor();
            closeMarkerPopover();
            showToast(wasExisting ? 'Название закладки изменено' : 'Закладка добавлена');
        } catch (error) {
            console.error('[Message Bookmarks] Не удалось сохранить закладку.', error);
        }
    }

    async function deleteBookmark(entryId) {
        if (!activeStorageKey || !entryId) return;
        const storageKey = activeStorageKey;

        try {
            const updated = await updateEntries(storageKey, (latest) => (
                latest.filter((entry) => entry.id !== entryId)
            ));

            if (activeStorageKey !== storageKey) return;
            entries = updated;
            panelConfirmDeleteId = null;
            closeMarkerPopover();
            ensureBookmarkMarkers();
            if (panel && !panel.hidden) renderPanel();
            showToast('Закладка удалена');
        } catch (error) {
            console.error('[Message Bookmarks] Не удалось удалить закладку.', error);
        }
    }

    function ensurePanel() {
        if (panel?.isConnected) return panel;

        panel = document.createElement('section');
        panel.id = PANEL_ID;
        panel.hidden = true;
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Закладки');
        panel.innerHTML = `
            <header class="tm-sc-bookmarks-panel-header">
                <div class="tm-sc-bookmarks-panel-heading">
                    <h2 class="tm-sc-bookmarks-panel-title">Закладки</h2>
                    <span class="tm-sc-bookmarks-panel-count"></span>
                </div>
                <button class="tm-sc-bookmarks-close" type="button" aria-label="Закрыть">${icons.close}</button>
            </header>
            <div class="tm-sc-bookmarks-list"></div>
        `;

        panelList = panel.querySelector('.tm-sc-bookmarks-list');
        panelCount = panel.querySelector('.tm-sc-bookmarks-panel-count');
        panel.querySelector('.tm-sc-bookmarks-close').addEventListener('click', closePanel);
        document.body.appendChild(panel);
        return panel;
    }

    function openPanel(anchor) {
        ensureContext();
        if (!activeStorageKey) return;
        ensurePanel();
        panelAnchor = anchor || panelAnchor;
        panelConfirmDeleteId = null;
        renderPanel();
        panel.hidden = false;
        positionPanel();
    }

    function closePanel() {
        if (!panel) return;
        panel.hidden = true;
        panelConfirmDeleteId = null;
    }

    function positionPanel() {
        if (!panel || panel.hidden || !panelAnchor?.isConnected) return;

        const rect = panelAnchor.getBoundingClientRect();
        const width = Math.min(390, window.innerWidth - 24);
        const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width));
        const top = Math.min(window.innerHeight - 80, Math.max(12, rect.bottom + 8));
        panel.style.left = `${Math.round(left)}px`;
        panel.style.top = `${Math.round(top)}px`;
    }

    function makeIconButton(label, icon, danger = false) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `tm-sc-bookmark-icon-button${danger ? ' is-danger' : ''}`;
        button.setAttribute('aria-label', label);
        button.title = label;
        button.innerHTML = icon;
        return button;
    }

    function makeConfirmControls(entry, onCancel) {
        const wrapper = document.createElement('div');
        wrapper.className = 'tm-sc-bookmark-confirm';

        const label = document.createElement('span');
        label.className = 'tm-sc-bookmark-confirm-label';
        label.textContent = 'Удалить?';

        const yes = document.createElement('button');
        yes.type = 'button';
        yes.className = 'tm-sc-bookmark-confirm-button is-yes';
        yes.textContent = 'Да';
        yes.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            void deleteBookmark(entry.id);
        });

        const no = document.createElement('button');
        no.type = 'button';
        no.className = 'tm-sc-bookmark-confirm-button is-no';
        no.textContent = 'Нет';
        no.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
        });

        wrapper.append(label, yes, no);
        return wrapper;
    }

    function renderPanel() {
        if (!panelList || !panelCount) return;

        const sorted = entries.slice().sort((a, b) => {
            const aMessageTime = normalizeMessageTimestamp(a.messageCreatedAt);
            const bMessageTime = normalizeMessageTimestamp(b.messageCreatedAt);

            if (aMessageTime && bMessageTime && aMessageTime !== bMessageTime) {
                return bMessageTime - aMessageTime;
            }
            if (aMessageTime && !bMessageTime) return -1;
            if (!aMessageTime && bMessageTime) return 1;
            return b.createdAt - a.createdAt;
        });
        panelCount.textContent = sorted.length ? String(sorted.length) : '';
        panelList.replaceChildren();

        if (!sorted.length) {
            const empty = document.createElement('div');
            empty.className = 'tm-sc-bookmarks-empty';
            empty.textContent = 'Закладок пока нет.';
            panelList.appendChild(empty);
            return;
        }

        for (const entry of sorted) {
            const card = document.createElement('article');
            card.className = 'tm-sc-bookmark-card';

            const main = document.createElement('div');
            main.className = 'tm-sc-bookmark-card-main';
            main.tabIndex = 0;
            main.setAttribute('role', 'button');
            main.setAttribute('aria-label', `Перейти к закладке ${entry.title}`);

            const title = document.createElement('h3');
            title.className = 'tm-sc-bookmark-card-title';
            title.textContent = entry.title;

            const excerpt = document.createElement('p');
            excerpt.className = 'tm-sc-bookmark-card-excerpt';
            excerpt.textContent = entry.excerpt || 'Сообщение';

            const meta = document.createElement('div');
            meta.className = 'tm-sc-bookmark-card-meta';
            meta.textContent = [
                entry.author,
                formatMessageDateTime(entry.messageCreatedAt) || 'Время сообщения пока неизвестно',
            ].filter(Boolean).join(' · ');

            main.append(title, excerpt, meta);
            main.addEventListener('click', () => navigateToEntry(entry));
            main.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigateToEntry(entry);
                }
            });

            const actions = document.createElement('div');
            actions.className = 'tm-sc-bookmark-card-actions';

            if (panelConfirmDeleteId === entry.id) {
                actions.appendChild(makeConfirmControls(entry, () => {
                    panelConfirmDeleteId = null;
                    renderPanel();
                }));
            } else {
                const editButton = makeIconButton('Изменить название', icons.pencil);
                editButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openEditorForEntry(entry);
                });

                const deleteButton = makeIconButton('Удалить закладку', icons.trash, true);
                deleteButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    panelConfirmDeleteId = entry.id;
                    renderPanel();
                });
                actions.append(editButton, deleteButton);
            }

            card.append(main, actions);
            panelList.appendChild(card);
        }
    }

    function ensureHistorySearchOverlay() {
        if (historySearchOverlay?.isConnected) return historySearchOverlay;

        historySearchOverlay = document.createElement('div');
        historySearchOverlay.id = HISTORY_SEARCH_ID;
        historySearchOverlay.hidden = true;
        historySearchOverlay.innerHTML = `
            <section class="tm-sc-history-search-card" role="dialog" aria-modal="true"
                     aria-labelledby="tm-sc-history-search-title">
                <h2 id="tm-sc-history-search-title" class="tm-sc-history-search-title">Ищу сообщение в истории</h2>
                <p class="tm-sc-history-search-status" aria-live="polite"></p>
                <div class="tm-sc-history-progress-track" aria-hidden="true">
                    <div class="tm-sc-history-progress-bar"></div>
                </div>
                <div class="tm-sc-history-search-metrics">
                    <span class="tm-sc-history-search-batches">Загружено пачек: 0</span>
                    <span class="tm-sc-history-search-messages">Проверено сообщений: 0</span>
                </div>
                <div class="tm-sc-history-search-actions">
                    <button class="tm-sc-history-search-button is-cancel" type="button">Отменить</button>
                    <button class="tm-sc-history-search-button is-primary is-retry" type="button" hidden>Повторить</button>
                    <button class="tm-sc-history-search-button is-close" type="button" hidden>Закрыть</button>
                </div>
            </section>
        `;

        historySearchTitle = historySearchOverlay.querySelector('.tm-sc-history-search-title');
        historySearchStatus = historySearchOverlay.querySelector('.tm-sc-history-search-status');
        historySearchBatches = historySearchOverlay.querySelector('.tm-sc-history-search-batches');
        historySearchMessages = historySearchOverlay.querySelector('.tm-sc-history-search-messages');
        historySearchCancelButton = historySearchOverlay.querySelector('.is-cancel');
        historySearchRetryButton = historySearchOverlay.querySelector('.is-retry');
        historySearchCloseButton = historySearchOverlay.querySelector('.is-close');

        historySearchCancelButton.addEventListener('click', cancelHistorySearch);
        historySearchCloseButton.addEventListener('click', cancelHistorySearch);
        historySearchRetryButton.addEventListener('click', () => {
            const entry = historySearchState?.entry;
            if (entry) void startHistorySearch(entry);
        });

        document.body.appendChild(historySearchOverlay);
        return historySearchOverlay;
    }

    function updateHistorySearchSeen(state) {
        for (const message of document.querySelectorAll(MESSAGE_SELECTOR)) {
            if (message.id) state.seenIds.add(message.id);
        }
    }

    function renderHistorySearchProgress(state, statusText) {
        ensureHistorySearchOverlay();
        updateHistorySearchSeen(state);
        historySearchStatus.textContent = statusText;
        historySearchBatches.textContent = `Загружено пачек: ${state.batches}`;
        historySearchMessages.textContent = `Проверено сообщений: ${state.seenIds.size}`;
    }

    function showHistorySearchLoading(state, statusText = 'Проверяю уже загруженные сообщения…') {
        ensureHistorySearchOverlay();
        historySearchOverlay.classList.remove('is-success', 'is-error');
        historySearchTitle.textContent = 'Ищу сообщение в истории';
        historySearchCancelButton.hidden = false;
        historySearchRetryButton.hidden = true;
        historySearchCloseButton.hidden = true;
        renderHistorySearchProgress(state, statusText);
        historySearchOverlay.hidden = false;
    }

    function showHistorySearchSuccess(state) {
        ensureHistorySearchOverlay();
        historySearchOverlay.classList.remove('is-error');
        historySearchOverlay.classList.add('is-success');
        historySearchTitle.textContent = 'Сообщение найдено';
        historySearchCancelButton.hidden = true;
        historySearchRetryButton.hidden = true;
        historySearchCloseButton.hidden = true;
        renderHistorySearchProgress(state, 'Перехожу к закладке…');
    }

    function showHistorySearchError(state, title, statusText, allowRetry) {
        ensureHistorySearchOverlay();
        historySearchOverlay.classList.remove('is-success');
        historySearchOverlay.classList.add('is-error');
        historySearchTitle.textContent = title;
        historySearchCancelButton.hidden = true;
        historySearchRetryButton.hidden = !allowRetry;
        historySearchCloseButton.hidden = false;
        renderHistorySearchProgress(state, statusText);
        historySearchOverlay.hidden = false;
    }

    function invalidateHistorySearch() {
        historySearchToken += 1;
        const previousState = historySearchState;
        if (previousState?.cancelWaiters) {
            for (const cancelWaiter of Array.from(previousState.cancelWaiters)) cancelWaiter();
            previousState.cancelWaiters.clear();
        }
        return historySearchToken;
    }

    function cancelHistorySearch() {
        invalidateHistorySearch();
        historySearchState = null;
        if (historySearchOverlay) {
            historySearchOverlay.hidden = true;
            historySearchOverlay.classList.remove('is-success', 'is-error');
        }
    }

    function registerHistorySearchCancelWaiter(state, callback) {
        state.cancelWaiters.add(callback);
        return () => state.cancelWaiters.delete(callback);
    }

    function getLoadedMessageIds() {
        return Array.from(document.querySelectorAll(MESSAGE_SELECTOR), (message) => message.id).filter(Boolean);
    }

    function getLoadedMessagesSignature() {
        const ids = getLoadedMessageIds();
        return [
            ids.length,
            ...ids.slice(0, 4),
            ...ids.slice(-4),
        ].join('|');
    }

    function findLoadPreviousButton() {
        const buttons = Array.from(document.querySelectorAll(LOAD_PREVIOUS_SELECTOR))
            .map((label) => label.closest('button'))
            .filter((button, index, array) => (
                button?.isConnected && array.indexOf(button) === index
            ));

        return buttons.find((button) => (
            !button.disabled && button.getAttribute('aria-disabled') !== 'true'
        )) || buttons[0] || null;
    }

    function isLoadPreviousButtonReady(button) {
        return Boolean(
            button?.isConnected
            && !button.disabled
            && button.getAttribute('aria-disabled') !== 'true'
        );
    }

    function captureHistoryViewport() {
        const messages = Array.from(document.querySelectorAll(MESSAGE_SELECTOR));
        if (!messages.length) return null;

        const seedMessage = messages[messages.length - 1];
        const scroller = findScrollContainer(seedMessage);
        const rootScroller = isRootScroller(scroller);
        const scrollerRect = rootScroller
            ? { top: 0, bottom: window.innerHeight }
            : scroller.getBoundingClientRect();

        const candidates = messages.filter((message) => {
            if (findScrollContainer(message) !== scroller) return false;
            const rect = message.getBoundingClientRect();
            return rect.bottom > scrollerRect.top && rect.top < scrollerRect.bottom;
        });

        const anchor = (candidates.length ? candidates : messages).reduce((best, message) => {
            if (!best) return message;
            const bestDistance = Math.abs(best.getBoundingClientRect().top - scrollerRect.top);
            const currentDistance = Math.abs(message.getBoundingClientRect().top - scrollerRect.top);
            return currentDistance < bestDistance ? message : best;
        }, null);

        return anchor ? {
            anchorId: anchor.id,
            anchorTop: anchor.getBoundingClientRect().top,
            scroller,
        } : null;
    }

    function restoreHistoryViewport(snapshot) {
        if (!snapshot) return;
        const anchor = getMessageElement(snapshot.anchorId);
        if (!anchor) return;

        const currentScroller = findScrollContainer(anchor);
        const scroller = snapshot.scroller?.isConnected ? snapshot.scroller : currentScroller;
        const delta = anchor.getBoundingClientRect().top - snapshot.anchorTop;
        if (Math.abs(delta) > 0.5) {
            setScrollTop(scroller, getScrollTop(scroller) + delta);
        }
    }

    function waitForHistoryBatch(state, beforeSignature, viewportSnapshot) {
        return new Promise((resolve) => {
            let finished = false;
            let changed = false;
            let lastSignature = beforeSignature;
            let settleTimer = null;
            let timeoutTimer = null;
            let unregisterCancel = () => {};

            const cleanup = () => {
                observer.disconnect();
                if (settleTimer) window.clearTimeout(settleTimer);
                if (timeoutTimer) window.clearTimeout(timeoutTimer);
                unregisterCancel();
            };

            const finish = (kind) => {
                if (finished) return;
                finished = true;
                cleanup();
                resolve({ kind, changed });
            };

            const finishSettledBatch = () => {
                if (state.token !== historySearchToken) {
                    finish('cancelled');
                    return;
                }

                restoreHistoryViewport(viewportSnapshot);
                updateHistorySearchSeen(state);
                if (getMessageElement(state.entry.messageId)) finish('found');
                else finish('loaded');
            };

            const inspect = () => {
                if (state.token !== historySearchToken) {
                    finish('cancelled');
                    return;
                }

                updateHistorySearchSeen(state);
                const currentSignature = getLoadedMessagesSignature();
                const signatureChanged = currentSignature !== lastSignature;
                if (signatureChanged) {
                    changed = true;
                    lastSignature = currentSignature;
                    restoreHistoryViewport(viewportSnapshot);
                }

                if (getMessageElement(state.entry.messageId)) {
                    restoreHistoryViewport(viewportSnapshot);
                    renderHistorySearchProgress(state, 'Сообщение найдено. Завершаю поиск…');
                    finish('found');
                    return;
                }

                if (!signatureChanged) return;
                renderHistorySearchProgress(state, 'Получена новая пачка. Проверяю сообщения…');

                if (settleTimer) window.clearTimeout(settleTimer);
                settleTimer = window.setTimeout(finishSettledBatch, 420);
            };

            const observer = new MutationObserver(inspect);
            observer.observe(document.documentElement, { childList: true, subtree: true });
            unregisterCancel = registerHistorySearchCancelWaiter(state, () => finish('cancelled'));

            timeoutTimer = window.setTimeout(() => {
                if (state.token !== historySearchToken) {
                    finish('cancelled');
                    return;
                }

                restoreHistoryViewport(viewportSnapshot);
                updateHistorySearchSeen(state);
                if (getMessageElement(state.entry.messageId)) finish('found');
                else if (changed) finish('loaded');
                else finish('timeout');
            }, HISTORY_BATCH_TIMEOUT);

            inspect();
        });
    }

    function waitForNextLoadControl(state, timeout = 2800) {
        return new Promise((resolve) => {
            let finished = false;
            let timeoutTimer = null;
            let unregisterCancel = () => {};

            const cleanup = () => {
                observer.disconnect();
                if (timeoutTimer) window.clearTimeout(timeoutTimer);
                unregisterCancel();
            };

            const finish = (result) => {
                if (finished) return;
                finished = true;
                cleanup();
                resolve(result);
            };

            const inspect = () => {
                if (state.token !== historySearchToken) {
                    finish({ kind: 'cancelled' });
                    return;
                }

                if (getMessageElement(state.entry.messageId)) {
                    finish({ kind: 'found' });
                    return;
                }

                const button = findLoadPreviousButton();
                if (isLoadPreviousButtonReady(button)) finish({ kind: 'button', button });
            };

            const observer = new MutationObserver(inspect);
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['disabled', 'aria-disabled'],
            });
            unregisterCancel = registerHistorySearchCancelWaiter(state, () => finish({ kind: 'cancelled' }));

            timeoutTimer = window.setTimeout(() => {
                if (state.token !== historySearchToken) {
                    finish({ kind: 'cancelled' });
                    return;
                }

                if (getMessageElement(state.entry.messageId)) {
                    finish({ kind: 'found' });
                    return;
                }

                const button = findLoadPreviousButton();
                if (isLoadPreviousButtonReady(button)) finish({ kind: 'button', button });
                else if (button) finish({ kind: 'stalled' });
                else finish({ kind: 'end' });
            }, timeout);

            inspect();
        });
    }

    function waitForHistorySearchDelay(state, delay) {
        return new Promise((resolve) => {
            const timer = window.setTimeout(() => {
                unregisterCancel();
                resolve(state.token === historySearchToken);
            }, delay);
            const unregisterCancel = registerHistorySearchCancelWaiter(state, () => {
                window.clearTimeout(timer);
                unregisterCancel();
                resolve(false);
            });
        });
    }

    async function completeHistorySearch(state) {
        if (state.token !== historySearchToken) return;
        showHistorySearchSuccess(state);
        const shouldContinue = await waitForHistorySearchDelay(state, 260);
        if (!shouldContinue || state.token !== historySearchToken) return;

        historySearchOverlay.hidden = true;
        historySearchOverlay.classList.remove('is-success', 'is-error');
        historySearchState = null;
        navigateToLoadedMessage(state.entry.messageId);
    }

    async function startHistorySearch(entry) {
        if (!entry) return;

        const token = invalidateHistorySearch();
        const state = {
            token,
            entry,
            batches: 0,
            seenIds: new Set(getLoadedMessageIds()),
            cancelWaiters: new Set(),
        };
        historySearchState = state;
        showHistorySearchLoading(state);

        try {
            while (state.token === historySearchToken) {
                if (getMessageElement(entry.messageId)) {
                    await completeHistorySearch(state);
                    return;
                }

                renderHistorySearchProgress(
                    state,
                    state.batches
                        ? 'Ищу следующую пачку предыдущих сообщений…'
                        : 'Ищу кнопку загрузки предыдущих сообщений…',
                );

                const control = await waitForNextLoadControl(state);
                if (control.kind === 'cancelled') return;
                if (control.kind === 'found') {
                    await completeHistorySearch(state);
                    return;
                }
                if (control.kind === 'end') {
                    showHistorySearchError(
                        state,
                        'Сообщение не найдено',
                        'Вся доступная история загружена. Возможно, сообщение было удалено.',
                        false,
                    );
                    return;
                }
                if (control.kind === 'stalled') {
                    showHistorySearchError(
                        state,
                        'Поиск приостановлен',
                        'Кнопка загрузки не стала активной. Можно повторить попытку.',
                        true,
                    );
                    return;
                }

                const viewportSnapshot = captureHistoryViewport();
                const beforeSignature = getLoadedMessagesSignature();
                renderHistorySearchProgress(state, `Загружаю пачку ${state.batches + 1}…`);

                try {
                    control.button.click();
                } catch (error) {
                    console.error('[Message Bookmarks] Не удалось нажать Load Previous Messages.', error);
                    showHistorySearchError(
                        state,
                        'Не удалось продолжить поиск',
                        'Кнопка загрузки исчезла раньше клика. Попробуй ещё раз.',
                        true,
                    );
                    return;
                }

                const batchResult = await waitForHistoryBatch(state, beforeSignature, viewportSnapshot);
                if (batchResult.kind === 'cancelled') return;
                if (batchResult.changed) state.batches += 1;
                updateHistorySearchSeen(state);

                if (batchResult.kind === 'found') {
                    await completeHistorySearch(state);
                    return;
                }
                if (batchResult.kind === 'timeout') {
                    showHistorySearchError(
                        state,
                        'Загрузка не отвечает',
                        'Новая пачка сообщений не появилась. Можно повторить поиск с текущего места.',
                        true,
                    );
                    return;
                }

                renderHistorySearchProgress(state, 'Пачка загружена. Продолжаю поиск…');
            }
        } catch (error) {
            console.error('[Message Bookmarks] Ошибка фонового поиска сообщения.', error);
            if (state.token === historySearchToken) {
                showHistorySearchError(
                    state,
                    'Поиск остановлен',
                    'Во время загрузки истории произошла ошибка. Можно повторить попытку.',
                    true,
                );
            }
        }
    }

    function navigateToLoadedMessage(messageId) {
        if (!getMessageElement(messageId)) return;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => smoothScrollToMessage(messageId));
        });
    }

    function navigateToEntry(entry) {
        closePanel();
        if (getMessageElement(entry.messageId)) {
            navigateToLoadedMessage(entry.messageId);
            return;
        }

        void startHistorySearch(entry);
    }

    function isRootScroller(element) {
        return (
            element === document.scrollingElement
            || element === document.documentElement
            || element === document.body
        );
    }

    function findScrollContainer(element) {
        let node = element?.parentElement;

        while (node && node !== document.body && node !== document.documentElement) {
            const style = getComputedStyle(node);
            const canScroll = /^(auto|scroll|overlay)$/.test(style.overflowY);
            if (canScroll && node.scrollHeight > node.clientHeight + 2) return node;
            node = node.parentElement;
        }

        return document.scrollingElement || document.documentElement;
    }

    function getScrollTop(scroller) {
        if (!isRootScroller(scroller)) return scroller.scrollTop;
        const root = document.scrollingElement || document.documentElement;
        return root.scrollTop || window.scrollY || document.body.scrollTop || 0;
    }

    function setScrollTop(scroller, value) {
        const nextValue = Math.max(0, value);
        if (!isRootScroller(scroller)) {
            scroller.scrollTop = nextValue;
            return;
        }

        const root = document.scrollingElement || document.documentElement;
        root.scrollTop = nextValue;
        if (document.body !== root) document.body.scrollTop = nextValue;
    }

    function getCenteredScrollTop(target, scroller) {
        const currentTop = getScrollTop(scroller);
        const targetRect = target.getBoundingClientRect();
        const rootScroller = isRootScroller(scroller);
        const viewportTop = rootScroller ? 0 : scroller.getBoundingClientRect().top;
        const viewportHeight = rootScroller ? window.innerHeight : scroller.clientHeight;
        const targetCenterInsideViewport = targetRect.top - viewportTop + (targetRect.height / 2);
        const desiredTop = currentTop + targetCenterInsideViewport - (viewportHeight / 2);
        const scrollHeight = rootScroller
            ? Math.max(
                document.documentElement.scrollHeight,
                document.body.scrollHeight,
                scroller.scrollHeight,
            )
            : scroller.scrollHeight;
        const maxTop = Math.max(0, scrollHeight - viewportHeight);
        return Math.max(0, Math.min(maxTop, desiredTop));
    }

    function easeInOutCubic(progress) {
        return progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    }

    function smoothScrollToMessage(messageId) {
        const target = getMessageElement(messageId);
        if (!target) return;

        const token = ++scrollAnimationToken;
        const scroller = findScrollContainer(target);
        const startTop = getScrollTop(scroller);
        const destinationTop = getCenteredScrollTop(target, scroller);
        const distance = Math.abs(destinationTop - startTop);

        if (distance < 2) {
            highlightMessage(messageId);
            return;
        }

        const duration = Math.min(950, Math.max(520, 420 + distance * 0.16));
        const startedAt = performance.now();

        const animate = (now) => {
            if (token !== scrollAnimationToken || !getMessageElement(messageId)) return;

            const progress = Math.min(1, (now - startedAt) / duration);
            const easedProgress = easeInOutCubic(progress);
            setScrollTop(scroller, startTop + (destinationTop - startTop) * easedProgress);

            if (progress < 1) {
                requestAnimationFrame(animate);
                return;
            }

            setScrollTop(scroller, destinationTop);
            window.setTimeout(() => {
                if (token === scrollAnimationToken) highlightMessage(messageId);
            }, 90);
        };

        requestAnimationFrame(animate);
    }

    function highlightMessage(messageId) {
        const message = getMessageElement(messageId);
        const target = findMessageBubble(message);
        if (!target) return;

        for (const highlighted of document.querySelectorAll(`.${HIGHLIGHT_CLASS}`)) {
            highlighted.classList.remove(HIGHLIGHT_CLASS);
        }

        target.classList.remove(HIGHLIGHT_CLASS);
        void target.offsetWidth;
        target.classList.add(HIGHLIGHT_CLASS);

        window.setTimeout(() => {
            const currentMessage = getMessageElement(messageId);
            findMessageBubble(currentMessage)?.classList.remove(HIGHLIGHT_CLASS);
        }, 1350);
    }

    function ensureMarkerPopover() {
        if (markerPopover?.isConnected) return markerPopover;

        markerPopover = document.createElement('div');
        markerPopover.id = MARKER_POPOVER_ID;
        markerPopover.hidden = true;
        markerPopover.setAttribute('role', 'dialog');
        markerPopover.addEventListener('mouseenter', cancelMarkerPopoverClose);
        markerPopover.addEventListener('mouseleave', scheduleMarkerPopoverClose);
        document.body.appendChild(markerPopover);
        return markerPopover;
    }

    function openMarkerPopover(marker, pinned) {
        const entry = getEntry(marker.dataset.messageId);
        if (!entry) return;

        ensureMarkerPopover();
        const sameMarker = markerPopoverState?.marker === marker;
        markerPopoverPinned = Boolean(pinned) || (sameMarker && markerPopoverPinned);
        markerPopoverState = { marker, entryId: entry.id, confirmDelete: false };
        renderMarkerPopover();
        markerPopover.hidden = false;
        marker.setAttribute('aria-expanded', 'true');
        positionMarkerPopover(marker);
    }

    function renderMarkerPopover() {
        if (!markerPopoverState || !markerPopover) return;
        const entry = entries.find((candidate) => candidate.id === markerPopoverState.entryId);
        if (!entry) {
            closeMarkerPopover();
            return;
        }

        markerPopover.replaceChildren();

        const title = document.createElement('div');
        title.className = 'tm-sc-bookmark-popover-title';
        title.textContent = entry.title;
        markerPopover.appendChild(title);

        const actions = document.createElement('div');
        actions.className = 'tm-sc-bookmark-popover-actions';

        if (markerPopoverState.confirmDelete) {
            actions.appendChild(makeConfirmControls(entry, () => {
                if (!markerPopoverState) return;
                markerPopoverState.confirmDelete = false;
                renderMarkerPopover();
                positionMarkerPopover(markerPopoverState.marker);
            }));
        } else {
            const editButton = makeIconButton('Изменить название', icons.pencil);
            editButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                openEditorForEntry(entry);
                closeMarkerPopover();
            });

            const deleteButton = makeIconButton('Удалить закладку', icons.trash, true);
            deleteButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!markerPopoverState) return;
                markerPopoverState.confirmDelete = true;
                markerPopoverPinned = true;
                renderMarkerPopover();
                positionMarkerPopover(markerPopoverState.marker);
            });
            actions.append(editButton, deleteButton);
        }

        markerPopover.appendChild(actions);
    }

    function positionMarkerPopover(marker) {
        if (!markerPopover || markerPopover.hidden || !marker?.isConnected) return;

        const rect = marker.getBoundingClientRect();
        const width = Math.min(286, window.innerWidth - 20);
        const measuredHeight = markerPopover.offsetHeight || 90;
        const left = Math.max(10, Math.min(window.innerWidth - width - 10, rect.right - width));
        const preferredTop = rect.bottom + 7;
        const top = preferredTop + measuredHeight <= window.innerHeight - 10
            ? preferredTop
            : Math.max(10, rect.top - measuredHeight - 7);

        markerPopover.style.left = `${Math.round(left)}px`;
        markerPopover.style.top = `${Math.round(top)}px`;
    }

    function cancelMarkerPopoverClose() {
        if (!markerPopoverCloseTimer) return;
        window.clearTimeout(markerPopoverCloseTimer);
        markerPopoverCloseTimer = null;
    }

    function scheduleMarkerPopoverClose() {
        cancelMarkerPopoverClose();
        if (markerPopoverPinned) return;
        markerPopoverCloseTimer = window.setTimeout(closeMarkerPopover, 180);
    }

    function closeMarkerPopover() {
        cancelMarkerPopoverClose();
        if (markerPopoverState?.marker?.isConnected) {
            markerPopoverState.marker.setAttribute('aria-expanded', 'false');
        }
        if (markerPopover) markerPopover.hidden = true;
        markerPopoverState = null;
        markerPopoverPinned = false;
    }

    function ensureToast() {
        let toast = document.getElementById(TOAST_ID);
        if (toast) return toast;

        toast = document.createElement('div');
        toast.id = TOAST_ID;
        toast.hidden = true;
        toast.setAttribute('role', 'status');
        document.body.appendChild(toast);
        return toast;
    }

    function showToast(text) {
        const toast = ensureToast();
        if (toastTimer) window.clearTimeout(toastTimer);
        toast.textContent = text;
        toast.hidden = false;
        toastTimer = window.setTimeout(() => {
            toast.hidden = true;
            toastTimer = null;
        }, 1200);
    }

    function scheduleEnsure() {
        if (ensureScheduled) return;
        ensureScheduled = true;
        requestAnimationFrame(runDomPass);
    }

    function nodeTouchesBookmarkSurface(node, includeDescendants = true) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
        if (node.closest?.(`#${PANEL_ID}, #${EDITOR_ID}, #${MARKER_POPOVER_ID}, #${HISTORY_SEARCH_ID}, #${TOAST_ID}`)) {
            return false;
        }
        const selector = [
            MESSAGE_SELECTOR,
            MESSAGE_DROPDOWN_SELECTOR,
            SAVED_TEXT_MENU_ITEM_SELECTOR,
            CHAT_DROPDOWN_SELECTOR,
            'button[aria-label="View Saved Chats" i]',
            'time.tm-sc-message-sent-at[datetime]',
            `.${MARKER_CLASS}`,
        ].join(', ');
        return (
            node.matches?.(selector)
            || (includeDescendants && Boolean(node.querySelector?.(selector)))
        );
    }

    function handleRootMutations(records) {
        const timestampAdded = records.some((record) => Array.from(record.addedNodes).some((node) => (
            node?.nodeType === Node.ELEMENT_NODE
            && (
                node.matches?.('time.tm-sc-message-sent-at[datetime]')
                || node.querySelector?.('time.tm-sc-message-sent-at[datetime]')
            )
        )));
        if (timestampAdded) scheduleTimestampBackfill();
        const relevant = records.some((record) => (
            nodeTouchesBookmarkSurface(record.target, false)
            || Array.from(record.addedNodes).some((node) => nodeTouchesBookmarkSurface(node, true))
            || Array.from(record.removedNodes).some((node) => nodeTouchesBookmarkSurface(node, true))
        ));
        if (relevant) scheduleEnsure();
    }

    function ensureAll() {
        ensureContext();
        ensureMessageMenuItems();
        ensureChatMenuItems();
        ensureBookmarkMarkers();
    }

    document.addEventListener('pointerdown', (event) => {
        if (panel && !panel.hidden && !panel.contains(event.target)) {
            if (!event.target.closest(`.${CHAT_MENU_ITEM_CLASS}`)) closePanel();
        }

        if (markerPopover && !markerPopover.hidden) {
            const clickedMarker = event.target.closest(`.${MARKER_CLASS}`);
            if (!markerPopover.contains(event.target) && clickedMarker !== markerPopoverState?.marker) {
                closeMarkerPopover();
            }
        }
    }, true);

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (historySearchOverlay && !historySearchOverlay.hidden) {
            cancelHistorySearch();
            return;
        }
        if (editor && !editor.hidden) {
            closeEditor();
            return;
        }
        if (markerPopover && !markerPopover.hidden) {
            closeMarkerPopover();
            return;
        }
        closePanel();
    });

    window.addEventListener('resize', () => {
        positionPanel();
        if (markerPopoverState?.marker) positionMarkerPopover(markerPopoverState.marker);
    }, { passive: true });

    window.addEventListener('scroll', () => {
        positionPanel();
        if (markerPopoverState?.marker) positionMarkerPopover(markerPopoverState.marker);
    }, { passive: true, capture: true });

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
            ensureAll();

            if (!rootObserver) {
                rootObserver = new MutationObserver(handleRootMutations);
                rootObserver.observe(document.documentElement, { childList: true, subtree: true });
            }
            resetRetry();
        } catch (error) {
            rootObserver?.disconnect();
            rootObserver = null;
            console.error('[Message Bookmarks] DOM-инициализация сорвалась, повторю автоматически.', error);
            scheduleRetry();
        }
    }

    function startDomFeatures() {
        runDomPass();
    }

    // createdAt нужно перехватить до первого запроса истории, поэтому сам перехватчик
    // запускается на document-start, а работа с DOM откладывается до готовности страницы.
    installRouteChangeSignal();
    window.addEventListener(ROUTE_CHANGE_EVENT, startDomFeatures);
    window.addEventListener('pageshow', startDomFeatures);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) startDomFeatures();
    });
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startDomFeatures, { once: true });
    }
    startDomFeatures();
    runtime.dom?.subscribe(scheduleEnsure);

}


// ---- src/modules/summary.js ----

// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
function init_summary(runtime) {
    'use strict';

    const INSTANCE_KEY = '__spicyChatGptSummaryV1';
    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (pageWindow[INSTANCE_KEY]) return;
    pageWindow[INSTANCE_KEY] = true;


    const CHAT_DROPDOWN_SELECTOR = 'button[aria-label="chat-dropdown" i]';
    const MESSAGE_SELECTOR = 'div[id^="message-"]';
    const MENU_ITEM_CLASS = 'tm-sc-open-gpt-summary';
    const BOOKMARK_MENU_ITEM_CLASS = 'tm-sc-open-message-bookmarks';
    const GALLERY_MENU_ITEM_CLASS = 'tm-sc-open-conversation-gallery';
    const OVERLAY_ID = 'tm-sc-gpt-summary-overlay';
    const STYLE_ID = 'tm-sc-gpt-summary-style';
    const CACHE_PREFIX = 'tm-sc-gpt-summary-v1.1:';
    const PAGE_SIZE = 50;
    const MAX_HISTORY_PAGES = 1000;
    const CHUNK_CHARACTER_LIMIT = 110000;
    const ENDPOINT_TIMEOUT = 290000;
    const API_WAIT_TIMEOUT = 10000;
    const XHR_URL_KEY = '__tmScGptSummaryUrl';
    const INTERNAL_RESPONSE_CONSUMER_FLAG = '__tmScConsumesJsonResponse';
    const ROUTE_CHANGE_EVENT = 'tm-sc-route-change';
    const CHAT_MENU_ITEM_ORDER = [
        'tm-sc-open-message-bookmarks',
        'tm-sc-open-conversation-gallery',
        'tm-sc-open-gpt-summary',
        'tm-sc-open-chat-branches',
    ];
    const API_HEADER_NAMES = new Set([
        'authorization',
        'x-guest-userid',
        'x-country',
        'x-app-id',
        'x-app-version',
        'x-platform',
        'x-platform-os',
        'accept',
        'content-type',
    ]);

    const apiHeaders = new Map();
    let apiOrigin = '';
    let apiNativeFetch = null;
    let capturedConversationInfo = null;
    let activeContext = null;
    let ensureScheduled = false;
    let rootObserver = null;
    let retryTimer = null;
    let retryDelay = 250;
    let runSerial = 0;
    let running = false;

    let overlay = null;
    let statusNode = null;
    let metricsNode = null;
    let progressTrack = null;
    let progressBar = null;
    let resultNode = null;
    let emptyNode = null;
    let refreshButton = null;
    let copyButton = null;
    let lastSummary = '';

    const moscowDateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });
    const integerFormatter = new Intl.NumberFormat('ru-RU');

    const icons = {
        summary: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <path d="M14 2v6h6"></path><path d="M8 13h8"></path><path d="M8 17h6"></path>
                <path d="m9 9 .7-1.5L11.2 7l-1.5-.5L9 5l-.7 1.5L6.8 7l1.5.5z"></path>
            </svg>`,
        close: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="m18 6-12 12"></path><path d="m6 6 12 12"></path>
            </svg>`,
        refresh: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"></path>
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"></path>
            </svg>`,
        copy: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2"></rect>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
            </svg>`,
    };

    function getChatContext() {
        const parts = location.pathname.split('/').filter(Boolean);
        const chatIndex = parts.indexOf('chat');
        if (chatIndex < 0 || !parts[chatIndex + 1] || !parts[chatIndex + 2]) return null;
        const characterId = parts[chatIndex + 1];
        const conversationId = parts[chatIndex + 2];
        return {
            characterId,
            conversationId,
            key: `${characterId}:${conversationId}`,
        };
    }

    function installRouteChangeSignal() {
        const key = '__tmScRouteChangeSignalV1';
        if (pageWindow[key]) return;
        const dispatch = () => pageWindow.dispatchEvent(new pageWindow.Event(ROUTE_CHANGE_EVENT));
        for (const method of ['pushState', 'replaceState']) {
            const original = pageWindow.history?.[method];
            if (typeof original !== 'function') continue;
            pageWindow.history[method] = function (...args) {
                const result = Reflect.apply(original, this, args);
                dispatch();
                return result;
            };
        }
        pageWindow.addEventListener('popstate', dispatch);
        pageWindow.addEventListener('hashchange', dispatch);
        pageWindow[key] = true;
    }

    function ensureContext() {
        const next = getChatContext();
        if (next?.key === activeContext?.key) return;
        runSerial += 1;
        running = false;
        activeContext = next;
        capturedConversationInfo = null;
        lastSummary = '';
        if (overlay && !overlay.hidden) closeOverlay();
    }

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

    function headerEntries(source) {
        if (!source) return [];
        const entries = [];
        try {
            if (typeof source.forEach === 'function') {
                source.forEach((value, name) => entries.push([name, value]));
                return entries;
            }
            if (Array.isArray(source)) return source;
            if (typeof source === 'object') return Object.entries(source);
        } catch (_error) {
            return [];
        }
        return entries;
    }

    function rememberApiAccess(rawUrl, ...headerSources) {
        if (!isSpicyApiUrl(rawUrl)) return;
        try {
            apiOrigin = new URL(rawUrl, location.href).origin;
        } catch (_error) {
            return;
        }

        for (const source of headerSources) {
            for (const [rawName, rawValue] of headerEntries(source)) {
                const name = String(rawName || '').toLowerCase();
                if (!API_HEADER_NAMES.has(name) || rawValue === undefined || rawValue === null) continue;
                apiHeaders.set(name, String(rawValue));
            }
        }
    }

    function captureConversationPayload(payload) {
        ensureContext();
        if (!activeContext || !payload || typeof payload !== 'object') return;
        if (payload.conversation_id !== activeContext.conversationId || !Array.isArray(payload.messages)) return;

        capturedConversationInfo = {
            totalMessages: Math.max(
                capturedConversationInfo?.totalMessages || 0,
                Number(payload.num_messages) || 0,
            ),
            chatTitle: typeof payload.label === 'string' && payload.label.trim()
                ? payload.label.trim()
                : capturedConversationInfo?.chatTitle || '',
            userName: typeof payload.userPersona?.name === 'string'
                ? payload.userPersona.name.trim()
                : capturedConversationInfo?.userName || '',
        };
    }

    function installApiCapture() {
        const originalFetch = pageWindow.fetch;
        if (typeof originalFetch === 'function') {
            apiNativeFetch = originalFetch;
            pageWindow.fetch = function (input, options = {}) {
                const requestUrl = readRequestUrl(input);
                if (isSpicyApiUrl(requestUrl)) {
                    rememberApiAccess(requestUrl, input?.headers, options?.headers);
                }
                return Reflect.apply(originalFetch, this, arguments);
            };
        }

        try {
            const prototype = pageWindow.XMLHttpRequest?.prototype;
            if (!prototype) return;
            const originalOpen = prototype.open;
            const originalSetRequestHeader = prototype.setRequestHeader;
            const originalSend = prototype.send;

            prototype.open = function (...args) {
                this[XHR_URL_KEY] = readRequestUrl(args[1]);
                if (isSpicyApiUrl(this[XHR_URL_KEY])) rememberApiAccess(this[XHR_URL_KEY]);
                return Reflect.apply(originalOpen, this, args);
            };

            prototype.setRequestHeader = function (name, value) {
                if (isSpicyApiUrl(this[XHR_URL_KEY])) {
                    rememberApiAccess(this[XHR_URL_KEY], { [name]: value });
                }
                return Reflect.apply(originalSetRequestHeader, this, arguments);
            };

            prototype.send = function (...args) {
                return Reflect.apply(originalSend, this, args);
            };
        } catch (error) {
            console.warn('[GPT Summary] Не удалось подключиться к XMLHttpRequest.', error);
        }
    }

    function hasApiAccess() {
        return Boolean(apiNativeFetch && apiOrigin && apiHeaders.get('authorization'));
    }

    function sleep(milliseconds) {
        return new Promise((resolve) => pageWindow.setTimeout(resolve, milliseconds));
    }

    async function waitForApiAccess(serial) {
        const startedAt = Date.now();
        while (!hasApiAccess() && Date.now() - startedAt < API_WAIT_TIMEOUT) {
            if (serial !== runSerial) throw new Error('Операция отменена.');
            await sleep(160);
        }
        if (!hasApiAccess()) {
            throw new Error('Не удалось поймать сессию SpicyChat. Обнови страницу и попробуй ещё раз.');
        }
    }

    async function fetchApiJson(path) {
        if (!hasApiAccess()) throw new Error('Сессия API SpicyChat ещё не обнаружена.');
        const url = new URL(path, `${apiOrigin}/`).toString();
        const headers = Object.fromEntries(apiHeaders);
        headers.accept = 'application/json';

        const response = await Reflect.apply(apiNativeFetch, pageWindow, [url, {
            method: 'GET',
            headers,
            mode: 'cors',
            credentials: 'omit',
            [INTERNAL_RESPONSE_CONSUMER_FLAG]: true,
        }]);
        if (!response?.ok) throw new Error(`SpicyChat вернул HTTP ${response?.status || 0}.`);
        const payload = await response.json();
        captureConversationPayload(payload);
        return payload;
    }

    function normalizeTimestamp(value) {
        if (value === null || value === undefined || value === '') return 0;
        let timestamp = Number(value);
        if (!Number.isFinite(timestamp) && typeof value === 'string') timestamp = Date.parse(value);
        if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
        return timestamp < 100000000000 ? timestamp * 1000 : timestamp;
    }

    function normalizeMessageId(value) {
        return typeof value === 'string' ? value.trim().replace(/^message-/, '') : '';
    }

    function getVisibleMessageIds() {
        return new Set(Array.from(document.querySelectorAll(MESSAGE_SELECTOR), (message) => (
            normalizeMessageId(message.id)
        )).filter(Boolean));
    }

    function chooseActiveMessages(rawMessages) {
        const visibleIds = getVisibleMessageIds();
        const regularParents = new Set();
        const alternativeGroups = new Map();

        for (const message of rawMessages) {
            const id = normalizeMessageId(message?.id);
            if (!id) continue;
            const groupKey = `${message?.role || ''}:${message?.prevId || message?.prev_id || '__root__'}`;
            if (message?.is_alternative === true) {
                if (!alternativeGroups.has(groupKey)) alternativeGroups.set(groupKey, []);
                alternativeGroups.get(groupKey).push(message);
            } else {
                regularParents.add(groupKey);
            }
        }

        const chosenAlternativeIds = new Set();
        for (const [groupKey, alternatives] of alternativeGroups) {
            const visible = alternatives.find((message) => visibleIds.has(normalizeMessageId(message.id)));
            if (visible) {
                chosenAlternativeIds.add(normalizeMessageId(visible.id));
            } else if (!regularParents.has(groupKey) && alternatives[0]) {
                chosenAlternativeIds.add(normalizeMessageId(alternatives[0].id));
            }
        }

        return rawMessages.filter((message) => (
            message?.is_alternative !== true
            || chosenAlternativeIds.has(normalizeMessageId(message?.id))
        ));
    }

    function normalizeHistoryMessage(message) {
        if (!message || typeof message !== 'object') return null;
        const id = normalizeMessageId(message.id);
        const role = message.role === 'user' ? 'user' : message.role === 'bot' ? 'bot' : '';
        if (!id || !role) return null;
        let content = typeof message.content === 'string' ? message.content.trim() : '';
        if (!content) content = '[Сообщение без текста: возможно, изображение или вложение.]';
        return {
            id,
            role,
            content: content.replace(/\u0000/g, ''),
            createdAt: normalizeTimestamp(message.createdAt || message.created_at),
            prevId: normalizeMessageId(message.prevId || message.prev_id),
            isAlternative: message.is_alternative === true,
        };
    }

    async function fetchCompleteHistory(context, serial) {
        const rawMessages = [];
        const seen = new Set();
        let lastId = '';
        let total = capturedConversationInfo?.totalMessages || 0;
        let page = 0;

        while (page < MAX_HISTORY_PAGES) {
            if (serial !== runSerial) throw new Error('Операция отменена.');
            const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
            if (lastId) query.set('last_id', lastId);
            const payload = await fetchApiJson(
                `/characters/${encodeURIComponent(context.characterId)}/messages/`
                + `${encodeURIComponent(context.conversationId)}?${query}`,
            );
            const batch = Array.isArray(payload?.messages) ? payload.messages : [];
            total = Math.max(total, Number(payload?.num_messages) || 0, seen.size);

            let added = 0;
            for (const message of batch) {
                const id = normalizeMessageId(message?.id);
                if (!id || seen.has(id)) continue;
                seen.add(id);
                const normalized = normalizeHistoryMessage(message);
                if (normalized) {
                    rawMessages.push(normalized);
                    added += 1;
                }
            }

            const knownTotal = Math.max(total, seen.size);
            const ratio = knownTotal ? Math.min(1, seen.size / knownTotal) : 0;
            setProgress(
                4 + ratio * 36,
                `Загружаю историю: ${seen.size} / ${knownTotal || '?'}`,
                `Пачка ${page + 1}`,
            );

            if (batch.length < PAGE_SIZE || !added) break;
            const nextLastId = normalizeMessageId(batch.at(-1)?.id);
            if (!nextLastId || nextLastId === lastId) break;
            lastId = nextLastId;
            page += 1;
            await sleep(55);
        }

        const messages = chooseActiveMessages(rawMessages).reverse();
        return {
            messages,
            apiRecordCount: rawMessages.length,
            reportedTotal: total,
            userName: capturedConversationInfo?.userName || 'Пользователь',
            chatTitle: capturedConversationInfo?.chatTitle || '',
        };
    }

    function formatMoscowDateTime(timestamp) {
        if (!timestamp) return 'время неизвестно';
        try {
            return moscowDateTimeFormatter.format(new Date(timestamp));
        } catch (_error) {
            return 'время неизвестно';
        }
    }

    function getBotName() {
        const names = Array.from(document.querySelectorAll('a[href^="/chatbot/"] p'))
            .map((node) => node.textContent?.trim())
            .filter(Boolean);
        return names.at(-1) || 'Персонаж';
    }

    function buildMessageBlocks(history) {
        const botName = getBotName();
        const userName = history.userName || 'Пользователь';
        return history.messages.map((message, index) => {
            const author = message.role === 'user' ? userName : botName;
            const date = formatMoscowDateTime(message.createdAt);
            return `${index + 1}. [${date}, Москва] ${author}:\n${message.content}`;
        });
    }

    function splitLongBlock(block, limit) {
        if (block.length <= limit) return [block];
        const parts = [];
        for (let offset = 0; offset < block.length; offset += limit) {
            parts.push(block.slice(offset, offset + limit));
        }
        return parts;
    }

    function splitIntoChunks(blocks) {
        const chunks = [];
        let current = [];
        let currentLength = 0;

        const flush = () => {
            if (!current.length) return;
            chunks.push(current.join('\n\n'));
            current = [];
            currentLength = 0;
        };

        for (const originalBlock of blocks) {
            for (const block of splitLongBlock(originalBlock, CHUNK_CHARACTER_LIMIT - 200)) {
                const addedLength = block.length + (current.length ? 2 : 0);
                if (current.length && currentLength + addedLength > CHUNK_CHARACTER_LIMIT) flush();
                current.push(block);
                currentLength += block.length + (current.length > 1 ? 2 : 0);
            }
        }
        flush();
        return chunks;
    }

    function historyFingerprint(messages) {
        let hash = 2166136261;
        const update = (text) => {
            for (let index = 0; index < text.length; index += 1) {
                hash ^= text.charCodeAt(index);
                hash = Math.imul(hash, 16777619);
            }
        };
        for (const message of messages) {
            update(message.id);
            update(String(message.createdAt));
            update(message.role);
            update(message.content);
        }
        return `${messages.length}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
    }

    async function readCache(key) {
        try {
            if (typeof GM_getValue === 'function') {
                return await Promise.resolve(GM_getValue(key, null));
            }
        } catch (_error) {
            return null;
        }
        return null;
    }

    async function writeCache(key, value) {
        try {
            if (typeof GM_setValue === 'function') await Promise.resolve(GM_setValue(key, value));
        } catch (error) {
            console.warn('[GPT Summary] Не удалось сохранить пересказ в кеш.', error);
        }
    }

    function endpointRequest(stage, content) {
        const { url: ENDPOINT_URL, token: CLIENT_TOKEN } = runtime.getEndpoint('summary');
        return new Promise((resolve, reject) => {
            let settled = false;
            const finish = (callback, value) => {
                if (settled) return;
                settled = true;
                callback(value);
            };

            GM_xmlhttpRequest({
                method: 'POST',
                url: ENDPOINT_URL,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'X-Spicy-Summary-Token': CLIENT_TOKEN,
                },
                data: JSON.stringify({ stage, content }),
                timeout: ENDPOINT_TIMEOUT,
                anonymous: true,
                onload(response) {
                    let payload = null;
                    try {
                        payload = JSON.parse(response.responseText || '{}');
                    } catch (_error) {
                        const error = new Error(`Обработчик вернул не JSON (HTTP ${response.status || 0}).`);
                        error.retryable = response.status >= 500 || !response.status;
                        finish(reject, error);
                        return;
                    }

                    if (response.status < 200 || response.status >= 300 || !payload?.ok) {
                        const error = new Error(payload?.error || `Ошибка обработчика HTTP ${response.status || 0}.`);
                        error.retryable = response.status === 429 || response.status >= 500 || !response.status;
                        finish(reject, error);
                        return;
                    }
                    finish(resolve, payload);
                },
                onerror() {
                    const error = new Error('Не удалось связаться с настроенным обработчиком.');
                    error.retryable = true;
                    finish(reject, error);
                },
                ontimeout() {
                    const error = new Error('Обработчик слишком долго не отвечает.');
                    error.retryable = true;
                    finish(reject, error);
                },
            });
        });
    }

    async function endpointRequestWithRetry(stage, content, serial) {
        let lastError = null;
        for (let attempt = 1; attempt <= 2; attempt += 1) {
            if (serial !== runSerial) throw new Error('Операция отменена.');
            try {
                return await endpointRequest(stage, content);
            } catch (error) {
                lastError = error;
                if (!error?.retryable || attempt === 2) throw error;
                await sleep(1400 * attempt);
            }
        }
        throw lastError || new Error('Неизвестная ошибка обработчика.');
    }

    function addUsage(total, usage) {
        total.input_tokens += Math.max(0, Number(usage?.input_tokens) || 0);
        total.output_tokens += Math.max(0, Number(usage?.output_tokens) || 0);
        total.total_tokens += Math.max(0, Number(usage?.total_tokens) || 0);
    }

    async function makeSummary(chunks, serial) {
        const usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
        if (chunks.length === 1) {
            setProgress(72, 'OpenAI читает историю и собирает пересказ…', 'Один запрос');
            const result = await endpointRequestWithRetry('final', chunks[0], serial);
            addUsage(usage, result.usage);
            return { summary: result.summary, usage, chunkCount: 1 };
        }

        const notes = [];
        for (let index = 0; index < chunks.length; index += 1) {
            const percent = 43 + ((index / chunks.length) * 43);
            setProgress(
                percent,
                `OpenAI обрабатывает часть ${index + 1} из ${chunks.length}…`,
                `Готово частей: ${index} / ${chunks.length}`,
            );
            const result = await endpointRequestWithRetry('chunk', chunks[index], serial);
            addUsage(usage, result.usage);
            notes.push(`=== ЧАСТЬ ${index + 1} ИЗ ${chunks.length} ===\n${result.summary}`);
        }

        setProgress(92, 'Собираю промежуточные конспекты в единый пересказ…', `${chunks.length} частей`);
        const finalResult = await endpointRequestWithRetry('final', notes.join('\n\n'), serial);
        addUsage(usage, finalResult.usage);
        return { summary: finalResult.summary, usage, chunkCount: chunks.length };
    }

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${OVERLAY_ID}[hidden] { display: none !important; }
            #${OVERLAY_ID} {
                position: fixed !important;
                inset: 0 !important;
                z-index: 10250 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 24px !important;
                background: rgba(0, 0, 0, 0.6) !important;
                backdrop-filter: blur(3px) !important;
                font-family: inherit !important;
            }
            .tm-sc-summary-shell {
                box-sizing: border-box !important;
                display: flex !important;
                flex-direction: column !important;
                width: min(900px, calc(100vw - 48px)) !important;
                height: min(850px, calc(100vh - 48px)) !important;
                min-height: 430px !important;
                overflow: hidden !important;
                color: #18181b !important;
                background: #ffffff !important;
                border: 1px solid rgba(17, 24, 39, 0.14) !important;
                border-radius: 18px !important;
                box-shadow: 0 28px 90px rgba(0, 0, 0, 0.5) !important;
            }
            .dark .tm-sc-summary-shell {
                color: #f4f4f5 !important;
                background: #202023 !important;
                border-color: rgba(255, 255, 255, 0.13) !important;
            }
            .tm-sc-summary-header {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 14px !important;
                padding: 16px 18px 13px !important;
                border-bottom: 1px solid rgba(113, 113, 122, 0.17) !important;
            }
            .tm-sc-summary-title {
                margin: 0 !important;
                color: inherit !important;
                font-size: 20px !important;
                line-height: 1.25 !important;
                font-weight: 720 !important;
            }
            .tm-sc-summary-actions {
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
            }
            .tm-sc-summary-button {
                appearance: none !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 7px !important;
                height: 38px !important;
                padding: 0 12px !important;
                color: inherit !important;
                background: rgba(113, 113, 122, 0.11) !important;
                border: 0 !important;
                border-radius: 10px !important;
                cursor: pointer !important;
                font-family: inherit !important;
                font-size: 13px !important;
                font-weight: 650 !important;
            }
            .tm-sc-summary-button:hover:not(:disabled) { background: rgba(124, 58, 237, 0.17) !important; }
            .tm-sc-summary-button:disabled { cursor: default !important; opacity: 0.45 !important; }
            .tm-sc-summary-close { width: 38px !important; padding: 0 !important; }
            .tm-sc-summary-progress-area {
                padding: 11px 18px 12px !important;
                border-bottom: 1px solid rgba(113, 113, 122, 0.14) !important;
            }
            .tm-sc-summary-progress-copy {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 14px !important;
                margin-bottom: 8px !important;
                color: #71717a !important;
                font-size: 12px !important;
                line-height: 1.35 !important;
            }
            .dark .tm-sc-summary-progress-copy { color: #b4b4bd !important; }
            .tm-sc-summary-status { overflow-wrap: anywhere !important; }
            .tm-sc-summary-metrics { flex: 0 0 auto !important; white-space: nowrap !important; }
            .tm-sc-summary-progress-track {
                position: relative !important;
                height: 7px !important;
                overflow: hidden !important;
                background: rgba(113, 113, 122, 0.18) !important;
                border-radius: 9999px !important;
            }
            .tm-sc-summary-progress-bar {
                position: absolute !important;
                inset: 0 auto 0 0 !important;
                width: 0 !important;
                background: linear-gradient(90deg, #7c3aed, #a78bfa) !important;
                border-radius: inherit !important;
                transition: width 300ms ease, background 180ms ease !important;
            }
            .tm-sc-summary-progress-track.is-complete .tm-sc-summary-progress-bar { background: #22c55e !important; }
            .tm-sc-summary-progress-track.is-error .tm-sc-summary-progress-bar { background: #ef4444 !important; }
            .tm-sc-summary-content {
                position: relative !important;
                flex: 1 1 auto !important;
                min-height: 0 !important;
                overflow: auto !important;
                padding: 24px 28px 30px !important;
                overscroll-behavior: contain !important;
            }
            .tm-sc-summary-empty {
                position: absolute !important;
                inset: 0 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 40px !important;
                color: #71717a !important;
                font-size: 14px !important;
                text-align: center !important;
            }
            .tm-sc-summary-empty[hidden] { display: none !important; }
            .dark .tm-sc-summary-empty { color: #a1a1aa !important; }
            .tm-sc-summary-result { max-width: 780px !important; margin: 0 auto !important; }
            .tm-sc-summary-result[hidden] { display: none !important; }
            .tm-sc-summary-result h2,
            .tm-sc-summary-result h3 {
                margin: 24px 0 9px !important;
                color: inherit !important;
                line-height: 1.3 !important;
                font-weight: 720 !important;
            }
            .tm-sc-summary-result h2:first-child,
            .tm-sc-summary-result h3:first-child { margin-top: 0 !important; }
            .tm-sc-summary-result h2 { font-size: 19px !important; }
            .tm-sc-summary-result h3 { font-size: 16px !important; }
            .tm-sc-summary-result p,
            .tm-sc-summary-result li {
                color: inherit !important;
                font-size: 14.5px !important;
                line-height: 1.65 !important;
            }
            .tm-sc-summary-result p { margin: 0 0 11px !important; white-space: pre-wrap !important; }
            .tm-sc-summary-result ul,
            .tm-sc-summary-result ol { margin: 7px 0 14px 22px !important; padding: 0 !important; }
            .tm-sc-summary-result li { margin: 4px 0 !important; padding-left: 3px !important; }
            .tm-sc-summary-error {
                padding: 14px 16px !important;
                color: #991b1b !important;
                background: rgba(239, 68, 68, 0.11) !important;
                border: 1px solid rgba(239, 68, 68, 0.24) !important;
                border-radius: 11px !important;
                font-size: 14px !important;
                line-height: 1.5 !important;
                white-space: pre-wrap !important;
            }
            .dark .tm-sc-summary-error { color: #fecaca !important; }
        `;
        document.head.appendChild(style);
    }

    function ensureOverlay() {
        if (overlay?.isConnected) return overlay;
        overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.hidden = true;
        overlay.innerHTML = `
            <section class="tm-sc-summary-shell" role="dialog" aria-modal="true" aria-labelledby="tm-sc-summary-title">
                <header class="tm-sc-summary-header">
                    <h2 id="tm-sc-summary-title" class="tm-sc-summary-title">Пересказ диалога</h2>
                    <div class="tm-sc-summary-actions">
                        <button class="tm-sc-summary-button tm-sc-summary-copy" type="button">${icons.copy}<span>Скопировать</span></button>
                        <button class="tm-sc-summary-button tm-sc-summary-refresh" type="button">${icons.refresh}<span>Пересказать заново</span></button>
                        <button class="tm-sc-summary-button tm-sc-summary-close" type="button" aria-label="Закрыть">${icons.close}</button>
                    </div>
                </header>
                <div class="tm-sc-summary-progress-area">
                    <div class="tm-sc-summary-progress-copy">
                        <span class="tm-sc-summary-status" aria-live="polite">Готово к запуску</span>
                        <span class="tm-sc-summary-metrics"></span>
                    </div>
                    <div class="tm-sc-summary-progress-track" role="progressbar" aria-label="Подготовка пересказа" aria-valuemin="0" aria-valuemax="100">
                        <div class="tm-sc-summary-progress-bar"></div>
                    </div>
                </div>
                <div class="tm-sc-summary-content">
                    <div class="tm-sc-summary-empty">Здесь появится пересказ истории</div>
                    <article class="tm-sc-summary-result" hidden></article>
                </div>
            </section>
        `;

        statusNode = overlay.querySelector('.tm-sc-summary-status');
        metricsNode = overlay.querySelector('.tm-sc-summary-metrics');
        progressTrack = overlay.querySelector('.tm-sc-summary-progress-track');
        progressBar = overlay.querySelector('.tm-sc-summary-progress-bar');
        resultNode = overlay.querySelector('.tm-sc-summary-result');
        emptyNode = overlay.querySelector('.tm-sc-summary-empty');
        refreshButton = overlay.querySelector('.tm-sc-summary-refresh');
        copyButton = overlay.querySelector('.tm-sc-summary-copy');

        overlay.querySelector('.tm-sc-summary-close').addEventListener('click', closeOverlay);
        overlay.addEventListener('pointerdown', (event) => {
            if (event.target === overlay) closeOverlay();
        });
        refreshButton.addEventListener('click', () => {
            if (!running) void generateSummary({ force: true });
        });
        copyButton.addEventListener('click', async () => {
            if (!lastSummary) return;
            try {
                await navigator.clipboard.writeText(lastSummary);
                const label = copyButton.querySelector('span');
                if (label) label.textContent = 'Скопировано';
                window.setTimeout(() => {
                    if (label) label.textContent = 'Скопировать';
                }, 1100);
            } catch (_error) {
                setStatusOnly('Не удалось скопировать автоматически');
            }
        });

        document.body.appendChild(overlay);
        updateActionState();
        return overlay;
    }

    function openOverlay() {
        ensureOverlay();
        overlay.hidden = false;
    }

    function closeOverlay() {
        if (overlay) overlay.hidden = true;
    }

    function updateActionState() {
        if (refreshButton) refreshButton.disabled = running;
        if (copyButton) copyButton.disabled = running || !lastSummary;
    }

    function setStatusOnly(status, metrics = metricsNode?.textContent || '') {
        if (statusNode) statusNode.textContent = status;
        if (metricsNode) metricsNode.textContent = metrics;
    }

    function setProgress(percent, status, metrics = '') {
        ensureOverlay();
        const normalized = Math.max(0, Math.min(100, Number(percent) || 0));
        progressBar.style.setProperty('width', `${normalized}%`, 'important');
        progressTrack.setAttribute('aria-valuenow', String(Math.round(normalized)));
        progressTrack.classList.remove('is-complete', 'is-error');
        setStatusOnly(status, metrics);
    }

    function showLoading() {
        lastSummary = '';
        if (resultNode) {
            resultNode.hidden = true;
            resultNode.replaceChildren();
        }
        if (emptyNode) {
            emptyNode.hidden = false;
            emptyNode.textContent = 'Готовлю пересказ истории…';
        }
        updateActionState();
    }

    function renderMarkdown(text) {
        const fragment = document.createDocumentFragment();
        let list = null;
        let listType = '';
        let paragraphLines = [];

        const flushParagraph = () => {
            if (!paragraphLines.length) return;
            const paragraph = document.createElement('p');
            paragraph.textContent = paragraphLines.join(' ');
            fragment.appendChild(paragraph);
            paragraphLines = [];
        };
        const closeList = () => {
            list = null;
            listType = '';
        };

        for (const rawLine of String(text || '').split(/\r?\n/)) {
            const line = rawLine.trim();
            const heading = line.match(/^(#{1,3})\s+(.+)$/);
            const unordered = line.match(/^[-*•]\s+(.+)$/);
            const ordered = line.match(/^\d+[.)]\s+(.+)$/);

            if (heading) {
                flushParagraph();
                closeList();
                const node = document.createElement(heading[1].length <= 2 ? 'h2' : 'h3');
                node.textContent = heading[2];
                fragment.appendChild(node);
            } else if (unordered || ordered) {
                flushParagraph();
                const nextType = unordered ? 'ul' : 'ol';
                if (!list || listType !== nextType) {
                    list = document.createElement(nextType);
                    listType = nextType;
                    fragment.appendChild(list);
                }
                const item = document.createElement('li');
                item.textContent = (unordered || ordered)[1];
                list.appendChild(item);
            } else if (!line) {
                flushParagraph();
                closeList();
            } else {
                closeList();
                paragraphLines.push(line);
            }
        }
        flushParagraph();
        return fragment;
    }

    function showSummary(summary, details) {
        lastSummary = summary;
        emptyNode.hidden = true;
        resultNode.hidden = false;
        resultNode.replaceChildren(renderMarkdown(summary));
        progressBar.style.setProperty('width', '100%', 'important');
        progressTrack.setAttribute('aria-valuenow', '100');
        progressTrack.classList.remove('is-error');
        progressTrack.classList.add('is-complete');
        setStatusOnly(details.status, details.metrics);
        updateActionState();
    }

    function showError(error) {
        lastSummary = '';
        resultNode.hidden = false;
        resultNode.replaceChildren();
        const box = document.createElement('div');
        box.className = 'tm-sc-summary-error';
        box.textContent = error?.message || 'Неизвестная ошибка.';
        resultNode.appendChild(box);
        emptyNode.hidden = true;
        progressTrack.classList.remove('is-complete');
        progressTrack.classList.add('is-error');
        setStatusOnly('Пересказ не создан', 'Можно попробовать ещё раз');
        updateActionState();
    }

    function formatUsage(usage) {
        const total = Math.max(0, Number(usage?.total_tokens) || 0);
        if (!total) return '';
        return `${integerFormatter.format(total)} токенов`;
    }

    async function generateSummary({ force }) {
        ensureContext();
        if (!activeContext || running) return;
        openOverlay();
        running = true;
        const serial = ++runSerial;
        showLoading();
        setProgress(2, 'Подключаюсь к истории SpicyChat…');

        try {
            await waitForApiAccess(serial);
            const contextAtStart = { ...activeContext };
            const history = await fetchCompleteHistory(contextAtStart, serial);
            if (serial !== runSerial || contextAtStart.key !== activeContext?.key) return;
            if (!history.messages.length) throw new Error('В этом диалоге не нашлось сообщений для пересказа.');

            const fingerprint = historyFingerprint(history.messages);
            const cacheKey = `${CACHE_PREFIX}${contextAtStart.key}`;
            const cached = force ? null : await readCache(cacheKey);
            if (
                cached
                && cached.fingerprint === fingerprint
                && typeof cached.summary === 'string'
                && cached.summary.trim()
            ) {
                running = false;
                showSummary(cached.summary, {
                    status: 'Показан сохранённый пересказ',
                    metrics: `${history.messages.length} сообщений · ${formatUsage(cached.usage) || 'из кеша'}`,
                });
                return;
            }

            const blocks = buildMessageBlocks(history);
            const chunks = splitIntoChunks(blocks);
            setProgress(
                42,
                `История загружена: ${history.messages.length} сообщений`,
                `Частей для обработки: ${chunks.length}`,
            );
            const generated = await makeSummary(chunks, serial);
            if (serial !== runSerial || contextAtStart.key !== activeContext?.key) return;

            await writeCache(cacheKey, {
                fingerprint,
                summary: generated.summary,
                generatedAt: Date.now(),
                messageCount: history.messages.length,
                chunkCount: generated.chunkCount,
                usage: generated.usage,
            });

            running = false;
            showSummary(generated.summary, {
                status: 'Пересказ готов',
                metrics: `${history.messages.length} сообщений · ${generated.chunkCount} частей · ${formatUsage(generated.usage)}`,
            });
        } catch (error) {
            if (serial !== runSerial) return;
            running = false;
            showError(error);
        }
    }

    function cloneMenuButton(template) {
        const button = runtime.dom.cloneMenuButton(template);
        button.classList.add(MENU_ITEM_CLASS);
        button.setAttribute('aria-label', 'Пересказать чат');
        button.removeAttribute('data-testid');
        button.querySelector('svg')?.remove();
        button.insertAdjacentHTML('afterbegin', icons.summary);
        const labels = Array.from(button.querySelectorAll('p, span'));
        if (labels[0]) labels[0].textContent = 'Пересказать чат';
        for (const extra of labels.slice(1)) extra.remove();
        return button;
    }

    function findChatMenu(dropdown) {
        return runtime.dom.chatMenu(dropdown);
    }

    function normalizeCustomChatMenuOrder(menu) {
        const desired = CHAT_MENU_ITEM_ORDER
            .map((className) => menu.querySelector(`.${className}`))
            .filter(Boolean);
        if (!desired.length) return;
        const currentPrefix = Array.from(menu.children).slice(0, desired.length);
        if (desired.every((item, index) => currentPrefix[index] === item)) return;

        const firstNative = Array.from(menu.children).find((item) => (
            !CHAT_MENU_ITEM_ORDER.some((className) => item.classList.contains(className))
        )) || null;
        for (const item of desired) menu.insertBefore(item, firstNative);
    }

    function ensureChatMenuItem() {
        for (const dropdown of document.querySelectorAll(CHAT_DROPDOWN_SELECTOR)) {
            const menu = findChatMenu(dropdown);
            if (!menu) continue;

            let button = menu.querySelector(`.${MENU_ITEM_CLASS}`);
            if (!button) {
                const template = (
                    menu.querySelector(`.${GALLERY_MENU_ITEM_CLASS}`)
                    || menu.querySelector(`.${BOOKMARK_MENU_ITEM_CLASS}`)
                    || menu.querySelector('button[aria-label="View Saved Chats" i]')
                    || menu.querySelector('button, [role="menuitem"]')
                );
                if (!template) continue;
                button = cloneMenuButton(template);
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    dropdown.click();
                    window.setTimeout(() => {
                        openOverlay();
                        if (!running && !lastSummary) void generateSummary({ force: false });
                    }, 0);
                });
                menu.insertBefore(button, menu.firstElementChild);
            }

            normalizeCustomChatMenuOrder(menu);
        }
    }

    function scheduleEnsure() {
        if (ensureScheduled) return;
        ensureScheduled = true;
        requestAnimationFrame(runDomPass);
    }

    function nodeTouchesSummarySurface(node, includeDescendants = true) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
        if (node.closest?.(`#${OVERLAY_ID}`)) return false;
        const selector = `${CHAT_DROPDOWN_SELECTOR}, button[aria-label="View Saved Chats" i]`;
        return node.matches?.(selector) || (includeDescendants && Boolean(node.querySelector?.(selector)));
    }

    function handleRootMutations(records) {
        const relevant = records.some((record) => (
            nodeTouchesSummarySurface(record.target, false)
            || Array.from(record.addedNodes).some((node) => nodeTouchesSummarySurface(node, true))
            || Array.from(record.removedNodes).some((node) => nodeTouchesSummarySurface(node, true))
        ));
        if (relevant) scheduleEnsure();
    }

    function handleKeydown(event) {
        if (overlay && !overlay.hidden && event.key === 'Escape') {
            event.preventDefault();
            closeOverlay();
        }
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
            ensureContext();
            ensureOverlay();
            ensureChatMenuItem();

            if (!rootObserver) {
                rootObserver = new MutationObserver(handleRootMutations);
                rootObserver.observe(document.documentElement, { childList: true, subtree: true });
            }
            window.addEventListener('keydown', handleKeydown, true);
            resetRetry();
        } catch (error) {
            rootObserver?.disconnect();
            rootObserver = null;
            window.removeEventListener('keydown', handleKeydown, true);
            console.error('[Chat Summary] DOM-инициализация сорвалась, повторю автоматически.', error);
            scheduleRetry();
        }
    }

    function startDomFeatures() {
        runDomPass();
    }

    function cleanup() {
        runSerial += 1;
        running = false;
        rootObserver?.disconnect();
        rootObserver = null;
        ensureScheduled = false;
        resetRetry();
        window.removeEventListener('keydown', handleKeydown, true);
    }

    installApiCapture();
    installRouteChangeSignal();
    window.addEventListener('pagehide', cleanup);
    window.addEventListener(ROUTE_CHANGE_EVENT, startDomFeatures);
    window.addEventListener('pageshow', startDomFeatures);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) startDomFeatures();
    });
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startDomFeatures, { once: true });
    }
    startDomFeatures();
    runtime.dom.subscribe(scheduleEnsure);

}


// ---- src/modules/tts.js ----

// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
function init_tts(runtime) {
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


// ---- src/modules/emoji.js ----

// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
function init_emoji(runtime) {
    'use strict';

    const INSTANCE_KEY = '__spicyChatEmojiPickerV1';
    if (window[INSTANCE_KEY]) return;
    window[INSTANCE_KEY] = true;

    const TEXTAREA_SELECTOR = 'textarea[placeholder="Message..."]';
    const NATIVE_ACTION_SELECTOR = 'button[aria-label="record-voice"], button[aria-label="send-message"]';
    const STORAGE_KEY = 'tm-spicychat-emoji-picker-state-v1';
    const STYLE_ID = 'tm-sc-emoji-picker-style';
    const TRIGGER_WRAP_ID = 'tm-sc-emoji-trigger-wrap';
    const PICKER_ID = 'tm-sc-emoji-picker';
    const MAX_RECENT = 64;
    const MAX_USAGE_ENTRIES = 300;

    const emojiList = (value) => value.trim().split(/\s+/u);

    const EMOJIS = {
        faces: emojiList(`
            😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋
            😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 🙂‍↕️ 😏 😒 🙂‍↔️ 😞 😔 😟 😕 🙁 ☹️ 😣 😖
            😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫣 🤭 🫢 🫡
            🤫 🫠 🤥 😶 😶‍🌫️ 😐 😑 😬 🫨 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 😵‍💫 🥴 🤐
            🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👹 👺 🤡 💩 👻 💀 ☠️ 👽 👾 🤖 🎃 😺 😸 😹
            😻 😼 😽 🙀 😿 😾 🫶 🥹 🫥 🫤 🥱 🤓 🥸 😎 🤩 🥳 😇 😈 😏 🥵 😳 🥺 😭
            🙈 🙉 🙊 💋 💌 💘 💝 💖 💗 💓 💞 💕 💟 ❣️ ❤️ 🩷 🧡 💛 💚 💙 🩵 💜 🤎
            🖤 🩶 🤍 ❤️‍🔥 ❤️‍🩹 💔 ♥️ 💯 💢 💥 💫 💦 💨 🕳️ 💬 👁️‍🗨️ 🗨️ 🗯️ 💭 💤
        `),
        people: emojiList(`
            👋 🤚 🖐️ ✋ 🖖 🫱 🫲 🫳 🫴 🫷 🫸 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉
            👆 🖕 👇 ☝️ 🫵 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾
            🦿 🦵 🦶 👂 🦻 👃 🧠 🫀 🫁 🦷 🦴 👀 👁️ 👅 👄 🫦 💋 🩸 👶 🧒 👦 👧
            🧑 👱 👨 🧔 🧔‍♂️ 🧔‍♀️ 👩 🧓 👴 👵 👲 👳‍♂️ 👳‍♀️ 🧕 👮‍♂️ 👮‍♀️ 👷‍♂️ 👷‍♀️
            💂‍♂️ 💂‍♀️ 🕵️‍♂️ 🕵️‍♀️ 👩‍⚕️ 👨‍⚕️ 👩‍🌾 👨‍🌾 👩‍🍳 👨‍🍳 👩‍🎓 👨‍🎓 👩‍🎤 👨‍🎤
            👩‍🏫 👨‍🏫 👩‍🏭 👨‍🏭 👩‍💻 👨‍💻 👩‍💼 👨‍💼 👩‍🔧 👨‍🔧 👩‍🔬 👨‍🔬 👩‍🎨 👨‍🎨
            👩‍🚒 👨‍🚒 👩‍✈️ 👨‍✈️ 👩‍🚀 👨‍🚀 👩‍⚖️ 👨‍⚖️ 👰‍♀️ 👰‍♂️ 🤵‍♀️ 🤵‍♂️ 👸 🤴
            🥷 🦸‍♀️ 🦸‍♂️ 🦹‍♀️ 🦹‍♂️ 🤶 🎅 🧙‍♀️ 🧙‍♂️ 🧝‍♀️ 🧝‍♂️ 🧛‍♀️ 🧛‍♂️ 🧟‍♀️ 🧟‍♂️
            🧞‍♀️ 🧞‍♂️ 🧜‍♀️ 🧜‍♂️ 🧚‍♀️ 🧚‍♂️ 👼 🤰 🫃 🫄 🤱 👩‍🍼 👨‍🍼 🙇‍♀️ 🙇‍♂️
            💁‍♀️ 💁‍♂️ 🙅‍♀️ 🙅‍♂️ 🙆‍♀️ 🙆‍♂️ 🙋‍♀️ 🙋‍♂️ 🧏‍♀️ 🧏‍♂️ 🤦‍♀️ 🤦‍♂️ 🤷‍♀️ 🤷‍♂️
            🙎‍♀️ 🙎‍♂️ 🙍‍♀️ 🙍‍♂️ 💇‍♀️ 💇‍♂️ 💆‍♀️ 💆‍♂️ 🧖‍♀️ 🧖‍♂️ 💃 🕺 👯‍♀️ 👯‍♂️
            🕴️ 👩‍🦽 👨‍🦽 👩‍🦼 👨‍🦼 🚶‍♀️ 🚶‍♂️ 👩‍🦯 👨‍🦯 🧎‍♀️ 🧎‍♂️ 🏃‍♀️ 🏃‍♂️
            🧍‍♀️ 🧍‍♂️ 👭 👫 👬 🧑‍🤝‍🧑 💏 👩‍❤️‍💋‍👨 👨‍❤️‍💋‍👨 👩‍❤️‍💋‍👩 💑 👩‍❤️‍👨
            👨‍❤️‍👨 👩‍❤️‍👩 👪 👨‍👩‍👧 👨‍👩‍👧‍👦 👨‍👩‍👦‍👦 👨‍👩‍👧‍👧 👩‍👩‍👦 👨‍👨‍👧
        `),
        animals: emojiList(`
            🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐽 🐸 🐵 🙈 🙉 🙊
            🐒 🐔 🐧 🐦 🐤 🐣 🐥 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🫎 🫏 🐝 🪱 🐛 🦋
            🐌 🪲 🐞 🦗 🪳 🕷️ 🕸️ 🦂 🐢 🐍 🦎 🦖 🦕 🐙 🦑 🪼 🦐 🦞 🦀 🐡 🐠
            🐟 🐬 🐳 🐋 🦈 🦭 🐊 🐅 🐆 🦓 🦍 🦧 🦣 🐘 🦛 🦏 🐪 🐫 🦒 🦘 🦬
            🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🦮 🐕‍🦺 🐈 🐈‍⬛ 🪽 🪶 🐓 🦃
            🦤 🦚 🦜 🦢 🪿 🦩 🕊️ 🐇 🦝 🦨 🦡 🦫 🦦 🦥 🐁 🐀 🐿️ 🦔 🐾 🐉 🐲
            🌵 🎄 🌲 🌳 🌴 🪹 🪺 🪵 🌱 🌿 ☘️ 🍀 🎍 🪴 🎋 🍃 🍂 🍁 🍄 🐚 🪸 🪨
            🌾 💐 🌷 🪷 🌹 🥀 🌺 🌸 🪻 🌼 🌻 🌞 🌝 🌛 🌜 🌚 🌕 🌖 🌗 🌘 🌑
            🌒 🌓 🌔 🌙 🌎 🌍 🌏 🪐 💫 ⭐ 🌟 ✨ ⚡ ☄️ 💥 🔥 🌪️ 🌈 ☀️ 🌤️ ⛅
            🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 💨 💧 💦 ☔ ☂️ 🌊 🌫️
        `),
        food: emojiList(`
            🍏 🍎 🍐 🍊 🍋 🍋‍🟩 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆
            🥑 🫛 🥦 🥬 🥒 🌶️ 🫑 🌽 🥕 🫒 🧄 🧅 🥔 🍠 🫚 🫘 🌰 🥜 🍄‍🟫
            🍞 🥐 🥖 🫓 🥨 🥯 🥞 🧇 🧀 🍖 🍗 🥩 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯
            🫔 🥙 🧆 🥚 🍳 🥘 🍲 🫕 🥣 🥗 🍿 🧈 🧂 🥫 🍱 🍘 🍙 🍚 🍛 🍜
            🍝 🍢 🍣 🍤 🍥 🥮 🍡 🥟 🥠 🥡 🦪 🍦 🍧 🍨 🍩 🍪 🎂 🍰 🧁 🥧 🍫
            🍬 🍭 🍮 🍯 🍼 🥛 ☕ 🫖 🍵 🍶 🍾 🍷 🍸 🍹 🍺 🍻 🥂 🥃 🫗 🥤 🧋
            🧃 🧉 🧊 🥢 🍽️ 🍴 🥄 🔪 🫙 🏺 🍒 🍑 🍆 🌭 💦 😋 🤤 🥵
        `),
        activities: emojiList(`
            ⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🪃 🥅 ⛳
            🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🪂 🏋️‍♀️ 🏋️‍♂️
            🤼‍♀️ 🤼‍♂️ 🤸‍♀️ 🤸‍♂️ ⛹️‍♀️ ⛹️‍♂️ 🤺 🤾‍♀️ 🤾‍♂️ 🏌️‍♀️ 🏌️‍♂️ 🏇 🧘‍♀️ 🧘‍♂️
            🏄‍♀️ 🏄‍♂️ 🏊‍♀️ 🏊‍♂️ 🤽‍♀️ 🤽‍♂️ 🚣‍♀️ 🚣‍♂️ 🧗‍♀️ 🧗‍♂️ 🚵‍♀️ 🚵‍♂️ 🚴‍♀️ 🚴‍♂️
            🏆 🥇 🥈 🥉 🏅 🎖️ 🏵️ 🎗️ 🎫 🎟️ 🎪 🤹‍♀️ 🤹‍♂️ 🎭 🩰 🎨 🎬 🎤
            🎧 🎼 🎹 🪗 🥁 🪘 🎷 🎺 🪈 🎸 🪕 🎻 🪇 🎲 ♟️ 🎯 🎳 🎮 🕹️ 🎰
            🧩 🧸 🪅 🪩 🪆 ♠️ ♥️ ♦️ ♣️ 🃏 🀄 🎴 🔮 🪄 🧿 🎱 🎉 🎊 🎈 🎁
            🎀 🪄 ✨ 🎆 🎇 🧨 🎄 🎃 🎗️ 🎟️ 🎫 🏟️ 🏖️ 🏕️
        `),
        travel: emojiList(`
            🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🦽 🦼 🛴 🚲 🛵 🏍️
            🛺 🚨 🚔 🚍 🚘 🚖 🛞 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇
            🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🛰️ 🚀 🛸 🚁 🛶 ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢 ⚓
            🛟 🪝 ⛽ 🚧 🚦 🚥 🗺️ 🗿 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🛝 🎠 ⛲ ⛱️
            🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🗻 🏕️ ⛺ 🛖 🏠 🏡 🏘️ 🏚️ 🏗️ 🏭 🏢 🏬
            🏣 🏤 🏥 🏦 🏨 🏪 🏫 🏩 💒 🏛️ ⛪ 🕌 🕍 🛕 🕋 ⛩️ 🛤️ 🛣️ 🗾
            🎑 🏞️ 🌅 🌄 🌠 🎇 🎆 🌇 🌆 🏙️ 🌃 🌌 🌉 🌁 ⌚ 📱 💻 🧭 🧳 🌍
        `),
        objects: emojiList(`
            ⌚ 📱 📲 💻 ⌨️ 🖥️ 🖨️ 🖱️ 🖲️ 🕹️ 🗜️ 💽 💾 💿 📀 📼 📷 📸
            📹 🎥 📽️ 🎞️ 📞 ☎️ 📟 📠 📺 📻 🎙️ 🎚️ 🎛️ 🧭 ⏱️ ⏲️ ⏰ 🕰️
            ⌛ ⏳ 📡 🔋 🪫 🔌 💡 🔦 🕯️ 🪔 🧯 🛢️ 💸 💵 💴 💶 💷 🪙 💰 💳
            💎 ⚖️ 🪜 🧰 🪛 🔧 🔨 ⚒️ 🛠️ ⛏️ 🪚 🔩 ⚙️ 🪤 🧱 ⛓️ ⛓️‍💥 🧲 🔫
            💣 🧨 🪓 🔪 🗡️ ⚔️ 🛡️ 🚬 ⚰️ 🪦 ⚱️ 🏺 🔮 📿 🧿 🪬 💈 ⚗️ 🔭 🔬
            🕳️ 🩹 🩺 🩻 🩼 💊 💉 🩸 🧬 🦠 🧫 🧪 🌡️ 🧹 🪠 🧺 🧻 🚽 🚿
            🛁 🛀 🪥 🪒 🧼 🫧 🪮 🧽 🪣 🧴 🛎️ 🔑 🗝️ 🚪 🪑 🛋️ 🛏️ 🛌 🧸
            🪞 🪟 🛍️ 🛒 🎁 🎈 🎏 🎀 🪄 🪅 🎊 🎉 🪩 🪆 🖼️ 🧵 🪡 🧶 🪢 👓
            🕶️ 🥽 🥼 🦺 👔 👕 👖 🧣 🧤 🧥 🧦 👗 👘 🥻 🩱 🩲 🩳 👙 👚
            🪭 👛 👜 👝 🛍️ 🎒 🩴 👞 👟 🥾 🥿 👠 👡 🩰 👢 🪮 👑 👒 🎩 🎓
            🧢 🪖 ⛑️ 💄 💍 💼 📁 📂 🗂️ 🗃️ 🗄️ 📊 📈 📉 📋 📌 📍 📎 🖇️
            📏 📐 ✂️ 🗑️ 📝 ✏️ 🖊️ 🖋️ 🖌️ 🖍️ 📚 📖 🔖 🧷 🔐 🔒 🔓 🗒️ 📄
            📃 📜 📑 🧾 ✉️ 📧 📨 📩 📤 📥 📦 📫 📪 📬 📭 📮 🗳️
        `),
        symbols: emojiList(`
            ❤️ 🩷 🧡 💛 💚 💙 🩵 💜 🤎 🖤 🩶 🤍 💔 ❤️‍🔥 ❤️‍🩹 ❣️ 💕 💞 💓
            💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉️ ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ♉
            ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🆔 ⚛️ 🉑 ☢️ ☣️ 📴 📳 🈶 🈚 🈸 🈺
            🈷️ ✴️ 🆚 💮 🉐 ㊙️ ㊗️ 🈴 🈵 🈹 🈲 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ❌ ⭕
            🛑 ⛔ 📛 🚫 💯 💢 ♨️ 🚷 🚯 🚳 🚱 🔞 📵 🚭 ❗ ❕ ❓ ❔ ‼️ ⁉️
            🔅 🔆 〽️ ⚠️ 🚸 🔱 ⚜️ 🔰 ♻️ ✅ 🈯 💹 ❇️ ✳️ ❎ 🌐 💠 Ⓜ️ 🌀 💤
            🏧 🚾 ♿ 🅿️ 🛗 🈳 🈂️ 🛂 🛃 🛄 🛅 🚹 🚺 🚼 ⚧️ 🚻 🚮 🎦 📶
            🈁 🔣 ℹ️ 🔤 🔡 🔠 🆖 🆗 🆙 🆒 🆕 🆓 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣
            6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 🔢 #️⃣ *️⃣ ⏏️ ▶️ ⏸️ ⏯️ ⏹️ ⏺️ ⏭️ ⏮️ ⏩ ⏪
            ⏫ ⏬ ◀️ 🔼 🔽 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ ↙️ ↖️ ↕️ ↔️ ↪️ ↩️ ⤴️ ⤵️
            🔀 🔁 🔂 🔄 🔃 🎵 🎶 ➕ ➖ ➗ ✖️ 🟰 ♾️ 💲 💱 ™️ ©️ ®️ 〰️ ➰
            ➿ 🔚 🔙 🔛 🔝 🔜 ✔️ ☑️ 🔘 🔴 🟠 🟡 🟢 🔵 🟣 🟤 ⚫ ⚪ 🟥 🟧
            🟨 🟩 🟦 🟪 🟫 ⬛ ⬜ ◼️ ◻️ ◾ ◽ ▪️ ▫️ 🔸 🔹 🔶 🔷 🔺 🔻 💠
            🔳 🔲 🧿 👁️‍🗨️ 💬 🗨️ 🗯️ 💭 💤 ♠️ ♥️ ♦️ ♣️ 🃏
        `),
        flags: emojiList(`
            🏁 🚩 🎌 🏴 🏳️ 🏳️‍🌈 🏳️‍⚧️ 🏴‍☠️ 🇺🇳 🇦🇫 🇦🇱 🇩🇿 🇦🇸 🇦🇩 🇦🇴 🇦🇮
            🇦🇶 🇦🇬 🇦🇷 🇦🇲 🇦🇼 🇦🇺 🇦🇹 🇦🇿 🇧🇸 🇧🇭 🇧🇩 🇧🇧 🇧🇾 🇧🇪 🇧🇿 🇧🇯
            🇧🇲 🇧🇹 🇧🇴 🇧🇦 🇧🇼 🇧🇷 🇧🇳 🇧🇬 🇧🇫 🇧🇮 🇰🇭 🇨🇲 🇨🇦 🇨🇻 🇨🇫 🇹🇩
            🇨🇱 🇨🇳 🇨🇴 🇰🇲 🇨🇬 🇨🇩 🇨🇷 🇨🇮 🇭🇷 🇨🇺 🇨🇾 🇨🇿 🇩🇰 🇩🇯 🇩🇲 🇩🇴
            🇪🇨 🇪🇬 🇸🇻 🇬🇶 🇪🇷 🇪🇪 🇸🇿 🇪🇹 🇪🇺 🇫🇯 🇫🇮 🇫🇷 🇬🇦 🇬🇲 🇬🇪 🇩🇪
            🇬🇭 🇬🇷 🇬🇩 🇬🇹 🇬🇳 🇬🇼 🇬🇾 🇭🇹 🇭🇳 🇭🇰 🇭🇺 🇮🇸 🇮🇳 🇮🇩 🇮🇷 🇮🇶
            🇮🇪 🇮🇱 🇮🇹 🇯🇲 🇯🇵 🇯🇴 🇰🇿 🇰🇪 🇰🇮 🇰🇵 🇰🇷 🇽🇰 🇰🇼 🇰🇬 🇱🇦 🇱🇻
            🇱🇧 🇱🇸 🇱🇷 🇱🇾 🇱🇮 🇱🇹 🇱🇺 🇲🇬 🇲🇼 🇲🇾 🇲🇻 🇲🇱 🇲🇹 🇲🇭 🇲🇷 🇲🇺
            🇲🇽 🇫🇲 🇲🇩 🇲🇨 🇲🇳 🇲🇪 🇲🇦 🇲🇿 🇲🇲 🇳🇦 🇳🇷 🇳🇵 🇳🇱 🇳🇿 🇳🇮 🇳🇪
            🇳🇬 🇲🇰 🇳🇴 🇴🇲 🇵🇰 🇵🇼 🇵🇸 🇵🇦 🇵🇬 🇵🇾 🇵🇪 🇵🇭 🇵🇱 🇵🇹 🇶🇦 🇷🇴
            🇷🇺 🇷🇼 🇼🇸 🇸🇲 🇸🇦 🇸🇳 🇷🇸 🇸🇨 🇸🇱 🇸🇬 🇸🇰 🇸🇮 🇸🇧 🇸🇴 🇿🇦 🇸🇸
            🇪🇸 🇱🇰 🇸🇩 🇸🇷 🇸🇪 🇨🇭 🇸🇾 🇹🇼 🇹🇯 🇹🇿 🇹🇭 🇹🇱 🇹🇬 🇹🇴 🇹🇹 🇹🇳
            🇹🇷 🇹🇲 🇹🇻 🇺🇬 🇺🇦 🇦🇪 🇬🇧 🇺🇸 🇺🇾 🇺🇿 🇻🇺 🇻🇦 🇻🇪 🇻🇳 🇾🇪 🇿🇲
            🇿🇼 🏴 🏴 🏴
        `),
    };

    const DEFAULT_RECENT = emojiList(`
        😂 🤣 ❤️ 🥰 😍 😘 😉 😊 😏 😈 🥵 😳 🥺 😭 😅 🤭 🙈 🫶 👍 👀 💋
        🔥 ✨ 💦 💕 💔 😒 🙄 🤔 😴 💀 🤡 😎 🥳 😡 🤬 😱 😌 😋 🤤 🍑 🍆
    `);

    const CATEGORIES = [
        { id: 'recent', icon: '🕘', label: 'Недавние' },
        { id: 'frequent', icon: '🔥', label: 'Частые' },
        { id: 'faces', icon: '😀', label: 'Смайлы и эмоции' },
        { id: 'people', icon: '👋', label: 'Люди и жесты' },
        { id: 'animals', icon: '🐻', label: 'Животные и природа' },
        { id: 'food', icon: '🍕', label: 'Еда и напитки' },
        { id: 'activities', icon: '⚽', label: 'Занятия и развлечения' },
        { id: 'travel', icon: '🚗', label: 'Места и транспорт' },
        { id: 'objects', icon: '💡', label: 'Предметы' },
        { id: 'symbols', icon: '❤️', label: 'Символы' },
        { id: 'flags', icon: '🏳️', label: 'Флаги' },
    ];

    const validCategoryIds = new Set(CATEGORIES.map((category) => category.id));
    let state = loadState();
    let activeCategory = validCategoryIds.has(state.lastCategory) ? state.lastCategory : 'recent';
    let activeTextarea = null;
    let triggerButton = null;
    let picker = null;
    let categoryTabs = null;
    let categoryTitle = null;
    let emojiGrid = null;
    let ensureScheduled = false;
    let rootObserver = null;
    let retryTimer = null;
    let retryDelay = 250;

    function loadState() {
        const fallback = { recent: [], usage: {}, lastCategory: 'recent' };
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (!parsed || typeof parsed !== 'object') return fallback;
            return {
                recent: Array.isArray(parsed.recent)
                    ? parsed.recent.filter((item) => typeof item === 'string').slice(0, MAX_RECENT)
                    : [],
                usage: parsed.usage && typeof parsed.usage === 'object' ? parsed.usage : {},
                lastCategory: typeof parsed.lastCategory === 'string' ? parsed.lastCategory : 'recent',
            };
        } catch (_error) {
            return fallback;
        }
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (_error) {
            // Если localStorage недоступен, сам пикер всё равно продолжит работать.
        }
    }

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const css = `
            #${TRIGGER_WRAP_ID} {
                display: flex !important;
                flex: 0 0 auto !important;
                order: 999 !important;
                align-items: flex-end !important;
                align-self: flex-end !important;
                margin-bottom: 4px !important;
            }

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger {
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

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger:hover,
            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[aria-expanded="true"] {
                color: #ffffff !important;
                background: rgba(255, 255, 255, 0.11) !important;
            }

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger:active {
                transform: scale(0.94) !important;
            }

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger:focus-visible {
                outline: 2px solid #1687f8 !important;
                outline-offset: 2px !important;
            }

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]::before,
            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]::after {
                position: absolute !important;
                left: 50% !important;
                z-index: 2147483647 !important;
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
                transition: opacity 120ms ease, transform 120ms ease, visibility 0s linear 120ms !important;
            }

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]::before {
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

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]::after {
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
                #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]:hover::before,
                #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]:hover::after {
                    opacity: 1 !important;
                    visibility: visible !important;
                    transition-delay: 320ms !important;
                }

                #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]:hover::before {
                    transform: translate(-50%, 0) !important;
                }

                #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]:hover::after {
                    transform: translate(-50%, 0) rotate(45deg) !important;
                }
            }

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]:focus-visible::before,
            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]:focus-visible::after {
                opacity: 1 !important;
                visibility: visible !important;
                transition-delay: 0ms !important;
            }

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]:focus-visible::before {
                transform: translate(-50%, 0) !important;
            }

            #${TRIGGER_WRAP_ID} .tm-sc-emoji-trigger[data-tm-tooltip]:focus-visible::after {
                transform: translate(-50%, 0) rotate(45deg) !important;
            }

            #${PICKER_ID} {
                position: fixed !important;
                z-index: 2147483647 !important;
                box-sizing: border-box !important;
                width: min(392px, calc(100vw - 20px)) !important;
                height: min(438px, calc(100vh - 92px)) !important;
                min-height: 280px !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
                color: #f5f5f5 !important;
                color-scheme: dark !important;
                background: #1b1b1d !important;
                border: 1px solid rgba(255, 255, 255, 0.13) !important;
                border-radius: 16px !important;
                box-shadow: 0 18px 55px rgba(0, 0, 0, 0.58), 0 4px 14px rgba(0, 0, 0, 0.34) !important;
                font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
                user-select: none !important;
            }

            #${PICKER_ID}[hidden] {
                display: none !important;
            }

            #${PICKER_ID} .tm-sc-emoji-header {
                box-sizing: border-box !important;
                height: 52px !important;
                padding: 0 12px 0 16px !important;
                display: flex !important;
                flex: 0 0 auto !important;
                align-items: center !important;
                justify-content: space-between !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.09) !important;
            }

            #${PICKER_ID} .tm-sc-emoji-title {
                min-width: 0 !important;
                overflow: hidden !important;
                color: #f5f5f5 !important;
                font-size: 14px !important;
                font-weight: 650 !important;
                line-height: 1.2 !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }

            #${PICKER_ID} .tm-sc-emoji-close {
                appearance: none !important;
                width: 32px !important;
                height: 32px !important;
                padding: 0 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: rgba(255, 255, 255, 0.7) !important;
                background: transparent !important;
                border: 0 !important;
                border-radius: 9px !important;
                cursor: pointer !important;
                font: 25px/1 ui-sans-serif, system-ui, sans-serif !important;
            }

            #${PICKER_ID} .tm-sc-emoji-close:hover {
                color: #fff !important;
                background: rgba(255, 255, 255, 0.1) !important;
            }

            #${PICKER_ID} .tm-sc-emoji-tabs {
                box-sizing: border-box !important;
                min-height: 51px !important;
                padding: 7px 8px 6px !important;
                display: flex !important;
                flex: 0 0 auto !important;
                gap: 3px !important;
                overflow-x: auto !important;
                overflow-y: hidden !important;
                scrollbar-width: none !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.07) !important;
            }

            #${PICKER_ID} .tm-sc-emoji-tabs::-webkit-scrollbar {
                display: none !important;
            }

            #${PICKER_ID} .tm-sc-emoji-tab {
                appearance: none !important;
                box-sizing: border-box !important;
                width: 37px !important;
                height: 37px !important;
                min-width: 37px !important;
                padding: 0 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                background: transparent !important;
                border: 0 !important;
                border-radius: 10px !important;
                cursor: pointer !important;
                font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif !important;
                font-size: 20px !important;
                line-height: 1 !important;
                transition: background-color 100ms ease, transform 100ms ease !important;
            }

            #${PICKER_ID} .tm-sc-emoji-tab:hover {
                background: rgba(255, 255, 255, 0.09) !important;
            }

            #${PICKER_ID} .tm-sc-emoji-tab.is-active {
                background: rgba(22, 135, 248, 0.22) !important;
                box-shadow: inset 0 0 0 1px rgba(43, 148, 255, 0.46) !important;
            }

            #${PICKER_ID} .tm-sc-emoji-tab:active {
                transform: scale(0.93) !important;
            }

            #${PICKER_ID} .tm-sc-emoji-grid {
                box-sizing: border-box !important;
                padding: 10px 9px 13px !important;
                display: grid !important;
                flex: 1 1 auto !important;
                grid-template-columns: repeat(8, minmax(0, 1fr)) !important;
                grid-auto-rows: 42px !important;
                align-content: start !important;
                gap: 3px !important;
                overflow-x: hidden !important;
                overflow-y: auto !important;
                overscroll-behavior: contain !important;
                scrollbar-color: rgba(255, 255, 255, 0.24) transparent !important;
                scrollbar-width: thin !important;
            }

            #${PICKER_ID} .tm-sc-emoji-item {
                appearance: none !important;
                box-sizing: border-box !important;
                width: 100% !important;
                height: 42px !important;
                min-width: 0 !important;
                padding: 0 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                overflow: visible !important;
                background: transparent !important;
                border: 0 !important;
                border-radius: 10px !important;
                cursor: pointer !important;
                font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif !important;
                font-size: 27px !important;
                line-height: 1 !important;
                transition: background-color 90ms ease, transform 90ms ease !important;
            }

            #${PICKER_ID} .tm-sc-emoji-item:hover {
                background: rgba(255, 255, 255, 0.11) !important;
                transform: scale(1.16) !important;
            }

            #${PICKER_ID} .tm-sc-emoji-item:active {
                transform: scale(0.92) !important;
            }

            #${PICKER_ID} .tm-sc-emoji-empty {
                grid-column: 1 / -1 !important;
                padding: 38px 18px !important;
                color: rgba(255, 255, 255, 0.55) !important;
                font-size: 13px !important;
                line-height: 1.45 !important;
                text-align: center !important;
            }

            @media (max-width: 520px) {
                #${PICKER_ID} .tm-sc-emoji-grid {
                    grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
                }
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

    function findTextarea() {
        const candidates = Array.from(document.querySelectorAll(TEXTAREA_SELECTOR)).filter(isVisible);
        return candidates.length ? candidates[candidates.length - 1] : null;
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

    function getDirectRowChild(row, element) {
        let child = element;
        while (child && child.parentElement && child.parentElement !== row) {
            child = child.parentElement;
        }
        return child && child.parentElement === row ? child : null;
    }

    function hideNativeActionSlots(row) {
        const slots = new Set();
        for (const button of row.querySelectorAll(NATIVE_ACTION_SELECTOR)) {
            const slot = getDirectRowChild(row, button);
            if (slot) slots.add(slot);
        }

        for (const slot of slots) {
            slot.dataset.tmScEmojiHiddenNativeAction = 'true';
            slot.style.setProperty('display', 'none', 'important');
        }
    }

    function createTrigger() {
        const wrap = document.createElement('div');
        wrap.id = TRIGGER_WRAP_ID;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tm-sc-emoji-trigger';
        button.setAttribute('aria-label', 'Открыть эмодзи');
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-expanded', 'false');
        button.dataset.tmTooltip = 'Эмодзи';
        button.innerHTML = `
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                <path d="M9 9h.01"></path>
                <path d="M15 9h.01"></path>
            </svg>
        `;

        button.addEventListener('mousedown', (event) => {
            event.preventDefault();
        });

        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            togglePicker();
        });

        wrap.appendChild(button);
        triggerButton = button;
        return wrap;
    }

    function ensureTrigger() {
        ensureScheduled = false;
        const textarea = findTextarea();
        if (!textarea) return;

        const inputWrapper = findInputWrapper(textarea);
        const row = inputWrapper && inputWrapper.parentElement;
        if (!inputWrapper || !row) return;

        row.style.setProperty('column-gap', '0px', 'important');
        hideNativeActionSlots(row);

        const oldWrap = document.getElementById(TRIGGER_WRAP_ID);
        activeTextarea = textarea;

        if (oldWrap && oldWrap.parentElement === row && oldWrap.nextElementSibling === inputWrapper) {
            triggerButton = oldWrap.querySelector('.tm-sc-emoji-trigger');
            return;
        }

        if (oldWrap) oldWrap.remove();
        const wrap = createTrigger();
        row.insertBefore(wrap, inputWrapper);

        if (!picker) createPicker();
    }

    function scheduleEnsureTrigger() {
        if (ensureScheduled) return;
        ensureScheduled = true;
        requestAnimationFrame(ensureDomFeatures);
    }

    function nodeContainsComposerFeature(node, includeDescendants = true) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
        return (
            node.matches?.(TEXTAREA_SELECTOR)
            || node.id === TRIGGER_WRAP_ID
            || node.matches?.(NATIVE_ACTION_SELECTOR)
            || (includeDescendants && Boolean(node.querySelector?.(
                `${TEXTAREA_SELECTOR}, #${TRIGGER_WRAP_ID}, ${NATIVE_ACTION_SELECTOR}`,
            )))
        );
    }

    function handleRootMutations(records) {
        if (!records.length) {
            scheduleEnsureTrigger();
            return;
        }

        const activeComposerChanged = Boolean(activeTextarea && !activeTextarea.isConnected);
        const relevant = activeComposerChanged || records.some((record) => (
            nodeContainsComposerFeature(record.target, false)
            || Array.from(record.addedNodes).some((node) => nodeContainsComposerFeature(node, true))
            || Array.from(record.removedNodes).some((node) => nodeContainsComposerFeature(node, true))
        ));
        if (relevant) scheduleEnsureTrigger();
    }

    function createPicker() {
        picker = document.createElement('section');
        picker.id = PICKER_ID;
        picker.hidden = true;
        picker.setAttribute('role', 'dialog');
        picker.setAttribute('aria-label', 'Выбор эмодзи');

        const header = document.createElement('div');
        header.className = 'tm-sc-emoji-header';

        categoryTitle = document.createElement('div');
        categoryTitle.className = 'tm-sc-emoji-title';

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'tm-sc-emoji-close';
        closeButton.setAttribute('aria-label', 'Закрыть');
        closeButton.title = 'Закрыть';
        closeButton.textContent = '×';
        closeButton.addEventListener('click', closePicker);

        header.append(categoryTitle, closeButton);

        categoryTabs = document.createElement('nav');
        categoryTabs.className = 'tm-sc-emoji-tabs';
        categoryTabs.setAttribute('aria-label', 'Категории эмодзи');

        for (const category of CATEGORIES) {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'tm-sc-emoji-tab';
            tab.dataset.category = category.id;
            tab.textContent = category.icon;
            tab.title = category.label;
            tab.setAttribute('aria-label', category.label);
            tab.addEventListener('mousedown', (event) => event.preventDefault());
            tab.addEventListener('click', () => setCategory(category.id));
            categoryTabs.appendChild(tab);
        }

        emojiGrid = document.createElement('div');
        emojiGrid.className = 'tm-sc-emoji-grid';
        emojiGrid.addEventListener('mousedown', (event) => {
            if (event.target.closest('.tm-sc-emoji-item')) event.preventDefault();
        });
        emojiGrid.addEventListener('click', (event) => {
            const item = event.target.closest('.tm-sc-emoji-item');
            if (!item) return;
            const emoji = item.dataset.emoji;
            if (!emoji) return;
            insertEmoji(emoji);
            rememberEmoji(emoji);
        });

        picker.append(header, categoryTabs, emojiGrid);
        document.body.appendChild(picker);
    }

    function getFrequentEmojis() {
        const recentIndex = new Map(state.recent.map((emoji, index) => [emoji, index]));
        const frequent = Object.entries(state.usage)
            .filter(([emoji, count]) => typeof emoji === 'string' && Number.isFinite(Number(count)))
            .sort((left, right) => {
                const countDifference = Number(right[1]) - Number(left[1]);
                if (countDifference) return countDifference;
                return (recentIndex.get(left[0]) ?? 9999) - (recentIndex.get(right[0]) ?? 9999);
            })
            .map(([emoji]) => emoji)
            .slice(0, MAX_RECENT);

        if (frequent.length >= 24) return frequent;
        const seen = new Set(frequent);
        for (const emoji of DEFAULT_RECENT) {
            if (!seen.has(emoji)) {
                frequent.push(emoji);
                seen.add(emoji);
            }
            if (frequent.length >= MAX_RECENT) break;
        }
        return frequent;
    }

    function getActiveEmojis() {
        if (activeCategory === 'recent') {
            return state.recent.length ? state.recent : DEFAULT_RECENT;
        }
        if (activeCategory === 'frequent') return getFrequentEmojis();
        return EMOJIS[activeCategory] || [];
    }

    function setCategory(categoryId) {
        if (!validCategoryIds.has(categoryId)) return;
        activeCategory = categoryId;
        state.lastCategory = categoryId;
        saveState();
        renderPicker();
    }

    function renderPicker() {
        if (!picker || !emojiGrid || !categoryTabs) return;

        const category = CATEGORIES.find((item) => item.id === activeCategory) || CATEGORIES[0];
        categoryTitle.textContent = category.label;

        for (const tab of categoryTabs.querySelectorAll('.tm-sc-emoji-tab')) {
            const selected = tab.dataset.category === activeCategory;
            tab.classList.toggle('is-active', selected);
            tab.setAttribute('aria-current', selected ? 'true' : 'false');
        }

        const emojis = getActiveEmojis();
        const fragment = document.createDocumentFragment();
        for (const emoji of emojis) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'tm-sc-emoji-item';
            button.dataset.emoji = emoji;
            button.textContent = emoji;
            button.setAttribute('aria-label', emoji);
            fragment.appendChild(button);
        }

        emojiGrid.replaceChildren(fragment);
        emojiGrid.scrollTop = 0;

        if (!emojis.length) {
            const empty = document.createElement('div');
            empty.className = 'tm-sc-emoji-empty';
            empty.textContent = 'Здесь пока пусто. Выбери несколько эмодзи в других категориях.';
            emojiGrid.appendChild(empty);
        }
    }

    function positionPicker() {
        if (!picker || picker.hidden || !triggerButton || !triggerButton.isConnected) return;

        const margin = 10;
        const gap = 10;
        const triggerRect = triggerButton.getBoundingClientRect();
        const pickerRect = picker.getBoundingClientRect();

        let left = triggerRect.left;
        let top = triggerRect.top - pickerRect.height - gap;

        left = Math.max(margin, Math.min(left, window.innerWidth - pickerRect.width - margin));
        if (top < margin) top = triggerRect.bottom + gap;
        top = Math.max(margin, Math.min(top, window.innerHeight - pickerRect.height - margin));

        picker.style.left = `${Math.round(left)}px`;
        picker.style.top = `${Math.round(top)}px`;
    }

    function openPicker() {
        if (!picker) createPicker();
        renderPicker();
        picker.hidden = false;
        if (triggerButton) triggerButton.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(positionPicker);
    }

    function closePicker() {
        if (!picker || picker.hidden) return;
        picker.hidden = true;
        if (triggerButton) triggerButton.setAttribute('aria-expanded', 'false');
    }

    function togglePicker() {
        if (!picker || picker.hidden) openPicker();
        else closePicker();
    }

    function setNativeTextareaValue(textarea, value) {
        const prototype = Object.getPrototypeOf(textarea);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        if (descriptor && descriptor.set) descriptor.set.call(textarea, value);
        else textarea.value = value;
    }

    function insertEmoji(emoji) {
        const textarea = isVisible(activeTextarea) ? activeTextarea : findTextarea();
        if (!textarea) return;

        const start = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : textarea.value.length;
        const end = typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : start;
        const maxLength = textarea.maxLength > 0 ? textarea.maxLength : Infinity;
        const nextValue = textarea.value.slice(0, start) + emoji + textarea.value.slice(end);
        if (nextValue.length > maxLength) return;

        textarea.focus({ preventScroll: true });
        textarea.setSelectionRange(start, end);

        let insertedWithCommand = false;
        try {
            insertedWithCommand = document.execCommand('insertText', false, emoji);
        } catch (_error) {
            insertedWithCommand = false;
        }

        const nextCursorPosition = start + emoji.length;
        if (!insertedWithCommand || textarea.value !== nextValue) {
            setNativeTextareaValue(textarea, nextValue);
            const inputEvent = typeof InputEvent === 'function'
                ? new InputEvent('input', { bubbles: true, inputType: 'insertText', data: emoji })
                : new Event('input', { bubbles: true });
            textarea.dispatchEvent(inputEvent);
        }

        requestAnimationFrame(() => {
            if (!textarea.isConnected) return;
            textarea.focus({ preventScroll: true });
            textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
        });
    }

    function rememberEmoji(emoji) {
        state.recent = [emoji, ...state.recent.filter((item) => item !== emoji)].slice(0, MAX_RECENT);
        state.usage[emoji] = (Number(state.usage[emoji]) || 0) + 1;

        const usageEntries = Object.entries(state.usage);
        if (usageEntries.length > MAX_USAGE_ENTRIES) {
            usageEntries
                .sort((left, right) => Number(right[1]) - Number(left[1]))
                .slice(MAX_USAGE_ENTRIES)
                .forEach(([oldEmoji]) => delete state.usage[oldEmoji]);
        }

        saveState();
    }

    document.addEventListener('pointerdown', (event) => {
        if (!picker || picker.hidden) return;
        if (picker.contains(event.target) || (triggerButton && triggerButton.contains(event.target))) return;
        closePicker();
    }, true);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closePicker();
    });

    window.addEventListener('resize', positionPicker, { passive: true });
    window.addEventListener('scroll', (event) => {
        if (picker && !picker.hidden && !picker.contains(event.target)) positionPicker();
    }, { passive: true, capture: true });

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
            ensureTrigger();

            if (!rootObserver) {
                rootObserver = new MutationObserver(handleRootMutations);
                rootObserver.observe(document.documentElement, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['aria-label'],
                });
            }
            resetRetry();
        } catch (error) {
            rootObserver?.disconnect();
            rootObserver = null;
            console.error('[Emoji Picker] Инициализация сорвалась, повторю автоматически.', error);
            scheduleRetry();
        }
    }

    ensureDomFeatures();

    window.addEventListener('pageshow', ensureDomFeatures);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) ensureDomFeatures();
    });
}


// ---- src/modules/buttons.js ----

// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
function init_buttons(runtime) {
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


// ---- src/modules/saved-texts.js ----

// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
function init_saved_texts(runtime) {
    'use strict';

    const INSTANCE_KEY = '__spicyChatSavedTextsV1';
    if (window[INSTANCE_KEY]) return;
    window[INSTANCE_KEY] = true;

    const TEXTAREA_SELECTOR = 'textarea[placeholder="Message..."]';
    const EMOJI_WRAP_SELECTOR = '#tm-sc-emoji-trigger-wrap';
    const TOOLBAR_ID = 'tm-sc-saved-texts-toolbar';
    const POPUP_ID = 'tm-sc-saved-texts-popup';
    const STYLE_ID = 'tm-sc-saved-texts-style';
    const STORAGE_PREFIX = 'tm-sc-saved-texts-v1:bot:';
    const DELETE_CONFIRM_MS = 2600;
    const MESSAGE_DROPDOWN_SELECTOR = 'button[aria-label="message-dropdown" i]';
    const MESSAGE_TEXT_CLASS_TOKEN = '[overflow-wrap:anywhere]';
    const MESSAGE_SAVE_ITEM_CLASS = 'tm-sc-save-history-message';

    let toolbar = null;
    let openButton = null;
    let saveButton = null;
    let popup = null;
    let searchInput = null;
    let listElement = null;
    let countElement = null;
    let currentBotId = null;
    let loadedBotId = null;
    let entries = [];
    let savedSelection = null;
    let confirmDeleteId = null;
    let confirmDeleteTimer = null;
    let ensureScheduled = false;
    let loadSequence = 0;
    let storageQueue = Promise.resolve();
    let rootObserver = null;
    let retryTimer = null;
    let retryDelay = 250;
    let activeTextarea = null;
    const toolbarFlashTimers = new WeakMap();

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const css = `
            #${TOOLBAR_ID} {
                display: flex !important;
                flex: 0 0 auto !important;
                align-items: flex-end !important;
                align-self: flex-end !important;
                gap: 0 !important;
                margin-bottom: 4px !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button {
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

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button:hover,
            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[aria-expanded="true"] {
                color: #ffffff !important;
                background: rgba(255, 255, 255, 0.11) !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button:active {
                transform: scale(0.94) !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button:focus-visible {
                outline: 2px solid #1687f8 !important;
                outline-offset: 2px !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]::before,
            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]::after {
                position: absolute !important;
                left: 50% !important;
                z-index: 2147483647 !important;
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
                transition: opacity 120ms ease, transform 120ms ease, visibility 0s linear 120ms !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]::before {
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

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]::after {
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
                #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]:hover::before,
                #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]:hover::after {
                    opacity: 1 !important;
                    visibility: visible !important;
                    transition-delay: 320ms !important;
                }

                #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]:hover::before {
                    transform: translate(-50%, 0) !important;
                }

                #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]:hover::after {
                    transform: translate(-50%, 0) rotate(45deg) !important;
                }
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]:focus-visible::before,
            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]:focus-visible::after {
                opacity: 1 !important;
                visibility: visible !important;
                transition-delay: 0ms !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]:focus-visible::before {
                transform: translate(-50%, 0) !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button[data-tm-tooltip]:focus-visible::after {
                transform: translate(-50%, 0) rotate(45deg) !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button.is-success {
                color: #72e49a !important;
                background: rgba(46, 190, 99, 0.16) !important;
            }

            #${TOOLBAR_ID} .tm-sc-saved-toolbar-button.is-error {
                color: #ff7777 !important;
                background: rgba(255, 70, 70, 0.14) !important;
            }

            #${POPUP_ID} {
                position: fixed !important;
                z-index: 2147483646 !important;
                box-sizing: border-box !important;
                width: min(440px, calc(100vw - 20px)) !important;
                height: min(540px, calc(100vh - 92px)) !important;
                min-height: 300px !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
                color: #f5f5f5 !important;
                color-scheme: dark !important;
                background: #1b1b1d !important;
                border: 1px solid rgba(255, 255, 255, 0.13) !important;
                border-radius: 16px !important;
                box-shadow: 0 18px 55px rgba(0, 0, 0, 0.58), 0 4px 14px rgba(0, 0, 0, 0.34) !important;
                font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
                user-select: none !important;
            }

            #${POPUP_ID}[hidden] {
                display: none !important;
            }

            #${POPUP_ID} .tm-sc-saved-header {
                box-sizing: border-box !important;
                min-height: 52px !important;
                padding: 0 12px 0 16px !important;
                display: flex !important;
                flex: 0 0 auto !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 10px !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.09) !important;
            }

            #${POPUP_ID} .tm-sc-saved-title-wrap {
                min-width: 0 !important;
                display: flex !important;
                align-items: baseline !important;
                gap: 8px !important;
            }

            #${POPUP_ID} .tm-sc-saved-title {
                overflow: hidden !important;
                color: #f5f5f5 !important;
                font-size: 14px !important;
                font-weight: 650 !important;
                line-height: 1.2 !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }

            #${POPUP_ID} .tm-sc-saved-count {
                color: rgba(255, 255, 255, 0.48) !important;
                font-size: 12px !important;
            }

            #${POPUP_ID} .tm-sc-saved-close {
                appearance: none !important;
                width: 32px !important;
                height: 32px !important;
                min-width: 32px !important;
                padding: 0 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: rgba(255, 255, 255, 0.7) !important;
                background: transparent !important;
                border: 0 !important;
                border-radius: 9px !important;
                cursor: pointer !important;
                font: 25px/1 ui-sans-serif, system-ui, sans-serif !important;
            }

            #${POPUP_ID} .tm-sc-saved-close:hover {
                color: #fff !important;
                background: rgba(255, 255, 255, 0.1) !important;
            }

            #${POPUP_ID} .tm-sc-saved-search-wrap {
                box-sizing: border-box !important;
                padding: 10px 12px !important;
                display: flex !important;
                flex: 0 0 auto !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.07) !important;
            }

            #${POPUP_ID} .tm-sc-saved-search {
                appearance: none !important;
                box-sizing: border-box !important;
                width: 100% !important;
                height: 38px !important;
                padding: 0 12px !important;
                color: #f4f4f5 !important;
                background: rgba(255, 255, 255, 0.07) !important;
                border: 1px solid rgba(255, 255, 255, 0.11) !important;
                border-radius: 10px !important;
                outline: 0 !important;
                font: 13px/1.2 Inter, ui-sans-serif, system-ui, sans-serif !important;
                user-select: text !important;
            }

            #${POPUP_ID} .tm-sc-saved-search::placeholder {
                color: rgba(255, 255, 255, 0.42) !important;
            }

            #${POPUP_ID} .tm-sc-saved-search:focus {
                border-color: rgba(39, 143, 255, 0.8) !important;
                box-shadow: 0 0 0 2px rgba(22, 135, 248, 0.15) !important;
            }

            #${POPUP_ID} .tm-sc-saved-list {
                box-sizing: border-box !important;
                padding: 10px !important;
                display: flex !important;
                flex: 1 1 auto !important;
                flex-direction: column !important;
                gap: 8px !important;
                overflow-x: hidden !important;
                overflow-y: auto !important;
                overscroll-behavior: contain !important;
                scrollbar-color: rgba(255, 255, 255, 0.24) transparent !important;
                scrollbar-width: thin !important;
            }

            #${POPUP_ID} .tm-sc-saved-card {
                box-sizing: border-box !important;
                padding: 11px 11px 9px !important;
                display: flex !important;
                flex: 0 0 auto !important;
                flex-direction: column !important;
                gap: 9px !important;
                background: rgba(255, 255, 255, 0.055) !important;
                border: 1px solid rgba(255, 255, 255, 0.09) !important;
                border-radius: 12px !important;
                transition: border-color 100ms ease, background-color 100ms ease !important;
            }

            #${POPUP_ID} .tm-sc-saved-card:hover {
                background: rgba(255, 255, 255, 0.075) !important;
                border-color: rgba(255, 255, 255, 0.14) !important;
            }

            #${POPUP_ID} .tm-sc-saved-card.is-pinned {
                border-color: rgba(39, 143, 255, 0.36) !important;
                box-shadow: inset 3px 0 0 rgba(39, 143, 255, 0.72) !important;
            }

            #${POPUP_ID} .tm-sc-saved-preview {
                appearance: none !important;
                box-sizing: border-box !important;
                width: 100% !important;
                min-width: 0 !important;
                padding: 0 !important;
                display: -webkit-box !important;
                overflow: hidden !important;
                color: rgba(255, 255, 255, 0.91) !important;
                background: transparent !important;
                border: 0 !important;
                cursor: pointer !important;
                font: 13px/1.45 Inter, ui-sans-serif, system-ui, sans-serif !important;
                text-align: left !important;
                overflow-wrap: anywhere !important;
                white-space: pre-wrap !important;
                -webkit-box-orient: vertical !important;
                -webkit-line-clamp: 5 !important;
                user-select: text !important;
            }

            #${POPUP_ID} .tm-sc-saved-card.is-expanded .tm-sc-saved-preview {
                display: block !important;
                overflow: visible !important;
                -webkit-line-clamp: unset !important;
            }

            #${POPUP_ID} .tm-sc-saved-actions {
                display: flex !important;
                align-items: center !important;
                justify-content: flex-end !important;
                gap: 6px !important;
            }

            #${POPUP_ID} .tm-sc-saved-action {
                appearance: none !important;
                box-sizing: border-box !important;
                min-width: 32px !important;
                height: 30px !important;
                padding: 0 8px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 5px !important;
                color: rgba(255, 255, 255, 0.72) !important;
                background: transparent !important;
                border: 0 !important;
                border-radius: 8px !important;
                cursor: pointer !important;
                font: 12px/1 Inter, ui-sans-serif, system-ui, sans-serif !important;
                transition: color 100ms ease, background-color 100ms ease !important;
            }

            #${POPUP_ID} .tm-sc-saved-action:hover {
                color: #ffffff !important;
                background: rgba(255, 255, 255, 0.1) !important;
            }

            #${POPUP_ID} .tm-sc-saved-action.is-primary {
                color: #a9d4ff !important;
                background: rgba(22, 135, 248, 0.14) !important;
            }

            #${POPUP_ID} .tm-sc-saved-action.is-primary:hover {
                color: #ffffff !important;
                background: rgba(22, 135, 248, 0.28) !important;
            }

            #${POPUP_ID} .tm-sc-saved-action.is-active {
                color: #6eb8ff !important;
                background: rgba(22, 135, 248, 0.16) !important;
            }

            #${POPUP_ID} .tm-sc-saved-action.is-danger:hover,
            #${POPUP_ID} .tm-sc-saved-action.is-confirming {
                color: #ff8c8c !important;
                background: rgba(255, 70, 70, 0.14) !important;
            }

            #${POPUP_ID} .tm-sc-saved-empty,
            #${POPUP_ID} .tm-sc-saved-loading {
                box-sizing: border-box !important;
                min-height: 150px !important;
                padding: 46px 20px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: rgba(255, 255, 255, 0.5) !important;
                font-size: 13px !important;
                line-height: 1.45 !important;
                text-align: center !important;
            }

            #${POPUP_ID} svg,
            #${TOOLBAR_ID} svg {
                pointer-events: none !important;
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

    function findTextarea() {
        const candidates = Array.from(document.querySelectorAll(TEXTAREA_SELECTOR)).filter(isVisible);
        return candidates.length ? candidates[candidates.length - 1] : null;
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

    function getBotId() {
        const parts = location.pathname.split('/').filter(Boolean);
        if (parts[0] !== 'chat' || !parts[1]) return null;
        return parts[1];
    }

    function getStorageKey(botId) {
        return `${STORAGE_PREFIX}${botId}`;
    }

    async function readValue(key, fallbackValue) {
        try {
            if (typeof GM_getValue === 'function') {
                const value = await Promise.resolve(GM_getValue(key, fallbackValue));
                return value === undefined ? fallbackValue : value;
            }
        } catch (error) {
            console.warn('[Saved Texts] Не удалось прочитать данные Tampermonkey.', error);
        }

        try {
            const raw = localStorage.getItem(key);
            return raw === null ? fallbackValue : JSON.parse(raw);
        } catch (_error) {
            return fallbackValue;
        }
    }

    async function writeValue(key, value) {
        if (typeof GM_setValue === 'function') {
            await Promise.resolve(GM_setValue(key, value));
            return;
        }
        localStorage.setItem(key, JSON.stringify(value));
    }

    function normalizeEntries(value) {
        if (!Array.isArray(value)) return [];
        const now = Date.now();
        return value
            .filter((entry) => entry && typeof entry === 'object' && typeof entry.text === 'string')
            .map((entry, index) => ({
                id: typeof entry.id === 'string' && entry.id
                    ? entry.id
                    : `legacy-${now}-${index}`,
                text: entry.text,
                pinned: Boolean(entry.pinned),
                createdAt: Number.isFinite(Number(entry.createdAt)) ? Number(entry.createdAt) : now - index,
                pinnedAt: Number.isFinite(Number(entry.pinnedAt)) ? Number(entry.pinnedAt) : 0,
            }));
    }

    async function readEntries(botId) {
        return normalizeEntries(await readValue(getStorageKey(botId), []));
    }

    function updateEntries(botId, updater) {
        const operation = storageQueue.then(async () => {
            const latest = await readEntries(botId);
            const next = normalizeEntries(updater(latest));
            await writeValue(getStorageKey(botId), next);
            return next;
        });
        storageQueue = operation.catch(() => undefined);
        return operation;
    }

    function makeId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function flashToolbarButton(button, stateClass, duration = 800) {
        if (!button || !button.isConnected) return;

        const previousTimer = toolbarFlashTimers.get(button);
        if (previousTimer) window.clearTimeout(previousTimer);

        const defaultTooltip = button.dataset.tmTooltipDefault || button.dataset.tmTooltip || '';
        button.dataset.tmTooltip = stateClass === 'is-success' ? 'Сохранено' : defaultTooltip;
        button.classList.remove('is-success', 'is-error');
        button.classList.add(stateClass);

        const timer = window.setTimeout(() => {
            if (button.isConnected) {
                button.classList.remove(stateClass);
                button.dataset.tmTooltip = defaultTooltip;
            }
            toolbarFlashTimers.delete(button);
        }, duration);
        toolbarFlashTimers.set(button, timer);
    }

    function findMessageTextContainer(controls) {
        const message = controls.closest('[id^="message-"]');
        return message && Array.from(message.querySelectorAll('[class]')).find(element =>
            element.classList.contains(MESSAGE_TEXT_CLASS_TOKEN)) || null;
    }

    function serializeFormattedNode(node) {
        if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const element = node;
        const tag = element.tagName;

        if (tag === 'BR') return '\n';
        if (tag === 'IMG') return element.getAttribute('alt') || '';
        if (tag === 'PRE') {
            const code = (element.textContent || '').replace(/^\n+|\n+$/g, '');
            return `\`\`\`\n${code}\n\`\`\``;
        }

        const inner = Array.from(element.childNodes).map(serializeFormattedNode).join('');
        if (!inner) return '';

        if (tag === 'EM' || tag === 'I') return `*${inner}*`;
        if (tag === 'STRONG' || tag === 'B') return `**${inner}**`;
        if (tag === 'DEL' || tag === 'S') return `~~${inner}~~`;
        if (tag === 'CODE') return `\`${inner.replace(/`/g, '\\`')}\``;
        if (tag === 'BLOCKQUOTE') {
            return inner.split('\n').map((line) => `> ${line}`).join('\n');
        }
        if (tag === 'LI') return `- ${inner}\n`;
        if (tag === 'A') {
            const href = element.getAttribute('href');
            if (href && inner.trim() && href !== inner.trim()) return `[${inner}](${href})`;
        }

        return inner;
    }

    function normalizeMessageText(text) {
        return text
            .replace(/\u00a0/g, ' ')
            .replace(/\r\n?/g, '\n')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n[ \t]+/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function extractMessageText(controls) {
        const container = findMessageTextContainer(controls);
        if (!container) return '';

        const blocks = Array.from(container.children)
            .map((child) => normalizeMessageText(serializeFormattedNode(child)))
            .filter(Boolean);

        if (blocks.length) return blocks.join('\n\n');
        return normalizeMessageText(serializeFormattedNode(container));
    }

    const messageMenuIcons = {
        idle: `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round">
                 <path d="M6 3h12a2 2 0 0 1 2 2v16l-8-5-8 5V5a2 2 0 0 1 2-2z"></path>
                 <path d="M12 7v6"></path><path d="M9 10h6"></path>
               </svg>`,
        saving: `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round">
                   <path d="M12 2v4"></path><path d="m16.2 7.8 2.9-2.9"></path>
                   <path d="M18 12h4"></path><path d="m16.2 16.2 2.9 2.9"></path>
                   <path d="M12 18v4"></path><path d="m4.9 19.1 2.9-2.9"></path>
                   <path d="M2 12h4"></path><path d="m4.9 4.9 2.9 2.9"></path>
                 </svg>`,
        success: `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                       viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round">
                    <path d="m5 12 4 4L19 6"></path>
                  </svg>`,
        error: `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                     viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="9"></circle>
                  <path d="m9 9 6 6"></path><path d="m15 9-6 6"></path>
                </svg>`,
    };

    function setMessageMenuButtonState(button, state) {
        const stateData = {
            idle: { label: 'Сохранить', aria: 'Сохранить сообщение' },
            saving: { label: 'Сохраняю…', aria: 'Сохранение сообщения' },
            success: { label: 'Сохранено', aria: 'Сообщение сохранено' },
            error: { label: 'Не удалось сохранить', aria: 'Не удалось сохранить сообщение' },
        }[state];

        button.setAttribute('aria-label', stateData.aria);
        const oldIcon = button.querySelector('svg');
        if (oldIcon) oldIcon.outerHTML = messageMenuIcons[state];
        else button.insertAdjacentHTML('afterbegin', messageMenuIcons[state]);

        const label = button.querySelector('p') || button.querySelector('span');
        if (label) label.textContent = stateData.label;
        else { const span = document.createElement('span'); span.textContent = stateData.label; button.append(span); }
    }

    async function storeSavedText(botId, text) {
        const entry = {
            id: makeId(),
            text,
            pinned: false,
            createdAt: Date.now(),
            pinnedAt: 0,
        };

        const updated = await updateEntries(botId, (latest) => [...latest, entry]);
        if (getBotId() === botId) {
            entries = updated;
            loadedBotId = botId;
            if (popup && !popup.hidden) renderEntries();
        }
        return entry;
    }

    async function saveHistoryMessage(button, controls) {
        if (button.dataset.tmSaving === 'true') return;

        const botId = getBotId();
        const text = extractMessageText(controls);
        if (!botId || !text) {
            setMessageMenuButtonState(button, 'error');
            window.setTimeout(() => {
                if (button.isConnected) setMessageMenuButtonState(button, 'idle');
            }, 1200);
            return;
        }

        button.dataset.tmSaving = 'true';
        button.disabled = true;
        setMessageMenuButtonState(button, 'saving');

        try {
            await storeSavedText(botId, text);
            setMessageMenuButtonState(button, 'success');
            flashToolbarButton(saveButton, 'is-success');

            window.setTimeout(() => {
                if (!button.isConnected) return;
                const dropdownButton = controls.querySelector(MESSAGE_DROPDOWN_SELECTOR);
                dropdownButton?.click();
            }, 650);
        } catch (error) {
            console.error('[Saved Texts] Не удалось сохранить сообщение из истории.', error);
            button.dataset.tmSaving = 'false';
            button.disabled = false;
            setMessageMenuButtonState(button, 'error');
            window.setTimeout(() => {
                if (button.isConnected) setMessageMenuButtonState(button, 'idle');
            }, 1200);
        }
    }

    function ensureMessageSaveMenuItems() {
        for (const context of runtime.dom?.messageMenus() || []) {
            if (context.menu.querySelector(`.${MESSAGE_SAVE_ITEM_CLASS}`)) continue;
            const template = runtime.dom.findAction(context.menu, 'edit') || context.template;
            const button = runtime.dom.cloneMenuButton(template);
            button.classList.add(MESSAGE_SAVE_ITEM_CLASS);
            setMessageMenuButtonState(button, 'idle');
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                const message = runtime.dom.messageFor(button);
                const controls = message?.querySelector(MESSAGE_DROPDOWN_SELECTOR)?.parentElement;
                if (controls) void saveHistoryMessage(button, controls);
            });
            context.menu.appendChild(button);
        }
    }

    function createToolbar() {
        const container = document.createElement('div');
        container.id = TOOLBAR_ID;

        const libraryButton = document.createElement('button');
        libraryButton.type = 'button';
        libraryButton.className = 'tm-sc-saved-toolbar-button tm-sc-open-saved-texts';
        libraryButton.setAttribute('aria-label', 'Открыть сохранённые тексты');
        libraryButton.setAttribute('aria-haspopup', 'dialog');
        libraryButton.setAttribute('aria-expanded', 'false');
        libraryButton.dataset.tmTooltip = 'Сохранённые тексты';
        libraryButton.dataset.tmTooltipDefault = 'Сохранённые тексты';
        libraryButton.innerHTML = `
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <rect width="14" height="15" x="5" y="6" rx="2"></rect>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                <path d="M9 11h6"></path>
                <path d="M9 15h6"></path>
            </svg>
        `;
        libraryButton.addEventListener('mousedown', (event) => event.preventDefault());
        libraryButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            togglePopup();
        });

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'tm-sc-saved-toolbar-button tm-sc-save-current-text';
        addButton.setAttribute('aria-label', 'Сохранить текущий текст');
        addButton.dataset.tmTooltip = 'Сохранить текущий текст';
        addButton.dataset.tmTooltipDefault = 'Сохранить текущий текст';
        addButton.innerHTML = `
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 3h12a2 2 0 0 1 2 2v16l-8-5-8 5V5a2 2 0 0 1 2-2z"></path>
                <path d="M12 7v6"></path>
                <path d="M9 10h6"></path>
            </svg>
        `;
        addButton.addEventListener('mousedown', (event) => event.preventDefault());
        addButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            void saveCurrentText();
        });

        container.append(libraryButton, addButton);
        toolbar = container;
        openButton = libraryButton;
        saveButton = addButton;
        return container;
    }

    function ensureToolbar() {
        ensureScheduled = false;
        ensureMessageSaveMenuItems();

        const botId = getBotId();
        if (botId !== currentBotId) {
            currentBotId = botId;
            loadedBotId = null;
            entries = [];
            closePopup();
        }

        const textarea = findTextarea();
        const inputWrapper = textarea && findInputWrapper(textarea);
        const row = inputWrapper && inputWrapper.parentElement;
        const oldToolbar = document.getElementById(TOOLBAR_ID);

        if (!botId || !textarea || !inputWrapper || !row) {
            activeTextarea = null;
            if (oldToolbar) oldToolbar.remove();
            toolbar = null;
            openButton = null;
            saveButton = null;
            return;
        }

        activeTextarea = textarea;
        row.style.setProperty('column-gap', '0px', 'important');

        let activeToolbar = oldToolbar;
        if (!activeToolbar || activeToolbar.parentElement !== row) {
            if (activeToolbar) activeToolbar.remove();
            activeToolbar = createToolbar();
        } else {
            toolbar = activeToolbar;
            openButton = activeToolbar.querySelector('.tm-sc-open-saved-texts');
            saveButton = activeToolbar.querySelector('.tm-sc-save-current-text');
        }

        // Держим пару кнопок непосредственно перед эмодзи. Если эмодзи-пикера нет — перед полем.
        const emojiWrap = row.querySelector(EMOJI_WRAP_SELECTOR);
        const anchor = emojiWrap || inputWrapper;
        if (activeToolbar.parentElement !== row || activeToolbar.nextElementSibling !== anchor) {
            row.insertBefore(activeToolbar, anchor);
        }

        if (!popup) createPopup();
    }

    function scheduleEnsureToolbar() {
        if (ensureScheduled) return;
        ensureScheduled = true;
        requestAnimationFrame(ensureDomFeatures);
    }

    function nodeContainsSavedTextsFeature(node, includeDescendants = true) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
        const selector = [
            TEXTAREA_SELECTOR,
            'button[aria-label="Copy" i], [role="menu"]',
            `#${TOOLBAR_ID}`,
            EMOJI_WRAP_SELECTOR,
        ].join(', ');
        return node.matches?.(selector) || (includeDescendants && Boolean(node.querySelector?.(selector)));
    }

    function handleRootMutations(records) {
        const relevant = Boolean(activeTextarea && !activeTextarea.isConnected) || records.some((record) => (
            nodeContainsSavedTextsFeature(record.target, false)
            || Array.from(record.addedNodes).some((node) => nodeContainsSavedTextsFeature(node, true))
            || Array.from(record.removedNodes).some((node) => nodeContainsSavedTextsFeature(node, true))
        ));
        if (relevant) scheduleEnsureToolbar();
    }

    function createPopup() {
        popup = document.createElement('section');
        popup.id = POPUP_ID;
        popup.hidden = true;
        popup.setAttribute('role', 'dialog');
        popup.setAttribute('aria-label', 'Сохранённые тексты');

        const header = document.createElement('div');
        header.className = 'tm-sc-saved-header';

        const titleWrap = document.createElement('div');
        titleWrap.className = 'tm-sc-saved-title-wrap';

        const title = document.createElement('div');
        title.className = 'tm-sc-saved-title';
        title.textContent = 'Сохранённые тексты';

        countElement = document.createElement('span');
        countElement.className = 'tm-sc-saved-count';
        countElement.textContent = '0';

        titleWrap.append(title, countElement);

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'tm-sc-saved-close';
        closeButton.setAttribute('aria-label', 'Закрыть');
        closeButton.title = 'Закрыть';
        closeButton.textContent = '×';
        closeButton.addEventListener('click', closePopup);

        header.append(titleWrap, closeButton);

        const searchWrap = document.createElement('div');
        searchWrap.className = 'tm-sc-saved-search-wrap';

        searchInput = document.createElement('input');
        searchInput.type = 'search';
        searchInput.className = 'tm-sc-saved-search';
        searchInput.placeholder = 'Поиск по сохранённым текстам…';
        searchInput.autocomplete = 'off';
        searchInput.spellcheck = false;
        searchInput.addEventListener('input', renderEntries);
        searchWrap.appendChild(searchInput);

        listElement = document.createElement('div');
        listElement.className = 'tm-sc-saved-list';

        popup.append(header, searchWrap, listElement);
        document.body.appendChild(popup);
    }

    function sortEntries(items) {
        return items.slice().sort((left, right) => {
            if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
            if (left.pinned) {
                return (right.pinnedAt || right.createdAt) - (left.pinnedAt || left.createdAt);
            }
            return right.createdAt - left.createdAt;
        });
    }

    function iconButton(label, className, svg) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `tm-sc-saved-action ${className}`;
        button.setAttribute('aria-label', label);
        button.title = label;
        button.innerHTML = svg;
        button.addEventListener('mousedown', (event) => event.preventDefault());
        return button;
    }

    function renderEntries() {
        if (!listElement || !searchInput) return;
        countElement.textContent = String(entries.length);

        const query = searchInput.value.trim().toLocaleLowerCase();
        const visibleEntries = sortEntries(entries).filter((entry) => (
            !query || entry.text.toLocaleLowerCase().includes(query)
        ));

        const fragment = document.createDocumentFragment();
        for (const entry of visibleEntries) {
            const card = document.createElement('article');
            card.className = `tm-sc-saved-card${entry.pinned ? ' is-pinned' : ''}`;
            card.dataset.entryId = entry.id;

            const preview = document.createElement('button');
            preview.type = 'button';
            preview.className = 'tm-sc-saved-preview';
            preview.textContent = entry.text;
            preview.title = 'Развернуть или свернуть текст';
            preview.setAttribute('aria-expanded', 'false');
            preview.addEventListener('click', () => {
                const expanded = card.classList.toggle('is-expanded');
                preview.setAttribute('aria-expanded', String(expanded));
            });

            const actions = document.createElement('div');
            actions.className = 'tm-sc-saved-actions';

            const insertButton = iconButton(
                'Вставить',
                'is-primary',
                `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path>
                 </svg><span>Вставить</span>`,
            );
            insertButton.addEventListener('click', () => insertSavedText(entry.text));

            const pinButton = iconButton(
                entry.pinned ? 'Открепить' : 'Закрепить',
                entry.pinned ? 'is-active' : '',
                `<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 17v5"></path><path d="M5 17h14"></path>
                    <path d="m6 3 2 7-2 3h12l-2-3 2-7z"></path>
                 </svg>`,
            );
            pinButton.addEventListener('click', () => void togglePinned(entry.id));

            const confirming = confirmDeleteId === entry.id;
            const deleteButton = iconButton(
                confirming ? 'Подтвердить удаление' : 'Удалить',
                `is-danger${confirming ? ' is-confirming' : ''}`,
                confirming
                    ? '<span>Точно?</span>'
                    : `<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none"
                           stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                         <path d="M3 6h18"></path><path d="M8 6V4h8v2"></path>
                         <path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v5"></path><path d="M14 11v5"></path>
                       </svg>`,
            );
            deleteButton.addEventListener('click', () => void requestDelete(entry.id));

            actions.append(insertButton, pinButton, deleteButton);
            card.append(preview, actions);
            fragment.appendChild(card);
        }

        listElement.replaceChildren(fragment);

        if (!visibleEntries.length) {
            const empty = document.createElement('div');
            empty.className = 'tm-sc-saved-empty';
            empty.textContent = entries.length
                ? 'По этому запросу ничего не найдено.'
                : 'Здесь пока пусто. Сохрани текущий текст соседней кнопкой.';
            listElement.appendChild(empty);
        }
    }

    function showLoading() {
        if (!listElement) return;
        const loading = document.createElement('div');
        loading.className = 'tm-sc-saved-loading';
        loading.textContent = 'Загружаю сохранённые тексты…';
        listElement.replaceChildren(loading);
    }

    function rememberTextareaSelection(textarea) {
        savedSelection = {
            textarea,
            start: typeof textarea.selectionStart === 'number' ? textarea.selectionStart : textarea.value.length,
            end: typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : textarea.value.length,
        };
    }

    async function openPopup() {
        const textarea = findTextarea();
        const botId = getBotId();
        if (!textarea || !botId) return;

        rememberTextareaSelection(textarea);
        currentBotId = botId;
        searchInput.value = '';
        confirmDeleteId = null;
        popup.hidden = false;
        openButton?.setAttribute('aria-expanded', 'true');
        showLoading();
        requestAnimationFrame(() => {
            positionPopup();
            searchInput.focus({ preventScroll: true });
        });

        const sequence = ++loadSequence;
        try {
            const loaded = await readEntries(botId);
            if (sequence !== loadSequence || getBotId() !== botId || popup.hidden) return;
            entries = loaded;
            loadedBotId = botId;
            renderEntries();
        } catch (error) {
            console.error('[Saved Texts] Не удалось загрузить сохранённые тексты.', error);
            if (sequence === loadSequence && !popup.hidden) {
                listElement.textContent = 'Не удалось загрузить сохранённые тексты.';
            }
        }
    }

    function closePopup() {
        if (!popup || popup.hidden) return;
        popup.hidden = true;
        loadSequence += 1;
        openButton?.setAttribute('aria-expanded', 'false');
        confirmDeleteId = null;
        if (confirmDeleteTimer) window.clearTimeout(confirmDeleteTimer);
        confirmDeleteTimer = null;
    }

    function togglePopup() {
        if (!popup || popup.hidden) void openPopup();
        else closePopup();
    }

    function positionPopup() {
        if (!popup || popup.hidden || !openButton || !openButton.isConnected) return;

        const margin = 10;
        const gap = 10;
        const buttonRect = openButton.getBoundingClientRect();
        const popupRect = popup.getBoundingClientRect();

        let left = buttonRect.left;
        let top = buttonRect.top - popupRect.height - gap;
        left = Math.max(margin, Math.min(left, window.innerWidth - popupRect.width - margin));
        if (top < margin) top = buttonRect.bottom + gap;
        top = Math.max(margin, Math.min(top, window.innerHeight - popupRect.height - margin));

        popup.style.left = `${Math.round(left)}px`;
        popup.style.top = `${Math.round(top)}px`;
    }

    async function saveCurrentText() {
        const textarea = findTextarea();
        const botId = getBotId();
        const button = saveButton;

        if (!textarea || !botId || !textarea.value.trim()) {
            flashToolbarButton(button, 'is-error');
            return;
        }

        try {
            await storeSavedText(botId, textarea.value);
            flashToolbarButton(button, 'is-success');
        } catch (error) {
            console.error('[Saved Texts] Не удалось сохранить текст.', error);
            flashToolbarButton(button, 'is-error');
        }
    }

    async function togglePinned(entryId) {
        const botId = getBotId();
        if (!botId) return;

        try {
            const updated = await updateEntries(botId, (latest) => latest.map((entry) => {
                if (entry.id !== entryId) return entry;
                const pinned = !entry.pinned;
                return { ...entry, pinned, pinnedAt: pinned ? Date.now() : 0 };
            }));
            if (getBotId() === botId) {
                entries = updated;
                loadedBotId = botId;
                renderEntries();
            }
        } catch (error) {
            console.error('[Saved Texts] Не удалось изменить закрепление.', error);
        }
    }

    async function requestDelete(entryId) {
        if (confirmDeleteId !== entryId) {
            confirmDeleteId = entryId;
            if (confirmDeleteTimer) window.clearTimeout(confirmDeleteTimer);
            confirmDeleteTimer = window.setTimeout(() => {
                confirmDeleteId = null;
                confirmDeleteTimer = null;
                if (popup && !popup.hidden) renderEntries();
            }, DELETE_CONFIRM_MS);
            renderEntries();
            return;
        }

        const botId = getBotId();
        if (!botId) return;
        confirmDeleteId = null;
        if (confirmDeleteTimer) window.clearTimeout(confirmDeleteTimer);
        confirmDeleteTimer = null;

        try {
            const updated = await updateEntries(botId, (latest) => (
                latest.filter((entry) => entry.id !== entryId)
            ));
            if (getBotId() === botId) {
                entries = updated;
                loadedBotId = botId;
                renderEntries();
            }
        } catch (error) {
            console.error('[Saved Texts] Не удалось удалить текст.', error);
        }
    }

    function setNativeTextareaValue(textarea, value) {
        const prototype = Object.getPrototypeOf(textarea);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        if (descriptor && descriptor.set) descriptor.set.call(textarea, value);
        else textarea.value = value;
    }

    function insertSavedText(text) {
        const textarea = findTextarea();
        if (!textarea) return;

        const remembered = savedSelection && savedSelection.textarea === textarea
            ? savedSelection
            : null;
        const rawStart = remembered
            ? remembered.start
            : (typeof textarea.selectionStart === 'number' ? textarea.selectionStart : textarea.value.length);
        const rawEnd = remembered
            ? remembered.end
            : (typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : rawStart);
        const start = Math.max(0, Math.min(rawStart, textarea.value.length));
        const end = Math.max(start, Math.min(rawEnd, textarea.value.length));
        const nextValue = textarea.value.slice(0, start) + text + textarea.value.slice(end);
        const maxLength = textarea.maxLength > 0 ? textarea.maxLength : Infinity;

        if (nextValue.length > maxLength) {
            console.warn('[Saved Texts] Текст не помещается в ограничение поля ввода.');
            return;
        }

        textarea.focus({ preventScroll: true });
        textarea.setSelectionRange(start, end);

        let insertedWithCommand = false;
        try {
            insertedWithCommand = document.execCommand('insertText', false, text);
        } catch (_error) {
            insertedWithCommand = false;
        }

        const nextCursorPosition = start + text.length;
        if (!insertedWithCommand || textarea.value !== nextValue) {
            setNativeTextareaValue(textarea, nextValue);
            const inputEvent = typeof InputEvent === 'function'
                ? new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })
                : new Event('input', { bubbles: true });
            textarea.dispatchEvent(inputEvent);
        }

        closePopup();
        requestAnimationFrame(() => {
            if (!textarea.isConnected) return;
            textarea.focus({ preventScroll: true });
            textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
        });
    }

    document.addEventListener('pointerdown', (event) => {
        if (!popup || popup.hidden) return;
        if (popup.contains(event.target)) return;
        if (openButton && openButton.contains(event.target)) return;
        closePopup();
    }, true);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closePopup();
    });

    window.addEventListener('resize', positionPopup, { passive: true });
    window.addEventListener('scroll', (event) => {
        if (popup && !popup.hidden && !popup.contains(event.target)) positionPopup();
    }, { passive: true, capture: true });

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
            ensureToolbar();

            if (!rootObserver) {
                rootObserver = new MutationObserver(handleRootMutations);
                rootObserver.observe(document.documentElement, { childList: true, subtree: true });
            }
            resetRetry();
        } catch (error) {
            rootObserver?.disconnect();
            rootObserver = null;
            console.error('[Saved Texts] Инициализация сорвалась, повторю автоматически.', error);
            scheduleRetry();
        }
    }

    ensureDomFeatures();

    window.addEventListener('pageshow', ensureDomFeatures);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) ensureDomFeatures();
    });
    runtime.dom?.subscribe(scheduleEnsureToolbar);

}


// ---- src/modules/hide-models.js ----

// Optional feature based on Hide selected model blocks v1.1 (namespace: local).
function init_hide_models(runtime) {
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


const FEATURE_INITIALIZERS = {
"per-chat": init_per_chat,
"quick-delete": init_quick_delete,
"timestamps": init_timestamps,
"gallery": init_gallery,
"branches": init_branches,
"bookmarks": init_bookmarks,
"summary": init_summary,
"tts": init_tts,
"emoji": init_emoji,
"buttons": init_buttons,
"saved-texts": init_saved_texts,
"hide-models": init_hide_models
};

// ---- src/main.js ----

// Runtime stays in the userscript sandbox: never expose configuration on unsafeWindow.
const gm = {
    get: (key, fallback) => GM_getValue(key, fallback),
    set: (key, value) => GM_setValue(key, value),
    list: () => GM_listValues(),
    delete: key => GM_deleteValue(key),
};
const store = createStore(MODULE_CATALOG, gm);
const quickCommands = createQuickCommands(gm);
const controls = createInterface({ store, catalog: MODULE_CATALOG, storage: localStorage, version: SUITE_VERSION, quickCommands });
GM_registerMenuCommand('SpicyChat Tools — настройки и перенос', controls.open);
const runtime = { quickCommands, createChatPanel, getEndpoint: id => store.getEndpoint(id), dom: createDomAdapters(), models: QUICK_MODELS, nativeModels: createNativeModelAdapter(), onDomReady };
const started = new Set();

function startFeature(module) {
    const mainSite = location.hostname === 'spicychat.ai' || location.hostname === 'www.spicychat.ai';
    if (!mainSite && !module.matchesSubdomains) return;
    if (!store.settings.active || !store.settings.modules[module.id]) return;
    if (started.has(module.id)) return;
    try { FEATURE_INITIALIZERS[module.id](runtime); started.add(module.id); }
    catch (error) { console.error(`[SpicyChat Tools] Не удалось запустить модуль ${module.id}.`, error); }
}

// Early interceptors run synchronously, before the site's first API requests.
for (const module of MODULE_CATALOG) if (module.phase === 'start') startFeature(module);
function startDomFeatures() {
    try { controls.start(); }
    catch (error) { console.error('[SpicyChat Tools] Не удалось открыть настройки. Остальные функции продолжают запуск.', error); }
    for (const module of MODULE_CATALOG) if (module.phase === 'dom') startFeature(module);
}
onDomReady(startDomFeatures);


})();
