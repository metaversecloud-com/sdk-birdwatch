import type { Rarity } from "@shared/types";
import { RARITY_STARS } from "@shared/types";

interface Props {
  birdId: string;
  rarity: Rarity;
  src?: string;
  size?: "sm" | "md" | "lg";
  alt?: string;
}

const stars = (n: number) => "★".repeat(n);

export const BirdToken = ({ birdId, rarity, src, size = "md", alt }: Props) => (
  <div
    className={`bw-token bw-token--${rarity} ${size === "lg" ? "bw-token--lg" : size === "sm" ? "bw-token--sm" : ""}`}
    aria-label={alt || birdId}
  >
    {src && <img className="bw-token__img" src={src} alt={alt || birdId} />}
    <span className="bw-token__stars" aria-hidden="true">
      {stars(RARITY_STARS[rarity])}
    </span>
  </div>
);
export default BirdToken;
