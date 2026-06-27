const {
  isAllowedCorsOrigin,
  isAllowedProxyUrl,
  parseHttpUrl,
  resolveAllowedProxyTarget,
  setCorsHeaders,
} = require('../tools/proxy');

function createMockResponse() {
  const headers = new Map();
  return {
    headers,
    setHeader(name, value) {
      headers.set(name, value);
    },
  };
}

describe('dev proxy URL rules', () => {
  test('allows forum URLs', () => {
    expect(isAllowedProxyUrl('https://bbs.yamibo.com/api/mobile/index.php')).toBe(true);
  });

  test('rejects unrelated public hosts', () => {
    expect(isAllowedProxyUrl('https://example.com/image.png')).toBe(false);
  });

  test('rejects loopback and private-network URLs', () => {
    expect(isAllowedProxyUrl('http://127.0.0.1:8080/secret')).toBe(false);
    expect(isAllowedProxyUrl('http://192.168.1.2/secret')).toBe(false);
  });

  test('malformed URLs are rejected without throwing', () => {
    expect(parseHttpUrl('not a url')).toBeNull();
    expect(isAllowedProxyUrl('not a url')).toBe(false);
  });

  test('resolves normal API forwarding paths to the forum origin', () => {
    const target = resolveAllowedProxyTarget('/api/mobile/index.php?version=4&module=forumindex');
    expect(target && target.origin).toBe('https://bbs.yamibo.com');
    expect(target && target.pathname).toBe('/api/mobile/index.php');
  });

  test('rejects external main forwarding targets', () => {
    expect(resolveAllowedProxyTarget('//example.com/api/mobile/index.php')).toBeNull();
    expect(resolveAllowedProxyTarget('https://example.com/api/mobile/index.php')).toBeNull();
    expect(resolveAllowedProxyTarget('javascript:alert(1)')).toBeNull();
  });

  test('allows loopback web dev origins through CORS on any port', () => {
    for (const origin of ['http://localhost:8081', 'http://127.0.0.1:19006', 'http://[::1]:5173']) {
      const res = createMockResponse();
      setCorsHeaders({ headers: { origin } }, res);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    }
  });

  test('does not allow unrelated web origins through CORS', () => {
    for (const origin of ['http://example.com', 'http://localhost.evil.com:8081']) {
      const res = createMockResponse();
      setCorsHeaders({ headers: { origin } }, res);
      expect(res.headers.has('Access-Control-Allow-Origin')).toBe(false);
    }
  });

  test('validates CORS origins independently from ports', () => {
    expect(isAllowedCorsOrigin('http://localhost:8081')).toBe(true);
    expect(isAllowedCorsOrigin('http://127.0.0.1:12345')).toBe(true);
    expect(isAllowedCorsOrigin('https://localhost:8443')).toBe(true);
    expect(isAllowedCorsOrigin('http://192.168.1.10:8081')).toBe(false);
  });
});
