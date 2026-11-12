# Birdwatch — Implementation Plan

Read `.ai/rules.md` first before starting implementation. Source materials this plan was built from:

## 1. Project Overview

Birdwatch is a casual, collaborative bird-identification game for Topia worlds. A placed scene has four **bird spots** (Feeder, Pine Woods, Frozen Pond, Berry Bushes), a **Key asset** that opens the main drawer, and a **Trophy** asset that opens the Leaderboard + Badges drawer. Clicking a spot rolls a bird from that spot's drop table; the player identifies it from three choices. Correct IDs fill the player's **Field Guide**, earn badges, and add to the shared **World Bird Count** that unlocks milestone rewards for everyone in the world.

**No fail state and no chat.** A missed bird just flies off. Birds come in **Collections** that we add over time. First Collection: **North American Winter Birds** (23 species). Target launch: November 2026 alongside the Winter Wonderland campaign world. Ticket: EXP-244.

**v1 scope:** Core loop, Field Guide, World Bird Count, Milestones, Toasts (new-bird, Rare/Legendary repeat, milestone, Legendary Alert), Trophy (Leaderboard + Badges), Admin Settings, Cooldown handling.

**v1 stretch:** Mystery Bird (daily puzzle, 2 guesses, 3 clues, 4 candidates; adds 5 Mystery Bird badges). All wireframes mark Mystery Bird as stretch — ship it only if v1 lands clean.

**Not in v1:** Call audio (text always shows; Call button hidden until a free Macaulay Library educational license is granted), multiple Collections placed in one world (data model supports it, UI shows the Collection dropdown, but only NAWB ships). Picture Match mode IS built (admin toggle, affects every bird spot and respects the "plain picture, no rarity rim" rule in §5 US 1.1). External Learn More links default ON.

## 2. Core User Flow

1. **Enter world → key asset click.** Main drawer opens on the World Bird Count tab for the key asset's Collection.
2. **Spot click.** Drawer opens on the spot's background art; a bird appears (short in-drawer animation + rustle SFX), rolled from this spot's drop table weighted by rarity.
3. **Identify.** Three choices (the right bird + two others from the same Collection; when possible at least one wrong choice is from the same spot). One try per sighting. Picture Match mode adds a thumbnail to each choice.
4. **Result.**
   - **Correct, new species →** "Correct! You got it." + Field Guide row for the bird (spot/eats/nests/behavior/field mark/call/fun fact), species badge, +1 to the World Bird Count, "NEW BIRD!" tag.
   - **Correct, repeat →** same message, "Spotted n times", +1 to the World Bird Count, no new badge. Rare/Legendary repeats fire a world-wide "Rare find!" / "Legendary find!" toast.
   - **Wrong →** "Not quite! Wrong bird." + reveal of the right answer and its field mark. Not logged, no Bird Count change. Spot still goes on cooldown; the cooldown screen takes over.
