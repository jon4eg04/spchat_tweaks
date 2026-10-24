// Narrow adapter for the native quick-model row contract supplied from the page.
// Component names and React's randomized expando suffix are deliberately ignored.
export function createNativeModelAdapter() {
    const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    return {
        read(row, expected) {
            if (!row || !expected) return null;
            try {
                // Firefox userscript Xrays hide React's page-owned expandos.
                const node = row.wrappedJSObject || row;
                const keys = Object.keys(node);
                const propsKey = keys.find(key => key.startsWith('__reactProps$'));
                const fiberKey = keys.find(key => key.startsWith('__reactFiber$'));
                const onClick = node[propsKey]?.onClick;
                if (typeof onClick !== 'function') return null;
                let fiber = node[fiberKey];
                for (let depth = 0; fiber && depth < 12; depth++, fiber = fiber.return) {
                    // A DOM expando can retain the alternate after a React commit.
                    // X forwards wd's onClick unchanged, so the live host props
                    // identify the committed row without relying on fiber names.
                    for (const current of [fiber, fiber.alternate]) {
                        const props = current?.memoizedProps;
                        if (props?.model?.id !== expected.id || props.model.name !== expected.label) continue;
                        if (current.child?.memoizedProps?.onClick !== onClick) continue;
                        if (props.action || props.isLocked || props.model.isDisabled) return null;
                        if (typeof props.clickHandler !== 'function' || typeof props.activeModel !== 'string') return null;
                        return {
                            activeModel: props.activeModel,
                            select(model) {
                                // Pass a page-realm object: the page must not read
                                // privileged userscript objects through Firefox Xrays.
                                const value = new page.Object();
                                value.id = model.id;
                                value.name = model.label;
                                props.clickHandler(value);
                            },
                        };
                    }
                }
            } catch (error) {
                console.warn('[SpicyChat Tools] Не удалось прочитать обработчик выбора модели.', error);
            }
            return null;
        },
    };
}
