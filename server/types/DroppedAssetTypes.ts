import { DroppedAssetInterface, VisitorInterface, WorldInterface, InventoryItemInterface } from "@rtsdk/topia";
import type { AdminSettings, WorldState, SpotKey, VisitorPerScene } from "@shared/types/index.js";

export interface IKeyAsset extends DroppedAssetInterface {
  dataObject: { collectionId?: string };
}

export interface ISpotAsset extends DroppedAssetInterface {
  dataObject: { collectionId?: string; spot?: SpotKey };
}

export interface ITrophyAsset extends DroppedAssetInterface {
  dataObject: Record<string, never>;
}

export type IAsset = IKeyAsset | ISpotAsset | ITrophyAsset;

export interface IWorld extends WorldInterface {
  // Flat: no `birdwatch` wrapper. WorldState lives at the top level.
  dataObject: Partial<WorldState>;
}

export interface IVisitor extends VisitorInterface {
  // Flat: scene entries live at the top level, keyed by `${urlSlug}-${sceneDropId}`.
  dataObject: Record<string, VisitorPerScene | undefined>;
}

/** Each ecosystem/inventory catalog item we grant from. */
export type { InventoryItemInterface };

/** The visitor's own items (owned, with quantity). The SDK's `UserInventoryItem.item`
 *  field carries the catalog shape; we read `name`/`type`/`image_url`/`metadata` from there. */
export interface UserInventoryItemLike {
  id: string;
  item: {
    id?: string;
    name?: string;
    type?: string;
    image_url?: string;
    metadata?: Record<string, unknown> | null;
  };
}

/** Convenience: a Record<string, unknown> is the shape updateDataObject accepts
 *  for dot-path writes (the SDK's typed signature is `object`). */
export type DataObjectPatch = Record<string, unknown>;

export type { AdminSettings };
