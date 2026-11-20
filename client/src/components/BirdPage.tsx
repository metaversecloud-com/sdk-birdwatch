import { useContext, useEffect } from "react";

// components
import { BirdProfile } from "@/components";

// context
import type { Bird } from "@shared/types";
import { GlobalStateContext } from "@/context/GlobalContext";

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
        <BirdProfile bird={bird} found={found} linksOn={linksOn} />
      </div>
    </div>
  );
};

export default BirdPage;
