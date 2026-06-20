const { Icon: Ic, StatusBar: SB, Avatar: Av, GroupPill: GP, StripeImg: SI, NavHeader: NH, Pager: Pg } = window;

// ===================== Rich-text floor block =====================
const FloorBlock = ({b, onImg}) => {
  if(b.t==="text") return <div className="serif" style={{fontSize:16, margin:"0 0 12px", color:"var(--ink-2)", lineHeight:1.72}}>{b.v}</div>;
  if(b.t==="emoji") return <div className="serif" style={{fontSize:18, margin:"2px 0 12px", color:"var(--ink-soft)"}}>{b.v}</div>;
  if(b.t==="quote") return (
    <div className="quote">
      <div className="q-who">{b.who} 写道</div>
      <div className="serif" style={{fontSize:14, color:"var(--muted)"}}>{b.v}</div>
    </div>
  );
  if(b.t==="img") return <div onClick={()=>onImg&&onImg(b.cap)} style={{cursor:"pointer"}}><SI h={180} cap={b.cap} style={{margin:"6px 0 14px"}} radius="10px" /></div>;
  return null;
};

const Floor = ({f, onImg, idx}) => (
  <div className="fade-up" style={{padding:"20px 22px 6px", animationDelay:(idx*40)+"ms"}}>
    <div className="row" style={{gap:11, marginBottom:14}}>
      <Av user={f.user} size={36}/>
      <div style={{flex:1, minWidth:0}}>
        <div className="row" style={{gap:8}}>
          <span style={{fontFamily:"var(--font-head)", fontSize:14.5, fontWeight:600, color:"var(--ink)"}}>{f.user.name}</span>
          {f.op && <span style={{fontFamily:"var(--font-head)", fontSize:11, fontWeight:700, color:"var(--accent-ink)"}}>楼主</span>}
        </div>
        <div className="timestamp" style={{fontSize:12, marginTop:2}}>{f.time}</div>
      </div>
      <span className="floor-label">{f.floor===1?"":f.floor+"楼"}</span>
    </div>
    <div style={{paddingLeft:2}}>
      {f.blocks.map((b,i)=> <FloorBlock key={i} b={b} onImg={onImg}/>)}
    </div>
    {!f.op && <div className="row" style={{gap:22, padding:"2px 0 8px"}}>
      <span className="row timestamp click" style={{gap:6}}><Ic name="heart" size={16}/>赞</span>
      <span className="row timestamp click" style={{gap:6}}><Ic name="reply" size={16}/>回复</span>
    </div>}
  </div>
);

