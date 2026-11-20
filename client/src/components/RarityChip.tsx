import type { Rarity } from "@shared/types";
import { RARITY_LABEL, RARITY_STARS } from "@shared/types";

export const RarityChip = ({ rarity }: { rarity: Rarity }) => (
  <span className={`bw-chip bw-chip--${rarity}`}>
    <span aria-hidden="true">{"★".repeat(RARITY_STARS[rarity])}</span>
    <span>{RARITY_LABEL[rarity]}</span>
  </span>
);
export default RarityChip;
