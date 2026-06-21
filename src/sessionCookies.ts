import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { HOST } from './util';

type NativeCookieManager = typeof import('@preeternal/react-native-cookie-manager').default;

interface StoredCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  secure?: boolean;
  httpOnly?: boolean;
}

interface StoredDiscuzSessionV1 {
  cookiepre: string;
  auth: string;
  saltkey: string;
  savedAt: number;
}

interface StoredDiscuzSessionV2 {
  version: 2;
  cookiepre: string;
  cookies: StoredCookie[];
  savedAt: number;
}

type StoredDiscuzSession = StoredDiscuzSessionV2;

interface DiscuzVariables {
  cookiepre?: string | null;
  auth?: string | null;
  saltkey?: string | null;
  member_uid?: string | number | null;
}

const STORAGE_KEY = 'yh_discuz_session_cookies';
const LEGACY_ASYNC_STORAGE_KEY = STORAGE_KEY;
const COOKIE_DOMAIN = 'bbs.yamibo.com';
const COOKIE_URL = `${HOST}/`;
const COOKIE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RISK_CONTROL_COOKIES = new Set(['acw_tc', 'cdn_sec_tc']);

let hydrated = Platform.OS === 'web';
let hydrationPromise: Promise<void> | null = null;
let lastPersisted = '';

declare const require: (name: string) => any;

function getCookieManager(): NativeCookieManager | null {
  if (Platform.OS === 'web') return null;
  try {
    const mod = require('@preeternal/react-native-cookie-manager');
    return mod.default || mod;
  } catch (e) {
    return null;
  }
}

function isLoggedInPayload(v?: DiscuzVariables | null): v is Required<Pick<DiscuzVariables, 'cookiepre' | 'auth' | 'saltkey'>> & DiscuzVariables {
  if (!v?.cookiepre || !v.auth || !v.saltkey) return false;
  const uid = String(v.member_uid || '0');
  return uid !== '0';
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isAllowedCookieName(name: string, cookiepre: string): boolean {
  return name === `${cookiepre}auth`
    || name === `${cookiepre}saltkey`
    || name === `${cookiepre}sid`
    || RISK_CONTROL_COOKIES.has(name);
}

function normalizeCookie(raw: any, cookiepre: string): StoredCookie | null {
  if (!isRecord(raw)) return null;
  const name = String(raw.name || '').trim();
  const value = String(raw.value || '');
  if (!name || !value || !isAllowedCookieName(name, cookiepre)) return null;
  const domain = raw.domain == null ? COOKIE_DOMAIN : String(raw.domain);
  if (domain && !domain.endsWith(COOKIE_DOMAIN)) return null;
  return {
    name,
    value,
    domain: domain || COOKIE_DOMAIN,
    path: raw.path == null ? '/' : String(raw.path || '/'),
    expires: raw.expires == null ? undefined : String(raw.expires),
    secure: raw.secure == null ? true : !!raw.secure,
    httpOnly: raw.httpOnly == null ? true : !!raw.httpOnly,
  };
}

function fallbackExpiry(savedAt: number): string {
  return new Date(savedAt + COOKIE_TTL_MS).toISOString();
}

function migrateLegacySession(raw: StoredDiscuzSessionV1): StoredDiscuzSession | null {
  if (!raw.cookiepre || !raw.auth || !raw.saltkey) return null;
  const savedAt = Number(raw.savedAt) || Date.now();
  const expires = fallbackExpiry(savedAt);
  return {
    version: 2,
    cookiepre: String(raw.cookiepre),
    savedAt,
    cookies: [
      { name: `${raw.cookiepre}auth`, value: String(raw.auth), domain: COOKIE_DOMAIN, path: '/', expires, secure: true, httpOnly: true },
      { name: `${raw.cookiepre}saltkey`, value: String(raw.saltkey), domain: COOKIE_DOMAIN, path: '/', expires, secure: true, httpOnly: true },
    ],
  };
}

function parseStoredSession(raw: string, now = Date.now()): StoredDiscuzSession | null {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  const migrated = parsed?.version === 2 ? parsed as StoredDiscuzSession : migrateLegacySession(parsed);
  if (!migrated?.cookiepre || !Array.isArray(migrated.cookies)) return null;
  const savedAt = Number(migrated.savedAt);
  if (!Number.isFinite(savedAt) || now - savedAt > COOKIE_TTL_MS) return null;
  const cookies = migrated.cookies.map((cookie) => normalizeCookie(cookie, migrated.cookiepre)).filter(Boolean) as StoredCookie[];
  const liveCookies = cookies.filter((cookie) => {
    if (!cookie.expires) return true;
    const expiresAt = Date.parse(cookie.expires);
    return !Number.isFinite(expiresAt) || expiresAt > now;
  });
  const hasAuth = liveCookies.some((cookie) => cookie.name === `${migrated.cookiepre}auth`);
  const hasSaltkey = liveCookies.some((cookie) => cookie.name === `${migrated.cookiepre}saltkey`);
  if (!hasAuth || !hasSaltkey) return null;
  return { version: 2, cookiepre: String(migrated.cookiepre), savedAt, cookies: liveCookies };
}

function sessionFingerprint(session: StoredDiscuzSession): string {
  return `${session.cookiepre}:${session.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).sort().join(';')}`;
}

function sessionFromPayload(v: Required<Pick<DiscuzVariables, 'cookiepre' | 'auth' | 'saltkey'>> & DiscuzVariables, extraCookies: StoredCookie[] = [], now = Date.now()): StoredDiscuzSession {
  const cookiepre = String(v.cookiepre);
  const expires = fallbackExpiry(now);
  const base = [
    { name: `${cookiepre}auth`, value: String(v.auth), domain: COOKIE_DOMAIN, path: '/', expires, secure: true, httpOnly: true },
    { name: `${cookiepre}saltkey`, value: String(v.saltkey), domain: COOKIE_DOMAIN, path: '/', expires, secure: true, httpOnly: true },
  ];
  const cookiesByName = new Map<string, StoredCookie>();
  [...base, ...extraCookies].forEach((cookie) => {
    const normalized = normalizeCookie(cookie, cookiepre);
    if (normalized) cookiesByName.set(normalized.name, normalized);
  });
  return { version: 2, cookiepre, cookies: Array.from(cookiesByName.values()), savedAt: now };
}

async function readNativeCookies(cookiepre: string): Promise<StoredCookie[]> {
  const CookieManager = getCookieManager();
  if (!CookieManager || typeof (CookieManager as any).get !== 'function') return [];
  try {
    const raw = await (CookieManager as any).get(COOKIE_URL);
    if (!isRecord(raw)) return [];
    return Object.keys(raw).flatMap((name) => {
      const value = raw[name];
      const cookie = isRecord(value) ? { ...value, name: value.name || name } : { name, value: String(value || '') };
      const normalized = normalizeCookie(cookie, cookiepre);
      return normalized ? [normalized] : [];
    });
  } catch (e) {
    return [];
  }
}

async function writeNativeCookies(session: StoredDiscuzSession): Promise<void> {
  const CookieManager = getCookieManager();
  if (!CookieManager) return;

  await Promise.all(session.cookies.map((cookie) => CookieManager.set(COOKIE_URL, {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain || COOKIE_DOMAIN,
    path: cookie.path || '/',
    version: '1',
    expires: cookie.expires,
    secure: cookie.secure !== false,
    httpOnly: cookie.httpOnly !== false,
  })));

  if (Platform.OS === 'android') await CookieManager.flush();
}

async function readStoredSession(): Promise<string | null> {
  const secureValue = await SecureStore.getItemAsync(STORAGE_KEY);
  if (secureValue) return secureValue;

  const legacyValue = await AsyncStorage.getItem(LEGACY_ASYNC_STORAGE_KEY);
  if (legacyValue) {
    await SecureStore.setItemAsync(STORAGE_KEY, legacyValue);
    await AsyncStorage.removeItem(LEGACY_ASYNC_STORAGE_KEY);
  }
  return legacyValue;
}

async function writeStoredSession(session: StoredDiscuzSession): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(session));
  await AsyncStorage.removeItem(LEGACY_ASYNC_STORAGE_KEY);
}

