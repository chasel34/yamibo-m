import {
  compareVersions,
  normalizeVersion,
  parseGithubApkUpdate,
  selectApkAsset,
} from '../src/githubApkUpdates';

describe('GitHub APK update helpers', () => {
  test('normalizes release-style SemVer strings', () => {
    expect(normalizeVersion('v0.1.4')).toBe('0.1.4');
    expect(normalizeVersion('0.1.4')).toBe('0.1.4');
    expect(normalizeVersion('yamibo-m v0.1.4')).toBe('0.1.4');
    expect(normalizeVersion('release candidate')).toBeNull();
  });

  test('compares SemVer versions and rejects invalid values', () => {
    expect(compareVersions('0.1.3', '0.1.4')).toBe(-1);
    expect(compareVersions('0.1.4', 'v0.1.4')).toBe(0);
    expect(compareVersions('0.2.0', '0.1.4')).toBe(1);
    expect(compareVersions('local-dev', '0.1.4')).toBeNull();
  });

  test('selects APK assets by content type or file extension', () => {
    expect(selectApkAsset([
      { name: 'notes.txt', content_type: 'text/plain', browser_download_url: 'https://example.test/notes.txt' },
      { name: 'yamibo-m-v0.1.4.apk', content_type: 'application/octet-stream', browser_download_url: 'https://example.test/app.apk' },
    ])).toMatchObject({ name: 'yamibo-m-v0.1.4.apk' });

    expect(selectApkAsset([
      { name: 'yamibo-m-v0.1.4.bin', content_type: 'application/vnd.android.package-archive', browser_download_url: 'https://example.test/app.bin' },
    ])).toMatchObject({ name: 'yamibo-m-v0.1.4.bin' });

    expect(selectApkAsset([
      { name: 'yamibo-m-v0.1.4.apk', content_type: 'application/vnd.android.package-archive' },
      { name: 'source.zip', content_type: 'application/zip', browser_download_url: 'https://example.test/source.zip' },
    ])).toBeNull();
  });

  test('parses a newer release with an APK asset', () => {
    expect(parseGithubApkUpdate({
      tag_name: 'v0.1.4',
      html_url: 'https://github.com/chasel34/yamibo-m/releases/tag/v0.1.4',
      assets: [
        {
          name: 'yamibo-m-v0.1.4.apk',
          content_type: 'application/vnd.android.package-archive',
          browser_download_url: 'https://github.com/chasel34/yamibo-m/releases/download/v0.1.4/yamibo-m-v0.1.4.apk',
        },
      ],
      body: '本次更新',
    }, '0.1.3')).toMatchObject({
      version: '0.1.4',
      displayVersion: 'v0.1.4',
      assetName: 'yamibo-m-v0.1.4.apk',
      apkUrl: 'https://github.com/chasel34/yamibo-m/releases/download/v0.1.4/yamibo-m-v0.1.4.apk',
    });
  });

  test('does not report unavailable or malformed releases as updates', () => {
    expect(parseGithubApkUpdate({
      tag_name: 'v0.1.4',
      assets: [{ name: 'yamibo-m-v0.1.4.apk', browser_download_url: 'https://example.test/app.apk' }],
    }, '0.1.4')).toBeNull();

    expect(parseGithubApkUpdate({
      tag_name: 'not-a-version',
      assets: [{ name: 'yamibo-m.apk', browser_download_url: 'https://example.test/app.apk' }],
    }, '0.1.3')).toBeNull();

    expect(parseGithubApkUpdate({
      tag_name: 'v0.1.5',
      assets: [{ name: 'source.zip', browser_download_url: 'https://example.test/source.zip' }],
    }, '0.1.4')).toBeNull();

    expect(parseGithubApkUpdate({
      tag_name: 'v0.1.5',
      draft: true,
      assets: [{ name: 'yamibo-m.apk', browser_download_url: 'https://example.test/app.apk' }],
    }, '0.1.4')).toBeNull();
  });
});
