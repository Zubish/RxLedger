import type { Database } from "./types.js";

export const heavyCollectionKeys = ["sales", "ledger", "auditLogs"] as const;

type HeavyCollectionKey = (typeof heavyCollectionKeys)[number];
type HeavySnapshot = Record<HeavyCollectionKey, Map<string, string>>;

export type DatabasePatch = {
  [Key in HeavyCollectionKey]: {
    upserts: Database[Key];
    removedIds: string[];
  };
};

function itemId(item: unknown) {
  return String((item as { id?: unknown }).id || "");
}

export function snapshotHeavyCollections(db: Database): HeavySnapshot {
  return Object.fromEntries(
    heavyCollectionKeys.map((key) => [
      key,
      new Map(
        db[key].map(
          (item) => [itemId(item), JSON.stringify(item)] as const,
        ),
      ),
    ]),
  ) as HeavySnapshot;
}

export function buildDatabasePatch(
  before: HeavySnapshot,
  after: Database,
): DatabasePatch {
  return Object.fromEntries(
    heavyCollectionKeys.map((key) => {
      const currentIds = new Set(after[key].map(itemId));
      const upserts = after[key].filter((item) => {
        const id = itemId(item);
        return before[key].get(id) !== JSON.stringify(item);
      });
      const removedIds = [...before[key].keys()].filter(
        (id) => !currentIds.has(id),
      );
      return [key, { upserts, removedIds }];
    }),
  ) as DatabasePatch;
}

export function stripHeavyCollections(db: Database): Database {
  return {
    ...db,
    sales: [],
    ledger: [],
    auditLogs: [],
  };
}

export function applyDatabasePatch(
  previous: Database,
  core: Database,
  patch: DatabasePatch,
): Database {
  const next = { ...core };
  for (const key of heavyCollectionKeys) {
    const removed = new Set(patch[key].removedIds);
    const changed = new Set(patch[key].upserts.map(itemId));
    const retained = previous[key].filter((item) => {
      const id = itemId(item);
      return !removed.has(id) && !changed.has(id);
    });
    Object.assign(next, { [key]: [...patch[key].upserts, ...retained] });
  }
  return next;
}
