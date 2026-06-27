// Discuz mobile API client + mappers (docs/API.md).
// Web talks to the local CORS/cookie proxy (npm run proxy); native talks to the
// forum directly and lets the OS manage cookies.
import { Platform } from 'react-native';
import { avatarUrl, stripHtml, excerptText, groupTitleText, timeFromUnix, parseMessage, HOST } from './util';
import { clearSessionCookies, hydrateSessionCookies, persistSessionCookies } from './sessionCookies';
import type {
  Me, Notice, ForumIndexData, BoardData, ThreadData, ThreadImage,
  UserProfile, CollectionItem, ListResult, Reminder, PMItem, ThreadType, BoardSummary, ForumGroup, BoardSub, SortMode, PinnedItem,
  ReadingStreamPage, ReadingComment,
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

function isRecord(value: any): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: any): Record<string, any> {
  return isRecord(value) ? value : {};
}

function asArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: any, fallback = ''): string {
  if (value == null) return fallback;
  return String(value);
}

function asInt(value: any, fallback = 0): number {
  const n = parseInt(asString(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

function asPositiveInt(value: any, fallback: number): number {
  const n = asInt(value, fallback);
  return n > 0 ? n : fallback;
}

function variablesOf(response: any): Record<string, any> {
  return asRecord(response?.Variables);
}

function paginationFor(v: Record<string, any>, listLength: number, page: number): Pick<ListResult<unknown>, 'count' | 'page' | 'perpage' | 'totalPages'> {
  const count = asInt(v.count, listLength);
  const perpage = asPositiveInt(v.perpage, listLength || 20);
  return {
    count,
    page: asPositiveInt(v.page, page),
    perpage,
    totalPages: count > 0 ? Math.max(1, Math.ceil(count / perpage)) : 1,
  };
}

function ingest(raw: any) {
  const v = asRecord(raw);
  if (!Object.keys(v).length) return;
  if (v.member_uid != null) me = {
    uid: asString(v.member_uid, '0'),
    username: asString(v.member_username),
    avatar: v.member_avatar == null ? null : asString(v.member_avatar),
  };
  const n = asRecord(v.notice);
  if (Object.keys(n).length) {
    notice = {
      newpush: asString(n.newpush, '0'),
      newpm: asString(n.newpm, '0'),
      newprompt: asString(n.newprompt, '0'),
      newmypost: asString(n.newmypost, '0'),
    };
    noticeListeners.forEach((fn) => fn(notice));
  }
}

interface RequestOpts {
  method?: 'GET' | 'POST';
  body?: string | null;
}

export type ApiErrorCode =
  | 'proxy_unavailable'
  | 'network'
  | 'http'
  | 'non_json'
  | 'risk_control'
  | 'rate_limited'
  | 'auth_expired'
  | 'business'
  | 'unknown';

export class ApiError extends Error {
  code: ApiErrorCode;
  module: string;
  status?: number;
  messageval?: string;
  snippet?: string;

  constructor(code: ApiErrorCode, message: string, details: { module: string; status?: number; messageval?: string; snippet?: string }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.module = details.module;
    this.status = details.status;
    this.messageval = details.messageval;
    this.snippet = details.snippet;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function snippet(text?: string | null): string {
  return stripHtml(String(text || '')).replace(/\s+/g, ' ').trim().slice(0, 220);
}

function looksRateLimited(text: string): boolean {
  return /429|too many|rate.?limit|frequency|访问过于频繁|请求过于频繁|操作太快|稍后再试/i.test(text);
}

function looksRiskControl(text: string): boolean {
  return /acw_tc|cdn_sec_tc|ESA|Access Denied|captcha|seccode|安全验证|访问验证|人机验证|防火墙|WAF|blocked|拦截/i.test(text);
}

function messageText(message?: any): string {
  return String(message?.messagestr || message?.messageval || '');
}

function messageCode(message?: any): string {
  return String(message?.messageval || '');
}

const SUCCESS_MESSAGES = new Set(['login_succeed', 'logout_succeed', 'favorite_do_success', 'favorite_repeat']);
const API_TIMEOUT_MS = 15000;
const HTML_TIMEOUT_MS = 20000;

class TimeoutError extends Error {
  constructor() {
    super('request timed out');
    this.name = 'TimeoutError';
  }
}

function timeoutError(): TimeoutError {
  return new TimeoutError();
}

function isTimeoutError(err: unknown): boolean {
  return err instanceof TimeoutError || (err instanceof Error && err.name === 'TimeoutError');
}

async function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init: RequestInit = {},
  timeoutMs = API_TIMEOUT_MS,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const externalSignal = init.signal;
  const Controller = typeof AbortController === 'undefined' ? null : AbortController;
  let timedOut = false;

  if (!Controller) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        fetcher(input, init),
        new Promise<Response>((_resolve, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            reject(timeoutError());
          }, timeoutMs);
        }),
      ]);
    } catch (e) {
      if (timedOut) throw timeoutError();
      throw e;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const controller = new Controller();
  const abortFromExternal = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener?.('abort', abortFromExternal, { once: true });

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } catch (e) {
    if (timedOut) throw timeoutError();
    throw e;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener?.('abort', abortFromExternal);
  }
}

