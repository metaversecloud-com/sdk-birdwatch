// Client-side mirror of the NAWB bird registry — ships bundled so Field Guide/Bird Page
// render without an extra round trip. Regenerate via scripts/genCollectionData.ts if the
// server data changes.
export { birds as nawbBirds, collection as nawbCollection } from "../../../server/data/collections/northAmericanWinterBirds";
export { puzzles as nawbPuzzles } from "../../../server/data/collections/mysteryBirdPuzzles/northAmericanWinterBirds";

import { birds } from "../../../server/data/collections/northAmericanWinterBirds";
import type { Bird, SpotKey } from "@shared/types";

export const nawbById: Record<string, Bird> = Object.fromEntries(birds.map((b) => [b.id, b]));

export const nawbBySpot: Record<SpotKey, Bird[]> = {
  feeder: [],
  pine_woods: [],
  frozen_pond: [],
  berry_bushes: [],
};
for (const b of birds) nawbBySpot[b.spot].push(b);
