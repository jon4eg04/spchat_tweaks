import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rules = [
    ['author metadata is intentionally omitted', /^\/\/\s*@author\s+.+$/m],
    ['provider API credential', /\b(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|AIza[A-Za-z0-9_-]{30,})/],
    ['hardcoded 64-digit token', /['"][0-9a-fA-F]{64}['"]/],
    ['hardcoded client token', /\b(?:CLIENT_TOKEN|API_KEY|ACCESS_TOKEN)\s*=\s*['"][^'"]+['"]/],
    ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['JWT', /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/],
];
let count = 0;
async function scan(directory) {
    for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
        if (['.git', 'node_modules', 'test-results'].includes(entry.name)) continue;
        const relative = directory ? `${directory}/${entry.name}` : entry.name;
        if (entry.isDirectory()) { await scan(relative); continue; }
        // This scanner necessarily spells out its own detection expressions.
        if (relative === 'scripts/check-public.mjs') continue;
        if (!/\.(?:js|mjs|json|md|yml|yaml|txt)$/.test(entry.name)) continue;
        const source = await readFile(resolve(root, relative), 'utf8');
        const allowedHosts = new Set(['spicychat.ai', 'www.spicychat.ai', 'nd-api.com', 'prod.nd-api.com', 'cdn.nd-api.com',
            'github.com', 'raw.githubusercontent.com', 'www.w3.org', 'example.test', 'evil.test',
            'www.tampermonkey.net', 'developer.mozilla.org']);
        for (const url of source.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)) {
            if (!allowedHosts.has(url[1])) throw new Error(`Unexpected hardcoded host in ${relative}. Value withheld.`);
        }
        for (const [reason, pattern] of rules) {
            const match = pattern.exec(source);
            if (match) {
                const line = source.slice(0, match.index).split('\n').length;
                throw new Error(`Public-file check failed: ${relative}:${line}: ${reason}. Matched value withheld.`);
            }
        }
        count++;
    }
}
await scan('');
console.log(`Public-file checks passed for ${count} files. No configured handlers or credential literals detected.`);
