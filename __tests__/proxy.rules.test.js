const { isAllowedProxyUrl, parseHttpUrl } = require('../tools/proxy');

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
});
