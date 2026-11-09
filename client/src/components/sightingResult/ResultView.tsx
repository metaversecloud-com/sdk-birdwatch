import { BirdInfo, BirdToken, CooldownScreen, ResultBanner, RarityChip } from "@/components";
import { discoveredBirdImage } from "@/utils";
import { nawbCollection } from "@/data/nawb";

import { CountDescription } from "./CountDescription";
import { ResultDataType } from "@/context/types";

interface Props {
  result: ResultDataType;
  onDone: () => void;
  onOpenFieldGuide: () => void;
  onSeeFieldGuidePage: () => void;
}

/** The three result variants shown after a sighting is resolved: new species, repeat, or wrong pick. */
export const ResultView = ({ result, onDone, onOpenFieldGuide, onSeeFieldGuidePage }: Props) => {
  const b = result.rightBird;

  if (result.outcome === "wrong") {
    return (
      <div className="flex flex-col gap-3">
        <ResultBanner kind="wrong" message="Not quite! Wrong bird." />
        <div className="bw-wrong-panel">
          <div className="bw-wrong-panel__row">
            <BirdToken birdId={b.id} rarity={b.rarity} src={discoveredBirdImage(b.id)} size="lg" />
            <div>
              <strong>That was a {b.name}</strong>
              <p className="text-sm">{b.fieldMark}</p>
            </div>
          </div>
          <p className="bw-wrong-panel__quote">It flew away!</p>
          <p className="bw-wrong-panel__sub">Don't worry, keep looking and you'll get another chance!</p>
        </div>
        <CooldownScreen onOpenFieldGuide={onOpenFieldGuide} />
      </div>
    );
  }

  const isNew = result.outcome === "new_species";

  return (
    <div className="flex flex-col gap-3">
      <ResultBanner kind="correct" message="Correct! You got it." />

      <div
        className={`bw-card flex flex-col items-center gap-2 text-center ${
          isNew ? "bw-card--new-species" : "bw-card--repeat"
        }`}
      >
        {isNew && <span className="bw-chip bw-chip--new">NEW BIRD!</span>}
        <BirdToken birdId={b.id} rarity={b.rarity} src={discoveredBirdImage(b.id)} size="lg" />
        <h2 className="m-0">{b.name}</h2>
        <RarityChip rarity={b.rarity} />
        <CountDescription outcome={result.outcome} speciesCount={result.yourSpeciesCount} />
      </div>

      {isNew ? (
        <div className="bw-info-banner bw-info-banner--success">
          <div className="min-w-[60px]">
            <BirdToken birdId={b.id} rarity={b.rarity} src={discoveredBirdImage(b.id)} size="sm" />
          </div>
          <div>
            <p className="bw-info-banner__title">New species added to your Field Guide!</p>
            <p className="bw-info-banner__sub">+1 to the {nawbCollection.name} Count</p>
          </div>
        </div>
      ) : (
        <div className="bw-info-banner bw-info-banner--info">
          <div>
            <p className="bw-info-banner__title">Spotted {result.timesSpotted ?? 0} times</p>
            <p className="bw-info-banner__sub">+1 to the {nawbCollection.name} Count</p>
          </div>
        </div>
      )}

      <div className="bw-card">
        <BirdInfo bird={b} found={true} linksOn={false} />
      </div>

      <button className="bw-btn-primary hidden" onClick={onSeeFieldGuidePage}>
        See its Field Guide page
      </button>
      <button className="bw-btn-primary" onClick={onDone}>
        Find another bird
      </button>
    </div>
  );
};

export default ResultView;
