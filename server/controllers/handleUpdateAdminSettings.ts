import { Request, Response } from "express";
import {
  errorHandler,
  getVisitor,
  getWorld,
  getCredentials,
  getSceneKeyAsset,
  DroppedAsset,
} from "@utils/index.js";
import type {
  AdminSettings,
  IdentificationMode,
  CooldownOption,
  MilestoneDifficulty,
  ResolvedMilestones,
} from "@shared/types/index.js";
import type { DataObjectPatch, IKeyAsset } from "../types/DroppedAssetTypes.js";
import {
  COOLDOWN_OPTIONS,
  MILESTONE_DIFFICULTIES,
  milestonesForDifficulty,
  milestonesSkippedBySwitch,
  resolveMilestones,
} from "@shared/types/index.js";

const isMode = (v: unknown): v is IdentificationMode => v === "description" || v === "picture_match";
const isCooldown = (v: unknown): v is CooldownOption =>
  typeof v === "number" && (COOLDOWN_OPTIONS as readonly number[]).includes(v);
const isDifficulty = (v: unknown): v is MilestoneDifficulty =>
  typeof v === "string" && (MILESTONE_DIFFICULTIES as readonly string[]).includes(v);

type SettingsBody = Partial<AdminSettings> & { milestoneDifficulty?: MilestoneDifficulty };

/** The scene's key asset, fetched fresh so it can be written to. */
const fetchKeyAsset = async (credentials: ReturnType<typeof getCredentials>): Promise<IKeyAsset | undefined> => {
  const keyAssetId =
    credentials.uniqueName === "Birdwatch_keyAsset"
      ? credentials.assetId
      : (await getSceneKeyAsset(credentials))?.id;
  if (!keyAssetId) return undefined;
  const asset = (await DroppedAsset.get(keyAssetId, credentials.urlSlug, { credentials })) as unknown as IKeyAsset;
  await asset.fetchDataObject();
  return asset;
};

export const handleUpdateAdminSettings = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { isAdmin } = await getVisitor(credentials, true);
    if (!isAdmin) return res.status(403).json({ success: false, message: "Admin only" });

    const body = (req.body || {}) as SettingsBody;
    const updates: DataObjectPatch = {};
    if (body.identificationMode !== undefined) {
      if (!isMode(body.identificationMode))
        return res.status(400).json({ success: false, message: "Invalid identificationMode" });
      updates["adminSettings.identificationMode"] = body.identificationMode;
    }
    if (body.cooldownSeconds !== undefined) {
      if (!isCooldown(body.cooldownSeconds))
        return res.status(400).json({ success: false, message: "Invalid cooldownSeconds" });
      updates["adminSettings.cooldownSeconds"] = body.cooldownSeconds;
    }
    if (body.allAboutBirdsLinksEnabled !== undefined) {
      if (typeof body.allAboutBirdsLinksEnabled !== "boolean")
        return res.status(400).json({ success: false, message: "Invalid allAboutBirdsLinksEnabled" });
      updates["adminSettings.allAboutBirdsLinksEnabled"] = body.allAboutBirdsLinksEnabled;
    }
    if (body.milestoneDifficulty !== undefined && !isDifficulty(body.milestoneDifficulty)) {
      return res.status(400).json({ success: false, message: "Invalid milestoneDifficulty" });
    }
    if (Object.keys(updates).length === 0 && body.milestoneDifficulty === undefined) {
      return res.status(400).json({ success: false, message: "No valid settings provided" });
    }

    const world = await getWorld(credentials);

    // Milestone difficulty lives on the scene's key asset. Validate before writing anything.
    let keyAsset: IKeyAsset | undefined;
    let milestones: ResolvedMilestones | undefined;
    if (body.milestoneDifficulty !== undefined) {
      keyAsset = await fetchKeyAsset(credentials);
      if (!keyAsset) return res.status(400).json({ success: false, message: "No key asset found in this scene." });
      const current = resolveMilestones(keyAsset.dataObject?.milestones);
      if (current.difficulty !== body.milestoneDifficulty) {
        const collectionId = keyAsset.dataObject?.collectionId;
        const total = (collectionId && world.dataObject.collections?.[collectionId]?.totalSightings) || 0;
        const next = milestonesForDifficulty(body.milestoneDifficulty);
        if (milestonesSkippedBySwitch(current.config, next, total).length) {
          return res.status(400).json({
            success: false,
            message: "That difficulty has a milestone goal at or below the current World Bird Count.",
          });
        }
      }
      milestones = resolveMilestones(body.milestoneDifficulty);
    }

    if (Object.keys(updates).length) await world.updateDataObject(updates, {});
    if (keyAsset && milestones) await keyAsset.updateDataObject({ milestones: body.milestoneDifficulty }, {});
    const adminSettings = world.dataObject.adminSettings as AdminSettings;

    return res.json({ success: true, data: { adminSettings, ...(milestones ? { milestones } : {}) } });
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
