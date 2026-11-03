import { useContext } from "react";
import { GlobalStateContext } from "@/context/GlobalContext";
import { nawbCollection } from "@/data/nawb";

interface BadgeDef {
  name: string;
  description?: string;
  icon?: string;
  group: string;
}

const BADGE_PREFIX = "Birdwatch — ";

const BUILTIN_BADGES: BadgeDef[] = [
  { name: `${BADGE_PREFIX}First Sighting`, description: "Identified your first bird", group: "Milestones" },
  { name: `${BADGE_PREFIX}Avid Birder`, description: "Identified 10 different birds", group: "Milestones" },
  { name: `${BADGE_PREFIX}Rare Find`, description: "Identified your first Rare bird", group: "Milestones" },
  { name: `${BADGE_PREFIX}Legendary Birder`, description: "Identified your first Legendary bird", group: "Milestones" },
  {
    name: `${BADGE_PREFIX}Complete · ${nawbCollection.name}`,
    description: "Found every bird in the Collection",
    group: nawbCollection.name,
  },
  {
    name: `${BADGE_PREFIX}Champion Birder · ${nawbCollection.name}`,
    description: "Your world reached the final Bird Count milestone",
    group: nawbCollection.name,
  },
  ...nawbCollection.species.map(
    (b): BadgeDef => ({
      name: `${BADGE_PREFIX}${b.name}`,
      description: `Spotted the ${b.name}`,
      group: nawbCollection.name,
    }),
  ),
];

/** Styled after sdk-study-stacks/BadgesTab: grid, grayscale lock, mono-caps count. */
export const BadgesTab = () => {
  const { visitorInventory } = useContext(GlobalStateContext);

  const groups = BUILTIN_BADGES.reduce<Record<string, BadgeDef[]>>((acc, b) => {
    (acc[b.group] ||= []).push(b);
    return acc;
  }, {});

  const earnedCount = BUILTIN_BADGES.filter((b) => visitorInventory?.[b.name]).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <strong>Badges</strong>
        <span className="bw-caption">
          {earnedCount} / {BUILTIN_BADGES.length}
        </span>
      </div>
      {Object.entries(groups).map(([groupName, badges]) => (
        <div key={groupName}>
          <p className="bw-subtitle mb-1">{groupName}</p>
          <div className="bw-grid-3">
            {badges.map((b) => {
              const earned = visitorInventory?.[b.name];
              const icon = earned?.icon;
              return (
                <div
                  key={b.name}
                  title={b.description || b.name}
                  className={`bw-badge-tile${earned ? "" : " bw-badge-tile--locked"}`}
                >
                  {icon ? (
                    <img src={icon} alt={b.name} className="bw-badge-tile__icon mx-auto" />
                  ) : (
                    <div className="bw-badge-tile__placeholder" />
                  )}
                  <p className="bw-caption bw-badge-tile__label">{b.name.replace(BADGE_PREFIX, "").slice(0, 20)}</p>
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
