// Feature source; bundled by scripts/build.mjs. No userscript metadata here.
export default function init(runtime) {
    'use strict';

    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const INSTANCE_KEY = '__spicyChatChatBranchesV1';
    if (pageWindow[INSTANCE_KEY]) return;
    pageWindow[INSTANCE_KEY] = true;

    const STORAGE_PREFIX = 'tm-sc-chat-branches-v1:bot:';
    const STYLE_ID = 'tm-sc-chat-branches-style';
    const DIALOG_ID = 'tm-sc-chat-branches-dialog';
    const EDITOR_ID = 'tm-sc-chat-branches-editor';
    const POPOVER_ID = 'tm-sc-chat-branches-popover';
    const MENU_ITEM_CLASS = 'tm-sc-open-chat-branches';
    const SAVED_PAGE_BUTTON_CLASS = 'tm-sc-open-saved-chat-branches';
    const MARKER_CLASS = 'tm-sc-chat-branch-marker';
    const CHAT_DROPDOWN_SELECTOR = 'button[aria-label="chat-dropdown" i]';
    const MESSAGE_DROPDOWN_SELECTOR = 'button[aria-label="message-dropdown" i]';
    const MESSAGE_SELECTOR = 'div[id^="message-"]';
    const XHR_META_KEY = '__tmScChatBranchesMeta';
    const INTERNAL_RESPONSE_CONSUMER_FLAG = '__tmScConsumesJsonResponse';
    const ROUTE_CHANGE_EVENT = 'tm-sc-route-change';
    const TITLE_MAX_LENGTH = 80;
    const HISTORY_PAGE_SIZE = 50;
    const MAX_GRAPH_CACHE_SIZE = 8;
    const CHAT_MENU_ITEM_ORDER = [
        'tm-sc-open-message-bookmarks',
        'tm-sc-open-conversation-gallery',
        'tm-sc-open-gpt-summary',
        'tm-sc-open-chat-branches',
    ];
    const API_HEADER_NAMES = new Set([
        'authorization',
        'x-guest-userid',
        'x-country',
        'x-app-id',
        'x-app-version',
        'x-platform',
        'x-platform-os',
        'accept-language',
    ]);

    const graphCache = new Map();
    const historyCache = new Map();
    let storageQueue = Promise.resolve();
    let activeContext = null;
    let activeGraph = null;
    let contextToken = 0;
    let ensureScheduled = false;
    let domLifecycleToken = 0;
    let rootObserver = null;
    let retryTimer = null;
    let retryDelay = 250;
    let savedPageButton = null;

    let apiNativeFetch = null;
    let apiOrigin = '';
    const apiHeaders = new Map();
    let relationScan = null;
    let relationScanStarting = false;
    let autoScanTimer = null;

    let dialog = null;
    let dialogTree = null;
    let dialogCount = null;
    let dialogSearch = null;
    let dialogEmpty = null;
    let dialogAnchor = null;
    let dialogScanButton = null;
    let dialogScanStatus = null;
    let dialogScanStatusText = null;
    let dialogScanProgress = null;

    let editor = null;
    let editorInput = null;
    let editorState = null;

    let markerPopover = null;
    let markerPopoverMarker = null;
    let markerPopoverCloseTimer = null;
    let markerPopoverPinned = false;

    const moscowDateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });

    const icons = {
        branches: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <circle cx="6" cy="5" r="3"></circle><circle cx="18" cy="6" r="3"></circle>
                <circle cx="6" cy="19" r="3"></circle>
                <path d="M6 8v8"></path><path d="M9 19h2a7 7 0 0 0 7-7V9"></path>
            </svg>`,
        branchSmall: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round">
                <circle cx="6" cy="5" r="2"></circle><circle cx="18" cy="6" r="2"></circle>
                <circle cx="6" cy="19" r="2"></circle>
                <path d="M6 7v10"></path><path d="M8 19h3a7 7 0 0 0 7-7V8"></path>
            </svg>`,
        close: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="m18 6-12 12"></path><path d="m6 6 12 12"></path>
            </svg>`,
        search: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path>
            </svg>`,
        messages: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="13" height="13"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"></path>
                <path d="M13 8H7"></path><path d="M17 12H7"></path>
            </svg>`,
        refresh: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"></path>
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"></path>
            </svg>`,
        pencil: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
            </svg>`,
        unlink: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="m5.17 11.75-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                <path d="m8 2 8 20"></path>
            </svg>`,
        chevron: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="m9 18 6-6-6-6"></path>
            </svg>`,
        root: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="2"></circle>
            </svg>`,
        full: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2"></rect>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
            </svg>`,
        partial: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 3v12"></path><circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="6" r="3"></circle><path d="M9 15h2a7 7 0 0 0 7-7"></path>
            </svg>`,
        orphan: `
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="17" height="17"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"></circle><path d="M9.5 9a2.6 2.6 0 1 1 4.5 1.8c-1 .8-2 1.3-2 2.7"></path>
                <path d="M12 17h.01"></path>
            </svg>`,
    };

    function getChatContext() {
        const parts = location.pathname.split('/').filter(Boolean);
        const chatIndex = parts.findIndex((part) => part === 'chat' || part === 'story');
        if (chatIndex < 0 || !parts[chatIndex + 1]) {
            if (parts[0] !== 'chats' || !parts[1]) return null;
            const characterId = parts[1];
            return {
                characterId,
                conversationId: '',
                routeType: 'chat',
                pageType: 'saved',
                key: `${characterId}:saved`,
            };
        }

        const characterId = parts[chatIndex + 1];
        const conversationId = parts[chatIndex + 2] || '';
        return {
            characterId,
            conversationId,
            routeType: parts[chatIndex],
            pageType: 'chat',
            key: `${characterId}:${conversationId}`,
        };
    }

    function installRouteChangeSignal() {
        const key = '__tmScRouteChangeSignalV1';
        if (pageWindow[key]) return;
        const dispatch = () => pageWindow.dispatchEvent(new pageWindow.Event(ROUTE_CHANGE_EVENT));
        for (const method of ['pushState', 'replaceState']) {
            const original = pageWindow.history?.[method];
            if (typeof original !== 'function') continue;
            pageWindow.history[method] = function (...args) {
                const result = Reflect.apply(original, this, args);
                dispatch();
                return result;
            };
        }
        pageWindow.addEventListener('popstate', dispatch);
        pageWindow.addEventListener('hashchange', dispatch);
        pageWindow[key] = true;
    }

    function readRequestUrl(input) {
        if (typeof input === 'string') return input;
        if (input && typeof input.url === 'string') return input.url;
        try {
            return String(input || '');
        } catch (_error) {
            return '';
        }
    }

    function isSpicyApiUrl(rawUrl) {
        try {
            const url = new URL(rawUrl, location.href);
            return url.hostname === 'nd-api.com' || url.hostname.endsWith('.nd-api.com');
        } catch (_error) {
            return false;
        }
    }

    function parseJsonBody(body) {
        if (!body) return null;
        if (typeof body === 'object' && !(body instanceof pageWindow.FormData)) return body;
        if (typeof body !== 'string') return null;
        try {
            return JSON.parse(body);
        } catch (_error) {
            return null;
        }
    }

    function headerEntries(source) {
        if (!source) return [];
        const entries = [];
        try {
            if (typeof source.forEach === 'function') {
                source.forEach((value, name) => entries.push([name, value]));
                return entries;
            }
            if (Array.isArray(source)) return source;
            if (typeof source === 'object') return Object.entries(source);
        } catch (_error) {
            return [];
        }
        return entries;
    }

    function rememberApiAccess(rawUrl, ...headerSources) {
        if (!isSpicyApiUrl(rawUrl)) return;
        try {
            apiOrigin = new URL(rawUrl, location.href).origin;
        } catch (_error) {
            return;
        }

        for (const source of headerSources) {
            for (const [rawName, rawValue] of headerEntries(source)) {
                const name = String(rawName || '').toLowerCase();
                if (!API_HEADER_NAMES.has(name) || rawValue === undefined || rawValue === null) continue;
                apiHeaders.set(name, String(rawValue));
            }
        }
    }

    function hasApiAccess() {
        return Boolean(apiNativeFetch && apiOrigin && apiHeaders.get('authorization'));
    }

    function normalizeTimestamp(value) {
        if (value === null || value === undefined || value === '') return 0;
        let timestamp = Number(value);
        if (!Number.isFinite(timestamp) && typeof value === 'string') timestamp = Date.parse(value);
        if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
        return timestamp < 100000000000 ? timestamp * 1000 : timestamp;
    }

    function normalizeTitle(value, fallback = 'Чат без названия') {
        const title = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
        return (title || fallback).slice(0, TITLE_MAX_LENGTH);
    }

    function formatMoscowDateTime(timestamp) {
        if (!timestamp) return '';
        try {
            return moscowDateTimeFormatter.format(new Date(timestamp));
        } catch (_error) {
            return '';
        }
    }

    function makeDefaultTitle(kind, timestamp = Date.now()) {
        const date = formatMoscowDateTime(timestamp);
        if (kind === 'unlinked') return `Старый чат${date ? ` · ${date}` : ''}`;
        return `Новый сюжет${date ? ` · ${date}` : ''}`;
    }

    function storageKey(characterId) {
        return `${STORAGE_PREFIX}${characterId}`;
    }

    async function readValue(key, fallbackValue) {
        try {
            if (typeof GM_getValue === 'function') {
                const value = await Promise.resolve(GM_getValue(key, fallbackValue));
                return value === undefined ? fallbackValue : value;
            }
        } catch (error) {
            console.warn('[Chat Branches] Не удалось прочитать данные Tampermonkey.', error);
        }

        try {
            const raw = localStorage.getItem(key);
            return raw === null ? fallbackValue : JSON.parse(raw);
        } catch (_error) {
            return fallbackValue;
        }
    }

    async function writeValue(key, value) {
        if (typeof GM_setValue === 'function') {
            await Promise.resolve(GM_setValue(key, value));
            return;
        }
        localStorage.setItem(key, JSON.stringify(value));
    }

    function normalizeNode(value, characterId, index = 0) {
        if (!value || typeof value !== 'object') return null;
        const conversationId = typeof value.conversationId === 'string'
            ? value.conversationId.trim()
            : '';
        if (!conversationId) return null;

        const allowedKinds = new Set(['root', 'full', 'partial', 'unlinked']);
        const kind = allowedKinds.has(value.kind) ? value.kind : 'unlinked';
        const createdAt = normalizeTimestamp(value.createdAt) || (Date.now() - index);
        return {
            conversationId,
            characterId: typeof value.characterId === 'string' && value.characterId
                ? value.characterId
                : characterId,
            title: normalizeTitle(value.title, makeDefaultTitle(kind, createdAt)),
            parentId: typeof value.parentId === 'string' && value.parentId
                ? value.parentId
                : null,
            forkMessageId: typeof value.forkMessageId === 'string' && value.forkMessageId
                ? value.forkMessageId.replace(/^message-/, '')
                : null,
            forkExcerpt: typeof value.forkExcerpt === 'string'
                ? value.forkExcerpt.replace(/\s+/g, ' ').trim().slice(0, 180)
                : '',
            kind,
            createdAt,
            updatedAt: normalizeTimestamp(value.updatedAt) || createdAt,
            messageCount: Math.max(0, Number(value.messageCount) || 0),
            lastMessageId: typeof value.lastMessageId === 'string' ? value.lastMessageId : '',
            relationSource: ['captured', 'inferred'].includes(value.relationSource)
                ? value.relationSource
                : '',
            relationCheckedAt: normalizeTimestamp(value.relationCheckedAt),
            relationIgnored: value.relationIgnored === true,
        };
    }

    function normalizeGraph(value, characterId) {
        const rawNodes = Array.isArray(value?.nodes) ? value.nodes : [];
        const nodes = rawNodes
            .map((node, index) => normalizeNode(node, characterId, index))
            .filter(Boolean)
            .filter((node, index, array) => (
                array.findIndex((candidate) => candidate.conversationId === node.conversationId) === index
            ));
        const validIds = new Set(nodes.map((node) => node.conversationId));
        const collapsed = Array.isArray(value?.collapsed)
            ? [...new Set(value.collapsed.filter((id) => typeof id === 'string' && validIds.has(id)))]
            : [];

        return { version: 2, characterId, nodes, collapsed };
    }

    function setGraphCache(characterId, graph) {
        graphCache.delete(characterId);
        graphCache.set(characterId, graph);
        while (graphCache.size > MAX_GRAPH_CACHE_SIZE) {
            graphCache.delete(graphCache.keys().next().value);
        }
    }

    async function readGraph(characterId, fresh = false) {
        if (!fresh && graphCache.has(characterId)) return graphCache.get(characterId);
        const graph = normalizeGraph(
            await readValue(storageKey(characterId), null),
            characterId,
        );
        setGraphCache(characterId, graph);
        return graph;
    }

    function notifyGraphChanged(characterId, graph) {
        setGraphCache(characterId, graph);
        if (activeContext?.characterId !== characterId) return;
        activeGraph = graph;
        renderDialog();
        ensureBranchMarkers();
        scheduleAutomaticRelationScan();
    }

    function updateGraph(characterId, updater) {
        const operation = storageQueue.then(async () => {
            const latest = await readGraph(characterId, true);
            const draft = normalizeGraph(latest, characterId);
            const result = updater(draft) || draft;
            const next = normalizeGraph(result, characterId);
            await writeValue(storageKey(characterId), next);
            notifyGraphChanged(characterId, next);
            return next;
        });

        storageQueue = operation.catch(() => undefined);
        return operation;
    }

    function findNode(graph, conversationId) {
        return graph?.nodes.find((node) => node.conversationId === conversationId) || null;
    }

    function upsertNode(graph, data) {
        const index = graph.nodes.findIndex((node) => node.conversationId === data.conversationId);
        const previous = index >= 0 ? graph.nodes[index] : null;
        const merged = normalizeNode({
            ...(previous || {}),
            ...data,
            title: data.title || previous?.title,
            createdAt: data.createdAt || previous?.createdAt || Date.now(),
            updatedAt: Date.now(),
        }, data.characterId || graph.characterId);
        if (!merged) return null;
        if (index >= 0) graph.nodes[index] = merged;
        else graph.nodes.push(merged);
        return merged;
    }

    function getForkMetadata(messageId) {
        if (!messageId) return { forkExcerpt: '' };
        const message = document.getElementById(`message-${String(messageId).replace(/^message-/, '')}`);
        if (!message) return { forkExcerpt: '' };
        const textContainer = Array.from(message.querySelectorAll('[class]')).find((element) => (
            element.classList.contains('[overflow-wrap:anywhere]')
        ));
        const text = (textContainer?.innerText || textContainer?.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 180);
        return { forkExcerpt: text };
    }

    function classifyRequest(rawUrl, method) {
        if (!isSpicyApiUrl(rawUrl)) return { kind: 'other' };
        try {
            const url = new URL(rawUrl, location.href);
            const path = url.pathname.replace(/\/+$/, '');
            const normalizedMethod = String(method || 'GET').toUpperCase();

            if (normalizedMethod === 'POST' && /\/conversations\/clone$/i.test(path)) {
                return { kind: 'clone' };
            }

            const createMatch = path.match(/\/characters\/([^/]+)\/conversations$/i);
            if (normalizedMethod === 'POST' && createMatch) {
                return { kind: 'create', characterId: decodeURIComponent(createMatch[1]) };
            }

            const renameMatch = path.match(/\/conversations\/([^/]+)\/label$/i);
            if ((normalizedMethod === 'PATCH' || normalizedMethod === 'PUT') && renameMatch) {
                return { kind: 'rename', conversationId: decodeURIComponent(renameMatch[1]) };
            }

            const isConversationList = (
                normalizedMethod === 'GET'
                && /\/characters\/[^/]+\/conversations$/i.test(path)
            );
            const isSingleConversation = (
                normalizedMethod === 'GET'
                && /\/conversations\/[^/]+$/i.test(path)
            );
            return { kind: isConversationList || isSingleConversation ? 'conversations' : 'other' };
        } catch (_error) {
            return { kind: 'other' };
        }
    }

    function findResponseConversation(payload) {
        const visited = new WeakSet();
        let fallback = null;

        const walk = (value, depth) => {
            if (!value || typeof value !== 'object' || depth > 6 || visited.has(value)) return null;
            visited.add(value);

            if (!Array.isArray(value) && typeof value.id === 'string') {
                if (typeof value.character_id === 'string') return value;
                if (!fallback && (Array.isArray(value.messages) || 'label' in value)) fallback = value;
            }

            const children = Array.isArray(value) ? value : Object.values(value);
            for (const child of children) {
                const found = walk(child, depth + 1);
                if (found) return found;
            }
            return null;
        };

        return walk(payload, 0) || fallback;
    }

    function collectConversationRecords(payload) {
        const records = [];
        const visited = new WeakSet();

        const walk = (value, depth) => {
            if (!value || typeof value !== 'object' || depth > 7 || visited.has(value)) return;
            visited.add(value);

            if (Array.isArray(value)) {
                for (const item of value) walk(item, depth + 1);
                return;
            }

            const looksLikeConversation = (
                typeof value.id === 'string'
                && typeof value.character_id === 'string'
                && !value.role
                && (
                    typeof value.label === 'string'
                    || typeof value.last_message_id === 'string'
                    || Array.isArray(value.messages)
                )
            );
            if (looksLikeConversation) records.push(value);
            for (const child of Object.values(value)) walk(child, depth + 1);
        };

        walk(payload, 0);
        return records;
    }

    async function captureConversationRecords(payload) {
        const grouped = new Map();
        for (const record of collectConversationRecords(payload)) {
            if (!grouped.has(record.character_id)) grouped.set(record.character_id, []);
            grouped.get(record.character_id).push(record);
        }

        for (const [characterId, records] of grouped) {
            await updateGraph(characterId, (graph) => {
                for (const record of records) {
                    const existing = findNode(graph, record.id);
                    const createdAt = normalizeTimestamp(record.createdAt || record.created_at);
                    const messageCount = Math.max(
                        0,
                        Number(record.message_count ?? record.num_messages) || 0,
                    );
                    const lastMessageId = typeof record.last_message_id === 'string'
                        ? record.last_message_id
                        : existing?.lastMessageId || '';
                    if (existing) {
                        upsertNode(graph, {
                            ...existing,
                            title: normalizeTitle(record.label, existing.title),
                            createdAt: createdAt || existing.createdAt,
                            messageCount: messageCount || existing.messageCount,
                            lastMessageId,
                        });
                    } else {
                        upsertNode(graph, {
                            conversationId: record.id,
                            characterId,
                            title: normalizeTitle(record.label, makeDefaultTitle('unlinked', createdAt)),
                            parentId: null,
                            forkMessageId: null,
                            forkExcerpt: '',
                            kind: 'unlinked',
                            createdAt: createdAt || Date.now(),
                            messageCount,
                            lastMessageId,
                            relationCheckedAt: 0,
                        });
                    }
                }
                return graph;
            });
        }
    }

    async function processSuccessfulRequest(meta, payload) {
        if (!meta || !payload) return;
        const classification = meta.classification;
        const body = await Promise.resolve(meta.bodyPromise).catch(() => null);

        if (classification.kind === 'clone') {
            const response = findResponseConversation(payload);
            const childId = response?.id;
            const characterId = response?.character_id || meta.context?.characterId;
            const parentId = typeof body?.conversation_id === 'string' ? body.conversation_id : '';
            if (!childId || !characterId || !parentId) return;

            const cloneKind = body?.type === 'partial' ? 'partial' : 'full';
            const forkMessageId = typeof body?.message_id === 'string'
                ? body.message_id.replace(/^message-/, '')
                : null;
            const forkMeta = meta.forkMeta || { forkExcerpt: '' };

            await updateGraph(characterId, (graph) => {
                if (!findNode(graph, parentId)) {
                    upsertNode(graph, {
                        conversationId: parentId,
                        characterId,
                        title: 'Исходный чат',
                        parentId: null,
                        kind: graph.nodes.length ? 'unlinked' : 'root',
                        createdAt: Date.now() - 1,
                    });
                }

                upsertNode(graph, {
                    conversationId: childId,
                    characterId,
                    title: normalizeTitle(body?.label, makeDefaultTitle(cloneKind)),
                    parentId,
                    forkMessageId,
                    forkExcerpt: forkMeta.forkExcerpt,
                    kind: cloneKind,
                    createdAt: Date.now(),
                    relationSource: 'captured',
                    relationCheckedAt: Date.now(),
                    relationIgnored: false,
                });
                return graph;
            });
            return;
        }

        if (classification.kind === 'create') {
            const response = findResponseConversation(payload) || payload;
            const conversationId = typeof response?.id === 'string' ? response.id : '';
            const characterId = response?.character_id || classification.characterId;
            if (!conversationId || !characterId) return;

            await updateGraph(characterId, (graph) => {
                upsertNode(graph, {
                    conversationId,
                    characterId,
                    title: normalizeTitle(response?.label, makeDefaultTitle('root')),
                    parentId: null,
                    forkMessageId: null,
                    forkExcerpt: '',
                    kind: 'root',
                    createdAt: normalizeTimestamp(response?.createdAt || response?.created_at) || Date.now(),
                    relationSource: 'captured',
                    relationCheckedAt: Date.now(),
                    relationIgnored: false,
                });
                return graph;
            });
            return;
        }

        if (classification.kind === 'rename') {
            const characterId = meta.context?.characterId || activeContext?.characterId;
            const title = typeof body?.label === 'string' ? body.label : '';
            if (!characterId || !classification.conversationId || !title.trim()) return;

            await updateGraph(characterId, (graph) => {
                const node = findNode(graph, classification.conversationId);
                if (node) upsertNode(graph, { ...node, title: normalizeTitle(title) });
                return graph;
            });
            return;
        }

        if (classification.kind === 'conversations') {
            await captureConversationRecords(payload);
        }
    }

    function makeRequestMeta(rawUrl, method, bodySource) {
        const classification = classifyRequest(rawUrl, method);
        let bodyPromise;
        if (bodySource && typeof bodySource.clone === 'function' && typeof bodySource.text === 'function') {
            bodyPromise = bodySource.clone().text().then(parseJsonBody).catch(() => null);
        } else {
            bodyPromise = Promise.resolve(parseJsonBody(bodySource));
        }

        const parsedBody = parseJsonBody(bodySource);
        return {
            rawUrl,
            method,
            classification,
            context: getChatContext(),
            bodyPromise,
            forkMeta: parsedBody?.message_id ? getForkMetadata(parsedBody.message_id) : null,
            requestHeaders: new Map(),
        };
    }

    function inspectResponse(response, meta) {
        if (!response?.clone || response.ok === false || meta.classification.kind === 'other') return;
        try {
            const contentType = response.headers?.get?.('content-type') || '';
            if (contentType && !/json/i.test(contentType)) return;
            const clone = response.clone();
            void Promise.resolve(clone.json())
                .then((payload) => processSuccessfulRequest(meta, payload))
                .catch(() => undefined);
        } catch (_error) {
            // Не-JSON ответы пропускаем.
        }
    }

    function installNetworkCapture() {
        try {
            const originalFetch = pageWindow.fetch;
            if (typeof originalFetch === 'function') {
                apiNativeFetch = originalFetch;
                pageWindow.fetch = function (input, options = {}) {
                    const rawUrl = readRequestUrl(input);
                    const method = options.method || input?.method || 'GET';
                    rememberApiAccess(rawUrl, input?.headers, options.headers);
                    const classification = classifyRequest(rawUrl, method);
                    const consumesResponse = options?.[INTERNAL_RESPONSE_CONSUMER_FLAG] === true;
                    let meta = null;
                    if (!consumesResponse && classification.kind !== 'other') {
                        const needsBody = ['clone', 'create', 'rename'].includes(classification.kind);
                        const bodySource = needsBody ? (
                            options.body || (input && typeof input.clone === 'function' ? input : null)
                        ) : null;
                        meta = makeRequestMeta(rawUrl, method, bodySource);
                    }
                    const result = Reflect.apply(originalFetch, this, arguments);
                    if (meta) {
                        void Promise.resolve(result).then(
                            (response) => inspectResponse(response, meta),
                            () => undefined,
                        );
                    }
                    return result;
                };
            }
        } catch (error) {
            console.warn('[Chat Branches] Не удалось подключиться к fetch.', error);
        }

        try {
            const prototype = pageWindow.XMLHttpRequest?.prototype;
            if (!prototype) return;
            const originalOpen = prototype.open;
            const originalSend = prototype.send;
            const originalSetRequestHeader = prototype.setRequestHeader;

            prototype.open = function (method, url) {
                this[XHR_META_KEY] = makeRequestMeta(readRequestUrl(url), method || 'GET', null);
                return Reflect.apply(originalOpen, this, arguments);
            };

            if (typeof originalSetRequestHeader === 'function') {
                prototype.setRequestHeader = function (name, value) {
                    const meta = this[XHR_META_KEY];
                    const normalizedName = String(name || '').toLowerCase();
                    if (meta && API_HEADER_NAMES.has(normalizedName)) {
                        meta.requestHeaders.set(normalizedName, String(value));
                    }
                    return Reflect.apply(originalSetRequestHeader, this, arguments);
                };
            }

            prototype.send = function (body) {
                const xhr = this;
                const meta = xhr[XHR_META_KEY];
                if (meta) {
                    rememberApiAccess(meta.rawUrl, meta.requestHeaders);
                    if (meta.classification.kind !== 'other') {
                        const parsedBody = parseJsonBody(body);
                        meta.bodyPromise = Promise.resolve(parsedBody);
                        meta.forkMeta = parsedBody?.message_id ? getForkMetadata(parsedBody.message_id) : null;
                    }
                }

                if (meta && isSpicyApiUrl(meta.rawUrl)) {
                    xhr.addEventListener('loadend', () => {
                        if (xhr.status < 200 || xhr.status >= 300 || meta.classification.kind === 'other') return;
                        try {
                            const payload = xhr.responseType === 'json'
                                ? xhr.response
                                : JSON.parse(xhr.responseText);
                            void processSuccessfulRequest(meta, payload);
                        } catch (_error) {
                            // Не-JSON ответы пропускаем.
                        }
                    }, { once: true });
                }
                return Reflect.apply(originalSend, this, arguments);
            };
        } catch (error) {
            console.warn('[Chat Branches] Не удалось подключиться к XHR.', error);
        }
    }

    function sleep(milliseconds) {
        return new Promise((resolve) => pageWindow.setTimeout(resolve, milliseconds));
    }

    async function fetchApiJson(path) {
        if (!hasApiAccess()) {
            const error = new Error('Сессия API ещё не обнаружена.');
            error.code = 'NO_API_SESSION';
            throw error;
        }

        const url = new URL(path, `${apiOrigin}/`).toString();
        const headers = Object.fromEntries(apiHeaders);
        headers.accept = 'application/json';
        const response = await Reflect.apply(apiNativeFetch, pageWindow, [url, {
            method: 'GET',
            headers,
            mode: 'cors',
            credentials: 'omit',
            [INTERNAL_RESPONSE_CONSUMER_FLAG]: true,
        }]);
        if (!response?.ok) {
            const error = new Error(`SpicyChat вернул HTTP ${response?.status || 0}.`);
            error.status = response?.status || 0;
            throw error;
        }
        return response.json();
    }

    function setRelationScanUi(text, percent, running = relationScan?.running === true) {
        ensureDialog();
        if (dialogScanStatus) dialogScanStatus.hidden = !text;
        if (dialogScanStatusText) dialogScanStatusText.textContent = text || '';
        if (dialogScanProgress) {
            const normalized = Math.max(0, Math.min(100, Number(percent) || 0));
            dialogScanProgress.style.width = `${normalized}%`;
            dialogScanProgress.parentElement?.setAttribute('aria-valuenow', String(Math.round(normalized)));
        }
        if (dialogScanButton) {
            dialogScanButton.classList.toggle('is-running', running);
            dialogScanButton.innerHTML = `${icons.refresh}<span>${running ? 'Остановить' : 'Обновить связи'}</span>`;
            dialogScanButton.title = running
                ? 'Остановить восстановление связей'
                : 'Повторно проверить старые чаты и восстановить связи';
        }
    }

    function relationScanPercent() {
        if (!relationScan) return 0;
        if (relationScan.phase === 'list') return Math.min(5, relationScan.listPages * 2);
        if (relationScan.phase === 'infer') return 94;
        if (relationScan.phase === 'done') return 100;
        const total = Math.max(1, relationScan.expectedMessages);
        return 5 + Math.min(87, (relationScan.fetchedMessages / total) * 87);
    }

    function updateRelationScanStatus(text) {
        if (!relationScan) return;
        relationScan.statusText = text;
        setRelationScanUi(text, relationScanPercent(), relationScan.running);
    }

    function conversationArray(payload) {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.conversations)) return payload.conversations;
        if (Array.isArray(payload?.data)) return payload.data;
        return [];
    }

    async function fetchAllSavedConversations(characterId) {
        const records = [];
        const seen = new Set();
        let lastId = '';
        let page = 0;

        while (!relationScan?.cancelRequested && page < 200) {
            const query = new URLSearchParams({ limit: '25', sort: 'latest' });
            if (lastId) query.set('last_id', lastId);
            relationScan.phase = 'list';
            relationScan.listPages = page + 1;
            updateRelationScanStatus(`Получаю список чатов · страница ${page + 1}`);
            const payload = await fetchApiJson(
                `/v2/characters/${encodeURIComponent(characterId)}/conversations?${query}`,
            );
            const batch = conversationArray(payload);
            await captureConversationRecords(batch);

            let added = 0;
            for (const record of batch) {
                if (!record?.id || seen.has(record.id)) continue;
                seen.add(record.id);
                records.push(record);
                added += 1;
            }
            if (batch.length < 25 || !added) break;
            const nextLastId = batch.at(-1)?.id;
            if (!nextLastId || nextLastId === lastId) break;
            lastId = nextLastId;
            page += 1;
            await sleep(80);
        }
        return records;
    }

    function mediaSignature(message) {
        const picked = {};
        for (const key of ['image', 'image_url', 'imageUrl', 'images', 'attachments', 'media']) {
            if (message?.[key] !== undefined && message[key] !== null) picked[key] = message[key];
        }
        try {
            return JSON.stringify(picked);
        } catch (_error) {
            return '';
        }
    }

    function historyFingerprint(parts) {
        let first = 2166136261;
        let second = 5381;
        let length = 0;
        for (const rawPart of parts) {
            const part = String(rawPart ?? '');
            for (let index = 0; index <= part.length; index += 1) {
                const code = index < part.length ? part.charCodeAt(index) : 0;
                first = Math.imul(first ^ code, 16777619);
                second = Math.imul(second, 33) ^ code;
                length += 1;
            }
        }
        return `${first >>> 0}:${second >>> 0}:${length}`;
    }

    function normalizeHistoryMessage(message) {
        if (!message || typeof message !== 'object' || typeof message.id !== 'string') return null;
        const createdAt = normalizeTimestamp(message.createdAt || message.created_at);
        const role = typeof message.role === 'string' ? message.role : '';
        const content = typeof message.content === 'string' ? message.content : '';
        const media = mediaSignature(message);
        return {
            id: message.id,
            prevId: typeof message.prev_id === 'string' ? message.prev_id : null,
            role,
            createdAt,
            excerpt: content.replace(/\s+/g, ' ').trim().slice(0, 180),
            hasMedia: Boolean(media && media !== '{}'),
            fingerprint: historyFingerprint([role, createdAt, content, media]),
        };
    }

    async function fetchConversationHistory(node, position, total) {
        const cacheKey = [
            node.characterId,
            node.conversationId,
            node.lastMessageId,
            node.messageCount,
        ].join(':');
        if (historyCache.has(cacheKey)) return historyCache.get(cacheKey);

        const collected = [];
        const seen = new Set();
        let lastId = '';
        let page = 0;

        while (!relationScan?.cancelRequested && page < 1000) {
            const query = new URLSearchParams({ limit: String(HISTORY_PAGE_SIZE) });
            if (lastId) query.set('last_id', lastId);
            relationScan.phase = 'history';
            updateRelationScanStatus(
                `Чат ${position}/${total} · ${collected.length}/${node.messageCount || '?'} сообщений`,
            );
            const payload = await fetchApiJson(
                `/characters/${encodeURIComponent(node.characterId)}/messages/${encodeURIComponent(node.conversationId)}?${query}`,
            );
            const batch = Array.isArray(payload?.messages) ? payload.messages : [];
            let added = 0;
            for (const message of batch) {
                if (!message?.id || seen.has(message.id)) continue;
                seen.add(message.id);
                collected.push(message);
                added += 1;
            }
            relationScan.fetchedMessages += added;
            if (relationScan.fetchedMessages > relationScan.expectedMessages) {
                relationScan.expectedMessages = relationScan.fetchedMessages + 1;
            }
            updateRelationScanStatus(
                `Чат ${position}/${total} · ${collected.length}/${node.messageCount || '?'} сообщений`,
            );

            if (batch.length < HISTORY_PAGE_SIZE || !added) break;
            const nextLastId = batch.at(-1)?.id;
            if (!nextLastId || nextLastId === lastId) break;
            lastId = nextLastId;
            page += 1;
            await sleep(80);
        }

        const history = collected
            .map(normalizeHistoryMessage)
            .filter(Boolean)
            .reverse();
        historyCache.set(cacheKey, history);
        return history;
    }

    function commonPrefixLength(parentMessages, childMessages) {
        const limit = Math.min(parentMessages.length, childMessages.length);
        let length = 0;
        while (
            length < limit
            && parentMessages[length].fingerprint === childMessages[length].fingerprint
        ) length += 1;
        return length;
    }

    function historyPrefixKey(messages) {
        if (messages.length < 2) return '';
        return `${messages[0].fingerprint}|${messages[1].fingerprint}`;
    }

    function inferParentForConversation(childRecord, records) {
        const childMessages = childRecord.messages;
        if (childMessages.length < 2 || childRecord.node.relationIgnored) return null;
        let best = null;

        for (const parentRecord of records) {
            if (parentRecord === childRecord || parentRecord.messages.length < 2) continue;
            if (parentRecord.node.createdAt > childRecord.node.createdAt + 5000) continue;

            const commonLength = commonPrefixLength(parentRecord.messages, childMessages);
            if (commonLength < 2) continue;
            let directPrevHits = 0;
            let sharedUserMessages = 0;
            if (childMessages[0].role === 'user') sharedUserMessages += 1;
            for (let index = 1; index < commonLength; index += 1) {
                if (childMessages[index].prevId === parentRecord.messages[index - 1].id) {
                    directPrevHits += 1;
                }
                if (childMessages[index].role === 'user') sharedUserMessages += 1;
            }
            if (directPrevHits < 1 && (commonLength < 4 || sharedUserMessages < 1)) continue;

            const score = directPrevHits * 1000000 + commonLength * 1000
                - Math.min(999, Math.abs(childRecord.node.createdAt - parentRecord.node.createdAt) / 1000000);
            if (!best || score > best.score) {
                best = {
                    parent: parentRecord,
                    commonLength,
                    directPrevHits,
                    score,
                };
            }
        }

        if (!best) return null;
        const forkMessage = best.parent.messages[best.commonLength - 1];
        let parentMessagesAtClone = 0;
        for (const message of best.parent.messages) {
            if (!message.createdAt || message.createdAt <= childRecord.node.createdAt + 5000) {
                parentMessagesAtClone += 1;
            }
        }
        parentMessagesAtClone ||= best.parent.messages.length;
        const kind = best.commonLength >= parentMessagesAtClone ? 'full' : 'partial';
        const excerpt = forkMessage.excerpt || (forkMessage.hasMedia ? 'Изображение' : '');
        return {
            parentId: best.parent.node.conversationId,
            forkMessageId: forkMessage.id,
            forkExcerpt: excerpt,
            kind,
        };
    }

    async function applyRecoveredRelations(characterId, histories, failedIds) {
        const checkedAt = Date.now();
        const records = [...histories.entries()].map(([conversationId, messages]) => ({
            node: findNode(activeGraph, conversationId),
            messages,
        })).filter((record) => record.node && record.messages.length);
        const recordsByPrefix = new Map();
        for (const record of records) {
            const prefix = historyPrefixKey(record.messages);
            if (!prefix) continue;
            if (!recordsByPrefix.has(prefix)) recordsByPrefix.set(prefix, []);
            recordsByPrefix.get(prefix).push(record);
        }
        const recovered = new Map();
        for (let index = 0; index < records.length; index += 1) {
            const childRecord = records[index];
            const node = childRecord.node;
            if (node.parentId && node.relationSource !== 'inferred') continue;
            const candidates = recordsByPrefix.get(historyPrefixKey(childRecord.messages)) || [];
            const inferred = inferParentForConversation(childRecord, candidates);
            if (inferred) recovered.set(node.conversationId, inferred);
            if (index > 0 && index % 16 === 0) await sleep(0);
        }

        let linked = 0;
        await updateGraph(characterId, (graph) => {
            for (const node of graph.nodes) {
                const loadedMessageCount = histories.get(node.conversationId)?.length || 0;
                if (loadedMessageCount > node.messageCount) node.messageCount = loadedMessageCount;
                if (failedIds.has(node.conversationId)) continue;
                const inference = recovered.get(node.conversationId);
                if (inference && !node.relationIgnored) {
                    upsertNode(graph, {
                        ...node,
                        ...inference,
                        relationSource: 'inferred',
                        relationCheckedAt: checkedAt,
                    });
                    linked += 1;
                    continue;
                }
                if (node.parentId && node.relationSource !== 'inferred') {
                    upsertNode(graph, { ...node, relationCheckedAt: checkedAt });
                    continue;
                }
                if (histories.has(node.conversationId)) {
                    upsertNode(graph, {
                        ...node,
                        parentId: null,
                        forkMessageId: null,
                        forkExcerpt: '',
                        kind: node.relationIgnored ? 'unlinked' : 'root',
                        relationSource: node.relationIgnored ? '' : 'inferred',
                        relationCheckedAt: checkedAt,
                    });
                }
            }
            return graph;
        });
        return linked;
    }

    function clearHistoryCacheForCharacter(characterId) {
        for (const key of historyCache.keys()) {
            if (key.startsWith(`${characterId}:`)) historyCache.delete(key);
        }
    }

    async function runRelationScan(manual = false) {
        if (relationScan?.running) {
            if (manual) {
                relationScan.cancelRequested = true;
                updateRelationScanStatus('Останавливаю поиск связей…');
            }
            return;
        }
        if (relationScanStarting) return;

        relationScanStarting = true;
        try {
            await ensureContext(true);
        } finally {
            relationScanStarting = false;
        }
        const characterId = activeContext?.characterId;
        if (!characterId) return;
        if (!hasApiAccess()) {
            setRelationScanUi(
                'Не вижу активную API-сессию. Перезагрузи чат или страницу Saved Chats и попробуй ещё раз.',
                0,
                false,
            );
            return;
        }

        clearHistoryCacheForCharacter(characterId);

        relationScan = {
            running: true,
            cancelRequested: false,
            phase: 'list',
            listPages: 0,
            fetchedMessages: 0,
            expectedMessages: 1,
            statusText: '',
        };
        const histories = new Map();
        setRelationScanUi('Подготавливаю список чатов…', 0, true);

        try {
            await fetchAllSavedConversations(characterId);
            await ensureContext(true);
            const nodes = (activeGraph?.nodes || []).slice()
                .sort((a, b) => a.createdAt - b.createdAt);
            relationScan.expectedMessages = Math.max(
                nodes.length,
                nodes.reduce((sum, node) => sum + Math.max(1, node.messageCount), 0),
            );
            const failedIds = new Set();

            for (let index = 0; index < nodes.length; index += 1) {
                if (relationScan.cancelRequested) break;
                const node = nodes[index];
                try {
                    histories.set(
                        node.conversationId,
                        await fetchConversationHistory(node, index + 1, nodes.length),
                    );
                } catch (error) {
                    failedIds.add(node.conversationId);
                    if (error?.status === 401 || error?.status === 403) throw error;
                }
                await sleep(70);
            }

            if (relationScan.cancelRequested) {
                relationScan.running = false;
                setRelationScanUi('Поиск связей остановлен.', relationScanPercent(), false);
                return;
            }

            relationScan.phase = 'infer';
            updateRelationScanStatus('Сравниваю цепочки сообщений…');
            const linked = await applyRecoveredRelations(characterId, histories, failedIds);
            relationScan.phase = 'done';
            relationScan.running = false;
            const failedText = failedIds.size ? ` · не удалось проверить: ${failedIds.size}` : '';
            setRelationScanUi(
                `Готово · восстановлено связей: ${linked}${failedText}`,
                100,
                false,
            );
        } catch (error) {
            relationScan.running = false;
            const text = error?.status === 401 || error?.status === 403
                ? 'Сессия SpicyChat устарела. Перезагрузи страницу и повтори.'
                : `Не удалось восстановить связи: ${error?.message || 'неизвестная ошибка'}`;
            setRelationScanUi(text, relationScanPercent(), false);
        } finally {
            histories.clear();
            clearHistoryCacheForCharacter(characterId);
        }
    }

    function scheduleAutomaticRelationScan() {
        if (autoScanTimer || relationScanStarting || relationScan?.running || dialog?.hidden !== false) return;
        if (!hasApiAccess() || !activeGraph || activeGraph.nodes.length < 2) return;
        const needsScan = activeGraph.nodes.some((node) => !node.relationCheckedAt);
        if (!needsScan) return;
        autoScanTimer = pageWindow.setTimeout(() => {
            autoScanTimer = null;
            if (dialog?.hidden === false) void runRelationScan(false);
        }, 180);
    }

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${DIALOG_ID}[hidden], #${EDITOR_ID}[hidden], #${POPOVER_ID}[hidden] {
                display: none !important;
            }

            #${DIALOG_ID} {
                position: fixed !important;
                inset: 0 !important;
                z-index: 10200 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 24px !important;
                background: rgba(0, 0, 0, 0.58) !important;
                backdrop-filter: blur(3px) !important;
                font-family: inherit !important;
            }

            .tm-sc-branches-shell {
                box-sizing: border-box !important;
                display: flex !important;
                flex-direction: column !important;
                width: min(980px, calc(100vw - 48px)) !important;
                height: min(780px, calc(100vh - 48px)) !important;
                overflow: hidden !important;
                color: #18181b !important;
                background: #f8f8fa !important;
                border: 1px solid rgba(24, 24, 27, 0.13) !important;
                border-radius: 18px !important;
                box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42) !important;
            }

            .dark .tm-sc-branches-shell {
                color: #f4f4f5 !important;
                background: #202024 !important;
                border-color: rgba(255, 255, 255, 0.12) !important;
            }

            .tm-sc-branches-header {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 18px !important;
                padding: 18px 20px 14px !important;
                border-bottom: 1px solid rgba(113, 113, 122, 0.18) !important;
            }

            .tm-sc-branches-heading { display: flex !important; align-items: baseline !important; gap: 9px !important; }
            .tm-sc-branches-title { margin: 0 !important; font-size: 22px !important; line-height: 1.2 !important; }
            .tm-sc-branches-count {
                min-width: 24px !important; padding: 2px 7px !important; text-align: center !important;
                color: #6d28d9 !important; background: rgba(124, 58, 237, 0.12) !important;
                border-radius: 999px !important; font-size: 12px !important; font-weight: 700 !important;
            }

            .tm-sc-branches-close, .tm-sc-branches-icon-button {
                width: 34px !important; height: 34px !important; padding: 0 !important;
                display: inline-flex !important; align-items: center !important; justify-content: center !important;
                color: inherit !important; background: transparent !important;
                border: 0 !important; border-radius: 9px !important; cursor: pointer !important;
            }
            .tm-sc-branches-close:hover, .tm-sc-branches-icon-button:hover { background: rgba(124, 58, 237, 0.13) !important; }
            .tm-sc-branches-icon-button.is-danger:hover { color: #ef4444 !important; background: rgba(239, 68, 68, 0.12) !important; }

            .tm-sc-branches-toolbar { padding: 13px 20px !important; border-bottom: 1px solid rgba(113, 113, 122, 0.14) !important; }
            .tm-sc-branches-toolbar-row { display: flex !important; align-items: center !important; gap: 9px !important; }
            .tm-sc-branches-search-wrap { position: relative !important; display: block !important; flex: 1 1 auto !important; min-width: 0 !important; }
            .tm-sc-branches-search-wrap > svg {
                position: absolute !important; left: 12px !important; top: 50% !important;
                transform: translateY(-50%) !important; color: #71717a !important; pointer-events: none !important;
            }
            .tm-sc-branches-search {
                box-sizing: border-box !important; width: 100% !important; height: 40px !important;
                padding: 0 13px 0 39px !important; color: inherit !important;
                background: rgba(113, 113, 122, 0.08) !important;
                border: 1px solid rgba(113, 113, 122, 0.18) !important;
                border-radius: 10px !important; outline: none !important; font: inherit !important;
            }
            .tm-sc-branches-search:focus { border-color: rgba(124, 58, 237, 0.72) !important; box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.13) !important; }
            .tm-sc-branches-scan-button {
                height: 40px !important; padding: 0 13px !important; flex: 0 0 auto !important;
                display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 7px !important;
                color: #fff !important; background: #7c3aed !important; border: 1px solid #7c3aed !important;
                border-radius: 10px !important; cursor: pointer !important; font: inherit !important; font-size: 12px !important; font-weight: 700 !important;
            }
            .tm-sc-branches-scan-button.is-running { color: inherit !important; background: transparent !important; border-color: rgba(124, 58, 237, .55) !important; }
            .tm-sc-branches-scan-button.is-running svg { animation: tm-sc-branches-spin 1s linear infinite !important; }
            .tm-sc-branches-scan-status { margin-top: 10px !important; }
            .tm-sc-branches-scan-status[hidden] { display: none !important; }
            .tm-sc-branches-scan-text { margin-bottom: 6px !important; color: #71717a !important; font-size: 11px !important; line-height: 1.35 !important; }
            .tm-sc-branches-progress-track {
                width: 100% !important; height: 5px !important; overflow: hidden !important;
                background: rgba(113, 113, 122, .16) !important; border-radius: 999px !important;
            }
            .tm-sc-branches-progress-bar {
                width: 0; height: 100% !important; background: #7c3aed !important; border-radius: inherit !important;
                transition: width 180ms ease !important;
            }
            .${SAVED_PAGE_BUTTON_CLASS} { white-space: nowrap !important; }
            @keyframes tm-sc-branches-spin { to { transform: rotate(360deg); } }

            .tm-sc-branches-content { flex: 1 1 auto !important; overflow: auto !important; padding: 18px 20px 28px !important; }
            .tm-sc-branches-section + .tm-sc-branches-section { margin-top: 24px !important; }
            .tm-sc-branches-section-title {
                margin: 0 0 10px !important; color: #71717a !important;
                font-size: 12px !important; font-weight: 750 !important; letter-spacing: .06em !important; text-transform: uppercase !important;
            }
            .tm-sc-branches-tree { display: flex !important; flex-direction: column !important; gap: 8px !important; }
            .tm-sc-branch-node {
                position: relative !important; min-width: 0 !important; max-width: 100% !important;
                margin-left: calc(var(--depth, 0) * 28px) !important;
            }
            .tm-sc-branch-node.is-child::before {
                content: "" !important; position: absolute !important; left: -17px !important; top: -9px !important;
                width: 14px !important; height: 31px !important; border-left: 2px solid rgba(124, 58, 237, 0.3) !important;
                border-bottom: 2px solid rgba(124, 58, 237, 0.3) !important; border-radius: 0 0 0 9px !important;
            }
            .tm-sc-branch-card {
                display: flex !important; align-items: center !important; gap: 9px !important;
                box-sizing: border-box !important; width: 100% !important; min-width: 0 !important; max-width: 100% !important;
                min-height: 68px !important; padding: 8px 9px !important; overflow: hidden !important;
                background: #ffffff !important; border: 1px solid rgba(113, 113, 122, 0.17) !important;
                border-radius: 12px !important; box-shadow: 0 3px 12px rgba(0, 0, 0, 0.045) !important;
            }
            .dark .tm-sc-branch-card { background: #29292e !important; border-color: rgba(255, 255, 255, 0.1) !important; }
            .tm-sc-branch-card.is-current { border-color: rgba(124, 58, 237, 0.8) !important; box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.13) !important; }
            .tm-sc-branch-toggle {
                width: 26px !important; height: 34px !important; padding: 0 !important; flex: 0 0 26px !important;
                display: inline-flex !important; align-items: center !important; justify-content: center !important;
                color: #71717a !important; background: transparent !important; border: 0 !important; cursor: pointer !important;
                transition: transform 140ms ease !important;
            }
            .tm-sc-branch-toggle.is-open { transform: rotate(90deg) !important; }
            .tm-sc-branch-toggle.is-empty { visibility: hidden !important; }
            .tm-sc-branch-kind-icon {
                width: 34px !important; height: 34px !important; flex: 0 0 34px !important;
                display: inline-flex !important; align-items: center !important; justify-content: center !important;
                color: #7c3aed !important; background: rgba(124, 58, 237, 0.11) !important; border-radius: 10px !important;
            }
            .tm-sc-branch-main {
                display: block !important; width: 0 !important; min-width: 0 !important; max-width: 100% !important;
                flex: 1 1 0% !important; padding: 3px 4px !important; overflow: hidden !important;
                text-align: left !important; white-space: normal !important;
                color: inherit !important; background: transparent !important; border: 0 !important; cursor: pointer !important;
            }
            .tm-sc-branch-name-row { display: flex !important; align-items: center !important; gap: 7px !important; min-width: 0 !important; }
            .tm-sc-branch-name { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; font-size: 14px !important; font-weight: 720 !important; }
            .tm-sc-branch-current {
                padding: 2px 6px !important; color: #6d28d9 !important; background: rgba(124, 58, 237, 0.13) !important;
                border-radius: 999px !important; font-size: 10px !important; font-weight: 750 !important; white-space: nowrap !important;
            }
            .tm-sc-branch-meta {
                display: flex !important; align-items: center !important; gap: 7px !important;
                min-width: 0 !important; max-width: 100% !important; margin-top: 4px !important; overflow: hidden !important;
                color: #71717a !important; font-size: 11px !important; line-height: 1.35 !important;
            }
            .tm-sc-branch-meta-text {
                min-width: 0 !important; overflow: hidden !important;
                text-overflow: ellipsis !important; white-space: nowrap !important;
            }
            .tm-sc-branch-message-count {
                display: inline-flex !important; align-items: center !important; gap: 3px !important;
                flex: 0 0 auto !important; white-space: nowrap !important;
            }
            .tm-sc-branch-message-count[hidden] { display: none !important; }
            .tm-sc-branch-message-count svg { width: 13px !important; height: 13px !important; }
            .tm-sc-branch-excerpt {
                display: block !important; box-sizing: border-box !important;
                width: 100% !important; min-width: 0 !important; max-width: 100% !important;
                overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important;
            }
            .tm-sc-branch-actions { display: flex !important; align-items: center !important; flex: 0 0 auto !important; }

            .tm-sc-branches-empty { padding: 60px 20px !important; text-align: center !important; color: #71717a !important; }

            #${EDITOR_ID} {
                position: fixed !important; inset: 0 !important; z-index: 10300 !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
                background: rgba(0, 0, 0, 0.46) !important; font-family: inherit !important;
            }
            .tm-sc-branches-editor-card {
                box-sizing: border-box !important; width: min(430px, calc(100vw - 30px)) !important;
                padding: 19px !important; color: #18181b !important; background: #fff !important;
                border-radius: 14px !important; box-shadow: 0 20px 65px rgba(0, 0, 0, .4) !important;
            }
            .dark .tm-sc-branches-editor-card { color: #f4f4f5 !important; background: #29292e !important; }
            .tm-sc-branches-editor-card h2 { margin: 0 0 13px !important; font-size: 18px !important; }
            .tm-sc-branches-editor-input {
                box-sizing: border-box !important; width: 100% !important; height: 42px !important; padding: 0 12px !important;
                color: inherit !important; background: rgba(113, 113, 122, 0.08) !important;
                border: 1px solid rgba(113, 113, 122, 0.3) !important; border-radius: 9px !important; outline: none !important; font: inherit !important;
            }
            .tm-sc-branches-editor-actions { display: flex !important; justify-content: flex-end !important; gap: 8px !important; margin-top: 14px !important; }
            .tm-sc-branches-editor-actions button {
                min-width: 92px !important; height: 38px !important; padding: 0 13px !important;
                border-radius: 9px !important; border: 1px solid rgba(113, 113, 122, 0.24) !important; cursor: pointer !important; font: inherit !important;
            }
            .tm-sc-branches-editor-cancel { color: inherit !important; background: transparent !important; }
            .tm-sc-branches-editor-save { color: #fff !important; background: #7c3aed !important; border-color: #7c3aed !important; }

            .${MARKER_CLASS} {
                position: relative !important; width: 26px !important; height: 26px !important; padding: 0 !important;
                display: inline-flex !important; align-items: center !important; justify-content: center !important; flex: 0 0 26px !important;
                color: #a78bfa !important; background: rgba(124, 58, 237, 0.13) !important;
                border: 1px solid rgba(167, 139, 250, 0.3) !important; border-radius: 8px !important;
                cursor: pointer !important; transition: background 120ms ease, color 120ms ease !important;
            }
            .${MARKER_CLASS}:hover { color: #fff !important; background: #7c3aed !important; }
            .tm-sc-branch-marker-count {
                position: absolute !important; right: -5px !important; top: -6px !important; min-width: 14px !important; height: 14px !important;
                padding: 0 3px !important; display: inline-flex !important; align-items: center !important; justify-content: center !important;
                color: #fff !important; background: #7c3aed !important; border: 2px solid #29292e !important;
                border-radius: 999px !important; font-size: 9px !important; font-weight: 800 !important; line-height: 1 !important;
            }

            #${POPOVER_ID} {
                position: fixed !important; z-index: 10350 !important; box-sizing: border-box !important;
                width: min(320px, calc(100vw - 20px)) !important; padding: 10px !important;
                color: #18181b !important; background: #fff !important; border: 1px solid rgba(113, 113, 122, .2) !important;
                border-radius: 11px !important; box-shadow: 0 14px 42px rgba(0, 0, 0, .3) !important; font-family: inherit !important;
            }
            .dark #${POPOVER_ID} { color: #f4f4f5 !important; background: #29292e !important; border-color: rgba(255, 255, 255, .12) !important; }
            .tm-sc-branch-popover-title { padding: 2px 4px 8px !important; color: #71717a !important; font-size: 11px !important; font-weight: 750 !important; text-transform: uppercase !important; }
            .tm-sc-branch-popover-item {
                width: 100% !important; padding: 9px !important; display: flex !important; align-items: center !important; gap: 8px !important;
                text-align: left !important; color: inherit !important; background: transparent !important; border: 0 !important; border-radius: 8px !important; cursor: pointer !important;
            }
            .tm-sc-branch-popover-item:hover { background: rgba(124, 58, 237, .13) !important; }
            .tm-sc-branch-popover-item span { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }

            @media (max-width: 640px) {
                .tm-sc-branches-toolbar-row { align-items: stretch !important; flex-direction: column !important; }
                .tm-sc-branches-scan-button { width: 100% !important; }
            }
        `;
        document.head.appendChild(style);
    }

    function cloneMenuButton(template) {
        const button = template.cloneNode(true);
        button.className = template.className;
        button.classList.remove(
            'tm-sc-open-message-bookmarks',
            'tm-sc-open-conversation-gallery',
            MENU_ITEM_CLASS,
        );
        button.classList.add(MENU_ITEM_CLASS);
        button.removeAttribute('target');
        button.disabled = false;
        button.type = 'button';
        button.setAttribute('aria-label', 'Ветки чатов');

        const oldIcon = button.querySelector('svg');
        if (oldIcon) oldIcon.outerHTML = icons.branches;
        else button.insertAdjacentHTML('afterbegin', icons.branches);
        const labels = Array.from(button.querySelectorAll('p, span'));
        if (labels[0]) labels[0].textContent = 'Ветки чатов';
        for (const extra of labels.slice(1)) extra.remove();
        return button;
    }

    function findChatMenu(dropdown) {
        const wrapper = dropdown?.parentElement;
        if (wrapper) {
            const sibling = dropdown.nextElementSibling;
            if (sibling?.querySelector('button[aria-label="View Saved Chats" i]')) return sibling;
            const nested = Array.from(wrapper.children).find((child) => (
                child !== dropdown && child.querySelector?.('button[aria-label="View Saved Chats" i]')
            ));
            if (nested) return nested;
        }

        const menus = Array.from(
            document.querySelectorAll('button[aria-label="View Saved Chats" i]'),
        ).map((button) => button.parentElement).filter((menu) => (
            menu
            && menu.querySelector('button[aria-label="Start New Chat" i]')
        ));
        const visible = menus.find((menu) => {
            const style = getComputedStyle(menu);
            const rect = menu.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden'
                && rect.width > 0 && rect.height > 0;
        });
        return visible || menus[0] || null;
    }

    function normalizeCustomChatMenuOrder(menu) {
        const desired = CHAT_MENU_ITEM_ORDER
            .map((className) => menu.querySelector(`.${className}`))
            .filter(Boolean);
        if (!desired.length) return;

        const currentPrefix = Array.from(menu.children).slice(0, desired.length);
        if (desired.every((item, index) => currentPrefix[index] === item)) return;

        const firstNative = Array.from(menu.children).find((item) => (
            !CHAT_MENU_ITEM_ORDER.some((className) => item.classList.contains(className))
        )) || null;
        for (const item of desired) menu.insertBefore(item, firstNative);
    }

    function ensureChatMenuItem() {
        for (const dropdown of document.querySelectorAll(CHAT_DROPDOWN_SELECTOR)) {
            const menu = findChatMenu(dropdown);
            if (!menu) continue;
            let button = menu.querySelector(`.${MENU_ITEM_CLASS}`);
            if (!button) {
                const template = menu.querySelector('.tm-sc-open-conversation-gallery')
                    || menu.querySelector('.tm-sc-open-message-bookmarks')
                    || menu.querySelector('button[aria-label="View Saved Chats" i]')
                    || menu.querySelector('button');
                if (!template) continue;
                button = cloneMenuButton(template);
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    dialogAnchor = dropdown;
                    dropdown.click();
                    window.setTimeout(() => void openDialog(dropdown), 0);
                });
                menu.insertBefore(button, menu.firstElementChild);
            }

            normalizeCustomChatMenuOrder(menu);
        }
    }

    function ensureSavedChatsTreeButton() {
        const context = getChatContext();
        if (context?.pageType !== 'saved') {
            if (savedPageButton?.isConnected) savedPageButton.remove();
            savedPageButton = null;
            return;
        }

        if (savedPageButton?.isConnected) return;
        const sortButton = document.querySelector('[data-testid="ChatsSortDropdown-Trigger"]');
        if (!sortButton?.parentElement) return;
        const existing = sortButton.parentElement.querySelector(`.${SAVED_PAGE_BUTTON_CLASS}`);
        if (existing) {
            savedPageButton = existing;
            return;
        }

        const button = sortButton.cloneNode(false);
        button.type = 'button';
        button.removeAttribute('data-testid');
        button.setAttribute('aria-label', 'Открыть дерево чатов');
        button.classList.add(SAVED_PAGE_BUTTON_CLASS);
        button.innerHTML = `${icons.branches}<span>Дерево</span>`;
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            void openDialog(button);
        });
        sortButton.before(button);
        savedPageButton = button;
    }

    function ensureDialog() {
        if (dialog?.isConnected) return dialog;
        dialog = document.createElement('div');
        dialog.id = DIALOG_ID;
        dialog.hidden = true;
        dialog.innerHTML = `
            <section class="tm-sc-branches-shell" role="dialog" aria-modal="true" aria-labelledby="tm-sc-branches-title">
                <header class="tm-sc-branches-header">
                    <div class="tm-sc-branches-heading">
                        <h2 id="tm-sc-branches-title" class="tm-sc-branches-title">Ветки чатов</h2>
                        <span class="tm-sc-branches-count"></span>
                    </div>
                    <button class="tm-sc-branches-close" type="button" aria-label="Закрыть">${icons.close}</button>
                </header>
                <div class="tm-sc-branches-toolbar">
                    <div class="tm-sc-branches-toolbar-row">
                        <label class="tm-sc-branches-search-wrap">
                            ${icons.search}
                            <input class="tm-sc-branches-search" type="search" placeholder="Найти ветку по названию…" autocomplete="off">
                        </label>
                        <button class="tm-sc-branches-scan-button" type="button" title="Повторно проверить старые чаты и восстановить связи">
                            ${icons.refresh}<span>Обновить связи</span>
                        </button>
                    </div>
                    <div class="tm-sc-branches-scan-status" hidden>
                        <div class="tm-sc-branches-scan-text"></div>
                        <div class="tm-sc-branches-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                            <div class="tm-sc-branches-progress-bar"></div>
                        </div>
                    </div>
                </div>
                <div class="tm-sc-branches-content">
                    <div class="tm-sc-branches-tree-root"></div>
                    <div class="tm-sc-branches-empty" hidden>Веток пока нет.</div>
                </div>
            </section>
        `;
        dialogTree = dialog.querySelector('.tm-sc-branches-tree-root');
        dialogCount = dialog.querySelector('.tm-sc-branches-count');
        dialogSearch = dialog.querySelector('.tm-sc-branches-search');
        dialogEmpty = dialog.querySelector('.tm-sc-branches-empty');
        dialogScanButton = dialog.querySelector('.tm-sc-branches-scan-button');
        dialogScanStatus = dialog.querySelector('.tm-sc-branches-scan-status');
        dialogScanStatusText = dialog.querySelector('.tm-sc-branches-scan-text');
        dialogScanProgress = dialog.querySelector('.tm-sc-branches-progress-bar');
        dialog.querySelector('.tm-sc-branches-close').addEventListener('click', closeDialog);
        dialogSearch.addEventListener('input', renderDialog);
        dialogScanButton.addEventListener('click', () => void runRelationScan(true));
        dialog.addEventListener('pointerdown', (event) => {
            if (event.target === dialog) closeDialog();
        });
        document.body.appendChild(dialog);
        return dialog;
    }

    function nodeKindLabel(node) {
        if (node.kind === 'full') return 'Полный клон';
        if (node.kind === 'partial') return 'Частичная ветка';
        if (node.kind === 'unlinked') return 'Без связи';
        return 'Новый сюжет';
    }

    function messageCountLabel(value) {
        const count = Math.max(0, Math.trunc(Number(value) || 0));
        const mod100 = count % 100;
        const mod10 = count % 10;
        const word = mod100 >= 11 && mod100 <= 14
            ? 'сообщений'
            : mod10 === 1
                ? 'сообщение'
                : mod10 >= 2 && mod10 <= 4
                    ? 'сообщения'
                    : 'сообщений';
        return `${count} ${word}`;
    }

    function nodeKindIcon(node) {
        if (node.kind === 'full') return icons.full;
        if (node.kind === 'partial') return icons.partial;
        if (node.kind === 'unlinked') return icons.orphan;
        return icons.root;
    }

    function navigateToConversation(node) {
        if (!node?.characterId || !node?.conversationId) return;
        closeDialog();
        closeMarkerPopover();
        const route = activeContext?.routeType || 'chat';
        pageWindow.location.assign(`/${route}/${node.characterId}/${node.conversationId}`);
    }

    function makeNodeElement(node, childrenMap, depth, query, rendered, path) {
        if (path.has(node.conversationId)) return null;
        const childNodes = (childrenMap.get(node.conversationId) || []).slice()
            .sort((a, b) => a.createdAt - b.createdAt);
        const nextPath = new Set(path);
        nextPath.add(node.conversationId);
        const normalizedQuery = query.toLocaleLowerCase();
        const selfMatches = !normalizedQuery || node.title.toLocaleLowerCase().includes(normalizedQuery);
        const descendantMatches = childNodes.some((child) => nodeOrDescendantMatches(child, childrenMap, normalizedQuery, nextPath));
        if (!selfMatches && !descendantMatches) return null;

        rendered.add(node.conversationId);
        const wrapper = document.createElement('div');
        wrapper.className = `tm-sc-branch-node${depth ? ' is-child' : ''}`;
        // Узлы вложены друг в друга, поэтому каждый уровень
        // добавляет ровно один шаг отступа.
        wrapper.style.setProperty('--depth', depth ? '1' : '0');

        const card = document.createElement('article');
        card.className = 'tm-sc-branch-card';
        if (activeContext?.conversationId === node.conversationId) card.classList.add('is-current');

        const collapsed = activeGraph?.collapsed.includes(node.conversationId) && !normalizedQuery;
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = `tm-sc-branch-toggle${collapsed ? '' : ' is-open'}${childNodes.length ? '' : ' is-empty'}`;
        toggle.setAttribute('aria-label', collapsed ? 'Развернуть ветку' : 'Свернуть ветку');
        toggle.innerHTML = icons.chevron;
        toggle.addEventListener('click', (event) => {
            event.stopPropagation();
            void toggleCollapsed(node.conversationId);
        });

        const kindIcon = document.createElement('span');
        kindIcon.className = 'tm-sc-branch-kind-icon';
        kindIcon.innerHTML = nodeKindIcon(node);

        const main = document.createElement('button');
        main.type = 'button';
        main.className = 'tm-sc-branch-main';
        main.innerHTML = `
            <span class="tm-sc-branch-name-row">
                <span class="tm-sc-branch-name"></span>
                ${activeContext?.conversationId === node.conversationId ? '<span class="tm-sc-branch-current">Текущий</span>' : ''}
            </span>
            <span class="tm-sc-branch-meta">
                <span class="tm-sc-branch-meta-text"></span>
                <span class="tm-sc-branch-message-count" hidden>
                    ${icons.messages}<span class="tm-sc-branch-message-count-value"></span>
                </span>
            </span>
            ${node.forkExcerpt ? '<span class="tm-sc-branch-meta tm-sc-branch-excerpt"></span>' : ''}
        `;
        main.querySelector('.tm-sc-branch-name').textContent = node.title;
        const date = formatMoscowDateTime(node.createdAt);
        main.querySelector('.tm-sc-branch-meta-text').textContent = [nodeKindLabel(node), date && `${date} МСК`].filter(Boolean).join(' · ');
        if (node.messageCount > 0) {
            const messageCount = main.querySelector('.tm-sc-branch-message-count');
            messageCount.hidden = false;
            messageCount.title = messageCountLabel(node.messageCount);
            messageCount.setAttribute('aria-label', messageCountLabel(node.messageCount));
            messageCount.querySelector('.tm-sc-branch-message-count-value').textContent = String(node.messageCount);
        }
        if (node.forkExcerpt) main.querySelector('.tm-sc-branch-excerpt').textContent = `От: ${node.forkExcerpt}`;
        main.addEventListener('click', () => navigateToConversation(node));

        const actions = document.createElement('div');
        actions.className = 'tm-sc-branch-actions';
        const rename = document.createElement('button');
        rename.type = 'button';
        rename.className = 'tm-sc-branches-icon-button';
        rename.title = 'Переименовать в дереве';
        rename.setAttribute('aria-label', 'Переименовать в дереве');
        rename.innerHTML = icons.pencil;
        rename.addEventListener('click', () => openEditor(node));
        actions.appendChild(rename);

        if (node.parentId) {
            const unlink = document.createElement('button');
            unlink.type = 'button';
            unlink.className = 'tm-sc-branches-icon-button is-danger';
            unlink.title = 'Отвязать от родительской ветки';
            unlink.setAttribute('aria-label', 'Отвязать от родительской ветки');
            unlink.innerHTML = icons.unlink;
            unlink.addEventListener('click', () => void unlinkNode(node));
            actions.appendChild(unlink);
        }

        card.append(toggle, kindIcon, main, actions);
        wrapper.appendChild(card);

        if (!collapsed || normalizedQuery) {
            for (const child of childNodes) {
                const childElement = makeNodeElement(child, childrenMap, depth + 1, query, rendered, nextPath);
                if (childElement) wrapper.appendChild(childElement);
            }
        } else {
            markDescendantsRendered(childNodes, childrenMap, rendered, nextPath);
        }
        return wrapper;
    }

    function markDescendantsRendered(nodes, childrenMap, rendered, path) {
        for (const node of nodes) {
            if (path.has(node.conversationId)) continue;
            rendered.add(node.conversationId);
            const nextPath = new Set(path);
            nextPath.add(node.conversationId);
            markDescendantsRendered(
                childrenMap.get(node.conversationId) || [],
                childrenMap,
                rendered,
                nextPath,
            );
        }
    }

    function nodeOrDescendantMatches(node, childrenMap, query, path) {
        if (!query) return true;
        if (path.has(node.conversationId)) return false;
        if (node.title.toLocaleLowerCase().includes(query)) return true;
        const nextPath = new Set(path);
        nextPath.add(node.conversationId);
        return (childrenMap.get(node.conversationId) || [])
            .some((child) => nodeOrDescendantMatches(child, childrenMap, query, nextPath));
    }

    function appendTreeSection(container, titleText, nodes, childrenMap, query, rendered) {
        if (!nodes.length) return;
        const section = document.createElement('section');
        section.className = 'tm-sc-branches-section';
        const title = document.createElement('h3');
        title.className = 'tm-sc-branches-section-title';
        title.textContent = titleText;
        const tree = document.createElement('div');
        tree.className = 'tm-sc-branches-tree';
        for (const node of nodes) {
            const element = makeNodeElement(node, childrenMap, 0, query, rendered, new Set());
            if (element) tree.appendChild(element);
        }
        if (!tree.childElementCount) return;
        section.append(title, tree);
        container.appendChild(section);
    }

    function renderDialog() {
        if (!dialogTree || !dialogCount || !dialogEmpty || !activeGraph) return;
        const nodes = activeGraph.nodes.slice();
        dialogCount.textContent = nodes.length ? String(nodes.length) : '';
        dialogTree.replaceChildren();

        const nodeMap = new Map(nodes.map((node) => [node.conversationId, node]));
        const childrenMap = new Map();
        for (const node of nodes) {
            if (!node.parentId || !nodeMap.has(node.parentId)) continue;
            if (!childrenMap.has(node.parentId)) childrenMap.set(node.parentId, []);
            childrenMap.get(node.parentId).push(node);
        }

        const roots = nodes.filter((node) => !node.parentId && node.kind !== 'unlinked')
            .sort((a, b) => b.createdAt - a.createdAt);
        const unlinked = nodes.filter((node) => (
            node.kind === 'unlinked' || (node.parentId && !nodeMap.has(node.parentId))
        )).sort((a, b) => b.createdAt - a.createdAt);
        const query = dialogSearch?.value.trim() || '';
        const rendered = new Set();

        appendTreeSection(dialogTree, 'Сюжеты', roots, childrenMap, query, rendered);
        appendTreeSection(
            dialogTree,
            'Без связи',
            unlinked.filter((node) => !rendered.has(node.conversationId)),
            childrenMap,
            query,
            rendered,
        );

        const leftovers = query
            ? []
            : nodes.filter((node) => !rendered.has(node.conversationId));
        appendTreeSection(dialogTree, 'Остальные', leftovers, childrenMap, query, rendered);
        dialogEmpty.hidden = dialogTree.childElementCount > 0;
        if (!dialogTree.childElementCount) {
            dialogEmpty.textContent = nodes.length && query
                ? 'По этому запросу ничего не найдено.'
                : 'Веток пока нет. Создай новый чат или клонируй текущий.';
        }
    }

    async function toggleCollapsed(conversationId) {
        if (!activeContext?.characterId) return;
        await updateGraph(activeContext.characterId, (graph) => {
            const collapsed = new Set(graph.collapsed);
            if (collapsed.has(conversationId)) collapsed.delete(conversationId);
            else collapsed.add(conversationId);
            graph.collapsed = [...collapsed];
            return graph;
        });
    }

    async function unlinkNode(node) {
        if (!activeContext?.characterId || !node?.parentId) return;
        const confirmed = confirm(
            `Отвязать «${node.title}» от родительской ветки?\n\nСам чат SpicyChat удалён не будет.`,
        );
        if (!confirmed) return;
        await updateGraph(activeContext.characterId, (graph) => {
            const current = findNode(graph, node.conversationId);
            if (current) {
                upsertNode(graph, {
                    ...current,
                    parentId: null,
                    forkMessageId: null,
                    forkExcerpt: '',
                    kind: 'unlinked',
                    relationIgnored: true,
                    relationSource: '',
                    relationCheckedAt: Date.now(),
                });
            }
            return graph;
        });
    }

    async function openDialog(anchor) {
        await ensureContext(true);
        if (!activeContext?.characterId) return;
        ensureDialog();
        dialogAnchor = anchor || dialogAnchor;
        dialog.hidden = false;
        renderDialog();
        scheduleAutomaticRelationScan();
        window.setTimeout(() => dialogSearch?.focus({ preventScroll: true }), 0);
    }

    function closeDialog() {
        if (!dialog) return;
        dialog.hidden = true;
        if (dialogSearch) dialogSearch.value = '';
    }

    function ensureEditor() {
        if (editor?.isConnected) return editor;
        editor = document.createElement('div');
        editor.id = EDITOR_ID;
        editor.hidden = true;
        editor.innerHTML = `
            <form class="tm-sc-branches-editor-card" novalidate>
                <h2>Название ветки</h2>
                <input class="tm-sc-branches-editor-input" type="text" maxlength="${TITLE_MAX_LENGTH}" autocomplete="off">
                <div class="tm-sc-branches-editor-actions">
                    <button class="tm-sc-branches-editor-cancel" type="button">Отмена</button>
                    <button class="tm-sc-branches-editor-save" type="submit">Сохранить</button>
                </div>
            </form>
        `;
        editorInput = editor.querySelector('.tm-sc-branches-editor-input');
        editor.querySelector('.tm-sc-branches-editor-cancel').addEventListener('click', closeEditor);
        editor.querySelector('form').addEventListener('submit', (event) => {
            event.preventDefault();
            void saveEditor();
        });
        editor.addEventListener('pointerdown', (event) => {
            if (event.target === editor) closeEditor();
        });
        document.body.appendChild(editor);
        return editor;
    }

    function openEditor(node) {
        ensureEditor();
        editorState = { characterId: node.characterId, conversationId: node.conversationId };
        editorInput.value = node.title;
        editor.hidden = false;
        requestAnimationFrame(() => {
            editorInput.focus({ preventScroll: true });
            editorInput.select();
        });
    }

    function closeEditor() {
        if (editor) editor.hidden = true;
        editorState = null;
    }

    async function saveEditor() {
        if (!editorState) return;
        const state = editorState;
        const title = normalizeTitle(editorInput.value);
        await updateGraph(state.characterId, (graph) => {
            const node = findNode(graph, state.conversationId);
            if (node) upsertNode(graph, { ...node, title });
            return graph;
        });
        closeEditor();
    }

    function childBranchesForMessage(messageId) {
        if (!activeContext?.conversationId || !activeGraph) return [];
        const normalizedId = String(messageId || '').replace(/^message-/, '');
        return activeGraph.nodes.filter((node) => (
            node.parentId === activeContext.conversationId
            && node.forkMessageId === normalizedId
        )).sort((a, b) => a.createdAt - b.createdAt);
    }

    function makeBranchMarker(messageId, branches, dropdown) {
        const marker = document.createElement('button');
        marker.type = 'button';
        marker.className = MARKER_CLASS;
        marker.dataset.messageId = messageId;
        marker.setAttribute('aria-label', `Ветки отсюда: ${branches.map((node) => node.title).join(', ')}`);
        marker.setAttribute('aria-expanded', 'false');
        marker.innerHTML = `${icons.branchSmall}<span class="tm-sc-branch-marker-count">${branches.length}</span>`;
        marker.addEventListener('mouseenter', () => {
            cancelPopoverClose();
            openMarkerPopover(marker, false);
        });
        marker.addEventListener('mouseleave', schedulePopoverClose);
        marker.addEventListener('focus', () => openMarkerPopover(marker, false));
        marker.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            markerPopoverPinned = !(markerPopoverMarker === marker && markerPopoverPinned);
            if (markerPopoverPinned) openMarkerPopover(marker, true);
            else closeMarkerPopover();
        });

        const bookmarkMarker = dropdown.parentElement?.querySelector('.tm-sc-message-bookmark-marker');
        (bookmarkMarker || dropdown).before(marker);
        return marker;
    }

    function ensureBranchMarkers() {
        if (!activeContext?.conversationId || !activeGraph) {
            document.querySelectorAll(`.${MARKER_CLASS}`).forEach((marker) => marker.remove());
            return;
        }

        for (const marker of document.querySelectorAll(`.${MARKER_CLASS}`)) {
            const branches = childBranchesForMessage(marker.dataset.messageId);
            const message = marker.closest(MESSAGE_SELECTOR);
            if (!branches.length || !message) marker.remove();
        }

        for (const message of document.querySelectorAll(MESSAGE_SELECTOR)) {
            const messageId = message.id.replace(/^message-/, '');
            const branches = childBranchesForMessage(messageId);
            if (!branches.length) continue;
            const dropdown = message.querySelector(MESSAGE_DROPDOWN_SELECTOR);
            if (!dropdown) continue;
            let marker = Array.from(message.querySelectorAll(`.${MARKER_CLASS}`)).find((candidate) => (
                candidate.dataset.messageId === messageId
            ));
            if (!marker) marker = makeBranchMarker(messageId, branches, dropdown);
            const label = `Ветки отсюда: ${branches.map((node) => node.title).join(', ')}`;
            if (marker.getAttribute('aria-label') !== label) marker.setAttribute('aria-label', label);
            const count = marker.querySelector('.tm-sc-branch-marker-count');
            const countText = String(branches.length);
            if (count.textContent !== countText) count.textContent = countText;
            const shouldHideCount = branches.length < 2;
            if (count.hidden !== shouldHideCount) count.hidden = shouldHideCount;
        }
    }

    function ensureMarkerPopover() {
        if (markerPopover?.isConnected) return markerPopover;
        markerPopover = document.createElement('div');
        markerPopover.id = POPOVER_ID;
        markerPopover.hidden = true;
        markerPopover.addEventListener('mouseenter', cancelPopoverClose);
        markerPopover.addEventListener('mouseleave', schedulePopoverClose);
        document.body.appendChild(markerPopover);
        return markerPopover;
    }

    function openMarkerPopover(marker, pinned) {
        const branches = childBranchesForMessage(marker.dataset.messageId);
        if (!branches.length) return;
        ensureMarkerPopover();
        markerPopoverMarker = marker;
        markerPopoverPinned = Boolean(pinned) || markerPopoverPinned;
        markerPopover.replaceChildren();

        const title = document.createElement('div');
        title.className = 'tm-sc-branch-popover-title';
        title.textContent = 'Ветки отсюда';
        markerPopover.appendChild(title);
        for (const node of branches) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'tm-sc-branch-popover-item';
            button.innerHTML = `${nodeKindIcon(node)}<span></span>`;
            button.querySelector('span').textContent = node.title;
            button.addEventListener('click', () => navigateToConversation(node));
            markerPopover.appendChild(button);
        }
        markerPopover.hidden = false;
        marker.setAttribute('aria-expanded', 'true');
        positionMarkerPopover(marker);
    }

    function positionMarkerPopover(marker) {
        if (!markerPopover || markerPopover.hidden || !marker?.isConnected) return;
        const rect = marker.getBoundingClientRect();
        const width = Math.min(320, window.innerWidth - 20);
        const height = markerPopover.offsetHeight || 110;
        const left = Math.max(10, Math.min(window.innerWidth - width - 10, rect.right - width));
        const below = rect.bottom + 7;
        const top = below + height <= window.innerHeight - 10
            ? below
            : Math.max(10, rect.top - height - 7);
        markerPopover.style.left = `${Math.round(left)}px`;
        markerPopover.style.top = `${Math.round(top)}px`;
    }

    function cancelPopoverClose() {
        if (!markerPopoverCloseTimer) return;
        clearTimeout(markerPopoverCloseTimer);
        markerPopoverCloseTimer = null;
    }

    function schedulePopoverClose() {
        cancelPopoverClose();
        if (markerPopoverPinned) return;
        markerPopoverCloseTimer = window.setTimeout(closeMarkerPopover, 180);
    }

    function closeMarkerPopover() {
        cancelPopoverClose();
        if (markerPopoverMarker?.isConnected) markerPopoverMarker.setAttribute('aria-expanded', 'false');
        if (markerPopover) markerPopover.hidden = true;
        markerPopoverMarker = null;
        markerPopoverPinned = false;
    }

    async function ensureContext(force = false) {
        const next = getChatContext();
        if (!force && next?.key === activeContext?.key && activeGraph) return activeGraph;

        const token = ++contextToken;
        activeContext = next;
        activeGraph = null;
        closeMarkerPopover();
        document.querySelectorAll(`.${MARKER_CLASS}`).forEach((marker) => marker.remove());
        if (!next?.characterId) {
            closeDialog();
            return null;
        }

        activeGraph = await readGraph(next.characterId);
        if (token !== contextToken || activeContext?.key !== next.key) return;

        if (next.conversationId && !findNode(activeGraph, next.conversationId)) {
            activeGraph = await updateGraph(next.characterId, (graph) => {
                if (findNode(graph, next.conversationId)) return graph;
                upsertNode(graph, {
                    conversationId: next.conversationId,
                    characterId: next.characterId,
                    title: makeDefaultTitle(graph.nodes.length ? 'unlinked' : 'root'),
                    parentId: null,
                    forkMessageId: null,
                    forkExcerpt: '',
                    kind: graph.nodes.length ? 'unlinked' : 'root',
                    createdAt: Date.now(),
                    relationCheckedAt: 0,
                });
                return graph;
            });
        }

        if (token !== contextToken || activeContext?.key !== next.key) return;
        renderDialog();
        ensureBranchMarkers();
        scheduleAutomaticRelationScan();
        return activeGraph;
    }

    function scheduleEnsure() {
        if (ensureScheduled) return;
        ensureScheduled = true;
        requestAnimationFrame(runDomPass);
    }

    function isOwnBranchMutation(node) {
        const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
        return Boolean(element?.closest?.(
            `#${DIALOG_ID}, #${EDITOR_ID}, #${POPOVER_ID}, .${MARKER_CLASS}`,
        ));
    }

    function nodeTouchesBranchSurface(node, includeDescendants = true) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE || isOwnBranchMutation(node)) return false;
        const selector = [
            MESSAGE_SELECTOR,
            MESSAGE_DROPDOWN_SELECTOR,
            CHAT_DROPDOWN_SELECTOR,
            'button[aria-label="View Saved Chats" i]',
            '[data-testid="ChatsSortDropdown-Trigger"]',
        ].join(', ');
        return (
            node.matches?.(selector)
            || (includeDescendants && Boolean(node.querySelector?.(selector)))
        );
    }

    function handleRootMutations(records) {
        const relevant = records.some((record) => {
            if (isOwnBranchMutation(record.target)) return false;
            return (
                nodeTouchesBranchSurface(record.target, false)
                || Array.from(record.addedNodes).some((node) => nodeTouchesBranchSurface(node, true))
                || Array.from(record.removedNodes).some((node) => nodeTouchesBranchSurface(node, true))
            );
        });
        if (relevant) scheduleEnsure();
    }

    function handleKeydown(event) {
        if (event.key !== 'Escape') return;
        if (editor && !editor.hidden) {
            event.preventDefault();
            closeEditor();
        } else if (markerPopover && !markerPopover.hidden) {
            event.preventDefault();
            closeMarkerPopover();
        } else if (dialog && !dialog.hidden) {
            event.preventDefault();
            closeDialog();
        }
    }

    function scheduleRetry() {
        if (retryTimer) return;
        const delay = retryDelay;
        retryDelay = Math.min(8000, retryDelay * 2);
        retryTimer = window.setTimeout(() => {
            retryTimer = null;
            runDomPass();
        }, delay);
    }

    function resetRetry() {
        if (retryTimer) window.clearTimeout(retryTimer);
        retryTimer = null;
        retryDelay = 250;
    }

    function runDomPass() {
        ensureScheduled = false;
        if (!document.documentElement || !document.head || !document.body) return;

        try {
            addStyles();
            ensureDialog();
            ensureEditor();
            ensureMarkerPopover();
            ensureChatMenuItem();
            ensureSavedChatsTreeButton();

            if (!rootObserver) {
                rootObserver = new MutationObserver(handleRootMutations);
                rootObserver.observe(document.documentElement, { childList: true, subtree: true });
            }
            document.addEventListener('keydown', handleKeydown, true);
            resetRetry();
        } catch (error) {
            rootObserver?.disconnect();
            rootObserver = null;
            document.removeEventListener('keydown', handleKeydown, true);
            console.error('[Chat Branches] DOM-инициализация сорвалась, повторю автоматически.', error);
            scheduleRetry();
            return;
        }

        const lifecycleToken = domLifecycleToken;
        void ensureContext().then(() => {
            if (
                lifecycleToken !== domLifecycleToken
                || typeof document === 'undefined'
                || !document.documentElement
            ) return;
            ensureChatMenuItem();
            ensureSavedChatsTreeButton();
            ensureBranchMarkers();
        }).catch((error) => {
            console.error('[Chat Branches] Контекст не загрузился, повторю автоматически.', error);
        });
    }

    function startDomFeatures() {
        runDomPass();
    }

    function cleanup() {
        domLifecycleToken += 1;
        rootObserver?.disconnect();
        rootObserver = null;
        ensureScheduled = false;
        resetRetry();
        if (autoScanTimer) window.clearTimeout(autoScanTimer);
        autoScanTimer = null;
        if (relationScan?.running) relationScan.cancelRequested = true;
        document.removeEventListener('keydown', handleKeydown, true);
    }

    installNetworkCapture();
    installRouteChangeSignal();
    window.addEventListener('pagehide', cleanup);
    window.addEventListener(ROUTE_CHANGE_EVENT, startDomFeatures);
    window.addEventListener('pageshow', startDomFeatures);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) startDomFeatures();
    });
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startDomFeatures, { once: true });
    }
    startDomFeatures();
}
