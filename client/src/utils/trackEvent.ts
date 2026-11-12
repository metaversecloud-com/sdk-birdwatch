import type { ClientAnalyticName } from "@shared/types";
import { backendAPI } from "./backendAPI";

/** Fire-and-forget analytic for a UI-only action. Never blocks or errors the UI. */
export const trackEvent = (analyticName: ClientAnalyticName) => {
  backendAPI.post("/analytics", { analyticName }).catch(() => undefined);
};
