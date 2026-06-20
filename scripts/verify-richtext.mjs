import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const source = fs.readFileSync(path.join(root, 'src/util.ts'), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText;

const sandbox = {
  module: { exports: {} },
  exports: {},
  require,
  URL,
  console,
};
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(js, sandbox, { filename: 'src/util.ts' });

const { decodeEntities, parseMessage } = sandbox.module.exports;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function count(blocks, type) {
  return blocks.filter((block) => block.t === type).length;
}

function runs(blocks) {
  return blocks.flatMap((block) => (block.t === 'rich' ? block.runs : []));
}

const cases = [
  {
    name: 'image attachments are not downgraded to files',
    run() {
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
      assert(count(blocks, 'img') === 1, 'expected one image attachment block');
      assert(count(blocks, 'attachment') === 1, 'expected one non-image attachment block');
    },
  },
  {
    name: 'image attachments missing from imagelist are preserved',
    run() {
      const blocks = parseMessage('<p>图楼</p>', {
        1: {
          attachment: '202606/20/listed.jpg',
          filename: 'listed.jpg',
          isimage: '1',
        },
        2: {
          attachment: '202606/20/unlisted.jpg',
          filename: 'unlisted.jpg',
          isimage: '1',
        },
      }, ['1']);
      assert(count(blocks, 'img') === 2, 'expected unlisted image attachment to be preserved');
    },
  },
  {
    name: 'numeric entities decode high Unicode code points',
    run() {
      assert(decodeEntities('&#128512; &#x1F600;') === '😀 😀', 'expected emoji entities to decode via code points');
    },
  },
  {
    name: 'linked images render as images',
    run() {
      const blocks = parseMessage('<a href="forum.php?mod=attachment&aid=1"><img src="static/image/common/none.gif" file="data/attachment/forum/202606/20/demo.png" /></a>');
      assert(count(blocks, 'img') === 1, 'expected linked image to become an image block');
      assert(count(blocks, 'link') === 0, 'image wrapper should not add a plain link block');
    },
  },
  {
    name: 'tables keep rows and cells',
    run() {
      const blocks = parseMessage('<table><tr><th>项目</th><th>说明</th></tr><tr><td>阅读权限</td><td><strong>20</strong></td></tr></table>');
      const table = blocks.find((block) => block.t === 'table');
      assert(table, 'expected a table block');
      assert(table.rows.length === 2, 'expected two table rows');
      assert(table.rows[1][0] === '阅读权限' && table.rows[1][1] === '20', 'expected table cell text to be preserved');
    },
  },
  {
    name: 'quotes keep attribution and source href',
    run() {
      const blocks = parseMessage('<div class="quote"><blockquote><a href="forum.php?mod=redirect&goto=findpost&ptid=572407&pid=13"><font size="2">ckyy14 发表于 2026-06-20</font></a>引用正文</blockquote></div><p>回复正文</p>');
      const quote = blocks.find((block) => block.t === 'quote');
      assert(quote, 'expected a quote block');
      assert(quote.who === 'ckyy14', 'expected quote author to be preserved');
      assert(/findpost/.test(quote.href || ''), 'expected quote source href');
    },
  },
  {
    name: 'rich inline styles and links survive',
    run() {
      const blocks = parseMessage('普通 <strong>粗体</strong><font color="#ff0000">红字</font><span style="font-size: 12px; color:#999">小灰</span><a href="thread-572320-1-1.html">站内链接</a> https://example.com/path.');
      const allRuns = runs(blocks);
      assert(allRuns.some((run) => run.bold && run.v.includes('粗体')), 'expected bold run');
      assert(allRuns.some((run) => run.tone === 'accent' && run.v.includes('红字')), 'expected accent color run');
      assert(allRuns.some((run) => run.tone === 'muted' && run.size === 'small' && run.v.includes('小灰')), 'expected small muted run');
      assert(
        allRuns.some((run) => run.href && run.v.includes('站内链接'))
          || blocks.some((block) => block.t === 'link' && block.v.includes('站内链接')),
        'expected clickable inline or link block',
      );
      assert(allRuns.some((run) => run.href === 'https://example.com/path'), 'expected bare URL run');
    },
  },
];

for (const testCase of cases) {
  testCase.run();
  console.log(`ok - ${testCase.name}`);
}

console.log(`verified ${cases.length} rich text fixtures`);
