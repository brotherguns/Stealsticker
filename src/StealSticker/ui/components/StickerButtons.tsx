import { findByProps } from "@vendetta/metro";
import { clipboard, ReactNative } from "@vendetta/metro/common";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";
import fetchImageAsDataURL from "../../lib/utils/fetchImageAsDataURL";
import { getStickerUrl, isLottie } from "../../lib/utils/getStickerUrl";
import { downloadMediaAsset, LazyActionSheet } from "../../modules";
import { showAddToServerActionSheet } from "../sheets/AddToServerActionSheet";

var ButtonModule = findByProps("TableRow", "Button") ?? findByProps("Button");
var Button = ButtonModule?.Button ?? ButtonModule?.default;

export default function StickerButtons({ sticker }: { sticker: StickerNode }) {
    if (isLottie(sticker)) return null;
    if (!Button) return null;

    var url = getStickerUrl(sticker)!;
    var isGif = sticker.format_type === 4;
    var platform = ReactNative.Platform;

    var buttons = [
        {
            text: "Add to Server",
            callback: function() { showAddToServerActionSheet(sticker); },
        },
        {
            text: "Copy URL to clipboard",
            callback: function() {
                clipboard.setString(url);
                LazyActionSheet?.hideActionSheet?.();
                showToast(
                    "Copied " + sticker.name + "'s URL",
                    getAssetIDByName("ic_copy_message_link")
                );
            },
        },
        ...platform.select({
            ios: [{
                text: "Copy image to clipboard",
                callback: function() {
                    fetchImageAsDataURL(url, function(dataUrl: string) {
                        clipboard.setImage(dataUrl.split(",")[1]);
                        LazyActionSheet?.hideActionSheet?.();
                        showToast(
                            "Copied " + sticker.name + "'s image",
                            getAssetIDByName("ic_message_copy")
                        );
                    });
                },
            }],
            default: [],
        }),
        {
            text: "Save to " + platform.select({ android: "Downloads", default: "Camera Roll" }),
            callback: function() {
                if (downloadMediaAsset) {
                    downloadMediaAsset(url, isGif ? 1 : 0);
                }
                LazyActionSheet?.hideActionSheet?.();
                showToast(
                    "Saved " + sticker.name,
                    getAssetIDByName("toast_image_saved")
                );
            },
        },
    ];

    return (
        <>
            {buttons.map(function({ text, callback }) {
                return (
                    <Button
                        color={Button.Colors?.BRAND}
                        text={text}
                        size={Button.Sizes?.SMALL}
                        onPress={callback}
                        style={{ marginTop: platform.select({ android: 12, default: 16 }) }}
                    />
                );
            })}
        </>
    );
}
