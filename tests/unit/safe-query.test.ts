import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeQuery } from '@/lib/db/safe-query';

function transientError(message = 'fetch failed', code?: string) {
  const err = new Error(message) as Error & { code?: string };
  if (code) err.code = code;
  return err;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('safeQuery', () => {
  it('returns the query result on first-try success', async () => {
    const fn = vi.fn(async () => [{ id: 1 }]);
    const result = await safeQuery(fn, []);
    expect(result).toEqual([{ id: 1 }]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a transient "fetch failed" error and succeeds on attempt 2', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(transientError('fetch failed'))
      .mockResolvedValueOnce([{ id: 2 }]);

    const result = await safeQuery(fn, []);
    expect(result).toEqual([{ id: 2 }]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('treats ETIMEDOUT code as transient (retries)', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(transientError('some wrapper', 'ETIMEDOUT'))
      .mockResolvedValueOnce('ok');

    const result = await safeQuery(fn, 'fallback');
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('walks the error cause chain to find a transient cause', async () => {
    const wrapped = new Error('Failed query: select ...');
    (wrapped as Error & { cause?: unknown }).cause = transientError('fetch failed');

    const fn = vi.fn().mockRejectedValueOnce(wrapped).mockResolvedValueOnce('recovered');

    const result = await safeQuery(fn, 'fallback');
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a non-transient error — returns fallback after one attempt', async () => {
    const fn = vi.fn(async () => {
      throw new Error('column "nope" does not exist');
    });

    const result = await safeQuery(fn, ['fallback']);
    expect(result).toEqual(['fallback']);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns fallback after exhausting retries on a persistent transient error', async () => {
    const fn = vi.fn(async () => {
      throw transientError('fetch failed');
    });

    const result = await safeQuery(fn, 'fallback');
    expect(result).toBe('fallback');
    // default retries = 2 → 3 total attempts
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respects a custom retry count', async () => {
    const fn = vi.fn(async () => {
      throw transientError('fetch failed');
    });

    await safeQuery(fn, null, { retries: 0 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('never throws, even for bizarre thrown values', async () => {
    const fn = vi.fn(async () => {
      // eslint-disable-next-line no-throw-literal
      throw 'a string, not an Error';
    });

    await expect(safeQuery(fn, 'fallback')).resolves.toBe('fallback');
  });
});
