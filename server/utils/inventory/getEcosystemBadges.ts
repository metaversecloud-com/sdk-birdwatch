import type { Credentials } from "../../types/index.js";
import { getCachedInventoryItems } from "./inventoryCache.js";

export interface EcosystemBadge {
  id: string;
  name: string;
  icon: string;
  description: string;
}

/**
 * Ecosystem badge catalog keyed by name — covers every BADGE in the ecosystem,
 * not just the ones the caller owns. Lets BadgesTab render a grayscale locked
 * tile with the real icon instead of a blank placeholder.
 */
export const getEcosystemBadges = async (credentials: Credentials): Promise<Record<string, EcosystemBadge>> => {
  const items = await getCachedInventoryItems({ credentials });
  const catalog: Record<string, EcosystemBadge> = {};
  for (const item of items) {
    const i = item as {
      id?: string;
      name?: string;
      type?: string;
      status?: string;
      image_url?: string;
      image_path?: string;
      description?: string;
    };
    if (!i?.name || i.type !== "BADGE" || (i.status && i.status !== "ACTIVE")) continue;
    catalog[i.name] = {
      id: i.id || "",
      name: i.name,
      icon: i.image_url || i.image_path || "",
      description: i.description || "",
    };
  }
  return catalog;
};
