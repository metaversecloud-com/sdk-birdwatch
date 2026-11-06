import type { CollectionWorldState, MilestoneConfig, MilestoneState } from "@shared/types/index.js";
import { DEFAULT_MILESTONES } from "@shared/types/index.js";

export type MilestoneKey = "m1" | "m2" | "m3";

export const DEFAULT_MILESTONE_STATE: MilestoneState = {
  rareBoostUnlocked: false,
  legendaryBoostUnlocked: false,
  championBadgeUnlocked: false,
};

/** Returns the newly-crossed milestone (if any) given old vs. new total. */
export const detectMilestoneCross = (
  prev: number,
  next: number,
  config: MilestoneConfig = DEFAULT_MILESTONES,
): MilestoneKey | undefined => {
  if (prev < config.m1 && next >= config.m1) return "m1";
  if (prev < config.m2 && next >= config.m2) return "m2";
  if (prev < config.m3 && next >= config.m3) return "m3";
  return undefined;
};

export const applyMilestone = (state: MilestoneState, which: MilestoneKey): MilestoneState => {
  const copy = { ...state };
  if (which === "m1") copy.rareBoostUnlocked = true;
  if (which === "m2") copy.legendaryBoostUnlocked = true;
  if (which === "m3") copy.championBadgeUnlocked = true;
  return copy;
};

/** Who should receive the Champion Birder badge when M3 fires. */
export const participantsFor = (collectionState: CollectionWorldState): string[] =>
  Object.keys(collectionState.perPlayerContribution || {});
