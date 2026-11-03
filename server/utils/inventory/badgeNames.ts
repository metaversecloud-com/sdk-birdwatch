import type { Bird, Collection } from "@shared/types/index.js";

export const BADGE_PREFIX = "Birdwatch — ";

/** Species BADGE name (type=BADGE). Example: "Birdwatch — Black-capped Chickadee". */
export const speciesBadgeName = (bird: Bird): string => `${BADGE_PREFIX}${bird.name}`;

/** Species INVENTORY ITEM name (type=ITEM). Matches the inventory ZIP: just the bird's display name. */
export const speciesInventoryItemName = (bird: Bird): string => bird.name;

export const collectionCompleteBadge = (collection: Collection): string =>
  `${BADGE_PREFIX}Complete · ${collection.name}`;

export const championBirderBadge = (collection: Collection): string =>
  `${BADGE_PREFIX}Champion Birder · ${collection.name}`;

export const MILESTONE_BADGES = {
  firstSighting: `${BADGE_PREFIX}First Sighting`,
  avidBirder: `${BADGE_PREFIX}Avid Birder`,
  rareFind: `${BADGE_PREFIX}Rare Find`,
  legendaryBirder: `${BADGE_PREFIX}Legendary Birder`,
} as const;

export const MYSTERY_BADGES = {
  mysterySolved: `${BADGE_PREFIX}Mystery Solved`,
  sharpEye: `${BADGE_PREFIX}Sharp Eye`,
  birdDetective: `${BADGE_PREFIX}Bird Detective`,
  mysteryMaster: `${BADGE_PREFIX}Mystery Master`,
  firstTry: `${BADGE_PREFIX}First Try`,
} as const;
