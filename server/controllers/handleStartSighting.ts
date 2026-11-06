import { Request, Response } from "express";
import {
  errorHandler,
  getVisitor,
  getWorld,
  getSpotAsset,
  getCredentials,
  ensureCollectionState,
  rollBirdForSpot,
  pickChoices,
  milestoneStateFor,
} from "@utils/index.js";
import type { VisitorInFlightSighting } from "@shared/types/index.js";
import type { DataObjectPatch } from "../types/DroppedAssetTypes.js";
import { sceneKey } from "@shared/types/index.js";
import { getCollectionData } from "../data/collections/index.js";

/** Cooldowns are stored as an end time (ms). Anything else is treated as expired. */
const inCooldown = (endsAt: unknown, now: number): boolean => typeof endsAt === "number" && now < endsAt;

/**
 * POST /api/sightings/start — called when a visitor clicks a spot asset.
 * Returns the rolled bird + 3 choices. Idempotent for the duration of the cooldown:
 * if an in-flight sighting already exists for this (visitor, assetId) and the cooldown
 * is still active, we return the same bird/choices rather than re-rolling.
 */
export const handleStartSighting = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { assetId, urlSlug, sceneDropId, profileId } = credentials;

    const spotAsset = await getSpotAsset(credentials);
    const spotMeta = spotAsset.dataObject;
    if (!spotMeta?.collectionId || !spotMeta?.spot) {
      return res.status(400).json({ success: false, message: "Spot asset is misconfigured." });
    }

    const world = await getWorld(credentials);
    await ensureCollectionState(world, spotMeta.collectionId);
    const collectionState = world.dataObject.collections?.[spotMeta.collectionId];
    const adminSettings = world.dataObject.adminSettings;

    const { visitor, perScene } = await getVisitor(credentials, false);
    const now = Date.now();
    const key = sceneKey(urlSlug, sceneDropId);
    const existingInFlight = perScene.inFlight?.[assetId];
    const cd = perScene.spotCooldowns?.[assetId];

    if (existingInFlight && inCooldown(cd, now)) {
      return res.json({
        success: true,
        reused: true,
        data: { sighting: existingInFlight },
      });
    }

    const legendaryUsage = perScene.legendaryAlertUsage;
    const activeAlert = collectionState?.activeLegendaryAlert;
    const alertFreshFor = (fired: number) => now - fired < 5 * 60 * 1000;
    const isLegendarySkip = Boolean(
      activeAlert &&
        activeAlert.spot === spotMeta.spot &&
        alertFreshFor(activeAlert.firedAt) &&
        (!legendaryUsage ||
          legendaryUsage.alertId !== activeAlert.alertId ||
          !legendaryUsage.usedAssetIds.includes(assetId)),
    );

    const data = getCollectionData(spotMeta.collectionId);
    if (!data) return res.status(400).json({ success: false, message: "Unknown collection." });

    const rightBird = isLegendarySkip
      ? data.birdsById[activeAlert!.birdId]
      : rollBirdForSpot(
          spotMeta.collectionId,
          spotMeta.spot,
          milestoneStateFor(collectionState?.totalSightings || 0),
        );

    const [a, b, c] = pickChoices(spotMeta.collectionId, spotMeta.spot, rightBird);

    const inFlight: VisitorInFlightSighting = {
      collectionId: spotMeta.collectionId,
      birdId: rightBird.id,
      choiceBirdIds: [a.id, b.id, c.id],
    };

    const cooldownSeconds = isLegendarySkip ? 60 : (adminSettings?.cooldownSeconds ?? 60);
    const cooldownEndsAt = now + cooldownSeconds * 1000;

    // Update: track usage of the Legendary Alert for this player + record in-flight + cooldown.
    const updates: DataObjectPatch = {
      [`${key}.inFlight.${assetId}`]: inFlight,
      [`${key}.spotCooldowns.${assetId}`]: cooldownEndsAt,
    };
    if (isLegendarySkip) {
      const prior = legendaryUsage?.alertId === activeAlert!.alertId ? legendaryUsage : undefined;
      const nextUsage = {
        alertId: activeAlert!.alertId,
        usedAssetIds: prior ? [...prior.usedAssetIds, assetId] : [assetId],
      };
      updates[`${key}.legendaryAlertUsage`] = nextUsage;
    }

    await visitor.updateDataObject(updates, {
      analytics: [{ analyticName: "spotClicks", uniqueKey: profileId, urlSlug }],
    });

    return res.json({ success: true, reused: false, data: { sighting: inFlight } });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleStartSighting",
      message: "Error starting sighting",
      req,
      res,
    });
  }
};
