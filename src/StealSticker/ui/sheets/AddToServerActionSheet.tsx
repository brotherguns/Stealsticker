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
            return PermissionsStore?.can?.(constants?.Permissions?.MANAGE_GUILD_EXPRESSIONS, g);
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
