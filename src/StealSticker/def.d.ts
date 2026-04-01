declare interface StickerNode {
    id: string;
    name: string;
    format_type: number; // 1=PNG, 2=APNG, 3=LOTTIE, 4=GIF
    description?: string;
    tags?: string;
    guild_id?: string;
    pack_id?: string;
    available?: boolean;
}
