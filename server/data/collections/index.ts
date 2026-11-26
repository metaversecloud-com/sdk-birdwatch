import type { Bird, Collection, MysteryPuzzle, SpotKey } from "@shared/types/index.js";
import { birds as nawbBirds, collection as nawbCollection } from "./northAmericanWinterBirds.js";
import { puzzles as nawbPuzzles } from "./mysteryBirdPuzzles/northAmericanWinterBirds.js";

export interface CollectionData {
  collection: Collection;
  birdsById: Record<string, Bird>;
  birdsBySpot: Record<SpotKey, Bird[]>;
  puzzles: MysteryPuzzle[];
}

const buildCollectionData = (collection: Collection, puzzles: MysteryPuzzle[]): CollectionData => {
  const birdsById: Record<string, Bird> = {};
  const birdsBySpot: Record<SpotKey, Bird[]> = {
    feeder: [],
    pine_woods: [],
    frozen_pond: [],
    berry_bushes: [],
  };
  for (const bird of collection.species) {
    birdsById[bird.id] = bird;
    birdsBySpot[bird.spot].push(bird);
  }
  return { collection, birdsById, birdsBySpot, puzzles };
};

export const COLLECTIONS: Record<string, CollectionData> = {
  [nawbCollection.id]: buildCollectionData(nawbCollection, nawbPuzzles),
};

export const getCollectionData = (collectionId: string): CollectionData | undefined =>
  COLLECTIONS[collectionId];

export const listCollections = (): Collection[] => Object.values(COLLECTIONS).map((c) => c.collection);

export { nawbBirds, nawbCollection, nawbPuzzles };
