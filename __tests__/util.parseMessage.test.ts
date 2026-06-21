import { decodeEntities, parseMessage } from '../src/util';

function count(blocks: ReturnType<typeof parseMessage>, type: string) {
  return blocks.filter((block) => block.t === type).length;
}

function runs(blocks: ReturnType<typeof parseMessage>) {
  return blocks.flatMap((block) => (block.t === 'rich' ? block.runs : []));
}

describe('parseMessage rich text fixtures', () => {
  test('image attachments are not downgraded to files', () => {
    const blocks = parseMessage('<p>图楼</p>', {
      1: {
        attachment: '202606/20/demo-1.jpg',
        filename: '1.jpg',
        attachimg: '1',
        isimage: '-1',
        width: '800',
        height: '600',
      },
      2: {
        attachment: '202606/20/demo-app.apk',
        filename: 'demo-app.apk',
        ext: 'apk',
        isimage: '0',
        filesize: '1 MB',
      },
    }, ['1', '2']);
    expect(count(blocks, 'img')).toBe(1);
    expect(count(blocks, 'attachment')).toBe(1);
  });

  test('image attachments missing from imagelist are preserved', () => {
    const blocks = parseMessage('<p>图楼</p>', {
      1: { attachment: '202606/20/listed.jpg', filename: 'listed.jpg', isimage: '1' },
      2: { attachment: '202606/20/unlisted.jpg', filename: 'unlisted.jpg', isimage: '1' },
    }, ['1']);
    expect(count(blocks, 'img')).toBe(2);
  });

  test('numeric entities decode high Unicode code points', () => {
    expect(decodeEntities('&#128512; &#x1F600;')).toBe('😀 😀');
  });

  test('linked images render as images', () => {
    const blocks = parseMessage('<a href="forum.php?mod=attachment&aid=1"><img src="static/image/common/none.gif" file="data/attachment/forum/202606/20/demo.png" /></a>');
    expect(count(blocks, 'img')).toBe(1);
    expect(count(blocks, 'link')).toBe(0);
  });

  test('tables keep rows and cells', () => {
    const blocks = parseMessage('<table><tr><th>项目</th><th>说明</th></tr><tr><td>阅读权限</td><td><strong>20</strong></td></tr></table>');
    const table = blocks.find((block) => block.t === 'table');
    expect(table?.t).toBe('table');
    if (table?.t !== 'table') return;
    expect(table.rows).toHaveLength(2);
    expect(table.rows[1]).toEqual(['阅读权限', '20']);
  });

  test('quotes keep attribution and source href', () => {
    const blocks = parseMessage('<div class="quote"><blockquote><a href="forum.php?mod=redirect&goto=findpost&ptid=572407&pid=13"><font size="2">ckyy14 发表于 2026-06-20</font></a>引用正文</blockquote></div><p>回复正文</p>');
    const quote = blocks.find((block) => block.t === 'quote');
    expect(quote?.t).toBe('quote');
    if (quote?.t !== 'quote') return;
    expect(quote.who).toBe('ckyy14');
    expect(quote.href).toContain('findpost');
  });

  test('rich inline styles and links survive', () => {
    const blocks = parseMessage('普通 <strong>粗体</strong><font color="#ff0000">红字</font><span style="font-size: 12px; color:#999">小灰</span><a href="thread-572320-1-1.html">站内链接</a> https://example.com/path.');
    const allRuns = runs(blocks);
    expect(allRuns.some((run) => run.bold && run.v.includes('粗体'))).toBe(true);
    expect(allRuns.some((run) => run.tone === 'accent' && run.v.includes('红字'))).toBe(true);
    expect(allRuns.some((run) => run.tone === 'muted' && run.size === 'small' && run.v.includes('小灰'))).toBe(true);
    expect(
      allRuns.some((run) => run.href && run.v.includes('站内链接'))
        || blocks.some((block) => block.t === 'link' && block.v.includes('站内链接')),
    ).toBe(true);
    expect(allRuns.some((run) => run.href === 'https://example.com/path')).toBe(true);
  });
});
