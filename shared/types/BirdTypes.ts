export type Rarity = "common" | "uncommon" | "rare" | "legendary";

export const SPOT_KEYS = ["feeder", "pine_woods", "frozen_pond", "berry_bushes"] as const;
export type SpotKey = (typeof SPOT_KEYS)[number];

/** "1 minute", "5 minutes", "1 hour" — for player-facing copy. */
export const formatDuration = (seconds: number): string => {
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (seconds >= 3600 && seconds % 3600 === 0) return plural(seconds / 3600, "hour");
  if (seconds >= 60 && seconds % 60 === 0) return plural(seconds / 60, "minute");
  return plural(seconds, "second");
};

export const SPOT_LABELS: Record<SpotKey, string> = {
  feeder: "Feeder",
  pine_woods: "Pine Woods",
  frozen_pond: "Frozen Pond",
  berry_bushes: "Berry Bushes",
};

export interface Bird {
  id: string;
  name: string;
  collectionId: string;
  spot: SpotKey;
  rarity: Rarity;
  draw: string;
  eats: string[];
  nests: string[];
  behavior: string;
  fieldMark: string;
  looksKeywords: string[];
  call: string;
  funFact: string;
  allAboutBirdsUrl: string;
  callAudioUrl?: string;
  sortOrder: number;
}

export interface CollectionBadgeNames {
  /** Awarded when the visitor has found every bird in this Collection. */
  complete: string;
  /** Awarded to every participant when this world reaches M3 for this Collection. */
  champion: string;
  /** Per-spot completion badges: awarded when the visitor has found every bird at that spot. */
  spots: Record<SpotKey, string>;
}

export interface Collection {
  id: string;
  name: string;
  species: Bird[];
  /** Badge names for this Collection (per-collection, so the UI reads the right display name). */
  badges: CollectionBadgeNames;
}

export const RARITY_WEIGHT_BASE: Record<Rarity, number> = {
  common: 60,
  uncommon: 24,
  rare: 12,
  legendary: 3,
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
};

export const RARITY_STARS: Record<Rarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  legendary: 4,
};
