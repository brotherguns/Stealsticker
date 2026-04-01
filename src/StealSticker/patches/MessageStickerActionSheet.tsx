import { React } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import { General } from "@vendetta/ui/components";
import { LazyActionSheet } from "../modules";
import StickerButtons from "../ui/components/StickerButtons";
import openMediaModal from "../lib/utils/openMediaModal";
import { getStickerUrl } from "../lib/utils/getStickerUrl";
import { findByProps } from "@vendetta/metro";

const { TouchableOpacity } = General;

// Direct module for older builds
const DirectSheet = findByProps("StickerDetails") ?? findByProps("stickerActionSheet");

// Sticker carried from openLazy context into the render patch
let _pendingSticker: StickerNode | undefined;

export default function patchMessageStickerActionSheet() {
    if (DirectSheet) return patchSheet("default", DirectSheet);

    const patches: (() => void)[] = [];
    const patchedModules = new WeakSet();

    const unpatchLazy = before("openLazy", LazyActionSheet, ([lazySheet, name, context]: [any, string, any]) => {
        if (
            name !== "MessageStickerActionSheet" &&
            name !== "StickerActionSheet" &&
            name !== "StickersActionSheet" &&
            name !== "sticker_detail_action_sheet"
        ) return;

        // Stash sticker from context — available before render
        _pendingSticker =
            context?.renderableSticker ??
            context?.sticker ??
            context?.stickerNode;

        lazySheet.then((module: any) => {
            // Only patch the module once
            if (patchedModules.has(module)) return;
            patchedModules.add(module);

            patches.push(
                after("default", module, ([props]: [any], res: any) => {
                    const sticker: StickerNode | undefined =
                        _pendingSticker ??
                        props?.renderableSticker ??
                        props?.sticker ??
                        props?.stickerNode;

                    _pendingSticker = undefined;

                    if (!sticker) return;
                    injectButtons(res, sticker);
                })
            );
        });
    });

    patches.push(unpatchLazy);

    return () => patches.forEach(p => p?.());
}

function injectButtons(res: any, sticker: StickerNode) {
    if (!res) return;

    const stickerUrl = getStickerUrl(sticker);

    // Walk into the sheet children to find the view to patch
    const view = res?.props?.children?.props?.children;
    if (view && typeof view === "object" && view.type) {
        const unpatchView = after("type", view, (_: any, component: any) => {
            React.useEffect(() => unpatchView, []);

            if (stickerUrl) {
                const isIcon = (c: any) => c?.props?.source?.uri;
                const iconContainer = findInReactTree(component, (c: any) => c?.find?.(isIcon));
                const iconIdx = iconContainer?.findIndex?.(isIcon) ?? -1;
                if (iconIdx >= 0) {
                    iconContainer[iconIdx] = (
                        <TouchableOpacity onPress={() => openMediaModal(stickerUrl.split("?")[0])}>
                            {iconContainer[iconIdx]}
                        </TouchableOpacity>
                    );
                }
            }

            const isButton = (c: any) => c?.type?.name === "Button";
            const btnContainer = findInReactTree(component, (c: any) => c?.find?.(isButton));
            const btnIdx = btnContainer?.findLastIndex?.(isButton) ?? -1;
            const el = <StickerButtons sticker={sticker} />;

            if (btnIdx >= 0) {
                btnContainer.splice(btnIdx + 1, 0, el);
            } else {
                component?.props?.children?.push?.(el);
            }
        });
        return;
    }

    // Fallback: try appending directly to res children
    if (Array.isArray(res?.props?.children)) {
        res.props.children.push(<StickerButtons sticker={sticker} />);
    }
}

function patchSheet(funcName: string, sheetModule: any) {
    return after(
        funcName,
        sheetModule,
        ([props]: [any], res: any) => {
            const sticker: StickerNode | undefined =
                props?.sticker ?? props?.stickerNode ?? props?.renderableSticker;
            if (!sticker) return;
            injectButtons(res, sticker);
        }
    );
}