async function removeStoredSession(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
  await AsyncStorage.removeItem(LEGACY_ASYNC_STORAGE_KEY);
}

async function hydrateStoredSession(): Promise<void> {
  const raw = await readStoredSession();
  if (!raw) return;

  const session = parseStoredSession(raw);
  if (!session) {
    await removeStoredSession();
    return;
  }

  await writeNativeCookies(session);
}

export async function hydrateSessionCookies(): Promise<void> {
  if (hydrated) return;
  if (!hydrationPromise) {
    hydrationPromise = hydrateStoredSession().then(
      () => { hydrated = true; },
      (e) => {
        hydrationPromise = null;
        throw e;
      },
    );
  }
  await hydrationPromise;
}

export async function persistSessionCookies(v?: DiscuzVariables | null): Promise<void> {
  if (Platform.OS === 'web' || !isLoggedInPayload(v)) return;

  const session = sessionFromPayload(v, await readNativeCookies(String(v.cookiepre)));
  const fingerprint = sessionFingerprint(session);
  if (fingerprint === lastPersisted) return;

  await writeStoredSession(session);
  await writeNativeCookies(session);
  lastPersisted = fingerprint;
}

export async function clearSessionCookies(): Promise<void> {
  if (Platform.OS === 'web') return;

  await removeStoredSession();
  lastPersisted = '';
  hydrated = true;
  hydrationPromise = null;

  const CookieManager = getCookieManager();
  if (!CookieManager) return;
  await CookieManager.clearAll(false);
  if (Platform.OS === 'ios') await CookieManager.clearAll(true);
  if (Platform.OS === 'android') await CookieManager.flush();
}

export const __private = {
  COOKIE_TTL_MS,
  isAllowedCookieName,
  normalizeCookie,
  parseStoredSession,
  sessionFromPayload,
  sessionFingerprint,
};
