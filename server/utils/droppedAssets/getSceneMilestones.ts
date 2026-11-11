import type { Credentials } from "../../types/index.js";
import type { IKeyAsset } from "../../types/DroppedAssetTypes.js";
import type { ResolvedMilestones } from "@shared/types/index.js";
import { resolveMilestones } from "@shared/types/index.js";
import { getSceneSiblings } from "../sceneAssets.js";

/** The scene's key asset for a Collection (falls back to the first key asset in the scene). */
export const getSceneKeyAsset = async (
  credentials: Credentials,
  collectionId?: string,
): Promise<IKeyAsset | undefined> => {
  const { keyAssets } = await getSceneSiblings(credentials);
  const asset = keyAssets.find((a) => a.dataObject?.collectionId === collectionId) || keyAssets[0];
  if (asset && !asset.dataObject && typeof asset.fetchDataObject === "function") await asset.fetchDataObject();
  return asset;
};

/**
 * Milestone goals for this scene, from the key asset's `milestones` setting. Pass the key asset
 * when the request came from it, to skip the scene lookup. A failed lookup falls back to Default.
 */
export const getSceneMilestones = async (
  credentials: Credentials,
  collectionId?: string,
  keyAsset?: IKeyAsset,
): Promise<ResolvedMilestones> => {
  try {
    const asset = keyAsset || (await getSceneKeyAsset(credentials, collectionId));
    return resolveMilestones(asset?.dataObject?.milestones);
  } catch (error) {
    console.error("Failed to read milestone settings from the key asset; using Default.", error);
    return resolveMilestones(undefined);
  }
};
