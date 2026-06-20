import { HOST } from './util';

export type ForumLinkTarget =
  | { kind: 'thread'; tid: string; pid?: string; page?: number }
  | { kind: 'board'; fid: string }
  | { kind: 'profile'; uid: string };

function firstNumber(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    const match = String(value || '').match(/\d+/);
    if (match) return match[0];
  }
  return undefined;
}

function pageNumber(value?: string | null): number | undefined {
  const n = parseInt(String(value || ''), 10);
  return n > 0 ? n : undefined;
}

function pidFromHash(hash: string): string | undefined {
  return firstNumber(hash.match(/pid(\d+)/i)?.[1], hash.match(/#?(\d+)/)?.[1]);
}

export function parseForumLink(href?: string | null): ForumLinkTarget | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, `${HOST}/`);
  } catch (e) {
    return null;
  }
  if (url.hostname !== 'bbs.yamibo.com') return null;

  const path = decodeURIComponent(url.pathname);
  const qs = url.searchParams;
  const mod = String(qs.get('mod') || '').toLowerCase();
  const pid = firstNumber(qs.get('pid'), pidFromHash(url.hash));
  const page = pageNumber(qs.get('page'));

  const threadFromQuery = firstNumber(qs.get('tid'), qs.get('ptid'));
  if (threadFromQuery && (mod === 'viewthread' || mod === 'redirect' || path.endsWith('/forum.php'))) {
    return { kind: 'thread', tid: threadFromQuery, pid, page };
  }

  const threadFromPath = path.match(/(?:^|\/)thread-(\d+)-(\d+)-\d+\.html$/i);
  if (threadFromPath) {
    return { kind: 'thread', tid: threadFromPath[1], pid, page: pageNumber(threadFromPath[2]) };
  }

  const boardFromQuery = firstNumber(qs.get('fid'));
  if (boardFromQuery && (mod === 'forumdisplay' || path.endsWith('/forum.php'))) {
    return { kind: 'board', fid: boardFromQuery };
  }

  const boardFromPath = path.match(/(?:^|\/)forum-(\d+)-\d+\.html$/i);
  if (boardFromPath) return { kind: 'board', fid: boardFromPath[1] };

  const profileFromQuery = firstNumber(qs.get('uid'));
  if (profileFromQuery && (mod === 'space' || path.endsWith('/home.php'))) {
    return { kind: 'profile', uid: profileFromQuery };
  }

  const profileFromPath = path.match(/(?:^|\/)space-uid-(\d+)\.html$/i);
  if (profileFromPath) return { kind: 'profile', uid: profileFromPath[1] };

  return null;
}
