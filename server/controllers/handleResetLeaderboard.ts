import { Request, Response } from "express";
import { errorHandler, getVisitor, getWorld, getCredentials } from "@utils/index.js";

export const handleResetLeaderboard = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { isAdmin } = await getVisitor(credentials, true);
    if (!isAdmin) return res.status(403).json({ success: false, message: "Admin only" });

    const world = await getWorld(credentials);
    await world.updateDataObject({ leaderboard: {}, leaderboardSpecies: {} }, {});

    return res.json({ success: true, data: { leaderboard: {} } });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleResetLeaderboard",
      message: "Error resetting leaderboard",
      req,
      res,
    });
  }
};
