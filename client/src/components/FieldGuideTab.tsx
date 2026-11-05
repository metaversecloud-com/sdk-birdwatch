import { useContext, useMemo, useState } from "react";
import { GlobalStateContext } from "@/context/GlobalContext";
import { nawbCollection } from "@/data/nawb";
import { SPOT_LABELS } from "@shared/types";
import type { SpotKey, Bird } from "@shared/types";
import { discoveredBirdImage, undiscoveredBirdImage } from "@/utils";
import { BirdToken } from "./BirdToken";

type Filter = "all" | "found" | "missing";

export const FieldGuideTab = ({ onOpenBird }: { onOpenBird: (bird: Bird) => void }) => {
  const { visitorBirdItems } = useContext(GlobalStateContext);
  const [filter, setFilter] = useState<Filter>("all");

  const birdsBySpot = useMemo(() => {
    const grouped: Record<SpotKey, Bird[]> = { feeder: [], pine_woods: [], frozen_pond: [], berry_bushes: [] };
    for (const b of nawbCollection.species) grouped[b.spot].push(b);
    return grouped;
  }, []);

  const inFilter = (b: Bird) => {
    const got = Boolean(visitorBirdItems?.[b.id]);
    if (filter === "all") return true;
    if (filter === "found") return got;
    return !got;
  };

  const totalFound = Object.keys(visitorBirdItems || {}).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="bw-card">
        <strong>
          {totalFound} of {nawbCollection.species.length} species found
        </strong>
        <div className="bw-tabs mt-2">
          {(["all", "found", "missing"] as Filter[]).map((f) => (
            <button key={f} className={`bw-tab${filter === f ? " bw-tab--active" : ""}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <p className="bw-subtitle text-center">Tap a bird to open its Field Guide page</p>

      {(Object.keys(birdsBySpot) as SpotKey[]).map((spot) => {
        const inSpot = birdsBySpot[spot].filter(inFilter);
        if (!inSpot.length) return null;
        const foundInSpot = birdsBySpot[spot].filter((b) => visitorBirdItems?.[b.id]).length;
        return (
          <div className="bw-card-flat" key={spot}>
            <div className="flex justify-between mb-2">
              <strong>{SPOT_LABELS[spot]}</strong>
              <span className="bw-caption">
                {foundInSpot} / {birdsBySpot[spot].length}
              </span>
            </div>
            <div className="bw-grid-3 justify-items-center">
              {inSpot.map((bird) => {
                const got = Boolean(visitorBirdItems?.[bird.id]);
                return (
                  <button
                    key={bird.id}
                    type="button"
                    className="bw-token-tile"
                    onClick={() => onOpenBird(bird)}
                    aria-label={`${bird.name}${got ? " (found)" : " (not found yet)"}`}
                  >
                    <BirdToken
                      birdId={bird.id}
                      rarity={bird.rarity}
                      src={got ? discoveredBirdImage(bird.id) : undiscoveredBirdImage(bird.id)}
                    />
                    <p className="bw-caption text-center">{bird.name.split(" ").slice(-1)[0]}</p>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
export default FieldGuideTab;
