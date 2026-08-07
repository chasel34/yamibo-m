import { __private } from '../src/api';

// 片段按 bbs.yamibo.com 的真实响应裁剪（home.php?mod=space&do=thread&view=me）。
// 注意链接里的 & 都是 &amp; 转义的——解析器必须能吃下这种形式。
function page(rows: string, pager = '') {
  return `<div class="mn pbw"><div class="tl">
<form method="post" name="delform" id="delform" action="home.php?mod=space">
<table cellspacing="0" cellpadding="0">
<tr class="th"><td class="icn">&nbsp;</td><th>帖子</th><td class="frm">版块/群组</td><td class="num">回复/查看</td><td class="by"><cite>最后发帖</cite></td></tr>
${rows}
</table></form></div>${pager}</div>`;
}

const NEXT_PAGE = '<div class="pgs cl mtm"><div class="pg"><a href="home.php?mod=space&amp;page=2" class="nxt">下一页</a></div></div>';
const LAST_PAGE = '<div class="pgs cl mtm"><div class="pg"><span class="pgb"><a href="home.php?mod=space&amp;page=1">上一页</a></span></div></div>';

const THREAD_ROW = `<tr>
<td class="icn"><a href="forum.php?mod=viewthread&amp;tid=574117&amp;highlight=" target="_blank"><i class="fico-thread fic6 fc-n"></i></a></td>
<th><a href="thread-574117-1-1.html" target="_blank">【合作汉化】【Dear My Teacher】同人志11</a><i class="fico-image fic4 fc-p fnmr vm" title="图片附件"></i></th>
<td><a href="forum-30-1.html" class="xg1" target="_blank">中文百合漫画区</a></td>
<td class="num"><a href="thread-574117-1-1.html" class="xi2" target="_blank">10</a><em>1556</em></td>
<td class="by"><cite><a href="space-username-x.html" target="_blank">舞飄風</a></cite><em><a href="forum.php?mod=redirect&amp;tid=574117&amp;goto=lastpost#lastpost" target="_blank">2026-8-3 21:35</a></em></td>
</tr>`;

const LOCKED_ROW = `<tr class="bw0_all">
<td class="icn"><a href="forum.php?mod=viewthread&amp;tid=519989&amp;highlight="><i class="fico-lock fic6 fc-s"></i></a></td>
<th><a href="thread-519989-1-1.html" target="_blank">漫画汇总</a><span class="tps">... <a href="https://bbs.yamibo.com/thread-519989-2-1.html">2</a> </span><span class="xg1">已关闭</span></th>
<td><a href="forum-30-1.html" class="xg1" target="_blank">中文百合漫画区</a></td>
<td class="num"><a href="thread-519989-1-1.html" class="xi2">138</a><em>42944</em></td>
<td class="by"><cite><a href="space-username-y.html">whm</a></cite><em><a href="#">2023-4-27 23:25</a></em></td>
</tr>`;

// 回复列表：主题行的标题链接指向 findpost 且 pid 为空，正文在紧随其后的 colspan=5 行里。
const REPLY_HEAD = `<tr class="bw0_all">
<td class="icn"><a href="forum.php?mod=viewthread&amp;tid=556681&amp;highlight="><i class="fico-vote fic6 fc-n" alt="投票"></i></a></td>
<th><a href="forum.php?mod=redirect&amp;goto=findpost&amp;ptid=556681&amp;pid=" target="_blank">各位对于纯网恋是什么看法</a><span class="tps">... <a href="https://bbs.yamibo.com/thread-556681-2-1.html">2</a> </span></th>
<td><a href="forum-33-1.html" class="xg1" target="_blank">海域區</a></td>
<td class="num"><a href="thread-556681-1-1.html" class="xi2">213</a><em>3205</em></td>
<td class="by"><cite><a href="space-username-z.html">catchy5565</a></cite><em><a href="#">2026-8-6 22:37</a></em></td>
</tr>`;

const REPLY_BODY = `<tr><td colspan="5" class="xg1">&nbsp;<svg width="15" height="14"><path fill="#ddd" d="M6 8v5H1V8z"></path></svg> <a href="forum.php?mod=redirect&amp;goto=findpost&amp;ptid=556681&amp;pid=41273827" target="_blank">没谈过，身边的人有在谈。
但从旁观者来看，都仅能通过文字了解对方 ...</a> <svg width="15" height="14"><path fill="#ddd" d="M9 6V1h5z"></path></svg></td></tr>`;

const EMPTY_ROW = '<tr><td colspan="5"><p class="emp">还没有相关的帖子</p></td></tr>';

