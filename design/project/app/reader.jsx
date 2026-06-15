// ===================== Reading mode — core reader =====================
// Immersive, horizontally paginated novel reader. CSS multi-column pagination
// (text reflows live on font-size change), swipe + tap-zone navigation, chapter
// flow, chrome toggle, progress memory, and the loading/resume/end/error states.

// —— reader themes (independent of app light/dark) ——
const RTHEMES = {
  paper: {key:"paper", name:"纸白", bg:"#fbf9f6", ink:"#2c2420", soft:"#9a8980", line:"rgba(60,40,32,.10)", chrome:"#ffffff", accent:"#ad473c"},
  sepia: {key:"sepia", name:"米黄", bg:"#f0e3c9", ink:"#4a3a26", soft:"#9c8559", line:"rgba(80,55,25,.13)", chrome:"#f6ecd8", accent:"#9c5a2e"},
  green: {key:"green", name:"护眼", bg:"#d2e2cb", ink:"#2f3d29", soft:"#647a58", line:"rgba(40,60,30,.14)", chrome:"#dcebd6", accent:"#4a7a3e"},
  night: {key:"night", name:"夜间", bg:"#14110e", ink:"#c6b7ac", soft:"#7c6a5f", line:"rgba(255,240,230,.10)", chrome:"#211a16", accent:"#e0897b"},
};
const RFONTS = [16, 18, 20, 22, 24];        // 字号档位
window.RTHEMES = RTHEMES; window.RFONTS = RFONTS;
const PT = 52, PB = 56, PX = 27;            // reading-area padding (top / bottom / side)

// —— persistent reading position ——
window.ReaderProgress = {
  get(bookId){ try{ return JSON.parse(localStorage.getItem("yh_rd_pos_"+bookId)||"null"); }catch(e){ return null; } },
  save(bookId, pos){ try{ localStorage.setItem("yh_rd_pos_"+bookId, JSON.stringify(pos)); }catch(e){} },
};
const getRTheme = ()=> RTHEMES[localStorage.getItem("yh_rd_theme")] || RTHEMES.paper;
const getRFontIdx = ()=>{ const v=parseInt(localStorage.getItem("yh_rd_font"),10); return isNaN(v)?1:Math.max(0,Math.min(RFONTS.length-1,v)); };

// inject reader-only CSS once
(function injectReaderCSS(){
  if(document.getElementById("rd-css")) return;
  const s = document.createElement("style"); s.id="rd-css";
  s.textContent = `
  .rd-cols{ height:100%; width:100%; box-sizing:border-box;
    column-fill:auto; -webkit-column-fill:auto; will-change:transform; }
  .rd-cols *{ break-inside:avoid; -webkit-column-break-inside:avoid; }
  .rd-para{ break-inside:auto; -webkit-column-break-inside:auto; }
  .rd-scroll{ overflow-y:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
  .rd-scroll::-webkit-scrollbar{ display:none; width:0; }
  .rd-spin{ width:26px; height:26px; border:2.5px solid currentColor; border-top-color:transparent; border-radius:50%; animation: rdRot .7s linear infinite; opacity:.7; }
  @keyframes rdRot{ to{ transform:rotate(360deg);} }
  `;
  document.head.appendChild(s);
})();