5. **Cooldown.** Per-player per-spot timer (default 1 min; admin can set 1 / 2 / 5 min or 1 hour). Shows "Spots to try meanwhile" sorted by ready-first then fewest found, plus **Open Field Guide**.
6. **Trophy click.** Separate drawer with **Leaderboard** (top 25 unique species in this world, ties go to whoever reached the count first; player's own row pins at the bottom when off-screen) and **Badges** (Milestones + Mystery Bird stretch + per-Collection species badges).
7. **Milestones.** World-level unlocks for everyone (per Collection): ★★★ Rare birds visit more often, ★★★★ Legendary visits more often, Champion Birder badge for everyone. Milestone 3 fires a platform toast + a banner on everyone's next drawer open.
8. **Legendary alert.** When any player IDs a Legendary, a world-wide toast fires; for the next 5 minutes, that player's next click on the same **spot type** skips its cooldown and shows the Legendary again.

## 3. Important Terminology

- **Collection** — a themed set of species identified by a `collectionId` (v1: `north_american_winter_birds`, 23 species). A world can hold multiple Collection scenes side-by-side (e.g. North American Winter Birds + Tropical Birds); each placed Collection scene gets its own `sceneDropId`, which is how all the scene's assets stay linked.
- **Scene** — one placement of a Collection in a world. Every asset in the same scene (key asset, trophy, spots) shares the same `sceneDropId`; this is the primary key the server uses to find a scene's sibling assets, not a stored `linkedKeyAssetId`.
- **Spot** — one of the four bird-spot types in a Collection: `feeder`, `pine_woods`, `frozen_pond`, `berry_bushes`. Each has its own drop table.
- **Bird spot asset** — a placed dropped asset configured as a spot. A scene may contain **multiple spots of the same type** (two Feeders, for example). Each is tracked independently by its own `assetId` (from `credentials.assetId`); cooldowns and in-flight sightings are keyed by `assetId`, never by the generic `spot` key.
- **Key asset** — the placed asset that opens the main drawer and shows the live Bird Count. One per placed Collection scene. UniqueName is the SAME across every Collection (`Birdwatch_keyAsset`); the admin sets `collectionId` as an **iframe URL query param** when they place the asset (e.g. `?collectionId=north_american_winter_birds`). The server reads it on first touch and writes it to the data object once.
- **Trophy asset** — the placed asset that opens the Leaderboard + Badges drawer. One per scene. Same uniqueName across all Collections (`Birdwatch_trophy`).
- **Sighting** — one spot-click → one bird roll → one guess. A correct sighting adds to the World Bird Count; a wrong one doesn't.
- **World Bird Count** — per-Collection running total of all correct IDs by everyone in the world. Milestones trigger off this.
- **Field Guide** — per-player per-world list of species the player has correctly IDed. Grouped by Collection → Spot.
- **Rarity** — Common, Uncommon, Rare, Legendary. Drop weight is **per-bird at every spot**: Common 60 / Uncommon 24 / Rare 12 / Legendary 3. A spot's chance for a given bird is (its weight) ÷ (sum of weights of every bird at that spot). After Milestone 1, Rare weight becomes 24; after Milestone 2, Legendary weight becomes 6 (both per-Collection, per-world). The "60 · 24 · 12 · 3" shorthand on the game-flow wireframe is the per-bird weight, not a flat tier probability.
- **Cooldown** — per-player per-placed-spot timer. Starts on click, lasts the admin-set duration. Reopening before answering shows the same bird + choices; reopening after shows the countdown + other spots.
- **Mystery Bird (v1 stretch)** — a daily puzzle (12:00 AM ET rollover) tied to a Collection: 3 clues (one Looks + two of Spot/Eats/Nests/Behavior), 4 candidate birds, 2 guesses, no retries once solved or exhausted.
- **Picture Match mode** — admin-chosen identification mode that puts a thumbnail on each choice. Same species pool, logging and Bird Count as Description mode.

## 4. Technical Requirements

### Styling, design direction, and accessibility

**Design direction.** Wireframes are a functionality and layout guide, not final mockups. Build a **custom CSS theme** in `client/src/styles/*.css` (same approach as sdk-trivia, sdk-study-stacks, sdk-unlockables). It should be fun and colorful and appropriate for grades **K–12** — warm/winter palette for NAWB (soft blues, snow whites, warm accent orange for CTAs and the Correct banner, muted red for wrong/reset actions). Rounded shapes and friendly type (match the sdk-study-stacks mono-caps "label" pattern for meta rows). Bird tokens get the rarity rim treatment described in US 2.3.

**Badges tab** uses the same shape as `topia-sdk-apps/sdk-study-stacks/client/src/components/BadgesTab.tsx` ([54 lines](topia-sdk-apps/sdk-study-stacks/client/src/components/BadgesTab.tsx)): read `badges` + `visitorInventory` from GlobalStateContext, grid at `grid-cols-3 sm:grid-cols-4`, grayscale filter + reduced opacity on locked, tooltip for descriptions, "earned / total" counter at the top. Group ordering per US 3.2.

**Accessibility and styling rules.** All client-side components MUST follow `.ai/style-guide.md` and `.ai/accessibility.md`:

- SDK CSS classes for structure (`.btn`, `.card`, `.h1`–`.h4`, `.p1`–`.p4`, form inputs). Tailwind for spacing/layout. App-specific themed styles in `client/src/styles/*.css`.
- Interactive elements are `<button>` / `<a>` / `<input>`. Toasts and banners announce via `role="status"` (polite) or `role="alert"` (assertive).
- Modals (reset confirmations, Admin Settings) use `role="dialog"`, `aria-modal="true"`, focus trap, Escape to close.
- All drawer animations (bird-appear, result banner, countdown pulse) gated on `@media (prefers-reduced-motion: reduce)`.
- Rarity color-coding is paired with the star count and text label so meaning is never color-only.

### Data Models

Shared types live in `shared/types/` and are imported from both client and server. Server-only extensions (SDK-shaped dropped-asset types) stay in `server/types/`.

#### `shared/types/BirdTypes.ts`

```typescript
export type Rarity = "common" | "uncommon" | "rare" | "legendary";

export type SpotKey = "feeder" | "pine_woods" | "frozen_pond" | "berry_bushes";

export interface Bird {
  id: string; // "black_capped_chickadee"
  name: string; // "Black-capped Chickadee"
  collectionId: string; // "north_american_winter_birds"
  spot: SpotKey;
  rarity: Rarity;
  draw: string; // "Adult" / "Male (all red)" / etc.
  eats: string[]; // ["Bugs", "Seeds"]
  nests: string[]; // ["Tree holes"]
  behavior: string; // "Travels in flocks"
  fieldMark: string; // "Black cap and bib, white cheeks, gray back"
  looksKeywords: string[]; // ["black cap", "black bib", "gray body"]
  call: string; // 'A whistled "fee-bee" song…'
  funFact: string;
  allAboutBirdsUrl: string;
  callAudioUrl?: string; // Call audio (optional, hidden until present)
}

export interface Collection {
  id: string; // "north_american_winter_birds"
  name: string; // "North American Winter Birds"
  species: Bird[];
  // Spot icons/colors + background art are derived from SpotKey (static map).
}
```

#### `shared/types/MysteryBirdTypes.ts` (v1 stretch)

```typescript
export type ClueType = "Looks" | "Spot" | "Eats" | "Nests" | "Behavior";

export interface MysteryClue {
  type: ClueType;
  short: string; // "Black cap"
  text: string; // "It has a black cap…"
}

export interface MysteryPuzzle {
  id: string; // "NAWB-001"
  collectionId: string;
  answerId: string; // "black_capped_chickadee"
  answerSpot: SpotKey;
  clues: [MysteryClue, MysteryClue, MysteryClue];
  decoyIds: [string, string, string];
  // decoyMatches not stored — used only to validate the CSV offline.
}
```

#### `shared/types/GameTypes.ts`

```typescript
export type IdentificationMode = "description" | "picture_match";
export type CooldownOption = 60 | 120 | 300 | 3600; // seconds

export interface AdminSettings {
  identificationMode: IdentificationMode;
  cooldownSeconds: CooldownOption;
  allAboutBirdsLinksEnabled: boolean;
}

export interface MilestoneState {
  rareBoostUnlocked: boolean; // Milestone 1
  legendaryBoostUnlocked: boolean; // Milestone 2
  championBadgeUnlocked: boolean; // Milestone 3
}

export interface MostSpotted {
  birdId: string;
  count: number;
}

export interface RarestSighting {
  birdId: string;
  rarity: Rarity;
  byDisplayName: string;
  bySightingAt: number; // epoch ms
}

// Leaderboard entries are stored as a pipe-concatenated string (standard SDK pattern across
// our apps: keeps the data object tiny). The record is keyed by profileId and the string
// encodes "displayName|speciesCount|reachedAt". Parse on read, serialize on write.
export type LeaderboardEntryString = string; // "maya_k|14|1760544000000"

export interface LegendaryAlert {
  birdId: string;
  spot: SpotKey;
  firedAt: number; // epoch ms; eligible for next-click skip within 5 min
  byProfileId: string; // only that player gets the skip
}

export interface CollectionWorldState {
  collectionId: string;
  totalSightings: number; // World Bird Count
  perBirdSightings: Record<string, number>; // birdId → count (powers Most Spotted + analytics)
  perPlayerContribution: Record<string, number>; // profileId → their count in this world
  //   Object.keys(perPlayerContribution) IS the list of participants used to iterate
  //   Champion Birder awards when M3 fires — no separate participantProfileIds needed.
  milestones: MilestoneState;
  mostSpotted: MostSpotted[]; // top 3, derived from perBirdSightings
  rarestSighting?: RarestSighting;
  activeLegendaryAlert?: LegendaryAlert;
}

export interface WorldWideState {
  // One leaderboard per world, not per Collection — multiple Trophies in a world share it.
  // Keyed by profileId; value is "displayName|speciesCount|reachedAt". Top 25 kept after sort/trim.
  leaderboard: Record<string, LeaderboardEntryString>;
  // Which Collections currently have a placed scene in this world (used for the WBC dropdown
  // and the "ask your teacher…" Field Guide message). Values are the key asset's sceneDropId.
  placedCollectionsBySceneDropId: Record<string, string>; // collectionId → sceneDropId
}

export interface VisitorBirdRecord {
  firstSpottedAt: number;
  timesSpotted: number;
}

export interface VisitorCollectionData {
  // The ecosystem INVENTORY (one item per found species, with species/collection/spot/rarity in metadata)
  //   is the source of truth for "did I find this bird". `birdRecords` here holds the supplementary
  //   per-species counts the inventory can't track: first-spotted timestamp and total times spotted.
  birdRecords: Record<string, VisitorBirdRecord>; // keyed by Bird.id
  milestoneBannerSeen: Partial<Record<"m1" | "m2" | "m3", boolean>>;
}

export interface VisitorSpotCooldown {
  startedAt: number;
  durationSeconds: CooldownOption; // snapshot of admin setting at click time
}

export interface VisitorInFlightSighting {
  assetId: string; // credentials.assetId of the spot that was clicked (per-asset tracking)
  spotKey: SpotKey;
  collectionId: string;
  birdId: string; // the rolled bird
  choiceBirdIds: [string, string, string]; // the shuffled 3 (right + 2 decoys)
  rolledAt: number;
  isLegendarySkip?: boolean; // true when the roll came from a Legendary alert
}

export interface VisitorLegendaryAlertUsage {
  alertId: string; // id of the active alert (e.g. "{collectionId}:{firedAt}")
  usedAssetIds: string[]; // spot asset ids where this visitor already used their guaranteed sighting
}

export interface VisitorMysteryBirdState {
  todayKey: string; // "2026-11-02" in ET
  puzzleId: string;
  guessesUsed: number; // 0, 1, 2
  solved: boolean;
  solvedOnFirstTry: boolean;
  solvedTotal: number; // all-time
  firstTryTotal: number; // all-time (powers First Try badge)
  openedCards: Partial<Record<"clue1" | "clue2" | "clue3", true>>;
  openedBirdCards: string[]; // candidate birdIds the player opened
}

// Visitor data object is keyed by `${urlSlug}-${sceneDropId}` so one player can play
// multiple Birdwatch instances across worlds AND multiple instances in the same world
// (e.g. a world placed with a North American Winter Birds scene AND a Tropical Birds scene
// — each has its own sceneDropId). Mystery Bird state and the Field Guide (birdRecords)
// are the only things that follow the player cross-world; the rest is per-scene.
export interface VisitorPerScene {
  collections: Record<string, VisitorCollectionData>; // Field Guide + banner-seen flags per Collection
  spotCooldowns: Record<string, VisitorSpotCooldown>; // keyed by spot's assetId
  inFlight?: Record<string, VisitorInFlightSighting>; // keyed by spot's assetId
  perWorldSpeciesReachedAt?: number; // when this visitor's unique species count last changed (leaderboard tiebreak)
  legendaryAlertUsage?: VisitorLegendaryAlertUsage; // one active alert at a time
  mysteryBird?: Record<string, VisitorMysteryBirdState>; // per collectionId — v1 stretch
}

export interface VisitorDataObject {
  // Full visitor data object shape under a top-level `birdwatch` namespace.
  birdwatch: {
    perScene: Record<string, VisitorPerScene>; // key = `${urlSlug}-${sceneDropId}`
  };
}
```

#### Where the world state lives

All world state (per-Collection + cross-Collection) lives on the **`World` data object**. Rationale: the spec requires the Bird Count to survive scene remove-and-replace, so counts must NOT live on dropped assets that can be deleted. Asset identity (which role each asset plays) comes from its **uniqueName**, not from a `kind` field in its data object.

```typescript
// World dataObject.birdwatch (persistent world state)
export interface WorldState {
  perCollection: Record<string, CollectionWorldState>; // keyed by collectionId
  worldWide: WorldWideState; // leaderboard + placedCollectionsBySceneDropId
  adminSettings: AdminSettings; // one setting block per world (applies to every Collection)
}

// Key asset — uniqueName "Birdwatch_keyAsset" (same for every Collection).
// `collectionId` is set by the admin as an iframe URL query param at placement time;
// the server reads it on first touch and writes this data object once.
export interface KeyAssetDataObject {
  collectionId: string; // "north_american_winter_birds"
}

// Spot asset — uniqueName "Birdwatch_spot" (same for every Collection and spot type).
// `spot` + `collectionId` are set by the admin as iframe URL query params at placement time;
// the server reads them on first touch and writes this data object once. Scene linkage
// (which key asset / trophy this spot belongs to) is derived from `credentials.sceneDropId`,
// not stored here.
export interface SpotAssetDataObject {
  spot: SpotKey; // "feeder" | "pine_woods" | "frozen_pond" | "berry_bushes"
  collectionId: string;
}

// Trophy asset — uniqueName "Birdwatch_trophy". No app state beyond its uniqueName.
export type TrophyAssetDataObject = Record<string, never>;
```

## 5. User Stories & Acceptance Criteria

### Epic 1: Core loop (spot → identify → result)

#### US 1.1 — Clicking a ready spot reveals a bird

As a player, I want clicking a bird spot to open the drawer with a bird I can identify, so I can play the core loop.

✅ Acceptance:

- Clicking a spot opens the drawer with the spot's background art and the Collection + spot name in the header (e.g. "North American Winter Birds · Feeder spot" — spots can repeat across Collections, so the Collection must appear).
- Pipeline is a strict 4-step roll, re-usable in a server util:
  1. **Right bird** rolled from this spot's drop table weighted by per-bird weight.
  2. **Wrong choice 1** is drawn from the SAME spot's remaining birds, each equally likely (rarity does NOT bias wrong choices). Every spot has ≥ 4 birds so this always succeeds.
  3. **Wrong choice 2** is drawn from the entire Collection's remaining birds (excluding the right bird and wrong 1), each equally likely. May be from the same spot or a different spot.
  4. **Shuffle** the three so the right answer lands in A/B/C with equal probability.
- The rolled bird + its three choices + the click time + the cooldown it started are saved to the visitor's `inFlight[assetId]` (keyed by `credentials.assetId` — tracked per-asset, so two Feeders in the same scene behave independently) and the spot's cooldown is started simultaneously.
- Choices show no stars or rarity colors in either mode. **Picture Match mode uses the plain bird art, not the rarity-rim token** — otherwise the Snowy Owl's gold rim gives the answer away.
- Reopening the drawer on the same spot before answering shows the same bird + the same shuffled choices.
- Reopening after the cooldown ends without having answered: the saved sighting is dropped and the next click rolls a fresh bird (new cooldown).

#### US 1.2 — Identify the bird

As a player, I want to pick an answer and get immediate feedback.

✅ Acceptance:

- Picking a choice calls `POST /api/sightings/resolve`. Server validates against the stored `inFlight[assetId]` entry (one try per sighting) and clears it on return.
- Call text always shows. Call button is hidden when the bird has no `callAudioUrl`.
- Picture Match mode (admin setting) renders the bird's **plain Discovered-state illustration** per choice (no rarity rim — the gold rim would give away the Snowy Owl). Same species pool and logging as Description mode.

#### US 1.3 — Correct result, new species

As a player, I want a satisfying moment when I find a new species.

✅ Acceptance:

- Green "Correct! You got it." banner, "NEW BIRD!" tag, bird's Field Guide row (spot/eats/nests/behavior, field mark, call text, fun fact), rarity chip + Field Guide count ("Added to your Field Guide · 7 of 23").
- Species badge toast fires (uses the ecosystem badge named exactly after the bird — see Required Assets).
- World Bird Count for the Collection increments by 1. Milestones are re-evaluated.
- "See its Field Guide page" + "Find another bird" buttons.

#### US 1.4 — Correct result, repeat

As a player, I want repeats to feel useful without feeling noisy.

✅ Acceptance:

- Same green banner, "Spotted n times" chip (per visitor per species), "+1 to the World Bird Count".
- Repeat Rare / Legendary fires a **player-personal** "Rare find! You spotted a {Bird}!" / "Legendary find! You spotted a {Bird}!" toast — only the actor sees it. (The world-wide alert is a separate event — see US 5.1 — and only fires the first time anyone in the window IDs the Legendary.)
- No new badge.

#### US 1.5 — Wrong pick

As a player, I want to understand what I missed.

✅ Acceptance:

- Orange "Not quite! Wrong bird." banner, "That was a {Name}" row with field mark, "It flew away!" copy.
- Not logged — Bird Count unchanged, Field Guide unchanged, no badge.
- Spot still goes on cooldown; the cooldown screen takes over the drawer immediately below the result.

#### US 1.6 — Spot cooldown

As a player, I want each spot to rest and be nudged toward others.

✅ Acceptance:

- Cooldown screen shows "The birds are resting." + countdown using the per-visitor per-asset `startedAt + durationSeconds` from the click.
- "Spots to try meanwhile" lists the scene's other spots sorted ready-first then fewest-found; a spot that is itself resting shows its own small countdown.
- "Open Field Guide" opens the main drawer on the Field Guide tab.
- Reopening the spot after cooldown ends rolls a new bird.

### Epic 2: Field Guide and World Bird Count

#### US 2.1 — World Bird Count tab (landing)

As a player, I want to see progress and milestones for the Collection I entered through.

✅ Acceptance:

- Collection dropdown lists only Collections placed in this world (checked via the world's key assets); opens on the key-asset's Collection by default.
- Shows the total, "You've added n", a Field Guide row (4 bird tokens: found birds then silhouettes) with `Explore →` to the Field Guide tab.
- Milestones section is always open: current goal highlighted, reached goals checked, remaining goals show "x to go".
- Rarest sighting row (never expandable) and Most spotted row (collapsible to top 3).
- "Guess Today's Mystery Bird →" button appears when a puzzle exists and the player hasn't finished today (v1 stretch only).

#### US 2.2 — Field Guide tab

As a player, I want to browse what I've found and what's left.

✅ Acceptance:

- Progress bar + "7 of 23 species found" (sums across all released Collections when multiple exist in the world).
- Chip filters: All / Found / Missing.
- Grouped by Collection → Spot; the Collection the player opened the app from expands first.
- Each tile uses the bird-token art for found birds, silhouette + rarity-colored rim + stars for not-found.
- Clicking a tile opens the Bird page.
- Collections that have no birds found yet and are not placed in this world show the "ask your teacher or world host" message above their spots (the message checks `world.dataObject.birdwatch.worldWide.placedCollectionsBySceneDropId` for the Collection's presence).

#### US 2.3 — Bird page

As a player, I want a detailed page per species.

✅ Acceptance:

- Found: badge art, name, rarity chip, 4-icon row (Spot / Eats / Nests / Behavior), first spotted + times spotted, field mark, call text, fun fact, Call button (if audio licensed), "Learn more at All About Birds →" (if admin links are ON — opens new tab).
- Not found: silhouette + name, rarity chip, "Not found yet" tag, Spot icon filled with the spot, "???" for the other three, "Look for this bird at the {Spot}. Its page fills in once you identify it." Other fields hidden.
- `‹ Field Guide` button returns to the Field Guide tab, `‹ › arrows` navigate alphabetically within the current Collection, "4 of 23" shows position.

### Epic 3: Trophy — Leaderboard & Badges

#### US 3.1 — Leaderboard

As a player, I want to see who's found the most species in this world.

✅ Acceptance:

- Separate drawer opened by the Trophy asset.
- Entries are stored on `world.dataObject.birdwatch.worldWide.leaderboard` as `Record<profileId, "displayName|speciesCount|reachedAt">`. Server parses on read, serializes on write, keeps top 25 by (`speciesCount` desc, `reachedAt` asc — first-to-reach wins ties).
- The current player's row is always visible: pinned at the bottom with a `:` divider if off-screen, highlighted when in-list.
- Admin sees `Reset Leaderboard` button with confirmation modal; players do not.

#### US 3.2 — Badges tab

As a player, I want to see all my awards.

✅ Acceptance:

- Groups in order: Milestones (4), Mystery Bird (5, stretch — hidden if stretch is off), then one block per released Collection with Complete (23) + Champion (first-to-complete) + species badges in Field Guide order.
- Earned badges use the bird-token art + rarity rim; locked badges show silhouette + "Locked".
- Count "9 of 34 badges" at the top.
- Badges earned persist in the ecosystem inventory (standard pattern — see `.ai/examples/badges.md`).

### Epic 4: Admin Settings

#### US 4.1 — Opening Admin Settings

As an admin, I want to configure how the game runs in this world.

✅ Acceptance:

- Gear icon appears in the drawer header on every main-drawer tab for admins only.
- Opens Admin Settings, Back arrow returns to the tab the admin was on.
- Players never see the gear.

#### US 4.2 — Identification mode

As an admin, I want to pick between Description and Picture Match.

✅ Acceptance:

- Radio group: Description (default, grades 3+) vs Picture Match (adds pictures, younger kids).
- Save persists to key-asset `adminSettings.identificationMode`. Takes effect on next spot click. Both modes log the same species.

#### US 4.3 — Cooldown and external links

As an admin, I want to tune pacing and site linking.

✅ Acceptance:

- Cooldown radio: 1 / 2 / 5 minutes or 1 hour. One always selected. Default 1 minute.
- "Show Learn more links" toggle; when off, the All About Birds button is hidden on every Bird page. Default on.
- Changing the cooldown does not retroactively shorten in-progress cooldowns (they used the setting at click time); next clicks use the new value.

#### US 4.4 — Reset World Bird Count

As an admin, I want to zero out this world's counts.

✅ Acceptance:

- Red button + confirmation modal explaining what's cleared (every Collection's counts, milestones, most-spotted, rarest sighting) and what isn't (Field Guides, badges, leaderboard).
- Only admins can call `POST /api/admin/reset-bird-count`.

### Epic 5: Legendary alerts & milestone rewards

#### US 5.1 — Legendary alert

As any player, I want to rush over when a Legendary bird appears.

✅ Acceptance:

- A correct Legendary ID — new OR repeat — fires a **platform TOAST to everyone in the world** ("A Legendary {Bird} was spotted at the {Spot}! Hurry over to see it!"), whether or not they have the app open and whether or not they have ever played. Uses `WorldActivityFactory.fireToast` (platform-wide).
- The alert window lasts 5 minutes and is tracked on the Collection's world state as `activeLegendaryAlert`. Only one alert runs at a time; a second Legendary ID during the window does NOT start a new one or extend it.
- During the window, **every player's** next click on a spot of the matching `SpotKey` (not just the original actor's) skips their personal cooldown and is guaranteed to show that Legendary bird. Each player can use this once per placed spot asset per alert — tracked on the visitor data object.
- The player still has to answer correctly to log the sighting; wrong picks still fly away.
- Players who already have the bird get a repeat sighting (+1 to the Bird Count) and the player-personal "Legendary find!" toast on resolution.
- A pinned banner at the top of every drawer tab announces the alert on the next drawer open while the window is still active; dismisses when the drawer closes.

#### US 5.2 — Milestones unlock

As the world, I want milestones to feel earned together.

✅ Acceptance:

- Milestone 1 (default target: 500 sightings in a Collection — admin-tunable in a later version; defaults encoded in config): sets `rareBoostUnlocked = true`.
- Milestone 2 (default 1,500): sets `legendaryBoostUnlocked = true`.
- Milestone 3 (default 2,500): sets `championBadgeUnlocked = true`, awards the "Champion Birder — {Collection}" ecosystem badge to every visitor who has entered the world (iterate active visitors; new entrants also receive it on first `game-state` call once the flag is set).
- Milestone transitions fire a platform toast + a banner on everyone's next drawer open; `milestoneBannerSeen` on each visitor records which banners they've already acknowledged.

### Epic 6: Mystery Bird (v1 stretch — behind feature flag)

#### US 6.1 — Mystery Bird tab

As a player, I want a daily puzzle.

✅ Acceptance:

- Tab appears on the main drawer when the stretch flag is on.
- "Today's Mystery Bird · {Collection}" banner with "n guesses left" (2 then 1) or "Done for today".
- Pinned clue tiles (Looks + two of Spot/Eats/Nests/Behavior; types/shorts come from the puzzle row).
- Candidate list: 4 birds (right answer + 3 decoys), shuffled, with name + rarity chip. "Not found yet" chip if the player hasn't IDed it.
- Tapping a candidate opens a card with picture, 4-icon row, call, Guess button. The Guess button validates server-side.

#### US 6.2 — Guessing

✅ Acceptance:

- Wrong: grayed-out card, "× Not this bird" chip, counter decrements, one guess remains.
- Right: "You solved it!" banner, "+1 Mystery Birds solved (n total)". "Spot it in the {Spot} to add it to your Field Guide" shown only if the player hasn't found it yet. Mystery Bird badges re-evaluated.
- Out of guesses: both wrong cards grayed, the answer card revealed with "✓ Today's Mystery Bird".
- Rollover: at 12:00 AM ET, **for each player and each Collection**, pick one puzzle at random from that Collection's puzzle list, excluding puzzles that player has already been given; when they've seen every puzzle, start the exclusion list over. Persist `{todayKey, puzzleId, candidateOrder}` on the visitor so the same puzzle shows all day and the candidate card order doesn't reshuffle on reopen. Per-player random (not per-world) is intentional per the spec: "The mystery bird is randomly chosen for everyone so that it's not as easy for kids to just share/spoil the answer each day."

## 6. Implementation Plan

### Server-side components

- `server/data/collections/northAmericanWinterBirds.ts` — bird data parsed/typed from the CSV. Keep the CSV in `server/data/collections/*.csv` for reference and generate the TS at build time or hand-translate once.
- `server/data/collections/mysteryBirdPuzzles/northAmericanWinterBirds.ts` — puzzle data from the second CSV (behind the stretch flag).
- `server/data/collections/index.ts` — registry: `collectionId → { birds, puzzles? }`.
- `server/utils/dropTable.ts` — build a per-spot drop table from a Collection; weighted roll respecting `rareBoostUnlocked` / `legendaryBoostUnlocked`.
- `server/utils/pickChoices.ts` — right bird + 2 wrong (prefer same-spot; same-Collection fallback); deterministic shuffle (seeded off `visitorId + sighting timestamp` so repeated opens before answering match).
- `server/utils/milestones.ts` — thresholds, evaluation, awarding Champion Birder, queuing the milestone banner for next-drawer-open.
- `server/utils/mysteryBird/pickTodayPuzzle.ts` — ET-day keyed puzzle picker.
- `server/utils/droppedAssets/getKeyAsset.ts` + `initializeKeyAssetDataObject.ts`.
- `server/utils/droppedAssets/getSpotAsset.ts` + `initializeSpotAssetDataObject.ts` — on first touch, reads `spot` + `collectionId` from `req.query` and writes the data object once; 400s with a world-builder-facing message if either is missing. Later requests read straight from the data object.
- `server/utils/leaderboard.ts` — insert/update one `"displayName|speciesCount|reachedAt"` entry per profileId, cap top 25, re-sort by (count desc, reachedAt asc).

**No SSE / real-time layer.** Birdwatch is not turn-based or shared-state multiplayer like Ring Toss or Chess. State changes made by other players surface the next time this player opens the drawer or completes a sighting — the API response and the next `GET /game-state` call carry the current numbers. World-wide events (Legendary alerts, milestone reaches) use the Topia **platform toast** (`WorldActivityFactory.fireToast`), which already pushes to every connected player without SSE.

Controllers (one route per file, under `server/controllers/`):

| Route                               | Controller                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET  /api/game-state`              | `handleGetGameState.ts` — bootstrap for the client: visitor + per-Collection world state + admin settings + active legendary alert + Mystery Bird today state (if stretch) + badges.                                                                                                                                                                      |
| `POST /api/sightings/start`         | `handleStartSighting.ts` — spot click. Validates cooldown, rolls a bird + choices, persists `inFlight`.                                                                                                                                                                                                                                                   |
| `POST /api/sightings/resolve`       | `handleResolveSighting.ts` — accepts the chosen `birdId`. Validates against `inFlight`. On correct, logs, updates WBC + Field Guide + badges + leaderboard, re-evaluates milestones, fires a platform toast when a Legendary / milestone transition happens. On wrong, logs the attempt (visitor-side for analytics), starts cooldown. Clears `inFlight`. |
| `GET  /api/cooldown/:assetId`       | `handleGetCooldown.ts` — remaining seconds + the "spots to try meanwhile" list (siblings found via `sceneDropId`).                                                                                                                                                                                                                                        |
| `POST /api/admin/settings`          | `handleUpdateAdminSettings.ts` — identification mode / cooldown / learn-more toggle. Admin only.                                                                                                                                                                                                                                                          |
| `POST /api/admin/reset-bird-count`  | `handleResetBirdCount.ts` — zeros every Collection's counts, milestones, most-spotted, rarest; leaves Field Guides, badges, leaderboard.                                                                                                                                                                                                                  |
| `POST /api/admin/reset-leaderboard` | `handleResetLeaderboard.ts` — zeros this world's leaderboard.                                                                                                                                                                                                                                                                                             |
| `POST /api/mystery/guess`           | `handleMysteryGuess.ts` (stretch) — accepts a candidate `birdId`, resolves against today's puzzle, updates visitor + badges.                                                                                                                                                                                                                              |

### Client-side components

Pages (routed from `App.tsx` by drawer kind — `main`, `trophy`, `spot`):

- `pages/Spot.tsx` — the drawer UI the spot opens; delegates to `SpotSighting`, `SpotResult`, `SpotCooldown`.
- `pages/MainDrawer.tsx` — tab host for `WorldBirdCount`, `FieldGuide`, `MysteryBird` (stretch), with admin gear.
- `pages/TrophyDrawer.tsx` — tab host for `Leaderboard`, `Badges`.
- `pages/AdminSettings.tsx`.

Feature components (under `components/`):

- `BirdToken.tsx` — the circular token with rarity rim, stars, art or silhouette.
- `BirdSightingCard.tsx` — the picture + "Which bird is this?" + three choice rows (Description) or thumbnailed rows (Picture Match).
- `ResultBanner.tsx` — correct / repeat / wrong variants with `role="status"`/`role="alert"`.
- `CooldownScreen.tsx` — countdown + spots-list + Open Field Guide.
- `WorldBirdCountCard.tsx` — count + You've added + Field Guide row.
- `MilestonesList.tsx` — current + list with "reached" / "x to go".
- `MostSpottedBlock.tsx` + `RarestSightingBlock.tsx`.
- `FieldGuideList.tsx` — collection → spot grouping, tiles.
- `BirdPage.tsx` — Found and Not-found variants, with prev/next within Collection.
- `LeaderboardTable.tsx` — top 25 + player row pinning.
- `BadgesGrid.tsx` — Milestones + Mystery Bird (stretch) + species groups.
- `MysteryBirdTab.tsx` (stretch) — pinned clue tiles, candidate list, clue+card expansion, result banner.
- `LegendaryAlertBanner.tsx` — world-wide banner on next drawer open; dismissed on first open.
- `ConfirmationModal.tsx` — reset confirmations (reuses the boilerplate component once renamed to the Birdwatch palette).

### State management

- `GlobalContext` holds `gameState` (returned by `GET /game-state`), `visitorData`, `isAdmin`, `adminSettings`, `drawerKind` (`main` | `trophy` | `spot`), `activeSpotAssetId`.
- Actions dispatched by:
  - initial `game-state` fetch on mount
  - a `game-state` re-fetch when the drawer becomes visible after it's been closed (`visibilitychange` + the Topia iframe focus event) — picks up changes other players made
  - mutations (settings save, resolve sighting, mystery guess) — the API response includes the updated slices and the reducer merges.
- Local state inside components for: in-flight choice selection, which clue tile is expanded, which candidate card is open, filter chip in Field Guide.

### Bird images (Discovered + Undiscovered)

Two image sets ship with the app:

| State                                | Source folder                                                                                                           | Used for                                                                                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Discovered** (color)               | `/Users/linabell/Downloads/Birdwatch/Discovered State/` (23 PNGs, filename pattern `Black-Capped-Chickadee.png`)        | **Inventory item icon** — each file is uploaded into the ecosystem inventory as the item's image. Also the Field Guide tile art for found birds, bird page hero art, Mystery Bird candidate card art, Picture Match choice art. |
| **Undiscovered** (silhouette / gray) | `/Users/linabell/Downloads/Birdwatch/Undiscovered State/` (23 PNGs, filename pattern `Black-Capped-Chickadee_Gray.png`) | **App asset** — ships as a static import under `client/src/assets/birds/undiscovered/`. Used on Field Guide tiles + bird pages for not-found birds.                                                                             |

Server builds a bird-image lookup from `Bird.id` → the matching PNG (both states), so controllers/components don't hardcode file names.

### Inventory items (ecosystem-level, authoritative "did I find it")

The spec treats the ecosystem inventory as the Field Guide's source of truth: one inventory item per species a player has found, granted at the moment of first identification.

- **Item name:** `"{Bird name}"` (e.g. `"Black-capped Chickadee"`).
- **Item icon:** the matching Discovered-State PNG.
- **Item metadata (per spec Appendix: Data):**

  ```ts
  {
    birdId: string; // "black_capped_chickadee"
    collectionId: string; // "north_american_winter_birds"
    spot: SpotKey; // "feeder"
    rarity: Rarity; // "common"
    sortOrder: number; // row index in the Bird Pages sheet — the Field Guide order
  }
  ```

Reading the Field Guide then means: inventory items (for found / not-found) ⊕ visitor data object (for first-spotted / times-spotted). This way a player's Field Guide follows them across every world and every ecosystem that has these items in its inventory. See `.ai/examples/badges.md` and `.ai/examples/inventoryCache.md`.

### Analytics events (per spec §14)

Every data-object write that follows a user action passes an `analytics` array per `.ai/rules.md`. Events to emit (bird IDs use the `id` column from the Bird Pages sheet):

| Event                                                     | Trigger                                            | Extras                                            |
| --------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| `appOpens`                                                | Any Birdwatch UI opens (key asset, Trophy, spot)   | profileId, urlSlug                                |
| `spotClicks`                                              | Click on a ready spot                              | assetId, spotKey, collectionId                    |
| `spotClicks-cooldown`                                     | Click on a spot still cooling down                 | same                                              |
| `birdIDs-correct`                                         | Correct pick                                       | birdId, rarity, mode (description/picture_match)  |
| `birdIDs-wrong`                                           | Wrong pick                                         | expectedBirdId, pickedBirdId, mode                |
| `speciesLogs`                                             | First-ever ID of a species (new Field Guide entry) | birdId, collectionId                              |
| `sightings-common` / `-uncommon` / `-rare` / `-legendary` | Any correct ID bucketed by tier                    | birdId                                            |
| `fieldGuidePageViews`                                     | Opening a bird page                                | birdId, source (list / direct)                    |
| `externalLinkClicks`                                      | Learn more at All About Birds                      | birdId                                            |
| `milestoneReaches`                                        | A milestone unlocks                                | collectionId, milestone ("m1"/"m2"/"m3")          |
| `legendaryAlerts`                                         | Legendary Alert begins                             | collectionId, birdId, actorProfileId              |
| `badgeEarns`                                              | Any badge grant                                    | badgeName                                         |
| `fieldGuideOpens`                                         | Field Guide tab opened                             | source ("tab" / "explore_link" / "spot_cooldown") |
| `collectionSwitches`                                      | WBC dropdown changes Collection                    | newCollectionId                                   |
| `mysteryBirdSolves`                                       | Mystery Bird solved (stretch)                      | puzzleId, firstTry (bool)                         |

### UI SFX (hooks only; final clips TBD)

Reserve SFX hooks in `client/src/utils/sfx.ts` (silent until clips land):

- `birdAppear` (rustling, on spot click)
- `correctNew` (celebratory ding, new species)
- `correctRepeat` (milder ding, repeat sighting)
- `wrongPick` (flies off)
- `rareOrLegendary` (plays INSTEAD of `correctNew` on Rare/Legendary first finds)
- `milestoneReached`
- Suggested extras: `tabSwitch`, `spotOnCooldown`, `mysterySolved`
- `birdCall` (per-species, only if a Macaulay Library educational license lands)

### Required Assets with Unique Names

Three unique names total — the SAME across every Collection and every spot type. The admin configures each asset's role **by iframe URL query params at placement time** (no in-drawer admin setting for this — the plan deliberately avoids one). The server reads the params on first touch, writes them to the asset's data object once, and never reads the URL for role info again.

| Unique name          | Kind         | Count per scene                                   | URL params the admin sets at placement                                                                     |
| -------------------- | ------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Birdwatch_keyAsset` | DroppedAsset | 1                                                 | `?collectionId=north_american_winter_birds`                                                                |
| `Birdwatch_spot`     | DroppedAsset | 4+ (at least one of each spot type; more allowed) | `?collectionId=north_american_winter_birds&spot=feeder` (or `pine_woods` / `frozen_pond` / `berry_bushes`) |
| `Birdwatch_trophy`   | DroppedAsset | 1                                                 | _(none — no app state)_                                                                                    |

**Scene linkage.** Every asset in one placed Collection scene shares the same `sceneDropId`, which is how the server finds a scene's other assets. The data object stores no `linkedKeyAssetId` — `sceneDropId` is enough.

**First-touch initialization.** When the first request hits an asset whose data object isn't initialized yet, the server reads `collectionId` (and `spot` for spot assets) from `req.query`. If a required param is missing, the server returns a 400 with a clear "world builder: set `collectionId` and `spot` on this asset's iframe URL" message rather than guessing a default — this fails loud so misconfigured assets are obvious at placement time instead of silently rolling the wrong birds.

Ecosystem badges (uploaded to each ecosystem's inventory; the server reads them via `getCachedInventoryItems`):

- Milestones: `First Sighting`, `Avid Birder`, `Rare Find`, `Legendary Birder`.
- Collection badges (per Collection): `Complete · {Collection name}`, `Champion Birder · {Collection name}`.
- Species badges (per Collection, exact bird name): `Black-capped Chickadee`, … (23 for NAWB).
- Mystery Bird badges (stretch): `Mystery Solved`, `… Sharp Eye`, `… Bird Detective`, `… Mystery Master`, `… First Try`.

The server must read `forceRefreshInventory` from the query (per `.ai/rules.md`) and pass it through to `getCachedInventoryItems`.

## 7. Testing Approach

Jest + the existing `server/mocks/@rtsdk/topia.ts` mock. For each new controller add a test under `server/__tests__/` (or `server/tests/`) asserting HTTP status, response schema, SDK methods called with the right args, and the data-object writes.

High-value test cases:

- `handleStartSighting` — rolls respect boost flags; `inFlight` persists; a second call on the same spot within cooldown returns the stored sighting (not a re-roll).
- `handleResolveSighting` — right-answer increments count, grants the species inventory item, writes Field Guide entry, awards species badge, re-evaluates milestones (asserts `User.create` with target profileId at both top-level AND inside credentials); wrong-answer leaves counts untouched but starts cooldown and clears `inFlight`.
- `handleGetCooldown` — remaining seconds + `spotsToTry` ordering derived from scene siblings (same `sceneDropId`).
- `handleUpdateAdminSettings` + `handleResetBirdCount` + `handleResetLeaderboard` — admin check rejects non-admins (403).
- Milestone 3 awards Champion Birder badge to all keys of `perPlayerContribution` (asserts the per-recipient `User.create` with both profileIds).
- `handleMysteryGuess` (stretch) — per-player random puzzle-of-the-day pick in ET; wrong decrements, right sets `solved` + `solvedOnFirstTry` + badges.
- Two independent spot assets of the same type (two feeders in one scene) write to separate `inFlight` keys and separate cooldown timers.
- Leaderboard entries round-trip through the `"displayName|speciesCount|reachedAt"` pipe format; sort order holds after an entry with a later `reachedAt` ties the top player's count.

Light client testing: smoke-test the drawer kind router, the result banner variants, and the Field Guide filter chips. UI confirmation goes via a browser walkthrough per `.ai/rules.md`'s UI-feature-complete bar.

## 8. Validation Checklist

- [ ] Every user story in §5 has shippable UI + endpoints and passes its acceptance.
- [ ] SDK classes used for structure; app-specific styles live under `client/src/styles/`; no inline styles except dynamic positioning.
- [ ] `role="status"` / `role="alert"` on result banners, legendary alert, milestone banner.
- [ ] Modals use `role="dialog"`, focus trap, Escape close; Admin Settings reset dialogs confirmed.
- [ ] All animations gated on `prefers-reduced-motion`.
- [ ] Rarity signalled by rim color + stars + text; never color alone.
- [ ] `User.create` passes `profileId` at top level AND inside credentials in every cross-user path (Champion Birder award, Legendary toast attribution).
- [ ] `forceRefreshInventory` read from URL and threaded through `getCachedInventoryItems`.
- [ ] Two spots of the same type in one scene write to independent `inFlight` + cooldown keys.
- [ ] Visitor data object keyed under `${urlSlug}-${sceneDropId}`; two scenes in the same world (future) don't collide.
- [ ] Leaderboard entries persist as `"displayName|speciesCount|reachedAt"` strings keyed by profileId.
- [ ] Badges tab matches the sdk-study-stacks visual shape (grid, grayscale lock, mono-caps counter).
- [ ] Keyboard-only run through core loop + Trophy drawer + Admin Settings.
- [ ] Lighthouse + axe passes on at least Spot → Result → Cooldown and Trophy → Leaderboard.
- [ ] Tests cover every new route; mocks updated.

## 9. Post-Implementation Finalization

After the app is implemented, these steps MUST be completed before the app is considered done:

### 9a. Remove Unused Boilerplate Code

The boilerplate ships with example utilities, components, and types that may not be used by the new app. Scan for and remove:

- **Server utils**: Check `server/utils/` for unused files (e.g., `droppedAssets/`, `getBaseUrl.ts`). Trace imports from controllers — if a util is not imported anywhere, remove it.
- **Server types**: Check `server/types/` for unused type files (e.g., `DroppedAssetTypes.ts`). Remove types that are no longer referenced.
- **Client components**: Check `client/src/components/` for unused boilerplate components (e.g., `Accordion.tsx`, `AdminView.tsx`, `AdminIconButton.tsx`, `ConfirmationModal.tsx`, `PageFooter.tsx`). Trace imports from pages — if a component is not imported anywhere, remove it.
- **Barrel exports**: Update `server/utils/index.ts`, `server/types/index.ts`, and `client/src/components/index.ts` to remove exports of deleted files.

**Protected files** (`PageContainer.tsx`, `backendAPI.ts`, etc.) must NOT be removed even if they appear unused — they are part of the framework.

### 9b. Update README

Rewrite `README.md` to describe Birdwatch instead of the boilerplate. Include:

- App name, one-line description, and the Collection shipped in v1.
- What visitors see vs. what admins see.
- Key features (core loop, Field Guide, World Bird Count + Milestones, Leaderboard, Badges, Admin Settings).
- API endpoints with request/response shapes.
- World and Visitor data object schemas.
- The Required Assets with Unique Names table from §6.
- Setup and development instructions.

### 9c. Update Server Tests

Rewrite `server/tests/routes.test.ts` to test Birdwatch's actual routes:

- Update the `jest.mock("../utils/index.js")` block to mock the new app's utils (not boilerplate ones like `getDroppedAsset`).
- Update `server/mocks/@rtsdk/topia.ts` to include any new SDK factories/methods used (e.g., `EcosystemFactory` for inventory, `WorldActivityFactory` for the Legendary toast).
- Add test cases for each route covering: success paths, error handling, authorization checks, input validation.
- Remove any tests for removed boilerplate routes.

### 9d. Commit, Push, and Open PR

- Commit all changes to the `dev` branch.
- Push to remote.
- Open a PR from `dev` into `main` with appropriate labels (`release`, `patch` or `minor` per the semver impact).
