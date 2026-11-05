import { useState } from "react";
import type { Bird, VisitorInFlightSighting } from "@shared/types";
import { nawbById } from "@/data/nawb";
import { discoveredBirdImage } from "@/utils";
import { BirdToken } from "./BirdToken";
import Spinner from "./Spinner";

interface Props {
  sighting: VisitorInFlightSighting;
  mode: "description" | "picture_match";
  onPick: (birdId: string) => void;
  disabled?: boolean;
}

const letters = ["A", "B", "C"] as const;

export const BirdSightingCard = ({ sighting, mode, onPick, disabled }: Props) => {
  const [selected, setSelected] = useState<string | null>(null);
  const bird = nawbById[sighting.birdId];

  const pick = (id: string) => {
    if (disabled) return;
    setSelected(id);
    onPick(id);
  };

  return (
    <div className="bw-card flex flex-col gap-3">
      <div className="flex justify-center">
        {bird && (
          <BirdToken
            birdId={bird.id}
            rarity={bird.rarity}
            src={discoveredBirdImage(bird.id)}
            size="lg"
            alt="A bird appeared"
          />
        )}
      </div>
      {bird?.call && <p className="bw-sighting-call text-center">Call: {bird.call}</p>}
      <h3 className="text-center m-0">Which bird is this?</h3>
      <div className="flex flex-col gap-2">
        {sighting.choiceBirdIds.map((bid, i) => {
          const b: Bird | undefined = nawbById[bid];
          if (!b) return null;
          const isSelected = selected === bid;
          return (
            <button
              key={bid}
              type="button"
              className={`bw-choice${isSelected ? " bw-choice--selected" : ""}`}
              onClick={() => pick(bid)}
              disabled={disabled}
            >
              {mode === "picture_match" ? (
                <img src={discoveredBirdImage(b.id)} alt="" className="bw-choice__thumb" />
              ) : (
                <span className="bw-choice__letter" aria-hidden="true">
                  {letters[i]}
                </span>
              )}
              <div className="flex-1">
                <p className="bw-choice__name">{b.name}</p>
                <p className="bw-choice__desc">{b.fieldMark}</p>
              </div>
            </button>
          );
        })}
        {disabled && <Spinner label="Checking…" />}
      </div>
    </div>
  );
};
export default BirdSightingCard;
