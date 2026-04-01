import { React } from "@vendetta/metro/common";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms } from "@vendetta/ui/components";
import { showToast } from "@vendetta/ui/toasts";
import { getStickerExtension, getStickerUrl } from "../../lib/utils/getStickerUrl";
import {
    AuthenticationStore,
    GuildIcon,
    GuildIconSizes,
    LazyActionSheet,
    StickerStore,
} from "../../modules";

const { FormRow, FormIcon } = Forms;

function getMaxStickerSlots(guild: any): number {
    // Boost tier 0→5, 1→15, 2→30, 3→60
    return [5, 15, 30, 60][guild.premium_tier ?? 0] ?? 5;
}

export default function AddToServerRow({
    guild,
    sticker,
}: {
    guild: any;
    sticker: StickerNode;
}) {
    const url = getStickerUrl(sticker)!;
    const ext = getStickerExtension(sticker)!;

    const slotsAvailable = React.useMemo(() => {
        const max = getMaxStickerSlots(guild);
        const existing: any[] =
            StickerStore?.getStickersByGuildId?.(guild.id) ?? [];
        return existing.length < max;
    }, []);

    const addToServer = async () => {
        LazyActionSheet.hideActionSheet();
        try {
            const resp = await fetch(url);
            const blob = await resp.blob();

            const form = new FormData();
            form.append("file", blob, `${sticker.name}.${ext}`);
            form.append("name", sticker.name);
            form.append("description", sticker.description ?? sticker.name);
            form.append("tags", sticker.tags?.split(",")?.[0]?.trim() || "⭐");

            const token = AuthenticationStore.getToken();
            const res = await fetch(
                `https://discord.com/api/v10/guilds/${guild.id}/stickers`,
                { method: "POST", headers: { Authorization: token }, body: form }
            );

            if (res.ok) {
                showToast(
                    `Added ${sticker.name} to ${guild.name}`,
                    getAssetIDByName("Check")
                );
            } else {
                const err = await res.json().catch(() => ({}));
                showToast(
                    err?.message ?? `Failed to add to ${guild.name}`,
                    getAssetIDByName("Small")
                );
            }
        } catch (e: any) {
            showToast(e?.message ?? "Something went wrong", getAssetIDByName("Small"));
        }
    };

    return (
        <FormRow
            leading={<GuildIcon guild={guild} size={GuildIconSizes.MEDIUM} animate={false} />}
            disabled={!slotsAvailable}
            label={guild.name}
            subLabel={!slotsAvailable ? "No sticker slots available" : undefined}
            trailing={<FormIcon style={{ opacity: 1 }} source={getAssetIDByName("ic_add_24px")} />}
            onPress={addToServer}
        />
    );
}
