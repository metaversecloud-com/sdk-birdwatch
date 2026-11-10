import type { Bird } from "@shared/types";
import { SPOT_LABELS } from "@shared/types";

import { BirdFact } from "./BirdFact";
import { BirdInfoSection } from "./BirdInfoSection";

interface Props {
  bird: Bird;
  found: boolean;
  linksOn: boolean;
  /** Field mark / call / fun fact / link (or the "not found yet" hint). On by default. */
  showFacts?: boolean;
  /** Highlighted call block under the fact grid. When on, the plain Call row is left out of the facts. */
  showCall?: boolean;
}

export const BirdInfo = ({ bird, found, linksOn, showFacts = true, showCall = false }: Props) => (
  <div className="flex flex-col gap-4 text-left">
    <div className="bw-fact-grid pt-2">
      <BirdFact kind="spot" label="Spot" value={SPOT_LABELS[bird.spot]} />
      <BirdFact kind="eats" label="Eats" value={found ? bird.eats.join(", ") : "???"} />
      <BirdFact kind="nests" label="Nests" value={found ? bird.nests.join(", ") : "???"} />
      <BirdFact kind="behavior" label="Behavior" value={found ? bird.behavior : "???"} />
    </div>
    {showCall && (
      <div className="bw-call w-full">
        <div className="flex flex-col items-center gap-1">
          <BirdFact kind="call" label="Call" size="md" />
        </div>
        <p className="pl-1 font-bold">{bird.call}</p>
      </div>
    )}
    {showFacts &&
      (found ? (
        <>
          <BirdInfoSection label="Field mark" value={bird.fieldMark} />
          {!showCall && <BirdInfoSection label="Call" value={bird.call} />}
          <BirdInfoSection label="Fun fact" value={bird.funFact} />
          {linksOn && (
            <a className="bw-btn-outline text-sm" href={bird.allAboutBirdsUrl} target="_blank" rel="noreferrer">
              Learn more at All About Birds ↗
            </a>
          )}
        </>
      ) : (
        <p className="bw-subtitle text-center mt-2">
          Look for this bird at the {SPOT_LABELS[bird.spot]}. Its page fills in once you identify it.
        </p>
      ))}
  </div>
);

export default BirdInfo;
