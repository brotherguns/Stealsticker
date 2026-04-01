import { find, findByProps, findByStoreName } from "@vendetta/metro";

export const LazyActionSheet = findByProps("hideActionSheet");
export const MediaModalUtils = findByProps("openMediaModal");

export const ActionSheet =
    findByProps("ActionSheet")?.ActionSheet ??
    find((m: any) => m.render?.name === "ActionSheet");

export const { ActionSheetTitleHeader, ActionSheetCloseButton } =
    findByProps("ActionSheetTitleHeader") ?? {};

export const { BottomSheetFlatList } =
    findByProps("BottomSheetScrollView") ?? {};

export const GuildStore = findByStoreName("GuildStore");
export const StickerStore =
    findByStoreName("StickersStore") ?? findByStoreName("StickerStore");
export const PermissionsStore = findByStoreName("PermissionStore");
export const AuthenticationStore = findByStoreName("AuthenticationStore");

export const { default: GuildIcon, GuildIconSizes } =
    findByProps("GuildIconSizes") ?? {};

export const { downloadMediaAsset } = findByProps("downloadMediaAsset") ?? {};

export const constants = findByProps("Fonts", "Permissions");