function apiNetworkError(module: string, timedOut: boolean): ApiError {
  return new ApiError(
    Platform.OS === 'web' ? 'proxy_unavailable' : 'network',
    timedOut
      ? (Platform.OS === 'web' ? '请求超时，请确认本地代理仍在运行后重试' : '请求超时，请检查网络后重试')
      : (Platform.OS === 'web' ? '无法连接本地代理，请确认 npm run proxy 正在运行' : '网络连接失败，请稍后重试'),
    { module },
  );
}

function businessMessage(val: string, text: string): string {
  const raw = `${val} ${text}`;
  if (/space_does_not_exist/i.test(raw)) return '用户不存在或资料不可见';
  if (/thread_nonexistence/i.test(raw)) return '帖子不存在或已被删除';
  if (/forum_nonexistence/i.test(raw)) return '板块不存在或不可访问';
  if (/favorite_cannot_favorite/i.test(raw)) return '暂时无法收藏这个帖子';
  if (/favorite_does_not_exist/i.test(raw)) return '这个收藏已经不存在';
  if (/undefined_action|not_found/i.test(raw)) return '请求的内容不存在';

  const clean = stripHtml(text);
  if (clean && !/^mobile:[a-z0-9_./-]+$/i.test(clean)) return clean;
  return '请求失败，请稍后再试';
}

function classifyMessage(module: string, message?: any): ApiError | null {
  const val = messageCode(message);
  if (!val || SUCCESS_MESSAGES.has(val)) return null;

  const text = messageText(message);
  const raw = `${val} ${text}`;
  if (looksRateLimited(raw) || /login_strike|attempt/i.test(raw)) {
    return new ApiError('rate_limited', '访问太频繁了，请稍后再试', { module, messageval: val, snippet: snippet(text) });
  }
  if (looksRiskControl(raw) || /seccode|secqaa/i.test(raw)) {
    return new ApiError('risk_control', '站点要求安全验证，请稍后重试或到网页端完成验证', { module, messageval: val, snippet: snippet(text) });
  }
  if (/login_before_enter_home|not_logged|notlogin|login_required|viewperm_login_nopermission|no_privilege|nopermission|未登录|请先登录|没有权限/i.test(raw)) {
    return new ApiError('auth_expired', '登录状态已失效或没有访问权限，请重新登录后再试', { module, messageval: val, snippet: snippet(text) });
  }
  return new ApiError('business', businessMessage(val, text), { module, messageval: val, snippet: snippet(text) });
}

function shouldCheckBusinessMessage(module: string): boolean {
  // Login failures are rendered by LoginScreen.loginError(), so keep returning
  // the raw Discuz message there instead of converting it to an exception.
  return module !== 'login';
}

function shouldRetry(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.code === 'network' || err.code === 'proxy_unavailable') return true;
  if (err.code === 'http') return err.status === 502 || err.status === 503 || err.status === 504;
  return err.code === 'non_json';
}

