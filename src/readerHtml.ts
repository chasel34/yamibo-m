import { displayImageUrl } from './api';
import type { Block, ReadingChapterType, RichTextRun } from './types';
import type { ReaderThemeKey } from './reading';
import { isWeakChapter, READER_THEMES } from './reading';

function esc(value?: string | null): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHref(value: string): string | null {
  return /^https?:\/\//i.test(value) ? value : null;
}

function richRunsHtml(runs: RichTextRun[]): string {
  return runs.map((run) => {
    const cls = [
      run.bold ? 'b' : '',
      run.tone === 'accent' ? 'accent' : run.tone === 'muted' ? 'muted' : '',
      run.size === 'large' ? 'large' : run.size === 'small' ? 'small' : '',
    ].filter(Boolean).join(' ');
    const inner = esc(run.v).replace(/\n/g, '<br>');
    const href = run.href ? safeHref(run.href) : null;
    if (href) return `<a href="${esc(href)}" data-link="1" class="${esc(cls)}">${inner}</a>`;
    return `<span class="${esc(cls)}">${inner}</span>`;
  }).join('');
}

function blockHtml(block: Block, fontSize: number): string {
  if (block.t === 'text') {
    // 不少源帖用 &nbsp; 连写而非 <br> 分段，stripHtml 后表现为 2+ 连续空格 —— 视作段落分隔，
    // 否则整章塌成一个无缩进的大段落，严重影响阅读。
    return block.v.split(/\n{2,}|[ 　]{2,}/).map((paragraph) => {
      const value = paragraph.trim();
      return value ? `<p>${esc(value).replace(/\n/g, '<br>')}</p>` : '';
    }).join('');
  }
  if (block.t === 'rich') {
    return `<p>${richRunsHtml(block.runs)}</p>`;
  }
  if (block.t === 'quote') {
    const href = block.href ? safeHref(block.href) : null;
    return `<aside>${block.who ? `<strong>${esc(block.who)}</strong>` : ''}<div>${esc(block.v).replace(/\n/g, '<br>')}</div>${href ? `<a href="${esc(href)}" data-link="1">查看原楼层</a>` : ''}</aside>`;
  }
  if (block.t === 'link') {
    const href = safeHref(block.href);
    return href
      ? `<p><a href="${esc(href)}" data-link="1">${esc(block.v)} <span>↗</span></a></p>`
      : `<p>${esc(block.v)}</p>`;
  }
  if (block.t === 'notice') {
    return `<aside><strong>${block.kind === 'hidden' ? '隐藏内容' : '折叠内容'}</strong><div>${esc(block.v)}</div></aside>`;
  }
  if (block.t === 'attachment') {
    const href = block.href ? safeHref(block.href) : null;
    const label = `${block.name}${block.size ? ` · ${block.size}` : ''}`;
    return href
      ? `<p><a href="${esc(href)}" data-link="1">附件 · ${esc(label)} <span>↗</span></a></p>`
      : `<p>附件 · ${esc(label)}</p>`;
  }
  if (block.t === 'table') {
    const rows = block.rows.map((row, rowIndex) => `<tr>${row.map((cell) => {
      const tag = rowIndex === 0 ? 'th' : 'td';
      return `<${tag}>${esc(cell)}</${tag}>`;
    }).join('')}</tr>`).join('');
    return `<div class="table-wrap"><table>${rows}</table></div>`;
  }
  const src = displayImageUrl(block.src);
  if (!src) {
    return `<button class="image placeholder" data-image="${esc(block.src)}"><span>${esc(block.cap)} · 点按放大</span></button>`;
  }
  return `<button class="image" data-image="${esc(block.src)}"><img src="${esc(src)}" alt="${esc(block.cap)}"></button>`;
}

interface ReaderHtmlOptions {
  title: string;
  chapterNo: number;
  chapterTitle: string;
  chapterType?: ReadingChapterType;
  blocks: Block[];
  theme: ReaderThemeKey;
  fontSize: number;
  initialPage: number;
  comments: number | null;
  isLast: boolean;
  complete: boolean;
  floorLabel?: string;
}

