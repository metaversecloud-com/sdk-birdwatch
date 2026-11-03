import { Request, Response } from "express";
import {
  errorHandler,
  getBirdwatchVisitor,
  getBirdwatchWorld,
  getCredentials,
} from "@utils/index.js";
import type { AdminSettings, IdentificationMode, CooldownOption } from "@shared/types/index.js";
import type { DataObjectPatch } from "../types/DroppedAssetTypes.js";
import { COOLDOWN_OPTIONS } from "@shared/types/index.js";

const isMode = (v: unknown): v is IdentificationMode => v === "description" || v === "picture_match";
const isCooldown = (v: unknown): v is CooldownOption =>
  typeof v === "number" && (COOLDOWN_OPTIONS as readonly number[]).includes(v);

export const handleUpdateAdminSettings = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { isAdmin } = await getBirdwatchVisitor(credentials, true);
    if (!isAdmin) return res.status(403).json({ success: false, message: "Admin only" });

    const body = (req.body || {}) as Partial<AdminSettings>;
    const updates: DataObjectPatch = {};
    if (body.identificationMode !== undefined) {
      if (!isMode(body.identificationMode)) return res.status(400).json({ success: false, message: "Invalid identificationMode" });
      updates["adminSettings.identificationMode"] = body.identificationMode;
    }
    if (body.cooldownSeconds !== undefined) {
      if (!isCooldown(body.cooldownSeconds)) return res.status(400).json({ success: false, message: "Invalid cooldownSeconds" });
      updates["adminSettings.cooldownSeconds"] = body.cooldownSeconds;
    }
    if (body.allAboutBirdsLinksEnabled !== undefined) {
      if (typeof body.allAboutBirdsLinksEnabled !== "boolean")
        return res.status(400).json({ success: false, message: "Invalid allAboutBirdsLinksEnabled" });
      updates["adminSettings.allAboutBirdsLinksEnabled"] = body.allAboutBirdsLinksEnabled;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid settings provided" });
    }

    const world = await getBirdwatchWorld(credentials);
    await world.updateDataObject(updates, {});
    const adminSettings = world.dataObject.adminSettings as AdminSettings;
    return res.json({ success: true, data: { adminSettings } });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleUpdateAdminSettings",
      message: "Error updating admin settings",
      req,
      res,
    });
  }
};
