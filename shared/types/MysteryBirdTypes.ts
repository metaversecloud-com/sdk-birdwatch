export type ClueType = "Looks" | "Spot" | "Eats" | "Nests" | "Behavior";

export interface MysteryClue {
  type: ClueType;
  short: string;
  text: string;
}

export interface MysteryPuzzle {
  id: string;
  collectionId: string;
  answerId: string;
  answerSpot: string;
  clues: [MysteryClue, MysteryClue, MysteryClue];
  decoyIds: [string, string, string];
}

export const MAX_MYSTERY_GUESSES = 2;

export type MysteryStatus = "playing" | "solved" | "out";

/** Today's Mystery Bird as sent to the client. The answer is only included once the player is done. */
export interface MysteryBirdView {
  collectionId: string;
  puzzleId: string;
  clues: MysteryClue[];
  /** Answer + decoys, in a stable per-player shuffled order. */
  candidateIds: string[];
  /** Birds guessed today, in order. */
  guessedIds: string[];
  guessesLeft: number;
  status: MysteryStatus;
  answerId?: string;
  /** Mystery Birds solved across every scene and Collection. */
  solvedTotal: number;
}
