# Project state

## Goal

One automatically updated Tampermonkey script containing the user's 11 original SpicyChat features plus optional additions. Maintainable per-feature sources, local-only server configuration, and a one-time migration preserving user data.

## Current implementation

- Version 1.0.7. Public source and installation files in this repository.
- User requested no personal-name attribution anywhere in published files. The author header is omitted, AGENTS.md forbids future personal-name attribution, and public-file checks reject author headers.
- Added hide-models, based on the user's Hide selected model blocks v1.1: hides Qwen3 235B 2507 and Codex 24B, handles dynamically inserted paragraphs and text changes, and restores a hidden row if the site reuses it for another model. Independently toggled and enabled by default on upgrade.
- The additional legacy hider is optional in ZIP migration. Original eleven-script backups are still complete; no repeated import is needed for already-migrated users.
- The user reports the initial migration appears to work. The per-chat feature has a custom model dropdown; its current choices share src/core/models.js with the native quick menu. A separate historical script adding a model to the site's native selector has not been found in saved files/history; do not invent one.
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

The user updates the combined script to 1.0.7 and reloads SpicyChat. No repeated migration is needed; existing data/configuration and module toggles are retained. Verify native MiMo selection in the real account; local/browser CI uses synthetic site handlers.

## Full original-source audit (1.0.5)

- docs/PARITY.md records all eleven baselines, feature intent and every deliberate divergence. Originals came from prior chat files; the old tampermonkey-scripts repository has no SpicyChat sources. The first public module snapshot is f6a377f.
- AST/function comparison: 554 original top-level functions; 526 remain textually identical, 27 are adapted and one obsolete saved-text menu helper is removed. All eleven CSS blocks remain unchanged.
- Found and fixed summary menu integration missed by earlier tests that disabled summary: role-based menus were not recognized and cloning could retain a gallery/bookmark service class. Summary now uses the common menu adapter; its algorithm remains unchanged.
- Restored native menu inline styles/dir/lang lost by the shared clone constructor. Removed the suite-only noframes restriction absent from all originals.
- Feature tests now include all eleven modules together, fake summary generation/cache and TTS prepare/synthesis/ordered playback/cache/cancel. No real handler requests or paid provider calls.
- Additional tests cover saved-text pin/search/confirmed deletion, bookmark rename/deletion, branch collapse/rename/search, conversation changes, working controls after composer remount and actual document-start before body.
- Browser scripts support TEST_BROWSER=firefox; CI runs both Chromium and Firefox before publishing. The local container requires the test-only Firefox sandbox override; production userscript behavior is unaffected.
- Preserve original behavior rather than redesigning it. New deviations require a concrete page change or reproduced bug, documentation and a regression test; ask the user when intent is unclear.

## Native-model-menu update (1.0.6)

- Shared ordered catalog: Deepseek V4 Pro (`deepseek-v4pro`), Qwen Plus Character (`qwenplus-character`), Glam 5.1 (`glm51`), MiMo V2.6 Pro (`mimo-v26-pro`). The MiMo ID was supplied by the user after inspecting a native generation request. Never infer future model IDs from labels.
- hide-models retains its stable module/legacy identity and optional toggle. It hides Qwen3 235B 2507/Codex 24B, filters the native quick model rows to the requested four, and adds missing choices using native row styling. The shortcut opens Explore all models and clicks the actual capability-gated native model card; it does not copy React event handlers or guess account-state APIs. It cancels on Escape/user pointer interaction/route change, times out after 5 seconds, and leaves the native chooser available on failure.
- Existing native rows retain their handlers and are visually ordered using flex order. If the site adds MiMo itself, the shortcut is removed. Per-chat retains the default-site sentinel. Existing glm45 overrides survive saves in other chats and appear only in affected chats as a legacy option.
- Supplied HTML shows early styles but no SC Tools/DOM-phase controls/hiding markers; it cannot establish the live cause. Shared onDomReady now has a timer fallback in addition to DOMContentLoaded/readystatechange/load/pageshow. Per-chat UI uses it too; early interceptors remain synchronous.
- Lifecycle tests cover absent ready events. The document-start browser fixture verifies startup and Qwen3 hiding with all ready listeners suppressed. Feature checks cover native MiMo handler delegation, exact list/order, hidden rows, reopen/deduplication, Escape cancellation, per-chat MiMo requests and legacy storage preservation in Chromium/Firefox.
- Private source HTML is not committed. No signed-in backend selection was exercised; the user should verify the native menu on the live site after updating.

## Direct native model selection correction (1.0.7)

- User reported that 1.0.6 opened the full chooser instead of behaving like a native quick choice. Its automatic full-chooser path is removed completely, including waiting/timers and pending-selection cancellation code.
- The user supplied the actual React row/component contract: wd receives model, activeModel, clickHandler; its X child forwards onClick to the host div. The shared handler receives {id, name}, updates the inference store, persists the native key, displays a toast and closes the dropdown. We invoke this actual callback instead of guessing the native persistence key or store API.
- src/core/native-models.js resolves the observed contract on a known native row. It ignores minified component names, rejects locked/disabled/action/mismatched rows, and matches the committed host onClick against the owner's child, including React alternates after rerenders. Callback lookup is repeated at click time. Missing contract disables only the added shortcut with a tooltip; there is no full-chooser fallback or fake selected state.
- Selected check uses the current native activeModel on every menu update/reopen. Firefox DOM Xrays are unwrapped for expando access and the id/name payload is allocated with unsafeWindow.Object so the page does not need to access privileged userscript objects. No suite settings or credentials are exposed.
- Node tests cover callback shape, page-realm payload, stale alternate state, Firefox wrapper access and rejection cases. Browser model tests now use genuine React 18.3.1 rather than invented DOM click-through behavior: direct selection, native persistence/toast/closing, no Explore invocation, single selected check on reopening and rerender, keyboard activation, native handler preservation and deduplication. CI installs React only for browser tests; the userscript still has no runtime dependency or external require.
- Full Chromium/Firefox checks remain mandatory. Real account execution is not available in this environment; the adapter contract is taken directly from the user's runtime diagnostics.

- Release CI infrastructure: a run spent nine minutes downloading Ubuntu packages from the runner's azure.archive mirror before cancellation. Browser package installation and browser/OS dependency installation are separate bounded steps; the ephemeral runner uses the primary Ubuntu archive mirror. All Node, public-file and both browser checks still gate dist publication.
