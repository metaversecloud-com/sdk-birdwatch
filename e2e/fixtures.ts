import { APIRequestContext, Page, test as base, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { INTERACTIVE_KEY, MOCK_TOPIA_URL } from "./constants";

export const KEY_ASSET_ID = "key-asset";
export const TROPHY_ASSET_ID = "trophy";
export const SCENE_DROP_ID = "scene-1";
export const VISITOR_ID = 42;
export const COLLECTION_ID = "north_american_winter_birds";

export type SpotKey = "feeder" | "pine_woods" | "frozen_pond" | "berry_bushes";
export const SPOTS: SpotKey[] = ["feeder", "pine_woods", "frozen_pond", "berry_bushes"];
export const spotAssetId = (spot: SpotKey) => `spot-${spot}`;

type Rarity = "common" | "uncommon" | "rare" | "legendary";
/** The North American Winter Birds Collection (server/data/collections), as the tests need it. */
export const BIRDS: Record<string, { name: string; spot: SpotKey; rarity: Rarity }> = {
  black_capped_chickadee: { name: "Black-capped Chickadee", spot: "feeder", rarity: "common" },
  northern_cardinal: { name: "Northern Cardinal", spot: "feeder", rarity: "common" },
  house_finch: { name: "House Finch", spot: "feeder", rarity: "uncommon" },
  tufted_titmouse: { name: "Tufted Titmouse", spot: "feeder", rarity: "uncommon" },
  red_bellied_woodpecker: { name: "Red-bellied Woodpecker", spot: "feeder", rarity: "uncommon" },
  evening_grosbeak: { name: "Evening Grosbeak", spot: "feeder", rarity: "rare" },
  blue_jay: { name: "Blue Jay", spot: "pine_woods", rarity: "common" },
  dark_eyed_junco: { name: "Dark-eyed Junco", spot: "pine_woods", rarity: "common" },
  downy_woodpecker: { name: "Downy Woodpecker", spot: "pine_woods", rarity: "uncommon" },
  white_breasted_nuthatch: { name: "White-breasted Nuthatch", spot: "pine_woods", rarity: "uncommon" },
  pileated_woodpecker: { name: "Pileated Woodpecker", spot: "pine_woods", rarity: "rare" },
  great_horned_owl: { name: "Great Horned Owl", spot: "pine_woods", rarity: "rare" },
  mallard: { name: "Mallard", spot: "frozen_pond", rarity: "common" },
  canada_goose: { name: "Canada Goose", spot: "frozen_pond", rarity: "common" },
  hooded_merganser: { name: "Hooded Merganser", spot: "frozen_pond", rarity: "uncommon" },
  bald_eagle: { name: "Bald Eagle", spot: "frozen_pond", rarity: "rare" },
  snowy_owl: { name: "Snowy Owl", spot: "frozen_pond", rarity: "legendary" },
  american_robin: { name: "American Robin", spot: "berry_bushes", rarity: "common" },
  mourning_dove: { name: "Mourning Dove", spot: "berry_bushes", rarity: "common" },
  cedar_waxwing: { name: "Cedar Waxwing", spot: "berry_bushes", rarity: "uncommon" },
  northern_mockingbird: { name: "Northern Mockingbird", spot: "berry_bushes", rarity: "uncommon" },
  eastern_bluebird: { name: "Eastern Bluebird", spot: "berry_bushes", rarity: "uncommon" },
  varied_thrush: { name: "Varied Thrush", spot: "berry_bushes", rarity: "rare" },
};
export const birdsAt = (spot: SpotKey) => Object.keys(BIRDS).filter((id) => BIRDS[id].spot === spot);

/** Every Mystery Bird puzzle by id, read from the app's generated data (one JSON object per line). */
export const PUZZLES: Record<string, { id: string; answerId: string; decoyIds: string[] }> = Object.fromEntries(
  readFileSync(new URL("../server/data/collections/mysteryBirdPuzzles/northAmericanWinterBirds.ts", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.trim().startsWith('{"id"'))
    .map((line) => JSON.parse(line.trim().replace(/,$/, "")))
    .map((puzzle) => [puzzle.id, puzzle]),
);

/** Mystery Bird puzzle NAWB-001 (server/data/collections/mysteryBirdPuzzles). */
export const PUZZLE_1 = {
  id: "NAWB-001",
  answerId: "black_capped_chickadee",
  decoyIds: ["evening_grosbeak", "northern_mockingbird", "white_breasted_nuthatch"],
};

/** Today's Mystery Bird day key, the way the server computes it (America/New_York). */
export const etDayKey = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

type CollectionState = {
  totalSightings?: number;
  perBirdSightings?: Record<string, number>;
  perPlayerContribution?: Record<string, number>;
  rarestSighting?: { birdId: string; byDisplayName: string };
  activeLegendaryAlert?: { alertId: string; birdId: string; spot: SpotKey; expiresAt: number };
  sceneDropId?: string;
};

/**
 * World data object of a world where this scene's Collection has been opened before (the usual case).
 * Default admin settings: Description mode, 1 minute cooldown, Learn-more links on.
 */
export const placedWorld = ({
  adminSettings = {},
  collection = {},
  leaderboard = {},
}: {
  adminSettings?: Record<string, unknown>;
  collection?: CollectionState;
  leaderboard?: Record<string, string>;
} = {}) => ({
  adminSettings: { identificationMode: "description", cooldownSeconds: 60, allAboutBirdsLinksEnabled: true, ...adminSettings },
  collections: {
    [COLLECTION_ID]: { sceneDropId: SCENE_DROP_ID, totalSightings: 0, perBirdSightings: {}, perPlayerContribution: {}, ...collection },
  },
  leaderboard,
});

/** Visitor scene data with a bird on the given spot waiting to be identified (as /sightings/start leaves it). */
export const sighting = (spot: SpotKey, birdId: string, choiceBirdIds: string[], cooldownSeconds = 60) => ({
  spotCooldowns: { [spotAssetId(spot)]: Date.now() + cooldownSeconds * 1000 },
  inFlight: { [spotAssetId(spot)]: { collectionId: COLLECTION_ID, birdId, choiceBirdIds } },
});

/** The asset a drawer was opened from: the key asset, the trophy, or one of the bird spots. */
export type Opened = "key" | "trophy" | SpotKey;

export type OtherVisitor = { visitorId: number; profileId: string; displayName: string; visitorData?: Record<string, unknown> };

export type SeedOptions = {
  isAdmin?: boolean;
  /** The key asset's data object. Default: initialized for the Collection. */
  keyAssetData?: Record<string, unknown>;
  /** Override one spot's data object ({} = placed but never opened). */
  spotData?: Partial<Record<SpotKey, Record<string, unknown>>>;
  /** The world's data object. Default: placedWorld(); {} for a world Birdwatch has never run in. */
  worldData?: Record<string, unknown>;
  /** The visitor's data object. */
  visitorData?: Record<string, unknown>;
  /** Badges the visitor already owns. */
  badges?: string[];
  /** Field Guide: species the visitor owns, with how many times each was spotted. */
  birds?: Record<string, number>;
  /** Further visitors in the world. */
  otherVisitors?: OtherVisitor[];
};

const owned = (id: string, item: Record<string, unknown>, quantity = 1) => ({
  id: `owned-${id}`,
  item_id: id,
  status: "ACTIVE",
  quantity,
  item,
});

/** One isolated Topia world in mock-topia with a Birdwatch scene, plus helpers to open the app inside it. */
export class TopiaWorld {
  readonly displayName = "E2E Player";

  constructor(
    readonly urlSlug: string,
    readonly profileId: string,
    private request: APIRequestContext,
  ) {}

  /** Key of this scene's entry in the visitor data object. */
  get sceneKey() {
    return `${this.urlSlug}-${SCENE_DROP_ID}`;
  }

  async seed({
    isAdmin = false,
    keyAssetData = { collectionId: COLLECTION_ID },
    spotData = {},
    worldData = placedWorld(),
    visitorData = {},
    badges = [],
    birds = {},
    otherVisitors = [],
  }: SeedOptions = {}) {
    const scene = { sceneDropId: SCENE_DROP_ID, position: { x: 500, y: 500 }, topLayerURL: "https://example.invalid/asset.png" };
    const assets: Record<string, any> = {
      [KEY_ASSET_ID]: { ...scene, id: KEY_ASSET_ID, assetName: "Birdwatch", uniqueName: "Birdwatch_keyAsset", dataObject: keyAssetData },
      [TROPHY_ASSET_ID]: { ...scene, id: TROPHY_ASSET_ID, assetName: "Trophy", uniqueName: "Birdwatch_trophy", dataObject: {} },
    };
    for (const spot of SPOTS) {
      const id = spotAssetId(spot);
      assets[id] = {
        ...scene,
        id,
        assetName: `Bird spot ${spot}`,
        uniqueName: "Birdwatch_spot",
        clickableLink: `https://birdwatch.example.invalid/spot?collectionId=${COLLECTION_ID}&spot=${spot}`,
        dataObject: spotData[spot] ?? { collectionId: COLLECTION_ID, spot },
      };
    }

    const visitor = (profileId: string, displayName: string, admin: boolean, dataObject: Record<string, unknown>) => ({
      isAdmin: admin,
      profileId,
      displayName,
      landmarkZonesString: "",
      privateZoneId: "",
      dataObject,
      inventory: [] as unknown[],
    });
    const me = visitor(this.profileId, this.displayName, isAdmin, visitorData);
    me.inventory = [
      ...badges.map((name) => owned(name, { name, type: "BADGE", image_url: "" })),
      ...Object.entries(birds).map(([birdId, quantity]) =>
        owned(`item-${birdId}`, { name: BIRDS[birdId].name, type: "ITEM", image_url: "", metadata: { birdId } }, quantity),
      ),
    ];
    const visitors: Record<string, unknown> = { [VISITOR_ID]: me };
    for (const other of otherVisitors) {
      visitors[other.visitorId] = visitor(other.profileId, other.displayName, false, other.visitorData || {});
    }

    const response = await this.request.post(`${MOCK_TOPIA_URL}/__mock/worlds/${this.urlSlug}`, {
      data: { dataObject: worldData, assets, visitors },
    });
    if (!response.ok()) throw new Error(`Seeding mock world failed: ${response.status()}`);
  }

  async state() {
    const response = await this.request.get(`${MOCK_TOPIA_URL}/__mock/worlds/${this.urlSlug}`);
    return (await response.json()) as {
      dataObject: Record<string, any>;
      assets: Record<string, any>;
      visitors: Record<string, any>;
      events: Array<Record<string, any>>;
      unhandled: string[];
    };
  }

  async assetData(assetId = KEY_ASSET_ID) {
    return (await this.state()).assets[assetId]?.dataObject;
  }

  async worldData() {
    return (await this.state()).dataObject;
  }

  /** This world's state for the Collection (World Bird Count etc.). */
  async collection() {
    return (await this.worldData()).collections?.[COLLECTION_ID];
  }

  async visitorData(visitorId = VISITOR_ID) {
    return (await this.state()).visitors[visitorId].dataObject;
  }

  /** The visitor's entry for this scene (cooldowns, in-flight sightings, Mystery Bird). */
  async sceneData(visitorId = VISITOR_ID) {
    return (await this.visitorData(visitorId))?.[this.sceneKey];
  }

  /** Field Guide quantities and badge names the visitor owns. */
  async inventory(visitorId = VISITOR_ID) {
    const items: any[] = (await this.state()).visitors[visitorId].inventory || [];
    const birds: Record<string, number> = {};
    const badges: string[] = [];
    for (const vi of items) {
      if (vi.item.type === "BADGE") badges.push(vi.item.name);
      else if (vi.item.metadata?.birdId) birds[vi.item.metadata.birdId] = vi.quantity;
    }
    return { birds, badges };
  }

  async userData(profileId = this.profileId) {
    return (await (await this.request.get(`${MOCK_TOPIA_URL}/__mock/users/${profileId}`)).json()).dataObject;
  }

  async events(type?: string) {
    const { events } = await this.state();
    return type ? events.filter((e) => e.type === type) : events;
  }

  /** Session credentials Topia appends to the app's iframe URL. */
  credentials(overrides: Record<string, string> = {}) {
    return new URLSearchParams({
      assetId: KEY_ASSET_ID,
      displayName: this.displayName,
      identityId: "identity-1",
      interactiveNonce: "e2e-nonce",
      interactivePublicKey: INTERACTIVE_KEY,
      profileId: this.profileId,
      sceneDropId: SCENE_DROP_ID,
      uniqueName: "Birdwatch_keyAsset",
      urlSlug: this.urlSlug,
      username: "e2e-player",
      visitorId: String(VISITOR_ID),
      ...overrides,
    });
  }

  /** Credentials for a drawer opened from the given asset. */
  at(opened: Opened, overrides: Record<string, string> = {}): Record<string, string> {
    if (opened === "key") return { assetId: KEY_ASSET_ID, uniqueName: "Birdwatch_keyAsset", ...overrides };
    if (opened === "trophy") return { assetId: TROPHY_ASSET_ID, uniqueName: "Birdwatch_trophy", ...overrides };
    return { assetId: spotAssetId(opened), uniqueName: "Birdwatch_spot", ...overrides };
  }

  /** Credentials of another visitor in this world. */
  as(other: OtherVisitor, opened: Opened = "key") {
    return this.at(opened, { visitorId: String(other.visitorId), profileId: other.profileId, displayName: other.displayName });
  }

  /** App page URL as Topia opens it in the iframe. */
  url(path = "/", overrides: Record<string, string> = {}) {
    return `${path}?${this.credentials(overrides)}`;
  }

  /** App API path carrying the session credentials, as the client's backendAPI sends them. */
  api(path: string, overrides: Record<string, string> = {}) {
    return `/api${path}?${this.credentials(overrides)}`;
  }

  /** Open the drawer for an asset, the way clicking it in the world does. */
  async open(page: Page, opened: Opened = "key", overrides: Record<string, string> = {}) {
    const path = opened === "key" ? "/" : opened === "trophy" ? "/trophy" : "/spot";
    await page.goto(this.url(path, this.at(opened, overrides)));
  }
}

export const test = base.extend<{ world: TopiaWorld }>({
  world: async ({ request }, use, testInfo) => {
    const id = `${testInfo.testId}-${testInfo.repeatEachIndex}-${testInfo.retry}`.replace(/[^a-zA-Z0-9-]/g, "");
    const world = new TopiaWorld(`world-${id}`, `profile-${id}`, request);
    await use(world);

    // Fail the test if the app called a public-API endpoint the mock doesn't implement (e.g. after an
    // @rtsdk/topia upgrade): it would otherwise pass against a 501 the real API never returns.
    expect((await world.state()).unhandled, "public-API calls mock-topia doesn't implement").toEqual([]);
    const outside = await (await request.get(`${MOCK_TOPIA_URL}/__mock/unhandled`)).json();
    expect(outside, "public-API calls mock-topia doesn't implement").toEqual([]);
  },
});

export { expect } from "@playwright/test";
