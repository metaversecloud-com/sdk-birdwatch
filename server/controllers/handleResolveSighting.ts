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
  collectionCompleteBadge,
  championBirderBadge,
  spotBadge,
  MILESTONE_BADGES,
  TOTAL_CORRECT_ID_THRESHOLDS,
  World,
} from "@utils/index.js";
import type { LegendaryAlert, VisitorBirdRecord, VisitorPerScene } from "@shared/types/index.js";
import { RARITY_LABEL, sceneKey } from "@shared/types/index.js";
import type { DataObjectPatch } from "../types/DroppedAssetTypes.js";
import { getCollectionData } from "../data/collections/index.js";

/** Sum of timesSpotted across every scene / collection / bird on the visitor's dataObject. */
const sumLifetimeCorrectIds = (dataObject: Record<string, VisitorPerScene | undefined>): number => {
  let total = 0;
  for (const scene of Object.values(dataObject || {})) {
    if (!scene || typeof scene !== "object" || !scene.collections) continue;
    for (const col of Object.values(scene.collections)) {
      for (const rec of Object.values(col?.birdRecords || {})) {
        total += rec?.timesSpotted || 0;
      }
    }
  }
  return total;
};

const LEGENDARY_WINDOW_MS = 5 * 60 * 1000;

interface ResolveBody {
  pickedBirdId?: string;
}

export const handleResolveSighting = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { assetId, urlSlug, sceneDropId, profileId, displayName } = credentials;
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
          analytics: [{ analyticName: "birdIDs-wrong", uniqueKey: profileId, urlSlug }],
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
    const alertStillFresh = nextLegendaryAlert && now - nextLegendaryAlert.firedAt < LEGENDARY_WINDOW_MS;
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
    await world.updateDataObject(worldPatch, {
      analytics: [
        { analyticName: "birdIDs-correct", uniqueKey: profileId, urlSlug },
        { analyticName: `sightings-${rightBird.rarity}`, uniqueKey: profileId, urlSlug },
        ...(isNewSpecies ? [{ analyticName: "speciesLogs", uniqueKey: profileId, urlSlug }] : []),
        ...(milestoneCross
          ? [{ analyticName: "milestoneReaches", uniqueKey: `${inFlight.collectionId}:${milestoneCross}` }]
          : []),
        ...(fireLegendaryWorldToast
          ? [{ analyticName: "legendaryAlerts", uniqueKey: `${inFlight.collectionId}:${now}` }]
          : []),
      ],
    });

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

    // Grant the species ITEM (Field Guide entry). Fire-and-forget: the client re-opens
    // /game-state with `?forceRefreshInventory=true` to pick up the new item. Blocking
    // the response on an ecosystem round-trip just delays the result banner.
    if (isNewSpecies) {
      grantSpeciesItem(credentials, rightBird).catch(() => undefined);
    }

    // Milestone badges (first-time only, per visitor).
    const inventoryBadgeNames = new Set(
      (visitor.inventoryItems || [])
        .filter((vi) => vi.item?.type === "BADGE")
        .map((vi) => vi.item?.name)
        .filter((n): n is string => Boolean(n)),
    );

    const totalSpeciesEver = allVisitorBirdIds.size;
    // Lifetime correct IDs (repeats included) across every scene, every Collection, every bird —
    // + the +1 we're about to apply for this correct pick.
    const lifetimeCorrectIds = sumLifetimeCorrectIds(visitor.dataObject) + 1;
    // Fire-and-forget: same reasoning as `grantSpeciesItem` above. The next
    // /game-state?forceRefreshInventory=true picks up any newly-granted badge.
    const tryAward = (name: string) => {
      if (inventoryBadgeNames.has(name)) return;
      awardBadge(credentials, profileId, name).catch(() => undefined);
    };

    // Field-Guide milestone badges (unique species across all Collections).
    if (totalSpeciesEver >= 1) tryAward(MILESTONE_BADGES.firstSighting);
    if (totalSpeciesEver >= 10) tryAward(MILESTONE_BADGES.avidBirder);
    if (isNewSpecies && rightBird.rarity === "rare") tryAward(MILESTONE_BADGES.rareFind);
    if (isNewSpecies && rightBird.rarity === "legendary") tryAward(MILESTONE_BADGES.legendaryBirder);

    // Total-correct-ID milestone badges (repeats included).
    if (lifetimeCorrectIds >= TOTAL_CORRECT_ID_THRESHOLDS.birdSpotter) {
      tryAward(MILESTONE_BADGES.birdSpotter);
    }
    if (lifetimeCorrectIds >= TOTAL_CORRECT_ID_THRESHOLDS.keenBirder) {
      tryAward(MILESTONE_BADGES.keenBirder);
    }
    if (lifetimeCorrectIds >= TOTAL_CORRECT_ID_THRESHOLDS.expertBirder) {
      tryAward(MILESTONE_BADGES.expertBirder);
    }

    // Per-Collection badges.
    if (newUniqueCount >= data.collection.species.length) {
      // Collection complete — visitor has every bird in this Collection.
      tryAward(collectionCompleteBadge(data.collection));
    }

    // Per-spot completion badge: if the visitor now has every bird at this bird's spot
    // (within this Collection), award the spot badge.
    if (isNewSpecies) {
      const spotBirds = data.birdsBySpot[rightBird.spot];
      const haveAtSpot = spotBirds.every((b) => b.id === rightBird.id || Boolean(perColVisitor[b.id]));
      if (haveAtSpot) tryAward(spotBadge(data.collection, rightBird.spot));
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

    // Milestone 3: Champion Birder badge to every participant. Fire-and-forget per-pid;
    // each participant picks up the badge on their next /game-state?forceRefreshInventory=true.
    if (milestoneCross === "m3") {
      const participants = participantsFor({ ...collectionState, perPlayerContribution: nextPerPlayer });
      const championBadge = championBirderBadge(data.collection);
      for (const pid of participants) {
        awardBadge(credentials, pid, championBadge).catch(() => undefined);
      }
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
