// Per-app settings for the shared platform tests in tests/platform. Every app edits this file;
// the platform specs themselves stay identical across SDK apps.

export type RouteSpec = {
  method: "get" | "post" | "put" | "delete";
  /** Path under /api, without the query string. */
  path: string;
  data?: Record<string, unknown>;
};

/**
 * API routes that read the session credentials (getCredentials). Each one must reject missing or
 * foreign credentials and must never send the interactive secret to the browser. List them all.
 */
export const CREDENTIALED_ROUTES: RouteSpec[] = [
  { method: "get", path: "/game-state" },
  { method: "post", path: "/sightings/start" },
  { method: "post", path: "/sightings/resolve", data: { pickedBirdId: "blue_jay" } },
  { method: "get", path: "/cooldown" },
  { method: "post", path: "/admin/settings", data: { cooldownSeconds: 120 } },
  { method: "post", path: "/admin/reset-bird-count" },
  { method: "post", path: "/admin/reset-leaderboard" },
  { method: "post", path: "/mystery/guess", data: { collectionId: "north_american_winter_birds", pickedBirdId: "blue_jay" } },
  { method: "post", path: "/analytics", data: { analyticName: "fieldGuideOpens" } },
];

/** Page the app opens in its iframe; the platform tests load it with valid credentials. */
export const ENTRY_PAGE = "/";