async function requestOnce(module: string, params: Record<string, any>, { method = 'GET', body = null }: RequestOpts): Promise<any> {
  try { await hydrateSessionCookies(); } catch (e) {}
  const qs = new URLSearchParams({ version: '4', module, ...params }).toString();
  const opts: RequestInit = { method, headers: { Accept: 'application/json' } };
  if (Platform.OS === 'web') opts.credentials = 'omit'; // proxy owns the jar
  if (method === 'POST') {
    (opts.headers as Record<string, string>)['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = body;
  }
  let res: Response;
  try {
    res = await fetchWithTimeout(`${BASE}?${qs}`, opts, API_TIMEOUT_MS);
  } catch (e) {
    throw apiNetworkError(module, isTimeoutError(e));
  }
  const text = await res.text();
  if (!res.ok) {
    const bodySnippet = snippet(text);
    if (res.status === 429 || looksRateLimited(text)) {
      throw new ApiError('rate_limited', '访问太频繁了，请稍后再试', { module, status: res.status, snippet: bodySnippet });
    }
    throw new ApiError('http', `服务器暂时不可用（${res.status}），请稍后重试`, { module, status: res.status, snippet: bodySnippet });
  }
  let json: any;
  try {
    json = JSON.parse(text);
  } catch (e) {
    const bodySnippet = snippet(text);
    if (looksRiskControl(text)) {
      throw new ApiError('risk_control', '站点触发安全验证，请稍后重试', { module, snippet: bodySnippet });
    }
    throw new ApiError('non_json', '服务器返回了非预期内容，请稍后重试', { module, snippet: bodySnippet });
  }
  if (!json || typeof json !== 'object') {
    throw new ApiError('unknown', '服务器返回了非预期内容，请稍后重试', { module, snippet: snippet(text) });
  }
  if (!('Variables' in json) || !isRecord(json.Variables)) {
    throw new ApiError('unknown', '服务器返回缺少必要字段，请稍后重试', { module, snippet: snippet(text) });
  }
  ingest(json.Variables);
  try { await persistSessionCookies(json.Variables); } catch (e) {}
  const messageError = shouldCheckBusinessMessage(module) ? classifyMessage(module, json.Message) : null;
  if (messageError) throw messageError;
  return json;
}

async function request(module: string, params: Record<string, any> = {}, opts: RequestOpts = {}): Promise<any> {
  try {
    return await requestOnce(module, params, opts);
  } catch (e) {
    if ((opts.method || 'GET') === 'GET' && shouldRetry(e)) {
      await sleep(600);
      return requestOnce(module, params, opts);
    }
    throw e;
  }
}

// ===================== Auth =====================
export async function login(username: string, password: string): Promise<{ ok: boolean; message: string; user: Me | null }> {
  const pre = await request('login');
  const formhash = asString(pre.Variables?.formhash);
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
    const formhash = asString(idx.Variables?.formhash);
    await request('logout', { formhash });
  } catch (e) { /* ignore */ }
  if (Platform.OS === 'web') { try { await fetch(`${PROXY}/__reset`); } catch (e) {} }
  else { try { await clearSessionCookies(); } catch (e) {} }
  me = { uid: '0', username: '', avatar: null };
}

export async function checkAuth(): Promise<string | null> {
  try {
    const r = await request('forumindex');
    const uid = asString(r.Variables?.member_uid);
    return uid && uid !== '0' ? uid : null;
  } catch (e) { return null; }
}

// ===================== Forum index =====================
export async function getForumIndex(): Promise<ForumIndexData> {
  const v = variablesOf(await request('forumindex'));
  const forumMap: Record<string, any> = {};
  asArray(v.forumlist).forEach((raw: any) => {
    const f = asRecord(raw);
    const fid = asString(f.fid);
    if (fid) forumMap[fid] = f;
  });
  const mapBoard = (raw: any): BoardSummary => {
    const f = asRecord(raw);
    return {
      id: asString(f.fid), fid: asString(f.fid), name: asString(f.name, '未命名板块'),
      desc: stripHtml(f.description),
      today: asInt(f.todayposts),
      threads: f.threads == null ? undefined : asString(f.threads),
      posts: f.posts == null ? undefined : asString(f.posts),
      iconUrl: f.icon ? asString(f.icon) : null,
      subs: asArray(f.sublist).map((rawSub: any) => {
        const s = asRecord(rawSub);
        return { fid: asString(s.fid), name: asString(s.name, '子版块'), today: asInt(s.todayposts), iconUrl: s.icon ? asString(s.icon) : null };
      }).filter((s) => s.fid),
    };
  };
  const groups: ForumGroup[] = asArray(v.catlist).map((rawCat: any) => {
    const cat = asRecord(rawCat);
    return {
      id: asString(cat.fid), name: asString(cat.name, '分区'), desc: '',
      boards: asArray(cat.forums).map((fid: any) => forumMap[asString(fid)]).filter(Boolean).map(mapBoard),
    };
  }).filter((g: ForumGroup) => g.boards.length);
  return { groups, me: { uid: asString(v.member_uid), name: asString(v.member_username), avatar: asString(v.member_avatar) } };
}

