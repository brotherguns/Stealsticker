import { React } from "@vendetta/metro/common";
import { after, before, instead } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import { General } from "@vendetta/ui/components";
import { LazyActionSheet, messageUtil, SelectedChannelStore } from "../modules";
import StickerButtons from "../ui/components/StickerButtons";
import openMediaModal from "../lib/utils/openMediaModal";
import { getStickerUrl } from "../lib/utils/getStickerUrl";
import { findByProps } from "@vendetta/metro";

var { TouchableOpacity } = General;

var DEBUG = true;
function dbg(...parts: any[]) {
    if (!DEBUG) return;
    try {
        var channelId = SelectedChannelStore?.getChannelId?.();
        if (channelId && messageUtil?.sendBotMessage) {
            messageUtil.sendBotMessage(
                channelId,
                "```\n[SS] " + parts.map(String).join(" ") + "\n```"
            );
        }
    } catch (_) {}
}

var DirectSheet =
    findByProps("StickerDetails") ??
    findByProps("stickerActionSheet") ??
    findByProps("StickerActionSheet");

export default function patchMessageStickerActionSheet() {
    dbg("v4 loaded");

    if (DirectSheet) {
        dbg("Using DirectSheet path");
        return patchSheet("default", DirectSheet);
    }

    if (!LazyActionSheet?.openLazy) {
        dbg("FATAL: no openLazy");
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
            if (!nameLower.includes("sticker")) {
                return originalOpenLazy.apply(this, args);
            }

            dbg("Intercepted:", name);

            var sticker: StickerNode | undefined =
                context?.renderableSticker ??
                context?.sticker ??
                context?.stickerNode;

            dbg("Sticker:", sticker ? sticker.name + " #" + sticker.id : "NULL");

            if (!lazySheet || typeof lazySheet.then !== "function") {
                return originalOpenLazy.apply(this, args);
            }

            var patchedPromise = lazySheet.then(function(module: any) {
                var target = module.default;
                dbg("module.default type:", typeof target);

                if (typeof target === "object" && target !== null) {
                    dbg("module.default keys:", Object.keys(target).join(", "));
                    // React internals: $$typeof tells us what wrapper this is
                    var typeofSym = target["$$typeof"];
                    if (typeofSym) dbg("$$typeof:", String(typeofSym));
                }

                // ── Find the actual render function inside the wrapper ──
                // React.memo     → { $$typeof: Symbol(react.memo),        type: fn }
                // React.forwardRef → { $$typeof: Symbol(react.forward_ref), render: fn }
                // Plain function → fn itself
                // Nested memo(forwardRef(...)) → { type: { render: fn } }

                var renderFn: Function | null = null;
                var renderHost: any = null;   // the object that holds the fn
                var renderKey: string = "";   // the property name

                if (typeof target === "function") {
                    renderFn = target;
                    renderHost = module;
                    renderKey = "default";
                } else if (typeof target === "object" && target !== null) {
                    if (typeof target.type === "function") {
                        // React.memo(Component)
                        renderFn = target.type;
                        renderHost = target;
                        renderKey = "type";
                        dbg("Found render fn on .type (React.memo)");
                    } else if (typeof target.render === "function") {
                        // React.forwardRef(Component)
                        renderFn = target.render;
                        renderHost = target;
                        renderKey = "render";
                        dbg("Found render fn on .render (React.forwardRef)");
                    } else if (typeof target.type === "object" && target.type !== null) {
                        // memo(forwardRef(...)) → type is the forwardRef object
                        if (typeof target.type.render === "function") {
                            renderFn = target.type.render;
                            renderHost = target.type;
                            renderKey = "render";
                            dbg("Found render fn on .type.render (memo+forwardRef)");
                        } else if (typeof target.type.type === "function") {
                            renderFn = target.type.type;
                            renderHost = target.type;
                            renderKey = "type";
                            dbg("Found render fn on .type.type (double memo)");
                        }
                    }

                    // Last resort: scan all keys for a function
                    if (!renderFn) {
                        for (var k of Object.keys(target)) {
                            if (typeof target[k] === "function") {
                                renderFn = target[k];
                                renderHost = target;
                                renderKey = k;
                                dbg("Found render fn on ." + k + " (scan)");
                                break;
                            }
                        }
                    }
                }

                if (!renderFn || !renderHost) {
                    dbg("Could not find render function, giving up");
                    return module;
                }

                dbg("Patching", renderKey, "on host");

                var OriginalRender = renderFn;
                renderHost[renderKey] = function PatchedStickerRender() {
                    dbg(">>> PatchedStickerRender CALLED");

                    var res: any;
                    try {
                        res = OriginalRender.apply(this, arguments);
                    } catch (e: any) {
                        dbg("Original threw:", e?.message);
                        throw e;
                    }

                    var props = arguments[0] ?? {};
                    var finalSticker: StickerNode | undefined =
                        sticker ??
                        props?.renderableSticker ??
                        props?.sticker ??
                        props?.stickerNode;

                    dbg("Sticker:", finalSticker ? finalSticker.name : "NULL");

                    if (finalSticker && res) {
                        try {
                            injectButtons(res, finalSticker);
                        } catch (e: any) {
                            dbg("injectButtons error:", e?.message);
                        }
                    }

                    return res;
                };

                return module;
            });

            return originalOpenLazy.call(this, patchedPromise, name, context);
        }
    );

    patches.push(unpatchLazy);
    return function() { patches.forEach(function(p) { p?.(); }); };
}

