// Local browse history (no server API for this per docs/ROADMAP.md).
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HistoryItem, NavAuthor } from './types';

const KEY = 'yh_history';
const MAX = 40;

interface ThreadLike {
  tid?: string;
  id?: string;
  title?: string;
  author?: NavAuthor;
}

export async function recordThread(thread: ThreadLike): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: HistoryItem[] = raw ? JSON.parse(raw) : [];
    const item: HistoryItem = { tid: (thread.tid || thread.id)!, title: thread.title, author: thread.author, ts: Date.now() };
    const next = [item, ...list.filter((x) => x.tid !== item.tid)].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) { /* ignore */ }
}

export async function getHistory(): Promise<HistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

export async function clearHistory(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch (e) {}
}
