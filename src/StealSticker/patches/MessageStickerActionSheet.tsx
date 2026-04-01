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

// ── Debug helper — sends a Clyde message only you can see ────────────
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

// Direct-module approach (older builds)
var DirectSheet =
    findByProps("StickerDetails") ??
    findByProps("stickerActionSheet") ??
    findByProps("StickerActionSheet");

export default function patchMessageStickerActionSheet() {
    dbg("v3 loaded");
    dbg("LazyActionSheet:", LazyActionSheet ? "FOUND" : "NULL");
    dbg("DirectSheet:", DirectSheet ? "FOUND" : "NULL");

    if (DirectSheet) {
        dbg("Using DirectSheet path");
        return patchSheet("default", DirectSheet);
    }

    if (!LazyActionSheet?.openLazy) {
        dbg("FATAL: no openLazy");
        return function() {};
    }

    var patches: (() => void)[] = [];

    // Use `instead` so we fully control what openLazy receives.
    // No ambiguity about args mutation — we call the original ourselves.
    var unpatchLazy = instead(
        "openLazy",
        LazyActionSheet,
        function(args: any[], originalOpenLazy: Function) {
            var lazySheet = args[0];
            var name: string = args[1] ?? "";
            var context: any = args[2];

            var nameLower = (name || "").toLowerCase();
            if (!nameLower.includes("sticker")) {
                // Not a sticker sheet — pass through untouched
                return originalOpenLazy.apply(this, args);
            }

            dbg("Intercepted:", name);
            if (context) dbg("Context keys:", Object.keys(context).join(", "));

            // Extract sticker from context
            var sticker: StickerNode | undefined =
                context?.renderableSticker ??
                context?.sticker ??
                context?.stickerNode ??
                context?.data?.sticker;

            dbg("Sticker:", sticker ? sticker.name + " #" + sticker.id : "NULL");

            if (!lazySheet || typeof lazySheet.then !== "function") {
                dbg("lazySheet not a promise, passing through");
                return originalOpenLazy.apply(this, args);
            }

            // Chain onto the promise: wrap module.default BEFORE openLazy gets it
            var patchedPromise = lazySheet.then(function(module: any) {
                dbg("Module resolved, keys:", Object.keys(module).join(", "));

                var Original = module.default;
                if (typeof Original !== "function") {
                    dbg("module.default not a function:", typeof Original);
                    return module;
                }

                dbg("Wrapping module.default");

                // Replace in-place
                module.default = function PatchedStickerSheet() {
                    dbg(">>> PatchedStickerSheet CALLED");

                    var res: any;
                    try {
                        res = Original.apply(this, arguments);
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

                    dbg("Sticker resolved:", finalSticker ? finalSticker.name : "NULL");

                    if (finalSticker && res) {
                        try {
                            injectButtons(res, finalSticker);
                        } catch (e: any) {
                            dbg("injectButtons error:", e?.message);
                        }
                    }

                    return res;
                };

                // Copy statics
                try {
                    Object.keys(Original).forEach(function(k) { module.default[k] = Original[k]; });
                    if (Original.name) module.default.displayName = Original.name;
                } catch (_) {}

                return module;
            });

            // Call original openLazy with OUR patched promise
            return originalOpenLazy.call(this, patchedPromise, name, context);
        }
    );

    patches.push(unpatchLazy);
    return function() { patches.forEach(function(p) { p?.(); }); };
}

// ── Button injection ─────────────────────────────────────────────────
function injectButtons(res: any, sticker: StickerNode) {
    if (!res) {
        dbg("inject: res null");
        return;
    }

    var stickerUrl = getStickerUrl(sticker);
    dbg("inject: type=", res?.type?.name ?? res?.type?.displayName ?? typeof res?.type);

    // ── Strategy 1: nested view with .type (matches Stealmoji pattern) ──
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

    // ── Strategy 2: res.type is a patchable function ────────────────
    if (res?.type && typeof res.type === "function") {
        dbg("S2: wrapping res.type");
        var origType = res.type;
        res.type = function() {
            var component = origType.apply(this, arguments);
            dbg("S2: res.type rendered");
            addButtonsToComponent(component, sticker, stickerUrl);
            return component;
        };
        try { Object.assign(res.type, origType); } catch (_) {}
        return;
    }

    // ── Strategy 3: children render prop ─────────────────────────────
    if (typeof res?.props?.children === "function") {
        dbg("S3: wrapping render prop");
        var origRender = res.props.children;
        res.props.children = function() {
            var rendered = origRender.apply(this, arguments);
            dbg("S3: render prop called");
            appendToTree(rendered, <StickerButtons sticker={sticker} />);
            return rendered;
        };
        return;
    }

    // ── Strategy 4: brute append ─────────────────────────────────────
    dbg("S4: brute append to res");
    appendToTree(res, <StickerButtons sticker={sticker} />);
}

function addButtonsToComponent(component: any, sticker: StickerNode, stickerUrl: string | null) {
    // Make sticker icon tappable for media modal
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

    // Find existing buttons and splice ours after
    var isButton = function(c: any) {
        var n = c?.type?.name ?? c?.type?.displayName ?? "";
        return n === "Button" || n === "CompatButton";
    };
    var btnContainer = findInReactTree(component, function(c: any) { return c?.find?.(isButton); });
    var btnIdx = btnContainer?.findLastIndex?.(isButton) ?? -1;
    var el = <StickerButtons sticker={sticker} />;

    if (btnIdx >= 0) {
        btnContainer.splice(btnIdx + 1, 0, el);
        dbg("Spliced buttons after index", btnIdx);
    } else {
        dbg("No button found, appending to tree");
        appendToTree(component, el);
    }
}

function appendToTree(tree: any, element: any) {
    if (!tree) return;
    if (Array.isArray(tree?.props?.children)) {
        tree.props.children.push(element);
        dbg("Appended to children[]");
    } else if (tree?.props?.children != null) {
        tree.props.children = [tree.props.children, element];
        dbg("Wrapped + appended");
    } else if (tree?.props) {
        tree.props.children = element;
        dbg("Set as sole child");
    } else if (Array.isArray(tree)) {
        tree.push(element);
        dbg("Pushed to array");
    } else {
        dbg("appendToTree: nowhere to append");
    }
}

function patchSheet(funcName: string, sheetModule: any) {
    return after(funcName, sheetModule, function(callArgs: any[], res: any) {
        var props = callArgs[0] ?? {};
        var s: StickerNode | undefined = props?.sticker ?? props?.stickerNode ?? props?.renderableSticker;
        if (!s) return;
        dbg("DirectSheet sticker:", s.name);
        injectButtons(res, s);
    });
}