// ===================== Thread detail =====================
// reading-mode entry card (shown on novel-type threads)
const ReaderEntry = ({thread}) => {
  const nav = window.useNav();
  const book = window.BOOKS.get(thread.novelId);
  if(!book) return null;
  const prog = window.ReaderProgress ? window.ReaderProgress.get(book.id) : null;
  const organized = window.ReaderMeta ? window.ReaderMeta.isOrganized(book.id) : true;
  const firstOrganize = book.needsOrganize && !organized;          // 首次需整理
  const low = book.confidence==="low";
  const open = (fresh)=> nav.push("reader", {bookId:book.id, fresh});
  const countText = window.BOOKS.chapterCountText(book);

  // 高置信度且无需首次整理时，入口与右上角阅读按钮重复 —— 不再单独出卡片
  if(!low && !firstOrganize) return null;

  // 入口主按钮文案：随识别置信度 / 是否需首次整理 / 是否有进度变化
  const mainLabel = prog
    ? "续读 · "+prog.chapterTitle.split(" · ")[0]+" "+prog.pct+"%"
    : firstOrganize ? "整理并阅读"
    : low ? "尝试阅读模式" : "阅读模式";

  return (
    <div style={{margin:"20px 0 4px", padding:"16px 17px 15px", borderRadius:16,
      background:"var(--accent-soft)", border:"1px solid var(--line)"}}>
      <div className="row" style={{gap:12, alignItems:"flex-start"}}>
        <div style={{width:40, height:40, borderRadius:11, background: low?"var(--card)":"var(--accent)",
          color: low?"var(--accent-ink)":"#fff", border: low?"1px solid var(--line-strong)":"none",
          display:"flex", alignItems:"center", justifyContent:"center", flex:"0 0 auto"}}>
          <Ic name="book" size={21}/>
        </div>
        <div style={{flex:1, minWidth:0}}>
          <div className="row" style={{gap:7}}>
            <span style={{fontFamily:"var(--font-head)", fontSize:15, fontWeight:700, color:"var(--ink)"}}>
              {low ? "尝试用阅读模式打开" : "用阅读模式打开"}
            </span>
          </div>
          <div className="timestamp" style={{fontSize:12.5, marginTop:3}}>
            {book.shape}{countText!==book.shape ? " · "+countText : ""} · {book.statusText}
          </div>
        </div>
      </div>

      {/* 低置信度 / 首次整理：温和说明，降低焦虑而非报错 */}
      {(low || firstOrganize) && (
        <div className="row" style={{gap:8, marginTop:11, padding:"9px 11px", borderRadius:11,
          background:"color-mix(in srgb, var(--card) 70%, transparent)", alignItems:"flex-start"}}>
          <span style={{color:"var(--muted)", flex:"0 0 auto", marginTop:1, display:"flex"}}><Ic name="info" size={15}/></span>
          <span style={{fontFamily:"var(--font-head)", fontSize:12, lineHeight:1.55, color:"var(--ink-soft)"}}>
            {firstOrganize
              ? "首次打开需先整理楼主楼层，稍候片刻；之后将直接打开。"
              : "该帖无链接目录，已尽量保留楼主内容，章节名可能不完整。"}
          </span>
        </div>
      )}

      <div className="row" style={{gap:10, marginTop:13}}>
        <button onClick={()=>open(!prog)} style={{flex:1, height:46, border:"none", borderRadius:999,
          background:"var(--accent)", color:"#fff", fontFamily:"var(--font-head)", fontSize:15, fontWeight:600, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center", gap:7}}>
          {firstOrganize && !prog && <Ic name="sparkle" size={17}/>}
          {mainLabel}
        </button>
        {prog && <button onClick={()=>open(true)} style={{flex:"0 0 auto", height:46, padding:"0 18px", borderRadius:999,
          background:"transparent", border:"1px solid var(--line-strong)", color:"var(--ink-soft)",
          fontFamily:"var(--font-head)", fontSize:14.5, fontWeight:600, cursor:"pointer"}}>从头</button>}
      </div>
    </div>
  );
};

// ===================== Floor jump (按楼层定位 · 内联文字风) =====================
const FloorJump = ({onLocate}) => {
  const [v, setV] = React.useState("");
  const go = ()=>{ const n=parseInt(v,10); if(n){ onLocate(n); setV(""); } };
  return (
    <span className="fjrow">
      <span className="fjlabel">跳至</span>
      <input className="fjinput" inputMode="numeric" value={v}
        onChange={e=>setV(e.target.value.replace(/[^0-9]/g,""))}
        onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); go(); e.target.blur(); } }}/>
      <span className="fjlabel">楼</span>
      <span className="fjgo" onClick={go}>定位</span>
    </span>
  );
};

