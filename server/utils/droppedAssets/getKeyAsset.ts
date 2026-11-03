import type { Credentials } from "../../types/index.js";
import type { IKeyAsset } from "../../types/DroppedAssetTypes.js";
import { DroppedAsset } from "../topiaInit.js";
import { standardizeError } from "../standardizeError.js";

export class KeyAssetConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyAssetConfigError";
  }
}

/**
 * Fetch the key asset and initialize its data object from `req.query` on first touch.
 * `queryCollectionId` is read from the request's query — if the data object isn't
 * initialized yet AND the query is missing a collectionId, we throw a config error so
 * the world builder sees a clear "set collectionId on the iframe URL" message.
 */
export const getKeyAsset = async (
  credentials: Credentials,
  queryCollectionId?: string,
): Promise<IKeyAsset> => {
  try {
    const { assetId, urlSlug } = credentials;
    const asset = (await DroppedAsset.get(assetId, urlSlug, { credentials })) as unknown as IKeyAsset;
    if (!asset) throw new Error("Key asset not found");

    await asset.fetchDataObject();
    const existing = asset.dataObject;

    if (!existing?.collectionId) {
      const collectionId = queryCollectionId || existing?.collectionId;
      if (!collectionId) {
        throw new KeyAssetConfigError(
          "World builder: set `?collectionId=<id>` on this key asset's iframe URL.",
        );
      }
      const lockId = `${assetId}-init-${Math.round(Date.now() / 60000)}`;
      await asset
        .updateDataObject({ collectionId }, { lock: { lockId, releaseLock: true } })
        .catch(() => undefined);
      await asset.fetchDataObject();
    }
    return asset;
  } catch (error) {
    throw standardizeError(error);
  }
};
