// Runtime stays in the userscript sandbox: never expose configuration on unsafeWindow.
const gm = {
    get: (key, fallback) => GM_getValue(key, fallback),
    set: (key, value) => GM_setValue(key, value),
    list: () => GM_listValues(),
    delete: key => GM_deleteValue(key),
};
const store = createStore(MODULE_CATALOG, gm);
const controls = createInterface({ store, catalog: MODULE_CATALOG, storage: localStorage, version: SUITE_VERSION });
GM_registerMenuCommand('SpicyChat Tools — настройки и перенос', controls.open);
const runtime = { getEndpoint: id => store.getEndpoint(id), dom: createDomAdapters(), models: QUICK_MODELS, nativeModels: createNativeModelAdapter(), onDomReady };
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
