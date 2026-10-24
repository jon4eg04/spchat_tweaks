import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFile(resolve(root, path), 'utf8');
const { version } = JSON.parse(await read('package.json'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Use a three-part numeric release version.');
const catalog = JSON.parse(await read('src/modules.json'));
const base = 'https://raw.githubusercontent.com/jon4eg04/spchat_tweaks/main/dist';
const header = `// ==UserScript==
// @name         SpicyChat Tools
// @namespace    https://github.com/jon4eg04/spchat_tweaks
// @version      ${version}
// @description  Единый комплект из ${catalog.length} функций SpicyChat с локальными настройками и переносом старых данных.
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
// @updateURL    ${base}/spicychat-tools.meta.js
// @downloadURL  ${base}/spicychat-tools.user.js
// ==/UserScript==
`;
// Modules are ordinary ES modules in source. This small, dependency-free linker
// retains their function scopes and builds one local file, with no runtime imports.
const stripImports = source => source.replace(/^import .+ from ['"].+['"];\r?\n/gm, '');
const parts = [header, '(function () {\n\'use strict\';', `const SUITE_VERSION = ${JSON.stringify(version)};`, `const MODULE_CATALOG = ${JSON.stringify(catalog, null, 2)};`];
for (const path of ['settings', 'zip', 'migration', 'ui', 'dom', 'models', 'native-models']) {
    parts.push(`// ---- src/core/${path}.js ----`, stripImports(await read(`src/core/${path}.js`)).replace(/^export /gm, ''));
}
const functions = [];
for (const { id } of catalog) {
    const name = 'init_' + id.replaceAll('-', '_');
    const source = await read(`src/modules/${id}.js`);
    if (!source.includes('export default function init(runtime)')) throw new Error(`Unknown module shape: ${id}`);
    parts.push(`// ---- src/modules/${id}.js ----`, source.replace('export default function init(runtime)', `function ${name}(runtime)`));
    functions.push(`${JSON.stringify(id)}: ${name}`);
}
parts.push(`const FEATURE_INITIALIZERS = {\n${functions.join(',\n')}\n};`, '// ---- src/main.js ----', await read('src/main.js'), '})();\n');
const bundle = parts.join('\n\n');
new vm.Script(bundle, { filename: 'spicychat-tools.user.js' });
await mkdir(resolve(root, 'dist'), { recursive: true });
await writeFile(resolve(root, 'dist/spicychat-tools.user.js'), bundle);
await writeFile(resolve(root, 'dist/spicychat-tools.meta.js'), header);
console.log(`Built SpicyChat Tools ${version}: ${catalog.length} modules, ${Buffer.byteLength(bundle)} bytes.`);
