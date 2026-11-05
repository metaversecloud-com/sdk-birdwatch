import type { Bird, Collection, SpotKey } from "@shared/types/index.js";

/**
 * Badge names in the ecosystem inventory catalog. These are the exact names used when
 * calling `awardBadge` — they MUST match the inventory ZIP item names 1:1.
 */

/** Cross-Collection milestone badges — count across every world / every Collection. */
export const MILESTONE_BADGES = {
  firstSighting: "First Sighting",
  avidBirder: "Avid Birder",
  rareFind: "Rare Find",
  legendaryBirder: "Legendary Birder",
  birdSpotter: "Bird Spotter",
  keenBirder: "Keen Birder",
  expertBirder: "Expert Birder",
} as const;

/** Cross-Collection Mystery Bird badges — count across every world / every Collection. */
export const MYSTERY_BADGES = {
  mysterySolved: "Mystery Solved",
  sharpEye: "Sharp Eye",
  birdDetective: "Bird Detective",
  mysteryMaster: "Mystery Master",
  firstTry: "First Try",
} as const;

/** Thresholds for the total-correct-ID milestone badges (repeats included). */
export const TOTAL_CORRECT_ID_THRESHOLDS = {
  birdSpotter: 20,
  keenBirder: 100,
  expertBirder: 500,
} as const;

/** Per-Collection badge name helpers. The Collection owns its own display names. */
export const collectionCompleteBadge = (collection: Collection): string => collection.badges.complete;
export const championBirderBadge = (collection: Collection): string => collection.badges.champion;
export const spotBadge = (collection: Collection, spot: SpotKey): string => collection.badges.spots[spot];

/** Species INVENTORY ITEM name (type=ITEM). Matches the inventory ZIP: just the bird's display name. */
export const speciesInventoryItemName = (bird: Bird): string => bird.name;
