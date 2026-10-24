import { SETTINGS_KEY, MIGRATION_KEY } from './settings.js';

const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function allowedStorageKey(key, module) {
    if (typeof key !== 'string' || forbidden.has(key) || key.length > 300) return false;
    return module.storageKeys.some(prefix => prefix.endsWith(':') ? key.startsWith(prefix) : key === prefix);
}

export function decodeStorageValue(value) {
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

export function metadata(source) {
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

export function planLegacyImport(files, catalog, localStorage) {
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
                plan.values[key] = value;
                keys++;
            }
        } else if (module.storageKeys.length && !['emoji', 'per-chat'].includes(module.id)) {
            plan.warnings.push(`${module.title}: файла данных нет. Проверь, что при экспорте включены данные скриптов.`);
        }
        let localKeys = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!allowedStorageKey(key, module)) continue;
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

export function planSuiteImport(raw, catalog) {
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
            plan.values[key] = value;
            keys++;
        }
        for (const [key, value] of Object.entries(raw.local)) if (allowedStorageKey(key, module)) {
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

export function applyImport(plan, store, localStorage, { overwrite = false, now = Date.now } = {}) {
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

export function exportSuite(store, catalog, localStorage) {
    const values = Object.create(null);
    const local = Object.create(null);
    for (const key of store.gm.list()) if (catalog.some(module => allowedStorageKey(key, module))) values[key] = store.gm.get(key);
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (catalog.some(module => allowedStorageKey(key, module))) local[key] = localStorage.getItem(key);
    }
    return { format: 'spchat-tweaks-backup', schema: 1, exportedAt: new Date().toISOString(), settings: store.settings, values, local };
}
