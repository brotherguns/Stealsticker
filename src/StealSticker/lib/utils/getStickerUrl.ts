// Discord sticker format types:
// 1 = PNG
// 2 = APNG
// 3 = LOTTIE (JSON - cannot be stolen/uploaded as a normal sticker)
// 4 = GIF

export function getStickerUrl(sticker: StickerNode, size = 320): string | null {
    switch (sticker.format_type) {
        case 1: // PNG
        case 2: // APNG - served as PNG from CDN
            return `https://media.discordapp.net/stickers/${sticker.id}.png?size=${size}`;
        case 4: // GIF
            return `https://media.discordapp.net/stickers/${sticker.id}.gif?size=${size}`;
        case 3: // LOTTIE - can't be downloaded/uploaded as a file
        default:
            return null;
    }
}

export function getStickerExtension(sticker: StickerNode): string | null {
    switch (sticker.format_type) {
        case 1:
        case 2:
            return "png";
        case 4:
            return "gif";
        default:
            return null;
    }
}

export function isLottie(sticker: StickerNode): boolean {
    return sticker.format_type === 3;
}
