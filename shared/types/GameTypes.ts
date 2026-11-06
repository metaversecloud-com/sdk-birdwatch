import type { Rarity, SpotKey } from "./BirdTypes.js";

export type IdentificationMode = "description" | "picture_match";

export const COOLDOWN_OPTIONS = [60, 120, 300, 3600] as const;
export type CooldownOption = (typeof COOLDOWN_OPTIONS)[number];

export interface AdminSettings {
  identificationMode: IdentificationMode;
  cooldownSeconds: CooldownOption;
  allAboutBirdsLinksEnabled: boolean;
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  identificationMode: "description",
  cooldownSeconds: 60,
  allAboutBirdsLinksEnabled: true,
};

export interface MilestoneState {
  rareBoostUnlocked: boolean;
  legendaryBoostUnlocked: boolean;
  championBadgeUnlocked: boolean;
}

export interface MilestoneConfig {
  m1: number;
  m2: number;
  m3: number;
}

export const DEFAULT_MILESTONES: MilestoneConfig = { m1: 500, m2: 1500, m3: 2500 };

export interface MostSpotted {
  birdId: string;
  count: number;
}

export interface RarestSighting {
  birdId: string;
  rarity: Rarity;
  byDisplayName: string;
  bySightingAt: number;
}

export interface LegendaryAlert {
  alertId: string;
  birdId: string;
  spot: SpotKey;
  firedAt: number;
  byProfileId: string;
  byDisplayName: string;
}

export interface CollectionWorldState {
  collectionId: string;
  sceneDropId?: string;
  totalSightings: number;
  perBirdSightings: Record<string, number>;
  perPlayerContribution: Record<string, number>;
  milestones: MilestoneState;
  mostSpotted: MostSpotted[];
  rarestSighting?: RarestSighting;
  activeLegendaryAlert?: LegendaryAlert;
}

export type LeaderboardEntryString = string;

export interface WorldState {
  adminSettings: AdminSettings;
  collections: Record<string, CollectionWorldState>;
  leaderboard: Record<string, LeaderboardEntryString>;
}

export interface VisitorBirdRecord {
  firstSpottedAt: number;
  timesSpotted: number;
}

export interface VisitorCollectionData {
  birdRecords: Record<string, VisitorBirdRecord>;
  milestoneBannerSeen: Partial<Record<"m1" | "m2" | "m3", boolean>>;
}

export interface VisitorSpotCooldown {
  startedAt: number;
  durationSeconds: CooldownOption;
}

export interface VisitorInFlightSighting {
  assetId: string;
  spotKey: SpotKey;
  collectionId: string;
  birdId: string;
  choiceBirdIds: [string, string, string];
  rolledAt: number;
  isLegendarySkip?: boolean;
}

export interface VisitorLegendaryAlertUsage {
  alertId: string;
  usedAssetIds: string[];
}

export interface VisitorMysteryBirdState {
  todayKey: string;
  puzzleId: string;
  guessesUsed: number;
  solved: boolean;
  solvedOnFirstTry: boolean;
  solvedTotal: number;
  firstTryTotal: number;
  openedCards: Partial<Record<"clue1" | "clue2" | "clue3", true>>;
  openedBirdCards: string[];
  seenPuzzleIds: string[];
}

export interface VisitorPerScene {
  collections: Record<string, VisitorCollectionData>;
  spotCooldowns: Record<string, VisitorSpotCooldown>;
  inFlight?: Record<string, VisitorInFlightSighting>;
  perWorldSpeciesReachedAt?: number;
  legendaryAlertUsage?: VisitorLegendaryAlertUsage;
  mysteryBird?: Record<string, VisitorMysteryBirdState>;
}

export const sceneKey = (urlSlug: string, sceneDropId: string): string => `${urlSlug}-${sceneDropId}`;

export interface GameStateResponse {
  isAdmin: boolean;
  collectionId: string;
  sceneDropId: string;
  adminSettings: AdminSettings;
  worldState: CollectionWorldState;
  leaderboard: Record<string, LeaderboardEntryString>;
  visitorScene: VisitorPerScene;
  pendingBanners: {
    milestone?: "m1" | "m2" | "m3";
    legendaryAlert?: LegendaryAlert;
  };
}
