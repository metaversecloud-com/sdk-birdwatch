import { Request, Response } from "express";
import {
  errorHandler,
  getVisitor,
  getWorld,
  getKeyAsset,
  getSceneMilestones,
  getSpotAsset,
  getCredentials,
  ensureCollectionState,
  registerPlacedCollection,
  getVisitorBadges,
  getVisitorBirdItems,
  getEcosystemBadges,
  fireBadgeToast,
  etDayKey,
  resolveTodayMystery,
  sumMysteryTotals,
  toMysteryView,
  invalidateInventoryCache,
} from "@utils/index.js";
import { emptyCollectionState, toCollectionView } from "@utils/world/getWorld.js";
import { KeyAssetConfigError } from "@utils/droppedAssets/getKeyAsset.js";
import { SpotAssetConfigError } from "@utils/droppedAssets/getSpotAsset.js";
import type { GameStateResponse, VisitorPerScene } from "@shared/types/index.js";
import { sceneKey } from "@shared/types/index.js";
import type { IKeyAsset } from "../types/DroppedAssetTypes.js";
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
    let keyAsset: IKeyAsset | undefined;
    try {
      if (uniqueName === "Birdwatch_keyAsset") {
        keyAsset = await getKeyAsset(credentials, queryCollectionId);
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
    const milestones = await getSceneMilestones(credentials, collectionId, keyAsset);
    const worldState = toCollectionView(
      world.dataObject.collections?.[collectionId] || emptyCollectionState(),
      milestones.config,
    );
    const adminSettings = world.dataObject.adminSettings!;
    const leaderboard = world.dataObject.leaderboard || {};

    const { visitor, isAdmin } = await getVisitor(credentials, true, {
      includeInventory: true,
    });

    const badgeCatalog = await getEcosystemBadges(credentials).catch(() => ({}));

    // Toast badges granted since the last open (queued by `awardBadges`), then clear the
    // queue. Fire-and-forget: a failed toast must not block the queue clear or the response.
    // The same write logs `appOpens`, except for in-app refreshes (`?refresh=true`).
    const pendingBadgeToasts = visitor.dataObject?.pendingBadgeToasts || [];
    for (const badgeName of pendingBadgeToasts) fireBadgeToast(visitor, badgeName);
    const isAppOpen = req.query.refresh !== "true";
    if (pendingBadgeToasts.length || isAppOpen) {
      await visitor
        .updateDataObject(pendingBadgeToasts.length ? { pendingBadgeToasts: [] } : {}, {
          analytics: isAppOpen ? [{ analyticName: "appOpens", uniqueKey: profileId, urlSlug: credentials.urlSlug }] : [],
        })
        .catch(() => undefined);
    }

    // Today's Mystery Bird (read-only: the day's puzzle is picked deterministically, saved on first guess).
    const collectionData = getCollectionData(collectionId);
    const key = sceneKey(credentials.urlSlug, sceneDropId);
    const today = collectionData?.puzzles?.length
      ? resolveTodayMystery({
          puzzles: collectionData.puzzles,
          stored: (visitor.dataObject?.[key] as VisitorPerScene | undefined)?.mysteryBird?.[collectionId],
          todayKey: etDayKey(),
          seed: `${profileId}:${key}:${collectionId}`,
        })
      : undefined;
    const mysteryBird = today
      ? toMysteryView({
          ...today,
          profileId,
          solvedTotal: sumMysteryTotals(visitor.dataObject).solvedTotal,
        })
      : undefined;

    const payload: GameStateResponse = {
      isAdmin,
      collectionId,
      sceneDropId,
      adminSettings,
      worldState,
      milestones,
      leaderboard,
      mysteryBird,
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
