import type { Credentials } from "../../types/index.js";
import type { DataObjectPatch, IWorld } from "../../types/DroppedAssetTypes.js";
import type { WorldState, CollectionWorldState, CollectionWorldStateView } from "@shared/types/index.js";
import { DEFAULT_ADMIN_SETTINGS } from "@shared/types/index.js";
import { World } from "../topiaInit.js";
import { standardizeError } from "../standardizeError.js";
import { milestoneStateFor } from "../milestones.js";
import { computeMostSpotted } from "../mostSpotted.js";

export const emptyCollectionState = (): CollectionWorldState => ({
  totalSightings: 0,
  perBirdSightings: {},
  perPlayerContribution: {},
});

/** Add the values derived from stored counts (milestones, most spotted). */
export const toCollectionView = (state: CollectionWorldState): CollectionWorldStateView => ({
  ...state,
  milestones: milestoneStateFor(state.totalSightings || 0),
  mostSpotted: computeMostSpotted(state.perBirdSightings || {}),
});

export const emptyWorldState = (): WorldState => ({
  adminSettings: { ...DEFAULT_ADMIN_SETTINGS },
  collections: {},
  leaderboard: {},
});

/**
 * Fetch and initialize the world data object.
 * A Collection's placement is recorded as `collections[collectionId].sceneDropId`.
 */
export const getWorld = async (credentials: Credentials): Promise<IWorld> => {
  try {
    const world = World.create(credentials.urlSlug, { credentials }) as unknown as IWorld;
    await world.fetchDataObject();

    const current = world.dataObject;
    const needsInit = !current || !current.adminSettings;
    if (needsInit) {
      const lockId = `world-${credentials.urlSlug}-init-${Math.round(Date.now() / 60000)}`;
      await world.updateDataObject(emptyWorldState(), { lock: { lockId, releaseLock: true } }).catch(() => undefined);
      await world.fetchDataObject();
    } else {
      // Backfill newly-added top-level fields on existing worlds without blowing away data.
      const updates: DataObjectPatch = {};
      if (!current.collections) updates["collections"] = {};
      if (!current.leaderboard) updates["leaderboard"] = {};
      if (!current.adminSettings) updates["adminSettings"] = { ...DEFAULT_ADMIN_SETTINGS };
      if (Object.keys(updates).length) {
        await world.updateDataObject(updates, {}).catch(() => undefined);
        await world.fetchDataObject();
      }
    }
    return world;
  } catch (error) {
    throw standardizeError(error);
  }
};

export const ensureCollectionState = async (
  world: IWorld,
  collectionId: string,
): Promise<CollectionWorldState> => {
  const state = world.dataObject?.collections?.[collectionId];
  if (state) return state;
  const seeded = emptyCollectionState();
  const patch: DataObjectPatch = { [`collections.${collectionId}`]: seeded };
  await world.updateDataObject(patch, {}).catch(() => undefined);
  await world.fetchDataObject();
  return world.dataObject?.collections?.[collectionId] || seeded;
};

/**
 * Record that `collectionId` is currently being played from `sceneDropId`.
 * Writes directly onto the Collection's own entry — no separate lookup map.
 */
export const registerPlacedCollection = async (
  world: IWorld,
  collectionId: string,
  sceneDropId: string,
): Promise<void> => {
  const current = world.dataObject?.collections?.[collectionId]?.sceneDropId;
  if (current === sceneDropId) return;
  const patch: DataObjectPatch = { [`collections.${collectionId}.sceneDropId`]: sceneDropId };
  await world.updateDataObject(patch, {}).catch(() => undefined);
};
