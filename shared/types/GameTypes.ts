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

export const MILESTONE_KEYS = ["m1", "m2", "m3"] as const;
export type MilestoneKey = (typeof MILESTONE_KEYS)[number];

export const MILESTONE_DIFFICULTIES = ["easy", "default", "hard"] as const;
export type MilestoneDifficulty = (typeof MILESTONE_DIFFICULTIES)[number];

const DIFFICULTY_MULTIPLIER: Record<MilestoneDifficulty, number> = { easy: 0.5, default: 1, hard: 2 };

export const milestonesForDifficulty = (difficulty: MilestoneDifficulty): MilestoneConfig => ({
  m1: DEFAULT_MILESTONES.m1 * DIFFICULTY_MULTIPLIER[difficulty],
  m2: DEFAULT_MILESTONES.m2 * DIFFICULTY_MULTIPLIER[difficulty],
  m3: DEFAULT_MILESTONES.m3 * DIFFICULTY_MULTIPLIER[difficulty],
});

/**
 * Stored on the key asset's data object as `milestones`: a difficulty name, or custom goals
 * set by hand in the data object (`{ m1, m2, m3 }`). Custom goals can't be set from the UI.
 */
export type MilestoneSetting = MilestoneDifficulty | MilestoneConfig;

export interface ResolvedMilestones {
  difficulty: MilestoneDifficulty | "custom";
  config: MilestoneConfig;
}

const isValidCustom = (v: unknown): v is MilestoneConfig => {
  const c = v as Partial<MilestoneConfig> | null;
  if (!c || typeof c !== "object") return false;
  const goals = MILESTONE_KEYS.map((k) => c[k]);
  return (
    goals.every((g) => typeof g === "number" && Number.isInteger(g) && g > 0) &&
    goals[0]! < goals[1]! &&
    goals[1]! < goals[2]!
  );
};

/** Missing or invalid settings fall back to Default. */
export const resolveMilestones = (setting: unknown): ResolvedMilestones => {
  if (typeof setting === "string" && (MILESTONE_DIFFICULTIES as readonly string[]).includes(setting)) {
    const difficulty = setting as MilestoneDifficulty;
    return { difficulty, config: milestonesForDifficulty(difficulty) };
  }
  if (isValidCustom(setting)) {
    return { difficulty: "custom", config: { m1: setting.m1, m2: setting.m2, m3: setting.m3 } };
  }
  return { difficulty: "default", config: DEFAULT_MILESTONES };
};

/**
 * Milestones a switch would unlock without ever firing: not reached under the current goals,
 * but already at or below the World Bird Count under the new ones. A switch is blocked when
 * this is non-empty. Milestones already reached stay reached, so they never block.
 */
export const milestonesSkippedBySwitch = (
  current: MilestoneConfig,
  next: MilestoneConfig,
  totalSightings: number,
): MilestoneKey[] => MILESTONE_KEYS.filter((k) => current[k] > totalSightings && next[k] <= totalSightings);

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
  /** This scene's milestone goals (from the key asset's `milestones` setting). */
  milestones: ResolvedMilestones;
  leaderboard: Record<string, LeaderboardEntryString>;
  /** Today's Mystery Bird for this Collection, when it has puzzles. */
  mysteryBird?: MysteryBirdView;
}
