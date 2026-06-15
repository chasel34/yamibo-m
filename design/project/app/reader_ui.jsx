// ===================== Reading mode — chrome, panels & states =====================
const RIcon = window.Icon;

// —— mini status line (reader-themed) ——
const RStatus = ({T}) => (
  <div style={{height:36, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 22px 0 26px",
    fontFamily:"var(--font-head)", color:T.ink, fontWeight:600}}>
    <span style={{fontSize:14, fontVariantNumeric:"tabular-nums"}}>9:08</span>
    <span style={{display:"flex", alignItems:"center", gap:6, opacity:.85}}>
      <svg width="17" height="11" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0.5" width="3" height="11.5" rx="1" opacity=".4"/></svg>
      <svg width="24" height="12" viewBox="0 0 26 13" fill="none"><rect x="0.5" y="0.5" width="21" height="12" rx="3.2" stroke="currentColor" opacity="0.4"/><rect x="2" y="2" width="15" height="9" rx="1.8" fill="currentColor"/><rect x="23" y="4" width="1.6" height="5" rx="0.8" fill="currentColor" opacity="0.4"/></svg>
    </span>
  </div>
);

// —— chapter progress slider ——
const ChapterSlider = ({total, chapterIdx, T, onJump}) => {
  const trackRef = React.useRef(null);
  const [drag, setDrag] = React.useState(null);   // previewed index while dragging
  const idx = drag!=null ? drag : chapterIdx;
  const ratio = total<=1 ? 1 : idx/(total-1);
  const pick = (clientX)=>{
    const r = trackRef.current.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX-r.left)/r.width));
    return Math.round(t*(total-1));
  };
  const start = (e)=>{ if(total<=1) return; e.stopPropagation(); const t=e.touches?e.touches[0]:e; setDrag(pick(t.clientX)); };
  const move = (e)=>{ if(drag==null) return; e.stopPropagation(); if(e.cancelable&&e.touches) e.preventDefault(); const t=e.touches?e.touches[0]:e; setDrag(pick(t.clientX)); };
  const end = (e)=>{ if(drag==null) return; e.stopPropagation(); const ni=drag; setDrag(null); if(ni!==chapterIdx) onJump(ni); };
  return (
    <div>
      <div className="row" style={{justifyContent:"space-between", marginBottom:9, fontFamily:"var(--font-head)", fontSize:12.5, color:T.soft}}>
        <span style={{color: drag!=null?T.accent:T.soft, fontWeight:drag!=null?700:500}}>第 {idx+1} 话</span>
        <span style={{fontVariantNumeric:"tabular-nums"}}>{total<=1?"短篇":(idx+1)+" / "+total}</span>
      </div>
      <div ref={trackRef} onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={(e)=>drag!=null&&end(e)}
        style={{position:"relative", height:26, display:"flex", alignItems:"center", cursor: total>1?"pointer":"default", touchAction:"none"}}>
        <div style={{position:"absolute", left:0, right:0, height:3, borderRadius:2, background:T.line}}></div>
        <div style={{position:"absolute", left:0, width:(ratio*100)+"%", height:3, borderRadius:2, background:T.accent, opacity:.85}}></div>
        <div style={{position:"absolute", left:`calc(${ratio*100}% - 9px)`, width:18, height:18, borderRadius:"50%",
          background:T.accent, boxShadow:"0 1px 4px rgba(0,0,0,.25)", transition: drag!=null?"none":"left .2s"}}></div>
      </div>
    </div>
  );
};

