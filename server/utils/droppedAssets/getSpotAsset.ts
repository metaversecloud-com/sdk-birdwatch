import type { Credentials, SpotKey } from "../../types/index.js";
import type { ISpotAsset } from "../../types/DroppedAssetTypes.js";
import { SPOT_KEYS } from "@shared/types/index.js";
import { DroppedAsset } from "../topiaInit.js";
import { standardizeError } from "../standardizeError.js";

export class SpotAssetConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpotAssetConfigError";
  }
}

const isSpotKey = (v: unknown): v is SpotKey =>
  typeof v === "string" && (SPOT_KEYS as readonly string[]).includes(v);

export const getSpotAsset = async (
  credentials: Credentials,
  queryCollectionId?: string,
  querySpot?: string,
): Promise<ISpotAsset> => {
  try {
    const { assetId, urlSlug } = credentials;
    const asset = (await DroppedAsset.get(assetId, urlSlug, { credentials })) as unknown as ISpotAsset;
    if (!asset) throw new Error("Spot asset not found");

    await asset.fetchDataObject();
    const existing = asset.dataObject;

    if (!existing?.collectionId || !existing?.spot) {
      const collectionId = queryCollectionId || existing?.collectionId;
      const spotCandidate = querySpot || existing?.spot;
      if (!collectionId || !isSpotKey(spotCandidate)) {
        throw new SpotAssetConfigError(
          "World builder: set `?collectionId=<id>&spot=<feeder|pine_woods|frozen_pond|berry_bushes>` on this spot asset's iframe URL.",
        );
      }
      const lockId = `${assetId}-init-${Math.round(Date.now() / 60000)}`;
      await asset
        .updateDataObject({ collectionId, spot: spotCandidate }, { lock: { lockId, releaseLock: true } })
        .catch(() => undefined);
      await asset.fetchDataObject();
    }
    return asset;
  } catch (error) {
    throw standardizeError(error);
  }
};
