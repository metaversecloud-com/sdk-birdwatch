process.env.INTERACTIVE_KEY = "test-key";
const topiaMock = require("../mocks/@rtsdk/topia").__mock;

import express from "express";
import request from "supertest";
import router from "../routes";

const makeApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  return app;
};

const CREDS = {
  interactivePublicKey: "test-key",
  interactiveNonce: "nonce",
  visitorId: 1,
  urlSlug: "world",
  sceneDropId: "scene-1",
  assetId: "asset-key",
  profileId: "p1",
  displayName: "You",
  uniqueName: "Birdwatch_keyAsset",
};

const seedKeyAsset = () => {
  topiaMock.droppedAssetSeed = {
    "asset-key": { collectionId: "north_american_winter_birds" },
    "asset-spot-feeder": { collectionId: "north_american_winter_birds", spot: "feeder" },
    "asset-spot-pine": { collectionId: "north_american_winter_birds", spot: "pine_woods" },
  };
  topiaMock.droppedAssetUniqueName = {
    "asset-key": "Birdwatch_keyAsset",
    "asset-spot-feeder": "Birdwatch_spot",
    "asset-spot-pine": "Birdwatch_spot",
  };
  topiaMock.sceneAssets = [
    { id: "asset-spot-feeder", uniqueName: "Birdwatch_spot", dataObject: { collectionId: "north_american_winter_birds", spot: "feeder" } },
    { id: "asset-spot-pine", uniqueName: "Birdwatch_spot", dataObject: { collectionId: "north_american_winter_birds", spot: "pine_woods" } },
    { id: "asset-key", uniqueName: "Birdwatch_keyAsset", dataObject: { collectionId: "north_american_winter_birds" } },
  ];
};

