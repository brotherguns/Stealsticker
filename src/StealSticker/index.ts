import patchMessageStickerActionSheet from "./patches/MessageStickerActionSheet";

let patches: (() => void)[] = [];

export default {
    onLoad: () => {
        patches.push(patchMessageStickerActionSheet());
    },
    onUnload: () => {
        for (const unpatch of patches) {
            unpatch();
        }
    },
};
