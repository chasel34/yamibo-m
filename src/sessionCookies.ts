import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { HOST } from './util';

type NativeCookieManager = typeof import('@preeternal/react-native-cookie-manager').default;

interface StoredDiscuzSession {
  cookiepre: string;
  auth: string;
  saltkey: string;
  savedAt: number;
}

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

async function writeNativeCookies(session: StoredDiscuzSession): Promise<void> {
  const CookieManager = getCookieManager();
  if (!CookieManager) return;

  const expires = new Date(Date.now() + COOKIE_TTL_MS).toISOString();
  await Promise.all([
    CookieManager.set(COOKIE_URL, {
      name: `${session.cookiepre}auth`,
      value: session.auth,
      domain: COOKIE_DOMAIN,
      path: '/',
      version: '1',
      expires,
      secure: true,
      httpOnly: true,
    }),
    CookieManager.set(COOKIE_URL, {
      name: `${session.cookiepre}saltkey`,
      value: session.saltkey,
      domain: COOKIE_DOMAIN,
      path: '/',
      version: '1',
      expires,
      secure: true,
      httpOnly: true,
    }),
  ]);

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

  let session: StoredDiscuzSession | null = null;
  try {
    session = JSON.parse(raw);
  } catch (e) {
    await removeStoredSession();
    return;
  }

  if (!session?.cookiepre || !session.auth || !session.saltkey) {
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

  const session: StoredDiscuzSession = {
    cookiepre: String(v.cookiepre),
    auth: String(v.auth),
    saltkey: String(v.saltkey),
    savedAt: Date.now(),
  };
  const fingerprint = `${session.cookiepre}:${session.auth}:${session.saltkey}`;
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
