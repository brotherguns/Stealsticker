import { React } from "@vendetta/metro/common";
import { after, instead } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import { General } from "@vendetta/ui/components";
import { LazyActionSheet } from "../modules";
import StickerButtons from "../ui/components/StickerButtons";
import openMediaModal from "../lib/utils/openMediaModal";
import { getStickerUrl } from "../lib/utils/getStickerUrl";
import { findByProps } from "@vendetta/metro";

var { TouchableOpacity } = General;

var _patchedModules = new WeakSet();

var DirectSheet =
    findByProps("StickerDetails") ??
    findByProps("stickerActionSheet") ??
    findByProps("StickerActionSheet");

export default function patchMessageStickerActionSheet() {
    if (DirectSheet) {
        return patchSheet("default", DirectSheet);
    }

    if (!LazyActionSheet?.openLazy) {
        return function() {};
    }

    var patches: (() => void)[] = [];

    var unpatchLazy = instead(
        "openLazy",
        LazyActionSheet,
        function(args: any[], originalOpenLazy: Function) {
            var lazySheet = args[0];
            var name: string = args[1] ?? "";
            var context: any = args[2];

            var nameLower = (name || "").toLowerCase();
            if (!nameLower.includes("sticker") || nameLower.includes("addtoserver")) {
                return originalOpenLazy.apply(this, args);
            }

            var sticker: StickerNode | undefined =
                context?.renderableSticker ??
                context?.sticker ??
                context?.stickerNode;

            if (!lazySheet || typeof lazySheet.then !== "function") {
                return originalOpenLazy.apply(this, args);
            }

            var patchedPromise = lazySheet.then(function(module: any) {
                var target = module.default;

                if (_patchedModules.has(module)) {
                    if (module._ssCurrentSticker !== undefined) {
                        module._ssCurrentSticker = sticker;
                    }
                    return module;
                }

                var renderFn: Function | null = null;
                var renderHost: any = null;
                var renderKey: string = "";

                if (typeof target === "function") {
                    renderFn = target;
                    renderHost = module;
                    renderKey = "default";
                } else if (typeof target === "object" && target !== null) {
                    if (typeof target.type === "function") {
                        renderFn = target.type;
                        renderHost = target;
                        renderKey = "type";
                    } else if (typeof target.render === "function") {
                        renderFn = target.render;
                        renderHost = target;
                        renderKey = "render";
                    } else if (typeof target.type === "object" && target.type !== null) {
                        if (typeof target.type.render === "function") {
                            renderFn = target.type.render;
                            renderHost = target.type;
                            renderKey = "render";
                        } else if (typeof target.type.type === "function") {
                            renderFn = target.type.type;
                            renderHost = target.type;
                            renderKey = "type";
                        }
                    }
                    if (!renderFn) {
                        for (var k of Object.keys(target)) {
                            if (typeof target[k] === "function") {
                                renderFn = target[k];
                                renderHost = target;
                                renderKey = k;
                                break;
                            }
                        }
                    }
                }

                if (!renderFn || !renderHost) {
                    return module;
                }

                module._ssCurrentSticker = sticker;

                var OriginalRender = renderFn;
                renderHost[renderKey] = function PatchedStickerRender() {
                    var res: any;
                    try {
                        res = OriginalRender.apply(this, arguments);
                    } catch (e: any) {
                        throw e;
                    }

                    var props = arguments[0] ?? {};
                    var finalSticker: StickerNode | undefined =
                        module._ssCurrentSticker ??
                        props?.renderableSticker ??
                        props?.sticker ??
                        props?.stickerNode;

                    if (finalSticker && res) {
                        try {
                            injectButtons(res, finalSticker);
                        } catch (_) {}
                    }

                    return res;
                };

                _patchedModules.add(module);
                return module;
            });

            return originalOpenLazy.call(this, patchedPromise, name, context);
        }
    );

    patches.push(unpatchLazy);
    return function() { patches.forEach(function(p) { p?.(); }); };
}

function injectButtons(res: any, sticker: StickerNode) {
    if (!res) return;
    if (res._ssInjected) return;
    res._ssInjected = true;

    var stickerUrl = getStickerUrl(sticker);

    var view = res?.props?.children?.props?.children;
    if (view && typeof view === "object" && typeof view.type === "function") {
        var unpatchView = after("type", view, function(_: any, component: any) {
            React.useEffect(function() { return unpatchView; }, []);
            addButtonsToComponent(component, sticker, stickerUrl);
        });
        return;
    }

    if (res?.type && typeof res.type === "function") {
        var origType = res.type;
        res.type = function() {
            var component = origType.apply(this, arguments);
            addButtonsToComponent(component, sticker, stickerUrl);
            return component;
        };
        try { Object.assign(res.type, origType); } catch (_) {}
        return;
    }

    if (typeof res?.props?.children === "function") {
        var origRender = res.props.children;
        res.props.children = function() {
            var rendered = origRender.apply(this, arguments);
            appendToTree(rendered, <StickerButtons sticker={sticker} />);
            return rendered;
        };
        return;
    }

    appendToTree(res, <StickerButtons sticker={sticker} />);
}

function addButtonsToComponent(component: any, sticker: StickerNode, stickerUrl: string | null) {
    if (stickerUrl) {
        var isIcon = function(c: any) { return c?.props?.source?.uri; };
        var iconContainer = findInReactTree(component, function(c: any) { return c?.find?.(isIcon); });
        var iconIdx = iconContainer?.findIndex?.(isIcon) ?? -1;
        if (iconIdx >= 0) {
            iconContainer[iconIdx] = (
                <TouchableOpacity onPress={() => openMediaModal(stickerUrl.split("?")[0])}>
                    {iconContainer[iconIdx]}
                </TouchableOpacity>
            );
        }
    }

    var isButton = function(c: any) {
        var n = c?.type?.name ?? c?.type?.displayName ?? "";
        return n === "Button" || n === "CompatButton";
    };
    var btnContainer = findInReactTree(component, function(c: any) { return c?.find?.(isButton); });
    var btnIdx = btnContainer?.findLastIndex?.(isButton) ?? -1;
    var el = <StickerButtons sticker={sticker} />;

    if (btnIdx >= 0) {
        btnContainer.splice(btnIdx + 1, 0, el);
    } else {
        appendToTree(component, el);
    }
}

function appendToTree(tree: any, element: any) {
    if (!tree) return;
    if (Array.isArray(tree?.props?.children)) {
        tree.props.children.push(element);
    } else if (tree?.props?.children != null) {
        tree.props.children = [tree.props.children, element];
    } else if (tree?.props) {
        tree.props.children = element;
    } else if (Array.isArray(tree)) {
        tree.push(element);
    }
}

function patchSheet(funcName: string, sheetModule: any) {
    return after(funcName, sheetModule, function(callArgs: any[], res: any) {
        var props = callArgs[0] ?? {};
        var s: StickerNode | undefined = props?.sticker ?? props?.stickerNode ?? props?.renderableSticker;
        if (!s) return;
        injectButtons(res, s);
    });
}