describe("Birdwatch routes", () => {
  beforeEach(() => {
    topiaMock.reset();
    require("../utils/inventory/inventoryCache").invalidateInventoryCache("test-key");
    seedKeyAsset();
  });

  test("GET /system/health returns OK", async () => {
    const res = await request(makeApp()).get("/api/system/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("OK");
  });

  test("GET /game-state returns the bootstrap payload for a key asset", async () => {
    const res = await request(makeApp()).get("/api/game-state").query(CREDS);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.collectionId).toBe("north_american_winter_birds");
    expect(res.body.data.sceneDropId).toBe("scene-1");
    expect(res.body.data.adminSettings).toBeDefined();
    expect(res.body.data.worldState).toBeDefined();
    expect(res.body.data.leaderboard).toEqual({});
  });

  test("GET /game-state 400s on an uninitialized key asset with no collectionId in query", async () => {
    topiaMock.droppedAssetSeed["asset-key"] = {};
    const res = await request(makeApp()).get("/api/game-state").query({ ...CREDS });
    expect(res.status).toBe(400);
  });

  test("POST /sightings/start rolls a bird and saves inFlight for the spot assetId", async () => {
    const spotCreds = { ...CREDS, assetId: "asset-spot-feeder", uniqueName: "Birdwatch_spot" };
    const res = await request(makeApp()).post("/api/sightings/start").query(spotCreds);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sighting.collectionId).toBe("north_american_winter_birds");
    expect(res.body.data.sighting.choiceBirdIds).toHaveLength(3);
  });

  test("POST /sightings/start during cooldown with no in-flight sighting doesn't re-roll", async () => {
    const spotCreds = { ...CREDS, assetId: "asset-spot-feeder", uniqueName: "Birdwatch_spot" };
    topiaMock.visitorSeed = {
      "world-scene-1": { spotCooldowns: { "asset-spot-feeder": Date.now() + 60_000 }, inFlight: {} },
    };
    const res = await request(makeApp()).post("/api/sightings/start").query(spotCreds);
    expect(res.status).toBe(200);
    expect(res.body.data.sighting).toBeNull();
  });

  test("POST /sightings/resolve wrong pick returns outcome='wrong' and doesn't update world count", async () => {
    const spotCreds = { ...CREDS, assetId: "asset-spot-feeder", uniqueName: "Birdwatch_spot" };
    // Seed a fake in-flight so resolve has something to validate against.
    topiaMock.visitorSeed = {
      "world-scene-1": {
        spotCooldowns: { "asset-spot-feeder": Date.now() + 60_000 },
        inFlight: {
          "asset-spot-feeder": {
            collectionId: "north_american_winter_birds",
            birdId: "northern_cardinal",
            choiceBirdIds: ["black_capped_chickadee", "northern_cardinal", "house_finch"],
          },
        },
      },
    };
    const res = await request(makeApp())
      .post("/api/sightings/resolve")
      .query(spotCreds)
      .send({ pickedBirdId: "black_capped_chickadee" });
    expect(res.status).toBe(200);
    expect(res.body.data.outcome).toBe("wrong");
    expect(res.body.data.rightBird.id).toBe("northern_cardinal");
  });

  test("POST /sightings/resolve correct pick adds +1 species item and counts from inventory", async () => {
    const spotCreds = { ...CREDS, assetId: "asset-spot-feeder", uniqueName: "Birdwatch_spot" };
    topiaMock.ecosystemItems = [{ id: "item-cardinal", name: "Northern Cardinal", type: "ITEM" }];
    // Already in the Field Guide with quantity 2 → this pick is a repeat, spotted 3 times.
    topiaMock.visitorInventoryItems = [
      { id: "ui-1", quantity: 2, item: { name: "Northern Cardinal", type: "ITEM", metadata: { birdId: "northern_cardinal" } } },
    ];
    topiaMock.visitorSeed = {
      "world-scene-1": {
        spotCooldowns: {},
        inFlight: {
          "asset-spot-feeder": {
            collectionId: "north_american_winter_birds",
            birdId: "northern_cardinal",
            choiceBirdIds: ["black_capped_chickadee", "northern_cardinal", "house_finch"],
          },
        },
      },
    };
    const res = await request(makeApp())
      .post("/api/sightings/resolve")
      .query(spotCreds)
      .send({ pickedBirdId: "northern_cardinal" });
    expect(res.status).toBe(200);
    expect(res.body.data.outcome).toBe("repeat");
    expect(res.body.data.timesSpotted).toBe(3);
    expect(res.body.data.yourSpeciesCount).toBe(1);
    await new Promise((r) => setTimeout(r, 10));
    expect(topiaMock.modifyInventoryItemQuantity).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Northern Cardinal" }),
      1,
    );
  });

  const seedCardinalInFlight = () => {
    topiaMock.visitorSeed = {
      "world-scene-1": {
        spotCooldowns: {},
        inFlight: {
          "asset-spot-feeder": {
            collectionId: "north_american_winter_birds",
            birdId: "northern_cardinal",
            choiceBirdIds: ["black_capped_chickadee", "northern_cardinal", "house_finch"],
          },
        },
      },
    };
  };

  test("POST /sightings/resolve leaderboard counts species found in this world, not the whole Field Guide", async () => {
    const spotCreds = { ...CREDS, assetId: "asset-spot-feeder", uniqueName: "Birdwatch_spot" };
    // Field Guide has two other species from other worlds; none found here yet.
    topiaMock.visitorInventoryItems = [
      { id: "ui-1", quantity: 1, item: { name: "Blue Jay", type: "ITEM", metadata: { birdId: "blue_jay" } } },
      { id: "ui-2", quantity: 1, item: { name: "House Finch", type: "ITEM", metadata: { birdId: "house_finch" } } },
    ];
    seedCardinalInFlight();
    const res = await request(makeApp())
      .post("/api/sightings/resolve")
      .query(spotCreds)
      .send({ pickedBirdId: "northern_cardinal" });
    expect(res.status).toBe(200);
    const world = topiaMock.lastWorld.dataObject;
    expect(world.leaderboardSpecies.p1).toEqual(["northern_cardinal"]);
    expect(world.leaderboard.p1.split("|")[1]).toBe("1");
  });

  test("POST /sightings/resolve a species already found here leaves the leaderboard entry alone", async () => {
    const spotCreds = { ...CREDS, assetId: "asset-spot-feeder", uniqueName: "Birdwatch_spot" };
    topiaMock.worldSeed = {
      adminSettings: { identificationMode: "description", cooldownSeconds: 60, allAboutBirdsLinksEnabled: true },
      collections: {},
      leaderboard: { p1: "You|1|1000" },
      leaderboardSpecies: { p1: ["northern_cardinal"] },
    };
    seedCardinalInFlight();
    const res = await request(makeApp())
      .post("/api/sightings/resolve")
      .query(spotCreds)
      .send({ pickedBirdId: "northern_cardinal" });
    expect(res.status).toBe(200);
    const world = topiaMock.lastWorld.dataObject;
    expect(world.leaderboard.p1).toBe("You|1|1000");
    expect(world.leaderboardSpecies.p1).toEqual(["northern_cardinal"]);
  });

  test("POST /admin/settings rejects non-admins", async () => {
    topiaMock.visitorIsAdmin = false;
    const res = await request(makeApp())
      .post("/api/admin/settings")
      .query(CREDS)
      .send({ identificationMode: "picture_match" });
    expect(res.status).toBe(403);
  });

  test("POST /admin/settings accepts admin updates", async () => {
    topiaMock.visitorIsAdmin = true;
    const res = await request(makeApp())
      .post("/api/admin/settings")
      .query(CREDS)
      .send({ identificationMode: "picture_match", cooldownSeconds: 120 });
    expect(res.status).toBe(200);
    expect(res.body.data.adminSettings.identificationMode).toBe("picture_match");
    expect(res.body.data.adminSettings.cooldownSeconds).toBe(120);
  });

  test("POST /admin/reset-leaderboard clears the leaderboard record", async () => {
    topiaMock.visitorIsAdmin = true;
    topiaMock.worldSeed = {
      adminSettings: { identificationMode: "description", cooldownSeconds: 60, allAboutBirdsLinksEnabled: true },
      collections: {},
      leaderboard: { p1: "You|5|1000" },
      leaderboardSpecies: { p1: ["northern_cardinal"] },
    };
    const res = await request(makeApp()).post("/api/admin/reset-leaderboard").query(CREDS);
    expect(res.status).toBe(200);
    expect(res.body.data.leaderboard).toEqual({});
    expect(topiaMock.lastWorld.dataObject.leaderboardSpecies).toEqual({});
  });

  test("POST /mystery/guess validates body and resolves correct answer", async () => {
    const { collection } = require("../data/collections/northAmericanWinterBirds");
    const puzzles = require("../data/collections/mysteryBirdPuzzles/northAmericanWinterBirds").puzzles;
    const puzzle = puzzles[0];

    topiaMock.visitorSeed = {
      "world-scene-1": {
        spotCooldowns: {},
        mysteryBird: {
          [collection.id]: {
            todayKey: require("../utils/mysteryBird/pickTodayPuzzle").etDayKey(),
            puzzleId: puzzle.id,
            guessedIds: [],
            solvedTotal: 0,
            firstTryTotal: 0,
            seenPuzzleIds: [puzzle.id],
          },
        },
      },
    };

    const res = await request(makeApp())
      .post("/api/mystery/guess")
      .query(CREDS)
      .send({ collectionId: collection.id, pickedBirdId: puzzle.answerId });
    expect(res.status).toBe(200);
    expect(res.body.data.outcome).toBe("solved");
    expect(res.body.data.mysteryBird.status).toBe("solved");
    expect(res.body.data.mysteryBird.answerId).toBe(puzzle.answerId);
    expect(res.body.data.mysteryBird.solvedTotal).toBe(1);
  });

  test("POST /mystery/guess solve toasts the earned badge right away (not queued)", async () => {
    const { collection } = require("../data/collections/northAmericanWinterBirds");
    const puzzle = require("../data/collections/mysteryBirdPuzzles/northAmericanWinterBirds").puzzles[0];
    topiaMock.ecosystemItems = [{ id: "badge-ms", name: "Mystery Solved", type: "BADGE" }];
    topiaMock.visitorSeed = {
      "world-scene-1": {
        spotCooldowns: {},
        mysteryBird: {
          [collection.id]: {
            todayKey: require("../utils/mysteryBird/pickTodayPuzzle").etDayKey(),
            puzzleId: puzzle.id,
            guessedIds: [],
            solvedTotal: 0,
            firstTryTotal: 0,
            seenPuzzleIds: [puzzle.id],
          },
        },
      },
    };
    await request(makeApp())
      .post("/api/mystery/guess")
      .query(CREDS)
      .send({ collectionId: collection.id, pickedBirdId: puzzle.answerId });
    await new Promise((r) => setTimeout(r, 10));
    expect(topiaMock.fireToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Badge Awarded", text: "You have earned the Mystery Solved badge!" }),
    );
  });

  test("GET /game-state includes today's Mystery Bird without the answer", async () => {
    const res = await request(makeApp()).get("/api/game-state").query(CREDS);
    const mb = res.body.data.mysteryBird;
    expect(mb.status).toBe("playing");
    expect(mb.guessesLeft).toBe(2);
    expect(mb.candidateIds).toHaveLength(4);
    expect(mb.clues).toHaveLength(3);
    expect(mb.answerId).toBeUndefined();
  });

  test("POST /mystery/guess wrong guess keeps the answer hidden and can't be repeated", async () => {
    const { collection } = require("../data/collections/northAmericanWinterBirds");
    const puzzles = require("../data/collections/mysteryBirdPuzzles/northAmericanWinterBirds").puzzles;
    const puzzle = puzzles[0];
    topiaMock.visitorSeed = {
      "world-scene-1": {
        spotCooldowns: {},
        mysteryBird: {
          [collection.id]: {
            todayKey: require("../utils/mysteryBird/pickTodayPuzzle").etDayKey(),
            puzzleId: puzzle.id,
            guessedIds: [puzzle.decoyIds[0]],
            solvedTotal: 0,
            firstTryTotal: 0,
            seenPuzzleIds: [puzzle.id],
          },
        },
      },
    };
    const repeat = await request(makeApp())
      .post("/api/mystery/guess")
      .query(CREDS)
      .send({ collectionId: collection.id, pickedBirdId: puzzle.decoyIds[0] });
    expect(repeat.status).toBe(400);

    const res = await request(makeApp())
      .post("/api/mystery/guess")
      .query(CREDS)
      .send({ collectionId: collection.id, pickedBirdId: puzzle.decoyIds[1] });
    expect(res.status).toBe(200);
    expect(res.body.data.outcome).toBe("out");
    expect(res.body.data.mysteryBird.guessedIds).toEqual([puzzle.decoyIds[0], puzzle.decoyIds[1]]);
    expect(res.body.data.mysteryBird.answerId).toBe(puzzle.answerId);
  });
});
