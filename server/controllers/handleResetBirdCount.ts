import { Request, Response } from "express";
import {
  errorHandler,
  getVisitor,
  getWorld,
  getCredentials,
  emptyCollectionState,
} from "@utils/index.js";
import type { CollectionWorldState } from "@shared/types/index.js";
import type { DataObjectPatch } from "../types/DroppedAssetTypes.js";

export const handleResetBirdCount = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { isAdmin } = await getVisitor(credentials, true);
    if (!isAdmin) return res.status(403).json({ success: false, message: "Admin only" });

    const world = await getWorld(credentials);
    const perCollection: Record<string, CollectionWorldState> = world.dataObject.collections || {};

    const updates: DataObjectPatch = {};
    for (const collectionId of Object.keys(perCollection)) {
      updates[`collections.${collectionId}`] = emptyCollectionState(collectionId);
    }

    if (Object.keys(updates).length === 0) {
      return res.json({ success: true, data: { reset: 0 } });
    }

    await world.updateDataObject(updates, {});

    return res.json({ success: true, data: { reset: Object.keys(updates).length } });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleResetBirdCount",
      message: "Error resetting bird count",
      req,
      res,
    });
  }
};
