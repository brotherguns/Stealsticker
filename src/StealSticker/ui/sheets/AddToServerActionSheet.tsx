import { React } from "@vendetta/metro/common";
import { ErrorBoundary, Forms } from "@vendetta/ui/components";
import AddToServerRow from "../components/AddToServerRow";
import {
    ActionSheet,
    ActionSheetCloseButton,
    ActionSheetTitleHeader,
    BottomSheetFlatList,
    constants,
    GuildStore,
    LazyActionSheet,
    PermissionsStore,
    messageUtil,
    SelectedChannelStore,
} from "../../modules";
import { getStickerUrl } from "../../lib/utils/getStickerUrl";

var FormDivider = Forms?.FormDivider;
var FormIcon = Forms?.FormIcon;

// ── Resolve the sticker/emoji management permission ──────────────────
// Discord has renamed this across versions. Try all known names,
// fall back to the raw bit value (1 << 30 = 1073741824).
var STICKER_PERM: any =
    constants?.Permissions?.MANAGE_GUILD_EXPRESSIONS ??
    constants?.Permissions?.MANAGE_EMOJIS_AND_STICKERS ??
    constants?.Permissions?.MANAGE_EMOJIS ??
    constants?.Permissions?.CREATE_GUILD_EXPRESSIONS ??
    1073741824n;  // bigint fallback for bit 30

// Also check CREATE_GUILD_EXPRESSIONS (bit 43) as a secondary perm
var CREATE_PERM: any =
    constants?.Permissions?.CREATE_GUILD_EXPRESSIONS ??
    null;

export function showAddToServerActionSheet(sticker: StickerNode) {
    if (!LazyActionSheet?.openLazy) return;
    LazyActionSheet.openLazy(
        Promise.resolve({ default: function() { return <AddToServer sticker={sticker} />; } }),
        "AddToServerStickerActionSheet"
    );
}

function AddToServer({ sticker }: { sticker: StickerNode }) {
    // Debug: log what permission values we resolved
    React.useEffect(function() {
        try {
            var channelId = SelectedChannelStore?.getChannelId?.();
            if (channelId && messageUtil?.sendBotMessage) {
                // Find actual permission key names that exist
                var permKeys = constants?.Permissions
                    ? Object.keys(constants.Permissions).filter(function(k) {
                        return k.toLowerCase().includes("emoji") ||
                               k.toLowerCase().includes("sticker") ||
                               k.toLowerCase().includes("expression") ||
                               k.toLowerCase().includes("guild_exp");
                    })
                    : [];
                messageUtil.sendBotMessage(channelId,
                    "```\n[SS] Permission keys found: " + (permKeys.join(", ") || "NONE") +
                    "\n[SS] STICKER_PERM = " + String(STICKER_PERM) +
                    "\n[SS] CREATE_PERM = " + String(CREATE_PERM) +
                    "\n```"
                );
            }
        } catch (_) {}
    }, []);

    var guilds = (Object.values(GuildStore?.getGuilds?.() ?? {}) as any[])
        .filter(function(g: any) {
            if (!PermissionsStore?.can) return false;
            // Allow if user has EITHER the manage or create permission
            var canManage = STICKER_PERM ? PermissionsStore.can(STICKER_PERM, g) : false;
            var canCreate = CREATE_PERM ? PermissionsStore.can(CREATE_PERM, g) : false;
            return canManage || canCreate;
        })
        .sort(function(a: any, b: any) { return a.name?.localeCompare?.(b.name); });

    var previewUrl = getStickerUrl(sticker, 64);

    return (
        <ActionSheet scrollable>
            <ErrorBoundary>
                {ActionSheetTitleHeader ? (
                    <ActionSheetTitleHeader
                        title={"Stealing " + sticker.name}
                        leading={
                            previewUrl && FormIcon
                                ? <FormIcon style={{ marginRight: 12, opacity: 1 }} source={{ uri: previewUrl }} disableColor />
                                : undefined
                        }
                        trailing={
                            ActionSheetCloseButton
                                ? <ActionSheetCloseButton onPress={function() { LazyActionSheet?.hideActionSheet?.(); }} />
                                : undefined
                        }
                    />
                ) : null}
                {BottomSheetFlatList ? (
                    <BottomSheetFlatList
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 24 }}
                        data={guilds}
                        renderItem={function({ item }: { item: any }) {
                            return <AddToServerRow guild={item} sticker={sticker} />;
                        }}
                        ItemSeparatorComponent={FormDivider}
                        keyExtractor={function(x: any) { return x.id; }}
                    />
                ) : null}
            </ErrorBoundary>
        </ActionSheet>
    );
}
