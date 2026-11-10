import type { SpotKey } from "./BirdTypes.js";
import type { MysteryBirdView } from "./MysteryBirdTypes.js";

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
  /** When the Legendary leaves (ms). The window is the admin cooldown setting at the time it was found. */
  expiresAt: number;
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
  /**
   * profileId → species found in this world, across every Collection. Inventory can't say
   * which world a bird was found in, so the leaderboard's species count is kept here.
   * Cleared with the leaderboard; untouched by a Bird Count reset.
   */
  leaderboardSpecies: Record<string, string[]>;
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
  /** Birds guessed today, in order. Guesses used and solved are derived from this. */
  guessedIds: string[];
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
  /** Today's Mystery Bird for this Collection, when it has puzzles. */
  mysteryBird?: MysteryBirdView;
}
