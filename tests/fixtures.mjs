import { readFile } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';
import { crc32 } from '../src/core/zip.js';

export const catalog = JSON.parse(await readFile(new URL('../src/modules.json', import.meta.url), 'utf8'));
export function memory(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        data,
        get: (key, fallback) => data.has(key) ? structuredClone(data.get(key)) : fallback,
        set: (key, value) => data.set(key, structuredClone(value)),
        delete: key => data.delete(key),
        list: () => Array.from(data.keys()),
        getItem: key => data.get(key) ?? null,
        setItem: (key, value) => data.set(key, String(value)),
        removeItem: key => data.delete(key),
        key: i => Array.from(data.keys())[i] ?? null,
        get length() { return data.size; },
    };
}
export function makeLegacy({ includeOptional = false } = {}) {
    const files = new Map();
    for (const module of catalog) {
        if (module.legacyOptional && !includeOptional) continue;
        const source = `// ==UserScript==\n// @name ${module.legacyName}\n// @namespace ${module.legacyNamespace}\n// @version ${module.version}\n// ==/UserScript==\nconst ENDPOINT_URL = 'https://example.test/${module.id}';\nconst ${'CLIENT_TOKEN'} = 'fixture-value-${module.id}';\nthrow new Error('This code must never be executed');`;
        files.set(`${module.id}.user.js`, source);
        files.set(`${module.id}.options.json`, JSON.stringify({ meta: {}, options: {}, settings: { enabled: module.id !== 'bookmarks' } }));
        const data = {};
        if (module.storageKeys.length && !['emoji', 'per-chat'].includes(module.id)) {
            data[module.storageKeys[0] + 'fixture'] = 'o' + JSON.stringify([{ label: module.id, value: 42 }]);
        }
        data['unrelated-account-data'] = 'sdo-not-import';
        files.set(`${module.id}.storage.json`, JSON.stringify({ data }));
    }
    return files;
}
export function zip(files, method = 8) {
    const local = []; const central = []; let offset = 0;
    for (const [name, text] of files) {
        const filename = Buffer.from(name); const original = Buffer.from(text);
        const compressed = method === 8 ? deflateRawSync(original) : original;
        const crc = crc32(original);
        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6);
        header.writeUInt16LE(method, 8); header.writeUInt32LE(crc, 14); header.writeUInt32LE(compressed.length, 18);
        header.writeUInt32LE(original.length, 22); header.writeUInt16LE(filename.length, 26);
        local.push(header, filename, compressed);
        const entry = Buffer.alloc(46);
        entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6);
        entry.writeUInt16LE(0x800, 8); entry.writeUInt16LE(method, 10); entry.writeUInt32LE(crc, 16);
        entry.writeUInt32LE(compressed.length, 20); entry.writeUInt32LE(original.length, 24);
        entry.writeUInt16LE(filename.length, 28); entry.writeUInt32LE(offset, 42);
        central.push(entry, filename); offset += header.length + filename.length + compressed.length;
    }
    const directory = Buffer.concat(central); const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.size, 8); end.writeUInt16LE(files.size, 10);
    end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...local, directory, end]);
}