// ===================== Board (forumdisplay) =====================
// `sort`（排序模式）走 filter/orderby，`typeid`（作品分类标签）是另一维筛选。
// 关键：选中 typeid 时必须同时带一个 filter，typeid 才会真正生效（已对线上 API 验证）。
export async function getBoard(fid: string, page = 1, typeid: string | number = 0, sort: SortMode = '全部'): Promise<BoardData> {
  const params: Record<string, any> = { fid, page };
  const hasType = typeid != null && asString(typeid) !== '' && asString(typeid) !== '0';
  if (hasType) params.typeid = typeid;
  switch (sort) {
    case '最新': params.filter = 'dateline'; params.orderby = 'dateline'; break;
    case '热门': params.filter = 'heat'; break;
    case '精华': params.filter = 'digest'; params.digest = '1'; break;
    default: if (hasType) params.filter = 'typeid'; break; // 全部
  }
  const v = variablesOf(await request('forumdisplay', params));
  return mapBoardData(v, fid, page);
}

function mapBoardData(v: Record<string, any>, fid: string, page = 1): BoardData {
  const tt: Record<string, any> = asRecord(asRecord(v.threadtypes).types);
  const types: ThreadType[] = Object.keys(tt).map((id) => ({ id, name: asString(tt[id]) })).filter((it) => it.name);
  const subs: BoardSub[] = asArray(v.sublist).map((rawSub: any) => {
    const s = asRecord(rawSub);
    return { fid: asString(s.fid), name: asString(s.name, '子版块'), today: asInt(s.todayposts), iconUrl: s.icon ? asString(s.icon) : null };
  }).filter((s) => s.fid);
  // 置顶/公告（displayorder>0）单独抽出做 PinnedRow；type 名为「公告」→ notice，其余 → sticky。
  // 它们只在第 1 页（无筛选）出现，所以 hasMore 仍按 raw 总数判断，而非过滤后的列表。
  const raw: any[] = asArray(v.forum_threadlist).map(asRecord);
  const isPinned = (t: any) => asInt(t.displayorder) > 0;
  const pinned: PinnedItem[] = raw.filter(isPinned).map((t) => ({
    id: asString(t.tid), tid: asString(t.tid), title: stripHtml(t.subject),
    kind: asString(tt[asString(t.typeid)]) === '公告' ? 'notice' : 'sticky',
  }));
  const list = raw.filter((t) => !isPinned(t)).map((t) => {
    const excerpt = t.message ? excerptText(t.message)
      : (asArray(t.reply)[0] ? excerptText(asRecord(asArray(t.reply)[0]).message) : '');
    return {
      id: asString(t.tid), tid: asString(t.tid), typeid: t.typeid == null ? undefined : asString(t.typeid),
      tag: asString(tt[asString(t.typeid)]),
      title: stripHtml(t.subject),
      author: { name: asString(t.author), uid: asString(t.authorid) },
      time: timeFromUnix(t.dblastpost) || asString(t.lastpost) || asString(t.dateline),
      replies: asInt(t.replies),
      views: t.views == null ? undefined : asString(t.views),
      pinned: asInt(t.displayorder) > 0,
      excerpt,
      hasImage: asArray(t.attachmentImagePreviewList).length > 0,
    };
  });
  const tpp = asPositiveInt(v.tpp, 20);
  const forum = asRecord(v.forum);
  const board = {
    fid: asString(forum.fid, fid), name: asString(forum.name, '板块'),
    desc: stripHtml(forum.description),
    rules: asString(forum.rules),
  };
  const curPage = asInt(v.page, page);
  const hasMore = raw.length >= tpp;
  // forum.threadcount 是「按当前筛选」返回的总主题数（无筛选时等于板块总数 forum.threads，
  // 选作品分类(typeid)/精华/热门 等会收窄时同步变小，已对线上 API 验证）→ 用它算总页数对所有
  // 筛选都准确；两者皆缺失时回退到「当前页 + 是否还有下一页」的渐进式判断。
  const totalThreads = asInt(forum.threadcount || forum.threads);
  const totalPages = totalThreads > 0 ? Math.max(1, Math.ceil(totalThreads / tpp)) : curPage + (hasMore ? 1 : 0);
  return { board, threads: list, pinned, types, subs, page: curPage, tpp, hasMore, totalPages, totalThreads };
}

