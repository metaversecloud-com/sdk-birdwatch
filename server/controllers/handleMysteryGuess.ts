import { Request, Response } from "express";
import {
  errorHandler,
  getBirdwatchVisitor,
  getCredentials,
  awardBadge,
  MYSTERY_BADGES,
  etDayKey,
  pickTodayPuzzle,
  stableShuffleCandidateIds,
} from "@utils/index.js";
import type { VisitorMysteryBirdState } from "@shared/types/index.js";
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
  solvedOnFirstTry: false,
  solvedTotal: 0,
  firstTryTotal: 0,
  openedCards: {},
  openedBirdCards: [],
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
    const forceRefreshInventory = req.query.forceRefreshInventory === "true";
    const { collectionId, pickedBirdId } = (req.body || {}) as GuessBody;

    if (!collectionId || !pickedBirdId) {
      return res.status(400).json({ success: false, message: "collectionId and pickedBirdId are required" });
    }

    const data = getCollectionData(collectionId);
    if (!data) return res.status(400).json({ success: false, message: "Unknown collection" });
    if (!data.puzzles?.length) {
      return res.status(400).json({ success: false, message: "No Mystery Bird puzzles for this collection" });
    }

    const { visitor, perScene } = await getBirdwatchVisitor(credentials, true, { includeInventory: true });
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
    const nextState: VisitorMysteryBirdState = {
      ...state,
      guessesUsed,
      solved: isCorrect,
      solvedOnFirstTry: isCorrect && state.guessesUsed === 0,
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

    // Badges on solve.
    const grantedBadges: string[] = [];
    const tryAward = async (name: string) => {
      const r = await awardBadge(credentials, profileId, name, forceRefreshInventory).catch(() => ({
        granted: false,
      }));
      if (r.granted) grantedBadges.push(name);
    };
    if (isCorrect) {
      if (nextState.solvedTotal >= 1) await tryAward(MYSTERY_BADGES.mysterySolved);
      if (nextState.solvedTotal >= 5) await tryAward(MYSTERY_BADGES.sharpEye);
      if (nextState.solvedTotal >= 15) await tryAward(MYSTERY_BADGES.birdDetective);
      if (nextState.solvedTotal >= 30) await tryAward(MYSTERY_BADGES.mysteryMaster);
      if (nextState.firstTryTotal >= 1) await tryAward(MYSTERY_BADGES.firstTry);
    }

    return res.json({
      success: true,
      data: {
        outcome: isCorrect ? "solved" : guessesUsed >= 2 ? "out" : "wrong",
        answerBirdId: puzzle.answerId,
        answerSpot: puzzle.answerSpot,
        guessesLeft: Math.max(0, 2 - guessesUsed),
        grantedBadges,
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
