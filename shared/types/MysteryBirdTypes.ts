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
