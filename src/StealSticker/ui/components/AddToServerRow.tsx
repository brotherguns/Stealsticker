import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms } from "@vendetta/ui/components";
import { showToast } from "@vendetta/ui/toasts";
import { getStickerExtension } from "../../lib/utils/getStickerUrl";
import {
    AuthenticationStore,
    GuildIcon,
    GuildIconSizes,
    LazyActionSheet,
} from "../../modules";

var FormRow = Forms?.FormRow;
var FormIcon = Forms?.FormIcon;

// Mime types for each format
var MIME_MAP: Record<number, string> = {
    1: "image/png",
    2: "image/png",   // APNG is served as image/png
    4: "image/gif",
};

// Use cdn.discordapp.com (not media.discordapp.net) for raw sticker files
function getUploadUrl(sticker: StickerNode): string | null {
    switch (sticker.format_type) {
        case 1:
        case 2:
            return "https://cdn.discordapp.com/stickers/" + sticker.id + ".png";
        case 4:
            return "https://cdn.discordapp.com/stickers/" + sticker.id + ".gif";
        default:
            return null;
    }
}

export default function AddToServerRow({
    guild,
    sticker,
}: {
    guild: any;
    sticker: StickerNode;
}) {
    if (!FormRow) return null;

    var uploadUrl = getUploadUrl(sticker);
    var ext = getStickerExtension(sticker);
    var mime = MIME_MAP[sticker.format_type] ?? "image/png";

    var addToServer = async function() {
        LazyActionSheet?.hideActionSheet?.();
        try {
            if (!uploadUrl) {
                showToast("Unsupported sticker format", getAssetIDByName("Small"));
                return;
            }

            // React Native FormData: { uri, type, name } tells RN to
            // stream the file from the URL during upload — no manual download needed
            var form = new FormData();
            form.append("file", {
                uri: uploadUrl,
                type: mime,
                name: sticker.name + "." + ext,
            } as any);
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
                    err?.message ?? "Failed (" + res.status + ")",
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
            label={guild.name}
            trailing={FormIcon ? <FormIcon style={{ opacity: 1 }} source={getAssetIDByName("ic_add_24px")} /> : undefined}
            onPress={addToServer}
        />
    );
}