// —— a single flow block rendered into the column layout ——
const RBlock = ({b, T, fpx, onImg, onLink, onComments}) => {
  if(b.t==="head") return (
    <div style={{textAlign:"center", padding:"34px 0 30px", breakAfter:"avoid"}}>
      <div style={{fontFamily:"var(--font-head)", fontSize:12, fontWeight:700, letterSpacing:"3px",
        color:T.accent, textTransform:"uppercase"}}>第 {b.no} 话</div>
      <div style={{fontFamily:"var(--font-body)", fontSize:fpx+3, fontWeight:600, color:T.ink, marginTop:12, lineHeight:1.4, padding:"0 6px"}}>{b.title}</div>
      <div style={{width:30, height:2, background:T.accent, opacity:.5, margin:"20px auto 0"}}></div>
    </div>
  );
  if(b.t==="text") return (
    <p className="rd-para" style={{fontFamily:"var(--font-body)", fontSize:fpx, lineHeight:1.95, color:T.ink,
      margin:"0 0 0.95em", textIndent:"2em", textAlign:"justify"}}>{b.v}</p>
  );
  if(b.t==="quote") return (
    <div style={{borderLeft:"2px solid "+T.accent, padding:"4px 0 4px 14px", margin:"6px 0 1em", opacity:.92}}>
      <div style={{fontFamily:"var(--font-head)", fontSize:fpx-5, fontWeight:600, color:T.accent, marginBottom:5}}>{b.who}</div>
      <div style={{fontFamily:"var(--font-body)", fontSize:fpx-2, lineHeight:1.75, color:T.soft}}>{b.v}</div>
    </div>
  );
  if(b.t==="link") return (
    <p style={{margin:"0 0 1em", textIndent:"2em"}}>
      <span onClick={()=>onLink&&onLink(b.v)} style={{fontFamily:"var(--font-body)", fontSize:fpx, color:T.accent,
        textDecoration:"underline", textUnderlineOffset:"3px", cursor:"pointer"}}>{b.v} ↗</span>
    </p>
  );
  if(b.t==="img") return (
    <div onClick={()=>onImg&&onImg(b.cap)} style={{margin:"4px 0 1.1em", cursor:"pointer"}}>
      <div style={{height:200, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center",
        background:`repeating-linear-gradient(135deg, ${T.line} 0 9px, transparent 9px 18px), ${T.chrome}`}}>
        <span style={{fontFamily:"ui-monospace, Menlo, monospace", fontSize:10.5, color:T.soft,
          background:T.bg, padding:"3px 9px", borderRadius:6}}>{b.cap} · 点按放大</span>
      </div>
    </div>
  );
  if(b.t==="finis") return (
    <div style={{textAlign:"center", fontFamily:"var(--font-head)", fontSize:fpx-4, color:T.soft, letterSpacing:"2px", padding:"22px 0 18px"}}>· 本话完 ·</div>
  );
  if(b.t==="cmt") return (
    <div onClick={()=>onComments&&onComments()} style={{margin:"4px 0 16px", padding:"15px 16px", borderRadius:14,
      border:"1px solid "+T.line, background:T.chrome, cursor:"pointer", display:"flex", alignItems:"center", gap:12}}>
      <span style={{display:"flex", color:T.accent}}><window.Icon name="reply" size={19}/></span>
      <div style={{flex:1}}>
        <div style={{fontFamily:"var(--font-head)", fontSize:fpx-5, fontWeight:600, color:T.ink}}>本章评论</div>
        <div style={{fontFamily:"var(--font-head)", fontSize:fpx-7, color:T.soft, marginTop:2}}>
          {b.n>0 ? b.n+" 条 · 点按展开，不打断阅读" : "还没有评论 · 来抢沙发"}
        </div>
      </div>
      <window.Icon name="chevRight" size={17} style={{color:T.soft}}/>
    </div>
  );
  if(b.t==="bookend") return (
    <div style={{textAlign:"center", padding:"30px 10px 24px", breakBefore:"avoid"}}>
      <div style={{width:46, height:46, borderRadius:13, margin:"0 auto 16px", background:T.accent, color:"#fff",
        display:"flex", alignItems:"center", justifyContent:"center"}}>
        <window.Icon name={b.complete?"check":"sprout"} size={23}/>
      </div>
      <div style={{fontFamily:"var(--font-head)", fontSize:fpx, fontWeight:700, color:T.ink}}>
        {b.complete ? "全文完" : "已读至最新一话"}
      </div>
      <div style={{fontFamily:"var(--font-body)", fontSize:fpx-4, color:T.soft, marginTop:8, lineHeight:1.7}}>
        {b.complete ? "感谢陪伴到故事的最后。" : "作者仍在连载中，待更新～\n收藏本书，有新章节会通知你。"}
      </div>
    </div>
  );
  return null;
};

// —— build the full flow array for a chapter ——
function chapterFlow(book, ci){
  const ch = book.chapters[ci];
  const flow = [{t:"head", no:ch.no, title:ch.title.replace(/^第\d+话 · /,"")}, ...ch.blocks, {t:"finis"}];
  flow.push({t:"cmt", n:ch.comments.length});
  if(ci===book.chapters.length-1) flow.push({t:"bookend", complete: book.status==="complete"});
  return flow;
}

