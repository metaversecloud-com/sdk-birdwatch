// Permission checks and anti-cheat: what a player can do by calling the API directly.
import { COLLECTION_ID, OtherVisitor, PUZZLE_1, SpotKey, etDayKey, expect, placedWorld, sighting, spotAssetId, test } from "../../fixtures";

const CHICKADEE = ["black_capped_chickadee", "northern_cardinal", "blue_jay"];

test.describe("admin endpoints reject players", () => {
  const calls = [
    { name: "save settings", path: "/admin/settings", data: { cooldownSeconds: 3600 } },
    { name: "reset the World Bird Count", path: "/admin/reset-bird-count" },
    { name: "reset the leaderboard", path: "/admin/reset-leaderboard" },
  ];

  for (const call of calls) {
    test(call.name, async ({ page, world }) => {
      await world.seed({
        isAdmin: false,
        worldData: placedWorld({ collection: { totalSightings: 9 }, leaderboard: { "profile-other": "Other Birder|9|1000" } }),
      });
      const before = await world.state();

      const response = await page.request.post(world.api(call.path), { data: call.data });

      expect(response.status()).toBe(403);
      expect(await response.json()).toEqual({ success: false, message: "Admin only" });
      const after = await world.state();
      expect(after.dataObject).toEqual(before.dataObject);
      expect(after.assets).toEqual(before.assets);
    });
  }
});

test.describe("sighting integrity", () => {
  test("a pick for a spot with no bird waiting is rejected", async ({ page, world }) => {
    await world.seed();

    const response = await page.request.post(world.api("/sightings/resolve", world.at("feeder")), { data: { pickedBirdId: "black_capped_chickadee" } });

    expect(response.status()).toBe(400);
    expect((await response.json()).message).toBe("No in-flight sighting for this spot.");
    expect((await world.collection()).totalSightings).toBe(0);
  });

  test("a pick that wasn't one of the three choices is rejected and changes nothing", async ({ page, world }) => {
    await world.seed({ visitorData: { [world.sceneKey]: sighting("feeder", "black_capped_chickadee", CHICKADEE) } });
    const before = await world.state();

    const response = await page.request.post(world.api("/sightings/resolve", world.at("feeder")), { data: { pickedBirdId: "snowy_owl" } });

    expect(response.status()).toBe(400);
    expect((await response.json()).message).toBe("Picked bird is not among the choices.");
    const after = await world.state();
    expect(after.dataObject).toEqual(before.dataObject);
    expect(after.visitors).toEqual(before.visitors);
  });

  test("a pick without a bird is rejected", async ({ page, world }) => {
    await world.seed({ visitorData: { [world.sceneKey]: sighting("feeder", "black_capped_chickadee", CHICKADEE) } });

    const response = await page.request.post(world.api("/sightings/resolve", world.at("feeder")), { data: {} });

    expect(response.status()).toBe(400);
    expect((await response.json()).message).toBe("pickedBirdId is required");
    expect((await world.sceneData()).inFlight[spotAssetId("feeder")]).toBeTruthy();
  });

  test("a sighting can only be answered once", async ({ page, world }) => {
    await world.seed({ visitorData: { [world.sceneKey]: sighting("feeder", "black_capped_chickadee", CHICKADEE) } });
    const resolve = () => page.request.post(world.api("/sightings/resolve", world.at("feeder")), { data: { pickedBirdId: "black_capped_chickadee" } });

    expect((await resolve()).ok()).toBe(true);
    const second = await resolve();

    expect(second.status()).toBe(400);
    expect((await world.collection()).totalSightings).toBe(1);
    await expect.poll(async () => (await world.inventory()).birds).toEqual({ black_capped_chickadee: 1 });
  });

  test("a resting spot gives no new bird when the request names another scene", async ({ page, world }) => {
    test.fail(true, "EXP-436: cooldowns are keyed by the client-sent sceneDropId, so a made-up one skips the cooldown");
    await world.seed({ visitorData: { [world.sceneKey]: { spotCooldowns: { [spotAssetId("feeder")]: Date.now() + 3_600_000 } } } });

    const response = await page.request.post(world.api("/sightings/start", world.at("feeder", { sceneDropId: "made-up-scene" })));

    expect((await response.json()).data.sighting).toBeNull();
  });

  test("a sighting answered under a made-up scene doesn't count", async ({ page, world }) => {
    test.fail(true, "EXP-436: cooldowns are keyed by the client-sent sceneDropId, so a made-up one skips the cooldown");
    await world.seed({ visitorData: { [world.sceneKey]: { spotCooldowns: { [spotAssetId("feeder")]: Date.now() + 3_600_000 } } } });
    const forged = world.at("feeder", { sceneDropId: `made-up-${Date.now()}` });

    const started = await (await page.request.post(world.api("/sightings/start", forged))).json();
    if (started.data.sighting) {
      await page.request.post(world.api("/sightings/resolve", forged), { data: { pickedBirdId: started.data.sighting.birdId } });
    }

    expect((await world.collection()).totalSightings).toBe(0);
    expect((await world.worldData()).leaderboard).toEqual({});
  });
});