// ===================== Thread (viewthread) =====================
export async function getThread(tid: string, page: string | number = 1, authorid?: string): Promise<ThreadData> {
  const params: Record<string, any> = { tid, page };
  if (authorid) params.authorid = authorid;
  const v = variablesOf(await request('viewthread', params));
  const th = asRecord(v.thread);
  const currentPage = asInt(page, 1);
  const ppp = asPositiveInt(v.ppp, 20);
  // Page 1 may prepend a duplicate of the latest reply without `number`.
  // It belongs to a later page and must not interrupt the chronological list.
  const numberedPosts = asArray(v.postlist).map(asRecord).filter((p: any) => p.number != null);
  const floors = numberedPosts.map((p: any, i: number) => ({
    pid: p.pid == null ? undefined : asString(p.pid),
    floor: asInt(p.number || p.position, (currentPage - 1) * ppp + i + 1),
    op: p.first === '1',
    user: { name: asString(p.author), uid: asString(p.authorid), group: '' },
    time: timeFromUnix(p.dbdateline) || asString(p.dateline),
    blocks: parseMessage(p.message, isRecord(p.attachments) ? p.attachments : null, asArray(p.imagelist).map((id) => asString(id))),
  }));
  const images: ThreadImage[] = [];
  floors.forEach((f: any) => f.blocks.forEach((b: any) => { if (b.t === 'img') images.push({ src: b.src, cap: b.cap }); }));
  const op = floors.find((f: any) => f.op) || floors[0] || { user: {}, time: '' };
  const author = {
    name: asString(th.author || th.username, op.user.name),
    uid: asString(th.authorid, op.user.uid),
    group: op.user.group || '',
  };
  const threadDateline = asString(th.dateline);
  const threadTime = timeFromUnix(th.dbdateline || (/^\d+$/.test(threadDateline) ? threadDateline : null)) || threadDateline || op.time;
  const thread = {
    tid, fid: asString(v.fid || th.fid), title: stripHtml(th.subject),
    replies: asInt(th.replies),
    views: th.views == null ? undefined : asString(th.views),
    pinned: asInt(th.displayorder) > 0,
    author,
    time: threadTime,
  };
  const totalPages = Math.max(1, Math.ceil((thread.replies + 1) / ppp));
  return { thread, floors, images, ppp, page: currentPage, hasMore: currentPage < totalPages, totalPages };
}

export async function getReadingStream(tid: string, authorid: string, page = 1): Promise<ReadingStreamPage> {
  const v = variablesOf(await request('viewthread', { tid, authorid, page }));
  const th = asRecord(v.thread);
  const ppp = asPositiveInt(v.ppp, 20);
  const replies = asInt(th.replies);
  const postlist = asArray(v.postlist).map(asRecord);
  const posts = postlist.filter((p: any) => p.number != null).map((p: any) => ({
    pid: asString(p.pid),
    number: asInt(p.number || p.position),
    pos: asInt(p.position || p.number),
    blocks: parseMessage(p.message, isRecord(p.attachments) ? p.attachments : null, asArray(p.imagelist).map((id) => asString(id))),
  }));
  const op = postlist.find((p: any) => p.first === '1') || postlist[0] || {};
  return {
    tid,
    fid: asString(v.fid || th.fid),
    title: stripHtml(th.subject || ''),
    author: { name: asString(op.author), uid: asString(op.authorid) },
    posts,
    page,
    ppp,
    totalPages: Math.max(1, Math.ceil((replies + 1) / ppp)),
  };
}

