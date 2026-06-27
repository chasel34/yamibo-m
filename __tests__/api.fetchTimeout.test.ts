import { ApiError, __private } from '../src/api';

describe('API fetch timeout helpers', () => {
  test('fetchWithTimeout rejects with TimeoutError when the request times out', async () => {
    const abortAwareFetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    })) as unknown as typeof fetch;

    await expect(__private.fetchWithTimeout('https://example.test', {}, 1, abortAwareFetch))
      .rejects.toMatchObject({ name: 'TimeoutError' });
    expect(abortAwareFetch).toHaveBeenCalledTimes(1);
  });

  test('timeout-shaped errors are recognized consistently', () => {
    expect(__private.isTimeoutError(new __private.TimeoutError())).toBe(true);
    const err = new Error('aborted');
    err.name = 'TimeoutError';
    expect(__private.isTimeoutError(err)).toBe(true);
  });

  test('retry policy still retries network and proxy failures', () => {
    expect(__private.shouldRetry(new ApiError('network', 'network failed', { module: 'forumindex' }))).toBe(true);
    expect(__private.shouldRetry(new ApiError('proxy_unavailable', 'proxy failed', { module: 'forumindex' }))).toBe(true);
  });
});
