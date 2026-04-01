import { ReactNative } from "@vendetta/metro/common";
import { LazyActionSheet, MediaModalUtils } from "../../modules";

function getSizeAsync(src: string): Promise<[number, number]> {
    return new Promise((resolve, reject) =>
        ReactNative.Image.getSize(src, (w: number, h: number) => resolve([w, h]), reject)
    );
}

export default async function openMediaModal(src: string) {
    const [width, height] = await getSizeAsync(src);
    const { width: sw, height: sh } = ReactNative.Dimensions.get("window");
    LazyActionSheet.hideActionSheet();
    MediaModalUtils.openMediaModal({
        initialSources: [{ uri: src, sourceURI: src, width, height }],
        initialIndex: 0,
        originLayout: {
            width: 160, height: 160,
            x: sw / 2 - 80, y: sh - 80,
            resizeMode: "fill",
        },
    });
}
