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
const runtime = { getEndpoint: id => store.getEndpoint(id) };

function startFeature(module) {
    if (!store.settings.active || !store.settings.modules[module.id]) return;
    try { FEATURE_INITIALIZERS[module.id](runtime); }
    catch (error) { console.error(`[SpicyChat Tools] Не удалось запустить модуль ${module.id}.`, error); }
}

// Early interceptors run synchronously, before the site's first API requests.
for (const module of MODULE_CATALOG) if (module.phase === 'start') startFeature(module);
function startDomFeatures() {
    controls.start();
    for (const module of MODULE_CATALOG) if (module.phase === 'dom') startFeature(module);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startDomFeatures, { once: true });
else startDomFeatures();
