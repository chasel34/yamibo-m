// ===================== Reading mode — content-preservation interactions =====================
// 内容保全优先：首次整理楼主内容（进度 / 失败）、缓存与更新检查的轻提示、
// 更多操作（检查更新 / 重新整理全文 / 查看原楼层）、重新整理二次确认。
// 全部保持克制、轻盈，提示降低焦虑而非报错。
const OIc = window.Icon;

// 整理结果文案（按 book.update 区分）
window.UpdateCopy = {
  new:        {icon:"sparkle", text:"发现新内容，已加入目录", tone:"accent",  action:null},
  fail:       {icon:"wave",    text:"暂时无法检查更新，已使用本地整理结果", tone:"soft", action:null},
  restructure:{icon:"layers",  text:"帖子结构可能有变化，建议重新整理", tone:"soft", action:"redo"},
  none:       {icon:"check",   text:"已是最新整理结果", tone:"soft", action:null},
};

// —— 顶部轻提示浮层：检查更新 / 更新结果（不打断阅读，可关闭）——
const UpdateBanner = ({T, state, onAction, onClose}) => {
  const {entered:ent, settled} = window.useEntered();
  if(!state) return null;
  const tr = settled ? "none" : "transform .3s cubic-bezier(.32,.72,.34,1), opacity .3s ease";
  const checking = state.mode==="checking";
  const c = checking ? null : (window.UpdateCopy[state.mode] || window.UpdateCopy.none);
  return (
    <div style={{position:"absolute", top:14, left:0, right:0, zIndex:18, display:"flex", justifyContent:"center", pointerEvents:"none"}}>
      <div style={{pointerEvents:"auto", display:"flex", alignItems:"center", gap:9, maxWidth:"86%",
        background:T.chrome, color:T.ink, border:"1px solid "+T.line, borderRadius:999,
        boxShadow:"0 6px 24px rgba(30,18,12,.14)", padding:"8px 8px 8px 14px",
        transform: ent?"translateY(0)":"translateY(-16px)", opacity:ent?1:0, transition:tr}}>
        {checking ? (
          <><span className="rd-spin" style={{width:15, height:15, borderWidth:2}}></span>
            <span style={{fontFamily:"var(--font-head)", fontSize:12.5, fontWeight:500, color:T.soft}}>正在检查更新…</span></>
        ) : (
          <>
            <span style={{display:"flex", color: c.tone==="accent"?T.accent:T.soft, flex:"0 0 auto"}}><OIc name={c.icon} size={16}/></span>
            <span style={{fontFamily:"var(--font-head)", fontSize:12.5, fontWeight:600, color:T.ink, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{c.text}</span>
            {c.action==="redo" && (
              <button onClick={onAction} style={{flex:"0 0 auto", border:"none", background:T.accent, color:"#fff",
                fontFamily:"var(--font-head)", fontSize:12, fontWeight:600, height:26, padding:"0 12px", borderRadius:999, cursor:"pointer"}}>重新整理</button>
            )}
            <button onClick={onClose} style={{flex:"0 0 auto", width:26, height:26, borderRadius:"50%", border:"none",
              background:"transparent", color:T.soft, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center"}}><OIc name="close" size={15}/></button>
          </>
        )}
      </div>
    </div>
  );
};

// —— 首次/重新整理楼主内容：进度页 + 失败页（接近阅读器加载态）——
const OrganizeView = ({T, book, mode, error, read, total, onCancel, onRetry}) => {
  const pct = Math.max(0, Math.min(1, total? read/total : 0));

  if(error) return (
    <div style={{position:"absolute", inset:0, zIndex:42, background:T.bg, color:T.ink, display:"flex", flexDirection:"column"}}>
      <window.RStatus T={T}/>
      <div className="row" style={{padding:"2px 14px"}}>
        <button onClick={onCancel} style={obtn(T)}><OIc name="back" size={22}/></button>
      </div>
      <div style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 40px", textAlign:"center"}}>
        <div style={{width:54, height:54, borderRadius:"50%", border:"1.5px solid "+T.line, color:T.soft,
          display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20}}><OIc name="wave" size={26}/></div>
        <div style={{fontFamily:"var(--font-head)", fontSize:17, fontWeight:700, color:T.ink}}>整理失败</div>
        <div style={{fontFamily:"var(--font-body)", fontSize:14.5, color:T.soft, marginTop:11, lineHeight:1.7}}>
          网络不稳定，已读取 {read} / {total} 页。
        </div>
        <button onClick={onRetry} style={{width:"100%", maxWidth:280, height:50, borderRadius:999, border:"none", background:T.accent, color:"#fff",
          fontFamily:"var(--font-head)", fontSize:15.5, fontWeight:600, cursor:"pointer", marginTop:28, display:"flex", alignItems:"center", justifyContent:"center", gap:9}}>
          <OIc name="refresh" size={19}/>重试
        </button>
        <button onClick={onCancel} style={{width:"100%", maxWidth:280, height:48, borderRadius:999, marginTop:11, cursor:"pointer",
          border:"1px solid "+T.line, background:"transparent", color:T.soft, fontFamily:"var(--font-head)", fontSize:15, fontWeight:600}}>返回帖子</button>
      </div>
    </div>
  );

  return (
    <div style={{position:"absolute", inset:0, zIndex:42, background:T.bg, color:T.ink, display:"flex", flexDirection:"column"}}>
      <window.RStatus T={T}/>
      <div className="row" style={{padding:"2px 14px"}}>
        <button onClick={onCancel} style={obtn(T)}><OIc name="back" size={22}/></button>
      </div>
      <div style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 42px", textAlign:"center"}}>
        {/* 克制的整理指示：三点轻脉动 */}
        <div style={{display:"flex", gap:7, marginBottom:26}}>
          {[0,1,2].map(i=>(
            <span key={i} style={{width:8, height:8, borderRadius:"50%", background:T.accent,
              animation:"orgPulse 1.1s ease-in-out infinite", animationDelay:(i*0.16)+"s"}}></span>
          ))}
        </div>
        <div style={{fontFamily:"var(--font-head)", fontSize:17, fontWeight:700, color:T.ink}}>
          {mode==="redo" ? "正在重新整理全文" : "正在整理楼主内容"}
        </div>
        <div style={{fontFamily:"var(--font-head)", fontSize:14, color:T.soft, marginTop:10, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap"}}>
          已读取 {read} / {total} 页
        </div>
        {/* 细进度条 */}
        <div style={{width:"100%", maxWidth:240, height:3, borderRadius:2, background:T.line, marginTop:18, overflow:"hidden"}}>
          <div style={{height:"100%", width:(pct*100)+"%", background:T.accent, borderRadius:2, transition:"width .25s ease"}}></div>
        </div>
        <div style={{fontFamily:"var(--font-body)", fontSize:13, color:T.soft, marginTop:24, lineHeight:1.7, maxWidth:260, opacity:.92}}>
          {mode==="redo" ? "正在清理并重建阅读结构，会尽量保留你的进度。" : "首次整理会稍久，之后将直接打开。"}
        </div>
        <button onClick={onCancel} style={{width:"100%", maxWidth:240, height:48, borderRadius:999, marginTop:30, cursor:"pointer",
          border:"1px solid "+T.line, background:"transparent", color:T.soft, fontFamily:"var(--font-head)", fontSize:15, fontWeight:600}}>返回</button>
      </div>
    </div>
  );
};
const obtn = (T)=> ({width:42, height:42, borderRadius:"50%", border:"none", background:"transparent", color:T.ink, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center"});

// —— 更多操作菜单（底部抽屉）——
const MoreMenu = ({T, book, ch, onClose, onCheck, onRedo, onViewFloor}) => {
  const rows = [
    {ic:"refresh", title:"检查更新", sub:"轻量检查新增楼层和目录变化", fn:onCheck},
    {ic:"layers",  title:"重新整理全文", sub:"清理并重建阅读结构，尽量保留进度", fn:onRedo},
    {ic:"external", title:"查看原楼层", sub:"退出阅读，打开本章对应的论坛楼层", fn:onViewFloor},
  ];
  return (
    <window.RSheet T={T} onClose={onClose} title="更多操作">
      <div style={{margin:"0 -4px"}}>
        {rows.map((r,i)=>(
          <button key={i} onClick={r.fn} style={{width:"100%", display:"flex", alignItems:"center", gap:13, padding:"14px 6px",
            border:"none", background:"transparent", cursor:"pointer", textAlign:"left",
            borderBottom: i<rows.length-1? "1px solid "+T.line : "none"}}>
            <span style={{width:40, height:40, borderRadius:11, flex:"0 0 auto", background:T.bg, border:"1px solid "+T.line,
              display:"flex", alignItems:"center", justifyContent:"center", color: r.ic==="layers"?T.accent:T.ink}}><OIc name={r.ic} size={20}/></span>
            <span style={{flex:1, minWidth:0}}>
              <span style={{display:"block", fontFamily:"var(--font-head)", fontSize:15, fontWeight:600, color:T.ink}}>{r.title}</span>
              <span style={{display:"block", fontFamily:"var(--font-head)", fontSize:12, color:T.soft, marginTop:2}}>{r.sub}</span>
            </span>
            <OIc name="chevRight" size={17} style={{color:T.soft, flex:"0 0 auto"}}/>
          </button>
        ))}
      </div>
    </window.RSheet>
  );
};

// —— 重新整理全文：二次确认（居中弹窗）——
const RestructureConfirm = ({T, onCancel, onConfirm}) => {
  const {entered:ent, settled} = window.useEntered();
  const tr = settled ? "none" : "transform .26s cubic-bezier(.32,.72,.34,1), opacity .26s ease";
  return (
    <>
      <div onClick={onCancel} style={{position:"absolute", inset:0, background:"rgba(20,12,8,.4)", zIndex:44, opacity:ent?1:0, transition: settled?"none":"opacity .26s ease"}}></div>
      <div style={{position:"absolute", inset:0, zIndex:45, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 34px", pointerEvents:"none"}}>
        <div style={{pointerEvents:"auto", width:"100%", maxWidth:320, background:T.chrome, borderRadius:20, padding:"24px 22px 18px",
          boxShadow:"0 16px 50px rgba(30,18,12,.3)", textAlign:"center",
          transform: ent?"scale(1)":"scale(.94)", opacity:ent?1:0, transition:tr}}>
          <div style={{width:48, height:48, borderRadius:13, margin:"0 auto 16px", background:T.accent, color:"#fff",
            display:"flex", alignItems:"center", justifyContent:"center"}}><OIc name="layers" size={23}/></div>
          <div style={{fontFamily:"var(--font-head)", fontSize:17, fontWeight:700, color:T.ink}}>重新整理全文？</div>
          <div style={{fontFamily:"var(--font-body)", fontSize:14, color:T.soft, marginTop:11, lineHeight:1.7}}>
            将清理并重建该帖的阅读结构，可能花一点时间。会尽量保留你的阅读进度。
          </div>
          <button onClick={onConfirm} style={{width:"100%", height:48, borderRadius:999, border:"none", background:T.accent, color:"#fff",
            fontFamily:"var(--font-head)", fontSize:15.5, fontWeight:600, cursor:"pointer", marginTop:22}}>开始重新整理</button>
          <button onClick={onCancel} style={{width:"100%", height:46, borderRadius:999, marginTop:9, cursor:"pointer",
            border:"none", background:"transparent", color:T.soft, fontFamily:"var(--font-head)", fontSize:15, fontWeight:600}}>取消</button>
        </div>
      </div>
    </>
  );
};

// —— 低置信度首次进入轻提示（阅读器底部，单次）——
const LowConfHint = ({T, book, onClose}) => {
  const {entered:ent, settled} = window.useEntered();
  const tr = settled ? "none" : "transform .3s cubic-bezier(.32,.72,.34,1), opacity .3s ease";
  return (
    <div style={{position:"absolute", left:0, right:0, bottom:0, zIndex:17, display:"flex", justifyContent:"center", padding:"0 16px 18px", pointerEvents:"none"}}>
      <div style={{pointerEvents:"auto", display:"flex", alignItems:"flex-start", gap:10, maxWidth:340,
        background:T.chrome, border:"1px solid "+T.line, borderRadius:16, boxShadow:"0 8px 30px rgba(30,18,12,.16)", padding:"13px 14px 13px 15px",
        transform: ent?"translateY(0)":"translateY(20px)", opacity:ent?1:0, transition:tr}}>
        <span style={{color:T.accent, flex:"0 0 auto", marginTop:1, display:"flex"}}><OIc name="info" size={17}/></span>
        <span style={{flex:1, minWidth:0}}>
          <span style={{display:"block", fontFamily:"var(--font-head)", fontSize:13, fontWeight:600, color:T.ink, lineHeight:1.5}}>{book.lowNote}</span>
          <span style={{display:"block", fontFamily:"var(--font-head)", fontSize:12, color:T.soft, marginTop:3, lineHeight:1.5}}>读到不对劲的地方，可随时「对照原楼层」查看。</span>
        </span>
        <button onClick={onClose} style={{flex:"0 0 auto", border:"none", background:T.bg, color:T.soft, height:28, padding:"0 11px",
          borderRadius:999, fontFamily:"var(--font-head)", fontSize:12.5, fontWeight:600, cursor:"pointer"}}>知道了</button>
      </div>
    </div>
  );
};

// inject organize-only keyframes
(function injectOrgCSS(){
  if(document.getElementById("org-css")) return;
  const s = document.createElement("style"); s.id="org-css";
  s.textContent = `@keyframes orgPulse{ 0%,100%{ opacity:.3; transform:scale(.82);} 50%{ opacity:1; transform:scale(1);} }`;
  document.head.appendChild(s);
})();

Object.assign(window, { UpdateBanner, OrganizeView, MoreMenu, RestructureConfirm, LowConfHint });
