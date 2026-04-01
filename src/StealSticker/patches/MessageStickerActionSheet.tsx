import { React } from "@metro/common";
import { after, before } from "@lib/api/patcher";
import { findByProps } from "@metro/wrappers";
import { findInReactTree } from "@lib/utils/findInReactTree";
import { ErrorBoundary } from "@lib/ui/components";
import { LazyActionSheet } from "../modules";
import StickerButtons from "../ui/components/StickerButtons";
import openMediaModal from "../lib/utils/openMediaModal";
import { getStickerUrl } from "../lib/utils/getStickerUrl";

// Try to grab the sticker sheet directly — works on older builds
const MessageStickerActionSheet = findByProps("StickerDetails") ??
    findByProps("stickerActionSheet");

export default function patchMessageStickerActionSheet() {
    // If found directly, patch it
    if (MessageStickerActionSheet) {
        return patchSheet("default", MessageStickerActionSheet);
    }

    // Fallback: intercept openLazy and wait for the right sheet
    const patches: (() => void)[] = [];

    const unpatchLazy = before("openLazy", LazyActionSheet, ([lazySheet, name]) => {
        // Discord uses names like "MessageStickerActionSheet", "StickerActionSheet",
        // or "StickersActionSheet" depending on build
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
        ([props]: [{ sticker?: StickerNode; stickerNode?: StickerNode }], res) => {
            React.useEffect(() => () => void (once && unpatch()), []);

            // Support both "sticker" and "stickerNode" prop names
            const sticker = props?.sticker ?? props?.stickerNode;
            if (!sticker) return;

            const stickerUrl = getStickerUrl(sticker);

            const view = res?.props?.children?.props?.children;
            if (!view) return;

            const unpatchView = after("type", view, (_, component) => {
                React.useEffect(() => unpatchView, []);

                // Make the sticker preview image open the media modal
                if (stickerUrl) {
                    const isIconComponent = (c: any) => c?.props?.source?.uri;
                    const iconContainer = findInReactTree(
                        component,
                        (c: any) => c?.find?.(isIconComponent)
                    );
                    const iconIdx = iconContainer?.findIndex?.(isIconComponent) ?? -1;
                    if (iconIdx >= 0) {
                        iconContainer[iconIdx] = (
                            <React.default.TouchableOpacity
                                onPress={() => openMediaModal(stickerUrl.split("?")[0])}
                            >
                                {iconContainer[iconIdx]}
                            </React.default.TouchableOpacity>
                        );
                    }
                }

                // Inject steal buttons after the last existing Button
                const isButton = (c: any) => c?.type?.name === "Button";
                const buttonsContainer = findInReactTree(
                    component,
                    (c: any) => c?.find?.(isButton)
                );
                const buttonIdx = buttonsContainer?.findLastIndex?.(isButton) ?? -1;

                const stickerButtonsEl = (
                    <ErrorBoundary>
                        <StickerButtons sticker={sticker} />
                    </ErrorBoundary>
                );

                if (buttonIdx >= 0) {
                    buttonsContainer.splice(buttonIdx + 1, 0, stickerButtonsEl);
                } else {
                    component?.props?.children?.push?.(stickerButtonsEl);
                }
            });
        }
    );

    return unpatch;
}
