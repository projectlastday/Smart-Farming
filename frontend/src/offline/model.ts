import * as ort from 'onnxruntime-web';
import { fetchDiseaseModelMetadata, resolveModelUrl } from '@/services/features';

const MODEL_DB = 'agrifusionnet-models';
const MODEL_STORE = 'models';
const META_KEY = 'disease-model-meta';

export interface InstalledModel {
  version: string;
  hash?: string;
  labels: string[];
  inputSize: number[];
  mean?: number[];
  std?: number[];
  confidenceThreshold?: number;
  installedAt: string;
  sizeBytes: number;
}

export interface InstallProgress {
  phase: 'metadata' | 'download' | 'verify' | 'ready';
  percent: number;
  message: string;
}

let session: ort.InferenceSession | null = null;
let installedMeta: InstalledModel | null = null;

function openModelDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MODEL_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MODEL_STORE)) {
        db.createObjectStore(MODEL_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openModelDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MODEL_STORE, 'readonly');
    const req = tx.objectStore(MODEL_STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openModelDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MODEL_STORE, 'readwrite');
    tx.objectStore(MODEL_STORE).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getInstalledModel(): Promise<InstalledModel | null> {
  if (installedMeta) return installedMeta;
  const meta = await idbGet<InstalledModel>(META_KEY);
  installedMeta = meta ?? null;
  return installedMeta;
}

export async function isModelInstalled(): Promise<boolean> {
  const meta = await getInstalledModel();
  if (!meta) return false;
  const blob = await idbGet<ArrayBuffer>('disease-model-weights');
  return Boolean(blob);
}

export async function installModel(
  onProgress?: (p: InstallProgress) => void,
): Promise<InstalledModel> {
  onProgress?.({ phase: 'metadata', percent: 5, message: 'Mengambil metadata model...' });

  const metadata = await fetchDiseaseModelMetadata();
  const current = await getInstalledModel();
  if (
    current &&
    metadata.hash &&
    current.hash === metadata.hash &&
    current.version === metadata.version
  ) {
    onProgress?.({ phase: 'ready', percent: 100, message: 'Model versi ini sudah terinstal' });
    return current;
  }
  const labels = metadata.labels ?? metadata.classes ?? [];
  const modelUrl = metadata.model_url ?? '/api/v1/features/disease/model/download';

  onProgress?.({ phase: 'download', percent: 15, message: 'Mengunduh model ONNX...' });

  const response = await fetch(resolveModelUrl(modelUrl), { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Gagal mengunduh model');
  }

  const buffer = await response.arrayBuffer();
  onProgress?.({ phase: 'verify', percent: 85, message: 'Memverifikasi model...' });

  if (metadata.hash) {
    const hash = await sha256Hex(buffer);
    if (hash !== metadata.hash) {
      throw new Error('Hash model tidak cocok');
    }
  }

  // Keep previous model until replacement is verified
  const previous = await idbGet<ArrayBuffer>('disease-model-weights');
  await idbSet('disease-model-weights-backup', previous ?? null);
  await idbSet('disease-model-weights', buffer);

  const meta: InstalledModel = {
    version: metadata.version,
    hash: metadata.hash,
    labels,
    inputSize: metadata.input_size,
    mean: metadata.mean,
    std: metadata.std,
    confidenceThreshold: metadata.confidence_threshold,
    installedAt: new Date().toISOString(),
    sizeBytes: buffer.byteLength,
  };
  await idbSet(META_KEY, meta);
  installedMeta = meta;
  session = null;

  onProgress?.({ phase: 'ready', percent: 100, message: 'Model siap digunakan offline' });
  return meta;
}

export async function loadSession(): Promise<ort.InferenceSession> {
  if (session) return session;

  ort.env.wasm.wasmPaths = '/ort/';

  const buffer = await idbGet<ArrayBuffer>('disease-model-weights');
  if (!buffer) {
    throw new Error('Model belum diinstal');
  }

  session = await ort.InferenceSession.create(buffer, {
    executionProviders: ['wasm'],
  });
  return session;
}

/** Run offline disease inference on a leaf image file. */
export async function runOfflineDiseaseInference(
  imageFile: File,
): Promise<{ label: string; confidence: number; probabilities: Record<string, number> }> {
  const meta = await getInstalledModel();
  if (!meta) {
    throw new Error('Model offline belum diinstal');
  }

  const inferenceSession = await loadSession();
  const bitmap = await createImageBitmap(imageFile);
  const [height, width] = meta.inputSize.length >= 2 ? meta.inputSize : [224, 224];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, width, height);
  const mean = meta.mean ?? [0.485, 0.456, 0.406];
  const std = meta.std ?? [0.229, 0.224, 0.225];
  const threshold = meta.confidenceThreshold ?? 0.55;
  const input = new Float32Array(3 * width * height);
  for (let i = 0; i < width * height; i++) {
    const r = imageData.data[i * 4] / 255;
    const g = imageData.data[i * 4 + 1] / 255;
    const b = imageData.data[i * 4 + 2] / 255;
    input[i] = (r - mean[0]) / std[0];
    input[i + width * height] = (g - mean[1]) / std[1];
    input[i + 2 * width * height] = (b - mean[2]) / std[2];
  }

  const tensor = new ort.Tensor('float32', input, [1, 3, height, width]);
  const inputName = inferenceSession.inputNames[0];
  const results = await inferenceSession.run({ [inputName]: tensor });
  const outputName = inferenceSession.outputNames[0];
  const output = results[outputName].data as Float32Array;

  const probs = Array.from(output);
  const maxIdx = probs.indexOf(Math.max(...probs));
  const label = meta.labels[maxIdx] ?? 'unknown';
  const confidence = probs[maxIdx] ?? 0;

  const probabilities: Record<string, number> = {};
  meta.labels.forEach((l, idx) => {
    probabilities[l] = probs[idx] ?? 0;
  });

  if (confidence < threshold) {
    return {
      label: 'Tidak dapat diklasifikasi dengan andal',
      confidence,
      probabilities,
    };
  }

  return { label, confidence, probabilities };
}

export async function uninstallModel(): Promise<void> {
  session = null;
  installedMeta = null;
  const db = await openModelDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MODEL_STORE, 'readwrite');
    tx.objectStore(MODEL_STORE).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
