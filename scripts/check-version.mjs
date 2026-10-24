import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const eventPath = process.env.GITHUB_EVENT_PATH;
if (eventPath && process.env.GITHUB_EVENT_NAME === 'push') {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    if (event.before && !/^0+$/.test(event.before)) {
        const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
        const changed = git(['diff', '--name-only', event.before, 'HEAD']).split('\n');
        const hasPreviousPackage = git(['ls-tree', '--name-only', event.before, '--', 'package.json']) !== '';
        if (hasPreviousPackage && changed.some(path => path.startsWith('src/') || path === 'scripts/build.mjs')) {
            const previous = JSON.parse(git(['show', `${event.before}:package.json`])).version.split('.').map(Number);
            const current = JSON.parse(readFileSync('package.json', 'utf8')).version.split('.').map(Number);
            const difference = current.map((part, i) => part - previous[i]).find(value => value !== 0) || 0;
            if (difference <= 0) throw new Error('Source changed without a version increase. Run npm version patch --no-git-tag-version.');
        }
    }
}
