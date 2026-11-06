import type { Bird, SpotKey } from "@shared/types/index.js";
import { getCollectionData } from "../data/collections/index.js";

export const pickChoices = (
  collectionId: string,
  spot: SpotKey,
  rightBird: Bird,
  rng: () => number = Math.random,
): [Bird, Bird, Bird] => {
  const data = getCollectionData(collectionId);
  if (!data) throw new Error(`Unknown collectionId: ${collectionId}`);

  const sameSpotPool = data.birdsBySpot[spot].filter((b) => b.id !== rightBird.id);
  if (sameSpotPool.length === 0) throw new Error(`No same-spot wrong choice available for ${spot}`);
  const wrong1 = sameSpotPool[Math.floor(rng() * sameSpotPool.length)];

  const anywherePool = data.collection.species.filter((b) => b.id !== rightBird.id && b.id !== wrong1.id);
  if (anywherePool.length === 0) throw new Error(`No second wrong choice available`);
  const wrong2 = anywherePool[Math.floor(rng() * anywherePool.length)];

  const choices: [Bird, Bird, Bird] = [rightBird, wrong1, wrong2];
  // Fisher-Yates
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  return choices;
};
