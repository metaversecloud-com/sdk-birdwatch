import type { MysteryPuzzle } from "@shared/types/index.js";

/** ET-day rollover (EST = -05:00; EDT = -04:00). Approximation: use America/New_York offset for the given date. */
export const etDayKey = (now: Date = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
};

/**
 * Pick today's puzzle for this player: random (excluding seen ids); when all have been seen,
 * reset the exclusion list. Deterministic within the same call via `rng` injection.
 */
export const pickTodayPuzzle = (
  allPuzzles: MysteryPuzzle[],
  seenPuzzleIds: string[],
  rng: () => number = Math.random,
): { puzzle: MysteryPuzzle; seenAfter: string[] } | undefined => {
  if (!allPuzzles.length) return undefined;
  const seen = new Set(seenPuzzleIds);
  let pool = allPuzzles.filter((p) => !seen.has(p.id));
  let reset = false;
  if (pool.length === 0) {
    pool = allPuzzles.slice();
    reset = true;
  }
  const puzzle = pool[Math.floor(rng() * pool.length)];
  const seenAfter = reset ? [puzzle.id] : [...seenPuzzleIds, puzzle.id];
  return { puzzle, seenAfter };
};

/** Mulberry32 PRNG seeded from a cheap string hash: same seed → same sequence. */
export const seededRng = (seed: string): (() => number) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    h |= 0;
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Deterministic Fisher-Yates shuffle seeded on puzzleId+profileId for stable candidate order. */
export const stableShuffleCandidateIds = (
  puzzleId: string,
  profileId: string,
  candidates: string[],
): string[] => {
  const rng = seededRng(`${puzzleId}:${profileId}`);
  const arr = candidates.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
