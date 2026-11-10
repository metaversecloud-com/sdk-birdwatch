type Lock = { lock?: { lockId: string; releaseLock: boolean } };
type Analytics = { analytics?: Array<Record<string, unknown>> };
type AnyFn = (...a: any[]) => any;

const makeFn = (): jest.Mock & AnyFn => jest.fn().mockResolvedValue(undefined);

const makeDataHolder = (initial: Record<string, any> = {}) => {
  const obj: any = {
    dataObject: initial,
    fetchDataObject: jest.fn(async function (this: any) {
      return this.dataObject;
    }),
    setDataObject: jest.fn(async function (this: any, next: any, _opts?: Lock & Analytics) {
      this.dataObject = { ...next };
      return this.dataObject;
    }),
    updateDataObject: jest.fn(async function (this: any, patch: any, _opts?: Lock & Analytics) {
      this.dataObject = applyDotPatch(this.dataObject, patch);
      return this.dataObject;
    }),
    incrementDataObjectValue: jest.fn(async function () {}),
  };
  return obj;
};

const applyDotPatch = (into: any, patch: any): any => {
  const next = { ...(into || {}) };
  for (const [k, v] of Object.entries(patch || {})) {
    if (k.includes(".")) {
      const parts = k.split(".");
      let cursor: any = next;
      for (let i = 0; i < parts.length - 1; i++) {
        const seg = parts[i];
        cursor[seg] = { ...(cursor[seg] || {}) };
        cursor = cursor[seg];
      }
      cursor[parts[parts.length - 1]] = v;
    } else {
      next[k] = v;
    }
  }
  return next;
};

export const fireToast = jest.fn().mockResolvedValue({ success: true });
export const modifyInventoryItemQuantity = jest.fn().mockResolvedValue({});

export class Topia {
  constructor(_opts: any) {}
}

export class AssetFactory {
  constructor(_topia: any) {}
}

export class DroppedAssetFactory {
  constructor(_topia: any) {}
  async get(assetId: string, urlSlug: string, _opts: any) {
    const holder = makeDataHolder((__mock as any).droppedAssetSeed[assetId] || {});
    return {
      id: assetId,
      urlSlug,
      uniqueName: (__mock as any).droppedAssetUniqueName[assetId],
      position: { x: 0, y: 0 },
      ...holder,
    };
  }
}

export class EcosystemFactory {
  constructor(_topia: any) {}
  create(_opts: any) {
    return {
      inventoryItems: (__mock as any).ecosystemItems || [],
      fetchInventoryItems: jest.fn().mockResolvedValue(undefined),
    };
  }
}

export class UserFactory {
  constructor(_topia: any) {}
  create(args: any) {
    (__mock as any).lastUserCreate = args;
    const u = makeDataHolder({});
    (u as any).grantInventoryItem = jest.fn().mockResolvedValue({});
    return u;
  }
}

export class VisitorFactory {
  constructor(_topia: any) {}
  async get(visitorId: number, urlSlug: string, opts: any) {
    return this.makeVisitor(visitorId, urlSlug, opts, true);
  }
  create(visitorId: number, urlSlug: string, opts: any) {
    return this.makeVisitor(visitorId, urlSlug, opts, false);
  }
  private makeVisitor(visitorId: number, urlSlug: string, _opts: any, withDetails: boolean) {
    const holder = makeDataHolder((__mock as any).visitorSeed || {});
    return {
      ...holder,
      id: visitorId,
      urlSlug,
      isAdmin: withDetails ? (__mock as any).visitorIsAdmin ?? false : undefined,
      inventoryItems: (__mock as any).visitorInventoryItems || [],
      fetchInventoryItems: jest.fn().mockResolvedValue(undefined),
      grantInventoryItem: jest.fn().mockResolvedValue({}),
      modifyInventoryItemQuantity: modifyInventoryItemQuantity,
      fireToast,
    };
  }
}

export class WorldFactory {
  constructor(_topia: any) {}
  create(urlSlug: string, _opts: any) {
    (__mock as any).lastWorldCreateArgs = { urlSlug };
    const holder = makeDataHolder((__mock as any).worldSeed || {});
    const world = {
      ...holder,
      urlSlug,
      fetchDroppedAssetsBySceneDropId: jest
        .fn()
        .mockResolvedValue((__mock as any).sceneAssets || []),
      triggerParticle: jest.fn().mockResolvedValue(undefined),
      fireToast,
    };
    (__mock as any).lastWorld = world;
    return world;
  }
}

export class WorldActivityFactory {
  constructor(_topia: any) {}
  create(_urlSlug: string, _opts: any) {
    return { fireToast, currentVisitors: jest.fn().mockResolvedValue({}) };
  }
}

export const __mock = {
  fireToast,
  modifyInventoryItemQuantity,
  lastWorldCreateArgs: null as any,
  lastUserCreate: null as any,
  droppedAssetSeed: {} as Record<string, any>,
  droppedAssetUniqueName: {} as Record<string, string>,
  worldSeed: {} as any,
  visitorSeed: {} as any,
  visitorIsAdmin: false,
  visitorInventoryItems: [] as any[],
  ecosystemItems: [] as any[],
  sceneAssets: [] as any[],
  reset(this: any) {
    fireToast.mockClear();
    modifyInventoryItemQuantity.mockClear();
    this.lastWorldCreateArgs = null;
    this.lastUserCreate = null;
    this.droppedAssetSeed = {};
    this.droppedAssetUniqueName = {};
    this.worldSeed = {};
    this.visitorSeed = {};
    this.visitorIsAdmin = false;
    this.visitorInventoryItems = [];
    this.ecosystemItems = [];
    this.sceneAssets = [];
  },
};

export type DroppedAssetInterface = any;
export type VisitorInterface = any;
export type WorldInterface = any;
