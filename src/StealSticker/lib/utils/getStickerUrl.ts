// format_type: 1=PNG, 2=APNG (served as PNG), 3=LOTTIE (skip), 4=GIF

export function getStickerUrl(sticker: StickerNode, size = 320): string | null {
    switch (sticker.format_type) {
        case 1:
        case 2:
            return `https://media.discordapp.net/stickers/${sticker.id}.png?size=${size}`;
        case 4:
            return `https://media.discordapp.net/stickers/${sticker.id}.gif?size=${size}`;
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
