import type { SpotKey } from "./BirdTypes.js";

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
  byDisplayName: string;
}

export interface LegendaryAlert {
  alertId: string;
  birdId: string;
  spot: SpotKey;
  firedAt: number;
}

/** Stored on the world data object, per Collection. */
export interface CollectionWorldState {
  sceneDropId?: string;
  totalSightings: number;
  perBirdSightings: Record<string, number>;
  perPlayerContribution: Record<string, number>;
  rarestSighting?: RarestSighting;
  activeLegendaryAlert?: LegendaryAlert;
}

/** CollectionWorldState plus values derived on read (never stored). */
export interface CollectionWorldStateView extends CollectionWorldState {
  milestones: MilestoneState;
  mostSpotted: MostSpotted[];
}

export type LeaderboardEntryString = string;

export interface WorldState {
  adminSettings: AdminSettings;
  collections: Record<string, CollectionWorldState>;
  leaderboard: Record<string, LeaderboardEntryString>;
}

export interface VisitorInFlightSighting {
  collectionId: string;
  birdId: string;
  choiceBirdIds: [string, string, string];
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
  solvedTotal: number;
  firstTryTotal: number;
  seenPuzzleIds: string[];
}

/**
 * Per-scene visitor state. Anything the Field Guide (species inventory items) can answer,
 * like species found or times spotted, is NOT stored here: inventory is the source of truth.
 */
export interface VisitorPerScene {
  /** assetId → cooldown end time (ms). */
  spotCooldowns: Record<string, number>;
  inFlight?: Record<string, VisitorInFlightSighting>;
  legendaryAlertUsage?: VisitorLegendaryAlertUsage;
  mysteryBird?: Record<string, VisitorMysteryBirdState>;
}

export const sceneKey = (urlSlug: string, sceneDropId: string): string => `${urlSlug}-${sceneDropId}`;

export interface GameStateResponse {
  isAdmin: boolean;
  collectionId: string;
  sceneDropId: string;
  adminSettings: AdminSettings;
  worldState: CollectionWorldStateView;
  leaderboard: Record<string, LeaderboardEntryString>;
}