// —— chrome: top + bottom toolbars ——
const ReaderChrome = ({book, ch, T, total, chapterIdx, pct, onBack, onToc, onFont, onTheme, onJump, onPrevCh, onNextCh}) => {
  const {entered:ent, settled} = window.useEntered();
  const tr = settled ? "none" : "transform .3s cubic-bezier(.32,.72,.34,1)";
  const cb = (fn)=> (e)=>{ e.stopPropagation(); fn&&fn(); };
  const iconBtn = {width:42, height:42, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:T.ink, background:"transparent", border:"none"};
  const actBtn = {flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:5, padding:"6px 0", cursor:"pointer", color:T.ink, background:"none", border:"none", fontFamily:"var(--font-head)", fontSize:11.5, fontWeight:600};
  const chevBtn = (dis)=> ({width:38, height:38, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", cursor:dis?"default":"pointer", color:dis?T.soft:T.ink, opacity:dis?.4:1, background:"none", border:"none"});
  return (
    <>
      {/* top */}
      <div onClick={(e)=>e.stopPropagation()} style={{position:"absolute", top:0, left:0, right:0, zIndex:20,
        background:T.chrome, borderBottom:"1px solid "+T.line, boxShadow:"0 4px 24px rgba(30,18,12,.10)",
        transform: ent?"translateY(0)":"translateY(-100%)", transition:tr}}>
        <RStatus T={T}/>
        <div className="row" style={{padding:"2px 12px 12px", gap:6}}>
          <button onClick={cb(onBack)} style={iconBtn}><RIcon name="back" size={22}/></button>
          <div style={{flex:1, minWidth:0, textAlign:"center"}}>
            <div style={{fontFamily:"var(--font-head)", fontSize:15, fontWeight:700, color:T.ink, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{book.title}</div>
            <div style={{fontFamily:"var(--font-head)", fontSize:11.5, color:T.soft, marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{ch.title}</div>
          </div>
          <button onClick={cb(onToc)} style={iconBtn}><RIcon name="forum" size={21}/></button>
        </div>
      </div>

      {/* bottom */}
      <div onClick={(e)=>e.stopPropagation()} style={{position:"absolute", bottom:0, left:0, right:0, zIndex:20,
        background:T.chrome, borderTop:"1px solid "+T.line, boxShadow:"0 -4px 24px rgba(30,18,12,.10)", padding:"16px 22px 22px",
        transform: ent?"translateY(0)":"translateY(100%)", transition:tr}}>
        <div className="row" style={{gap:8, marginBottom:6}}>
          <button onClick={cb(onPrevCh)} style={chevBtn(chapterIdx===0)} disabled={chapterIdx===0}><RIcon name="back" size={20}/></button>
          <div style={{flex:1}}><ChapterSlider total={total} chapterIdx={chapterIdx} T={T} onJump={onJump}/></div>
          <button onClick={cb(onNextCh)} style={chevBtn(chapterIdx===total-1)} disabled={chapterIdx===total-1}><RIcon name="chevRight" size={20}/></button>
        </div>
        <div className="row" style={{borderTop:"1px solid "+T.line, marginTop:10, paddingTop:6}}>
          <button onClick={cb(onToc)} style={actBtn}><RIcon name="doc" size={21}/>目录</button>
          <button onClick={cb(onFont)} style={actBtn}><RIcon name="type" size={21}/>字号</button>
          <button onClick={cb(onTheme)} style={actBtn}><RIcon name="eye" size={21}/>主题</button>
        </div>
      </div>
    </>
  );
};

// —— bottom-sheet wrapper ——
const RSheet = ({T, onClose, children, title, right}) => {
  const {entered:ent, settled} = window.useEntered();
  const tr = settled ? "none" : "transform .32s cubic-bezier(.32,.72,.34,1)";
  const trs = settled ? "none" : "opacity .3s ease";
  return (
  <>
    <div onClick={onClose} style={{position:"absolute", inset:0, background:"rgba(20,12,8,.34)", zIndex:30, opacity:ent?1:0, transition:trs}}></div>
    <div onClick={(e)=>e.stopPropagation()} style={{position:"absolute", left:0, right:0, bottom:0, zIndex:31,
      background:T.chrome, borderTopLeftRadius:22, borderTopRightRadius:22, boxShadow:"0 -10px 44px rgba(30,18,12,.22)",
      padding:"18px 22px calc(22px + env(safe-area-inset-bottom))", maxHeight:"78%", display:"flex", flexDirection:"column",
      transform: ent?"translateY(0)":"translateY(102%)", transition:tr}}>
      {title!==undefined && (
        <div className="row" style={{justifyContent:"space-between", marginBottom:16}}>
          <span style={{fontFamily:"var(--font-head)", fontSize:16, fontWeight:700, color:T.ink}}>{title}</span>
          {right || <button onClick={onClose} style={{width:30, height:30, borderRadius:"50%", border:"none", background:"transparent", color:T.soft, cursor:"pointer"}}><RIcon name="close" size={18}/></button>}
        </div>
      )}
      {children}
    </div>
  </>
  );
};

// —— panels switch ——
const ReaderPanels = ({panel, setPanel, book, ch, T, total, chapterIdx, fontIdx, setFontIdx, setTheme, jumpChapter}) => {
  const close = ()=> setPanel(null);
  if(!panel) return null;

  if(panel==="toc") return <TocDrawer book={book} T={T} total={total} chapterIdx={chapterIdx} onClose={close} onPick={jumpChapter}/>;

  if(panel==="font"){
    const fpx = window.RFONTS[fontIdx];
    const stepBtn = (dis)=> ({width:52, height:52, borderRadius:14, border:"1px solid "+T.line, background:T.bg, color:dis?T.soft:T.ink, opacity:dis?.45:1, cursor:dis?"default":"pointer", fontFamily:"var(--font-head)", fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center"});
    return (
      <RSheet T={T} onClose={close} title="字号">
        <div className="row" style={{gap:14}}>
          <button onClick={()=>setFontIdx(fontIdx-1)} disabled={fontIdx===0} style={stepBtn(fontIdx===0)}><span style={{fontSize:16}}>A−</span></button>
          <div style={{flex:1, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 6px"}}>
            {window.RFONTS.map((_,i)=>(
              <div key={i} onClick={()=>setFontIdx(i)} style={{width:i===fontIdx?14:9, height:i===fontIdx?14:9, borderRadius:"50%",
                background:i<=fontIdx?T.accent:T.line, cursor:"pointer", transition:".18s"}}></div>
            ))}
          </div>
          <button onClick={()=>setFontIdx(fontIdx+1)} disabled={fontIdx===window.RFONTS.length-1} style={stepBtn(fontIdx===window.RFONTS.length-1)}><span style={{fontSize:24}}>A</span></button>
        </div>
        <div style={{marginTop:18, padding:"16px 16px", borderRadius:14, background:T.bg, border:"1px solid "+T.line}}>
          <div style={{fontFamily:"var(--font-body)", fontSize:fpx, lineHeight:1.95, color:T.ink, textIndent:"2em", textAlign:"justify"}}>
            天台的风比楼下要凉一些。她把校服外套往身上拢了拢，正文会按当前字号实时重排。
          </div>
          <div style={{textAlign:"right", marginTop:8, fontFamily:"var(--font-head)", fontSize:12, color:T.soft}}>当前 {fpx}px</div>
        </div>
      </RSheet>
    );
  }

  if(panel==="theme"){
    const cur = T.key;
    return (
      <RSheet T={T} onClose={close} title="阅读主题">
        <div className="row" style={{gap:12}}>
          {Object.values(window.RTHEMES).map(rt=>(
            <div key={rt.key} onClick={()=>setTheme(rt.key)} style={{flex:1, cursor:"pointer", textAlign:"center"}}>
              <div style={{height:64, borderRadius:14, background:rt.bg,
                border:(cur===rt.key? "2.5px solid "+T.accent : "1px solid "+rt.line),
                display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"inset 0 0 0 1px rgba(0,0,0,.02)"}}>
                <span style={{fontFamily:"var(--font-body)", fontSize:19, fontWeight:600, color:rt.ink}}>文</span>
              </div>
              <div style={{fontFamily:"var(--font-head)", fontSize:12.5, fontWeight:cur===rt.key?700:500, color:cur===rt.key?T.accent:T.soft, marginTop:8}}>{rt.name}</div>
            </div>
          ))}
        </div>
      </RSheet>
    );
  }

  if(panel==="comments"){
    const list = ch.comments;
    return (
      <RSheet T={T} onClose={close} title={"本章评论 · "+list.length}>
        <div className="rd-scroll" style={{overflowY:"auto", margin:"0 -4px"}}>
          {list.length===0 ? (
            <div style={{textAlign:"center", padding:"30px 0 36px"}}>
              <div style={{color:T.soft, display:"flex", justifyContent:"center", marginBottom:12}}><RIcon name="reply" size={30}/></div>
              <div style={{fontFamily:"var(--font-body)", fontSize:14.5, color:T.soft}}>还没有评论，来抢沙发吧～</div>
            </div>
          ) : list.map(c=>(
            <div key={c.id} style={{display:"flex", gap:11, padding:"14px 4px", borderBottom:"1px solid "+T.line}}>
              <div style={{width:34, height:34, borderRadius:"50%", flex:"0 0 auto", background:T.bg, border:"1px solid "+T.line,
                display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"var(--font-head)", fontWeight:600, fontSize:14, color:T.soft}}>{c.user.avatar}</div>
              <div style={{flex:1, minWidth:0}}>
                <div className="row" style={{gap:8, marginBottom:3}}>
                  <span style={{fontFamily:"var(--font-head)", fontSize:13.5, fontWeight:600, color:T.ink}}>{c.user.name}</span>
                  <span style={{fontFamily:"var(--font-head)", fontSize:11.5, color:T.soft}}>{c.time}</span>
                </div>
                <div style={{fontFamily:"var(--font-body)", fontSize:14.5, lineHeight:1.6, color:T.ink, opacity:.92}}>{c.text}</div>
                <div className="row" style={{gap:6, marginTop:7, color:T.soft, fontFamily:"var(--font-head)", fontSize:12}}>
                  <RIcon name="heart" size={14}/>{c.likes}
                </div>
              </div>
            </div>
          ))}
          <div style={{height:6}}></div>
        </div>
        <div style={{marginTop:12, height:46, borderRadius:999, background:T.bg, border:"1px solid "+T.line,
          display:"flex", alignItems:"center", padding:"0 18px", fontFamily:"var(--font-head)", fontSize:14, color:T.soft}}>写下本章评论…（v1 仅阅读）</div>
      </RSheet>
    );
  }
  return null;
};

// —— TOC drawer (left) ——
const TocDrawer = ({book, T, total, chapterIdx, onClose, onPick}) => {
  const {entered:ent, settled} = window.useEntered();
  const [rev, setRev] = React.useState(false);
  const list = rev ? book.chapters.slice().reverse() : book.chapters;
  const scRef = React.useRef(null);
  React.useEffect(()=>{
    // scroll current chapter into view within the drawer (no page scroll)
    const el = scRef.current; if(!el) return;
    const cur = el.querySelector("[data-cur='1']");
    if(cur) el.scrollTop = Math.max(0, cur.offsetTop - el.clientHeight*0.4);
  }, [rev]);
  return (
    <>
      <div onClick={onClose} style={{position:"absolute", inset:0, background:"rgba(20,12,8,.34)", zIndex:30, opacity:ent?1:0, transition: settled?"none":"opacity .3s ease"}}></div>
      <div onClick={(e)=>e.stopPropagation()} style={{position:"absolute", top:0, bottom:0, left:0, width:"84%", maxWidth:330, zIndex:31,
        background:T.chrome, boxShadow:"10px 0 44px rgba(30,18,12,.26)", display:"flex", flexDirection:"column",
        transform: ent?"translateX(0)":"translateX(-102%)", transition: settled?"none":"transform .32s cubic-bezier(.32,.72,.34,1)"}}>
        <RStatus T={T}/>
        <div style={{padding:"6px 20px 16px", borderBottom:"1px solid "+T.line}}>
          <div style={{fontFamily:"var(--font-head)", fontSize:18, fontWeight:700, color:T.ink}}>{book.title}</div>
          <div className="row" style={{justifyContent:"space-between", marginTop:6}}>
            <span style={{fontFamily:"var(--font-head)", fontSize:12.5, color:T.soft}}>{window.BOOKS.chapterCountText(book)} · {book.statusText}</span>
            <span onClick={()=>setRev(!rev)} style={{fontFamily:"var(--font-head)", fontSize:12.5, fontWeight:600, color:T.accent, cursor:"pointer"}}>{rev?"倒序":"正序"} ⇅</span>
          </div>
        </div>
        <div ref={scRef} className="rd-scroll" style={{flex:1, overflowY:"auto"}}>
          {list.map(c=>{
            const cur = c.no-1===chapterIdx;
            return (
              <div key={c.id} data-cur={cur?"1":"0"} onClick={()=>onPick(c.no-1)}
                style={{display:"flex", alignItems:"center", gap:12, padding:"14px 20px", cursor:"pointer",
                  borderLeft:(cur? "3px solid "+T.accent : "3px solid transparent"), background: cur? T.bg : "transparent"}}>
                <span style={{fontFamily:"var(--font-head)", fontSize:12.5, fontWeight:700, color:cur?T.accent:T.soft, flex:"0 0 38px", fontVariantNumeric:"tabular-nums"}}>{c.no.toString().padStart(2,"0")}</span>
                <span style={{flex:1, minWidth:0, fontFamily:"var(--font-head)", fontSize:14.5, fontWeight:cur?700:500, color:cur?T.accent:T.ink,
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{c.title.replace(/^第\d+话 · /,"")}</span>
                {cur && <span style={{fontFamily:"var(--font-head)", fontSize:11, fontWeight:600, color:T.accent}}>在读</span>}
              </div>
            );
          })}
          <div style={{height:14}}></div>
        </div>
      </div>
    </>
  );
};

// —— states: loading / resume / error ——
const ReaderStates = ({phase, setPhase, T, book, saved, onResume, onRestart, onRetry, onExit}) => {
  if(phase==="reading") return null;

  if(phase==="loading") return (
    <div style={{position:"absolute", inset:0, zIndex:40, background:T.bg, color:T.ink,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:18}}>
      <div className="rd-spin"></div>
      <div style={{fontFamily:"var(--font-head)", fontSize:14, color:T.soft}}>正在载入…</div>
    </div>
  );

  if(phase==="resume") return (
    <div style={{position:"absolute", inset:0, zIndex:40, background:T.bg, color:T.ink, display:"flex", flexDirection:"column"}}>
      <RStatus T={T}/>
      <div className="row" style={{padding:"2px 14px"}}>
        <button onClick={onExit} style={{width:42, height:42, borderRadius:"50%", border:"none", background:"transparent", color:T.ink, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center"}}><RIcon name="back" size={22}/></button>
      </div>
      <div style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 34px", textAlign:"center"}}>
        <div style={{width:58, height:58, borderRadius:16, background:T.accent, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:22}}>
          <RIcon name="history" size={28}/>
        </div>
        <div style={{fontFamily:"var(--font-head)", fontSize:13, fontWeight:700, letterSpacing:"2px", color:T.accent, textTransform:"uppercase"}}>上次读到</div>
        <div style={{fontFamily:"var(--font-body)", fontSize:19, fontWeight:600, color:T.ink, margin:"14px 0 8px", lineHeight:1.45, maxWidth:300}}>{saved && saved.chapterTitle}</div>
        <div style={{fontFamily:"var(--font-head)", fontSize:13.5, color:T.soft}}>已读 {saved && saved.pct}% · {book.title}</div>
        <button onClick={onResume} style={{width:"100%", maxWidth:300, height:52, borderRadius:999, border:"none", background:T.accent, color:"#fff",
          fontFamily:"var(--font-head)", fontSize:16, fontWeight:600, cursor:"pointer", marginTop:34}}>继续阅读</button>
        <button onClick={onRestart} style={{width:"100%", maxWidth:300, height:50, borderRadius:999, marginTop:12, cursor:"pointer",
          border:"1px solid "+T.line, background:"transparent", color:T.soft, fontFamily:"var(--font-head)", fontSize:15, fontWeight:600}}>从头开始</button>
      </div>
    </div>
  );

  if(phase==="error") return (
    <div style={{position:"absolute", inset:0, zIndex:40, background:T.bg, color:T.ink, display:"flex", flexDirection:"column"}}>
      <RStatus T={T}/>
      <div className="row" style={{padding:"2px 14px"}}>
        <button onClick={onExit} style={{width:42, height:42, borderRadius:"50%", border:"none", background:"transparent", color:T.ink, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center"}}><RIcon name="back" size={22}/></button>
      </div>
      <div style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 40px", textAlign:"center"}}>
        <div style={{width:58, height:58, borderRadius:"50%", border:"1.5px solid "+T.line, color:T.soft, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:22}}>
          <RIcon name="wave" size={28}/>
        </div>
        <div style={{fontFamily:"var(--font-head)", fontSize:17, fontWeight:700, color:T.ink}}>网络开小差了</div>
        <div style={{fontFamily:"var(--font-body)", fontSize:14.5, color:T.soft, marginTop:10, lineHeight:1.7}}>本章加载失败，请检查网络后重试。</div>
        <button onClick={onRetry} style={{width:"100%", maxWidth:280, height:50, borderRadius:999, border:"none", background:T.accent, color:"#fff",
          fontFamily:"var(--font-head)", fontSize:15.5, fontWeight:600, cursor:"pointer", marginTop:30, display:"flex", alignItems:"center", justifyContent:"center", gap:9}}>
          <RIcon name="refresh" size={19}/>重试
        </button>
      </div>
    </div>
  );
  return null;
};

Object.assign(window, { ReaderChrome, ReaderPanels, ReaderStates, TocDrawer, RSheet, ChapterSlider });
