import type { Bird, Credentials } from "../../types/index.js";
import { getCachedInventoryItems } from "./inventoryCache.js";
import { speciesInventoryItemName } from "./badgeNames.js";
import { Visitor } from "../topiaInit.js";
import { standardizeError } from "../standardizeError.js";

/**
 * Add one unit of a bird's ecosystem inventory item to this visitor, on every correct ID.
 * The item's quantity is the Field Guide's "times spotted" count (and feeds the
 * correct-ID badges). `modifyInventoryItemQuantity` grants the item if it isn't owned yet.
 * Matches the ecosystem catalog by exact item name (`bird.name`).
 */
export const grantSpeciesItem = async (
  credentials: Credentials,
  bird: Bird,
): Promise<{ granted: boolean; reason?: string }> => {
  try {
    const items = await getCachedInventoryItems({ credentials });
    const wantedName = speciesInventoryItemName(bird);
    const target = items.find((i) => i.name?.trim() === wantedName);

    if (!target) return { granted: false, reason: "species_item_not_in_ecosystem" };

    const visitor = Visitor.create(credentials.visitorId, credentials.urlSlug, { credentials });
    await visitor.modifyInventoryItemQuantity(target, 1);

    return { granted: true };
  } catch (error) {
    throw standardizeError(error);
  }
};
