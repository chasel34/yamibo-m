import { parseForumLink } from '../src/forumLinks';

describe('parseForumLink', () => {
  test('returns null instead of throwing for malformed encoded paths', () => {
    expect(() => parseForumLink('https://bbs.yamibo.com/%E0%A4%A')).not.toThrow();
    expect(parseForumLink('https://bbs.yamibo.com/%E0%A4%A')).toBeNull();
  });

  test('parses query-style thread links', () => {
    expect(parseForumLink('https://bbs.yamibo.com/forum.php?mod=viewthread&tid=123&pid=456&page=2')).toEqual({
      kind: 'thread',
      tid: '123',
      pid: '456',
      page: 2,
    });
  });

  test('parses path-style board and profile links', () => {
    expect(parseForumLink('https://bbs.yamibo.com/forum-5-1.html')).toEqual({ kind: 'board', fid: '5' });
    expect(parseForumLink('https://bbs.yamibo.com/space-uid-88.html')).toEqual({ kind: 'profile', uid: '88' });
  });

  test('ignores unrelated hosts', () => {
    expect(parseForumLink('https://example.com/forum.php?mod=viewthread&tid=123')).toBeNull();
  });
});
