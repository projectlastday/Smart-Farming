import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  enqueuePrediction,
  generateClientOperationId,
  getPendingQueue,
  listQueue,
  markFailed,
  markSynced,
  removeSynced,
} from '@/offline/queue';

const payload = {
  client_operation_id: '',
  farm_id: 'farm-1',
  crop_cycle_id: 'cycle-1',
  feature_type: 'disease',
  model_version: 'disease-mobilenet-v1-paddy-doctor',
  inputs_snapshot: { mode: 'offline' },
  output: { status: 'classified', label: 'blast' },
  confidence: 88,
};

describe('offline IndexedDB queue', () => {
  beforeEach(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('agrifusionnet-offline');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  });

  it('enqueues, rejects duplicate operation ids, retries, and removes after sync', async () => {
    const id = generateClientOperationId();
    const first = await enqueuePrediction({ ...payload, client_operation_id: id });
    expect(first.status).toBe('pending');
    await expect(enqueuePrediction({ ...payload, client_operation_id: id })).rejects.toBeTruthy();

    const pending = await getPendingQueue();
    expect(pending).toHaveLength(1);

    await markFailed(first.id as number, 'network', 1);
    const failed = await listQueue();
    expect(failed[0].status).toBe('failed');
    expect(failed[0].retry_count).toBe(1);

    await markSynced(first.id as number);
    const synced = await listQueue();
    expect(synced[0].status).toBe('synced');
    const removed = await removeSynced();
    expect(removed).toBe(1);
    expect(await listQueue()).toEqual([]);
  });
});
