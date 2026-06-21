import { buildCompleteIndex, buildTocReadyIndex, stripLeadingChapterTitle } from '../src/reading';
import type { Block, ReadingStreamPage } from '../src/types';

function page(posts: ReadingStreamPage['posts'], pageNo = 1): ReadingStreamPage {
  return {
    tid: '572407',
    fid: '49',
    title: '测试文',
    author: { uid: '42', name: '作者' },
    posts,
    page: pageNo,
    ppp: 20,
    totalPages: 2,
  };
}

describe('reading index builders', () => {
  test('linked table of contents posts become toc-ready indexes', () => {
    const links: Block[] = Array.from({ length: 5 }, (_, index) => ({
      t: 'link',
      v: `第 ${index + 1} 章`,
      href: `forum.php?mod=redirect&goto=findpost&ptid=572407&pid=${100 + index}`,
    }));
    const index = buildTocReadyIndex(page([{ pid: '1', number: 1, pos: 1, blocks: links }]), '42');
    expect(index.status).toBe('toc-ready');
    expect(index.chapters).toHaveLength(6);
    expect(index.chapters[1]).toMatchObject({ pid: '100', title: '第 1 章', confidence: 'high' });
  });

  test('complete scan indexes preserve every non-empty OP post', () => {
    const index = buildCompleteIndex([
      page([
        { pid: '1', number: 1, pos: 1, blocks: [{ t: 'text', v: '第 1 章\n正文一' }] },
        { pid: '2', number: 2, pos: 5, blocks: [{ t: 'text', v: '第 2 章\n正文二' }] },
      ], 1),
      page([{ pid: '3', number: 3, pos: 9, blocks: [{ t: 'text', v: '番外\n正文三' }] }], 2),
    ], '42');
    expect(index.status).toBe('complete');
    expect(index.chapters.map((chapter) => chapter.pid)).toEqual(['1', '2', '3']);
    expect(index.diagnostics.opPostCount).toBe(3);
  });

  test('stripLeadingChapterTitle keeps body text on the same line', () => {
    const blocks = stripLeadingChapterTitle([{ t: 'text', v: 'Episode 2   舌尖上的小事\n第二行' }], 'Episode 2');
    expect(blocks).toEqual([{ t: 'text', v: '舌尖上的小事\n第二行' }]);
  });
});
