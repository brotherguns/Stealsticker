import { Forms } from "@vendetta/ui/components";
import { ErrorBoundary } from "@lib/ui/components";
import AddToServerRow from "../components/AddToServerRow";
import {
    ActionSheet,
    ActionSheetCloseButton,
    ActionSheetTitleHeader,
    BottomSheetFlatList,
    GuildStore,
    LazyActionSheet,
    PermissionsStore,
    constants,
} from "../../modules";
import { getStickerUrl } from "../../lib/utils/getStickerUrl";

const { FormDivider, FormIcon } = Forms;

export function showAddToServerActionSheet(sticker: StickerNode) {
    const element = (
        <ActionSheet scrollable>
            <ErrorBoundary>
                <AddToServer sticker={sticker} />
            </ErrorBoundary>
        </ActionSheet>
    );

    LazyActionSheet.openLazy(
        Promise.resolve({ default: () => element }),
        "AddToServerStickerActionSheet"
    );
}

function AddToServer({ sticker }: { sticker: StickerNode }) {
    const guilds = Object.values(GuildStore.getGuilds())
        .filter(guild =>
            PermissionsStore.can(
                constants.Permissions.MANAGE_GUILD_EXPRESSIONS,
                guild
            )
        )
        .sort((a: any, b: any) => a.name?.localeCompare?.(b.name));

    const stickerUrl = getStickerUrl(sticker);

    return (
        <>
            <ActionSheetTitleHeader
                title={`Stealing ${sticker.name}`}
                leading={
                    stickerUrl ? (
                        <FormIcon
                            style={{ marginRight: 12, opacity: 1 }}
                            source={{ uri: stickerUrl }}
                            disableColor
                        />
                    ) : undefined
                }
                trailing={
                    <ActionSheetCloseButton
                        onPress={() => LazyActionSheet.hideActionSheet()}
                    />
                }
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
        </>
    );
}
