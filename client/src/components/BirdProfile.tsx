import type { ReactNode } from "react";

// components
import { BirdInfo, BirdToken, RarityChip } from "@/components";

// utils
import type { Bird } from "@shared/types";
import { discoveredBirdImage, undiscoveredBirdImage } from "@/utils";

interface Props {
  bird: Bird;
  /** Player has identified this bird. Controls the "Not found yet" chip. */
  found: boolean;
  /** Show the real picture and full fact values. Defaults to `found`. */
  revealed?: boolean;
  linksOn?: boolean;
  showFacts?: boolean;
  showCall?: boolean;
  /** Extra status lines rendered under the chips, above the fact grid. */
  children?: ReactNode;
}

/** Centered bird profile: token, name, rarity, then BirdInfo. Shared by the Field Guide page and Mystery Bird cards. */
export const BirdProfile = ({
  bird,
  found,
  revealed = found,
  linksOn = false,
  showFacts,
  showCall,
  children,
}: Props) => (
  <div className="flex flex-col items-center gap-4 text-center">
    <BirdToken
      birdId={bird.id}
      rarity={bird.rarity}
      src={revealed ? discoveredBirdImage(bird.id) : undiscoveredBirdImage(bird.id)}
      size="lg"
    />
    <h2 className="m-0">{bird.name}</h2>
    <RarityChip rarity={bird.rarity} />
    {!found && <span className="bw-chip">Not found yet</span>}
    {children}
    <BirdInfo bird={bird} found={revealed} linksOn={linksOn} showFacts={showFacts} showCall={showCall} />
  </div>
);

export default BirdProfile;