const Reader = ({bookId, fresh}) => {
  const nav = window.useNav();
  const book = React.useMemo(()=> window.BOOKS.get(bookId), [bookId]);
  const total = book.chapters.length;
  const saved = window.ReaderProgress.get(bookId);

  const [theme, setThemeState] = React.useState(getRTheme);
  const [fontIdx, setFontIdxState] = React.useState(getRFontIdx);
  const T = theme; const fpx = RFONTS[fontIdx];

  const initCh = (!fresh && saved) ? Math.min(total-1, saved.chapter||0) : 0;
  const [chapterIdx, setChapterIdx] = React.useState(initCh);
  const [pageIdx, setPageIdx] = React.useState(0);
  const [pages, setPages] = React.useState([[0, 0]]);   // [ [startBlock, endBlock] ] per page
  const pageCount = pages.length;
  const [chrome, setChrome] = React.useState(false);
  const [panel, setPanel] = React.useState(null);     // toc|font|theme|comments
  const [phase, setPhase] = React.useState(()=> (!fresh && saved) ? "resume" : "loading");
  const [hint, setHint] = React.useState(()=> localStorage.getItem("yh_rd_hint")!=="1");

  const pagerRef = React.useRef(null);
  const measRef = React.useRef(null);
  const [dim, setDim] = React.useState({w:0,h:0});
  const [dx, setDx] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [instant, setInstant] = React.useState(false);
  const [glide, setGlide] = React.useState(false);
  const dragMeta = React.useRef({x:0,y:0,t:0,axis:null});
  const pendLast = React.useRef(false);
  const savedPage = React.useRef((!fresh && saved) ? (saved.page||0) : 0);

  const ch = book.chapters[chapterIdx];
  const flow = React.useMemo(()=> chapterFlow(book, chapterIdx), [book, chapterIdx]);
  const chImgs = React.useMemo(()=> ch.blocks.filter(b=>b.t==="img").map(b=>({cap:b.cap})), [ch]);

  const setTheme = (t)=>{ setThemeState(RTHEMES[t]); localStorage.setItem("yh_rd_theme", t); };
  const setFontIdx = (i)=>{ const v=Math.max(0,Math.min(RFONTS.length-1,i)); setFontIdxState(v); localStorage.setItem("yh_rd_font", v); };

  // measure container size (drives re-pagination)
  React.useLayoutEffect(()=>{
    const el = pagerRef.current; if(!el) return;
    const apply = ()=> setDim({w:el.clientWidth, h:el.clientHeight});
    const ro = new ResizeObserver(apply);
    ro.observe(el); apply();
    return ()=> ro.disconnect();
  }, []);

  // re-paginate after layout settles — measure each block, greedily pack into pages
  React.useLayoutEffect(()=>{
    const pager = pagerRef.current, m = measRef.current;
    if(!pager || !m) return;
    const id = setTimeout(()=>{
      const w = pager.clientWidth, h = pager.clientHeight;
      if(!w || !h) return;
      const contentH = Math.max(120, h - PT - PB);
      const kids = Array.from(m.children);
      if(!kids.length){ setPages([[0,0]]); return; }
      const base = kids[0].offsetTop;
      const out = []; let start = 0; let top0 = 0;
      for(let i=0;i<kids.length;i++){
        const top = kids[i].offsetTop - base;
        const bottom = top + kids[i].offsetHeight;
        if(i>start && (bottom - top0) > contentH){ out.push([start, i-1]); start = i; top0 = top; }
        if(i===start) top0 = top;
      }
      out.push([start, kids.length-1]);
      setPages(out);
      const count = out.length;
      if(pendLast.current){ pendLast.current=false; setInstant(true); setPageIdx(count-1); setTimeout(()=>setInstant(false), 30); }
      else if(savedPage.current){ const p=Math.min(count-1, savedPage.current); savedPage.current=0; setInstant(true); setPageIdx(p); setTimeout(()=>setInstant(false), 30); }
      else { setPageIdx(p=> Math.min(p, count-1)); setTimeout(()=>setInstant(false), 30); }
    }, 40);
    return ()=> clearTimeout(id);
  }, [chapterIdx, fontIdx, dim.w, dim.h, phase]);

  // initial loading shim
  React.useEffect(()=>{
    if(phase==="loading"){ const t=setTimeout(()=> setPhase("reading"), 520); return ()=>clearTimeout(t); }
  }, [phase]);

  // persist progress
  const pct = Math.max(1, Math.min(100, Math.round(((chapterIdx + (pageIdx+1)/Math.max(1,pageCount)) / total) * 100)));
  React.useEffect(()=>{
    if(phase!=="reading") return;
    window.ReaderProgress.save(bookId, {chapter:chapterIdx, page:pageIdx, pct, chapterTitle: ch.title, ts:Date.now()});
  }, [chapterIdx, pageIdx, pageCount, phase]);

  // hint auto-dismiss
  React.useEffect(()=>{
    if(phase==="reading" && hint){ const t=setTimeout(()=>{ setHint(false); localStorage.setItem("yh_rd_hint","1"); }, 3200); return ()=>clearTimeout(t); }
  }, [phase, hint]);

  // glide animation on page change, then settle to transition:none (frozen-clock safe)
  React.useEffect(()=>{ setGlide(true); const t=setTimeout(()=>setGlide(false), 340); return ()=>clearTimeout(t); }, [pageIdx]);

  // —— navigation ——
  const advChapter = (dir)=>{
    const ni = chapterIdx + dir;
    if(ni<0 || ni>=total) return false;
    if(dir<0) pendLast.current = true;
    setInstant(true); setChapterIdx(ni); setPageIdx(0); setDx(0);
    return true;
  };
  const nextPage = ()=>{ if(pageIdx < pageCount-1) setPageIdx(pageIdx+1); else advChapter(1); };
  const prevPage = ()=>{ if(pageIdx > 0) setPageIdx(pageIdx-1); else advChapter(-1); };
  const jumpChapter = (ni)=>{
    if(ni===chapterIdx){ setPanel(null); return; }
    setPanel(null); setPhase("loading");
    setTimeout(()=>{ setInstant(true); setChapterIdx(ni); setPageIdx(0); savedPage.current=0; pendLast.current=false; setPhase("reading"); }, 480);
  };

  // —— gestures ——
  const onStart = (e)=>{
    if(phase!=="reading") return;
    const t = e.touches? e.touches[0]:e;
    dragMeta.current = {x:t.clientX, y:t.clientY, t:Date.now(), axis:null};
    setDragging(true);
  };
  const onMove = (e)=>{
    if(!dragging) return;
    const t = e.touches? e.touches[0]:e;
    const mx = t.clientX - dragMeta.current.x, my = t.clientY - dragMeta.current.y;
    if(dragMeta.current.axis===null && (Math.abs(mx)>7||Math.abs(my)>7)) dragMeta.current.axis = Math.abs(mx)>Math.abs(my)?"x":"y";
    if(dragMeta.current.axis!=="x") return;
    if(e.cancelable) e.preventDefault();
    let d = mx;
    const atStart = chapterIdx===0 && pageIdx===0;
    const atEnd = chapterIdx===total-1 && pageIdx===pageCount-1;
    if((atStart && d>0) || (atEnd && d<0)) d = d*0.3;
    setDx(d);
  };
  const onEnd = (e)=>{
    if(!dragging) return;
    const w = dim.w||1; const meta = dragMeta.current;
    setDragging(false);
    if(meta.axis==="x"){
      const thr = Math.min(80, w*0.2);
      if(dx <= -thr) nextPage(); else if(dx >= thr) prevPage();
      setDx(0); return;
    }
    if(meta.axis===null){
      // tap
      const x = (e.changedTouches? e.changedTouches[0].clientX : e.clientX) - pagerRef.current.getBoundingClientRect().left;
      const r = x / w;
      if(panel){ setPanel(null); return; }
      if(chrome){ setChrome(false); return; }
      if(r < 0.32) prevPage();
      else if(r > 0.68) nextPage();
      else setChrome(true);
      setDx(0);
    }
  };

  // imperative demo hooks (for state capture; harmless in product)
  React.useEffect(()=>{ window.__rd = {setPhase, setPanel, setChrome, jumpChapter, nextPage, prevPage, setTheme, setFontIdx, setPageIdx, goLast:()=>setPageIdx(Math.max(0,pages.length-1)), dim, pageCount, pagesLen:pages.length, phase, total, chapterIdx}; });

  const transition = (dragging || instant || !glide) ? "none" : "transform .32s cubic-bezier(.32,.72,.34,1)";
  const contentW = dim.w ? dim.w - PX*2 : 320;
  const renderBlock = (b,i)=>(
    <RBlock key={i} b={b} T={T} fpx={fpx}
      onImg={(cap)=>{ const idx=Math.max(0,chImgs.findIndex(x=>x.cap===cap)); nav.openViewer(chImgs.length?chImgs:[{cap}], idx); }}
      onLink={(v)=>nav.toast("链接：将跳转网页 · "+v)}
      onComments={()=>setPanel("comments")}/>
  );

  return (
    <div style={{position:"absolute", inset:0, background:T.bg, color:T.ink, overflow:"hidden", isolation:"isolate"}}>
      {/* hidden measuring layer (same width & styling as a page's content column) */}
      <div ref={measRef} aria-hidden="true" style={{position:"absolute", left:-99999, top:0, width:contentW, visibility:"hidden", pointerEvents:"none"}}>
        {flow.map(renderBlock)}
      </div>

      {/* page surface — horizontal track of full-width page panels */}
      <div ref={pagerRef} style={{position:"absolute", inset:0, touchAction:"pan-y", overflow:"hidden"}}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={(e)=>dragging&&onEnd(e)}>
        <div style={{display:"flex", height:"100%", width:"100%",
          transform:`translateX(calc(${-pageIdx*100}% + ${dx}px))`, transition}}>
          {pages.map((pg,pi)=>(
            <div key={chapterIdx+"-"+pi} style={{flex:"0 0 100%", height:"100%", overflow:"hidden", padding:`${PT}px ${PX}px ${PB}px`, boxSizing:"border-box"}}>
              {flow.slice(pg[0], pg[1]+1).map((b,k)=> renderBlock(b, pg[0]+k))}
            </div>
          ))}
        </div>
      </div>

      {/* footer (immersive) */}
      {!chrome && phase==="reading" && (
        <div style={{position:"absolute", left:0, right:0, bottom:0, display:"flex", justifyContent:"space-between",
          padding:"0 "+PX+"px 14px", pointerEvents:"none", fontFamily:"var(--font-head)", fontSize:11.5, color:T.soft}}>
          <span style={{maxWidth:"60%", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis"}}>{ch.title}</span>
          <span style={{fontVariantNumeric:"tabular-nums"}}>{pageIdx+1}/{pageCount} · {pct}%</span>
        </div>
      )}

      {/* first-time hint */}
      {hint && phase==="reading" && !chrome && (
        <div onClick={()=>{setHint(false); localStorage.setItem("yh_rd_hint","1");}}
          style={{position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", zIndex:8, pointerEvents:"none"}}>
          <div style={{display:"flex", width:"100%", height:"60%", opacity:.96}}>
            {["上一页","唤出菜单","下一页"].map((t,k)=>(
              <div key={k} style={{flex:k===1?"0 0 36%":"1", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                gap:8, color:"#fff", background:"rgba(20,14,11,"+(k===1?".42":".30")+")", borderLeft:k? "1px solid rgba(255,255,255,.15)":"none"}}>
                <window.Icon name={k===1?"forum":(k?"chevRight":"back")} size={22}/>
                <span style={{fontFamily:"var(--font-head)", fontSize:12.5, fontWeight:600}}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* chrome: top + bottom bars */}
      {chrome && phase==="reading" && (
        <window.ReaderChrome
          book={book} ch={ch} T={T} total={total} chapterIdx={chapterIdx} pct={pct}
          onBack={()=>nav.pop()} onToc={()=>setPanel("toc")} onFont={()=>setPanel("font")}
          onTheme={()=>setPanel("theme")} onJump={jumpChapter}
          onPrevCh={()=>{ if(chapterIdx>0) jumpChapter(chapterIdx-1); }}
          onNextCh={()=>{ if(chapterIdx<total-1) jumpChapter(chapterIdx+1); }}/>
      )}

      {/* panels & overlays */}
      <window.ReaderPanels
        panel={panel} setPanel={setPanel} book={book} ch={ch} T={T} total={total}
        chapterIdx={chapterIdx} fontIdx={fontIdx} setFontIdx={setFontIdx}
        setTheme={setTheme} jumpChapter={jumpChapter}/>

      <window.ReaderStates phase={phase} setPhase={setPhase} T={T} book={book} saved={saved}
        onResume={()=>{ savedPage.current = (saved&&saved.page)||0; setChapterIdx((saved&&saved.chapter)||0); setPhase("loading"); }}
        onRestart={()=>{ savedPage.current=0; setChapterIdx(0); setPageIdx(0); setPhase("loading"); }}
        onRetry={()=> setPhase("loading")} onExit={()=>nav.pop()}/>
    </div>
  );
};

Object.assign(window, { Reader, RBlock, getRTheme, getRFontIdx, chapterFlow, useEntered });

// settle-safe entrance: transform/opacity driven by state + transition, then transition is
// dropped once settled — so the resting state is reached even when the clock is throttled
// (CSS transitions freeze in this iframe; forcing transition:none snaps to the target).
function useEntered(){
  const [e, setE] = React.useState(false);
  const [s, setS] = React.useState(false);
  React.useEffect(()=>{
    const a = setTimeout(()=> setE(true), 20);
    const b = setTimeout(()=> setS(true), 380);
    return ()=>{ clearTimeout(a); clearTimeout(b); };
  }, []);
  return {entered:e, settled:s};
}
window.useEntered = useEntered;
