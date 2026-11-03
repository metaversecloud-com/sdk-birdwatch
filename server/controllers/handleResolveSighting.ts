import { Request, Response } from "express";
import {
  errorHandler,
  getBirdwatchVisitor,
  getBirdwatchWorld,
  getCredentials,
  ensureCollectionState,
  computeMostSpotted,
  upsertEntry,
  detectMilestoneCross,
  applyMilestone,
  participantsFor,
  grantSpeciesItem,
  awardBadge,
  speciesBadgeName,
  collectionCompleteBadge,
  championBirderBadge,
  MILESTONE_BADGES,
  World,
} from "@utils/index.js";
import type { LegendaryAlert, VisitorBirdRecord } from "@shared/types/index.js";
import { RARITY_LABEL, sceneKey } from "@shared/types/index.js";
import type { DataObjectPatch } from "../types/DroppedAssetTypes.js";
import { getCollectionData } from "../data/collections/index.js";

const LEGENDARY_WINDOW_MS = 5 * 60 * 1000;

interface ResolveBody {
  pickedBirdId?: string;
}

export const handleResolveSighting = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { assetId, urlSlug, sceneDropId, profileId, displayName } = credentials;
    const forceRefreshInventory = req.query.forceRefreshInventory === "true";
    const { pickedBirdId } = (req.body || {}) as ResolveBody;

    if (!pickedBirdId) {
      return res.status(400).json({ success: false, message: "pickedBirdId is required" });
    }

    const { visitor, perScene } = await getBirdwatchVisitor(credentials, true, { includeInventory: true });
    const inFlight = perScene.inFlight?.[assetId];
    if (!inFlight) {
      return res.status(400).json({ success: false, message: "No in-flight sighting for this spot." });
    }
    if (!inFlight.choiceBirdIds.includes(pickedBirdId)) {
      return res.status(400).json({ success: false, message: "Picked bird is not among the choices." });
    }

    const data = getCollectionData(inFlight.collectionId);
    if (!data) return res.status(400).json({ success: false, message: "Unknown collection." });
    const rightBird = data.birdsById[inFlight.birdId];
    const pickedBird = data.birdsById[pickedBirdId];
    const isCorrect = pickedBirdId === inFlight.birdId;

    const world = await getBirdwatchWorld(credentials);
    await ensureCollectionState(world, inFlight.collectionId);
    const worldData = world.dataObject;
    const collectionState = worldData.collections![inFlight.collectionId];
    const key = sceneKey(urlSlug, sceneDropId);
    const now = Date.now();

    const visitorRecord: VisitorBirdRecord | undefined =
      perScene.collections?.[inFlight.collectionId]?.birdRecords?.[rightBird.id];
    const isNewSpecies = !visitorRecord;

    if (!isCorrect) {
      // Wrong pick: clear in-flight, no counts change, cooldown already started on click.
      await visitor.updateDataObject(
        { [`${key}.inFlight.${assetId}`]: null },
        {
          analytics: [
            { analyticName: "birdIDs-wrong", uniqueKey: profileId, urlSlug },
          ],
        },
      );
      return res.json({
        success: true,
        data: {
          outcome: "wrong",
          rightBird,
          pickedBird,
        },
      });
    }

    // Correct pick path.
    const nextTotal = (collectionState.totalSightings || 0) + 1;
    const nextPerBird = {
      ...(collectionState.perBirdSightings || {}),
      [rightBird.id]: (collectionState.perBirdSightings?.[rightBird.id] || 0) + 1,
    };
    const nextPerPlayer = {
      ...(collectionState.perPlayerContribution || {}),
      [profileId]: (collectionState.perPlayerContribution?.[profileId] || 0) + 1,
    };
    const mostSpotted = computeMostSpotted(nextPerBird);
    const milestoneCross = detectMilestoneCross(collectionState.totalSightings, nextTotal);
    const nextMilestones = milestoneCross
      ? applyMilestone(collectionState.milestones, milestoneCross)
      : collectionState.milestones;

    // Rarest sighting: update if this bird is strictly rarer OR fresher than current.
    const rarityOrder = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
    const currentRarity = collectionState.rarestSighting?.rarity;
    const shouldReplaceRarest =
      !collectionState.rarestSighting ||
      rarityOrder[rightBird.rarity] > rarityOrder[currentRarity as keyof typeof rarityOrder] ||
      rarityOrder[rightBird.rarity] === rarityOrder[currentRarity as keyof typeof rarityOrder];
    const nextRarest = shouldReplaceRarest
      ? {
          birdId: rightBird.id,
          rarity: rightBird.rarity,
          byDisplayName: displayName || "Anonymous",
          bySightingAt: now,
        }
      : collectionState.rarestSighting;

    // Legendary alert bookkeeping.
    let nextLegendaryAlert: LegendaryAlert | undefined = collectionState.activeLegendaryAlert;
    const alertStillFresh =
      nextLegendaryAlert && now - nextLegendaryAlert.firedAt < LEGENDARY_WINDOW_MS;
    let fireLegendaryWorldToast = false;
    if (rightBird.rarity === "legendary" && !alertStillFresh) {
      nextLegendaryAlert = {
        alertId: `${inFlight.collectionId}:${now}`,
        birdId: rightBird.id,
        spot: rightBird.spot,
        firedAt: now,
        byProfileId: profileId,
        byDisplayName: displayName || "Anonymous",
      };
      fireLegendaryWorldToast = true;
    }

    // Leaderboard: species count = number of distinct keys in this player's birdRecords ∪ { rightBird.id }.
    const perColVisitor = perScene.collections?.[inFlight.collectionId]?.birdRecords || {};
    const newUniqueCount = new Set([...Object.keys(perColVisitor), rightBird.id]).size;
    // Count unique species across ALL collections for the leaderboard.
    const allVisitorBirdIds = new Set<string>();
    for (const col of Object.values(perScene.collections || {})) {
      for (const bid of Object.keys(col?.birdRecords || {})) allVisitorBirdIds.add(bid);
    }
    allVisitorBirdIds.add(rightBird.id);
    const nextLeaderboard = upsertEntry(
      worldData.leaderboard || {},
      profileId,
      displayName || "Anonymous",
      allVisitorBirdIds.size,
      now,
    );

    // Update world data object.
    const worldPatch: DataObjectPatch = {
      [`collections.${inFlight.collectionId}.totalSightings`]: nextTotal,
      [`collections.${inFlight.collectionId}.perBirdSightings`]: nextPerBird,
      [`collections.${inFlight.collectionId}.perPlayerContribution`]: nextPerPlayer,
      [`collections.${inFlight.collectionId}.mostSpotted`]: mostSpotted,
      [`collections.${inFlight.collectionId}.rarestSighting`]: nextRarest,
      [`collections.${inFlight.collectionId}.milestones`]: nextMilestones,
      [`collections.${inFlight.collectionId}.activeLegendaryAlert`]: nextLegendaryAlert,
      leaderboard: nextLeaderboard,
    };
    await world.updateDataObject(
      worldPatch,
      {
        analytics: [
          { analyticName: "birdIDs-correct", uniqueKey: profileId, urlSlug },
          { analyticName: `sightings-${rightBird.rarity}`, uniqueKey: profileId, urlSlug },
          ...(isNewSpecies ? [{ analyticName: "speciesLogs", uniqueKey: profileId, urlSlug }] : []),
          ...(milestoneCross
            ? [{ analyticName: "milestoneReaches", uniqueKey: `${inFlight.collectionId}:${milestoneCross}` }]
            : []),
          ...(fireLegendaryWorldToast ? [{ analyticName: "legendaryAlerts", uniqueKey: `${inFlight.collectionId}:${now}` }] : []),
        ],
      },
    );

    // Update visitor data: bird record, perWorldSpeciesReachedAt, clear in-flight.
    const nextRecord: VisitorBirdRecord = isNewSpecies
      ? { firstSpottedAt: now, timesSpotted: 1 }
      : { firstSpottedAt: visitorRecord!.firstSpottedAt, timesSpotted: (visitorRecord!.timesSpotted || 0) + 1 };

    const visitorUpdates: DataObjectPatch = {
      [`${key}.inFlight.${assetId}`]: null,
      [`${key}.collections.${inFlight.collectionId}.birdRecords.${rightBird.id}`]: nextRecord,
      [`${key}.perWorldSpeciesReachedAt`]: now,
    };

    await visitor.updateDataObject(visitorUpdates, {});

    // Grant inventory + badges. These may silently no-op if the ecosystem doesn't have the items yet.
    const grantedBadges: string[] = [];
    if (isNewSpecies) {
      await grantSpeciesItem(credentials, rightBird, forceRefreshInventory).catch(() => undefined);
      await awardBadge(credentials, profileId, speciesBadgeName(rightBird), forceRefreshInventory)
        .then((r) => r.granted && grantedBadges.push(speciesBadgeName(rightBird)))
        .catch(() => undefined);
    }

    // Milestone badges (first-time only, per visitor).
    const inventoryBadgeNames = new Set(
      (visitor.inventoryItems || [])
        .filter((vi) => vi.item?.type === "BADGE")
        .map((vi) => vi.item?.name)
        .filter((n): n is string => Boolean(n)),
    );

    const totalSpeciesEver = allVisitorBirdIds.size;
    const tryAward = async (name: string) => {
      if (inventoryBadgeNames.has(name)) return;
      const r = await awardBadge(credentials, profileId, name, forceRefreshInventory).catch(() => ({
        granted: false,
      }));
      if (r.granted) grantedBadges.push(name);
    };

    if (totalSpeciesEver >= 1) await tryAward(MILESTONE_BADGES.firstSighting);
    if (totalSpeciesEver >= 10) await tryAward(MILESTONE_BADGES.avidBirder);
    if (isNewSpecies && rightBird.rarity === "rare") await tryAward(MILESTONE_BADGES.rareFind);
    if (isNewSpecies && rightBird.rarity === "legendary") await tryAward(MILESTONE_BADGES.legendaryBirder);

    // Collection complete badge: if player's unique count in THIS collection equals species total.
    if (newUniqueCount >= data.collection.species.length) {
      await tryAward(collectionCompleteBadge(data.collection));
    }

    // Fire the world-wide Legendary toast.
    if (fireLegendaryWorldToast) {
      World.create(urlSlug, { credentials })
        .fireToast({
          title: `Legendary ${rightBird.name} spotted!`,
          text: `A Legendary ${rightBird.name} was spotted at the ${rightBird.spot
            .split("_")
            .map((p) => p[0].toUpperCase() + p.slice(1))
            .join(" ")}! Hurry over to see it!`,
        })
        .catch(() => undefined);
    }

    // Milestone 3: Champion Birder badge to every participant.
    if (milestoneCross === "m3") {
      const participants = participantsFor({ ...collectionState, perPlayerContribution: nextPerPlayer });
      const championBadge = championBirderBadge(data.collection);
      await Promise.all(
        participants.map((pid) =>
          awardBadge(credentials, pid, championBadge, forceRefreshInventory).catch(() => undefined),
        ),
      );
      World.create(urlSlug, { credentials })
        .fireToast({
          title: "Champion Birders!",
          text: `Your world reached the final Bird Count milestone. Everyone earned the ${championBadge} badge!`,
        })
        .catch(() => undefined);
    } else if (milestoneCross === "m1" || milestoneCross === "m2") {
      const msg =
        milestoneCross === "m1"
          ? "Your world reached a Bird Count milestone! Rare birds will visit more often."
          : "Your world reached a Bird Count milestone! The Legendary bird will visit more often.";
      World.create(urlSlug, { credentials })
        .fireToast({ title: "Milestone reached!", text: msg })
        .catch(() => undefined);
    }

    const outcome: "new_species" | "repeat" = isNewSpecies ? "new_species" : "repeat";

    // Rare/Legendary repeat: fire a player-personal "find" toast (not world-wide).
    if (!isNewSpecies && (rightBird.rarity === "rare" || rightBird.rarity === "legendary")) {
      visitor
        .fireToast({
          title: `${RARITY_LABEL[rightBird.rarity]} find!`,
          text: `You spotted a ${rightBird.name}!`,
        })
        .catch(() => undefined);
    }

    return res.json({
      success: true,
      data: {
        outcome,
        rightBird,
        pickedBird,
        timesSpotted: nextRecord.timesSpotted,
        grantedBadges,
        milestoneCrossed: milestoneCross,
        legendaryAlertStarted: fireLegendaryWorldToast ? nextLegendaryAlert : undefined,
        newTotalSightings: nextTotal,
        yourSpeciesCount: totalSpeciesEver,
      },
    });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleResolveSighting",
      message: "Error resolving sighting",
      req,
      res,
    });
  }
};