const PER_FLOOR = 10;
const ThreadScreen = ({thread, board}) => {
  const nav = window.useNav();
  const D = window.DATA;
  const [fav, setFav] = React.useState(false);
  const isNovel = !!(thread.novelId && window.BOOKS && window.BOOKS.get(thread.novelId));
  const all = React.useMemo(()=> D.floorsFor(thread), [thread]);   // all[0] = 1楼(楼主)
  const totalFloors = all.length;
  const [opOnly, setOpOnly] = React.useState(false);              // 只看楼主
  const opCount = React.useMemo(()=> all.filter(f=>f.op).length, [all]);
  const source = React.useMemo(()=> opOnly ? all.filter(f=>f.op) : all, [all, opOnly]);
  const totalPages = Math.max(1, Math.ceil(source.length/PER_FLOOR));
  const [page, setPage] = React.useState(1);
  const pageC = Math.min(page, totalPages);
  const scRef = React.useRef(null);
  const pending = React.useRef(null);
  const [flash, setFlash] = React.useState(null);

  React.useEffect(()=>{ setPage(1); }, [opOnly]);

  const startIdx = (pageC-1)*PER_FLOOR;
  const pageFloors = source.slice(startIdx, startIdx+PER_FLOOR);   // 本页楼层
  const showOP = !opOnly && startIdx===0;                          // 普通模式下楼主正文仅第一页
  const replyFloors = showOP ? pageFloors.slice(1) : pageFloors;

  // 图片查看器：仅本页可见楼层
  const allImgs = pageFloors.flatMap(f=> f.blocks.filter(b=>b.t==="img").map(b=>({cap:b.cap})));
  const openImg = (cap)=>{ const idx = Math.max(0, allImgs.findIndex(i=>i.cap===cap)); nav.openViewer(allImgs.length?allImgs:[{cap}], idx, thread.title); };

  const scrollToFloor = (f, smooth)=>{
    const run = (behavior)=>{
      const el = document.getElementById("floor-"+f);
      const sc = scRef.current;
      if(el && sc){
        const cr = sc.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        const target = Math.max(0, sc.scrollTop + (er.top - cr.top) - 54);
        sc.scrollTo({top: target, behavior});
      }
    };
    // settle after the freshly-rendered page is laid out; retry once (instant) to catch late layout on page change
    setTimeout(()=>{ run(smooth?"smooth":"auto"); setFlash(f); }, 40);
    if(!smooth) setTimeout(()=> run("auto"), 200);
    setTimeout(()=> setFlash(null), 1900);
  };
  const locate = (f)=>{
    f = Math.max(1, Math.min(totalFloors, (f|0)||1));
    const tp = Math.ceil(f/PER_FLOOR);
    if(tp===pageC){ scrollToFloor(f, true); }
    else { pending.current=f; setPage(tp); }
  };
  const goPage = (n)=>{ pending.current=null; setPage(n); };

  React.useEffect(()=>{
    if(pending.current!=null){ const f=pending.current; pending.current=null; scrollToFloor(f, false); }
    else if(scRef.current){ scRef.current.scrollTo({top:0, behavior:"auto"}); }
  }, [pageC]);

  return (
    <>
      <SB/>
      <NH title="" onBack={nav.pop}
        right={
          <div className="row" style={{gap:8}}>
            {totalFloors>1 && (
              <div className={"pill "+(opOnly?"pill-active":"pill-ghost")} style={{height:40, padding:"0 15px"}} onClick={()=>setOpOnly(v=>!v)}>
                <Ic name={opOnly?"check":"user"} size={14}/>只看楼主
              </div>
            )}
            {isNovel
              ? <div className="navback" style={{background:"var(--accent)", color:"#fff"}} onClick={()=>nav.push("reader",{bookId:thread.novelId})}><Ic name="book" size={18}/></div>
              : <div className="navback" onClick={()=>nav.toast("分享：敬请期待")}><Ic name="share" size={18}/></div>}
          </div>
        }/>
      <div className="scroll" ref={scRef} style={{paddingBottom:8}}>
        {/* title block */}
        <div style={{padding:"2px 22px 18px"}}>
          <div className="kicker" style={{marginBottom:14}}>{board ? board.name : "帖子"}{thread.pinned ? "  ·  置顶" : ""}{totalPages>1 ? "  ·  第 "+pageC+"/"+totalPages+" 页" : ""}</div>
          <div className="headline" style={{fontSize:26, lineHeight:1.34, marginBottom:20}}>{thread.title}</div>
          <div className="row" style={{gap:11}}>
            <Av user={thread.author} size={38}/>
            <div style={{flex:1}}>
              <div className="row" style={{gap:8}}>
                <span style={{fontFamily:"var(--font-head)", fontSize:14.5, fontWeight:600, color:"var(--ink)"}}>{thread.author.name}</span>
                <span style={{fontFamily:"var(--font-head)", fontSize:11, fontWeight:700, color:"var(--accent-ink)"}}>楼主</span>
              </div>
              <div className="timestamp" style={{fontSize:12, marginTop:2}}>{thread.author.group} · {thread.time}</div>
            </div>
          </div>
        </div>
        <div className="feed-div"></div>

        {/* reading-mode entry — 仅小说帖、仅第一页 */}
        {isNovel && showOP && (
          <div style={{padding:"0 22px"}}><ReaderEntry thread={thread}/></div>
        )}

        {/* OP body — 仅第一页 */}
        {showOP && (
          <div id="floor-1" className={flash===1?"floor-flash":""}>
            <div className="row" style={{padding:"12px 22px 0", justifyContent:"flex-end"}}>
              <span className="floor-label">1楼 · 楼主</span>
            </div>
            <div style={{padding:"6px 22px 8px"}}>
              {all[0].blocks.map((b,i)=> <FloorBlock key={i} b={b} onImg={openImg}/>)}
            </div>
          </div>
        )}

        {/* replies header */}
        <div className="row" style={{padding:"16px 22px 0", alignItems:"center"}}>
          <span className="kicker">{opOnly ? ("楼主发言 · "+source.length+" 层") : (thread.replies+" 条回复")}</span>
        </div>
        <div className="feed-div" style={{margin:"14px 22px 0"}}></div>

        {/* replies on this page */}
        {replyFloors.length===0 && (
          <div className="serif" style={{textAlign:"center", fontSize:13, color:"var(--faint)", padding:"30px 22px"}}>{opOnly?"本页暂无楼主发言":"本页暂无回复"}</div>
        )}
        {replyFloors.map((f,i)=>(
          <React.Fragment key={f.floor}>
            <div id={"floor-"+f.floor} className={flash===f.floor?"floor-flash":""}>
              <Floor f={f} idx={i} onImg={openImg}/>
            </div>
            {i<replyFloors.length-1 && <div className="feed-div" style={{margin:"0 22px"}}></div>}
          </React.Fragment>
        ))}

        {/* pager (含按楼层定位) */}
        <Pg page={pageC} totalPages={totalPages} onJump={goPage}
          cap={opOnly ? ("仅显示楼主 · 共 "+source.length+" 层") : ("共 "+totalFloors+" 楼 · 每页 "+PER_FLOOR+" 楼")}
          extra={!opOnly && totalFloors>PER_FLOOR ? <FloorJump onLocate={locate}/> : null}/>
        <div style={{height:8}}></div>
      </div>
      {/* fixed action bar — v1 read only */}
      <div style={{flex:"0 0 auto", padding:"8px 18px", paddingBottom:14, borderTop:"1px solid var(--line)", display:"flex", gap:14, alignItems:"center",
        background:"color-mix(in srgb, var(--bg) 88%, transparent)", backdropFilter:"blur(14px)"}}>
        <div style={{flex:1, height:46, borderRadius:999, background:"var(--field)", display:"flex", alignItems:"center", padding:"0 20px", color:"var(--faint)", fontFamily:"var(--font-head)", fontSize:14.5}}
          onClick={()=>nav.toast("写操作敬请期待 · v2 开放")}>
          回复功能敬请期待…
        </div>
        <div className="row click" style={{alignItems:"center", color: fav?"var(--accent)":"var(--ink-soft)"}}
          onClick={()=>{ setFav(!fav); nav.toast(fav?"已取消收藏":"已收藏"); }}>
          <Ic name="heart" size={24} fill={fav?"currentColor":"none"}/>
        </div>
        <div className="row click" style={{alignItems:"center", color:"var(--ink-soft)"}} onClick={()=>nav.toast("分享：敬请期待")}>
          <Ic name="share" size={22}/>
        </div>
      </div>
    </>
  );
};

