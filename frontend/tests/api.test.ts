import { describe, expect, it } from 'vitest';
import { setCsrfToken, getCsrfToken } from '@/services/api';
import { resolveModelUrl } from '@/services/features';

describe('api csrf token', () => {
  it('stores and retrieves csrf token', () => {
    setCsrfToken('test-token-abc');
    expect(getCsrfToken()).toBe('test-token-abc');
    setCsrfToken(null);
    expect(getCsrfToken()).toBeNull();
  });

  it('persists csrf token in sessionStorage across in-memory clears', () => {
    setCsrfToken('persisted-csrf');
    expect(sessionStorage.getItem('agrifusion_csrf')).toBe('persisted-csrf');
    setCsrfToken(null);
    expect(sessionStorage.getItem('agrifusion_csrf')).toBeNull();
    expect(getCsrfToken()).toBeNull();
  });
});

describe('resolveModelUrl', () => {
  it('resolves relative model download path against API base', () => {
    expect(resolveModelUrl('/api/v1/features/disease/model/download')).toContain(
      '/api/v1/features/disease/model/download',
    );
  });

  it('passes through absolute URLs', () => {
    expect(resolveModelUrl('https://cdn.example.com/model.onnx')).toBe(
      'https://cdn.example.com/model.onnx',
    );
  });

  it('handles relative path without leading slash', () => {
    expect(resolveModelUrl('api/v1/features/disease/model/download')).toContain(
      '/api/v1/features/disease/model/download',
    );
  });
});

describe('generateClientOperationId', () => {
  it('generates unique UUIDs', async () => {
    const { generateClientOperationId } = await import('@/offline/queue');
    const a = generateClientOperationId();
    const b = generateClientOperationId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
  });
});
