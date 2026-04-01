import { findByProps, findByStoreName } from "@metro/wrappers";
import { findExports } from "@metro/finders";
import { byName } from "@metro/filters";

export const LazyActionSheet = findByProps("openLazy", "hideActionSheet");
export const MediaModalUtils = findByProps("openMediaModal");

export const ActionSheet =
    findByProps("ActionSheet")?.ActionSheet ??
    findExports(byName("ActionSheet"));

export const { ActionSheetTitleHeader, ActionSheetCloseButton } =
    findByProps("ActionSheetTitleHeader");

export const { BottomSheetFlatList } = findByProps("BottomSheetScrollView");

export const GuildStore = findByStoreName("GuildStore");
export const StickerStore = findByStoreName("StickersStore") ??
    findByStoreName("StickerStore");
export const PermissionsStore = findByStoreName("PermissionStore");
export const AuthenticationStore = findByStoreName("AuthenticationStore");

export const { default: GuildIcon, GuildIconSizes } = findByProps("GuildIconSizes");

export const { downloadMediaAsset } = findByProps("downloadMediaAsset");

export const constants = findByProps("Fonts", "Permissions");
