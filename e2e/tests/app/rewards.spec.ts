// Badges, World Bird Count milestones, Champion Birder and the Legendary Alert.
import { Page } from "@playwright/test";
import {
  COLLECTION_ID,
  OtherVisitor,
  TopiaWorld,
  VISITOR_ID,
  birdsAt,
  expect,
  placedWorld,
  sighting,
  spotAssetId,
  test,
} from "../../fixtures";

const resolve = async (page: Page, world: TopiaWorld, spot: Parameters<TopiaWorld["at"]>[0], pickedBirdId: string) => {
  const response = await page.request.post(world.api("/sightings/resolve", world.at(spot)), { data: { pickedBirdId } });
  expect(response.ok()).toBe(true);
  return (await response.json()).data;
};

const otherBirder = (world: TopiaWorld): OtherVisitor => ({ visitorId: 77, profileId: `${world.profileId}-other`, displayName: "Other Birder" });

const toasts = async (world: TopiaWorld, visitorId: number = VISITOR_ID) =>
  (await world.events("fire-toast")).filter((t) => t.visitorId === String(visitorId)).map((t) => t.title);

test.describe("badges", () => {
  test("finding the last Feeder bird earns the Feeder badge", async ({ page, world }) => {
    const [last, ...found] = birdsAt("feeder");
    await world.seed({
      badges: ["First Sighting", "Rare Find"],
      birds: Object.fromEntries(found.map((id) => [id, 1])),
      visitorData: { [world.sceneKey]: sighting("feeder", last, [last, "blue_jay", "mallard"]) },
    });

    await resolve(page, world, "feeder", last);

    await expect.poll(async () => (await world.inventory()).badges).toContain("Winter Feeder Birds");
    expect(await world.events("grant-item")).toEqual([expect.objectContaining({ name: "Winter Feeder Birds", profileId: world.profileId })]);
  });

  test("the 10th species earns Avid Birder and the 20th correct ID earns Bird Spotter", async ({ page, world }) => {
    // 9 species, 19 correct IDs so far.
    const owned = ["blue_jay", "dark_eyed_junco", "mallard", "canada_goose", "american_robin", "mourning_dove", "northern_cardinal", "house_finch", "tufted_titmouse"];
    await world.seed({
      badges: ["First Sighting"],
      birds: Object.fromEntries(owned.map((id, i) => [id, i === 0 ? 11 : 1])),
      visitorData: { [world.sceneKey]: sighting("feeder", "black_capped_chickadee", ["black_capped_chickadee", "blue_jay", "mallard"]) },
    });

    await resolve(page, world, "feeder", "black_capped_chickadee");

    await expect.poll(async () => (await world.inventory()).badges.sort()).toEqual(["Avid Birder", "Bird Spotter", "First Sighting"]);
    await expect.poll(() => toasts(world)).toEqual(expect.arrayContaining(["Badge Awarded", "Badge Awarded"]));
  });

  test("a repeat Rare sighting fires a personal Rare find toast", async ({ page, world }) => {
    await world.seed({
      badges: ["First Sighting", "Rare Find"],
      birds: { evening_grosbeak: 1 },
      visitorData: { [world.sceneKey]: sighting("feeder", "evening_grosbeak", ["evening_grosbeak", "house_finch", "mallard"]) },
    });

    const result = await resolve(page, world, "feeder", "evening_grosbeak");

    expect(result).toMatchObject({ outcome: "repeat", timesSpotted: 2 });
    await expect.poll(() => world.events("fire-toast")).toContainEqual(expect.objectContaining({ title: "Rare find!", text: "You spotted a Evening Grosbeak!" }));
  });

  test("the Trophy's Badges tab shows the badges the player owns", async ({ page, world }) => {
    await world.seed({ badges: ["First Sighting", "Mystery Solved"] });
    await world.open(page, "trophy");

    await page.getByRole("button", { name: "Badges" }).click();

    await expect(page.locator(".bw-chip--legendary")).toHaveText("2 / 18");
    await expect(page.locator(".bw-badge-tile:not(.bw-badge-tile--locked)")).toHaveCount(2);
    await expect(page.locator(".bw-badge-tile:not(.bw-badge-tile--locked)").first()).toContainText("First Sighting");
  });
});

