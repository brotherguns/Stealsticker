import { React } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import { General } from "@vendetta/ui/components";
import { LazyActionSheet, messageUtil, SelectedChannelStore } from "../modules";
import StickerButtons from "../ui/components/StickerButtons";
import openMediaModal from "../lib/utils/openMediaModal";
import { getStickerUrl } from "../lib/utils/getStickerUrl";
import { findByProps } from "@vendetta/metro";

const { TouchableOpacity } = General;

// ── Debug helper — sends a Clyde message only you can see ────────────
const DEBUG = true; // flip to false once everything works
function dbg(...parts: any[]) {
    if (!DEBUG) return;
    try {
        var channelId = SelectedChannelStore?.getChannelId?.();
        if (channelId && messageUtil?.sendBotMessage) {
            messageUtil.sendBotMessage(
                channelId,
                "```\n[StealSticker] " + parts.map(String).join(" ") + "\n```"
            );
        }
    } catch (_) {}
}

// ── Direct-module approach (older builds) ────────────────────────────
var DirectSheet =
    findByProps("StickerDetails") ??
    findByProps("stickerActionSheet") ??
    findByProps("StickerActionSheet");

// Sticker carried from openLazy context into the render patch
var _pendingSticker: StickerNode | undefined;

export default function patchMessageStickerActionSheet() {
    // ── Startup diagnostics ──────────────────────────────────────────
    dbg("Plugin loaded");
    dbg("LazyActionSheet:", LazyActionSheet ? "FOUND" : "NULL");
    dbg("LazyActionSheet.openLazy:", typeof LazyActionSheet?.openLazy);
    dbg("LazyActionSheet.hideActionSheet:", typeof LazyActionSheet?.hideActionSheet);
    dbg("DirectSheet:", DirectSheet ? "FOUND" : "NULL");

    // Log all prop names on LazyActionSheet so we can see what's really there
    if (LazyActionSheet) {
        var keys = Object.keys(LazyActionSheet);
        dbg("LazyActionSheet keys:", keys.join(", "));
    }

    // ── Path A: Direct module (rare, older builds) ───────────────────
    if (DirectSheet) {
        dbg("Using DirectSheet path");
        return patchSheet("default", DirectSheet);
    }

    // ── Path B: Hook openLazy (standard path) ────────────────────────
    if (!LazyActionSheet) {
        dbg("FATAL: LazyActionSheet is null — cannot patch anything");
        return function() {};
    }

    // Figure out what the "open" method is actually called
    var openMethodName: string | null = null;
    if (typeof LazyActionSheet.openLazy === "function") {
        openMethodName = "openLazy";
    } else if (typeof LazyActionSheet.openLazyDialog === "function") {
        openMethodName = "openLazyDialog";
    } else if (typeof LazyActionSheet.open === "function") {
        openMethodName = "open";
    } else {
        // Brute-force: find any function prop that isn't hideActionSheet
        for (var key of Object.keys(LazyActionSheet)) {
            if (
                key !== "hideActionSheet" &&
                typeof LazyActionSheet[key] === "function" &&
                key.toLowerCase().includes("open")
            ) {
                openMethodName = key;
                break;
            }
        }
    }

    dbg("Open method resolved to:", openMethodName ?? "NONE");

    if (!openMethodName) {
        dbg("FATAL: No open method found on LazyActionSheet");
        return function() {};
    }

    var patches: (() => void)[] = [];
    var patchedModules = new WeakSet();

    var unpatchLazy = before(openMethodName, LazyActionSheet, function(args: any[]) {
        var lazySheet = args[0];
        var name: string = args[1] ?? "";
        var context: any = args[2];

        // Log EVERY sheet open so you can find the exact sticker sheet name
        dbg("Sheet opened:", name);

        // ── Broad match: anything with "sticker" in the name ─────────
        var nameLower = (name || "").toLowerCase();
        if (!nameLower.includes("sticker")) return;

        dbg("Sticker sheet intercepted:", name);
        dbg("Context keys:", context ? Object.keys(context).join(", ") : "none");

        // Stash sticker from context — available before render
        _pendingSticker =
            context?.renderableSticker ??
            context?.sticker ??
            context?.stickerNode ??
            context?.data?.sticker ??
            context?.data?.renderableSticker;

        dbg("Pending sticker:", _pendingSticker ? _pendingSticker.name + " (" + _pendingSticker.id + ")" : "NULL");

        if (lazySheet && typeof lazySheet.then === "function") {
            lazySheet.then(function(module: any) {
                if (patchedModules.has(module)) return;
                patchedModules.add(module);

                dbg("Lazy module resolved, patching default export");
                dbg("Module keys:", Object.keys(module).join(", "));

                // Try patching "default" first, fall back to any function export
                var targetFunc = "default";
                if (typeof module.default !== "function") {
                    for (var mKey of Object.keys(module)) {
                        if (typeof module[mKey] === "function") {
                            targetFunc = mKey;
                            break;
                        }
                    }
                }

                dbg("Patching function:", targetFunc);

                patches.push(
                    after(targetFunc, module, function(callArgs: any[], res: any) {
                        var props = callArgs[0] ?? {};
                        var sticker: StickerNode | undefined =
                            _pendingSticker ??
                            props?.renderableSticker ??
                            props?.sticker ??
                            props?.stickerNode ??
                            props?.data?.sticker;

                        _pendingSticker = undefined;

                        dbg("Render patch fired, sticker:", sticker ? sticker.name : "NULL");

                        if (!sticker) return;
                        injectButtons(res, sticker);
                    })
                );
            });
        }
    });

    patches.push(unpatchLazy);

    return function() { patches.forEach(function(p) { p?.(); }); };
}

