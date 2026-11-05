import type { Credentials } from "../../types/index.js";
import type { IBirdwatchVisitor } from "../../types/DroppedAssetTypes.js";
import type { VisitorPerScene } from "@shared/types/index.js";
import { sceneKey } from "@shared/types/index.js";
import { Visitor } from "../topiaInit.js";
import { standardizeError } from "../standardizeError.js";

export const emptyVisitorScene = (): VisitorPerScene => ({
  collections: {},
  spotCooldowns: {},
});

/**
 * Fetch the visitor + their per-scene slice of the Birdwatch data object.
 * Scene entries live at the top level of the visitor dataObject, keyed by
 * `${urlSlug}-${sceneDropId}`.
 */
export const getBirdwatchVisitor = async (
  credentials: Credentials,
  shouldGetVisitorDetails = true,
  options: { includeInventory?: boolean } = {},
) => {
  try {
    const { visitorId, urlSlug, sceneDropId } = credentials;

    const visitor = (shouldGetVisitorDetails
      ? await Visitor.get(visitorId, urlSlug, { credentials })
      : Visitor.create(visitorId, urlSlug, { credentials })) as unknown as IBirdwatchVisitor;
    if (!visitor) throw new Error("Visitor not found");

    await visitor.fetchDataObject();
    const key = sceneKey(urlSlug, sceneDropId);
    const current = visitor.dataObject?.[key];

    if (!current) {
      const lockId = `${visitorId}-${key}-init-${Math.round(Date.now() / 60000)}`;
      await visitor
        .updateDataObject({ [key]: emptyVisitorScene() }, { lock: { lockId, releaseLock: true } })
        .catch(() => undefined);
      await visitor.fetchDataObject();
    }

    if (options.includeInventory) {
      await visitor.fetchInventoryItems();
    }

    const perScene = (visitor.dataObject?.[key] || emptyVisitorScene()) as VisitorPerScene;
    const isAdmin = Boolean(visitor.isAdmin);

    return { visitor, isAdmin, perScene, sceneKey: key };
  } catch (error) {
    throw standardizeError(error);
  }
};
