// Discuz mobile API client + mappers (docs/02-API.md).
// Web talks to the local CORS/cookie proxy (npm run proxy); native talks to the
// forum directly and lets the OS manage cookies.
import { Platform } from 'react-native';
import { avatarUrl, stripHtml, excerptText, groupTitleText, timeFromUnix, parseMessage, HOST } from './util';
import type {
  Me, Notice, ForumIndexData, BoardData, ThreadData, ThreadImage,
  UserProfile, CollectionItem, ListResult, Reminder, PMItem, ThreadType, BoardSummary, ForumGroup, BoardSub, SortMode, PinnedItem,
} from './types';

export const PROXY = 'http://localhost:8089';
const BASE = (Platform.OS === 'web' ? PROXY : HOST) + '/api/mobile/index.php';
export function displayImageUrl(src?: string | null): string | null {
  if (!src) return null;
  return Platform.OS === 'web' ? `${PROXY}/__image?url=${encodeURIComponent(src)}` : src;
}

// ---- live session info shared with the UI (current user + unread notice) ----
let me: Me = { uid: '0', username: '', avatar: null };
let notice: Notice = { newpush: '0', newpm: '0', newprompt: '0', newmypost: '0' };
const noticeListeners = new Set<(n: Notice) => void>();
export function subscribeNotice(fn: (n: Notice) => void) { noticeListeners.add(fn); return () => { noticeListeners.delete(fn); }; }
export function getNotice(): Notice { return notice; }
export function getMe(): Me { return me; }

function ingest(v: any) {
  if (!v) return;
  if (v.member_uid != null) me = { uid: v.member_uid, username: v.member_username, avatar: v.member_avatar };
  if (v.notice) { notice = v.notice; noticeListeners.forEach((fn) => fn(notice)); }
}

