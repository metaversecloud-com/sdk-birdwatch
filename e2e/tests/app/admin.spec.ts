// World-builder setup (first touch of each asset) and the admin settings, resets and leaderboard.
import { COLLECTION_ID, KEY_ASSET_ID, SCENE_DROP_ID, expect, placedWorld, sighting, spotAssetId, test } from "../../fixtures";

test.describe("first touch", () => {
  test("a key asset placed without ?collectionId tells the world builder what to set", async ({ page, world }) => {
    await world.seed({ keyAssetData: {}, worldData: {} });

    const response = await page.request.get(world.api("/game-state"));

    expect(response.status()).toBe(400);
    expect((await response.json()).message).toBe("World builder: set `?collectionId=<id>` on this key asset's iframe URL.");
    expect(await world.assetData(KEY_ASSET_ID)).toEqual({});
  });

  test("the world builder sees that message in the drawer", async ({ page, world }) => {
    test.fail(true, "EXP-436: Home keeps the spinner up while gameState is empty, so the error is never rendered");
    await world.seed({ keyAssetData: {}, worldData: {} });

    await world.open(page, "key");

    await expect(page.locator(".text-error")).toContainText("World builder: set `?collectionId=<id>`");
  });

  test("the first open of a key asset with ?collectionId sets up the asset and the world", async ({ page, world }) => {
    await world.seed({ keyAssetData: {}, worldData: {} });

    await page.goto(world.url("/", { collectionId: COLLECTION_ID }));

    await expect(page.locator(".bw-count__total")).toHaveText("0");
    expect(await world.assetData(KEY_ASSET_ID)).toEqual({ collectionId: COLLECTION_ID });
    expect(await world.worldData()).toEqual({
      adminSettings: { identificationMode: "description", cooldownSeconds: 60, allAboutBirdsLinksEnabled: true },
      collections: { [COLLECTION_ID]: { sceneDropId: SCENE_DROP_ID, totalSightings: 0, perBirdSightings: {}, perPlayerContribution: {} } },
      leaderboard: {},
    });
    expect(await world.events("analytics")).toContainEqual(expect.objectContaining({ analyticName: "appOpens", uniqueKey: world.profileId }));
  });

  test("a spot needs both ?collectionId and a valid ?spot on first touch", async ({ page, world }) => {
    await world.seed({ spotData: { feeder: {} } });

    const missing = await page.request.get(world.api("/game-state", world.at("feeder", { collectionId: COLLECTION_ID, spot: "lake" })));
    expect(missing.status()).toBe(400);
    expect((await missing.json()).message).toContain("spot=<feeder|pine_woods|frozen_pond|berry_bushes>");
    expect(await world.assetData(spotAssetId("feeder"))).toEqual({});

    const ok = await page.request.get(world.api("/game-state", world.at("feeder", { collectionId: COLLECTION_ID, spot: "feeder" })));
    expect(ok.ok()).toBe(true);
    expect(await world.assetData(spotAssetId("feeder"))).toEqual({ collectionId: COLLECTION_ID, spot: "feeder" });
  });

  test("an unknown Collection is rejected", async ({ page, world }) => {
    await world.seed({ keyAssetData: {}, worldData: {} });

    const response = await page.request.get(world.api("/game-state", { collectionId: "tropical_birds" }));

    expect(response.status()).toBe(400);
    expect((await response.json()).message).toBe("Unknown collectionId: tropical_birds");
  });

  test("the World Bird Count shows the Collection's totals on the first open in a new scene", async ({ page, world }) => {
    test.fail(true, "EXP-436: /game-state reads the world data object after updateDataObject replaced it with the sceneDropId patch");
    // The Collection was last opened from another scene (or the scene was re-placed).
    await world.seed({
      worldData: placedWorld({
        collection: { sceneDropId: "old-scene", totalSightings: 42, perPlayerContribution: { [world.profileId]: 5 } },
      }),
    });

    await world.open(page, "key");

    await expect(page.locator(".bw-count__total")).toHaveText("42");
    await expect(page.locator(".bw-count__you")).toHaveText("You've added 5");
  });

  test("the first open in a new scene keeps the admin's identification mode", async ({ page, world }) => {
    test.fail(true, "EXP-436: /game-state reads the world data object after updateDataObject replaced it with the sceneDropId patch");
    await world.seed({ worldData: placedWorld({ adminSettings: { identificationMode: "picture_match" }, collection: { sceneDropId: "old-scene" } }) });

    const { data } = await (await page.request.get(world.api("/game-state", world.at("feeder")))).json();

    expect(data.adminSettings).toEqual({ identificationMode: "picture_match", cooldownSeconds: 60, allAboutBirdsLinksEnabled: true });
  });
});

