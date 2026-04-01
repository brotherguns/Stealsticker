import { ReactNative } from "@metro/common";
import { LazyActionSheet, MediaModalUtils } from "../../modules";

function getSizeAsync(src: string): Promise<[number, number]> {
    return new Promise((resolve, reject) => {
        ReactNative.Image.getSize(src, (w, h) => resolve([w, h]), reject);
    });
}

export default async function openMediaModal(src: string) {
    const [width, height] = await getSizeAsync(src);
    const { width: screenWidth, height: screenHeight } =
        ReactNative.Dimensions.get("window");

    LazyActionSheet.hideActionSheet();
    MediaModalUtils.openMediaModal({
        initialSources: [{ uri: src, sourceURI: src, width, height }],
        initialIndex: 0,
        originLayout: {
            width: 160,
            height: 160,
            x: screenWidth / 2 - 80,
            y: screenHeight - 80,
            resizeMode: "fill",
        },
    });
}