interface RequestOpts {
  method?: 'GET' | 'POST';
  body?: string | null;
}
async function request(module: string, params: Record<string, any> = {}, { method = 'GET', body = null }: RequestOpts = {}): Promise<any> {
  const qs = new URLSearchParams({ version: '4', module, ...params }).toString();
  const opts: RequestInit = { method, headers: { Accept: 'application/json' } };
  if (Platform.OS === 'web') opts.credentials = 'omit'; // proxy owns the jar
  if (method === 'POST') {
    (opts.headers as Record<string, string>)['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = body;
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}?${qs}`, opts);
  } catch (e) {
    throw new Error(Platform.OS === 'web' ? '无法连接代理（请先运行 npm run proxy）' : '网络连接失败');
  }
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch (e) { throw new Error('服务器返回了非预期内容（可能触发风控）'); }
  ingest(json.Variables);
  return json;
}

// ===================== Auth =====================
export async function login(username: string, password: string): Promise<{ ok: boolean; message: string; user: Me | null }> {
  const pre = await request('login');
  const formhash = pre.Variables?.formhash || '';
  const body = new URLSearchParams({
    username, password, questionid: '0', answer: '', cookietime: '2592000', formhash,
  }).toString();
  const r = await request('login', { loginsubmit: 'yes', loginfield: 'username' }, { method: 'POST', body });
  const ok = r.Message?.messageval === 'login_succeed';
  return { ok, message: r.Message?.messagestr || '', user: ok ? me : null };
}

export async function logout(): Promise<void> {
  try {
    const idx = await request('forumindex');
    const formhash = idx.Variables?.formhash || '';
    await request('logout', { formhash });
  } catch (e) { /* ignore */ }
  if (Platform.OS === 'web') { try { await fetch(`${PROXY}/__reset`); } catch (e) {} }
  me = { uid: '0', username: '', avatar: null };
}

export async function checkAuth(): Promise<string | null> {
  try {
    const r = await request('forumindex');
    return r.Variables?.member_uid && r.Variables.member_uid !== '0' ? r.Variables.member_uid : null;
  } catch (e) { return null; }
}

// ===================== Forum index =====================
export async function getForumIndex(): Promise<ForumIndexData> {
  const v = (await request('forumindex')).Variables || {};
  const forumMap: Record<string, any> = {};
  (v.forumlist || []).forEach((f: any) => { forumMap[f.fid] = f; });
  const mapBoard = (f: any): BoardSummary => ({
    id: f.fid, fid: f.fid, name: f.name,
    desc: stripHtml(f.description || ''),
    today: parseInt(f.todayposts || '0', 10),
    threads: f.threads, posts: f.posts,
    iconUrl: f.icon || null,
    subs: (f.sublist || []).map((s: any) => ({ fid: s.fid, name: s.name, today: parseInt(s.todayposts || '0', 10) })),
  });
  const groups: ForumGroup[] = (v.catlist || []).map((cat: any) => ({
    id: cat.fid, name: cat.name, desc: '',
    boards: (cat.forums || []).map((fid: string) => forumMap[fid]).filter(Boolean).map(mapBoard),
  })).filter((g: ForumGroup) => g.boards.length);
  return { groups, me: { uid: v.member_uid, name: v.member_username, avatar: v.member_avatar } };
}

// ===================== Board (forumdisplay) =====================
// `sort`（排序模式）走 filter/orderby，`typeid`（作品分类标签）是另一维筛选。
// 关键：选中 typeid 时必须同时带一个 filter，typeid 才会真正生效（已对线上 API 验证）。
export async function getBoard(fid: string, page = 1, typeid: string | number = 0, sort: SortMode = '全部'): Promise<BoardData> {
  const params: Record<string, any> = { fid, page };
  const hasType = typeid && typeid !== 0;
  if (hasType) params.typeid = typeid;
  switch (sort) {
    case '最新': params.filter = 'dateline'; params.orderby = 'dateline'; break;
    case '热门': params.filter = 'heat'; break;
    case '精华': params.filter = 'digest'; params.digest = '1'; break;
    default: if (hasType) params.filter = 'typeid'; break; // 全部
  }
  const v = (await request('forumdisplay', params)).Variables || {};
  const tt: Record<string, string> = v.threadtypes?.types || {};
  const types: ThreadType[] = Object.keys(tt).map((id) => ({ id, name: tt[id] }));
  const subs: BoardSub[] = (v.sublist || []).map((s: any) => ({
    fid: s.fid, name: s.name, today: parseInt(s.todayposts || '0', 10), iconUrl: s.icon || null,
  }));
  // 置顶/公告（displayorder>0）单独抽出做 PinnedRow；type 名为「公告」→ notice，其余 → sticky。
  // 它们只在第 1 页（无筛选）出现，所以 hasMore 仍按 raw 总数判断，而非过滤后的列表。
  const raw: any[] = v.forum_threadlist || [];
  const isPinned = (t: any) => parseInt(t.displayorder || '0', 10) > 0;
  const pinned: PinnedItem[] = raw.filter(isPinned).map((t) => ({
    id: t.tid, tid: t.tid, title: stripHtml(t.subject),
    kind: tt[t.typeid] === '公告' ? 'notice' : 'sticky',
  }));
  const list = raw.filter((t) => !isPinned(t)).map((t) => {
    const excerpt = t.message ? excerptText(t.message)
      : (t.reply && t.reply[0] ? excerptText(t.reply[0].message) : '');
    return {
      id: t.tid, tid: t.tid, typeid: t.typeid,
      tag: tt[t.typeid] || '',
      title: stripHtml(t.subject),
      author: { name: t.author, uid: t.authorid },
      time: timeFromUnix(t.dblastpost) || t.lastpost || t.dateline,
      replies: parseInt(t.replies || '0', 10),
      views: t.views,
      pinned: parseInt(t.displayorder || '0', 10) > 0,
      excerpt,
      hasImage: !!(t.attachmentImagePreviewList && t.attachmentImagePreviewList.length),
    };
  });
  const tpp = parseInt(v.tpp || '20', 10);
  const board = {
    fid: v.forum?.fid || fid, name: v.forum?.name || '板块',
    desc: stripHtml(v.forum?.description || ''),
    rules: v.forum?.rules || '',
  };
  return { board, threads: list, pinned, types, subs, page: parseInt(v.page || page, 10), tpp, hasMore: raw.length >= tpp };
}

// ===================== Thread (viewthread) =====================
export async function getThread(tid: string, page: string | number = 1): Promise<ThreadData> {
  const v = (await request('viewthread', { tid, page })).Variables || {};
  const th = v.thread || {};
  const currentPage = parseInt(String(page), 10);
  const ppp = parseInt(v.ppp || '20', 10);
  // Page 1 may prepend a duplicate of the latest reply without `number`.
  // It belongs to a later page and must not interrupt the chronological list.
  const numberedPosts = (v.postlist || []).filter((p: any) => p.number != null);
  const floors = numberedPosts.map((p: any, i: number) => ({
    pid: p.pid,
    floor: parseInt(p.number || p.position || ((currentPage - 1) * ppp + i + 1), 10),
    op: p.first === '1',
    user: { name: p.author, uid: p.authorid, group: '' },
    time: timeFromUnix(p.dbdateline) || p.dateline,
    blocks: parseMessage(p.message, p.attachments, p.imagelist),
  }));
  const images: ThreadImage[] = [];
  floors.forEach((f: any) => f.blocks.forEach((b: any) => { if (b.t === 'img') images.push({ src: b.src, cap: b.cap }); }));
  const op = floors.find((f: any) => f.op) || floors[0] || { user: {}, time: '' };
  const thread = {
    tid, title: stripHtml(th.subject || ''),
    replies: parseInt(th.replies || '0', 10),
    views: th.views,
    pinned: parseInt(th.displayorder || '0', 10) > 0,
    author: op.user,
    time: op.time,
  };
  const totalPages = Math.max(1, Math.ceil((thread.replies + 1) / ppp));
  return { thread, floors, images, ppp, page: currentPage, hasMore: currentPage < totalPages };
}

// ===================== Profile =====================
const GENDER: Record<string, string> = { 1: '男', 2: '女' };
export async function getProfile(uid?: string): Promise<{ user: UserProfile }> {
  const params: Record<string, any> = {};
  if (uid) params.uid = uid;
  const v = (await request('profile', params)).Variables || {};
  const s = v.space || {};
  const user: UserProfile = {
    id: s.uid, uid: s.uid, name: s.username,
    avatar: (s.username || '?')[0],
    group: groupTitleText(s.group) || '会员',
    register: s.regdate ? s.regdate.split(' ')[0] + ' 加入' : '',
    bio: stripHtml(s.bio || '') || '这位同好还没有填写简介。',
    gender: GENDER[s.gender] || '保密',
    constellation: s.constellation || '—',
    location: [s.residecity].filter(Boolean).join(' ') || '—',
    stats: {
      themes: parseInt(s.threads || '0', 10),
      replies: parseInt(s.posts || '0', 10),
      collections: parseInt(s.favtimes || '0', 10),
      follow: parseInt(s.following || '0', 10),
      fans: parseInt(s.follower || '0', 10),
    },
    credits: parseInt(s.credits || '0', 10),
    self: s.self === '1',
  };
  return { user };
}

// ===================== Collections (myfavthread) =====================
export async function getCollections(page = 1): Promise<ListResult<CollectionItem>> {
  const v = (await request('myfavthread', { page })).Variables || {};
  const list: CollectionItem[] = (v.list || []).filter((it: any) => it.idtype === 'tid').map((it: any) => ({
    id: it.id, tid: it.id,
    tag: '收藏',
    title: stripHtml(it.title),
    author: { name: it.author },
    time: timeFromUnix(it.dateline),
    replies: parseInt(it.replies || '0', 10),
    excerpt: '',
  }));
  return { list, count: parseInt(v.count || list.length, 10) };
}

// Own profile with the corrected 收藏 count: space.favtimes counts "favorited by
// others", so the real my-favorites total comes from myfavthread.
export async function getSelfProfile(): Promise<{ user: UserProfile }> {
  const [{ user }, fav] = await Promise.all([
    getProfile(),
    getCollections(1).catch(() => null),
  ]);
  return { user: fav ? { ...user, stats: { ...user.stats, collections: fav.count } } : user };
}

// ===================== Reminders (mynotelist) =====================
const NOTE_LABEL: Record<string, string> = { system: '系统通知', post: '回复提醒', pcomment: '点评提醒', at: '@ 提醒', friend: '好友', follow: '关注', card: '系统通知' };
const NOTE_ICON: Record<string, string> = { system: 'info', post: 'reply', pcomment: 'reply', at: 'at', friend: 'users', follow: 'users' };
export async function getReminders(page = 1): Promise<ListResult<Reminder>> {
  const v = (await request('mynotelist', { page })).Variables || {};
  const list: Reminder[] = (v.list || []).map((it: any) => ({
    id: it.id,
    type: it.type,
    icon: NOTE_ICON[it.type] || 'bell',
    unread: it.new === '1',
    who: NOTE_LABEL[it.type] || '通知',
    text: stripHtml(it.note),
    time: timeFromUnix(it.dateline),
  }));
  return { list, count: parseInt(v.count || list.length, 10) };
}

// ===================== Private messages (mypm) =====================
export async function getPMs(page = 1): Promise<ListResult<PMItem>> {
  const v = (await request('mypm', { page })).Variables || {};
  const list: PMItem[] = (v.list || []).map((it: any) => ({
    id: it.plid || it.pmid || it.touid,
    user: { name: it.tousername || it.msgfromusername || it.author || '对话', uid: it.touid || it.msgfromid },
    last: stripHtml(it.message || it.lastsummary || it.subject || ''),
    time: timeFromUnix(it.lastdateline || it.dateline),
    unread: parseInt(it.isnew || it.new || '0', 10),
  }));
  return { list, count: parseInt(v.count || list.length, 10) };
}

export { avatarUrl };