export function createReaderHtml(options: ReaderHtmlOptions): string {
  const T = READER_THEMES[options.theme];
  const weak = isWeakChapter(options.chapterType);
  const body = options.blocks.map((block) => blockHtml(block, options.fontSize)).join('');
  const commentText = options.comments == null ? '点按加载，不打断阅读' : `${options.comments} 条 · 点按展开，不打断阅读`;
  const end = options.isLast ? `
    <section class="bookend">
      <div class="endicon">${options.complete ? '✓' : '♧'}</div>
      <h2>${options.complete ? '全文完' : '已读至最新一话'}</h2>
      <p>${options.complete ? '感谢陪伴到故事的最后。' : '作者仍在连载中，待更新～'}</p>
    </section>` : '';
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{width:100%;height:100%;margin:0;overflow:hidden;background:${T.bg};color:${T.ink}}
body{font-family:"Noto Serif SC","Songti SC",Georgia,serif}
#pager{position:absolute;inset:0;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}
#flow{height:calc(100vh - 108px);margin:52px 27px 56px;column-width:calc(100vw - 54px);column-gap:54px;column-fill:auto;will-change:transform;transform:translateX(0)}
#flow>*{break-inside:avoid;-webkit-column-break-inside:avoid}
#flow p,#flow aside,#flow a,#flow th,#flow td{overflow-wrap:anywhere;word-break:break-word}
#flow p{break-inside:auto;-webkit-column-break-inside:auto;font-size:${options.fontSize}px;line-height:1.95;margin:0 0 .95em;text-indent:2em;text-align:justify;letter-spacing:.01em}
.chapter{text-align:center;padding:34px 0 30px}
.chapter .no{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;font-size:12px;font-weight:700;letter-spacing:3px;color:${options.chapterType === 'chapter' ? T.accent : T.soft}}
.chapter h1{font-size:${options.fontSize + 3}px;font-weight:600;line-height:1.4;margin:12px 6px 0}
.chapter.note h1,.chapter.toc h1{font-size:${options.fontSize - 1}px;color:${T.soft}}
.chapter i{display:block;width:30px;height:2px;background:${options.chapterType === 'chapter' ? T.accent : T.soft};opacity:.5;margin:20px auto 0}
aside{border-left:2px solid ${T.accent};padding:4px 0 4px 14px;margin:6px 0 1em;color:${T.soft};font-size:${options.fontSize - 2}px;line-height:1.75}
aside strong{display:block;color:${T.accent};font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;font-size:${options.fontSize - 5}px;margin-bottom:5px}
a{color:${T.accent};text-underline-offset:3px}
.b{font-weight:700}.accent{color:${T.accent}}.muted{color:${T.soft}}.small{font-size:${options.fontSize - 3}px}.large{font-size:${options.fontSize + 2}px}
.table-wrap{width:100%;overflow:hidden;margin:2px 0 1.1em;border:1px solid ${T.line};border-radius:10px;background:${T.chrome}}
table{width:100%;border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;font-size:${options.fontSize - 5}px;line-height:1.55}
th,td{border-top:1px solid ${T.line};border-left:1px solid ${T.line};padding:7px 8px;vertical-align:top;text-align:left}tr:first-child th,tr:first-child td{border-top:0}th:first-child,td:first-child{border-left:0}th{color:${T.ink};font-weight:700;background:${T.bg}}td{color:${T.soft}}
.image{display:block;width:100%;padding:0;border:0;background:${T.chrome};border-radius:10px;overflow:hidden;margin:4px 0 1.1em}
.image img{display:block;width:100%;height:auto;max-height:54vh;object-fit:contain}
.placeholder{height:200px;color:${T.soft};background:repeating-linear-gradient(135deg,${T.line} 0 9px,transparent 9px 18px),${T.chrome}}
.placeholder span{background:${T.bg};padding:4px 9px;border-radius:6px}
.finis{text-align:center;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;font-size:${options.fontSize - 4}px;color:${T.soft};letter-spacing:2px;padding:22px 0 18px}
.floorlink{display:block;width:100%;border:0;background:transparent;color:${T.soft};font:500 ${options.fontSize - 6}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;text-align:center;padding:2px 0 18px}
.comments{width:100%;display:flex;align-items:center;gap:12px;padding:15px 16px;border:1px solid ${T.line};border-radius:14px;background:${T.chrome};color:${T.ink};text-align:left;margin:4px 0 16px}
.comments .bubble{color:${T.accent};font-size:21px}.comments b{display:block;font:600 ${options.fontSize - 5}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}
.comments small{display:block;color:${T.soft};font:400 ${options.fontSize - 7}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;margin-top:3px}
.comments em{margin-left:auto;color:${T.soft};font-style:normal}
.bookend{text-align:center;padding:30px 10px 24px}
.endicon{width:46px;height:46px;border-radius:13px;margin:0 auto 16px;background:${T.accent};color:#fff;display:flex;align-items:center;justify-content:center;font:700 22px sans-serif}
.bookend h2{font:700 ${options.fontSize}px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;margin:0}
.bookend p{font-size:${options.fontSize - 4}px;color:${T.soft};text-indent:0;text-align:center;margin-top:8px}
</style></head>
<body><div id="pager"><main id="flow">
  <header class="chapter ${esc(options.chapterType || 'chapter')}"><div class="no">${weak ? '说明' : options.chapterType === 'section' ? '无标题正文段' : `第 ${options.chapterNo} 话`}</div><h1>${esc(options.chapterTitle)}</h1><i></i></header>
  ${body}
  <div class="finis">${weak ? '· 楼主说明结束 ·' : options.chapterType === 'section' ? '· 本段完 ·' : '· 本话完 ·'}</div>
  <button class="floorlink" id="floorlink">↗ 对照原楼层${options.floorLabel ? ` · ${esc(options.floorLabel)}` : ''}</button>
  <button class="comments" id="comments"><span class="bubble">↩</span><span><b>本章评论</b><small>${esc(commentText)}</small></span><em>›</em></button>
  ${end}
</main></div>
<script>
const pager=document.getElementById('pager'),flow=document.getElementById('flow');
let page=0,pages=1,W=innerWidth,startX=0,startY=0,dragging=false,swiping=false;
function send(value){
  const data=JSON.stringify(value);
  if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(data);
  else window.parent.postMessage({__yamiboReader:true,data},'*');
}
function setX(px,animate){flow.style.transition=animate?'transform .28s cubic-bezier(.22,.61,.36,1)':'none';flow.style.transform='translateX('+px+'px)';}
function render(animate){setX(-page*W,animate);send({type:'page',page,pages});}
function measure(){
  W=innerWidth;
  pages=Math.max(1,Math.round(flow.scrollWidth/W));
  page=Math.max(0,Math.min(pages-1,${Math.max(0, options.initialPage)}));
  render(false);
}
function go(dir){
  if(dir>0&&page>=pages-1){send({type:'nextChapter'});return}
  if(dir<0&&page<=0){send({type:'prevChapter'});return}
  page=Math.max(0,Math.min(pages-1,page+dir));
  render(true);
}
pager.addEventListener('pointerdown',e=>{startX=e.clientX;startY=e.clientY;dragging=true;swiping=false;setX(-page*W,false)});
pager.addEventListener('pointermove',e=>{
  if(!dragging)return;
  const dx=e.clientX-startX,dy=e.clientY-startY;
  if(!swiping&&Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy))swiping=true;
  if(swiping){
    e.preventDefault();
    let off=-page*W+dx;const min=-(pages-1)*W;
    if(off>0)off*=.35;else if(off<min)off=min+(off-min)*.35; // rubber-band at ends
    setX(off,false);
  }
});
function endDrag(e){
  if(!dragging)return;dragging=false;
  const dx=e.clientX-startX,dy=e.clientY-startY;
  if(swiping){
    const threshold=Math.min(80,W*.18);
    if(dx<=-threshold)go(1);else if(dx>=threshold)go(-1);else render(true);
    return;
  }
  if(Math.abs(dx)>8||Math.abs(dy)>8)return;
  const el=e.target.closest&&e.target.closest('a,button');if(el)return;
  const ratio=e.clientX/W;
  if(ratio<.32)go(-1);else if(ratio>.68)go(1);else send({type:'toggleChrome'});
}
pager.addEventListener('pointerup',endDrag);
pager.addEventListener('pointercancel',()=>{if(dragging){dragging=false;render(true)}});
document.getElementById('comments').addEventListener('click',()=>send({type:'comments'}));
document.getElementById('floorlink').addEventListener('click',()=>send({type:'floor'}));
document.querySelectorAll('[data-image]').forEach(el=>el.addEventListener('click',()=>send({type:'image',src:el.dataset.image})));
document.querySelectorAll('a[data-link]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();send({type:'link',href:el.href})}));
addEventListener('resize',measure);addEventListener('load',()=>setTimeout(measure,30));setTimeout(measure,100);
</script></body></html>`;
}
