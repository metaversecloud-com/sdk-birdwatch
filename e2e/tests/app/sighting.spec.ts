// The core loop: click a bird spot, a bird appears with three choices, pick one.
import {
  BIRDS,
  COLLECTION_ID,
  VISITOR_ID,
  birdsAt,
  expect,
  placedWorld,
  sighting,
  spotAssetId,
  test,
} from "../../fixtures";

// A Black-capped Chickadee waiting at the Feeder; the other two choices are a Feeder bird and a Pine Woods bird.
const CHICKADEE = ["northern_cardinal", "black_capped_chickadee", "blue_jay"];

test.describe("a new sighting", () => {
  test("clicking a spot shows one of its birds with three choices and starts the cooldown", async ({ page, world }) => {
    await world.seed();
    await world.open(page, "pine_woods");

    await expect(page.getByRole("heading", { name: "Pine Woods" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Which bird is this?" })).toBeVisible();
    await expect(page.locator(".bw-choice")).toHaveCount(3);

    const scene = await world.sceneData();
    const inFlight = scene.inFlight[spotAssetId("pine_woods")];
    expect(inFlight.collectionId).toBe(COLLECTION_ID);
    expect(birdsAt("pine_woods")).toContain(inFlight.birdId);
    expect(inFlight.choiceBirdIds).toContain(inFlight.birdId);
    expect(new Set(inFlight.choiceBirdIds).size).toBe(3);
    // One wrong choice always comes from the same spot, so the pick isn't a giveaway.
    expect(inFlight.choiceBirdIds.filter((id: string) => id !== inFlight.birdId && BIRDS[id].spot === "pine_woods").length).toBeGreaterThan(0);
    for (const id of inFlight.choiceBirdIds) await expect(page.locator(".bw-choice", { hasText: BIRDS[id].name })).toBeVisible();

    const cooldownEndsAt = scene.spotCooldowns[spotAssetId("pine_woods")];
    expect(cooldownEndsAt - Date.now()).toBeGreaterThan(50_000);
    expect(cooldownEndsAt - Date.now()).toBeLessThanOrEqual(60_000);
    expect(await world.events("analytics")).toContainEqual(expect.objectContaining({ analyticName: "spotClicks", uniqueKey: world.profileId }));
  });

  test("the admin's cooldown setting decides how long the spot rests", async ({ page, world }) => {
    await world.seed({ worldData: placedWorld({ adminSettings: { cooldownSeconds: 300 } }) });

    const response = await page.request.post(world.api("/sightings/start", world.at("feeder")));

    expect(response.ok()).toBe(true);
    const endsAt = (await world.sceneData()).spotCooldowns[spotAssetId("feeder")];
    expect(endsAt - Date.now()).toBeGreaterThan(290_000);
    expect(endsAt - Date.now()).toBeLessThanOrEqual(300_000);
  });

  test("reopening the spot before answering shows the same bird again", async ({ page, world }) => {
    await world.seed({ visitorData: { [world.sceneKey]: sighting("feeder", "black_capped_chickadee", CHICKADEE) } });

    const response = await page.request.post(world.api("/sightings/start", world.at("feeder")));

    const body = await response.json();
    expect(body.reused).toBe(true);
    expect(body.data.sighting).toEqual({ collectionId: COLLECTION_ID, birdId: "black_capped_chickadee", choiceBirdIds: CHICKADEE });
  });

  test("Picture Match mode adds a picture to every choice", async ({ page, world }) => {
    await world.seed({
      worldData: placedWorld({ adminSettings: { identificationMode: "picture_match" } }),
      visitorData: { [world.sceneKey]: sighting("feeder", "black_capped_chickadee", CHICKADEE) },
    });
    await world.open(page, "feeder");

    await expect(page.locator(".bw-choice")).toHaveCount(3);
    await expect(page.locator(".bw-choice img.bw-choice__thumb")).toHaveCount(3);
    await expect(page.locator(".bw-choice__letter")).toHaveCount(0);
  });

  test("Description mode shows letters instead of pictures", async ({ page, world }) => {
    await world.seed({ visitorData: { [world.sceneKey]: sighting("feeder", "black_capped_chickadee", CHICKADEE) } });
    await world.open(page, "feeder");

    await expect(page.locator(".bw-choice__letter")).toHaveText(["A", "B", "C"]);
    await expect(page.locator(".bw-choice img")).toHaveCount(0);
  });
});

test.describe("answering", () => {
  test("a correct pick of a new species fills the Field Guide, the World Bird Count and the leaderboard", async ({ page, world }) => {
    await world.seed({ visitorData: { [world.sceneKey]: sighting("feeder", "black_capped_chickadee", CHICKADEE) } });
    await world.open(page, "feeder");

    await page.locator(".bw-choice", { hasText: "Black-capped Chickadee" }).click();

    await expect(page.getByText("Correct! You got it.")).toBeVisible();
    await expect(page.getByText("NEW BIRD!")).toBeVisible();
    await expect(page.getByText("Added to your Field Guide · 1 of 23")).toBeVisible();
    await expect(page.getByText("New species added to your Field Guide!")).toBeVisible();

    const collection = await world.collection();
    expect(collection).toMatchObject({
      totalSightings: 1,
      perBirdSightings: { black_capped_chickadee: 1 },
      perPlayerContribution: { [world.profileId]: 1 },
      rarestSighting: { birdId: "black_capped_chickadee", byDisplayName: "E2E Player" },
    });
    expect((await world.worldData()).leaderboard[world.profileId]).toMatch(/^E2E Player\|1\|\d+$/);
    expect((await world.sceneData()).inFlight).toEqual({});
    await expect.poll(async () => (await world.inventory()).birds).toEqual({ black_capped_chickadee: 1 });
    await expect.poll(async () => (await world.inventory()).badges).toEqual(["First Sighting"]);
    await expect
      .poll(() => world.events("fire-toast"))
      .toContainEqual(expect.objectContaining({ title: "Badge Awarded", text: "You have earned the First Sighting badge!", visitorId: String(VISITOR_ID) }));
    const analytics = (await world.events("analytics")).map((a) => a.analyticName);
    expect(analytics).toEqual(expect.arrayContaining(["birdIDs-correct", "sightings-common", "speciesLogs"]));
  });

  test("a correct pick of a bird already in the Field Guide counts one more sighting", async ({ page, world }) => {
    await world.seed({
      birds: { black_capped_chickadee: 2 },
      badges: ["First Sighting"],
      visitorData: { [world.sceneKey]: sighting("feeder", "black_capped_chickadee", CHICKADEE) },
    });
    await world.open(page, "feeder");

    await page.locator(".bw-choice", { hasText: "Black-capped Chickadee" }).click();

    await expect(page.getByText("Already in your Field Guide")).toBeVisible();
    await expect(page.getByText("Spotted 3 times")).toBeVisible();
    await expect(page.getByText("NEW BIRD!")).toHaveCount(0);
    await expect.poll(async () => (await world.inventory()).birds).toEqual({ black_capped_chickadee: 3 });
    expect((await world.collection()).totalSightings).toBe(1);
    // Owned badges aren't granted again.
    expect(await world.events("grant-item")).toEqual([]);
    expect((await world.events("analytics")).map((a) => a.analyticName)).not.toContain("speciesLogs");
  });

  test("a wrong pick names the bird, changes no counts and leaves the spot resting", async ({ page, world }) => {
    await world.seed({ visitorData: { [world.sceneKey]: sighting("feeder", "black_capped_chickadee", CHICKADEE) } });
    await world.open(page, "feeder");

    await page.locator(".bw-choice", { hasText: "Northern Cardinal" }).click();

    await expect(page.getByText("Not quite! Wrong bird.")).toBeVisible();
    await expect(page.getByText("That was a Black-capped Chickadee")).toBeVisible();
    await expect(page.getByText("It flew away!")).toBeVisible();
    await expect(page.getByRole("heading", { name: "The birds are resting." })).toBeVisible();
    await expect(page.getByRole("timer")).toHaveText(/^[01]:\d\d$/);

    expect((await world.collection()).totalSightings).toBe(0);
    expect((await world.worldData()).leaderboard).toEqual({});
    const scene = await world.sceneData();
    expect(scene.inFlight).toEqual({});
    expect(scene.spotCooldowns[spotAssetId("feeder")]).toBeGreaterThan(Date.now());
    expect((await world.events("analytics")).map((a) => a.analyticName)).toContain("birdIDs-wrong");
    expect((await world.inventory()).birds).toEqual({});
  });
});

test.describe("resting spots", () => {
  test("a resting spot shows the countdown and the other spots to try", async ({ page, world }) => {
    await world.seed({
      birds: { mallard: 1, canada_goose: 1 },
      visitorData: {
        [world.sceneKey]: {
          spotCooldowns: { [spotAssetId("feeder")]: Date.now() + 45_000, [spotAssetId("berry_bushes")]: Date.now() + 90_000 },
        },
      },
    });
    await world.open(page, "feeder");

    await expect(page.getByRole("heading", { name: "The birds are resting." })).toBeVisible();
    await expect(page.getByRole("timer")).toHaveText(/^0:4\d$/);
    const spots = page.locator(".bw-card .bw-card");
    // Ready spots first, then by fewest found; the spot you're at isn't listed.
    await expect(spots.locator("strong")).toHaveText(["Pine Woods", "Frozen Pond", "Berry Bushes"]);
    await expect(spots.filter({ hasText: "Frozen Pond" })).toContainText("2/5 found");
    await expect(spots.filter({ hasText: "Berry Bushes" })).toContainText(/Resting · 1:[23]\d/);
    expect((await world.events("analytics")).map((a) => a.analyticName)).toContain("spotClicks-cooldown");
    expect((await world.sceneData()).inFlight).toBeUndefined();
  });

  test("a spot whose cooldown has ended shows a new bird", async ({ page, world }) => {
    await world.seed({ visitorData: { [world.sceneKey]: { spotCooldowns: { [spotAssetId("frozen_pond")]: Date.now() - 1000 } } } });
    await world.open(page, "frozen_pond");

    await expect(page.getByRole("heading", { name: "Which bird is this?" })).toBeVisible();
    expect(birdsAt("frozen_pond")).toContain((await world.sceneData()).inFlight[spotAssetId("frozen_pond")].birdId);
  });

  test("the result screen leads back to the resting screen", async ({ page, world }) => {
    await world.seed({ visitorData: { [world.sceneKey]: sighting("feeder", "black_capped_chickadee", CHICKADEE) } });
    await world.open(page, "feeder");
    await page.locator(".bw-choice", { hasText: "Black-capped Chickadee" }).click();

    await page.getByRole("button", { name: "Find another bird" }).click();

    await expect(page.getByRole("heading", { name: "The birds are resting." })).toBeVisible();
    await expect(page.locator(".bw-choice")).toHaveCount(0);
  });
});
