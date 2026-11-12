// Vite's glob import gives us a map of absolute asset paths at build time.
const discoveredModules = import.meta.glob("@/assets/birds/discovered/*.png", {
  eager: true,
  as: "url",
}) as Record<string, string>;
const undiscoveredModules = import.meta.glob("@/assets/birds/undiscovered/*.png", {
  eager: true,
  as: "url",
}) as Record<string, string>;

/** "black_capped_chickadee" → "Black-Capped-Chickadee" */
const toTitleHyphen = (birdId: string): string =>
  birdId.split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("-");

const build = (map: Record<string, string>, suffix: string) => {
  const result: Record<string, string> = {};
  for (const [path, url] of Object.entries(map)) {
    const base = path.split("/").pop() || "";
    const name = base.replace(/\.png$/, "").replace(/_Gray$/, "");
    const birdId = name
      .split("-")
      .map((p) => p.toLowerCase())
      .join("_");
    result[birdId] = url;
    void suffix;
  }
  return result;
};

const DISCOVERED = build(discoveredModules, "");
const UNDISCOVERED = build(undiscoveredModules, "_Gray");

export const discoveredBirdImage = (birdId: string): string | undefined => DISCOVERED[birdId];
export const undiscoveredBirdImage = (birdId: string): string | undefined => UNDISCOVERED[birdId];

export const birdImage = (birdId: string, found: boolean): string | undefined =>
  (found ? DISCOVERED[birdId] : UNDISCOVERED[birdId]) || DISCOVERED[birdId];

export { toTitleHyphen };
