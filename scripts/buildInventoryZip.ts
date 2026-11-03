/**
 * Build birdwatch-inventory.zip in the Topia inventory ZIP format.
 *
 * Format spec:
 *   /Users/linabell/Documents/GitHub/topia-stack/docs/claude/inventory-zip-format.md
 *
 * The archive layout:
 *   manifest.json            — { version: "1.0", exported_from_mc_id, item_count, ... }
 *   items.json               — array of items, each with source_mc_id, source_item_id,
 *                              name, type, status, description, metadata, image_filename,
 *                              sprite_filename, unlockable
 *   images/<filename>.png    — one PNG per item, matched by `image_filename` exactly
 *
 * Run:
 *   npx tsx scripts/buildInventoryZip.ts
 *   npx tsx scripts/buildInventoryZip.ts --images "/path/to/Discovered State" --out "/path/to/zip"
 */
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

import { birds } from "../server/data/collections/northAmericanWinterBirds.js";

const argv = process.argv.slice(2);
const argAt = (flag: string, fallback: string): string => {
  const i = argv.indexOf(flag);
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  return fallback;
};

const IMAGES_DIR = argAt("--images", "/Users/linabell/Downloads/Birdwatch/Discovered State");
const OUT_PATH = argAt("--out", "/Users/linabell/Downloads/Birdwatch/birdwatch-inventory.zip");

/** birdId -> source filename on disk: black_capped_chickadee → Black-Capped-Chickadee.png */
const sourcePngForBird = (birdId: string): string =>
  birdId.split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("-") + ".png";

interface InventoryItem {
  source_mc_id: string | null;
  source_item_id: string;
  name: string;
  type: "ITEM" | "BADGE" | "CURRENCY" | "NPC" | "EMOTE";
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED" | "DISABLED";
  description: string | null;
  metadata: Record<string, unknown>;
  image_filename: string | null;
  sprite_filename: string | null;
  unlockable: boolean;
}

const main = async () => {
  const zip = new JSZip();
  const items: InventoryItem[] = [];
  const missing: string[] = [];

  for (const bird of birds) {
    const src = path.join(IMAGES_DIR, sourcePngForBird(bird.id));
    if (!fs.existsSync(src)) {
      missing.push(src);
      continue;
    }

    // Keep the archive filename aligned with source_item_id for readability.
    const imageFilename = `${bird.id}.png`;
    zip.file(`images/${imageFilename}`, fs.readFileSync(src));

    items.push({
      source_mc_id: null,
      source_item_id: bird.id,
      name: bird.name,
      type: "ITEM",
      status: "ACTIVE",
      description: bird.fieldMark,
      metadata: {
        birdId: bird.id,
        collectionId: bird.collectionId,
        spot: bird.spot,
        rarity: bird.rarity,
        sortOrder: bird.sortOrder,
      },
      image_filename: imageFilename,
      sprite_filename: null,
      unlockable: false,
    });
  }

  const manifest = {
    version: "1.0",
    exported_from_mc_id: null,
    exported_from_mc_name: null,
    exported_at: new Date().toISOString(),
    item_count: items.length,
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("items.json", JSON.stringify(items, null, 2));

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, buffer);

  console.log(`Wrote ${OUT_PATH}`);
  console.log(`  items: ${items.length}`);
  if (missing.length) console.log(`  MISSING: ${missing.length} source files not found:\n   - ${missing.join("\n   - ")}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
