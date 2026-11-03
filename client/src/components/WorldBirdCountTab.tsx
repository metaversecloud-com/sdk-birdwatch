import { useContext } from "react";

// components
import { BirdToken } from "./BirdToken";

// context
import { GlobalStateContext } from "@/context/GlobalContext";

// utils
import { discoveredBirdImage, undiscoveredBirdImage } from "@/utils";

import { DEFAULT_MILESTONES } from "@shared/types";
import { nawbCollection, nawbById } from "@/data/nawb";

interface MilestoneDisplay {
  total: number;
  reached: boolean | undefined;
  label: string;
}

/**
 * Horizontal progress bar with one circular marker per milestone.
 * The fill width and marker positions are dynamic (data-driven), so they stay
 * inline per the style guide's "dynamic positioning" exception; everything else
 * is in `.bw-progress*` CSS classes.
 */
const MilestonesProgress = ({ total, milestones }: { total: number; milestones: MilestoneDisplay[] }) => {
  const lastTarget = milestones[milestones.length - 1]?.total || 1;
  const fillPercent = Math.min(100, (total / lastTarget) * 100);
  return (
    <div className="bw-progress" role="presentation">
      <div className="bw-progress__fill" style={{ width: `${fillPercent}%` }} />
      {milestones.map((m) => {
        const left = Math.min(100, (m.total / lastTarget) * 100);
        return (
          <div
            key={m.total}
            className={`bw-progress__marker${m.reached ? " bw-progress__marker--reached" : ""}`}
            style={{ left: `${left}%` }}
            aria-label={`${m.label} ${m.reached ? "reached" : "not reached"}`}
          >
            {m.reached ? (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none">
                <path
                  d="M2.5 6L5 8.5L9.5 3.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export const WorldBirdCountTab = ({ onOpenFieldGuide }: { onOpenFieldGuide: () => void }) => {
  const { gameState, visitorBirdItems, profileId } = useContext(GlobalStateContext);
  const ws = gameState?.worldState;
  const collectionId = gameState?.collectionId || nawbCollection.id;
  const youAdded = ws?.perPlayerContribution?.[profileId || ""] || 0;
  void collectionId;

  const total = ws?.totalSightings || 0;
  const found = Object.keys(visitorBirdItems || {}).length;

  const milestones = [
    { total: DEFAULT_MILESTONES.m1, reached: ws?.milestones?.rareBoostUnlocked, label: "Rare birds visit more often" },
    {
      total: DEFAULT_MILESTONES.m2,
      reached: ws?.milestones?.legendaryBoostUnlocked,
      label: "Legendary bird visits more often",
    },
    {
      total: DEFAULT_MILESTONES.m3,
      reached: ws?.milestones?.championBadgeUnlocked,
      label: "Champion Birder badge for all",
    },
  ];

  const nextMilestone = milestones.find((m) => !m.reached);
  const toGo = nextMilestone ? Math.max(0, nextMilestone.total - total) : 0;

  // Field Guide row (4 bird tokens from NAWB: found first then silhouettes)
  const foundBirds = nawbCollection.species.filter((b) => visitorBirdItems?.[b.id]);
  const missingBirds = nawbCollection.species.filter((b) => !visitorBirdItems?.[b.id]);
  const row = [...foundBirds.slice(0, 4), ...missingBirds.slice(0, Math.max(0, 4 - foundBirds.length))];

  return (
    <div className="flex flex-col gap-3">
      <div className="bw-card bw-count">
        <p className="bw-count__total">{total.toLocaleString()}</p>
        <p className="bw-count__label">
          {nawbCollection.name} sightings · <span className="bw-count__you">You've added {youAdded}</span>
        </p>
      </div>

      <div className="bw-card bw-card-success">
        <div className="grid grid-col-2 justify-between mb-2">
          <strong>Your Field Guide</strong>
          {/* <div className="grid">
          </div> */}
          <button className="bw-btn-ghost" onClick={onOpenFieldGuide}>
            Explore →
          </button>
          <p className="bw-caption col-span-2">
            {found} of {nawbCollection.species.length}
          </p>
        </div>
        <div className="bw-grid-4 justify-items-center">
          {row.map((bird) => {
            const got = Boolean(visitorBirdItems?.[bird.id]);
            return (
              <BirdToken
                key={bird.id}
                birdId={bird.id}
                rarity={bird.rarity}
                src={got ? discoveredBirdImage(bird.id) : undiscoveredBirdImage(bird.id)}
                alt={bird.name}
                size="sm"
              />
            );
          })}
        </div>
      </div>

      <div className="bw-card">
        <strong>Milestones</strong>
        <MilestonesProgress total={total} milestones={milestones} />
        <div className="flex flex-col gap-2 mt-2">
          {nextMilestone && (
            <span>
              <strong>{toGo.toLocaleString()} to go:</strong> {nextMilestone.label}
            </span>
          )}
          {milestones.map((m) => (
            <div key={m.total} className={`grid gap-2 bw-milestone${m.reached ? " bw-milestone--reached" : ""}`}>
              <strong>{m.total.toLocaleString()}</strong>
              <div>
                {m.label}
                <div className="bw-caption ml-auto">
                  {m.reached ? "Reached" : `${Math.max(0, m.total - total).toLocaleString()} to go`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {ws?.rarestSighting && (
        <div className="bw-card">
          <strong>Rarest sighting</strong>
          <div className="flex items-center gap-2 mt-2">
            <BirdToken
              birdId={ws.rarestSighting.birdId}
              rarity={ws.rarestSighting.rarity}
              src={discoveredBirdImage(ws.rarestSighting.birdId)}
              alt={nawbById[ws.rarestSighting.birdId]?.name}
            />
            <div>
              <strong>{nawbById[ws.rarestSighting.birdId]?.name}</strong>
              <p className="bw-caption">by {ws.rarestSighting.byDisplayName}</p>
            </div>
          </div>
        </div>
      )}

      {ws?.mostSpotted?.length ? (
        <div className="bw-card">
          <strong>Most spotted</strong>
          <ol className="pl-4 mt-2">
            {ws.mostSpotted.map((ms) => (
              <li key={ms.birdId}>
                {nawbById[ms.birdId]?.name} <span className="bw-caption">· {ms.count}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
};
export default WorldBirdCountTab;
