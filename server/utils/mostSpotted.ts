import type { MostSpotted } from "@shared/types/index.js";

/** Top 3 species by count, deterministic tie-break by birdId. */
export const computeMostSpotted = (perBirdSightings: Record<string, number>): MostSpotted[] => {
  const entries = Object.entries(perBirdSightings).map(([birdId, count]) => ({ birdId, count }));
  entries.sort((a, b) => b.count - a.count || a.birdId.localeCompare(b.birdId));
  return entries.slice(0, 3);
};
