import { __private } from '../src/sessionCookies';

const NOW = Date.UTC(2026, 5, 21);

describe('session cookie persistence helpers', () => {
  test('valid stored sessions hydrate when not expired', () => {
    const session = __private.sessionFromPayload({
      cookiepre: 'EeqY_2132_',
      auth: 'secret-auth',
      saltkey: 'secret-salt',
      member_uid: '123',
    }, [{ name: 'EeqY_2132_sid', value: 'sid-value', domain: 'bbs.yamibo.com', path: '/' }], NOW);

    const parsed = __private.parseStoredSession(JSON.stringify(session), NOW + 1000);
    expect(parsed?.cookies.map((cookie) => cookie.name).sort()).toEqual([
      'EeqY_2132_auth',
      'EeqY_2132_saltkey',
      'EeqY_2132_sid',
    ]);
  });

  test('malformed stored JSON is rejected', () => {
    expect(__private.parseStoredSession('{not json', NOW)).toBeNull();
  });

  test('sessions older than the TTL are rejected', () => {
    const old = __private.sessionFromPayload({
      cookiepre: 'EeqY_2132_',
      auth: 'secret-auth',
      saltkey: 'secret-salt',
      member_uid: '123',
    }, [], NOW - __private.COOKIE_TTL_MS - 1);
    expect(__private.parseStoredSession(JSON.stringify(old), NOW)).toBeNull();
  });

  test('legacy auth and saltkey sessions migrate', () => {
    const parsed = __private.parseStoredSession(JSON.stringify({
      cookiepre: 'EeqY_2132_',
      auth: 'legacy-auth',
      saltkey: 'legacy-salt',
      savedAt: NOW,
    }), NOW + 1000);
    expect(parsed?.version).toBe(2);
    expect(parsed?.cookies.map((cookie) => cookie.name).sort()).toEqual(['EeqY_2132_auth', 'EeqY_2132_saltkey']);
  });

  test('only Discuz session and risk-control cookies are preserved', () => {
    const session = __private.sessionFromPayload({
      cookiepre: 'EeqY_2132_',
      auth: 'secret-auth',
      saltkey: 'secret-salt',
      member_uid: '123',
    }, [
      { name: 'acw_tc', value: 'risk', domain: 'bbs.yamibo.com' },
      { name: 'cdn_sec_tc', value: 'cdn', domain: 'bbs.yamibo.com' },
      { name: 'unrelated', value: 'nope', domain: 'bbs.yamibo.com' },
      { name: 'EeqY_2132_sid', value: 'sid', domain: 'example.com' },
    ], NOW);
    expect(session.cookies.map((cookie) => cookie.name).sort()).toEqual([
      'EeqY_2132_auth',
      'EeqY_2132_saltkey',
      'acw_tc',
      'cdn_sec_tc',
    ]);
  });
});
