import { Request, Response } from "express";
import {
  errorHandler,
  getVisitor,
  getWorld,
  getKeyAsset,
  getSpotAsset,
  getCredentials,
  ensureCollectionState,
  registerPlacedCollection,
  getVisitorBadges,
  getVisitorBirdItems,
  getEcosystemBadges,
  invalidateInventoryCache,
} from "@utils/index.js";
import { emptyCollectionState, toCollectionView } from "@utils/world/getWorld.js";
import { KeyAssetConfigError } from "@utils/droppedAssets/getKeyAsset.js";
import { SpotAssetConfigError } from "@utils/droppedAssets/getSpotAsset.js";
import type { GameStateResponse } from "@shared/types/index.js";
import { getCollectionData } from "../data/collections/index.js";

/**
 * Bootstrap payload for every drawer open. Covers all three asset uniqueNames:
 *   - Birdwatch_keyAsset: initializes collectionId from `?collectionId=...` on first touch
 *   - Birdwatch_spot:    initializes collectionId + spot from `?collectionId=...&spot=...` on first touch
 *   - Birdwatch_trophy:  no init needed; collectionId falls back to the first key asset in the scene
 */
export const handleGetGameState = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { profileId, displayName, sceneDropId, uniqueName } = credentials;

    const forceRefreshInventory = req.query.forceRefreshInventory === "true";
    if (forceRefreshInventory) invalidateInventoryCache(credentials.interactivePublicKey);

    const queryCollectionId = typeof req.query.collectionId === "string" ? req.query.collectionId : undefined;
    const querySpot = typeof req.query.spot === "string" ? req.query.spot : undefined;

    let collectionId: string | undefined;
    try {
      if (uniqueName === "Birdwatch_keyAsset") {
        const keyAsset = await getKeyAsset(credentials, queryCollectionId);
        collectionId = keyAsset.dataObject?.collectionId;
      } else if (uniqueName === "Birdwatch_spot") {
        const spotAsset = await getSpotAsset(credentials, queryCollectionId, querySpot);
        collectionId = spotAsset.dataObject?.collectionId;
      } else {
        // Trophy or unknown — resolve the Collection via the scene's key asset.
        collectionId = queryCollectionId;
      }
    } catch (configErr) {
      if (configErr instanceof KeyAssetConfigError || configErr instanceof SpotAssetConfigError) {
        return res.status(400).json({ success: false, message: configErr.message });
      }
      throw configErr;
    }

    const world = await getWorld(credentials);

    if (!collectionId) {
      // Resolve the collectionId by looking for a Collection whose stored sceneDropId
      // matches this scene; fall back to the first registered Collection.
      const collectionsMap = world.dataObject.collections || {};
      collectionId =
        Object.entries(collectionsMap).find(([, state]) => state?.sceneDropId === sceneDropId)?.[0] ||
        Object.keys(collectionsMap)[0];
    }
    if (!collectionId) {
      return res.status(400).json({ success: false, message: "No Collection resolved for this scene." });
    }

    if (!getCollectionData(collectionId)) {
      return res.status(400).json({ success: false, message: `Unknown collectionId: ${collectionId}` });
    }

    await ensureCollectionState(world, collectionId);
    await registerPlacedCollection(world, collectionId, sceneDropId);
    const worldState = toCollectionView(world.dataObject.collections?.[collectionId] || emptyCollectionState());
    const adminSettings = world.dataObject.adminSettings!;
    const leaderboard = world.dataObject.leaderboard || {};

    const { visitor, isAdmin } = await getVisitor(credentials, true, {
      includeInventory: true,
    });

    const badgeCatalog = await getEcosystemBadges(credentials).catch(() => ({}));

    // Toast badges granted since the last open (queued by `awardBadges`), then clear the
    // queue. Fire-and-forget: a failed toast must not block the queue clear or the response.
    const pendingBadgeToasts = visitor.dataObject?.pendingBadgeToasts || [];
    if (pendingBadgeToasts.length) {
      for (const badgeName of pendingBadgeToasts) {
        visitor
          .fireToast({
            groupId: `badge-${badgeName}`,
            title: "Badge Awarded",
            text: `You have earned the ${badgeName} badge!`,
          })
          .catch(() => console.error(`Failed to fire toast for the ${badgeName} badge.`));
      }
      await visitor.updateDataObject({ pendingBadgeToasts: [] }, {}).catch(() => undefined);
    }

    const payload: GameStateResponse = {
      isAdmin,
      collectionId,
      sceneDropId,
      adminSettings,
      worldState,
      leaderboard,
    };

    return res.json({
      success: true,
      data: payload,
      visitorInventory: getVisitorBadges(visitor),
      visitorBirdItems: getVisitorBirdItems(visitor),
      badgeCatalog,
      profileId,
      displayName,
    });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleGetGameState",
      message: "Error getting Birdwatch game state",
      req,
      res,
    });
  }
};
