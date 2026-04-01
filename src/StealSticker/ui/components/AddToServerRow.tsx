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

var FormRow = Forms?.FormRow;
var FormIcon = Forms?.FormIcon;

function getMaxStickerSlots(guild: any): number {
    return [5, 15, 30, 60][guild.premium_tier ?? 0] ?? 5;
}

export default function AddToServerRow({
    guild,
    sticker,
}: {
    guild: any;
    sticker: StickerNode;
}) {
    if (!FormRow) return null;

    var url = getStickerUrl(sticker)!;
    var ext = getStickerExtension(sticker)!;

    var slotsAvailable = React.useMemo(function() {
        var max = getMaxStickerSlots(guild);
        var existing: any[] =
            StickerStore?.getStickersByGuildId?.(guild.id) ?? [];
        return existing.length < max;
    }, []);

    var addToServer = async function() {
        LazyActionSheet?.hideActionSheet?.();
        try {
            var resp = await fetch(url);
            var blob = await resp.blob();

            var form = new FormData();
            form.append("file", blob, sticker.name + "." + ext);
            form.append("name", sticker.name);
            form.append("description", sticker.description ?? sticker.name);
            form.append("tags", sticker.tags?.split(",")?.[0]?.trim() || "⭐");

            var token = AuthenticationStore?.getToken?.();
            var res = await fetch(
                "https://discord.com/api/v10/guilds/" + guild.id + "/stickers",
                { method: "POST", headers: { Authorization: token }, body: form }
            );

            if (res.ok) {
                showToast(
                    "Added " + sticker.name + " to " + guild.name,
                    getAssetIDByName("Check")
                );
            } else {
                var err = await res.json().catch(function() { return {}; });
                showToast(
                    err?.message ?? "Failed to add to " + guild.name,
                    getAssetIDByName("Small")
                );
            }
        } catch (e: any) {
            showToast(e?.message ?? "Something went wrong", getAssetIDByName("Small"));
        }
    };

    return (
        <FormRow
            leading={GuildIcon ? <GuildIcon guild={guild} size={GuildIconSizes?.MEDIUM} animate={false} /> : undefined}
            disabled={!slotsAvailable}
            label={guild.name}
            subLabel={!slotsAvailable ? "No sticker slots available" : undefined}
            trailing={FormIcon ? <FormIcon style={{ opacity: 1 }} source={getAssetIDByName("ic_add_24px")} /> : undefined}
            onPress={addToServer}
        />
    );
}
