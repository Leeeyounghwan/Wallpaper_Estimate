import retailRules from "./data/retail_rules.example.json";
import type { AuditEvent, QuoteRules, QuoteSnapshot, StoreSettings, StoredState } from "./types";

const DB_NAME = "wallpaper-estimate-local";
const DB_VERSION = 1;
const STATE_STORE = "state";
const STATE_KEY = "current";

const DEFAULT_SETTINGS: StoreSettings = {
  shopName: "가경지업사",
  contactText: "0507-1351-3531",
  managerName: "로컬 사용자",
};

const defaultState: StoredState = {
  rules: retailRules as unknown as QuoteRules,
  history: [],
  quotes: [],
  settings: DEFAULT_SETTINGS,
};

export async function loadState(): Promise<StoredState> {
  const db = await openDb();
  const stored = await requestToPromise<StoredState | undefined>(
    db.transaction(STATE_STORE, "readonly").objectStore(STATE_STORE).get(STATE_KEY),
  );
  db.close();
  return stored ? normalizeState(stored) : defaultState;
}

export async function saveState(state: StoredState): Promise<void> {
  const db = await openDb();
  await requestToPromise(
    db
      .transaction(STATE_STORE, "readwrite")
      .objectStore(STATE_STORE)
      .put(normalizeState(state), STATE_KEY),
  );
  db.close();
}

export async function resetState(): Promise<StoredState> {
  await saveState(defaultState);
  return defaultState;
}

export function addAuditEvent(
  state: StoredState,
  event: Omit<AuditEvent, "id" | "createdAt" | "version" | "actor"> & { actor?: string },
): StoredState {
  const audit: AuditEvent = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    actor: event.actor ?? state.settings.managerName ?? "로컬 사용자",
    action: event.action,
    entity: event.entity,
    before: event.before,
    after: event.after,
    reason: event.reason,
    version: state.rules.dataset_version,
  };
  return { ...state, history: [audit, ...state.history].slice(0, 200) };
}

export function addQuoteSnapshot(state: StoredState, quote: Omit<QuoteSnapshot, "id" | "createdAt">): StoredState {
  const snapshot: QuoteSnapshot = {
    ...quote,
    id: `Q-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
  };
  return { ...state, quotes: [snapshot, ...state.quotes].slice(0, 100) };
}

function normalizeState(state: StoredState): StoredState {
  const settings = { ...DEFAULT_SETTINGS, ...(state.settings ?? {}) };
  if (!settings.shopName || settings.shopName === "도배·장판 견적관리") {
    settings.shopName = DEFAULT_SETTINGS.shopName;
  }
  if (!settings.contactText) {
    settings.contactText = DEFAULT_SETTINGS.contactText;
  }

  return {
    rules: state.rules ?? defaultState.rules,
    history: state.history ?? [],
    quotes: state.quotes ?? [],
    settings,
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STATE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
