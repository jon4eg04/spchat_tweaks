export const SETTINGS_KEY = 'spchat-tweaks:settings:v1';
export const MIGRATION_KEY = 'spchat-tweaks:last-import:v1';

export function defaultSettings(catalog) {
    return {
        schema: 1,
        active: false,
        modules: Object.fromEntries(catalog.map(({ id }) => [id, true])),
        endpoints: { summary: { url: '', token: '' }, tts: { url: '', token: '' } },
    };
}

export function validateEndpoint(value = {}) {
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

export function normalizeSettings(raw, catalog) {
    const value = defaultSettings(catalog);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return value;
    value.active = raw.active === true;
    for (const { id } of catalog) {
        if (typeof raw.modules?.[id] === 'boolean') value.modules[id] = raw.modules[id];
    }
    for (const id of ['summary', 'tts']) value.endpoints[id] = validateEndpoint(raw.endpoints?.[id]);
    return value;
}

export function createStore(catalog, gm) {
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
