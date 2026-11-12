import { useContext } from "react";
import { GlobalStateContext } from "@/context/GlobalContext";
import { nawbCollection } from "@/data/nawb";

interface BadgeDef {
  name: string;
  description: string;
  group: string;
  sortOrder: number;
}

const MILESTONES_GROUP = "Milestones";
const MYSTERY_GROUP = "Mystery Bird";

/**
 * Built-in badge catalog. Mirrors the inventory ZIP: 7 Milestones + 5 Mystery Bird +
 * per-Collection (Complete / Champion / 4 spot badges). Names are plain (no prefix) —
 * they must match the ecosystem catalog exactly so lookup by name works.
 */
const BUILTIN_BADGES: BadgeDef[] = [
  // Milestones — count across every Collection.
  { name: "First Sighting", description: "Identified your first bird", group: MILESTONES_GROUP, sortOrder: 1 },
  {
    name: "Avid Birder",
    description: "Added 10 different birds to your Field Guide",
    group: MILESTONES_GROUP,
    sortOrder: 2,
  },
  { name: "Rare Find", description: "Identified your first Rare bird", group: MILESTONES_GROUP, sortOrder: 3 },
  {
    name: "Legendary Birder",
    description: "Identified your first Legendary bird",
    group: MILESTONES_GROUP,
    sortOrder: 4,
  },
  { name: "Bird Spotter", description: "20 correct identifications", group: MILESTONES_GROUP, sortOrder: 5 },
  { name: "Keen Birder", description: "100 correct identifications", group: MILESTONES_GROUP, sortOrder: 6 },
  { name: "Expert Birder", description: "500 correct identifications", group: MILESTONES_GROUP, sortOrder: 7 },

  // Mystery Bird — count across every Collection.
  { name: "Mystery Solved", description: "Solved your first Mystery Bird", group: MYSTERY_GROUP, sortOrder: 1 },
  { name: "Sharp Eye", description: "Solved 5 Mystery Birds", group: MYSTERY_GROUP, sortOrder: 2 },
  { name: "Bird Detective", description: "Solved 15 Mystery Birds", group: MYSTERY_GROUP, sortOrder: 3 },
  { name: "Mystery Master", description: "Solved 30 Mystery Birds", group: MYSTERY_GROUP, sortOrder: 4 },
  { name: "First Try", description: "Solved a Mystery Bird on your first guess", group: MYSTERY_GROUP, sortOrder: 5 },

  // North American Winter Birds — per-Collection.
  {
    name: nawbCollection.badges.complete,
    description: "Found every bird in the Collection",
    group: nawbCollection.name,
    sortOrder: 1,
  },
  {
    name: nawbCollection.badges.champion,
    description: "Your world reached the final Bird Count milestone",
    group: nawbCollection.name,
    sortOrder: 2,
  },
  {
    name: nawbCollection.badges.spots.feeder,
    description: "Found all 6 Feeder birds",
    group: nawbCollection.name,
    sortOrder: 3,
  },
  {
    name: nawbCollection.badges.spots.pine_woods,
    description: "Found all 6 Pine Woods birds",
    group: nawbCollection.name,
    sortOrder: 4,
  },
  {
    name: nawbCollection.badges.spots.frozen_pond,
    description: "Found all 5 Frozen Pond birds",
    group: nawbCollection.name,
    sortOrder: 5,
  },
  {
    name: nawbCollection.badges.spots.berry_bushes,
    description: "Found all 6 Berry Bushes birds",
    group: nawbCollection.name,
    sortOrder: 6,
  },
];

/** Styled after sdk-study-stacks/BadgesTab: grid, grayscale lock, mono-caps count. */
export const BadgesTab = () => {
  const { visitorInventory, badgeCatalog } = useContext(GlobalStateContext);

  // Preserve declaration order of groups.
  const groups: Record<string, BadgeDef[]> = {};
  for (const b of BUILTIN_BADGES) (groups[b.group] ||= []).push(b);
  for (const list of Object.values(groups)) list.sort((a, b) => a.sortOrder - b.sortOrder);

  const earnedCount = BUILTIN_BADGES.filter((b) => visitorInventory?.[b.name]).length;

  return (
    <div className="flex flex-col">
      <div className="bw-chip bw-chip--legendary w-fit m-auto">
        <span className="text-[0.875rem]">
          {earnedCount} / {BUILTIN_BADGES.length}
        </span>
      </div>
      {Object.entries(groups).map(([groupName, badges]) => (
        <div key={groupName} className="pb-4">
          <p className="bw-title p-1">{groupName}</p>
          <div className="bw-grid-3">
            {badges.map((b) => {
              const earned = visitorInventory?.[b.name];
              const icon = badgeCatalog?.[b.name]?.icon;
              return (
                <div
                  key={b.name}
                  title={b.description || b.name}
                  className={`bw-badge-tile${earned ? "" : " bw-badge-tile--locked"}`}
                >
                  {icon ? (
                    <div className="tooltip">
                      <span className="p3 tooltip-content" style={{ width: "115px" }}>
                        {b.description ? b.description : b.name}
                      </span>
                      <img src={icon} alt={b.name} className="bw-badge-tile__icon mx-auto" />
                    </div>
                  ) : (
                    <div className="bw-badge-tile__placeholder" />
                  )}
                  <p className="bw-caption bw-badge-tile__label">{b.name}</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
export default BadgesTab;