// ── Button injection strategies ──────────────────────────────────────
function injectButtons(res: any, sticker: StickerNode) {
    if (!res) {
        dbg("inject: res null");
        return;
    }

    var stickerUrl = getStickerUrl(sticker);
    dbg("inject: res.type =", res?.type?.name ?? res?.type?.displayName ?? typeof res?.type);

    // Strategy 1: nested view.type (Stealmoji pattern)
    var view = res?.props?.children?.props?.children;
    if (view && typeof view === "object" && view.type) {
        dbg("S1: patching nested view.type");
        var unpatchView = after("type", view, function(_: any, component: any) {
            React.useEffect(function() { return unpatchView; }, []);
            dbg("S1: view rendered");
            addButtonsToComponent(component, sticker, stickerUrl);
        });
        return;
    }

    // Strategy 2: res.type is a function we can wrap
    if (res?.type && typeof res.type === "function") {
        dbg("S2: wrapping res.type");
        var origType = res.type;
        res.type = function() {
            var component = origType.apply(this, arguments);
            dbg("S2: rendered");
            addButtonsToComponent(component, sticker, stickerUrl);
            return component;
        };
        try { Object.assign(res.type, origType); } catch (_) {}
        return;
    }

    // Strategy 3: children is a render function
    if (typeof res?.props?.children === "function") {
        dbg("S3: wrapping render prop");
        var origRender = res.props.children;
        res.props.children = function() {
            var rendered = origRender.apply(this, arguments);
            dbg("S3: rendered");
            appendToTree(rendered, <StickerButtons sticker={sticker} />);
            return rendered;
        };
        return;
    }

    // Strategy 4: brute append
    dbg("S4: brute append");
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
        dbg("Spliced after button idx", btnIdx);
    } else {
        dbg("No button found, appending");
        appendToTree(component, el);
    }
}

function appendToTree(tree: any, element: any) {
    if (!tree) return;
    if (Array.isArray(tree?.props?.children)) {
        tree.props.children.push(element);
        dbg("append: pushed to children[]");
    } else if (tree?.props?.children != null) {
        tree.props.children = [tree.props.children, element];
        dbg("append: wrapped+appended");
    } else if (tree?.props) {
        tree.props.children = element;
        dbg("append: set sole child");
    } else if (Array.isArray(tree)) {
        tree.push(element);
        dbg("append: pushed to array");
    } else {
        dbg("append: nowhere to put it");
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
