import { findByProps } from "@metro/wrappers";
import { clipboard, ReactNative } from "@metro/common";
import { showToast } from "@lib/ui/toasts";
import { findAssetId } from "@lib/api/assets";
import fetchImageAsDataURL from "../../lib/utils/fetchImageAsDataURL";
import { getStickerUrl, isLottie } from "../../lib/utils/getStickerUrl";
import { downloadMediaAsset, LazyActionSheet } from "../../modules";
import { showAddToServerActionSheet } from "../sheets/AddToServerActionSheet";

const { Button } = findByProps("TableRow", "Button");

export default function StickerButtons({ sticker }: { sticker: StickerNode }) {
    if (isLottie(sticker)) {
        // Lottie stickers are animated JSON blobs — they can't be saved as images
        return null;
    }

    const url = getStickerUrl(sticker)!;
    const isGif = sticker.format_type === 4;

    const buttons = [
        {
            text: "Add to Server",
            callback: () => showAddToServerActionSheet(sticker),
        },
        {
            text: "Copy URL to clipboard",
            callback: () => {
                clipboard.setString(url);
                LazyActionSheet.hideActionSheet();
                showToast(
                    `Copied ${sticker.name}'s URL to clipboard`,
                    findAssetId("ic_copy_message_link")
                );
            },
        },
        ...ReactNative.Platform.select({
            ios: [
                {
                    text: "Copy image to clipboard",
                    callback: () =>
                        fetchImageAsDataURL(url, dataUrl => {
                            clipboard.setImage(dataUrl.split(",")[1]);
                            LazyActionSheet.hideActionSheet();
                            showToast(
                                `Copied ${sticker.name}'s image to clipboard`,
                                findAssetId("ic_message_copy")
                            );
                        }),
                },
            ],
            default: [],
        }),
        {
            text: `Save image to ${ReactNative.Platform.select({
                android: "Downloads",
                default: "Camera Roll",
            })}`,
            callback: () => {
                downloadMediaAsset(url, isGif ? 1 : 0);
                LazyActionSheet.hideActionSheet();
                showToast(
                    `Saved ${sticker.name}'s image to ${ReactNative.Platform.select({
                        android: "Downloads",
                        default: "Camera Roll",
                    })}`,
                    findAssetId("toast_image_saved")
                );
            },
        },
    ];

    return (
        <>
            {buttons.map(({ text, callback }) => (
                <Button
                    color={Button.Colors?.BRAND}
                    text={text}
                    size={Button.Sizes?.SMALL}
                    onPress={callback}
                    style={{
                        marginTop: ReactNative.Platform.select({
                            android: 12,
                            default: 16,
                        }),
                    }}
                />
            ))}
        </>
    );
}
