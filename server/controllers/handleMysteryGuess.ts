import { Request, Response } from "express";
import {
  errorHandler,
  getVisitor,
  getCredentials,
  awardBadges,
  getVisitorBadges,
  MYSTERY_BADGES,
  etDayKey,
  resolveTodayMystery,
  sumMysteryTotals,
  toMysteryView,
} from "@utils/index.js";
import type { VisitorMysteryBirdState } from "@shared/types/index.js";
import { sceneKey } from "@shared/types/index.js";
import { getCollectionData } from "../data/collections/index.js";

interface GuessBody {
  collectionId?: string;
  pickedBirdId?: string;
}

/**
 * POST /api/mystery/guess
 * Body: { collectionId, pickedBirdId }
 * Resolves against today's puzzle for THIS player in this scene (ET rollover).
 * Returns the updated MysteryBirdView.
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
    const key = sceneKey(urlSlug, sceneDropId);
    const today = resolveTodayMystery({
      puzzles: data.puzzles,
      stored: perScene.mysteryBird?.[collectionId],
      todayKey: etDayKey(),
      seed: `${profileId}:${key}:${collectionId}`,
    });
    if (!today) return res.status(500).json({ success: false, message: "Puzzle pick failed" });
    const { state, puzzle } = today;
    const guessedIds = state.guessedIds || [];

    if (toMysteryView({ state, puzzle, profileId, solvedTotal: 0 }).status !== "playing") {
      return res.status(400).json({ success: false, message: "Today's Mystery Bird is already resolved" });
    }
    if (![puzzle.answerId, ...puzzle.decoyIds].includes(pickedBirdId)) {
      return res.status(400).json({ success: false, message: "Picked bird is not a candidate" });
    }
    if (guessedIds.includes(pickedBirdId)) {
      return res.status(400).json({ success: false, message: "That bird was already guessed" });
    }

    const isCorrect = pickedBirdId === puzzle.answerId;
    // Built field-by-field (no spread) so legacy fields on older records aren't carried forward.
    const nextState: VisitorMysteryBirdState = {
      todayKey: state.todayKey,
      puzzleId: state.puzzleId,
      seenPuzzleIds: state.seenPuzzleIds || [],
      guessedIds: [...guessedIds, pickedBirdId],
      solvedTotal: isCorrect ? state.solvedTotal + 1 : state.solvedTotal,
      firstTryTotal: isCorrect && guessedIds.length === 0 ? state.firstTryTotal + 1 : state.firstTryTotal,
    };

    await visitor.updateDataObject(
      { [`${key}.mysteryBird.${collectionId}`]: nextState },
      {
        analytics: isCorrect
          ? [{ analyticName: "mysteryBirdSolves", uniqueKey: `${puzzle.id}:${profileId}`, urlSlug }]
          : [],
      },
    );

    // Mystery badges count across every scene and Collection.
    const totals = sumMysteryTotals(visitor.dataObject, { sceneKey: key, collectionId, state: nextState });

    // Badges on solve. Fire-and-forget so the guess response isn't blocked; each badge's
    // toast fires as soon as its grant succeeds.
    if (isCorrect) {
      const badgesToAward: string[] = [];
      if (totals.solvedTotal >= 1) badgesToAward.push(MYSTERY_BADGES.mysterySolved);
      if (totals.solvedTotal >= 5) badgesToAward.push(MYSTERY_BADGES.sharpEye);
      if (totals.solvedTotal >= 15) badgesToAward.push(MYSTERY_BADGES.birdDetective);
      if (totals.solvedTotal >= 30) badgesToAward.push(MYSTERY_BADGES.mysteryMaster);
      if (totals.firstTryTotal >= 1) badgesToAward.push(MYSTERY_BADGES.firstTry);
      const ownedBadges = getVisitorBadges(visitor);
      awardBadges(
        credentials,
        profileId,
        badgesToAward.filter((name) => !ownedBadges[name]),
        { toastVisitor: visitor },
      ).catch((error) => console.error("handleMysteryGuess: awardBadges failed", error));
    }

    const mysteryBird = toMysteryView({ state: nextState, puzzle, profileId, solvedTotal: totals.solvedTotal });

    return res.json({
      success: true,
      data: {
        outcome: isCorrect ? "solved" : mysteryBird.status === "out" ? "out" : "wrong",
        mysteryBird,
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