describe('user threads (space HTML)', () => {
  test('maps title / board / counts / last-post time off an escaped row', () => {
    const r = __private.parseUserThreads(page(THREAD_ROW, LAST_PAGE), 1);
    expect(r.list).toHaveLength(1);
    expect(r.list[0]).toMatchObject({
      id: '574117',
      tid: '574117',
      title: '【合作汉化】【Dear My Teacher】同人志11',
      boardName: '中文百合漫画区',
      fid: '30',
      replies: 10,
      views: 1556,
      lastPoster: '舞飄風',
      time: '2026-8-3 21:35',
    });
    expect(r.list[0].flag).toBeUndefined();
  });

  test('reads the state flag off the row icon and skips the header row', () => {
    const r = __private.parseUserThreads(page(LOCKED_ROW + THREAD_ROW, NEXT_PAGE), 2);
    expect(r.list.map((x) => x.flag)).toEqual(['已关闭', undefined]);
    expect(r.list[0].title).toBe('漫画汇总');   // <span class="tps"> 的翻页链接不能吃掉标题
    expect(r.page).toBe(2);
  });

  test('an empty list is a valid page, not an error', () => {
    const r = __private.parseUserThreads(page(EMPTY_ROW, LAST_PAGE), 1);
    expect(r.list).toEqual([]);
    expect(r.hasMore).toBe(false);
  });
});

describe('user replies (space HTML)', () => {
  test('pairs the colspan body row with its own thread row', () => {
    const r = __private.parseUserReplies(page(REPLY_HEAD + REPLY_BODY, LAST_PAGE), 1);
    expect(r.list).toHaveLength(1);
    expect(r.list[0]).toMatchObject({
      id: '41273827',
      tid: '556681',
      pid: '41273827',            // Thread 的 targetPid，用来定位到我回复的那一楼
      title: '各位对于纯网恋是什么看法',
      flag: '投票',
      boardName: '海域區',
      fid: '33',
    });
    expect(r.list[0].text).toBe('没谈过，身边的人有在谈。 但从旁观者来看，都仅能通过文字了解对方…');
  });

  test('a reply whose whole body is "......" is not mistaken for a truncation marker', () => {
    const body = REPLY_BODY.replace('没谈过，身边的人有在谈。\n但从旁观者来看，都仅能通过文字了解对方 ...', '......');
    const r = __private.parseUserReplies(page(REPLY_HEAD + body, LAST_PAGE), 1);
    expect(r.list[0].text).toBe('......');
  });

  test('a thread row without its body row keeps no pid and never steals the next one', () => {
    const r = __private.parseUserReplies(page(REPLY_HEAD + THREAD_ROW + REPLY_BODY, LAST_PAGE), 1);
    expect(r.list).toHaveLength(2);
    expect(r.list[0].pid).toBeUndefined();       // 556681 的正文行缺失 → 保持空
    expect(r.list[0].text).toBe('');
    expect(r.list[1].tid).toBe('574117');
    expect(r.list[1].pid).toBe('41273827');      // 正文行只认它紧挨着的那一行
  });

  test('the empty-state colspan row is not mistaken for a reply body', () => {
    const r = __private.parseUserReplies(page(EMPTY_ROW, LAST_PAGE), 1);
    expect(r.list).toEqual([]);
  });
});

describe('space pagination', () => {
  // 关键回归点：每页行数会因无权限板块被过滤而少于 perpage（线上实测同一用户 17/19/20 行），
  // 所以「还有没有下一页」只能看 class="nxt"，按行数判断会在第一页就误判到底。
  test('hasMore follows the next-page link, not the row count', () => {
    const short = __private.parseUserThreads(page(THREAD_ROW, NEXT_PAGE), 1);
    expect(short.list).toHaveLength(1);
    expect(short.hasMore).toBe(true);

    const full = __private.parseUserThreads(page(THREAD_ROW + LOCKED_ROW, LAST_PAGE), 3);
    expect(full.list).toHaveLength(2);
    expect(full.hasMore).toBe(false);
  });
});

describe('space page errors', () => {
  test('a page carrying the list form is accepted even when the list is empty', () => {
    expect(__private.spacePageError(page(EMPTY_ROW), 'space_thread')).toBeNull();
  });

  test('a privacy-blocked page becomes a readable business error', () => {
    const err = __private.spacePageError('<html><body><div class="alert_error">抱歉，您没有权限查看</div></body></html>', 'space_thread');
    expect(err?.code).toBe('business');
    expect(err?.message).toBe('这位同好的帖子列表不公开');
  });

  test('a WAF challenge page is reported as such so the caller can retry after it clears', () => {
    const err = __private.spacePageError('<html><script>var __nox = 1;</script></html>', 'space_reply');
    expect(err?.code).toBe('waf_challenge');
  });
});
