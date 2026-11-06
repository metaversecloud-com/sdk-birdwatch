import { Request, Response } from "express";
import {
  errorHandler,
  getVisitor,
  getWorld,
  getCredentials,
  ensureCollectionState,
  upsertEntry,
  detectMilestoneCross,
  participantsFor,
  grantSpeciesItem,
  getVisitorBirdItems,
  awardBadges,
  collectionCompleteBadge,
  championBirderBadge,
  spotBadge,
  MILESTONE_BADGES,
  TOTAL_CORRECT_ID_THRESHOLDS,
  World,
} from "@utils/index.js";
import type { Bird, LegendaryAlert } from "@shared/types/index.js";
import { RARITY_LABEL, sceneKey } from "@shared/types/index.js";
import type { DataObjectPatch } from "../types/DroppedAssetTypes.js";
import { COLLECTIONS, getCollectionData } from "../data/collections/index.js";

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

    const { visitor, perScene } = await getVisitor(credentials, true, { includeInventory: true });
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

    const world = await getWorld(credentials);
    await ensureCollectionState(world, inFlight.collectionId);
    const worldData = world.dataObject;
    const collectionState = worldData.collections![inFlight.collectionId];
    const key = sceneKey(urlSlug, sceneDropId);
    const now = Date.now();

    // Clearing rewrites the scene's whole inFlight map without this spot. Data object updates
    // can't delete a nested key (null is stored as null), so this is the only way to remove it.
    // Also drops any leftover nulls from older records.
    const remainingInFlight = Object.fromEntries(
      Object.entries(perScene.inFlight || {}).filter(([id, sighting]) => id !== assetId && sighting),
    );
    const clearInFlight = { [`${key}.inFlight`]: remainingInFlight };

    // The Field Guide (species inventory items, across every scene and world) is the source
    // of truth for species found, times spotted and every species-based badge. Each correct
    // ID adds one unit of the bird's item, so quantities count correct IDs. The current pick
    // is added in below because its item grant is fire-and-forget.
    const fieldGuide = getVisitorBirdItems(visitor);
    const isNewSpecies = !fieldGuide[rightBird.id];
    const fieldGuideBirdIds = new Set([...Object.keys(fieldGuide), rightBird.id]);
    const timesSpotted = (fieldGuide[rightBird.id]?.quantity || 0) + 1;
    const lifetimeCorrectIds = Object.values(fieldGuide).reduce((sum, b) => sum + b.quantity, 0) + 1;

    if (!isCorrect) {
      // Wrong pick: clear in-flight, no counts change, cooldown already started on click.
      await visitor.updateDataObject(
        clearInFlight,
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
    const milestoneCross = detectMilestoneCross(collectionState.totalSightings || 0, nextTotal);

    // Rarest sighting: replace if this bird is as rare or rarer than the current one (newest wins ties).
    const rarityOrder = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
    const currentRarest = collectionState.rarestSighting;
    const currentRarity = currentRarest ? data.birdsById[currentRarest.birdId]?.rarity : undefined;
    const shouldReplaceRarest = !currentRarity || rarityOrder[rightBird.rarity] >= rarityOrder[currentRarity];
    const nextRarest = shouldReplaceRarest
      ? { birdId: rightBird.id, byDisplayName: displayName || "Anonymous" }
      : currentRarest;

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
      };
      fireLegendaryWorldToast = true;
    }

    // Leaderboard species count = the player's Field Guide size.
    const nextLeaderboard = upsertEntry(
      worldData.leaderboard || {},
      profileId,
      displayName || "Anonymous",
      fieldGuideBirdIds.size,
      now,
    );

    // Update world data object.
    const worldPatch: DataObjectPatch = {
      [`collections.${inFlight.collectionId}.totalSightings`]: nextTotal,
      [`collections.${inFlight.collectionId}.perBirdSightings`]: nextPerBird,
      [`collections.${inFlight.collectionId}.perPlayerContribution`]: nextPerPlayer,
      [`collections.${inFlight.collectionId}.rarestSighting`]: nextRarest,
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

    // Visitor data: only clear the in-flight sighting. Everything else lives in inventory.
    await visitor.updateDataObject(clearInFlight, {});

    // +1 of the species ITEM on every correct ID. Fire-and-forget: the client re-opens
    // /game-state with `?forceRefreshInventory=true` to pick up the change. Blocking
    // the response on an ecosystem round-trip just delays the result banner.
    grantSpeciesItem(credentials, rightBird).catch((error) =>
      console.error("handleResolveSighting: grantSpeciesItem failed", error),
    );

    // Milestone badges (first-time only, per visitor).
    const inventoryBadgeNames = new Set(
      (visitor.inventoryItems || [])
        .filter((vi) => vi.item?.type === "BADGE")
        .map((vi) => vi.item?.name)
        .filter((n): n is string => Boolean(n)),
    );

    const totalSpeciesEver = fieldGuideBirdIds.size;
    // Collected here, granted in one fire-and-forget call below (same reasoning as
    // `grantSpeciesItem`). The next /game-state picks up the badges and fires their toasts.
    const badgesToAward: string[] = [];
    const tryAward = (name: string) => {
      if (inventoryBadgeNames.has(name)) return;
      badgesToAward.push(name);
    };

    // Field-Guide badges. Checked on every correct pick (owned badges are skipped), so a
    // badge missed earlier is picked up on the next sighting.
    const fieldGuideHasRarity = (rarity: Bird["rarity"]) =>
      [...fieldGuideBirdIds].some((id) =>
        Object.values(COLLECTIONS).some((c) => c.birdsById[id]?.rarity === rarity),
      );
    const hasAll = (birds: Bird[]) => birds.every((b) => fieldGuideBirdIds.has(b.id));

    if (totalSpeciesEver >= 1) tryAward(MILESTONE_BADGES.firstSighting);
    if (totalSpeciesEver >= 10) tryAward(MILESTONE_BADGES.avidBirder);
    if (fieldGuideHasRarity("rare")) tryAward(MILESTONE_BADGES.rareFind);
    if (fieldGuideHasRarity("legendary")) tryAward(MILESTONE_BADGES.legendaryBirder);
    if (hasAll(data.collection.species)) tryAward(collectionCompleteBadge(data.collection));
    if (hasAll(data.birdsBySpot[rightBird.spot])) tryAward(spotBadge(data.collection, rightBird.spot));

    // Total-correct-ID badges (repeats included): sum of species item quantities.
    if (lifetimeCorrectIds >= TOTAL_CORRECT_ID_THRESHOLDS.birdSpotter) {
      tryAward(MILESTONE_BADGES.birdSpotter);
    }
    if (lifetimeCorrectIds >= TOTAL_CORRECT_ID_THRESHOLDS.keenBirder) {
      tryAward(MILESTONE_BADGES.keenBirder);
    }
    if (lifetimeCorrectIds >= TOTAL_CORRECT_ID_THRESHOLDS.expertBirder) {
      tryAward(MILESTONE_BADGES.expertBirder);
    }

    awardBadges(credentials, profileId, badgesToAward).catch((error) =>
      console.error("handleResolveSighting: awardBadges failed", error),
    );

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
    // each participant gets the badge toast on their next /game-state.
    if (milestoneCross === "m3") {
      const participants = participantsFor({ ...collectionState, perPlayerContribution: nextPerPlayer });
      const championBadge = championBirderBadge(data.collection);
      for (const pid of participants) {
        awardBadges(credentials, pid, [championBadge]).catch(() => undefined);
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
        timesSpotted,
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
