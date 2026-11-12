import express from "express";
import {
  handleGetGameState,
  handleStartSighting,
  handleResolveSighting,
  handleGetCooldown,
  handleUpdateAdminSettings,
  handleResetBirdCount,
  handleResetLeaderboard,
  handleMysteryGuess,
  handleTrackEvent,
} from "./controllers/index.js";
import { getVersion } from "@utils/getVersion.js";

const router = express.Router();
const SERVER_START_DATE = new Date();

router.get("/", (_req, res) => {
  res.json({ message: "Birdwatch server up" });
});

router.get("/system/health", (_req, res) => {
  return res.json({
    appVersion: getVersion(),
    status: "OK",
    serverStartDate: SERVER_START_DATE,
    envs: {
      COMMIT_HASH: process.env.COMMIT_HASH ?? "NOT SET",
      BUILD_TIME: process.env.BUILD_TIME ?? "NOT SET",
      NODE_ENV: process.env.NODE_ENV,
      INSTANCE_DOMAIN: process.env.INSTANCE_DOMAIN,
      INTERACTIVE_KEY: process.env.INTERACTIVE_KEY,
    },
  });
});

router.get("/game-state", handleGetGameState);
router.post("/sightings/start", handleStartSighting);
router.post("/sightings/resolve", handleResolveSighting);
router.get("/cooldown", handleGetCooldown);
router.post("/admin/settings", handleUpdateAdminSettings);
router.post("/admin/reset-bird-count", handleResetBirdCount);
router.post("/admin/reset-leaderboard", handleResetLeaderboard);
router.post("/mystery/guess", handleMysteryGuess);
router.post("/analytics", handleTrackEvent);

export default router;
