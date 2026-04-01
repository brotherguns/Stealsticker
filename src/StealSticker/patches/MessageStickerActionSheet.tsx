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

// Try direct find first (older builds expose it this way)
const DirectSheet = findByProps("StickerDetails") ?? findByProps("stickerActionSheet");

export default function patchMessageStickerActionSheet() {
    if (DirectSheet) return patchSheet("default", DirectSheet);

    const patches: (() => void)[] = [];

    const unpatchLazy = before("openLazy", LazyActionSheet, ([lazySheet, name, context]: [any, string, any]) => {
        // Support all known sheet names across Discord versions
        if (
            name !== "MessageStickerActionSheet" &&
            name !== "StickerActionSheet" &&
            name !== "StickersActionSheet" &&
            name !== "sticker_detail_action_sheet"
        ) return;

        // Newer builds pass sticker as context arg to openLazy
        // rather than as props to the component
        const sticker: StickerNode | undefined =
            context?.renderableSticker ??
            context?.sticker ??
            context?.stickerNode;

        lazySheet.then((module: any) => {
            const unpatchModule = after("default", module, ([props]: [any], res: any) => {
                // Older builds pass sticker via component props instead
                const stickerNode: StickerNode | undefined =
                    sticker ??
                    props?.sticker ??
                    props?.stickerNode ??
                    props?.renderableSticker;

                if (!stickerNode) return;

                const stickerUrl = getStickerUrl(stickerNode);

                injectIntoResult(res, stickerNode, stickerUrl);
            });

            patches.push(unpatchModule);
        });
    });

    return () => {
        unpatchLazy();
        patches.forEach(p => p?.());
    };
}

function injectIntoResult(res: any, sticker: StickerNode, stickerUrl: string | null) {
    const view = res?.props?.children?.props?.children;
    if (!view) return;

    const unpatchView = after("type", view, (_, component: any) => {
        React.useEffect(() => unpatchView, []);

        // Tap the sticker image to open it full screen
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

        // Inject steal buttons after the last Button in the sheet
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
}

function patchSheet(funcName: string, sheetModule: any, once = false) {
    const unpatch = after(
        funcName,
        sheetModule,
        ([props]: [any], res: any) => {
            React.useEffect(() => () => void (once && unpatch()), []);

            const sticker: StickerNode | undefined =
                props?.sticker ?? props?.stickerNode ?? props?.renderableSticker;
            if (!sticker) return;

            const stickerUrl = getStickerUrl(sticker);
            injectIntoResult(res, sticker, stickerUrl);
        }
    );

    return unpatch;
}
