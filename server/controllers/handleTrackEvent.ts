import { Request, Response } from "express";
import { errorHandler, getCredentials, Visitor } from "@utils/index.js";
import type { ClientAnalyticName } from "@shared/types/index.js";
import { CLIENT_ANALYTICS } from "@shared/types/index.js";

const isClientAnalytic = (v: unknown): v is ClientAnalyticName =>
  typeof v === "string" && (CLIENT_ANALYTICS as readonly string[]).includes(v);

/**
 * POST /api/analytics — logs an analytic for an action that only happens in the UI
 * (opening the Field Guide or a bird page, tapping an external link). Only names in
 * CLIENT_ANALYTICS are accepted.
 */
export const handleTrackEvent = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { profileId, urlSlug, visitorId } = credentials;
    const { analyticName } = (req.body || {}) as { analyticName?: unknown };
    if (!isClientAnalytic(analyticName)) {
      return res.status(400).json({ success: false, message: "Unknown analyticName" });
    }

    const visitor = Visitor.create(visitorId, urlSlug, { credentials });
    await visitor.updateDataObject({}, { analytics: [{ analyticName, uniqueKey: profileId, urlSlug }] });

    return res.json({ success: true });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleTrackEvent",
      message: "Error logging analytic",
      req,
      res,
    });
  }
};