export async function resolvePostPage(tid: string, pid: string): Promise<number> {
  const target = `${HOST}/forum.php?mod=redirect&goto=findpost&ptid=${encodeURIComponent(tid)}&pid=${encodeURIComponent(pid)}`;
  try {
    if (Platform.OS === 'web') {
      const res = await fetchWithTimeout(`${PROXY}/__resolve?url=${encodeURIComponent(target)}`, {}, HTML_TIMEOUT_MS);
      if (!res.ok) throw new Error('无法定位章节评论');
      const data = await res.json();
      const match = String(data.url || '').match(/[?&]page=(\d+)/);
      if (!match) throw new Error('无法定位章节评论');
      return parseInt(match[1], 10);
    }
    const res = await fetchWithTimeout(target, { redirect: 'follow' }, HTML_TIMEOUT_MS);
    const match = String(res.url || '').match(/[?&]page=(\d+)/);
    if (!match) throw new Error('无法定位章节评论');
    return parseInt(match[1], 10);
  } catch (e) {
    if (isTimeoutError(e)) throw new Error('定位请求超时，请稍后重试');
    throw e;
  }
}

export async function getChapterComments(tid: string, pid: string, authorid: string, pageHint?: number): Promise<ReadingComment[]> {
  // Prefer the caller's page hint (derived from the post's unfiltered floor position)
  // to skip the findpost redirect round-trip; fall back to resolving when absent.
  let page = pageHint && pageHint > 0 ? pageHint : await resolvePostPage(tid, pid);
  const out: ReadingComment[] = [];
  let foundChapter = false;
  while (true) {
    const v = variablesOf(await request('viewthread', { tid, page }));
    const posts = asArray(v.postlist).map(asRecord).filter((p: any) => p.number != null);
    const ppp = asPositiveInt(v.ppp, 20);
    const replies = asInt(asRecord(v.thread).replies);
    const totalPages = Math.max(1, Math.ceil((replies + 1) / ppp));
    let start = 0;
    if (!foundChapter) {
      const index = posts.findIndex((p: any) => String(p.pid) === pid);
      if (index < 0) return [];
      foundChapter = true;
      start = index + 1;
    }
    for (let i = start; i < posts.length; i += 1) {
      const p = posts[i];
      if (String(p.authorid) === authorid) return out;
      out.push({
        id: asString(p.pid, `${page}-${i}`),
        user: { name: asString(p.author), uid: asString(p.authorid) },
        time: timeFromUnix(p.dbdateline) || asString(p.dateline),
        text: stripHtml(p.message || ''),
      });
    }
    if (page >= totalPages) return out;
    page += 1;
  }
}

// ===================== Profile =====================
const GENDER: Record<string, string> = { 1: '男', 2: '女' };
export async function getProfile(uid?: string): Promise<{ user: UserProfile }> {
  const params: Record<string, any> = {};
  if (uid) params.uid = uid;
  const v = variablesOf(await request('profile', params));
  const s = asRecord(v.space);
  const user: UserProfile = {
    id: asString(s.uid), uid: asString(s.uid), name: asString(s.username),
    avatar: (asString(s.username, '?'))[0],
    group: groupTitleText(s.group) || '会员',
    register: s.regdate ? asString(s.regdate).split(' ')[0] + ' 加入' : '',
    bio: stripHtml(s.bio) || '这位同好还没有填写简介。',
    gender: GENDER[asString(s.gender)] || '保密',
    constellation: asString(s.constellation, '—'),
    location: [asString(s.residecity)].filter(Boolean).join(' ') || '—',
    stats: {
      themes: asInt(s.threads),
      replies: asInt(s.posts),
      collections: asInt(s.favtimes),
      follow: asInt(s.following),
      fans: asInt(s.follower),
    },
    credits: asInt(s.credits),
    self: s.self === '1',
  };
  return { user };
}

// ===================== Collections (myfavthread) =====================
type ThreadFavoriteState = { favorited: boolean; favid?: string };
const FAVORITE_LOOKUP_PAGE_LIMIT = 3;
const favoriteByTid = new Map<string, ThreadFavoriteState>();
const observedFavoritePages = new Set<number>();
let favoriteTotalPages: number | undefined;

