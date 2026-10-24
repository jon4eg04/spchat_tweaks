# Project state

## Goal

One automatically updated Tampermonkey script containing the user's 11 original SpicyChat features plus optional additions. Maintainable per-feature sources, local-only server configuration, and a one-time migration preserving user data.

## Current implementation

- Version 1.0.5. Public source and installation files in this repository.
- User requested no personal-name attribution anywhere in published files. The author header is omitted, AGENTS.md forbids future personal-name attribution, and public-file checks reject author headers.
- Added hide-models, based on the user's Hide selected model blocks v1.1: hides Qwen3 235B 2507 and Codex 24B, handles dynamically inserted paragraphs and text changes, and restores a hidden row if the site reuses it for another model. Independently toggled and enabled by default on upgrade.
- The additional legacy hider is optional in ZIP migration. Original eleven-script backups are still complete; no repeated import is needed for already-migrated users.
- The user reports the initial migration appears to work. The per-chat feature already has a custom model dropdown (Qwen Plus Character, Deepseek V4 Pro, Glam 5.1, Glam 4.6). A separate historical script adding a model to the site's native selector has not been found in saved files/history; do not invent one.
- Original modules remain separate source files with stable data keys. Version 1.0.3 adds shared native-menu discovery for inline and portal layouts, role-based items and text/icon fallbacks. Bookmarks no longer require saved-texts, and saving a history message no longer requires quick-delete. Menu ownership follows the selected message even when a portal is reused.
- Version 1.0.4 fixes a 1.0.3 regression: a visible native image button was mistaken for a plus menu, inserting token/model and command items beside the composer. Discovery now rejects individual buttons, tooltip-only wrappers, composer ancestors and closed/hidden menus. Unmarked plus menus require multiple native actions including search/command. The old broad per-chat and chat-menu fallbacks are removed.
- Response/CMD popups dismiss on window-captured pointerdown and click, including click-only activation and site handlers that stop propagation.
- Composer controls and per-chat settings use the shared menu adapter. Per-chat network interception still targets unsafeWindow, while its UI uses the userscript window. A settings-UI startup exception cannot block DOM-phase features. Custom menu buttons omit other features' service classes to prevent gallery/bookmark collisions.
- Summary and Inworld TTS were deliberately excluded from the 1.0.3 feature audit and remain unchanged.
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
- All nine audited modules retain byte-identical CSS blocks from their original private scripts. A local comparison loaded originals and the combined build on identical invented-content fixtures: composer, plus menu and response-popup screenshots match pixel-for-pixel at 1280px and 520px. No private scripts or screenshots enter git.
- The new native-image regression test fails against 1.0.3 with two stray items and passes against 1.0.4. Browser tests also verify pointer/click/Escape dismissal, menu-only placement, legacy unmarked menus and the prior feature interactions.
- Public-file checks reject credential patterns, unexpected hardcoded network hosts, and secrets. Original private files and private ZIPs never enter git.
- The supplied current chat HTML was inspected locally and exercised with its scripts/network disabled. It is private and is not committed. Composer controls initialize on that snapshot without script errors. No signed-in live session is available; real React/backend behavior still needs user confirmation.
- tests/feature-ui.mjs exercises synthetic current composer/message markup with native menus in body portals or inline, including draft/message saving, emoji insertion, persistent generation buttons, token/model/command request rewriting, bookmarks independent of other modules, gallery/viewer, branch-tree display, timestamps/session dividers, native chain deletion, replay of original user text, reused-menu ownership and composer remounting. Browser checks require Playwright/Chromium and now run in GitHub Actions before publishing dist; npm run check remains dependency-free.
- This work does not modify or deploy PHP handlers. The user's existing handlers continue to be used through imported local settings.
- Tampermonkey per-script technical overrides are not translated into per-module overrides; the suite owns its common metadata.
- ZIP64, encrypted/multivolume ZIP, and archives over 128 MiB are rejected with a readable message.

## Next steps

The user updates the combined script to 1.0.5 and reloads SpicyChat. No repeated migration is needed; existing data/configuration and module toggles are retained. Future native-model-menu additions require finding their exact previous code or requirements.

## Full original-source audit (1.0.5)

- docs/PARITY.md records all eleven baselines, feature intent and every deliberate divergence. Originals came from prior chat files; the old tampermonkey-scripts repository has no SpicyChat sources. The first public module snapshot is f6a377f.
- AST/function comparison: 554 original top-level functions; 526 remain textually identical, 27 are adapted and one obsolete saved-text menu helper is removed. All eleven CSS blocks remain unchanged.
- Found and fixed summary menu integration missed by earlier tests that disabled summary: role-based menus were not recognized and cloning could retain a gallery/bookmark service class. Summary now uses the common menu adapter; its algorithm remains unchanged.
- Restored native menu inline styles/dir/lang lost by the shared clone constructor. Removed the suite-only noframes restriction absent from all originals.
- Feature tests now include all eleven modules together, fake summary generation/cache and TTS prepare/synthesis/ordered playback/cache/cancel. No real handler requests or paid provider calls.
- Additional tests cover saved-text pin/search/confirmed deletion, bookmark rename/deletion, branch collapse/rename/search, conversation changes, working controls after composer remount and actual document-start before body.
- Browser scripts support TEST_BROWSER=firefox; CI runs both Chromium and Firefox before publishing. The local container requires the test-only Firefox sandbox override; production userscript behavior is unaffected.
- Preserve original behavior rather than redesigning it. New deviations require a concrete page change or reproduced bug, documentation and a regression test; ask the user when intent is unclear.
