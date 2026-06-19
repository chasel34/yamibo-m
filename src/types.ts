// Shared UI-model types. The API layer (src/api.ts) maps the loosely-typed Discuz
// mobile JSON into these shapes, so screens/components consume strong types.

export interface NavAuthor {
  name?: string;
  uid?: string;
  group?: string;
}

// ---- Forum index ----
export interface BoardSub {
  fid: string;
  name: string;
  today: number;
  iconUrl?: string | null;
}
export interface BoardSummary {
  id: string;
  fid: string;
  name: string;
  desc: string;
  today: number;
  threads?: string;
  posts?: string;
  iconUrl?: string | null;
  subs: BoardSub[];
}
export interface ForumGroup {
  id: string;
  name: string;
  desc: string;
  boards: BoardSummary[];
}
export interface ForumIndexData {
  groups: ForumGroup[];
  me: { uid?: string; name?: string; avatar?: string };
}

// ---- Board (forumdisplay) ----
export interface ThreadRow {
  id: string;
  tid: string;
  typeid?: string;
  tag: string;
  title: string;
  author: NavAuthor;
  time: string;
  replies: number;
  views?: string;
  pinned: boolean;
  excerpt: string;
  hasImage: boolean;
  boardName?: string;
}
export interface BoardInfo {
  fid: string;
  name: string;
  desc: string;
  rules?: string;
}
export interface ThreadType {
  id: string;
  name: string;
}
// 排序模式（全板块通用）vs 作品分类标签（threadtypes）是两套独立筛选。
export type SortMode = '全部' | '最新' | '热门' | '精华';
export const SORT_MODES: SortMode[] = ['全部', '最新', '热门', '精华'];
// 置顶/公告行（displayorder>0），与普通帖分开渲染。notice=公告（红底强调），sticky=置顶。
export interface PinnedItem {
  id: string;
  tid: string;
  title: string;
  kind: 'notice' | 'sticky';
}
export interface BoardData {
  board: BoardInfo;
  threads: ThreadRow[];
  pinned: PinnedItem[];
  types: ThreadType[];
  subs: BoardSub[];
  page: number;
  tpp: number;
  hasMore: boolean;
  totalPages: number;
  totalThreads: number;
}

// ---- Thread (viewthread) ----
export type Block =
  | { t: 'text'; v: string }
  | { t: 'link'; v: string; href: string }
  | { t: 'img'; src: string | null; cap: string; width?: number; height?: number }
  | { t: 'quote'; who: string; v: string };

export interface Floor {
  pid?: string;
  floor: number;
  op: boolean;
  user: NavAuthor;
  time: string;
  blocks: Block[];
}
export interface ThreadInfo {
  tid: string;
  fid?: string;
  title: string;
  replies: number;
  views?: string;
  pinned: boolean;
  author: NavAuthor;
  time: string;
}
export interface ThreadImage {
  src: string | null;
  cap: string;
}
export interface ThreadData {
  thread: ThreadInfo;
  floors: Floor[];
  images: ThreadImage[];
  ppp: number;
  page: number;
  hasMore: boolean;
  totalPages: number;
}