function injectButtons(res: any, sticker: StickerNode) {
    if (!res) {
        dbg("injectButtons: res is null");
        return;
    }

    var stickerUrl = getStickerUrl(sticker);
    dbg("injectButtons: url =", stickerUrl ?? "null");

    // Walk into the sheet children to find the view to patch
    var view = res?.props?.children?.props?.children;
    if (view && typeof view === "object" && view.type) {
        dbg("injectButtons: found nested view, patching type()");
        var unpatchView = after("type", view, function(_: any, component: any) {
            React.useEffect(function() { return unpatchView; }, []);

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

            var isButton = function(c: any) { return c?.type?.name === "Button"; };
            var btnContainer = findInReactTree(component, function(c: any) { return c?.find?.(isButton); });
            var btnIdx = btnContainer?.findLastIndex?.(isButton) ?? -1;
            var el = <StickerButtons sticker={sticker} />;

            if (btnIdx >= 0) {
                btnContainer.splice(btnIdx + 1, 0, el);
                dbg("injectButtons: spliced after button index", btnIdx);
            } else {
                // Fallback: try to find ANY array of children to append to
                var childArray = findInReactTree(component, function(c: any) {
                    return Array.isArray(c) && c.length > 0;
                });
                if (childArray) {
                    childArray.push(el);
                    dbg("injectButtons: pushed to found child array");
                } else if (component?.props?.children) {
                    if (Array.isArray(component.props.children)) {
                        component.props.children.push(el);
                    } else {
                        component.props.children = [component.props.children, el];
                    }
                    dbg("injectButtons: appended to component.props.children");
                }
            }
        });
        return;
    }

    // Fallback: try appending directly to res children
    if (Array.isArray(res?.props?.children)) {
        res.props.children.push(<StickerButtons sticker={sticker} />);
        dbg("injectButtons: pushed to res.props.children array");
    } else if (res?.props?.children) {
        res.props.children = [res.props.children, <StickerButtons sticker={sticker} />];
        dbg("injectButtons: wrapped + appended to res.props.children");
    } else if (res?.props) {
        res.props.children = <StickerButtons sticker={sticker} />;
        dbg("injectButtons: set as sole child of res.props");
    }
}

function patchSheet(funcName: string, sheetModule: any) {
    return after(
        funcName,
        sheetModule,
        function(callArgs: any[], res: any) {
            var props = callArgs[0] ?? {};
            var sticker: StickerNode | undefined =
                props?.sticker ?? props?.stickerNode ?? props?.renderableSticker;
            if (!sticker) return;
            dbg("patchSheet: direct sheet, sticker:", sticker.name);
            injectButtons(res, sticker);
        }
    );
}