test.describe("World Bird Count milestones", () => {
  // Custom goals, set by hand on the key asset: 3 / 5 / 7.
  const keyAssetData = { collectionId: COLLECTION_ID, milestones: { m1: 3, m2: 5, m3: 7 } };

  test("crossing the first milestone tells the whole world", async ({ page, world }) => {
    await world.seed({
      keyAssetData,
      worldData: placedWorld({ collection: { totalSightings: 2 } }),
      visitorData: { [world.sceneKey]: sighting("feeder", "black_capped_chickadee", ["black_capped_chickadee", "blue_jay", "mallard"]) },
    });

    const result = await resolve(page, world, "feeder", "black_capped_chickadee");

    expect(result).toMatchObject({ milestoneCrossed: "m1", newTotalSightings: 3 });
    await expect.poll(() => world.events("world-toast")).toContainEqual(expect.objectContaining({ title: "Milestone reached!" }));
    expect(await world.events("analytics")).toContainEqual(expect.objectContaining({ analyticName: "milestoneReaches", uniqueKey: `${COLLECTION_ID}:m1` }));
  });

  test("the World Bird Count tab shows the count, your share, milestones, rarest and most spotted", async ({ page, world }) => {
    await world.seed({
      keyAssetData,
      birds: { blue_jay: 1, snowy_owl: 1 },
      worldData: placedWorld({
        collection: {
          totalSightings: 4,
          perBirdSightings: { blue_jay: 3, snowy_owl: 1 },
          perPlayerContribution: { [world.profileId]: 2, "profile-other": 2 },
          rarestSighting: { birdId: "snowy_owl", byDisplayName: "Other Birder" },
        },
      }),
    });
    await world.open(page, "key");

    await expect(page.locator(".bw-count__total")).toHaveText("4");
    await expect(page.locator(".bw-count__you")).toHaveText("You've added 2");
    await expect(page.getByText("2 of 23")).toBeVisible();
    await expect(page.getByLabel("Rare birds visit more often reached")).toBeVisible();
    await expect(page.getByText("1 to go: Legendary bird visits more often")).toBeVisible();
    await expect(page.getByText("by Other Birder")).toBeVisible();
    await expect(page.locator("ol li")).toHaveText(["Blue Jay · 3", "Snowy Owl · 1"]);
  });

  test("the final milestone gives every participant the Champion Birder badge", async ({ page, world }) => {
    const other = otherBirder(world);
    await world.seed({
      keyAssetData,
      badges: ["First Sighting"],
      otherVisitors: [other],
      worldData: placedWorld({ collection: { totalSightings: 6, perPlayerContribution: { [world.profileId]: 3, [other.profileId]: 3 } } }),
      visitorData: { [world.sceneKey]: sighting("feeder", "black_capped_chickadee", ["black_capped_chickadee", "blue_jay", "mallard"]) },
    });

    const result = await resolve(page, world, "feeder", "black_capped_chickadee");

    expect(result.milestoneCrossed).toBe("m3");
    await expect.poll(async () => (await world.inventory()).badges).toContain("North American Winter Champion Birder");
    await expect.poll(async () => (await world.inventory(other.visitorId)).badges).toEqual(["North American Winter Champion Birder"]);
    await expect.poll(() => world.events("world-toast")).toContainEqual(expect.objectContaining({ title: "Champion Birders!" }));
    // The finder is toasted now; the other participant isn't online in the drawer, so it waits for their next open.
    await expect.poll(() => toasts(world)).toContain("Badge Awarded");
    expect(await toasts(world, other.visitorId)).toEqual([]);
  });

  test("other participants get their Champion Birder toast the next time they open Birdwatch", async ({ page, world }) => {
    test.fail(true, "EXP-436: queued badge toasts are written to the user data object but read from the visitor's");
    const other = otherBirder(world);
    await world.seed({
      keyAssetData,
      badges: ["First Sighting"],
      otherVisitors: [other],
      worldData: placedWorld({ collection: { totalSightings: 6, perPlayerContribution: { [world.profileId]: 3, [other.profileId]: 3 } } }),
      visitorData: { [world.sceneKey]: sighting("feeder", "black_capped_chickadee", ["black_capped_chickadee", "blue_jay", "mallard"]) },
    });
    await resolve(page, world, "feeder", "black_capped_chickadee");
    await expect.poll(async () => (await world.inventory(other.visitorId)).badges).toEqual(["North American Winter Champion Birder"]);
    await expect.poll(async () => (await world.userData(other.profileId))?.pendingBadgeToasts).toBeTruthy();

    // The other participant opens the key asset.
    const response = await page.request.get(world.api("/game-state", world.as(other)));
    expect(response.ok()).toBe(true);

    expect(await world.events("fire-toast")).toContainEqual(
      expect.objectContaining({ visitorId: String(other.visitorId), text: "You have earned the North American Winter Champion Birder badge!" }),
    );
  });
});

