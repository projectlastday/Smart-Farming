import { syncPrediction } from '@/services/predictions';
import { ApiClientError } from '@/services/api';
import { fetchSession } from '@/services/auth';
import {
  getPendingQueue,
  markFailed,
  markSynced,
  markSyncing,
  updateQueueItem,
} from '@/offline/queue';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

function backoffDelay(retryCount: number): number {
  return BASE_DELAY_MS * 2 ** retryCount;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureCsrfToken(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  try {
    await fetchSession();
  } catch {
    /* session restore is best-effort; caller handles 401/403 */
  }
}

async function postWithCsrfRetry(payload: Parameters<typeof syncPrediction>[0]): Promise<void> {
  try {
    await syncPrediction(payload);
  } catch (err) {
    const status = err instanceof ApiClientError ? err.status : 0;
    if (status !== 403) throw err;
    await fetchSession();
    await syncPrediction(payload);
  }
}

/** Sync pending offline queue items with exponential backoff on 5xx/network errors. */
export async function syncOfflineQueue(): Promise<{
  synced: number;
  failed: number;
  needsLogin: boolean;
}> {
  await ensureCsrfToken();
  const pending = await getPendingQueue();
  let synced = 0;
  let failed = 0;
  let needsLogin = false;

  for (const item of pending) {
    if (item.id == null) continue;

    await markSyncing(item.id);

    try {
      await postWithCsrfRetry(item.payload);
      await markSynced(item.id);
      synced += 1;
    } catch (err) {
      const apiErr = err instanceof ApiClientError ? err : null;
      const status = apiErr?.status ?? 0;

      if (status === 401) {
        needsLogin = true;
        await updateQueueItem(item.id, { status: 'pending' });
        break;
      }

      if (status >= 400 && status < 500 && status !== 429) {
        await markFailed(item.id, apiErr?.message ?? 'Validasi gagal', item.retry_count);
        failed += 1;
        continue;
      }

      const nextRetry = item.retry_count + 1;
      if (nextRetry >= MAX_RETRIES) {
        await markFailed(item.id, apiErr?.message ?? 'Sinkronisasi gagal', nextRetry);
        failed += 1;
      } else {
        await updateQueueItem(item.id, {
          status: 'pending',
          retry_count: nextRetry,
          error: apiErr?.message,
        });
        await sleep(backoffDelay(nextRetry));
      }
    }
  }

  return { synced, failed, needsLogin };
}
