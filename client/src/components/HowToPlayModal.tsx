import { useContext, useEffect, useState } from "react";

// context
import { GlobalStateContext } from "@/context/GlobalContext";

const INSTRUCTIONS_IMAGE_URL = "https://sdk-instructions.s3.us-east-1.amazonaws.com/Birdwatch-instructions.png";

/**
 * How to Play image, shown once on the player's first open of Birdwatch in this world.
 * Rendered by every drawer, since a player may click a bird spot before the key asset.
 */
export const HowToPlayModal = () => {
  const { gameState } = useContext(GlobalStateContext);
  const [dismissed, setDismissed] = useState(false);
  const isOpen = Boolean(gameState?.showInstructions) && !dismissed;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDismissed(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="bw-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="How to play Birdwatch"
      onClick={() => setDismissed(true)}
    >
      <div className="bw-modal bw-howto" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="bw-modal__close" onClick={() => setDismissed(true)} aria-label="Close">
          ✕
        </button>
        <img
          className="bw-howto__image"
          src={INSTRUCTIONS_IMAGE_URL}
          alt="How to play Birdwatch: visit bird spots, identify the bird from three choices, and fill your Field Guide."
        />
        <button type="button" className="bw-btn-primary mt-3" onClick={() => setDismissed(true)}>
          Let's Go Birding!
        </button>
      </div>
    </div>
  );
};

export default HowToPlayModal;
