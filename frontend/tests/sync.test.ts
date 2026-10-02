import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, setCsrfToken } from '@/services/api';

const queueMocks = vi.hoisted(() => ({
  getPendingQueue: vi.fn(),
  markSyncing: vi.fn(),
  markSynced: vi.fn(),
  markFailed: vi.fn(),
  updateQueueItem: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  fetchSession: vi.fn(),
}));

vi.mock('@/services/predictions', () => ({
  syncPrediction: vi.fn(),
}));

vi.mock('@/offline/queue', () => queueMocks);

vi.mock('@/services/auth', () => authMocks);

function pendingItem(id: number, op: string) {
  return {
    id,
    client_operation_id: op,
    payload: {
      client_operation_id: op,
      farm_id: 'farm',
      crop_cycle_id: 'cycle',
      feature_type: 'disease',
      model_version: 'offline',
      inputs_snapshot: {},
      output: {},
    },
    status: 'pending' as const,
    created_at: new Date().toISOString(),
    retry_count: 0,
  };
}

describe('syncOfflineQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCsrfToken('test-csrf');
    authMocks.fetchSession.mockResolvedValue({ csrf_token: 'test-csrf', user: { id: 'u' } });
    queueMocks.markSyncing.mockResolvedValue(undefined);
    queueMocks.markSynced.mockResolvedValue(undefined);
    queueMocks.markFailed.mockResolvedValue(undefined);
    queueMocks.updateQueueItem.mockResolvedValue(undefined);
  });

  it('marks 4xx validation errors as failed without retry', async () => {
    const { syncPrediction } = await import('@/services/predictions');
    queueMocks.getPendingQueue.mockResolvedValue([pendingItem(1, 'op-1')]);
    vi.mocked(syncPrediction).mockRejectedValue(new ApiClientError(404, 'Validasi gagal'));

    const { syncOfflineQueue } = await import('@/offline/sync');
    const result = await syncOfflineQueue();

    expect(result.failed).toBe(1);
    expect(result.synced).toBe(0);
    expect(queueMocks.markFailed).toHaveBeenCalledWith(1, 'Validasi gagal', 0);
  });

  it('retries once after 403 by refreshing the CSRF session', async () => {
    const { syncPrediction } = await import('@/services/predictions');
    queueMocks.getPendingQueue.mockResolvedValue([pendingItem(4, 'op-4')]);
    vi.mocked(syncPrediction)
      .mockRejectedValueOnce(new ApiClientError(403, 'CSRF token tidak valid'))
      .mockResolvedValueOnce({ id: 'pred-4' });

    const { syncOfflineQueue } = await import('@/offline/sync');
    const result = await syncOfflineQueue();

    expect(authMocks.fetchSession).toHaveBeenCalled();
    expect(syncPrediction).toHaveBeenCalledTimes(2);
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);
    expect(queueMocks.markSynced).toHaveBeenCalledWith(4);
  });

  it('sets needsLogin on 401 and leaves item pending', async () => {
    const { syncPrediction } = await import('@/services/predictions');
    queueMocks.getPendingQueue.mockResolvedValue([pendingItem(2, 'op-2')]);
    vi.mocked(syncPrediction).mockRejectedValue(new ApiClientError(401, 'Sesi tidak valid'));

    const { syncOfflineQueue } = await import('@/offline/sync');
    const result = await syncOfflineQueue();

    expect(result.needsLogin).toBe(true);
    expect(queueMocks.updateQueueItem).toHaveBeenCalledWith(2, { status: 'pending' });
  });

  it('requeues pending after 503 under max retries', async () => {
    vi.useFakeTimers();
    const { syncPrediction } = await import('@/services/predictions');
    queueMocks.getPendingQueue.mockResolvedValue([pendingItem(3, 'op-3')]);
    vi.mocked(syncPrediction).mockRejectedValue(new ApiClientError(503, 'Server down'));

    const { syncOfflineQueue } = await import('@/offline/sync');
    const promise = syncOfflineQueue();
    await vi.runAllTimersAsync();
    const result = await promise;
    vi.useRealTimers();

    expect(result.synced).toBe(0);
    expect(result.failed).toBe(0);
    expect(queueMocks.updateQueueItem).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ status: 'pending', retry_count: 1 }),
    );
  });
});
