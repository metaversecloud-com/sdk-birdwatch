import { BirdToken, RarityChip } from "@/components";
import { BirdFact } from "@/components/sightingResult/BirdFact";
import { discoveredBirdImage } from "@/utils";
import { SPOT_LABELS } from "@shared/types";
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
 * Open: bigger picture, Spot / Eats / Nests / Behavior, call and the Guess button.
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

  return (
    <div className={`bw-candidate${isOpen ? " bw-candidate--open" : ""}${stateClass}`}>
      <button type="button" className="bw-candidate__head" onClick={onToggle} aria-expanded={isOpen}>
        {!isOpen && <BirdToken birdId={bird.id} rarity={bird.rarity} src={discoveredBirdImage(bird.id)} size="sm" />}
        <div className="flex-1 text-left">
          <strong className="bw-candidate__name">{bird.name}</strong>
          <div className="flex flex-wrap gap-1 mt-1">
            <RarityChip rarity={bird.rarity} />
            {!found && <span className="bw-chip">Not found yet</span>}
          </div>
          {isWrong && <p className="bw-candidate__wrong">✕ Not this bird</p>}
          {isAnswer && <p className="bw-candidate__answer">✓ Today's Mystery Bird</p>}
        </div>
        <span className="bw-candidate__caret" aria-hidden="true">
          {isOpen ? "▾" : "▸"}
        </span>
      </button>

      {isOpen && (
        <div className="flex flex-col items-center gap-3 mt-2">
          <BirdToken birdId={bird.id} rarity={bird.rarity} src={discoveredBirdImage(bird.id)} size="lg" />
          <div className="bw-fact-grid">
            <BirdFact kind="spot" label="Spot" value={SPOT_LABELS[bird.spot]} />
            <BirdFact kind="eats" label="Eats" value={bird.eats.join(", ")} />
            <BirdFact kind="nests" label="Nests" value={bird.nests.join(", ")} />
            <BirdFact kind="behavior" label="Behavior" value={bird.behavior} />
          </div>
          <div className="bw-call w-full">
            <span className="bw-call__icon" aria-hidden="true">
              ♪
            </span>
            <div>
              <p className="bw-caption m-0">Call</p>
              <p className="m-0 font-bold">{bird.call}</p>
            </div>
          </div>
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
