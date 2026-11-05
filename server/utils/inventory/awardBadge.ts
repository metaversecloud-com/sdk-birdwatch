import type { Credentials } from "../../types/index.js";
import { getCachedInventoryItems } from "./inventoryCache.js";
import { User } from "../topiaInit.js";
import { standardizeError } from "../standardizeError.js";

export const awardBadge = async (
  credentials: Credentials,
  recipientProfileId: string,
  badgeName: string,
): Promise<{ granted: boolean; reason?: string }> => {
  try {
    const items = await getCachedInventoryItems({ credentials });
    const target = items.find((i) => i.name?.trim() === badgeName && i.type === "BADGE");

    if (!target) return { granted: false, reason: "badge_not_in_ecosystem" };

    const user = User.create({
      profileId: recipientProfileId,
      credentials: { ...credentials, profileId: recipientProfileId },
    });

    await user.grantInventoryItem(target, 1);

    return { granted: true };
  } catch (error) {
    throw standardizeError(error);
  }
};
