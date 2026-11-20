import type { IVisitor } from "../../types/DroppedAssetTypes.js";

export interface VisitorBadge {
  id: string;
  name: string;
  icon: string;
}

/** Map the visitor's active BADGE inventory items into a {name → VisitorBadge} record. */
export const getVisitorBadges = (visitor: IVisitor): Record<string, VisitorBadge> => {
  const result: Record<string, VisitorBadge> = {};
  for (const vi of visitor.inventoryItems || []) {
    const { id, item } = vi;
    const name = item?.name;
    const type = item?.type;
    const icon = item?.image_url;
    if (type === "BADGE" && name) {
      result[name] = { id, name, icon: icon || "" };
    }
  }
  return result;
};
