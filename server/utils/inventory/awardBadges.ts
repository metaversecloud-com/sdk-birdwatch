import type { Credentials } from "../../types/index.js";
import { getCachedInventoryItems } from "./inventoryCache.js";
import { User } from "../topiaInit.js";
import { standardizeError } from "../standardizeError.js";

type ToastTarget = { fireToast: (opts: { groupId?: string; title: string; text: string }) => Promise<unknown> };

/** The "Badge Awarded" toast. Used for immediate toasts and for the queued ones in /game-state. */
export const fireBadgeToast = (visitor: ToastTarget, badgeName: string) =>
  visitor
    .fireToast({
      groupId: `badge-${badgeName}`,
      title: "Badge Awarded",
      text: `You have earned the ${badgeName} badge!`,
    })
    .catch(() => console.error(`Failed to fire toast for the ${badgeName} badge.`));

/**
 * Grant badges to a recipient, then notify them:
 *  - `toastVisitor` given (the recipient triggered the award themselves): toast right away.
 *  - Otherwise (a shared award, like Champion Birder for other participants): queue the
 *    names on the recipient's data object (`pendingBadgeToasts`). The next /game-state
 *    fires one toast per queued badge and clears the queue.
 */
export const awardBadges = async (
  credentials: Credentials,
  recipientProfileId: string,
  badgeNames: string[],
  { toastVisitor }: { toastVisitor?: ToastTarget } = {},
): Promise<{ granted: string[] }> => {
  try {
    if (!badgeNames.length) return { granted: [] };

    const items = await getCachedInventoryItems({ credentials });
    const user = User.create({
      profileId: recipientProfileId,
      credentials: { ...credentials, profileId: recipientProfileId },
    });

    // allSettled: one failed grant must not drop the others' toasts.
    const results = await Promise.allSettled(
      badgeNames.map(async (badgeName) => {
        const target = items.find((i) => i.name?.trim() === badgeName && i.type === "BADGE");
        if (!target) {
          console.warn(`awardBadges: badge "${badgeName}" not in ecosystem — skipping grant`);
          return null;
        }
        await user.grantInventoryItem(target, 1);
        return badgeName;
      }),
    );
    const granted: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value) granted.push(r.value);
      else if (r.status === "rejected") console.error(`awardBadges: failed to grant "${badgeNames[i]}"`, r.reason);
    });
    if (!granted.length) return { granted };

    if (toastVisitor) {
      for (const badgeName of granted) fireBadgeToast(toastVisitor, badgeName);
      return { granted };
    }

    // One write per recipient, after every grant has settled.
    await user.fetchDataObject();
    const queued = ((user.dataObject as { pendingBadgeToasts?: string[] })?.pendingBadgeToasts || []).filter(
      (n) => !granted.includes(n),
    );
    await user.updateDataObject({ pendingBadgeToasts: [...queued, ...granted] }, {});

    return { granted };
  } catch (error) {
    throw standardizeError(error);
  }
};
