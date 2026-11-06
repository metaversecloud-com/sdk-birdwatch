# Birdwatch

A casual, collaborative bird-identification game for Topia worlds. Click a bird spot in the world, a bird appears, pick it from three choices. Correct IDs fill your personal Field Guide, earn badges, and add to a shared **World Bird Count** that unlocks milestone rewards for everyone in the world.

**No fail state. No chat.** A missed bird just flies off.

- First Collection: **North American Winter Birds** (23 species, 4 spot types).
- Target launch: November 2026, alongside the Winter Wonderland campaign world.
- Ticket: EXP-244.

Full product spec: see `.ai/templates/plan.md` for the implementation plan and the design doc.

## Required Assets with Unique Names

Three unique names — the **same across every Collection** and every spot type. Scene siblings are linked by `sceneDropId`, not by a stored link. The admin configures each asset's role at placement time via iframe URL query params.

| Unique name          | Count per scene                                         | URL params the admin sets at placement                                                                     |
| -------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Birdwatch_keyAsset` | 1                                                       | `?collectionId=north_american_winter_birds`                                                                |
| `Birdwatch_spot`     | 4+ (at least one of each spot type; duplicates allowed) | `?collectionId=north_american_winter_birds&spot=feeder` (or `pine_woods` / `frozen_pond` / `berry_bushes`) |
| `Birdwatch_trophy`   | 1                                                       | _(none — no app state)_                                                                                    |

**First-touch behavior.** If the asset's data object isn't initialized yet AND the URL is missing a required param, the server returns a 400 with a world-builder-facing message. Fail-loud > guess-silently.

## Key Features

- **Core loop** — click a spot → one bird + three choices → pick → result + optional cooldown.
- **Field Guide** — per-player per-world, sourced from ecosystem inventory items (one per species).
- **World Bird Count** — per-Collection running total, with three milestones that give everyone in the world rare/legendary visit bonuses + a Champion Birder badge.
- **Trophy** — Leaderboard (top 25 unique species in this world, ties go to first-reach) + Badges.
- **Admin Settings** — identification mode (Description / Picture Match), per-spot cooldown (1 / 2 / 5 min or 1 h), Learn-more toggle, reset World Bird Count.
- **Legendary Alert** — when any player IDs the Legendary, every player's next click on the matching spot type within 5 min skips cooldown and is guaranteed to show that bird.
- **Mystery Bird (v1 stretch)** — daily puzzle: 3 clues, 4 candidates, 2 guesses. Per-player random pick on ET rollover.

## API Endpoints

| Method | Path                           | Body                             | Response                                                                                                                                                                              |
| ------ | ------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/game-state`              | —                                | `{ success, data: GameStateResponse, visitorInventory, visitorBirdItems, profileId, displayName }`                                                                                    |
| `POST` | `/api/sightings/start`         | —                                | `{ success, reused, data: { sighting: VisitorInFlightSighting } }`                                                                                                                    |
| `POST` | `/api/sightings/resolve`       | `{ pickedBirdId }`               | `{ success, data: { outcome: "new_species" \| "repeat" \| "wrong", rightBird, pickedBird, timesSpotted?, grantedBadges, milestoneCrossed?, newTotalSightings?, yourSpeciesCount? } }` |
| `GET`  | `/api/cooldown/:assetId`       | —                                | `{ success, data: { remainingSeconds, spotsToTry: SpotStatus[], activeLegendaryAlert? } }`                                                                                            |
| `POST` | `/api/admin/settings`          | `Partial<AdminSettings>`         | `{ success, data: { adminSettings } }` (admin only)                                                                                                                                   |
| `POST` | `/api/admin/reset-bird-count`  | —                                | `{ success, data: { reset: n } }` (admin only)                                                                                                                                        |
| `POST` | `/api/admin/reset-leaderboard` | —                                | `{ success, data: { leaderboard: {} } }` (admin only)                                                                                                                                 |
| `POST` | `/api/mystery/guess` (stretch) | `{ collectionId, pickedBirdId }` | `{ success, data: { outcome: "solved" \| "wrong" \| "out", answerBirdId, answerSpot, guessesLeft, grantedBadges, state } }`                                                           |

All endpoints accept the standard Topia iframe credentials via query params; `forceRefreshInventory=true` busts the ecosystem-inventory cache for that request.

## Data Objects

### World data object (`world.dataObject.birdwatch`)

