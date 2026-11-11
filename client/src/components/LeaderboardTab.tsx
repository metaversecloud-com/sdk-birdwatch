import { useContext } from "react";
import { GlobalStateContext } from "@/context/GlobalContext";

interface Row {
  profileId: string;
  displayName: string;
  sightings: number;
  reachedAt: number;
}

const parseRow = (profileId: string, encoded: string): Row | null => {
  const [displayName, countStr, reachedStr] = encoded.split("|");
  const sightings = Number(countStr);
  const reachedAt = Number(reachedStr);
  if (!displayName) return null;
  return { profileId, displayName, sightings, reachedAt };
};

export const LeaderboardTab = ({ onReset }: { onReset?: () => void }) => {
  const { gameState, profileId, isAdmin } = useContext(GlobalStateContext);
  const record = gameState?.leaderboard || {};
  const rows: Row[] = Object.entries(record)
    .map(([pid, enc]) => parseRow(pid, enc as string))
    .filter((r): r is Row => Boolean(r))
    .sort((a, b) => b.sightings - a.sightings || a.reachedAt - b.reachedAt);

  const top = rows.slice(0, 25);
  const meInTop = top.some((r) => r.profileId === profileId);
  const meRow = rows.find((r) => r.profileId === profileId);

  return (
    <div className="flex flex-col gap-3">
      <strong>Most birds spotted here</strong>
      <div className="flex flex-col gap-1.5">
        {top.map((row, i) => (
          <div key={row.profileId} className={`bw-row${row.profileId === profileId ? " bw-row--me" : ""}`}>
            <span className="bw-row__rank">{i + 1}</span>
            <span>{row.displayName}</span>
            <strong>{row.sightings}</strong>
          </div>
        ))}
        {!meInTop && meRow && (
          <>
            <p className="bw-caption text-center">…</p>
            <div className="bw-row bw-row--me">
              <span className="bw-row__rank">{rows.findIndex((r) => r.profileId === profileId) + 1}</span>
              <span>You</span>
              <strong>{meRow.sightings}</strong>
            </div>
          </>
        )}
      </div>
      {isAdmin && onReset && (
        <button className="bw-btn-danger" onClick={onReset}>
          Reset Leaderboard
        </button>
      )}
    </div>
  );
};
export default LeaderboardTab;
