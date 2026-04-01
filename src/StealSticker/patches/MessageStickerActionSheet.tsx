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

    // Newer builds: intercept openLazy and look for the right sheet name
    const patches: (() => void)[] = [];

    const unpatchLazy = before("openLazy", LazyActionSheet, ([lazySheet, name]: [any, string]) => {
        if (
            name !== "MessageStickerActionSheet" &&
            name !== "StickerActionSheet" &&
            name !== "StickersActionSheet"
        ) return;

        unpatchLazy();

        lazySheet.then((module: any) => {
            patches.push(
                after("default", module, (_, res) => {
                    patches.push(patchSheet("type", res, true));
                })
            );
        });
    });

    return () => {
        unpatchLazy();
        patches.forEach(p => p?.());
    };
}

function patchSheet(funcName: string, sheetModule: any, once = false) {
    const unpatch = after(
        funcName,
        sheetModule,
        ([props]: [any], res: any) => {
            React.useEffect(() => () => void (once && unpatch()), []);

            // Discord uses "sticker" or "stickerNode" depending on the build
            const sticker: StickerNode | undefined =
                props?.sticker ?? props?.stickerNode;
            if (!sticker) return;

            const stickerUrl = getStickerUrl(sticker);

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
    );

    return unpatch;
}
