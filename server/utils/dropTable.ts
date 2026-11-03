import type { Bird, MilestoneState, Rarity, SpotKey } from "@shared/types/index.js";
import { RARITY_WEIGHT_BASE } from "@shared/types/index.js";
import { getCollectionData } from "../data/collections/index.js";

export const effectiveWeight = (rarity: Rarity, milestones: MilestoneState): number => {
  const base = RARITY_WEIGHT_BASE[rarity];
  if (rarity === "rare" && milestones.rareBoostUnlocked) return base * 2;
  if (rarity === "legendary" && milestones.legendaryBoostUnlocked) return base * 2;
  return base;
};

/** Weighted pick: a bird's weight is its tier's (boosted) weight; probability is that / sum. */
export const rollBirdForSpot = (
  collectionId: string,
  spot: SpotKey,
  milestones: MilestoneState,
  rng: () => number = Math.random,
): Bird => {
  const data = getCollectionData(collectionId);
  if (!data) throw new Error(`Unknown collectionId: ${collectionId}`);
  const pool = data.birdsBySpot[spot];
  if (!pool || pool.length === 0) throw new Error(`No birds for spot: ${spot}`);

  const weights = pool.map((b) => effectiveWeight(b.rarity, milestones));
  const total = weights.reduce((a, b) => a + b, 0);
  const r = rng() * total;

  let acc = 0;
  for (let i = 0; i < pool.length; i++) {
    acc += weights[i];
    if (r < acc) return pool[i];
  }
  return pool[pool.length - 1];
};
