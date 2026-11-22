import { throwIfAborted, withAbortDeadline } from "../abort";
import {
  GUEST_OWNER,
  PROGRESS_KINDS,
  type ProgressKind,
  type ProgressRow,
  timestampKey,
} from "../progress";

export type Cursor = { serverUpdatedAt: string; id: string };
export type PulledRow = { cursor: Cursor; row: ProgressRow };
export type OutboxEntry = { opId: string; owner: string; row: ProgressRow };

export interface ProgressSyncStore {
  listPending(owner: string, limit: number): Promise<OutboxEntry[]>;
  acknowledge(owner: string, opIds: string[]): Promise<void>;
  getCursor(owner: string, kind: ProgressKind): Promise<Cursor | null>;
  applyPulledPage(
    owner: string,
    kind: ProgressKind,
    after: Cursor | null,
    page: PulledRow[],
  ): Promise<boolean>;
}

export interface ProgressRemote {
  push(
    owner: string,
    entries: OutboxEntry[],
    signal: AbortSignal,
  ): Promise<void>;
  pull(
    owner: string,
    kind: ProgressKind,
    after: Cursor | null,
    limit: number,
    signal: AbortSignal,
  ): Promise<PulledRow[]>;
}

function assertPage(
  owner: string,
  kind: ProgressKind,
  after: Cursor | null,
  page: PulledRow[],
  limit: number,
) {
  if (page.length > limit) throw new Error("Progress page exceeds its limit");
  let previousTime = after && timestampKey(after.serverUpdatedAt);
  const seen = new Set(after ? [after.id] : []);
  for (const { row, cursor } of page) {
    if (row.owner !== owner || row.kind !== kind || row.id !== cursor.id) {
      throw new Error("Progress page scope mismatch");
    }
    const currentTime = timestampKey(cursor.serverUpdatedAt);
    if (previousTime && currentTime < previousTime)
      throw new Error("Progress cursor did not advance");
    if (currentTime !== previousTime) seen.clear();
    if (seen.has(cursor.id)) {
      throw new Error("Progress cursor did not advance");
    }
    seen.add(cursor.id);
    previousTime = currentTime;
  }
}

const RETRY_MS = 10_000;

export function createProgressSync({
  store,
  remote,
  owner,
  onChange,
  onComplete,
  onError,
  pageSize = 100,
}: {
  store: ProgressSyncStore;
  remote: ProgressRemote;
  owner: string;
  onChange?: () => void;
  onComplete?: () => void;
  onError?: (error: unknown) => void;
  pageSize?: number;
}) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
    throw new Error("Invalid progress page size");
  let inFlight:
    | { controller: AbortController; promise: Promise<void> }
    | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;
  const online = () => globalThis.navigator?.onLine !== false;

  async function run(signal: AbortSignal) {
    let changed = false;
    try {
      while (true) {
        throwIfAborted(signal);
        const batch = await store.listPending(owner, pageSize);
        if (!batch.length) break;
        throwIfAborted(signal);
        await withAbortDeadline(signal, RETRY_MS, (request) =>
          remote.push(owner, batch, request),
        );
        throwIfAborted(signal);
        await store.acknowledge(
          owner,
          batch.map(({ opId }) => opId),
        );
      }

      for (const kind of PROGRESS_KINDS) {
        while (true) {
          throwIfAborted(signal);
          const cursor = await store.getCursor(owner, kind);
          throwIfAborted(signal);
          const page = await withAbortDeadline(signal, RETRY_MS, (request) =>
            remote.pull(owner, kind, cursor, pageSize, request),
          );
          throwIfAborted(signal);
          if (!page.length) break;
          assertPage(owner, kind, cursor, page, pageSize);
          if (await store.applyPulledPage(owner, kind, cursor, page)) {
            changed = true;
            if (page.length < pageSize) break;
          }
        }
      }
    } finally {
      if (changed && !signal.aborted) onChange?.();
    }
    if (!signal.aborted) onComplete?.();
  }

  function syncNow(): Promise<void> {
    if (stopped || !owner || owner === GUEST_OWNER || !online())
      return Promise.resolve();
    if (inFlight) {
      if (!inFlight.controller.signal.aborted) return inFlight.promise;
      return inFlight.promise.catch(() => {}).then(syncNow);
    }
    const controller = new AbortController();
    const promise = run(controller.signal).finally(() => {
      inFlight = undefined;
    });
    inFlight = { controller, promise };
    return promise;
  }

  function tick() {
    void syncNow().catch((error) => {
      if (timer !== undefined && online() && error?.name !== "AbortError")
        onError?.(error);
    });
  }

  function cancel() {
    inFlight?.controller.abort();
  }

  return {
    syncNow,
    start() {
      if (timer !== undefined || !owner || owner === GUEST_OWNER) return;
      stopped = false;
      globalThis.window?.addEventListener("online", tick);
      globalThis.window?.addEventListener("offline", cancel);
      timer = setInterval(tick, RETRY_MS);
      tick();
    },
    stop() {
      stopped = true;
      clearInterval(timer);
      timer = undefined;
      globalThis.window?.removeEventListener("online", tick);
      globalThis.window?.removeEventListener("offline", cancel);
      cancel();
      return inFlight?.promise.catch(() => {}) ?? Promise.resolve();
    },
  };
}
