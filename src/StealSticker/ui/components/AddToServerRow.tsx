import { React } from "@metro/common";
import { findByProps } from "@metro/wrappers";
import { showToast } from "@lib/ui/toasts";
import { findAssetId } from "@lib/api/assets";
import { Forms } from "@vendetta/ui/components";
import { getStickerUrl, getStickerExtension } from "../../lib/utils/getStickerUrl";
import { AuthenticationStore, GuildIcon, GuildIconSizes, LazyActionSheet, StickerStore } from "../../modules";

const { FormRow, FormIcon } = findByProps("FormRow");

// Max sticker slots by guild boost level
function getMaxStickerSlots(guild: any): number {
    const premiumTier = guild.premium_tier ?? 0;
    // 0 → 5, 1 → 15, 2 → 30, 3 → 60
    return [5, 15, 30, 60][premiumTier] ?? 5;
}

export default function AddToServerRow({
    guild,
    sticker,
}: {
    guild: any;
    sticker: StickerNode;
}) {
    const stickerUrl = getStickerUrl(sticker)!;
    const ext = getStickerExtension(sticker)!;

    const slotsAvailable = React.useMemo(() => {
        const maxSlots = getMaxStickerSlots(guild);
        const guildStickers: any[] =
            StickerStore?.getStickersByGuildId?.(guild.id) ??
            Object.values(StickerStore?.getStickersByGuildIds?.([guild.id]) ?? {}) ??
            [];
        return guildStickers.length < maxSlots;
    }, []);

    const addToServer = async () => {
        LazyActionSheet.hideActionSheet();

        try {
            // Fetch the sticker image
            const resp = await fetch(stickerUrl);
            const blob = await resp.blob();

            const form = new FormData();
            form.append("file", blob, `${sticker.name}.${ext}`);
            form.append("name", sticker.name);
            form.append(
                "description",
                sticker.description ?? sticker.name
            );
            // tags must be a single emoji or word — use first tag or fallback
            const tag =
                sticker.tags?.split(",")[0]?.trim() || "⭐";
            form.append("tags", tag);

            const token = AuthenticationStore.getToken();
            const apiResp = await fetch(
                `https://discord.com/api/v10/guilds/${guild.id}/stickers`,
                {
                    method: "POST",
                    headers: { Authorization: token },
                    body: form,
                }
            );

            if (apiResp.ok) {
                showToast(
                    `Added ${sticker.name} to ${guild.name}`,
                    findAssetId("Check")
                );
            } else {
                const err = await apiResp.json().catch(() => ({}));
                showToast(
                    err?.message ?? `Failed to add sticker to ${guild.name}`,
                    findAssetId("Small")
                );
            }
        } catch (e: any) {
            showToast(
                e?.message ?? "Something went wrong",
                findAssetId("Small")
            );
        }
    };

    return (
        <FormRow
            leading={
                <GuildIcon
                    guild={guild}
                    size={GuildIconSizes.MEDIUM}
                    animate={false}
                />
            }
            disabled={!slotsAvailable}
            label={guild.name}
            subLabel={!slotsAvailable ? "No sticker slots available" : undefined}
            trailing={
                <FormIcon
                    style={{ opacity: 1 }}
                    source={findAssetId("ic_add_24px")}
                />
            }
            onPress={addToServer}
        />
    );
}