test.describe("concurrent answers", () => {
  test("firing the same correct answer many times at once counts it once", async ({ page, world }) => {
    test.fail(true, "EXP-436: resolve reads the in-flight sighting and clears it later without a lock, so parallel requests all count");
    const birds: Partial<Record<SpotKey, string>> = { feeder: "black_capped_chickadee", pine_woods: "blue_jay", berry_bushes: "american_robin" };
    const spots = Object.keys(birds) as SpotKey[];
    await world.seed({
      visitorData: {
        [world.sceneKey]: {
          spotCooldowns: Object.fromEntries(spots.map((spot) => [spotAssetId(spot), Date.now() + 60_000])),
          inFlight: Object.fromEntries(
            spots.map((spot) => [spotAssetId(spot), { collectionId: COLLECTION_ID, birdId: birds[spot], choiceBirdIds: [birds[spot], "mallard", "snowy_owl"] }]),
          ),
        },
      },
    });

    // Ten copies of each answer, all at once.
    const responses = await Promise.all(
      spots.flatMap((spot) =>
        Array.from({ length: 10 }, () => page.request.post(world.api("/sightings/resolve", world.at(spot)), { data: { pickedBirdId: birds[spot] } })),
      ),
    );

    expect(responses.filter((r) => r.ok())).toHaveLength(3);
    await expect.poll(async () => Object.values((await world.inventory()).birds).reduce((a, b) => a + b, 0)).toBe(3);
  });

  test("players answering at the same time all count toward the World Bird Count", async ({ page, world }) => {
    test.fail(true, "EXP-436: resolve writes totals computed from a stale read, so simultaneous sightings overwrite each other");
    const players: OtherVisitor[] = Array.from({ length: 8 }, (_, i) => ({ visitorId: 100 + i, profileId: `${world.profileId}-p${i}`, displayName: `Player ${i}` }));
    const pending = { [world.sceneKey]: sighting("feeder", "black_capped_chickadee", ["black_capped_chickadee", "mallard", "blue_jay"]) };
    await world.seed({ otherVisitors: players.map((p) => ({ ...p, visitorData: pending })) });

    await Promise.all(
      players.map((p) => page.request.post(world.api("/sightings/resolve", world.as(p, "feeder")), { data: { pickedBirdId: "black_capped_chickadee" } })),
    );

    const collection = await world.collection();
    expect(collection.totalSightings).toBe(8);
    expect(Object.keys(collection.perPlayerContribution)).toHaveLength(8);
  });
});

test.describe("Mystery Bird integrity", () => {
  test("a player who is done for today gets no second puzzle by naming another scene", async ({ page, world }) => {
    test.fail(true, "EXP-436: Mystery Bird state is keyed by the client-sent sceneDropId");
    const solved = { todayKey: etDayKey(), puzzleId: PUZZLE_1.id, guessedIds: [PUZZLE_1.answerId], solvedTotal: 1, firstTryTotal: 1, seenPuzzleIds: [PUZZLE_1.id] };
    await world.seed({ badges: ["Mystery Solved", "First Try"], visitorData: { [world.sceneKey]: { spotCooldowns: {}, mysteryBird: { [COLLECTION_ID]: solved } } } });
    const forged = { sceneDropId: "made-up-scene" };

    const { data } = await (await page.request.get(world.api("/game-state", { ...forged, refresh: "true" }))).json();
    const response = await page.request.post(world.api("/mystery/guess", forged), {
      data: { collectionId: COLLECTION_ID, pickedBirdId: data.mysteryBird.candidateIds[0] },
    });

    expect(response.status()).toBe(400);
    expect(Object.keys(await world.visitorData())).toEqual([world.sceneKey]);
  });
});

test.describe("analytics", () => {
  test("logs the UI-only analytics", async ({ page, world }) => {
    await world.seed();

    const response = await page.request.post(world.api("/analytics"), { data: { analyticName: "externalLinkClicks" } });

    expect(response.ok()).toBe(true);
    expect(await world.events("analytics")).toEqual([expect.objectContaining({ analyticName: "externalLinkClicks", uniqueKey: world.profileId })]);
  });

  test("refuses analytics the server logs itself", async ({ page, world }) => {
    await world.seed();

    const response = await page.request.post(world.api("/analytics"), { data: { analyticName: "birdIDs-correct" } });

    expect(response.status()).toBe(400);
    expect(await world.events("analytics")).toEqual([]);
  });

  test("opening the Field Guide is logged", async ({ page, world }) => {
    await world.seed({ birds: { blue_jay: 1 } });
    await world.open(page, "key");

    await page.getByRole("button", { name: "Field Guide" }).click();

    await expect(page.getByText("1 of 23 species found")).toBeVisible();
    await expect(page.getByRole("button", { name: "Blue Jay (found)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mallard (not found yet)" })).toBeVisible();
    await expect.poll(async () => (await world.events("analytics")).map((a) => a.analyticName)).toContain("fieldGuideOpens");
  });
});
