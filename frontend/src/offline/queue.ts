import type { QueuedOperation, SyncPredictionPayload } from '@/types';

const DB_NAME = 'agrifusionnet-offline';
const DB_VERSION = 1;
const STORE = 'sync_queue';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('client_operation_id', 'client_operation_id', { unique: true });
        store.createIndex('status', 'status', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const store = transaction.objectStore(STORE);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => reject(transaction.error);
      }),
  );
}

export async function enqueuePrediction(payload: SyncPredictionPayload): Promise<QueuedOperation> {
  const entry: QueuedOperation = {
    client_operation_id: payload.client_operation_id,
    payload,
    status: 'pending',
    created_at: new Date().toISOString(),
    retry_count: 0,
  };
  const id = await tx('readwrite', (store) => store.add(entry));
  return { ...entry, id: id as number };
}

export async function listQueue(): Promise<QueuedOperation[]> {
  return tx('readonly', (store) => store.getAll());
}

export async function getPendingQueue(): Promise<QueuedOperation[]> {
  const all = await listQueue();
  return all.filter((item) => item.status === 'pending' || item.status === 'failed');
}

export async function updateQueueItem(
  id: number,
  patch: Partial<QueuedOperation>,
): Promise<void> {
  const existing = await tx<QueuedOperation | undefined>('readonly', (store) => store.get(id));
  if (!existing) return;
  await tx('readwrite', (store) => store.put({ ...existing, ...patch, id }));
}

export async function markSyncing(id: number): Promise<void> {
  await updateQueueItem(id, { status: 'syncing' });
}

export async function markSynced(id: number): Promise<void> {
  await updateQueueItem(id, { status: 'synced', error: undefined });
}

export async function markFailed(id: number, error: string, retryCount: number): Promise<void> {
  await updateQueueItem(id, { status: 'failed', error, retry_count: retryCount });
}

export async function removeSynced(): Promise<number> {
  const all = await listQueue();
  let removed = 0;
  for (const item of all) {
    if (item.status === 'synced' && item.id != null) {
      await tx('readwrite', (store) => store.delete(item.id!));
      removed += 1;
    }
  }
  return removed;
}

export async function queueStats(): Promise<{
  pending: number;
  failed: number;
  synced: number;
  total: number;
}> {
  const all = await listQueue();
  return {
    pending: all.filter((i) => i.status === 'pending').length,
    failed: all.filter((i) => i.status === 'failed').length,
    synced: all.filter((i) => i.status === 'synced').length,
    total: all.length,
  };
}

export function generateClientOperationId(): string {
  return crypto.randomUUID();
}
