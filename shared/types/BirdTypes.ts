export type Rarity = "common" | "uncommon" | "rare" | "legendary";

export const SPOT_KEYS = ["feeder", "pine_woods", "frozen_pond", "berry_bushes"] as const;
export type SpotKey = (typeof SPOT_KEYS)[number];

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

export interface Collection {
  id: string;
  name: string;
  species: Bird[];
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
