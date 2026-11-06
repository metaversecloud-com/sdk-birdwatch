import type { IVisitor } from "../../types/DroppedAssetTypes.js";
import { COLLECTIONS } from "../../data/collections/index.js";

export interface VisitorBirdItem {
  id: string;
  name: string;
  birdId?: string;
  icon: string;
}

/**
 * Look up a bird id by its display name across every known Collection.
 * Used as a fallback when inventory items come back without the `metadata.birdId`
 * we baked into the ZIP (some importers drop custom metadata keys).
 * Case-insensitive, exact-match.
 */
const nameToBirdId: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const col of Object.values(COLLECTIONS)) {
    for (const bird of col.collection.species) {
      map[bird.name.toLowerCase()] = bird.id;
    }
  }
  return map;
})();

/** Map the visitor's active species inventory items (non-BADGE), keyed by Bird.id. */
export const getVisitorBirdItems = (visitor: IVisitor): Record<string, VisitorBirdItem> => {
  const result: Record<string, VisitorBirdItem> = {};
  for (const vi of visitor.inventoryItems || []) {
    const { id, item } = vi;
    const name = item?.name;
    const type = item?.type;
    const icon = item?.image_url;
    const metadata = (item?.metadata as Record<string, unknown> | null | undefined) || undefined;

    if (type === "BADGE") continue;

    // Prefer the explicit metadata.birdId we set in the ZIP. If an importer dropped
    // custom metadata, fall back to matching the display name against the registry.
    const metaBirdId = typeof metadata?.birdId === "string" ? (metadata.birdId as string) : undefined;
    const birdId = metaBirdId || (typeof name === "string" ? nameToBirdId[name.trim().toLowerCase()] : undefined);
    if (!birdId) continue;

    result[birdId] = { id, name: name || "", birdId, icon: icon || "" };
  }
  return result;
};
