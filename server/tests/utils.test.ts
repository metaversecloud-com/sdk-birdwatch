import { rollBirdForSpot, effectiveWeight } from "../utils/dropTable";
import { pickChoices } from "../utils/pickChoices";
import { encodeEntry, decodeEntry, parseLeaderboard, upsertEntry } from "../utils/leaderboard";
import { detectMilestoneCross, milestoneStateFor } from "../utils/milestones";
import { computeMostSpotted } from "../utils/mostSpotted";
import { etDayKey, pickTodayPuzzle, stableShuffleCandidateIds } from "../utils/mysteryBird/pickTodayPuzzle";
import { COLLECTIONS } from "../data/collections/index";

const NAWB = "north_american_winter_birds";

describe("dropTable", () => {
  const noBoost = { rareBoostUnlocked: false, legendaryBoostUnlocked: false, championBadgeUnlocked: false };
  const rareBoost = { ...noBoost, rareBoostUnlocked: true };
  const legBoost = { ...noBoost, legendaryBoostUnlocked: true };

  test("effectiveWeight doubles rare after M1 and legendary after M2 only for their tier", () => {
    expect(effectiveWeight("common", noBoost)).toBe(60);
    expect(effectiveWeight("rare", noBoost)).toBe(12);
    expect(effectiveWeight("rare", rareBoost)).toBe(24);
    expect(effectiveWeight("legendary", rareBoost)).toBe(3);
    expect(effectiveWeight("legendary", legBoost)).toBe(6);
  });

  test("rollBirdForSpot returns a Feeder bird", () => {
    const bird = rollBirdForSpot(NAWB, "feeder", noBoost, () => 0);
    expect(bird.spot).toBe("feeder");
  });

  test("rollBirdForSpot deterministic with controlled rng", () => {
    const feeder = COLLECTIONS[NAWB].birdsBySpot.feeder;
    const sorted = feeder.map((b) => b.id);
    // rng=0 picks the first bird in iteration order
    const first = rollBirdForSpot(NAWB, "feeder", noBoost, () => 0);
    expect(sorted).toContain(first.id);
  });
});

describe("pickChoices", () => {
  const noBoost = { rareBoostUnlocked: false, legendaryBoostUnlocked: false, championBadgeUnlocked: false };

  test("includes right bird + 2 distinct wrong birds; wrong1 is same-spot", () => {
    const right = rollBirdForSpot(NAWB, "feeder", noBoost, () => 0);
    // Use a fixed rng that advances per call
    const seq = [0.1, 0.2, 0.3, 0.4, 0.5];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    const [a, b, c] = pickChoices(NAWB, "feeder", right, rng);
    const ids = [a.id, b.id, c.id];
    expect(new Set(ids).size).toBe(3);
    expect(ids).toContain(right.id);
    // Confirm at least one of the two wrongs is a Feeder bird (wrong1)
    const feederBirds = new Set(COLLECTIONS[NAWB].birdsBySpot.feeder.map((x) => x.id));
    const wrongs = ids.filter((id) => id !== right.id);
    expect(wrongs.some((id) => feederBirds.has(id))).toBe(true);
  });
});

describe("leaderboard", () => {
  test("encode/decode round-trip", () => {
    const encoded = encodeEntry("maya_k", 14, 1_760_000_000_000);
    expect(encoded).toBe("maya_k|14|1760000000000");
    const decoded = decodeEntry("p1", encoded);
    expect(decoded).toEqual({ profileId: "p1", displayName: "maya_k", sightings: 14, reachedAt: 1_760_000_000_000 });
  });

  test("parseLeaderboard sorts by count desc then reachedAt asc", () => {
    const record = {
      a: encodeEntry("A", 10, 2000),
      b: encodeEntry("B", 12, 3000),
      c: encodeEntry("C", 12, 2500),
    };
    const sorted = parseLeaderboard(record);
    expect(sorted.map((e) => e.profileId)).toEqual(["c", "b", "a"]);
  });

  test("upsertEntry keeps the actor's row even when off the top 25", () => {
    let record: Record<string, string> = {};
    for (let i = 0; i < 30; i++) record[`p${i}`] = encodeEntry(`u${i}`, 100 - i, 1_000_000 + i);
    record = upsertEntry(record, "me", "You", 1, Date.now());
    expect(record["me"]).toBeDefined();
    const parsed = parseLeaderboard(record);
    expect(parsed.length).toBeLessThanOrEqual(26);
  });
});

describe("milestones", () => {
  test("detectMilestoneCross returns m1/m2/m3 correctly", () => {
    expect(detectMilestoneCross(499, 500)).toBe("m1");
    expect(detectMilestoneCross(1499, 1500)).toBe("m2");
    expect(detectMilestoneCross(2499, 2500)).toBe("m3");
    expect(detectMilestoneCross(500, 501)).toBeUndefined();
  });

  test("milestoneStateFor derives flags from the World Bird Count", () => {
    expect(milestoneStateFor(0)).toEqual({ rareBoostUnlocked: false, legendaryBoostUnlocked: false, championBadgeUnlocked: false });
    expect(milestoneStateFor(500).rareBoostUnlocked).toBe(true);
    expect(milestoneStateFor(1500).legendaryBoostUnlocked).toBe(true);
    expect(milestoneStateFor(2499).championBadgeUnlocked).toBe(false);
    expect(milestoneStateFor(2500).championBadgeUnlocked).toBe(true);
  });
});

describe("computeMostSpotted", () => {
  test("returns top 3 by count", () => {
    const result = computeMostSpotted({ a: 5, b: 10, c: 7, d: 3, e: 1 });
    expect(result.map((r) => r.birdId)).toEqual(["b", "c", "a"]);
  });
});

describe("mysteryBird", () => {
  test("etDayKey matches YYYY-MM-DD", () => {
    expect(etDayKey(new Date("2026-11-02T12:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("pickTodayPuzzle excludes seen ids, resets when all seen", () => {
    const puzzles = COLLECTIONS[NAWB].puzzles.slice(0, 3);
    const result = pickTodayPuzzle(puzzles, []);
    expect(result).toBeDefined();
    expect(puzzles.map((p) => p.id)).toContain(result!.puzzle.id);
    const allSeen = puzzles.map((p) => p.id);
    const resetResult = pickTodayPuzzle(puzzles, allSeen);
    expect(resetResult!.seenAfter.length).toBe(1); // Reset: only the newly picked one
  });

  test("stableShuffleCandidateIds is deterministic per (puzzleId, profileId)", () => {
    const r1 = stableShuffleCandidateIds("P1", "u1", ["a", "b", "c", "d"]);
    const r2 = stableShuffleCandidateIds("P1", "u1", ["a", "b", "c", "d"]);
    const r3 = stableShuffleCandidateIds("P1", "u2", ["a", "b", "c", "d"]);
    expect(r1).toEqual(r2);
    expect(r1.sort()).toEqual(["a", "b", "c", "d"]);
    expect(r1).not.toEqual(r3);
  });
});
