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
    expect(res.body.data.sighting.assetId).toBe("asset-spot-feeder");
    expect(res.body.data.sighting.spotKey).toBe("feeder");
    expect(res.body.data.sighting.choiceBirdIds).toHaveLength(3);
  });

  test("POST /sightings/resolve wrong pick returns outcome='wrong' and doesn't update world count", async () => {
    const spotCreds = { ...CREDS, assetId: "asset-spot-feeder", uniqueName: "Birdwatch_spot" };
    // Seed a fake in-flight so resolve has something to validate against.
    topiaMock.visitorSeed = {
      "world-scene-1": {
        collections: {},
        spotCooldowns: {
          "asset-spot-feeder": { startedAt: Date.now(), durationSeconds: 60 },
        },
        inFlight: {
          "asset-spot-feeder": {
            assetId: "asset-spot-feeder",
            spotKey: "feeder",
            collectionId: "north_american_winter_birds",
            birdId: "northern_cardinal",
            choiceBirdIds: ["black_capped_chickadee", "northern_cardinal", "house_finch"],
            rolledAt: Date.now(),
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
    };
    const res = await request(makeApp()).post("/api/admin/reset-leaderboard").query(CREDS);
    expect(res.status).toBe(200);
    expect(res.body.data.leaderboard).toEqual({});
  });

  test("POST /mystery/guess validates body and resolves correct answer", async () => {
    const { collection } = require("../data/collections/northAmericanWinterBirds");
    const puzzles = require("../data/collections/mysteryBirdPuzzles/northAmericanWinterBirds").puzzles;
    const puzzle = puzzles[0];

    topiaMock.visitorSeed = {
      "world-scene-1": {
        collections: {},
        spotCooldowns: {},
        mysteryBird: {
          [collection.id]: {
            todayKey: require("../utils/mysteryBird/pickTodayPuzzle").etDayKey(),
            puzzleId: puzzle.id,
            guessesUsed: 0,
            solved: false,
            solvedOnFirstTry: false,
            solvedTotal: 0,
            firstTryTotal: 0,
            openedCards: {},
            openedBirdCards: [],
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
    expect(res.body.data.answerBirdId).toBe(puzzle.answerId);
  });
});
