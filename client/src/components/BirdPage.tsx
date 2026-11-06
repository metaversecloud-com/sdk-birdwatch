import { useContext, useEffect } from "react";

// components
import { BirdInfo, BirdToken, RarityChip } from "@/components";

// context
import type { Bird } from "@shared/types";
import { GlobalStateContext } from "@/context/GlobalContext";

// utils
import { discoveredBirdImage, undiscoveredBirdImage } from "@/utils";

export const BirdPage = ({ bird, onClose }: { bird: Bird; onClose: () => void }) => {
  const { visitorBirdItems, gameState } = useContext(GlobalStateContext);
  const found = Boolean(visitorBirdItems?.[bird.id]);
  const linksOn = gameState?.adminSettings?.allAboutBirdsLinksEnabled !== false;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="bw-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${bird.name} field guide page`}
      onClick={onClose}
    >
      <div className="bw-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="bw-modal__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="flex flex-col items-center gap-4 text-center p-2">
          <BirdToken
            birdId={bird.id}
            rarity={bird.rarity}
            src={found ? discoveredBirdImage(bird.id) : undiscoveredBirdImage(bird.id)}
            size="lg"
          />
          <h2 className="m-0">{bird.name}</h2>
          <RarityChip rarity={bird.rarity} />
          {!found && <span className="bw-chip">Not found yet</span>}
          <BirdInfo bird={bird} found={found} linksOn={linksOn} />
        </div>
      </div>
    </div>
  );
};

export default BirdPage;