test.describe("admin settings", () => {
  test("only admins see the settings gear", async ({ page, world }) => {
    await world.seed({ isAdmin: false });
    await world.open(page, "key");
    await expect(page.getByRole("heading", { name: "Birdwatch" })).toBeVisible();
    await expect(page.getByRole("button", { name: "⚙" })).toHaveCount(0);

    await world.seed({ isAdmin: true });
    await page.reload();
    await expect(page.getByRole("button", { name: "⚙" })).toBeVisible();
  });

  test("an admin changes the mode, cooldown, links and milestone difficulty", async ({ page, world }) => {
    await world.seed({ isAdmin: true });
    await world.open(page, "key");
    await page.getByRole("button", { name: "⚙" }).click();

    await page.getByRole("radio", { name: /Picture Match/ }).check();
    await page.getByRole("radio", { name: "5 min" }).check();
    await page.getByRole("checkbox", { name: /Learn more/ }).uncheck();
    await page.getByRole("radio", { name: /Hard · 1,000 \/ 3,000 \/ 5,000/ }).check();
    await page.getByRole("button", { name: "Save" }).click();

    await expect.poll(async () => (await world.worldData()).adminSettings).toEqual({
      identificationMode: "picture_match",
      cooldownSeconds: 300,
      allAboutBirdsLinksEnabled: false,
    });
    expect(await world.assetData(KEY_ASSET_ID)).toEqual({ collectionId: COLLECTION_ID, milestones: "hard" });

    // Reopening the panel shows what was saved.
    await page.reload();
    await page.getByRole("button", { name: "⚙" }).click();
    await expect(page.getByRole("radio", { name: /Picture Match/ })).toBeChecked();
    await expect(page.getByRole("radio", { name: "5 min" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /Learn more/ })).not.toBeChecked();
    await expect(page.getByRole("radio", { name: /^Hard · / })).toBeChecked();
  });

  test("a difficulty that would skip an unreached milestone can't be saved", async ({ page, world }) => {
    await world.seed({ isAdmin: true, worldData: placedWorld({ collection: { totalSightings: 300 } }) });
    await world.open(page, "key");
    await page.getByRole("button", { name: "⚙" }).click();

    await page.getByRole("radio", { name: /Easy · 250/ }).check();

    await expect(page.getByRole("alert")).toContainText("The World Bird Count is already 300");
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
    // The server enforces it too.
    const response = await page.request.post(world.api("/admin/settings"), { data: { milestoneDifficulty: "easy" } });
    expect(response.status()).toBe(400);
    expect(await world.assetData(KEY_ASSET_ID)).toEqual({ collectionId: COLLECTION_ID });
  });

  test("custom milestone goals show as Custom and can be replaced", async ({ page, world }) => {
    await world.seed({ isAdmin: true, keyAssetData: { collectionId: COLLECTION_ID, milestones: { m1: 10, m2: 20, m3: 30 } } });
    await world.open(page, "key");
    await page.getByRole("button", { name: "⚙" }).click();

    await expect(page.getByRole("radio", { name: /Custom · 10 \/ 20 \/ 30/ })).toBeChecked();
    await page.getByRole("radio", { name: /Very Hard/ }).check();
    await page.getByRole("button", { name: "Save" }).click();

    await expect.poll(async () => (await world.assetData(KEY_ASSET_ID)).milestones).toBe("very_hard");
  });

  const invalid = [
    { name: "an unknown identification mode", data: { identificationMode: "audio" }, message: "Invalid identificationMode" },
    { name: "a cooldown that isn't one of the options", data: { cooldownSeconds: 5 }, message: "Invalid cooldownSeconds" },
    { name: "a non-boolean links setting", data: { allAboutBirdsLinksEnabled: "yes" }, message: "Invalid allAboutBirdsLinksEnabled" },
    { name: "an unknown difficulty", data: { milestoneDifficulty: "impossible" }, message: "Invalid milestoneDifficulty" },
    { name: "an empty request", data: {}, message: "No valid settings provided" },
  ];
  for (const c of invalid) {
    test(`rejects ${c.name}`, async ({ page, world }) => {
      await world.seed({ isAdmin: true });
      const before = await world.state();

      const response = await page.request.post(world.api("/admin/settings"), { data: c.data });

      expect(response.status()).toBe(400);
      expect((await response.json()).message).toBe(c.message);
      const after = await world.state();
      expect(after.dataObject).toEqual(before.dataObject);
      expect(after.assets[KEY_ASSET_ID].dataObject).toEqual(before.assets[KEY_ASSET_ID].dataObject);
    });
  }
});