function normalizeFavoriteState(state: ThreadFavoriteState): ThreadFavoriteState {
  return state.favorited ? { favorited: true, favid: state.favid } : { favorited: false };
}

function rememberFavoriteState(tid: string, state: ThreadFavoriteState): ThreadFavoriteState {
  const normalized = normalizeFavoriteState(state);
  if (tid) favoriteByTid.set(tid, normalized);
  return normalized;
}

function rememberFavoritePage(result: ListResult<CollectionItem>): void {
  observedFavoritePages.add(result.page);
  favoriteTotalPages = result.totalPages;
  result.list.forEach((item) => {
    rememberFavoriteState(item.tid, { favorited: true, favid: item.favid });
  });
}

function favoriteScanLimit(totalPages: number, fullScan?: boolean): number {
  return fullScan ? totalPages : Math.min(totalPages, FAVORITE_LOOKUP_PAGE_LIMIT);
}

function cachedFavoriteState(tid: string, fullScan?: boolean): ThreadFavoriteState | null {
  const cached = favoriteByTid.get(tid);
  if (!cached) return null;
  if (!fullScan || (cached.favorited && cached.favid)) return { ...cached };
  return null;
}

function clearFavoriteIndexForTests(): void {
  favoriteByTid.clear();
  observedFavoritePages.clear();
  favoriteTotalPages = undefined;
}

function favoriteIndexSnapshotForTests() {
  return {
    states: Array.from(favoriteByTid.entries()),
    observedPages: Array.from(observedFavoritePages.values()).sort((a, b) => a - b),
    totalPages: favoriteTotalPages,
  };
}

export async function getCollections(page = 1): Promise<ListResult<CollectionItem>> {
  const v = variablesOf(await request('myfavthread', { page }));
  const result = mapCollections(v, page);
  rememberFavoritePage(result);
  return result;
}

function mapCollections(v: Record<string, any>, page = 1): ListResult<CollectionItem> {
  const list: CollectionItem[] = asArray(v.list).map(asRecord).filter((it: any) => it.idtype === 'tid').map((it: any) => ({
    id: asString(it.id), tid: asString(it.id), favid: asString(it.favid) || undefined,
    tag: '收藏',
    title: stripHtml(it.title),
    author: { name: asString(it.author) },
    time: timeFromUnix(it.dateline),
    replies: asInt(it.replies),
    excerpt: '',
  }));
  return { list, ...paginationFor(v, list.length, page) };
}

export async function getThreadFavorite(tid: string, opts: { fullScan?: boolean } = {}): Promise<{ favorited: boolean; favid?: string }> {
  const cached = cachedFavoriteState(tid, opts.fullScan);
  if (cached) return cached;

  let page = 1;
  while (true) {
    const v = variablesOf(await request('myfavthread', { page }));
    const result = mapCollections(v, page);
    rememberFavoritePage(result);
    const found = result.list.find((it) => it.tid === tid);
    if (found) return rememberFavoriteState(tid, { favorited: true, favid: found.favid });
    const totalPages = result.totalPages || page;
    const scanLimit = favoriteScanLimit(totalPages, opts.fullScan);
    if (page >= scanLimit || result.list.length === 0) break;
    page += 1;
  }
  return rememberFavoriteState(tid, { favorited: false });
}

async function currentFormhash(): Promise<string> {
  return asString(variablesOf(await request('forumindex')).formhash);
}

export async function addThreadFavorite(tid: string): Promise<{ favorited: true; favid?: string; message: string }> {
  const formhash = await currentFormhash();
  const r = await request('favthread', { id: tid, idtype: 'tid', formhash }, { method: 'POST', body: '' });
  const val = messageCode(r.Message);
  const favorite = await getThreadFavorite(tid, { fullScan: true })
    .catch(() => rememberFavoriteState(tid, { favorited: true }));
  const next = favorite.favorited ? favorite : rememberFavoriteState(tid, { favorited: true });
  return {
    favorited: true,
    favid: next.favid,
    message: val === 'favorite_repeat' ? '已经收藏过了' : '已收藏',
  };
}