// ---- Reading mode ----
export interface ReadingPost {
  pid: string;
  number: number;
  pos: number; // 1-based floor position in the *unfiltered* thread (Discuz `position`)
  blocks: Block[];
}
export interface ReadingStreamPage {
  tid: string;
  fid?: string;
  title: string;
  author: NavAuthor;
  posts: ReadingPost[];
  page: number;
  ppp: number;
  totalPages: number;
}
export interface ReadingChapter {
  id: string;
  pid: string;
  no: number;
  title: string;
  type?: ReadingChapterType;
  confidence?: ReadingConfidence;
  sourcePage?: number;
  pageOffset?: number;
  originalPage?: number;
  pos?: number; // unfiltered floor position of the chapter's楼主楼层（用于定位章末评论页）
  blocks?: Block[];
}
export type ReadingIndexStatus = 'complete' | 'toc-ready';
export type ReadingChapterType = 'chapter' | 'section' | 'note' | 'toc';
export type ReadingConfidence = 'high' | 'medium' | 'low';
export interface ReadingChapterIndex {
  id: string;
  pid: string;
  no: number;
  title: string;
  type: ReadingChapterType;
  confidence: ReadingConfidence;
  pos?: number;
  sourcePage?: number;
  pageOffset?: number;
  originalPage?: number;
}
export interface ReadingDiagnostics {
  opPostCount: number;
  chapterCount: number;
  linkedTocCount: number;
  plainTocCount: number;
  titleDetectedCount: number;
  fallbackChapterCount: number;
  droppedPostCount: number;
  declaredLatestNo?: number;
  confidence: ReadingConfidence;
  warnings: string[];
}
export interface ReadingIndex {
  version: 1;
  tid: string;
  fid: string;
  authorid: string;
  title: string;
  author: NavAuthor;
  status: ReadingIndexStatus;
  chapters: ReadingChapterIndex[];
  diagnostics: ReadingDiagnostics;
  source: {
    totalPages: number;
    scannedPages: number;
    builtAt: number;
    firstPageHash?: string;
    tocHash?: string;
    lastPid?: string;
  };
}
export interface ReadingBook {
  tid: string;
  fid?: string;
  authorid?: string;
  title: string;
  author: NavAuthor;
  shape: '短篇' | '中篇连载' | '长篇连载';
  statusText: '完结' | '连载中';
  status?: ReadingIndexStatus;
  diagnostics?: ReadingDiagnostics;
  source?: ReadingIndex['source'];
  chapters: ReadingChapter[];
  ppp: number;
  totalPages: number;
}
export interface ReadingComment {
  id: string;
  user: NavAuthor;
  time: string;
  text: string;
}
export interface ReadingProgress {
  chapter: number;
  page: number;
  pct: number;
  chapterTitle: string;
  pid?: string;
  ts: number;
}

// ---- Profile ----
export interface ProfileStats {
  themes: number;
  replies: number;
  collections: number;
  follow: number;
  fans: number;
}
export interface UserProfile {
  id?: string;
  uid?: string;
  name?: string;
  avatar?: string;
  group?: string;
  register?: string;
  bio?: string;
  gender?: string;
  constellation?: string;
  location?: string;
  stats: ProfileStats;
  credits?: number;
  self?: boolean;
}

// ---- Lists ----
export interface CollectionItem {
  id: string;
  tid: string;
  tag: string;
  title: string;
  author: { name?: string };
  time: string;
  replies: number;
  excerpt: string;
}
export interface ListResult<T> {
  list: T[];
  count: number;
}
export interface Reminder {
  id: string;
  type: string;
  icon: string;
  unread: boolean;
  who: string;
  text: string;
  time: string;
}
export interface PMItem {
  id: string;
  user: NavAuthor;
  last: string;
  time: string;
  unread: number;
}

// ---- Session ----
export interface Notice {
  newpush: string;
  newpm: string;
  newprompt: string;
  newmypost: string;
}
export interface Me {
  uid: string;
  username: string;
  avatar: string | null;
}

// ---- Local browse history ----
export interface HistoryItem {
  tid: string;
  title?: string;
  author?: NavAuthor;
  ts: number;
}

// ---- Theme ----
export type ThemeName = 'light' | 'dark';

// ---- Navigation ----
// A board reference as it travels through navigation params (looser than BoardInfo).
export interface BoardNavParam {
  fid?: string;
  name?: string;
  desc?: string;
  rules?: string;
}
// A thread reference as passed from a feed row / history / collection.
export interface ThreadNavParam {
  tid?: string;
  id?: string;
  title?: string;
  author?: NavAuthor;
  pinned?: boolean;
  replies?: number;
  time?: string;
  views?: string;
}
export type RootStackParamList = {
  login: undefined;
  tabs: undefined;
  board: { board?: BoardNavParam; fid?: string } | undefined;
  thread: { thread?: ThreadNavParam; board?: BoardNavParam; tid?: string; targetPid?: string; targetPage?: number } | undefined;
  reader: { tid: string; authorid: string; fresh?: boolean };
  profile: { uid?: string; self?: boolean } | undefined;
  settings: undefined;
  collections: undefined;
  history: undefined;
  about: undefined;
  viewer: { images?: ThreadImage[]; index?: number; title?: string } | undefined;
};
