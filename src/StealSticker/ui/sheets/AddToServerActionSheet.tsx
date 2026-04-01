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
} from "../../modules";
import { getStickerUrl } from "../../lib/utils/getStickerUrl";

var FormDivider = Forms?.FormDivider;
var FormIcon = Forms?.FormIcon;

var STICKER_PERM: any =
    constants?.Permissions?.MANAGE_GUILD_EXPRESSIONS ??
    constants?.Permissions?.MANAGE_EMOJIS_AND_STICKERS ??
    constants?.Permissions?.MANAGE_EMOJIS ??
    constants?.Permissions?.CREATE_GUILD_EXPRESSIONS ??
    1073741824n;

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
    var guilds = (Object.values(GuildStore?.getGuilds?.() ?? {}) as any[])
        .filter(function(g: any) {
            if (!PermissionsStore?.can) return false;
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
