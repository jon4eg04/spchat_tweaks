# Working rules

- Read README.md and PROJECT_STATE.md before changing behavior.
- Edit source files in src/, never hand-edit dist/. Build with npm run build.
- Preserve the original feature behavior unless the requested change requires otherwise. Modules keep separate scopes and can be toggled independently.
- Keep early network interceptors synchronous at document-start. The per-chat module previously ran with @grant none and must still intercept the page's fetch and XMLHttpRequest via unsafeWindow.
- User endpoints and credentials belong only in GM storage. Do not commit handler addresses, client tokens, provider keys, personal backups, HAR files, or original private scripts.
- Imported archives are untrusted data: never eval source, never send archives over the network, and only import allowlisted feature keys from exact legacy identities.
- Preserve old installations' storage. Repeated imports keep existing suite data unless overwrite is explicitly selected. Failed imports must roll back partial writes.
- Run npm run check for code changes. Add meaningful tests for migration, data loss, request interception, or credential handling changes.
- Bump package.json version for release changes. GitHub Actions verifies and regenerates dist/ on main.
- Update README.md, docs/MIGRATION.md, and PROJECT_STATE.md when the workflow or storage format changes.
