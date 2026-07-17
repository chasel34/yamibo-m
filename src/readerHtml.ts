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

function blockHtml(block: Block): string {
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

export interface ChapterFragmentOptions {
  chapterNo: number;
  chapterTitle: string;
  chapterType?: ReadingChapterType;
  blocks: Block[];
  isLast: boolean;
  complete: boolean;
  floorLabel?: string;
}

/**
 * 单章片段（section.chap 的 innerHTML）。由 RN 侧按需生成，注入常驻 shell 文档。
 * 章与章拼进同一条 CSS 多列流，因此跨章翻页与章内翻页动画完全一致。
 */
export function createChapterFragment(options: ChapterFragmentOptions): string {
  const weak = isWeakChapter(options.chapterType);
  const type = options.chapterType || 'chapter';
  const label = weak ? '说明' : options.chapterType === 'section' ? '无标题正文段' : `第 ${options.chapterNo} 话`;
  const body = options.blocks.map((block) => blockHtml(block)).join('');
  const finis = weak ? '· 楼主说明结束 ·' : options.chapterType === 'section' ? '· 本段完 ·' : '· 本话完 ·';
  const end = options.isLast ? `
    <section class="bookend">
      <div class="endicon">${options.complete ? '✓' : '♧'}</div>
      <h2>${options.complete ? '全文完' : '已读至最新一话'}</h2>
      <p>${options.complete ? '感谢陪伴到故事的最后。' : '作者仍在连载中，待更新～'}</p>
    </section>` : '';
  return `
  <header class="chapter ${esc(type)}${options.chapterType === 'chapter' ? ' is-main' : ''}"><div class="no">${esc(label)}</div><h1>${esc(options.chapterTitle)}</h1><i></i></header>
  ${body}
  <div class="finis">${finis}</div>
  <button class="floorlink">↗ 对照原楼层${options.floorLabel ? ` · ${esc(options.floorLabel)}` : ''}</button>
  <button class="comments"><span class="bubble">↩</span><span><b>本章评论</b><small>点按加载，不打断阅读</small></span><em>›</em></button>
  ${end}`;
}

export interface ReaderShellOptions {
  theme: ReaderThemeKey;
  fontSize: number;
}

/**
 * 常驻 shell 文档：只随 ReaderSurface 挂载载入一次，之后一切内容变化（换章、窗口滑动、
 * 换字号/主题）都通过命令注入原地完成，绝不再换 source —— 这是消灭换章 reload 白闪的关键。
 *
 * 布局模型：#flow 是横向 flex，一章一个 section.chap；每个 section 自身是 CSS 多列容器，
 * 测量后把宽度钉成 pages*W-GAP，于是所有章的页边界都落在全局 W 步进上，
 * 相邻章之间滑动与章内翻页无任何区别（跨章连贯动画由此而来）。
 *
 * 命令（RN → shell）：window（重置窗口）/ add（追加相邻章）/ style（字号主题原地重排）。
 * 事件（shell → RN）：ready / page（含窗口内容 win，RN 据此同步已注入章集合）/ need / blocked
 *   / toggleChrome / comments / floor / image / link。
 */
export function createReaderShellHtml(options: ReaderShellOptions): string {
  const T = READER_THEMES[options.theme];
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
/* 主题色与字号收进 CSS 自定义属性：初始值来自 options（保证首帧正确），切换时脚本
   只改这些变量即可原地重排，无需整文档 reload。行高等无主题依赖的量保持字面量。 */
:root{--bg:${T.bg};--ink:${T.ink};--accent:${T.accent};--soft:${T.soft};--line:${T.line};--chrome:${T.chrome};--fs:${options.fontSize}px}
html,body{width:100%;height:100%;margin:0;overflow:hidden;background:var(--bg);color:var(--ink)}
body{font-family:"Noto Serif SC","Songti SC",Georgia,serif}
#pager{position:absolute;inset:0;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}
#flow{height:calc(100vh - 108px);margin:52px 0 56px 27px;display:flex;flex-direction:row;align-items:stretch;will-change:transform;transform:translateX(0);opacity:0}
/* 每章一个多列容器；宽度由脚本钉成整页数（pages*W-54），margin-right 54 充当跨章列间距，
   保证全局页步进恒为 100vw。 */
.chap{flex:none;height:100%;column-width:calc(100vw - 54px);column-gap:54px;column-fill:auto;margin-right:54px}
.chap>*{break-inside:avoid;-webkit-column-break-inside:avoid}
.chap p,.chap aside,.chap a,.chap th,.chap td{overflow-wrap:anywhere;word-break:break-word}
.chap p{break-inside:auto;-webkit-column-break-inside:auto;font-size:var(--fs);line-height:1.95;margin:0 0 .95em;text-indent:2em;text-align:justify;letter-spacing:.01em}
.chapter{text-align:center;padding:34px 0 30px}
.chapter .no{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;font-size:12px;font-weight:700;letter-spacing:3px;color:var(--soft)}
.chapter.is-main .no{color:var(--accent)}
.chapter h1{font-size:calc(var(--fs) + 3px);font-weight:600;line-height:1.4;margin:12px 6px 0}
.chapter.note h1,.chapter.toc h1{font-size:calc(var(--fs) - 1px);color:var(--soft)}
.chapter i{display:block;width:30px;height:2px;background:var(--soft);opacity:.5;margin:20px auto 0}
.chapter.is-main i{background:var(--accent)}
aside{border-left:2px solid var(--accent);padding:4px 0 4px 14px;margin:6px 0 1em;color:var(--soft);font-size:calc(var(--fs) - 2px);line-height:1.75}
aside strong{display:block;color:var(--accent);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;font-size:calc(var(--fs) - 5px);margin-bottom:5px}
a{color:var(--accent);text-underline-offset:3px}
.b{font-weight:700}.accent{color:var(--accent)}.muted{color:var(--soft)}.small{font-size:calc(var(--fs) - 3px)}.large{font-size:calc(var(--fs) + 2px)}
.table-wrap{width:100%;overflow:hidden;margin:2px 0 1.1em;border:1px solid var(--line);border-radius:10px;background:var(--chrome)}
table{width:100%;border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;font-size:calc(var(--fs) - 5px);line-height:1.55}
th,td{border-top:1px solid var(--line);border-left:1px solid var(--line);padding:7px 8px;vertical-align:top;text-align:left}tr:first-child th,tr:first-child td{border-top:0}th:first-child,td:first-child{border-left:0}th{color:var(--ink);font-weight:700;background:var(--bg)}td{color:var(--soft)}
.image{display:block;width:100%;padding:0;border:0;background:var(--chrome);border-radius:10px;overflow:hidden;margin:4px 0 1.1em}
.image img{display:block;width:100%;height:auto;max-height:54vh;object-fit:contain}
.placeholder{height:200px;color:var(--soft);background:repeating-linear-gradient(135deg,var(--line) 0 9px,transparent 9px 18px),var(--chrome)}
.placeholder span{background:var(--bg);padding:4px 9px;border-radius:6px}
.finis{text-align:center;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;font-size:calc(var(--fs) - 4px);color:var(--soft);letter-spacing:2px;padding:22px 0 18px}
/* .floorlink/.comments/.bookend 的字号用 calc(var(--fs)…)：拆出 font-size 单独写，避免 calc()
   落进 font 简写在部分 WebKit 上被整条丢弃，连带 family/weight 一起失效。 */
.floorlink{display:block;width:100%;border:0;background:transparent;color:var(--soft);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;font-weight:500;font-size:calc(var(--fs) - 6px);text-align:center;padding:2px 0 18px}
.comments{width:100%;display:flex;align-items:center;gap:12px;padding:15px 16px;border:1px solid var(--line);border-radius:14px;background:var(--chrome);color:var(--ink);text-align:left;margin:4px 0 16px}
.comments .bubble{color:var(--accent);font-size:21px}.comments b{display:block;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;font-weight:600;font-size:calc(var(--fs) - 5px)}
.comments small{display:block;color:var(--soft);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;font-weight:400;font-size:calc(var(--fs) - 7px);margin-top:3px}
.comments em{margin-left:auto;color:var(--soft);font-style:normal}
.bookend{text-align:center;padding:30px 10px 24px}
.endicon{width:46px;height:46px;border-radius:13px;margin:0 auto 16px;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font:700 22px sans-serif}
.bookend h2{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;font-weight:700;font-size:var(--fs);margin:0}
.bookend p{font-size:calc(var(--fs) - 4px);color:var(--soft);text-indent:0;text-align:center;margin-top:8px}
</style></head>
<body><div id="pager"><div id="flow"></div></div>
<script>
var GAP=54;
var pager=document.getElementById('pager'),flow=document.getElementById('flow');
// 页宽必须与列步进逐像素一致：innerWidth 是整数，而安卓上 100vw 常是小数（如 392.7px），
// 每页零点几像素的误差翻到 40+ 页会累计成明显横向偏移。documentElement 的 rect 宽度是精确值。
function vw(){return document.documentElement.getBoundingClientRect().width||innerWidth}
var total=0,secs=[],page=0,W=vw();
var dragging=false,swiping=false,startX=0,startY=0,anim=null,suppressClick=false;
var pendingOps=[],reflowTimer=null;
function send(value){
  var data=JSON.stringify(value);
  if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(data);
  else window.parent.postMessage({__yamiboReader:true,data:data},'*');
}
function busy(){return dragging||anim!=null}
function totalPages(){var l=secs[secs.length-1];return l?l.start+l.pages:1}
function cur(){for(var i=secs.length-1;i>=0;i--){if(page>=secs[i].start)return secs[i]}return secs[0]}
function has(idx){for(var i=0;i<secs.length;i++)if(secs[i].idx===idx)return true;return false}
function layout(){var acc=0;for(var i=0;i<secs.length;i++){secs[i].start=acc;acc+=secs[i].pages}}
// 先以单列宽测 scrollWidth 得页数，再把宽度钉成整页数——多列容器内容不变、
// 列宽仍是 W-GAP，但后续 flex 兄弟的起点从此落在整页边界上。
function measureSec(s){
  s.el.style.width=(W-GAP)+'px';
  s.pages=Math.max(1,Math.round((s.el.scrollWidth+GAP)/W));
  s.el.style.width=(s.pages*W-GAP)+'px';
}
function insertSec(idx,html){
  var el=document.createElement('section');
  el.className='chap';el.dataset.idx=idx;el.innerHTML=html;
  var before=null;
  for(var i=0;i<secs.length;i++){if(secs[i].idx>idx){before=secs[i].el;break}}
  flow.insertBefore(el,before);
  var s={idx:idx,el:el,pages:1,start:0};
  secs.push(s);secs.sort(function(a,b){return a.idx-b.idx});
  el.querySelectorAll('img').forEach(function(img){
    if(!img.complete){
      img.addEventListener('load',scheduleReflow,{once:true});
      img.addEventListener('error',scheduleReflow,{once:true});
    }
  });
  return s;
}
function setX(px,animate){flow.style.transition=animate?'transform .28s cubic-bezier(.22,.61,.36,1)':'none';flow.style.transform='translateX('+px+'px)'}
function sendPage(){
  var c=cur();
  if(c)send({type:'page',idx:c.idx,page:page-c.start,pages:c.pages,win:secs.map(function(s){return s.idx})});
}
function render(animate){
  setX(-page*W,animate);flow.style.opacity='1';
  sendPage();
  clearTimeout(anim);
  anim=setTimeout(settle,animate?300:0);
}
// 动画/拖拽结束后的稳定点：裁窗口到当前章 ±1（控内存），请求缺失邻章，回放排队的 add。
function settle(){
  clearTimeout(anim);anim=null;
  if(dragging)return;
  var c=cur();
  if(c){
    var removedLeft=0,keep=[];
    for(var i=0;i<secs.length;i++){
      var s=secs[i];
      if(Math.abs(s.idx-c.idx)>1){if(s.idx<c.idx)removedLeft+=s.pages;s.el.remove()}
      else keep.push(s);
    }
    if(keep.length!==secs.length){
      secs=keep;layout();
      if(removedLeft){page-=removedLeft;setX(-page*W,false)}
      sendPage();
    }
    for(var d=-1;d<=1;d+=2){
      var n=c.idx+d;
      if(n>=0&&n<total&&!has(n))send({type:'need',idx:n});
    }
  }
  while(pendingOps.length&&!busy())applyAdd(pendingOps.shift());
}
function applyAdd(cmd){
  if(!secs.length||has(cmd.idx))return;
  var first=secs[0].idx,last=secs[secs.length-1].idx;
  if(cmd.idx!==first-1&&cmd.idx!==last+1)return;
  var s=insertSec(cmd.idx,cmd.html);
  measureSec(s);layout();
  // 前插时把偏移一起平移，视口内容纹丝不动——用户完全无感。
  if(cmd.idx===first-1){page+=s.pages;setX(-page*W,false)}
  sendPage();
}
// 图片加载/旋转/字号主题变化后的整体重排：保持（当前章，章内页）不变，而非全局页号。
function reflow(){
  if(busy()){clearTimeout(reflowTimer);reflowTimer=setTimeout(reflow,120);return}
  if(!secs.length)return;
  var c=cur(),keepIdx=c?c.idx:0,local=c?page-c.start:0;
  W=vw();
  for(var i=0;i<secs.length;i++)measureSec(secs[i]);
  layout();
  var nc=null;
  for(var j=0;j<secs.length;j++)if(secs[j].idx===keepIdx)nc=secs[j];
  if(!nc)nc=secs[0];
  page=nc?nc.start+Math.max(0,Math.min(local,nc.pages-1)):0;
  render(false);
}
function scheduleReflow(){clearTimeout(reflowTimer);reflowTimer=setTimeout(reflow,80)}
function applyStyle(cmd){
  var r=document.documentElement.style;
  if(cmd.fs)r.setProperty('--fs',cmd.fs+'px');
  var c=cmd.colors;
  if(c){r.setProperty('--bg',c.bg);r.setProperty('--ink',c.ink);r.setProperty('--accent',c.accent);r.setProperty('--soft',c.soft);r.setProperty('--line',c.line);r.setProperty('--chrome',c.chrome)}
  if(secs.length)scheduleReflow();
}
function applyWindow(cmd){
  pendingOps=[];clearTimeout(anim);anim=null;dragging=false;swiping=false;
  for(var i=0;i<secs.length;i++)secs[i].el.remove();
  secs=[];total=Math.max(0,cmd.total|0);W=vw();
  var chapters=cmd.chapters||[];
  for(var j=0;j<chapters.length;j++)insertSec(chapters[j].idx,chapters[j].html);
  for(var k=0;k<secs.length;k++)measureSec(secs[k]);
  layout();
  var t=null;
  for(var m=0;m<secs.length;m++)if(secs[m].idx===cmd.idx)t=secs[m];
  if(!t)t=secs[0];
  if(t){
    var local=cmd.page|0;
    if(cmd.page<0)local=t.pages-1;
    page=t.start+Math.max(0,Math.min(local,t.pages-1));
  }else page=0;
  render(false);
}
// 统一命令入口：native 经 injectJavaScript 调 window.__readerCmd；web sandbox iframe 用 postMessage。
function handleCmd(cmd){
  if(!cmd)return;
  if(cmd.type==='style')applyStyle(cmd);
  else if(cmd.type==='window')applyWindow(cmd);
  else if(cmd.type==='add'){if(busy())pendingOps.push(cmd);else applyAdd(cmd)}
}
window.__readerCmd=handleCmd;
addEventListener('message',function(e){var c=e.data&&e.data.__yamiboReaderCmd;if(c)handleCmd(c)});
function bounce(dir){
  if(busy()||!secs.length)return;
  setX(-page*W-dir*34,true);
  anim=setTimeout(function(){anim=null;setX(-page*W,true);anim=setTimeout(settle,300)},160);
}
function go(dir){
  var t=page+dir;
  if(t<0){
    if(secs.length&&secs[0].idx>0)send({type:'blocked',dir:-1,idx:secs[0].idx-1});
    bounce(dir);return;
  }
  if(t>totalPages()-1){
    var l=secs[secs.length-1];
    if(l&&l.idx<total-1)send({type:'blocked',dir:1,idx:l.idx+1});
    bounce(dir);return;
  }
  page=t;render(true);
}
pager.addEventListener('pointerdown',function(e){
  clearTimeout(anim);anim=null;suppressClick=false;
  startX=e.clientX;startY=e.clientY;dragging=true;swiping=false;
  setX(-page*W,false);
});
pager.addEventListener('pointermove',function(e){
  if(!dragging)return;
  var dx=e.clientX-startX,dy=e.clientY-startY;
  if(!swiping&&Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy))swiping=true;
  if(swiping){
    e.preventDefault();
    var off=-page*W+dx,min=-(totalPages()-1)*W;
    if(off>0)off*=.35;else if(off<min)off=min+(off-min)*.35; // rubber-band at ends
    setX(off,false);
  }
});
function endDrag(e){
  if(!dragging)return;dragging=false;
  var dx=e.clientX-startX,dy=e.clientY-startY;
  if(swiping){
    suppressClick=true; // 滑动松手落在链接/按钮上时，吞掉随后的合成 click
    var threshold=Math.min(80,W*.18);
    if(dx<=-threshold)go(1);else if(dx>=threshold)go(-1);else render(true);
    return;
  }
  if(Math.abs(dx)>8||Math.abs(dy)>8)return;
  var el=e.target.closest&&e.target.closest('a,button');if(el)return;
  var ratio=e.clientX/W;
  if(ratio<.32)go(-1);else if(ratio>.68)go(1);else send({type:'toggleChrome'});
}
pager.addEventListener('pointerup',endDrag);
pager.addEventListener('pointercancel',function(){if(dragging){dragging=false;swiping=false;render(true)}});
// 内容是动态注入的，交互全部走事件委托（片段里不再有 id/独立监听器）。
pager.addEventListener('click',function(e){
  if(suppressClick){suppressClick=false;e.preventDefault();return}
  var t=e.target;if(!t||!t.closest)return;
  function secOf(el){var s=el.closest('.chap');return s?+s.dataset.idx:-1}
  var a=t.closest('a[data-link]');if(a){e.preventDefault();send({type:'link',href:a.href});return}
  var img=t.closest('[data-image]');if(img){send({type:'image',src:img.dataset.image,idx:secOf(img)});return}
  var cm=t.closest('.comments');if(cm){send({type:'comments',idx:secOf(cm)});return}
  var fl=t.closest('.floorlink');if(fl){send({type:'floor',idx:secOf(fl)})}
});
addEventListener('resize',scheduleReflow);
send({type:'ready'});
</script></body></html>`;
}
