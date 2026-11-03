import type { DroppedAssetInterface } from "@rtsdk/topia";
import type { Credentials } from "../types/index.js";
import type { IKeyAsset, ISpotAsset } from "../types/DroppedAssetTypes.js";
import { World } from "./topiaInit.js";
import { standardizeError } from "./standardizeError.js";

/**
 * Find all Birdwatch assets in a scene by `sceneDropId`.
 * Siblings share a sceneDropId; we filter by uniqueName.
 */
export const getSceneSiblings = async (credentials: Credentials) => {
  try {
    const { urlSlug, sceneDropId } = credentials;
    const world = World.create(urlSlug, { credentials });
    // The SDK's return type is the DroppedAsset class; the DroppedAssetInterface is what
    // actually exposes `uniqueName`. The class implements it, so this reinterpretation is safe.
    const assets = (await world.fetchDroppedAssetsBySceneDropId({ sceneDropId })) as unknown as DroppedAssetInterface[];

    const keyAssets: IKeyAsset[] = [];
    const spotAssets: ISpotAsset[] = [];
    const trophyAssets: DroppedAssetInterface[] = [];

    for (const asset of assets || []) {
      switch (asset.uniqueName) {
        case "Birdwatch_keyAsset":
          keyAssets.push(asset as unknown as IKeyAsset);
          break;
        case "Birdwatch_spot":
          spotAssets.push(asset as unknown as ISpotAsset);
          break;
        case "Birdwatch_trophy":
          trophyAssets.push(asset);
          break;
      }
    }

    return { keyAssets, spotAssets, trophyAssets };
  } catch (error) {
    throw standardizeError(error);
  }
};
