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

const { FormDivider, FormIcon } = Forms;

export function showAddToServerActionSheet(sticker: StickerNode) {
    LazyActionSheet.openLazy(
        Promise.resolve({ default: () => <AddToServer sticker={sticker} /> }),
        "AddToServerStickerActionSheet"
    );
}

function AddToServer({ sticker }: { sticker: StickerNode }) {
    const guilds = (Object.values(GuildStore.getGuilds()) as any[])
        .filter(g => PermissionsStore.can(constants.Permissions.MANAGE_GUILD_EXPRESSIONS, g))
        .sort((a, b) => a.name?.localeCompare?.(b.name));

    const previewUrl = getStickerUrl(sticker, 64);

    return (
        <ActionSheet scrollable>
            <ErrorBoundary>
                <ActionSheetTitleHeader
                    title={`Stealing ${sticker.name}`}
                    leading={
                        previewUrl
                            ? <FormIcon style={{ marginRight: 12, opacity: 1 }} source={{ uri: previewUrl }} disableColor />
                            : undefined
                    }
                    trailing={<ActionSheetCloseButton onPress={() => LazyActionSheet.hideActionSheet()} />}
                />
                <BottomSheetFlatList
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    data={guilds}
                    renderItem={({ item }: { item: any }) => (
                        <AddToServerRow guild={item} sticker={sticker} />
                    )}
                    ItemSeparatorComponent={FormDivider}
                    keyExtractor={(x: any) => x.id}
                />
            </ErrorBoundary>
        </ActionSheet>
    );
}