test.describe("resets", () => {
  const counted = (profileId: string) =>
    placedWorld({
      collection: {
        totalSightings: 12,
        perBirdSightings: { blue_jay: 12 },
        perPlayerContribution: { [profileId]: 7, "profile-other": 5 },
        rarestSighting: { birdId: "blue_jay", byDisplayName: "E2E Player" },
      },
      leaderboard: { [profileId]: "E2E Player|7|1000", "profile-other": "Other Birder|5|2000" },
    });

  test("an admin resets the World Bird Count after confirming; the leaderboard stays", async ({ page, world }) => {
    await world.seed({ isAdmin: true, worldData: counted(world.profileId) });
    await world.open(page, "key");
    await page.getByRole("button", { name: "⚙" }).click();

    await page.getByRole("button", { name: "Reset World Bird Count" }).click();
    await page.getByRole("button", { name: "Keep Count" }).click();
    expect((await world.collection()).totalSightings).toBe(12);
    await page.getByRole("button", { name: "Reset World Bird Count" }).click();
    await page.getByRole("button", { name: "Reset Count" }).click();

    await expect.poll(() => world.collection()).toEqual({ sceneDropId: SCENE_DROP_ID, totalSightings: 0, perBirdSightings: {}, perPlayerContribution: {} });
    expect((await world.worldData()).leaderboard).toEqual(counted(world.profileId).leaderboard);
  });

  test("an admin resets the leaderboard from the Trophy", async ({ page, world }) => {
    await world.seed({ isAdmin: true, worldData: counted(world.profileId) });
    await world.open(page, "trophy");

    await expect(page.locator(".bw-row")).toHaveText([/1E2E Player7/, /2Other Birder5/]);
    await page.getByRole("button", { name: "Reset Leaderboard" }).click();
    await page.getByRole("button", { name: "Keep Leaderboard" }).click();
    expect(Object.keys((await world.worldData()).leaderboard)).toHaveLength(2);
    await page.getByRole("button", { name: "Reset Leaderboard" }).first().click();
    await page.locator(".bw-card").getByRole("button", { name: "Reset Leaderboard" }).click();

    await expect(page.locator(".bw-row")).toHaveCount(0);
    expect((await world.worldData()).leaderboard).toEqual({});
    expect((await world.collection()).totalSightings).toBe(12);
  });

  test("after a leaderboard reset, the next sighting starts the player over from one", async ({ page, world }) => {
    test.fail(true, "EXP-436: the leaderboard count is rebuilt from perPlayerContribution, which a leaderboard reset keeps");
    await world.seed({
      worldData: { ...counted(world.profileId), leaderboard: {} },
      visitorData: { [world.sceneKey]: sighting("feeder", "black_capped_chickadee", ["black_capped_chickadee", "blue_jay", "mallard"]) },
    });

    await page.request.post(world.api("/sightings/resolve", world.at("feeder")), { data: { pickedBirdId: "black_capped_chickadee" } });

    expect((await world.worldData()).leaderboard[world.profileId]).toMatch(/^E2E Player\|1\|\d+$/);
  });

  test("players see the leaderboard but no reset button", async ({ page, world }) => {
    await world.seed({ worldData: counted(world.profileId) });
    await world.open(page, "trophy");

    await expect(page.getByText("Most birds spotted here")).toBeVisible();
    await expect(page.locator(".bw-row--me")).toContainText("E2E Player");
    await expect(page.getByRole("button", { name: "Reset Leaderboard" })).toHaveCount(0);
  });
});
