# Claude Development Guidelines

> This file is auto-loaded by the Claude Code CLI when a session opens in this directory. The canonical rules for every Topia SDK app live in the **[sdk-ai-boilerplate](../sdk-ai-boilerplate/)** sibling repo.

## Where to find the rules

Use the first source you can reach — stop once you've found it; the rest are fallbacks:

1. **[`../sdk-ai-boilerplate/.ai/`](../sdk-ai-boilerplate/.ai/)** — canonical (in the topia-stack monorepo). Read `rules.md`, `sdk-fundamentals.md`, `style-guide.md`, `accessibility.md`; browse `examples/` as needed.
2. **https://github.com/metaversecloud-com/sdk-ai-boilerplate** — read directly from GitHub if the monorepo copy isn't reachable.
3. **[`./.ai/`](./.ai/)** — this app's local snapshot from when it was cloned. May be out of date; last-resort fallback only.

If multiple sources are reachable and disagree, the **sdk-ai-boilerplate** copy wins.

## Stack

- React + TypeScript (client), Node + Express (server)
- SDK: [`@rtsdk/topia`](https://metaversecloud-com.github.io/mc-sdk-js/index.html)

## App-specific context

**Birdwatch** is a bird-identification game: four bird spots per scene (Feeder / Pine Woods / Frozen Pond / Berry Bushes), one key asset, one trophy. Clicking a spot rolls one bird from that spot's drop table; the player picks it from three choices. Correct IDs grant an ecosystem inventory item (the Field Guide's source of truth), update the shared **World Bird Count** on the world data object, and may fire milestone unlocks or a Legendary Alert.

Key architectural points — flag these before touching them:

- **Unique names are shared across every Collection.** `Birdwatch_keyAsset`, `Birdwatch_spot`, `Birdwatch_trophy`. `collectionId` + `spot` live in each asset's `dataObject.birdwatch` and are seeded from iframe URL query params on first touch (`?collectionId=...&spot=...`). Missing params → 400 with a world-builder message, not a silent default.
- **Scene siblings are linked by `sceneDropId`**, not a stored `linkedKeyAssetId`.
- **World state lives on the World data object** (`world.dataObject.birdwatch`), not on the key asset, so Bird Counts survive scene remove-and-replace.
- **Visitor data is keyed by `${urlSlug}-${sceneDropId}`** under `visitor.dataObject.birdwatch.perScene[key]`. One player can play many Birdwatch instances across many worlds without collisions.
- **Leaderboard entries are pipe-concat strings** (`"displayName|speciesCount|reachedAt"`) keyed by profileId. Keep the record small.
- **No SSE / real-time layer.** Birdwatch is not turn-based. World-wide events use `WorldActivityFactory.fireToast`; the next drawer open re-pulls `/game-state`.
- **Inventory is the Field Guide's source of truth.** First correct ID → grant `Birdwatch — {Bird name}` with metadata `{ birdId, collectionId, spot, rarity, sortOrder }`.
- **Legendary Alert is world-wide**: fires a platform toast via `WorldActivity.fireToast`, grants every player a one-time guaranteed Legendary roll on their next click on the matching spot type within 5 minutes.

Full product spec and plan: [`.ai/templates/plan.md`](.ai/templates/plan.md).

## Protected files — never modify without explicit permission

- `client/App.tsx`
- `client/src/components/PageContainer.tsx`
- `client/backendAPI.ts` → `client/src/utils/backendAPI.ts`
- `client/setErrorMessage.ts` → `client/src/utils/setErrorMessage.ts`
- `server/getCredentials.ts` → `server/utils/getCredentials.ts`

`client/topiaInit.ts` (if used) must exist; its exports may be adjusted.

---

For architecture, SDK usage, data-object patterns, styling, accessibility, testing, workflow — defer to `../sdk-ai-boilerplate/.ai/rules.md`.