// ===================== Profile (self & other) — minimal =====================
const StatCell = ({n, label, onClick}) => (
  <div style={{flex:1, textAlign:"center", cursor:onClick?"pointer":"default"}} onClick={onClick}>
    <div className="headline" style={{fontSize:19}}>{n}</div>
    <div className="timestamp" style={{fontSize:11.5, marginTop:3}}>{label}</div>
  </div>
);

const ProfileScreen = ({user, self}) => {
  const nav = window.useNav();
  const u = user;
  return (
    <>
      <SB/>
      <div className="navhead" style={{justifyContent:"space-between"}}>
        <div className="navback" onClick={nav.pop}><Ic name="back" size={21}/></div>
        <div style={{flex:1}}></div>
        {self
          ? <div className="navback" onClick={()=>nav.push("settings",{})}><Ic name="gear" size={19}/></div>
          : <div className="navback" onClick={()=>nav.toast("更多")}><Ic name="share" size={18}/></div>}
      </div>
      <div className="scroll">
        {/* header */}
        <div style={{display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", padding:"10px 24px 4px"}}>
          <Av user={u} size={78}/>
          <div className="headline" style={{fontSize:23, marginTop:16}}>{u.name}</div>
          <div className="timestamp" style={{fontSize:13, marginTop:7}}>{u.group} · {u.register}</div>
          <div className="serif" style={{fontSize:14.5, color:"var(--ink-soft)", marginTop:14, lineHeight:1.65, maxWidth:290}}>{u.bio}</div>
        </div>
        {/* stats row */}
        <div className="row" style={{padding:"22px 16px 22px"}}>
          <StatCell n={u.stats.themes} label="主题"/>
          <StatCell n={u.stats.replies} label="回复"/>
          <StatCell n={u.stats.collections} label="收藏" onClick={self?()=>nav.push("collections",{}):null}/>
          <StatCell n={u.stats.follow} label="关注"/>
          <StatCell n={u.stats.fans} label="粉丝"/>
        </div>
        <div className="feed-div"></div>
        {/* meta list */}
        <InfoRow label="性别" v={u.gender}/>
        <div className="feed-div" style={{margin:"0 22px"}}></div>
        <InfoRow label="星座" v={u.constellation}/>
        <div className="feed-div" style={{margin:"0 22px"}}></div>
        <InfoRow label="所在地" v={u.location}/>
        <div className="feed-div"></div>
        {/* actions */}
        {self ? (
          <>
            <ActionRow icon="bookmark" label="我的收藏" onClick={()=>nav.push("collections",{})}/>
            <div className="feed-div" style={{margin:"0 22px 0 56px"}}></div>
            <ActionRow icon="doc" label="我的发帖" onClick={()=>nav.toast("我的发帖")}/>
            <div className="feed-div" style={{margin:"0 22px 0 56px"}}></div>
            <ActionRow icon="logout" label="退出登录" danger onClick={()=>nav.logout()}/>
          </>
        ) : (
          <div className="row" style={{gap:12, padding:"22px 22px 0"}}>
            <button className="btn-primary disabled" style={{flex:1}}>关注</button>
            <button className="btn-primary disabled" style={{flex:1, background:"var(--card-2)", color:"var(--ink-soft)"}}>私信</button>
          </div>
        )}
        {!self && <div className="serif" style={{textAlign:"center", fontSize:12, color:"var(--faint)", padding:"14px 0 0"}}>v1 暂未开放关注 / 私信</div>}
        <div style={{height:30}}></div>
      </div>
    </>
  );
};

const InfoRow = ({label, v, multi}) => (
  <div style={{display:"flex", gap:14, padding:"15px 22px", alignItems:multi?"flex-start":"center"}}>
    <span style={{fontFamily:"var(--font-head)", fontSize:14.5, color:"var(--muted)", flex:"0 0 64px", fontWeight:500}}>{label}</span>
    <span className="serif" style={{fontSize:15, color:"var(--ink-2)", flex:1, lineHeight:1.6}}>{v}</span>
  </div>
);
const ActionRow = ({icon, label, onClick, danger}) => (
  <div className="flatrow" onClick={onClick}>
    <span style={{display:"flex", color:danger?"var(--accent)":"var(--ink-soft)", flex:"0 0 auto"}}><Ic name={icon} size={21}/></span>
    <span style={{flex:1, fontFamily:"var(--font-head)", fontSize:15.5, fontWeight:500, color:danger?"var(--accent)":"var(--ink)"}}>{label}</span>
    <Ic name="chevRight" size={18} style={{color:"var(--faint)"}}/>
  </div>
);

Object.assign(window, { ThreadScreen, ProfileScreen, InfoRow, ActionRow, ReaderEntry });
