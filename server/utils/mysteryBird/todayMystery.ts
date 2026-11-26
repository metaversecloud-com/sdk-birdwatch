import type { MysteryBirdView, MysteryPuzzle, VisitorMysteryBirdState, VisitorPerScene } from "@shared/types/index.js";
import { MAX_MYSTERY_GUESSES } from "@shared/types/index.js";
import { pickTodayPuzzle, seededRng, stableShuffleCandidateIds } from "./pickTodayPuzzle.js";

/**
 * Today's puzzle + state for one player, scene and Collection, without writing anything.
 * A new day's puzzle is picked deterministically (seeded on day + player + scene + Collection),
 * so /game-state and /mystery/guess agree on it before the first guess is saved.
 */
export const resolveTodayMystery = ({
  puzzles,
  stored,
  todayKey,
  seed,
}: {
  puzzles: MysteryPuzzle[];
  stored?: VisitorMysteryBirdState;
  todayKey: string;
  seed: string;
}): { state: VisitorMysteryBirdState; puzzle: MysteryPuzzle } | undefined => {
  if (stored?.todayKey === todayKey) {
    const puzzle = puzzles.find((p) => p.id === stored.puzzleId);
    if (puzzle) return { state: stored, puzzle };
  }
  const picked = pickTodayPuzzle(puzzles, stored?.seenPuzzleIds || [], seededRng(`${todayKey}:${seed}`));
  if (!picked) return undefined;
  return {
    puzzle: picked.puzzle,
    state: {
      todayKey,
      puzzleId: picked.puzzle.id,
      guessedIds: [],
      solvedTotal: stored?.solvedTotal || 0,
      firstTryTotal: stored?.firstTryTotal || 0,
      seenPuzzleIds: picked.seenAfter,
    },
  };
};

export const mysteryStatus = (state: VisitorMysteryBirdState, puzzle: MysteryPuzzle) => {
  const guessedIds = state.guessedIds || [];
  if (guessedIds.includes(puzzle.answerId)) return "solved" as const;
  if (guessedIds.length >= MAX_MYSTERY_GUESSES) return "out" as const;
  return "playing" as const;
};

/**
 * Sum solves and first-try solves across every scene and Collection on the visitor data object.
 * `override` swaps in a not-yet-saved state for one scene + Collection.
 */
export const sumMysteryTotals = (
  dataObject: Record<string, unknown>,
  override?: { sceneKey: string; collectionId: string; state: VisitorMysteryBirdState },
) => {
  let solvedTotal = override?.state.solvedTotal || 0;
  let firstTryTotal = override?.state.firstTryTotal || 0;
  for (const [sKey, value] of Object.entries(dataObject || {})) {
    const scene = value as VisitorPerScene | undefined;
    if (!scene || typeof scene !== "object" || !scene.mysteryBird) continue;
    for (const [cId, m] of Object.entries(scene.mysteryBird)) {
      if (override && sKey === override.sceneKey && cId === override.collectionId) continue;
      solvedTotal += m?.solvedTotal || 0;
      firstTryTotal += m?.firstTryTotal || 0;
    }
  }
  return { solvedTotal, firstTryTotal };
};

export const toMysteryView = ({
  state,
  puzzle,
  profileId,
  solvedTotal,
}: {
  state: VisitorMysteryBirdState;
  puzzle: MysteryPuzzle;
  profileId: string;
  solvedTotal: number;
}): MysteryBirdView => {
  const status = mysteryStatus(state, puzzle);
  const guessedIds = state.guessedIds || [];
  return {
    collectionId: puzzle.collectionId,
    puzzleId: puzzle.id,
    clues: puzzle.clues,
    candidateIds: stableShuffleCandidateIds(puzzle.id, profileId, [puzzle.answerId, ...puzzle.decoyIds]),
    guessedIds,
    guessesLeft: status === "playing" ? MAX_MYSTERY_GUESSES - guessedIds.length : 0,
    status,
    // Withheld while playing so the answer can't be read from the network response.
    answerId: status === "playing" ? undefined : puzzle.answerId,
    solvedTotal,
  };
};