```ts
interface WorldState {
  perCollection: Record<string, CollectionWorldState>;
  worldWide: {
    leaderboard: Record<profileId, "displayName|speciesCount|reachedAt">; // pipe-concat strings keep the record small
    placedCollectionsBySceneDropId: Record<collectionId, sceneDropId>; // "which Collections are placed in this world"
  };
  adminSettings: { identificationMode; cooldownSeconds; allAboutBirdsLinksEnabled };
}

interface CollectionWorldState {
  collectionId: string;
  totalSightings: number;
  perBirdSightings: Record<birdId, count>;
  perPlayerContribution: Record<profileId, count>; // keys are the participants list for Champion Birder on M3
  milestones: { rareBoostUnlocked; legendaryBoostUnlocked; championBadgeUnlocked };
  mostSpotted: { birdId; count }[]; // top 3
  rarestSighting?: { birdId; rarity; byDisplayName; bySightingAt };
  activeLegendaryAlert?: { alertId; birdId; spot; firedAt; byProfileId; byDisplayName };
}
```

### Visitor data object (`visitor.dataObject.birdwatch.perScene[${urlSlug}-${sceneDropId}]`)

```ts
interface VisitorPerScene {
  collections: Record<
    collectionId,
    { birdRecords: Record<birdId, { firstSpottedAt; timesSpotted }>; milestoneBannerSeen }
  >;
  spotCooldowns: Record<assetId, { startedAt; durationSeconds }>;
  inFlight?: Record<assetId, VisitorInFlightSighting>;
  perWorldSpeciesReachedAt?: number; // leaderboard tiebreak
  legendaryAlertUsage?: { alertId; usedAssetIds };
  mysteryBird?: Record<collectionId, VisitorMysteryBirdState>;
}
```

Keying by `${urlSlug}-${sceneDropId}` lets one visitor's data cover multiple Birdwatch instances across worlds AND multiple instances in the same world.

### Asset data objects

```ts
// keyAsset.dataObject.birdwatch   = { collectionId }
// spotAsset.dataObject.birdwatch  = { collectionId, spot }
// trophy.dataObject.birdwatch     = {} (no app state)
```

Scene siblings are found via `sceneDropId` queries, not stored links.

## Ecosystem Inventory

Each ecosystem must have one inventory item per bird plus the badge items. Items are matched by exact `name`:

- Species items (type `ITEM`): `{Bird name}` (e.g. `Black-capped Chickadee`) with metadata `{ birdId, collectionId, spot, rarity, sortOrder }`.
- Milestones (type `BADGE`, across every Collection): `First Sighting`, `Avid Birder`, `Rare Find`, `Legendary Birder`, `Bird Spotter`, `Keen Birder`, `Expert Birder`.
- Mystery Bird (type `BADGE`, across every Collection): `Mystery Solved`, `Sharp Eye`, `Bird Detective`, `Mystery Master`, `First Try`.
- North American Winter Birds (type `BADGE`, per-Collection): `North American Winter Birds Complete`, `North American Winter Champion Birder`, `Winter Feeder Birds`, `Winter Pine Woods Birds`, `Winter Frozen Pond Birds`, `Winter Berry Bushes Birds`.

The inventory ZIP itself is distributed as an artifact, not built from the repo — the server reads item names from `server/utils/inventory/badgeNames.ts` and `shared/types/BirdTypes.ts` at runtime.

## Development

```bash
# Install (from the repo root — this is a workspace)
cd topia-sdk-apps/sdk-birdwatch
npm install

# Server (:3000 by default)
cd server && npm run dev

# Client (vite — proxies /api to the server)
cd client && npm run dev

# Tests
cd server && npm test
```

Required `.env` at the repo root (see `.env-example`):

```
API_KEY=
INTERACTIVE_KEY=
INTERACTIVE_SECRET=
INSTANCE_DOMAIN=api.topia.io
INSTANCE_PROTOCOL=https
```

## Regenerating bird data

The CSV source lives in Google Sheets (see spec Appendix). When Shelby edits a sheet, re-export it and regenerate the TS modules with the helper in the plan's §6:

```bash
python3 scripts/gen_bird_data.py   # emits server/data/collections/*.ts
```

The Python script is a bootstrapping helper.

## For Developers

- Shared types: `shared/types/`
- Collection data: `server/data/collections/`
- Server controllers: `server/controllers/`
- Server utils (dropTable, pickChoices, leaderboard, milestones, inventory grants, …): `server/utils/`
- Client components (BirdToken, BirdSightingCard, ResultBanner, CooldownScreen, LeaderboardTab, BadgesTab, …): `client/src/components/`
- Client pages (Home dispatcher, KeyAssetDrawer, SpotDrawer, TrophyDrawer): `client/src/pages/`
- Bird images: `client/src/assets/birds/discovered/` and `client/src/assets/birds/undiscovered/`
