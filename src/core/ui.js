import { MIGRATION_KEY } from './settings.js';
import { readZip } from './zip.js';
import { planLegacyImport, planSuiteImport, applyImport, exportSuite } from './migration.js';

export function createInterface({ store, catalog, storage, version, reload = () => location.reload(), shadowMode = 'closed' }) {
    let host;
    let root;
    let panel;
    let form;
    let status;
    let preview;
    let plan = null;
    let importedNow = false;

    const button = (text, handler, className = '') => {
        const node = document.createElement('button');
        node.type = 'button';
        node.textContent = text;
        node.className = className;
        node.addEventListener('click', handler);
        return node;
    };
    const message = (text, error = false) => {
        status.textContent = text;
        status.className = error ? 'status error' : 'status';
        const nearImport = root.querySelector('[data-import-status]');
        if (nearImport) {
            nearImport.textContent = text;
            nearImport.className = error ? 'status error' : 'status';
        }
    };
    const safely = action => async () => {
        try { await action(); } catch (error) { message(error.message || 'Операция не завершена.', true); }
    };

    function readForm() {
        const next = store.settings;
        for (const { id } of catalog) next.modules[id] = form.elements.namedItem(`module-${id}`).checked;
        for (const id of ['summary', 'tts']) next.endpoints[id] = {
            url: form.elements.namedItem(`${id}-url`).value.trim(),
            token: form.elements.namedItem(`${id}-token`).value.trim(),
        };
        return next;
    }

    function fillForm() {
        const config = store.settings;
        for (const { id } of catalog) form.elements.namedItem(`module-${id}`).checked = config.modules[id];
        for (const id of ['summary', 'tts']) {
            form.elements.namedItem(`${id}-url`).value = config.endpoints[id].url;
            form.elements.namedItem(`${id}-token`).value = config.endpoints[id].token;
        }
        root.querySelector('[data-state]').textContent = config.active ? 'Комплект включён' : 'Ожидает настройки';
        root.querySelector('[data-activate]').hidden = config.active;
        root.querySelector('[data-pause]').hidden = !config.active;
        root.querySelector('[data-confirm-row]').hidden = config.active;
    }

    function section(title, text) {
        const block = document.createElement('section');
        const heading = document.createElement('h2');
        heading.textContent = title;
        block.append(heading);
        if (text) {
            const paragraph = document.createElement('p');
            paragraph.textContent = text;
            block.append(paragraph);
        }
        form.append(block);
        return block;
    }

    async function selectBackup(file) {
        if (!file) return;
        if (file.size > 128 * 1024 * 1024) throw new Error('Файл больше 128 МБ. Экспортируй только нужные скрипты.');
        plan = null;
        importedNow = false;
        preview.replaceChildren();
        message('Читаю резервную копию локально…');
        if (/\.zip$/i.test(file.name)) {
            plan = planLegacyImport(await readZip(new Uint8Array(await file.arrayBuffer())), catalog, storage);
        } else {
            plan = planSuiteImport(JSON.parse(await file.text()), catalog);
        }
        const heading = document.createElement('p');
        const required = catalog.filter(module => !module.legacyOptional);
        const found = plan.rows.filter(row => required.some(module => module.id === row.id)).length;
        heading.textContent = `Найдено основных модулей: ${found} из ${required.length}. Дополнительных: ${plan.rows.length - found}. Проверь список перед переносом.`;
        preview.append(heading);
        const table = document.createElement('table');
        const head = document.createElement('tr');
        for (const title of ['Функция', 'Состояние', 'Данные / сайт']) {
            const th = document.createElement('th'); th.textContent = title; head.append(th);
        }
        table.append(head);
        for (const row of plan.rows) {
            const tr = document.createElement('tr');
            for (const text of [row.title, row.enabled ? 'Вкл.' : 'Выкл.', `${row.keys} / ${row.localKeys}`]) {
                const td = document.createElement('td'); td.textContent = text; tr.append(td);
            }
            table.append(tr);
        }
        preview.append(table);
        const endpointCount = Object.values(plan.endpoints).filter(item => item.url && item.token).length;
        if (endpointCount) {
            const note = document.createElement('p');
            note.textContent = `Настройки обработчиков найдены: ${endpointCount}. Токены будут сохранены только в Tampermonkey.`;
            preview.append(note);
        }
        for (const warning of plan.warnings) {
            const p = document.createElement('p'); p.className = 'warning'; p.textContent = warning; preview.append(p);
        }
        const overwriteRow = document.createElement('label');
        const overwrite = document.createElement('input');
        overwrite.type = 'checkbox';
        overwriteRow.className = 'check';
        overwriteRow.append(overwrite, document.createTextNode('Заменять уже существующие данные нового комплекта. При первом переносе не требуется.'));
        preview.append(overwriteRow);
        const apply = button('Перенести данные', safely(() => {
            if (!plan || importedNow) return;
            const result = applyImport(plan, store, storage, { overwrite: overwrite.checked });
            importedNow = true;
            apply.disabled = true;
            apply.textContent = 'Данные перенесены';
            fillForm();
            message(`Перенос завершён: модулей ${result.modules}, записей ${result.written}. Уже существовавшие записи сохранены: ${result.skipped}. Теперь отключи старые скрипты и запусти комплект.`);
        }), 'primary');
        preview.append(apply);
        message('Копия прочитана. Данные ещё не изменены.');
    }

    function mount() {
        if (host?.isConnected) return;
        host = document.createElement('div');
        host.id = 'spchat-tools-settings';
        root = host.attachShadow({ mode: shadowMode });
        const style = document.createElement('style');
        style.textContent = `
            :host { all: initial; color-scheme: dark; font: 14px/1.5 system-ui, sans-serif; }
            * { box-sizing: border-box; }
            [hidden] { display: none !important; }
            button, input { font: inherit; }
            button { cursor: pointer; border: 1px solid #454958; background: #292d3b; color: #f4f4fa; padding: 9px 13px; border-radius: 8px; }
            button:hover { background: #363b4d; }
            button:focus-visible, input:focus-visible { outline: 2px solid #a9a0ff; outline-offset: 2px; }
            button:disabled { opacity: .5; cursor: default; }
            .primary { background: #7463d9; border-color: #9a8cec; }
            .primary:hover { background: #8674eb; }
            .launcher { position: fixed; right: 18px; bottom: 18px; z-index: 2147483646; box-shadow: 0 5px 24px #0008; font-size: 12px; }
            .backdrop { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; padding: 20px; background: #080912aa; }
            .panel { width: min(760px, 100%); max-height: calc(100dvh - 40px); overflow: auto; background: #1b1d28; color: #f4f4fa; border: 1px solid #444457; border-radius: 16px; box-shadow: 0 24px 100px #0009; }
            header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid #36384a; }
            h1 { margin: 0; font-size: 21px; } h1 small { color: #aba9c4; font-size: 12px; font-weight: 400; }
            header p { margin: 4px 0 0; font-size: 12px; color: #bdb7ed; }
            form { padding: 0 24px 24px; }
            section { padding: 20px 0; border-bottom: 1px solid #36384a; }
            h2 { margin: 0 0 10px; font-size: 16px; } p { margin: 8px 0 12px; color: #c1c1d1; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px 18px; }
            .check { display: flex; align-items: flex-start; gap: 8px; margin: 10px 0; }
            input[type=checkbox] { accent-color: #a395f7; margin-top: 4px; }
            .grid small { color: #9a9bb3; margin-left: 4px; }
            .field { display: block; margin-top: 10px; color: #c1c1d1; }
            input[type=url], input[type=password] { display: block; width: 100%; margin-top: 5px; background: #11131d; color: #f4f4fa; border: 1px solid #454958; padding: 10px; border-radius: 7px; }
            .endpoint { margin-top: 18px; } .endpoint h3 { margin: 0; font-size: 14px; }
            .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 15px; }
            .status { padding: 12px 0 0; color: #a8e6c8; white-space: pre-wrap; }
            .error, .warning { color: #ffbaac; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 12px 0; }
            td, th { text-align: left; padding: 7px; border-bottom: 1px solid #36384a; }
            th { color: #aba9c4; font-weight: 500; }
            @media(max-width: 540px) { .grid { grid-template-columns: 1fr; } form { padding: 0 16px 16px; } header { padding: 16px; } .backdrop { padding: 8px; } .panel { max-height: calc(100dvh - 16px); } }
        `;
        root.append(style, button('SC Tools', open, 'launcher'));
        panel = document.createElement('div');
        panel.className = 'backdrop';
        panel.hidden = true;
        const card = document.createElement('div');
        card.className = 'panel';
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');
        card.setAttribute('aria-label', 'Настройки SpicyChat Tools');
        const header = document.createElement('header');
        const title = document.createElement('div');
        const h1 = document.createElement('h1'); h1.textContent = 'SpicyChat Tools ';
        const release = document.createElement('small'); release.textContent = `v${version}`; h1.append(release);
        const state = document.createElement('p'); state.dataset.state = '';
        title.append(h1, state);
        header.append(title, button('Закрыть', close));
        form = document.createElement('form');
        form.addEventListener('submit', event => event.preventDefault());
        card.append(header, form);
        panel.append(card);
        panel.addEventListener('click', event => { if (event.target === panel) close(); });
        root.addEventListener('keydown', event => {
            if (panel.hidden) return;
            if (event.key === 'Escape') { event.stopPropagation(); close(); }
            if (event.key === 'Tab') {
                const focusable = Array.from(card.querySelectorAll('button:not(:disabled), input:not([type=hidden])')).filter(node => !node.closest('[hidden]'));
                const first = focusable[0]; const last = focusable.at(-1);
                if (event.shiftKey && root.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && root.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        });
        root.append(panel);

        const migrate = section('Переезд со старых скриптов', 'Сначала в Tampermonkey → Утилиты сохрани ZIP с данными скриптов. Открой его здесь на том же адресе SpicyChat и в том же профиле браузера. Файл обрабатывается только на твоём компьютере.');
        const picker = document.createElement('input');
        picker.type = 'file'; picker.accept = '.zip,.json'; picker.hidden = true;
        picker.addEventListener('change', safely(() => selectBackup(picker.files?.[0])));
        migrate.append(button('Выбрать резервную копию', () => { picker.value = ''; picker.click(); }), picker);
        preview = document.createElement('div'); migrate.append(preview);
        const importStatus = document.createElement('p'); importStatus.dataset.importStatus = '';
        migrate.append(importStatus);

        const features = section('Функции', 'Изменения переключателей применяются после перезагрузки страницы.');
        const grid = document.createElement('div'); grid.className = 'grid';
        for (const module of catalog) {
            const label = document.createElement('label'); label.className = 'check';
            const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.name = `module-${module.id}`;
            label.append(checkbox, document.createTextNode(module.title)); grid.append(label);
        }
        features.append(grid);

        const endpoints = section('Обработчики', 'Адреса и токены сохраняются в Tampermonkey. При переносе они подхватятся из старых скриптов.');
        for (const [id, title] of [['summary', 'Пересказ через OpenAI'], ['tts', 'Озвучка Inworld']]) {
            const group = document.createElement('div'); group.className = 'endpoint';
            const h3 = document.createElement('h3'); h3.textContent = title; group.append(h3);
            for (const [field, labelText, type] of [['url', 'Полный HTTPS-адрес', 'url'], ['token', 'Токен доступа', 'password']]) {
                const label = document.createElement('label'); label.className = 'field'; label.textContent = labelText;
                const input = document.createElement('input'); input.type = type; input.name = `${id}-${field}`;
                input.autocomplete = 'off'; input.spellcheck = false; input.placeholder = field === 'url' ? 'https://…' : 'Токен';
                label.append(input); group.append(label);
            }
            endpoints.append(group);
        }

        const controls = section('Запуск и резервная копия');
        const confirmRow = document.createElement('label'); confirmRow.className = 'check'; confirmRow.dataset.confirmRow = '';
        const confirm = document.createElement('input'); confirm.type = 'checkbox'; confirm.name = 'legacy-disabled';
        confirmRow.append(confirm, document.createTextNode('Я отключил старые скрипты SpicyChat в Tampermonkey. Старые вкладки закрою или перезагружу.'));
        controls.append(confirmRow);
        const actions = document.createElement('div'); actions.className = 'actions';
        const activate = button('Запустить комплект', safely(() => {
            if (!confirm.checked) throw new Error('Сначала отключи старые скрипты SpicyChat и отметь подтверждение.');
            const settings = readForm(); settings.active = true; store.save(settings); reload();
        }), 'primary');
        activate.dataset.activate = '';
        const pause = button('Приостановить комплект', safely(() => {
            const settings = readForm(); settings.active = false; store.save(settings); reload();
        }));
        pause.dataset.pause = '';
        actions.append(activate, button('Сохранить и перезагрузить', safely(() => { store.save(readForm()); reload(); })), pause);
        actions.append(button('Скачать копию настроек и данных', safely(() => {
            store.save(readForm());
            const blob = new Blob([JSON.stringify(exportSuite(store, catalog, storage), null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a'); link.href = url;
            link.download = `spchat-tweaks-backup-${new Date().toISOString().slice(0, 10)}.json`;
            link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
            message('Копия скачана. В ней есть личные данные и токены — храни её у себя.');
        })));
        controls.append(actions);
        status = document.createElement('div'); status.className = 'status'; status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite'); form.append(status);
        document.documentElement.append(host);
        fillForm();
        const imported = store.gm.get(MIGRATION_KEY, null);
        if (imported) message(`Последний перенос: ${new Date(imported.at).toLocaleString('ru-RU')}.`);
    }

    function open() {
        if (!document.documentElement) { document.addEventListener('DOMContentLoaded', open, { once: true }); return; }
        mount();
        if (panel.hidden) fillForm();
        panel.hidden = false;
        panel.querySelector('button')?.focus();
    }
    function close() { panel.hidden = true; root.querySelector('.launcher')?.focus(); }
    function start() {
        if (!document.documentElement) { document.addEventListener('DOMContentLoaded', start, { once: true }); return; }
        mount();
        if (!store.settings.active) open();
    }
    return { start, open };
}
