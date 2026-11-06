import { Request, Response } from "express";
import {
  errorHandler,
  getVisitor,
  getCredentials,
  awardBadges,
  getVisitorBadges,
  MYSTERY_BADGES,
  etDayKey,
  pickTodayPuzzle,
  stableShuffleCandidateIds,
} from "@utils/index.js";
import type { VisitorMysteryBirdState, VisitorPerScene } from "@shared/types/index.js";
import { sceneKey } from "@shared/types/index.js";
import { getCollectionData } from "../data/collections/index.js";

interface GuessBody {
  collectionId?: string;
  pickedBirdId?: string;
}

const emptyMystery = (todayKey: string, puzzleId: string): VisitorMysteryBirdState => ({
  todayKey,
  puzzleId,
  guessesUsed: 0,
  solved: false,
  solvedTotal: 0,
  firstTryTotal: 0,
  seenPuzzleIds: [],
});

/**
 * POST /api/mystery/guess
 * Body: { collectionId, pickedBirdId }
 * Resolves against today's puzzle for THIS player (per-player random pick, ET rollover).
 */
export const handleMysteryGuess = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { urlSlug, sceneDropId, profileId } = credentials;
    const { collectionId, pickedBirdId } = (req.body || {}) as GuessBody;

    if (!collectionId || !pickedBirdId) {
      return res.status(400).json({ success: false, message: "collectionId and pickedBirdId are required" });
    }

    const data = getCollectionData(collectionId);
    if (!data) return res.status(400).json({ success: false, message: "Unknown collection" });
    if (!data.puzzles?.length) {
      return res.status(400).json({ success: false, message: "No Mystery Bird puzzles for this collection" });
    }

    const { visitor, perScene } = await getVisitor(credentials, true, { includeInventory: true });
    const todayKey = etDayKey();
    const key = sceneKey(urlSlug, sceneDropId);
    let state = perScene.mysteryBird?.[collectionId];

    // Rollover: fresh day → pick a new puzzle for this player.
    if (!state || state.todayKey !== todayKey) {
      const picked = pickTodayPuzzle(data.puzzles, state?.seenPuzzleIds || []);
      if (!picked) return res.status(500).json({ success: false, message: "Puzzle pick failed" });
      state = {
        ...emptyMystery(todayKey, picked.puzzle.id),
        solvedTotal: state?.solvedTotal || 0,
        firstTryTotal: state?.firstTryTotal || 0,
        seenPuzzleIds: picked.seenAfter,
      };
    }

    if (state.solved || state.guessesUsed >= 2) {
      return res.status(400).json({ success: false, message: "Today's Mystery Bird is already resolved" });
    }

    const puzzle = data.puzzles.find((p) => p.id === state!.puzzleId);
    if (!puzzle) return res.status(500).json({ success: false, message: "Puzzle not found" });

    const candidates = stableShuffleCandidateIds(puzzle.id, profileId, [puzzle.answerId, ...puzzle.decoyIds]);
    if (!candidates.includes(pickedBirdId)) {
      return res.status(400).json({ success: false, message: "Picked bird is not a candidate" });
    }

    const isCorrect = pickedBirdId === puzzle.answerId;
    const guessesUsed = state.guessesUsed + 1;
    // Built field-by-field (no spread) so legacy fields on older records aren't carried forward.
    const nextState: VisitorMysteryBirdState = {
      todayKey: state.todayKey,
      puzzleId: state.puzzleId,
      seenPuzzleIds: state.seenPuzzleIds || [],
      guessesUsed,
      solved: isCorrect,
      solvedTotal: isCorrect ? state.solvedTotal + 1 : state.solvedTotal,
      firstTryTotal: isCorrect && state.guessesUsed === 0 ? state.firstTryTotal + 1 : state.firstTryTotal,
    };

    await visitor.updateDataObject(
      { [`${key}.mysteryBird.${collectionId}`]: nextState },
      {
        analytics: isCorrect
          ? [{ analyticName: "mysteryBirdSolves", uniqueKey: `${puzzle.id}:${profileId}`, urlSlug }]
          : [],
      },
    );

    // Badges on solve. Fire-and-forget: the next /game-state picks up any newly-granted
    // badge and fires its toast, so we don't block the guess response on it.
    // Mystery badges count across every scene and Collection, so totals are summed over the
    // whole visitor data object, with this scene + Collection's entry replaced by nextState.
    if (isCorrect) {
      let solvedTotal = nextState.solvedTotal;
      let firstTryTotal = nextState.firstTryTotal;
      for (const [sKey, value] of Object.entries(visitor.dataObject || {})) {
        const scene = value as VisitorPerScene | undefined;
        if (!scene || typeof scene !== "object" || !scene.mysteryBird) continue;
        for (const [cId, m] of Object.entries(scene.mysteryBird)) {
          if (sKey === key && cId === collectionId) continue;
          solvedTotal += m?.solvedTotal || 0;
          firstTryTotal += m?.firstTryTotal || 0;
        }
      }

      const badgesToAward: string[] = [];
      if (solvedTotal >= 1) badgesToAward.push(MYSTERY_BADGES.mysterySolved);
      if (solvedTotal >= 5) badgesToAward.push(MYSTERY_BADGES.sharpEye);
      if (solvedTotal >= 15) badgesToAward.push(MYSTERY_BADGES.birdDetective);
      if (solvedTotal >= 30) badgesToAward.push(MYSTERY_BADGES.mysteryMaster);
      if (firstTryTotal >= 1) badgesToAward.push(MYSTERY_BADGES.firstTry);
      const ownedBadges = getVisitorBadges(visitor);
      awardBadges(
        credentials,
        profileId,
        badgesToAward.filter((name) => !ownedBadges[name]),
      ).catch((error) => console.error("handleMysteryGuess: awardBadges failed", error));
    }

    return res.json({
      success: true,
      data: {
        outcome: isCorrect ? "solved" : guessesUsed >= 2 ? "out" : "wrong",
        answerBirdId: puzzle.answerId,
        answerSpot: puzzle.answerSpot,
        guessesLeft: Math.max(0, 2 - guessesUsed),
        state: nextState,
      },
    });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleMysteryGuess",
      message: "Error resolving Mystery Bird guess",
      req,
      res,
    });
  }
};
