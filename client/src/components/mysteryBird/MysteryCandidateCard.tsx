import { BirdProfile, BirdToken, RarityChip } from "@/components";
import { discoveredBirdImage } from "@/utils";
import type { Bird } from "@shared/types";

interface Props {
  bird: Bird;
  found: boolean;
  isOpen: boolean;
  /** Guessed today and wrong: grayed out, can't be guessed again. */
  isWrong: boolean;
  /** Revealed as the answer once the player is done for the day. */
  isAnswer: boolean;
  canGuess: boolean;
  submitting: boolean;
  onToggle: () => void;
  onGuess: () => void;
}

/**
 * One Mystery Bird candidate. Collapsed: token, name, rarity, "Not found yet".
 * Open: the shared BirdProfile (same layout as the Field Guide page) with the call, then the Guess button.
 * Every candidate shows full info, even birds the player hasn't found yet.
 * The field mark is never shown, so a Looks clue has to be checked from the picture.
 */
export const MysteryCandidateCard = ({
  bird,
  found,
  isOpen,
  isWrong,
  isAnswer,
  canGuess,
  submitting,
  onToggle,
  onGuess,
}: Props) => {
  const stateClass = isAnswer ? " bw-candidate--answer" : isWrong ? " bw-candidate--wrong" : "";
  const status = (
    <>
      {isWrong && <p className="bw-candidate__wrong">✕ Not this bird</p>}
      {isAnswer && <p className="bw-candidate__answer">✓ Today's Mystery Bird</p>}
    </>
  );

  return (
    <div className={`bw-candidate${isOpen ? " bw-candidate--open" : ""}${stateClass}`}>
      <button
        type="button"
        className="bw-candidate__head"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? `Collapse ${bird.name}` : undefined}
      >
        {!isOpen && (
          <>
            <BirdToken birdId={bird.id} rarity={bird.rarity} src={discoveredBirdImage(bird.id)} size="sm" />
            <div className="flex-1 text-left">
              <strong className="bw-candidate__name">{bird.name}</strong>
              <div className="flex flex-wrap gap-1 mt-1">
                <RarityChip rarity={bird.rarity} />
                {!found && <span className="bw-chip">Not found yet</span>}
              </div>
              {status}
            </div>
          </>
        )}
        <span className="bw-candidate__caret ml-auto" aria-hidden="true">
          {isOpen ? "▾" : "▸"}
        </span>
      </button>

      {isOpen && (
        <div className="flex flex-col items-center gap-3">
          {/* revealed: candidates always show full info, even unfound birds. */}
          <BirdProfile bird={bird} found={found} revealed showFacts={false} showCall>
            {status}
          </BirdProfile>
          {canGuess && (
            <button type="button" className="bw-btn-mystery" onClick={onGuess} disabled={submitting}>
              Guess: {bird.name}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MysteryCandidateCard;
