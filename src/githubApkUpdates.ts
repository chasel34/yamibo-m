export const GITHUB_LATEST_RELEASE_URL = 'https://api.github.com/repos/chasel34/yamibo-m/releases/latest';
const APK_MIME = 'application/vnd.android.package-archive';
const GITHUB_TIMEOUT_MS = 12000;

export interface GithubReleaseAsset {
  name?: unknown;
  content_type?: unknown;
  browser_download_url?: unknown;
  url?: unknown;
}

export interface GithubReleasePayload {
  tag_name?: unknown;
  name?: unknown;
  html_url?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  assets?: unknown;
  body?: unknown;
}

export interface GithubApkUpdate {
  version: string;
  displayVersion: string;
  apkUrl: string;
  releaseUrl: string;
  assetName: string;
  notes?: string;
}

type SemVer = [number, number, number];

export function normalizeVersion(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  const match = raw.match(/(?:^|[^0-9])v?(\d+)\.(\d+)\.(\d+)(?:$|[^0-9])/i) || raw.match(/^v?(\d+)\.(\d+)\.(\d+)$/i);
  if (!match) return null;
  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
}

function parseSemVer(value: unknown): SemVer | null {
  const normalized = normalizeVersion(value);
  if (!normalized) return null;
  const parts = normalized.split('.').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  return [parts[0], parts[1], parts[2]];
}

export function compareVersions(a: unknown, b: unknown): number | null {
  const left = parseSemVer(a);
  const right = parseSemVer(b);
  if (!left || !right) return null;
  for (let i = 0; i < 3; i += 1) {
    if (left[i] < right[i]) return -1;
    if (left[i] > right[i]) return 1;
  }
  return 0;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function selectApkAsset(assets: unknown): GithubReleaseAsset | null {
  if (!Array.isArray(assets)) return null;
  return assets.find((asset) => {
    if (!asset || typeof asset !== 'object') return false;
    const item = asset as GithubReleaseAsset;
    const name = isString(item.name) ? item.name.trim() : '';
    const contentType = isString(item.content_type) ? item.content_type.trim().toLowerCase() : '';
    const apkUrl = isString(item.browser_download_url) ? item.browser_download_url.trim() : '';
    return !!apkUrl && (contentType === APK_MIME || name.toLowerCase().endsWith('.apk'));
  }) as GithubReleaseAsset | undefined || null;
}

export function parseGithubApkUpdate(release: GithubReleasePayload, currentVersion: string): GithubApkUpdate | null {
  if (!release || typeof release !== 'object' || release.draft === true) return null;
  const version = normalizeVersion(release.tag_name);
  if (!version) return null;
  const comparison = compareVersions(currentVersion, version);
  if (comparison == null || comparison >= 0) return null;

  const apkAsset = selectApkAsset(release.assets);
  if (!apkAsset || !isString(apkAsset.browser_download_url)) return null;

  return {
    version,
    displayVersion: `v${version}`,
    apkUrl: apkAsset.browser_download_url.trim(),
    releaseUrl: isString(release.html_url) ? release.html_url.trim() : `https://github.com/chasel34/yamibo-m/releases/tag/v${version}`,
    assetName: isString(apkAsset.name) ? apkAsset.name.trim() : `yamibo-m-v${version}.apk`,
    notes: isString(release.body) ? release.body.trim() : undefined,
  };
}

function timeoutError(): Error {
  const err = new Error('GitHub release request timed out');
  err.name = 'TimeoutError';
  return err;
}

async function fetchJsonWithTimeout(url: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  const Controller = typeof AbortController === 'undefined' ? null : AbortController;
  if (!Controller) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        fetcher(url, { headers: { Accept: 'application/vnd.github+json' } }).then(async (response) => {
          if (!response.ok) throw new Error(`GitHub release request failed: ${response.status}`);
          return response.json();
        }),
        new Promise<unknown>((_resolve, reject) => {
          timer = setTimeout(() => reject(timeoutError()), GITHUB_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const controller = new Controller();
  const timer = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`GitHub release request failed: ${response.status}`);
    return response.json();
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw timeoutError();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkGithubApkUpdate(currentVersion: string): Promise<GithubApkUpdate | null> {
  const release = await fetchJsonWithTimeout(GITHUB_LATEST_RELEASE_URL);
  return parseGithubApkUpdate(release as GithubReleasePayload, currentVersion);
}
