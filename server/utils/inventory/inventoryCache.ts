import type { Credentials } from "../../types/index.js";
import type { InventoryItemInterface } from "@rtsdk/topia";
import { Ecosystem } from "../topiaInit.js";

const TTL_MS = 1000 * 60 * 60 * 6; // 6-hour cache per ecosystem keyed by publicKey

interface CachedInventory {
  items: InventoryItemInterface[];
  fetchedAt: number;
}

const cache = new Map<string, CachedInventory>();

/**
 * Return the catalog of ecosystem inventory items (badges + species items + anything else
 * uploaded to this ecosystem). SDK pattern: `fetchInventoryItems()` populates the
 * `inventoryItems` getter.
 */
export const getCachedInventoryItems = async (
  { credentials }: { credentials: Credentials },
  forceRefresh = false,
): Promise<InventoryItemInterface[]> => {
  const key = credentials.interactivePublicKey;
  const cached = cache.get(key);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.items;

  const ecosystem = Ecosystem.create({ credentials });
  await ecosystem.fetchInventoryItems();
  const items = ecosystem.inventoryItems || [];
  cache.set(key, { items, fetchedAt: Date.now() });
  return items;
};

export const invalidateInventoryCache = (publicKey?: string) => {
  if (publicKey) cache.delete(publicKey);
  else cache.clear();
};