export async function removeThreadFavorite(tid: string, favid?: string): Promise<{ favorited: false; message: string }> {
  const favorite = favid ? { favorited: true, favid } : await getThreadFavorite(tid, { fullScan: true });
  if (!favorite.favid) {
    rememberFavoriteState(tid, { favorited: false });
    return { favorited: false, message: '已取消收藏' };
  }

  const formhash = await currentFormhash();
  const url = `${Platform.OS === 'web' ? PROXY : HOST}/home.php?mod=spacecp&ac=favorite&op=delete&favid=${encodeURIComponent(favorite.favid)}`;
  const body = new URLSearchParams({ deletesubmit: 'true', formhash }).toString();
  let res: Response;
  try {
    res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { Accept: 'text/html,*/*', 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      credentials: Platform.OS === 'web' ? 'omit' : undefined,
    } as RequestInit, HTML_TIMEOUT_MS);
  } catch (e) {
    throw apiNetworkError('favorite_delete', isTimeoutError(e));
  }
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError('http', `服务器暂时不可用（${res.status}），请稍后重试`, { module: 'favorite_delete', status: res.status, snippet: snippet(text) });
  }
  if (/操作成功|favorite_delete_succeed|删除成功/i.test(text)) {
    rememberFavoriteState(tid, { favorited: false });
    return { favorited: false, message: '已取消收藏' };
  }
  const bodySnippet = snippet(text);
  if (/收藏不存在|favorite_does_not_exist/i.test(text)) {
    rememberFavoriteState(tid, { favorited: false });
    return { favorited: false, message: '已取消收藏' };
  }
  if (/formhash|表单验证|请求来路不正确/i.test(text)) {
    throw new ApiError('business', '取消收藏失败，请刷新后重试', { module: 'favorite_delete', snippet: bodySnippet });
  }
  throw new ApiError('business', '取消收藏失败，请稍后重试', { module: 'favorite_delete', snippet: bodySnippet });
}

export async function setThreadFavorite(tid: string, next: boolean, favid?: string): Promise<{ favorited: boolean; favid?: string; message: string }> {
  return next ? addThreadFavorite(tid) : removeThreadFavorite(tid, favid);
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
  const v = variablesOf(await request('mynotelist', { page }));
  return mapReminders(v, page);
}

function mapReminders(v: Record<string, any>, page = 1): ListResult<Reminder> {
  const list: Reminder[] = asArray(v.list).map(asRecord).map((it: any) => ({
    id: asString(it.id),
    type: asString(it.type),
    icon: NOTE_ICON[asString(it.type)] || 'bell',
    unread: it.new === '1',
    who: NOTE_LABEL[asString(it.type)] || '通知',
    text: stripHtml(it.note),
    time: timeFromUnix(it.dateline),
  }));
  return { list, ...paginationFor(v, list.length, page) };
}

// ===================== Private messages (mypm) =====================
export async function getPMs(page = 1): Promise<ListResult<PMItem>> {
  const v = variablesOf(await request('mypm', { page }));
  return mapPMs(v, page);
}

function mapPMs(v: Record<string, any>, page = 1): ListResult<PMItem> {
  const list: PMItem[] = asArray(v.list).map(asRecord).map((it: any) => ({
    id: asString(it.plid || it.pmid || it.touid),
    user: { name: asString(it.tousername || it.msgfromusername || it.author, '对话'), uid: asString(it.touid || it.msgfromid) },
    last: stripHtml(it.message || it.lastsummary || it.subject || ''),
    time: timeFromUnix(it.lastdateline || it.dateline),
    unread: asInt(it.isnew || it.new),
  }));
  return { list, ...paginationFor(v, list.length, page) };
}

export { avatarUrl };

export const __private = {
  mapBoardData,
  mapCollections,
  mapReminders,
  mapPMs,
  paginationFor,
  FAVORITE_LOOKUP_PAGE_LIMIT,
  rememberFavoritePage,
  rememberFavoriteState,
  favoriteScanLimit,
  cachedFavoriteState,
  clearFavoriteIndexForTests,
  favoriteIndexSnapshotForTests,
  API_TIMEOUT_MS,
  HTML_TIMEOUT_MS,
  TimeoutError,
  fetchWithTimeout,
  isTimeoutError,
  shouldRetry,
  apiNetworkError,
};