test.describe("Legendary Alert", () => {

  test("finding the Legendary starts an alert and tells everyone else in the world", async ({ page, world }) => {
    const other = otherBirder(world);
    await world.seed({
      badges: ["First Sighting"],
      otherVisitors: [other],
      worldData: placedWorld({ adminSettings: { cooldownSeconds: 300 } }),
      visitorData: { [world.sceneKey]: sighting("frozen_pond", "snowy_owl", ["snowy_owl", "mallard", "blue_jay"]) },
    });

    const result = await resolve(page, world, "frozen_pond", "snowy_owl");

    const alert = (await world.collection()).activeLegendaryAlert;
    expect(alert).toMatchObject({ birdId: "snowy_owl", spot: "frozen_pond", alertId: expect.stringMatching(new RegExp(`^${COLLECTION_ID}:\\d+$`)) });
    // The alert lasts as long as the admin's cooldown setting.
    expect(alert.expiresAt - Date.now()).toBeGreaterThan(290_000);
    expect(result.legendaryAlertStarted).toEqual(alert);
    await expect.poll(() => toasts(world)).toContain("Legendary find!");
    await expect.poll(() => toasts(world, other.visitorId)).toEqual(["Legendary Snowy Owl spotted!"]);
    expect(await toasts(world)).not.toContain("Legendary Snowy Owl spotted!");
    await expect.poll(async () => (await world.inventory()).badges).toEqual(expect.arrayContaining(["Legendary Birder"]));
  });

  test("during an alert, a resting spot of that type shows the Legendary once", async ({ page, world }) => {
    const alert = { alertId: `${COLLECTION_ID}:1`, birdId: "snowy_owl", spot: "frozen_pond" as const, expiresAt: Date.now() + 120_000 };
    await world.seed({
      worldData: placedWorld({ collection: { activeLegendaryAlert: alert } }),
      visitorData: { [world.sceneKey]: { spotCooldowns: { [spotAssetId("frozen_pond")]: Date.now() + 50_000 } } },
    });
    await world.open(page, "frozen_pond");

    await expect(page.getByRole("heading", { name: "Which bird is this?" })).toBeVisible();
    await expect(page.locator(".bw-choice", { hasText: "Snowy Owl" })).toBeVisible();
    const scene = await world.sceneData();
    expect(scene.inFlight[spotAssetId("frozen_pond")].birdId).toBe("snowy_owl");
    expect(scene.legendaryAlertUsage).toEqual({ alertId: alert.alertId, usedAssetIds: [spotAssetId("frozen_pond")] });

    // Answered: the spot rests again even though the alert is still on.
    await page.locator(".bw-choice", { hasText: "Snowy Owl" }).click();
    await expect(page.getByText("Correct! You got it.")).toBeVisible();
    const again = await (await page.request.post(world.api("/sightings/start", world.at("frozen_pond")))).json();
    expect(again.data.sighting).toBeNull();
  });

  test("an alert doesn't skip the cooldown of other spot types", async ({ page, world }) => {
    const alert = { alertId: `${COLLECTION_ID}:1`, birdId: "snowy_owl", spot: "frozen_pond" as const, expiresAt: Date.now() + 120_000 };
    await world.seed({
      worldData: placedWorld({ collection: { activeLegendaryAlert: alert } }),
      visitorData: { [world.sceneKey]: { spotCooldowns: { [spotAssetId("feeder")]: Date.now() + 50_000 } } },
    });

    const body = await (await page.request.post(world.api("/sightings/start", world.at("feeder")))).json();

    expect(body.data.sighting).toBeNull();
  });
});
