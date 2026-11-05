import { Request, Response } from "express";
import {
  errorHandler,
  getBirdwatchVisitor,
  getBirdwatchWorld,
  getKeyAsset,
  getSpotAsset,
  getCredentials,
  ensureCollectionState,
  registerPlacedCollection,
  getVisitorBadges,
  getVisitorBirdItems,
  invalidateInventoryCache,
} from "@utils/index.js";
import { emptyCollectionState } from "@utils/world/getBirdwatchWorld.js";
import { emptyVisitorScene } from "@utils/visitor/getBirdwatchVisitor.js";
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

    const world = await getBirdwatchWorld(credentials);

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
    const worldState = world.dataObject.collections?.[collectionId] || emptyCollectionState(collectionId);
    const adminSettings = world.dataObject.adminSettings!;
    const leaderboard = world.dataObject.leaderboard || {};

    const { visitor, isAdmin, perScene } = await getBirdwatchVisitor(credentials, true, {
      includeInventory: true,
    });

    const payload: GameStateResponse = {
      isAdmin,
      collectionId,
      sceneDropId,
      adminSettings,
      worldState,
      leaderboard,
      visitorScene: perScene || emptyVisitorScene(),
      pendingBanners: {
        milestone: undefined,
        legendaryAlert: worldState.activeLegendaryAlert,
      },
    };

    return res.json({
      success: true,
      data: payload,
      visitorInventory: getVisitorBadges(visitor),
      visitorBirdItems: getVisitorBirdItems(visitor),
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
