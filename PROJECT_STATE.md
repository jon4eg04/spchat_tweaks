# Project state

## Goal

One automatically updated Tampermonkey script containing the user's 11 original SpicyChat features plus optional additions. Maintainable per-feature sources, local-only server configuration, and a one-time migration preserving user data.

## Current implementation

- Version 1.0.2. Public source and installation files in this repository.
- User requested no personal-name attribution anywhere in published files. The author header is omitted, AGENTS.md forbids future personal-name attribution, and public-file checks reject author headers.
- Added hide-models, based on the user's Hide selected model blocks v1.1: hides Qwen3 235B 2507 and Codex 24B, handles dynamically inserted paragraphs and text changes, and restores a hidden row if the site reuses it for another model. Independently toggled and enabled by default on upgrade.
- The additional legacy hider is optional in ZIP migration. Original eleven-script backups are still complete; no repeated import is needed for already-migrated users.
- The user reports the initial migration appears to work. The per-chat feature already has a custom model dropdown (Qwen Plus Character, Deepseek V4 Pro, Glam 5.1, Glam 4.6). A separate historical script adding a model to the site's native selector has not been found in saved files/history; do not invent one.
- Eleven modules from the confirmed original versions are preserved as individual source files. Changes are limited to module wrappers, page access for the formerly grant-none per-chat module, and runtime handler configuration for summary/TTS.
- A dependency-free Node.js builder links sources into dist/spicychat-tools.user.js; a small meta.js provides update metadata.
- GitHub Actions builds, tests, checks public files, enforces version increases for source changes, and commits regenerated installation files.
- Settings live under spchat-tweaks:settings:v1 in the combined userscript's GM storage. No user's handler URL or credential is shipped.
- A closed-shadow settings UI includes toggles, summary/TTS configuration, ZIP migration preview, explicit activation, pause, and JSON backup/restore.
- First install is inactive. No legacy feature is initialized until the user confirms that old scripts are disabled and starts the suite.
- Standard Tampermonkey ZIP import reads .user.js, .options.json, and .storage.json. Typed GM values are decoded; only known storage keys of exact script identities are copied. Original JavaScript is parsed only for metadata and literal handler configuration, never executed.
- Existing localStorage keys for emoji state and per-chat preferences are retained. Data from localStorage fallback modules can also be copied into the new GM storage.
- Default repeated imports skip existing GM/local values and preserve already-configured handlers. An explicit overwrite option is available. Partial write failures roll back.
- Runtime features run at their original early/DOM phase. Unrelated feature initialization failures are isolated.

## Validation and limits

- Automated tests cover migration from all eleven original identities with realistic synthetic Tampermonkey ZIP/typed storage, disabled modules, handler configuration, fallback local data, duplicate/corrupt archives, failed-write rollback, safe repeat import, and suite backup round trips.
- Integration tests cover the per-chat fetch/XHR rewrite against a separate page/sandbox model and independent parsing of all modules and the linked release.
- A real Chromium smoke test on a synthetic site passes fresh-install UI, activation gating, ZIP picker/preview/import, startup of all eleven modules, and the combined fetch interception chain. Settings and import screens were visually inspected. The optional test is tests/browser-smoke.mjs.
- Public-file checks reject credential patterns, unexpected hardcoded network hosts, and secrets. Original private files and private ZIPs never enter git.
- Live SpicyChat selectors and the user's actual current Tampermonkey export still require confirmation during the user's migration. No signed-in session is available to this build environment.
- This work does not modify or deploy PHP handlers. The user's existing handlers continue to be used through imported local settings.
- Tampermonkey per-script technical overrides are not translated into per-module overrides; the suite owns its common metadata.
- ZIP64, encrypted/multivolume ZIP, and archives over 128 MiB are rejected with a readable message.

## Next steps

The user updates the combined script to 1.0.2, disables the separate legacy hider if still present, and reloads SpicyChat. Existing data/configuration are retained. Future native-model-menu additions require finding their exact previous code or requirements.
