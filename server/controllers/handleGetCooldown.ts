import { Request, Response } from "express";
import {
  errorHandler,
  getVisitor,
  getWorld,
  getSceneSiblings,
  getSpotAsset,
  getCredentials,
  getVisitorBirdItems,
} from "@utils/index.js";
import type { SpotKey } from "@shared/types/index.js";
import { SPOT_KEYS, SPOT_LABELS } from "@shared/types/index.js";
import { getCollectionData } from "../data/collections/index.js";

interface SpotStatus {
  assetId: string | null;
  spot: SpotKey;
  label: string;
  foundInCollection: number;
  totalInCollection: number;
  cooldownRemainingSeconds: number;
  isReady: boolean;
}

const isSpotKey = (v: unknown): v is SpotKey => typeof v === "string" && (SPOT_KEYS as readonly string[]).includes(v);

/**
 * Extract `spot` + `collectionId` from a sibling spot's iframe URL. Admins place
 * each `Birdwatch_spot` with `?collectionId=…&spot=…`, which Topia stores as
 * `clickableLink`. This lets us identify sibling spots the current player hasn't
 * clicked yet (their dataObject only gets initialized on first click).
 */
const parseClickableLink = (link: string | null | undefined): { collectionId?: string; spot?: SpotKey } => {
  if (!link) return {};
  try {
    const url = new URL(link);
    const collectionId = url.searchParams.get("collectionId") || undefined;
    const spot = url.searchParams.get("spot") || undefined;
    return { collectionId, spot: isSpotKey(spot) ? spot : undefined };
  } catch {
    return {};
  }
};

export const handleGetCooldown = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { assetId } = credentials;

    const world = await getWorld(credentials);
    const { visitor, perScene } = await getVisitor(credentials, false, { includeInventory: true });

    // Pin down the current spot's Collection — fall back to the first registered Collection
    // (handles the case where the asset's data object hasn't been initialized yet).
    let currentCollectionId: string | undefined;
    let currentSpot: SpotKey | undefined;
    try {
      const current = await getSpotAsset(credentials);
      currentCollectionId = current.dataObject?.collectionId;
      currentSpot = current.dataObject?.spot;
    } catch {
      // ignore — we'll fall back below
    }
    if (!currentCollectionId) {
      currentCollectionId = Object.keys(world.dataObject.collections || {})[0];
    }

    const now = Date.now();
    // Cooldowns are stored as an end time (ms). Anything else is treated as expired.
    const remainingSeconds = (endsAt: unknown) =>
      typeof endsAt === "number" ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
    const remaining = remainingSeconds(perScene.spotCooldowns?.[assetId]);

    // Build a map { spotKey → assetId } for sibling spots in this scene. Prefer the data
    // object; if that's uninitialized, fall back to parsing the sibling's clickableLink.
    const spotKeyToAssetId = new Map<SpotKey, string>();
    try {
      const { spotAssets } = await getSceneSiblings(credentials);
      for (const sibling of spotAssets) {
        if (!sibling.id || sibling.id === assetId) continue;
        const metaSpot = sibling.dataObject?.spot;
        const metaCollectionId = sibling.dataObject?.collectionId;
        let siblingSpot: SpotKey | undefined = metaSpot;
        let siblingCollectionId: string | undefined = metaCollectionId;
        if (!siblingSpot || !siblingCollectionId) {
          const parsed = parseClickableLink(sibling.clickableLink);
          siblingSpot = siblingSpot || parsed.spot;
          siblingCollectionId = siblingCollectionId || parsed.collectionId;
        }
        if (!siblingSpot || siblingCollectionId !== currentCollectionId) continue;
        if (!spotKeyToAssetId.has(siblingSpot)) spotKeyToAssetId.set(siblingSpot, sibling.id);
      }
    } catch {
      // scene lookup failure shouldn't blank the response
    }

    const data = currentCollectionId ? getCollectionData(currentCollectionId) : undefined;
    const statuses: SpotStatus[] = [];
    if (data) {
      // Field Guide (inventory) is the source of truth for found birds.
      const foundIds = new Set(Object.keys(getVisitorBirdItems(visitor)));
      for (const spotKey of SPOT_KEYS) {
        if (spotKey === currentSpot) continue;
        const totalInCollection = data.birdsBySpot[spotKey].length;
        const foundInCollection = data.birdsBySpot[spotKey].filter((b) => foundIds.has(b.id)).length;
        const siblingId = spotKeyToAssetId.get(spotKey) || null;
        const otherRemaining = siblingId ? remainingSeconds(perScene.spotCooldowns?.[siblingId]) : 0;
        statuses.push({
          assetId: siblingId,
          spot: spotKey,
          label: SPOT_LABELS[spotKey],
          foundInCollection,
          totalInCollection,
          cooldownRemainingSeconds: otherRemaining,
          isReady: otherRemaining === 0,
        });
      }
    }

    // Ready first, then by fewest found; stable alpha fallback.
    statuses.sort((a, b) => {
      if (a.isReady !== b.isReady) return a.isReady ? -1 : 1;
      if (a.foundInCollection !== b.foundInCollection) return a.foundInCollection - b.foundInCollection;
      return a.label.localeCompare(b.label);
    });

    const activeLegendaryAlert = currentCollectionId
      ? world.dataObject.collections?.[currentCollectionId]?.activeLegendaryAlert
      : undefined;
    return res.json({
      success: true,
      data: {
        remainingSeconds: remaining,
        spotsToTry: statuses,
        activeLegendaryAlert,
      },
    });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleGetCooldown",
      message: "Error getting cooldown",
      req,
      res,
    });
  }
};
