import type { LeaderboardEntryString } from "@shared/types/index.js";

export interface LeaderboardEntry {
  profileId: string;
  displayName: string;
  sightings: number;
  reachedAt: number;
}

const PIPE = "|";
const MAX_ROWS = 25;

const sanitize = (s: string): string => s.replace(/\|/g, "/");

export const encodeEntry = (displayName: string, sightings: number, reachedAt: number): LeaderboardEntryString =>
  [sanitize(displayName || "Anonymous"), sightings, reachedAt].join(PIPE);

export const decodeEntry = (profileId: string, value: LeaderboardEntryString): LeaderboardEntry | null => {
  const [displayName, countStr, reachedStr] = value.split(PIPE);
  const sightings = Number(countStr);
  const reachedAt = Number(reachedStr);
  if (!displayName || Number.isNaN(sightings) || Number.isNaN(reachedAt)) return null;
  return { profileId, displayName, sightings, reachedAt };
};

export const parseLeaderboard = (record: Record<string, LeaderboardEntryString> | undefined): LeaderboardEntry[] => {
  if (!record) return [];
  const entries: LeaderboardEntry[] = [];
  for (const [profileId, value] of Object.entries(record)) {
    const decoded = decodeEntry(profileId, value);
    if (decoded) entries.push(decoded);
  }
  entries.sort((a, b) => b.sightings - a.sightings || a.reachedAt - b.reachedAt);
  return entries;
};

/** Upsert one entry, cap at top 25, return the new record. */
export const upsertEntry = (
  record: Record<string, LeaderboardEntryString> | undefined,
  profileId: string,
  displayName: string,
  sightings: number,
  reachedAt: number,
): Record<string, LeaderboardEntryString> => {
  const next: Record<string, LeaderboardEntryString> = { ...(record || {}) };
  next[profileId] = encodeEntry(displayName, sightings, reachedAt);

  const sorted = parseLeaderboard(next);
  const kept = new Set(sorted.slice(0, MAX_ROWS).map((e) => e.profileId));
  // Keep the player's own row even if off-leaderboard (client pins it).
  kept.add(profileId);
  const trimmed: Record<string, LeaderboardEntryString> = {};
  for (const e of sorted) if (kept.has(e.profileId)) trimmed[e.profileId] = next[e.profileId];
  return trimmed;
};

export { MAX_ROWS };
