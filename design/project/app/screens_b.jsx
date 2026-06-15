const { Icon: Ic, StatusBar: SB, Avatar: Av, GroupPill: GP, StripeImg: SI, NavHeader: NH } = window;

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
      <span style={{fontFamily:"var(--font-head)", fontSize:13, fontWeight:600, color:"var(--faint)"}}>{f.floor===1?"":"#"+f.floor}</span>
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
  const open = (fresh)=> nav.push("reader", {bookId:book.id, fresh});
  const countText = window.BOOKS.chapterCountText(book);
  return (
    <div style={{margin:"20px 0 4px", padding:"16px 17px 15px", borderRadius:16,
      background:"var(--accent-soft)", border:"1px solid var(--line)"}}>
      <div className="row" style={{gap:12, alignItems:"flex-start"}}>
        <div style={{width:40, height:40, borderRadius:11, background:"var(--accent)", color:"#fff",
          display:"flex", alignItems:"center", justifyContent:"center", flex:"0 0 auto"}}>
          <Ic name="book" size={21}/>
        </div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontFamily:"var(--font-head)", fontSize:15, fontWeight:700, color:"var(--ink)"}}>用阅读模式打开</div>
          <div className="timestamp" style={{fontSize:12.5, marginTop:3}}>
            {book.shape}{countText!==book.shape ? " · "+countText : ""} · {book.statusText}
          </div>
        </div>
      </div>
      <div className="row" style={{gap:10, marginTop:14}}>
        <button onClick={()=>open(!prog)} style={{flex:1, height:46, border:"none", borderRadius:999,
          background:"var(--accent)", color:"#fff", fontFamily:"var(--font-head)", fontSize:15, fontWeight:600, cursor:"pointer"}}>
          {prog ? "续读 · "+prog.chapterTitle.split(" · ")[0]+" "+prog.pct+"%" : "开始阅读"}
        </button>
        {prog && <button onClick={()=>open(true)} style={{flex:"0 0 auto", height:46, padding:"0 18px", borderRadius:999,
          background:"transparent", border:"1px solid var(--line-strong)", color:"var(--ink-soft)",
          fontFamily:"var(--font-head)", fontSize:14.5, fontWeight:600, cursor:"pointer"}}>从头</button>}
      </div>
    </div>
  );
};

const ThreadScreen = ({thread, board}) => {
  const nav = window.useNav();
  const D = window.DATA;
  const [fav, setFav] = React.useState(false);
  const isNovel = !!(thread.novelId && window.BOOKS && window.BOOKS.get(thread.novelId));
  const floors = D.floors;
  const allImgs = floors.flatMap(f=> f.blocks.filter(b=>b.t==="img").map(b=>({cap:b.cap})));
  const openImg = (cap)=>{ const idx = Math.max(0, allImgs.findIndex(i=>i.cap===cap)); nav.openViewer(allImgs.length?allImgs:[{cap}], idx); };
  return (
    <>
      <SB/>
      <NH title="" onBack={nav.pop}
        right={isNovel
          ? <div className="navback" style={{background:"var(--accent)", color:"#fff"}} onClick={()=>nav.push("reader",{bookId:thread.novelId})}><Ic name="book" size={18}/></div>
          : <div className="navback" onClick={()=>nav.toast("分享：敬请期待")}><Ic name="share" size={18}/></div>}/>
      <div className="scroll" style={{paddingBottom:8}}>
        {/* title block */}
        <div style={{padding:"2px 22px 18px"}}>
          <div className="kicker" style={{marginBottom:14}}>{board ? board.name : "帖子"}{thread.pinned ? "  ·  置顶" : ""}</div>
          <div className="headline" style={{fontSize:26, lineHeight:1.34, marginBottom:20}}>{thread.title}</div>
          <div className="row" style={{gap:11}}>
            <Av user={thread.author} size={38}/>
            <div style={{flex:1}}>
              <div style={{fontFamily:"var(--font-head)", fontSize:14.5, fontWeight:600, color:"var(--ink)"}}>{thread.author.name}</div>
              <div className="timestamp" style={{fontSize:12, marginTop:2}}>{thread.author.group} · {thread.time}</div>
            </div>
          </div>
        </div>
        <div className="feed-div"></div>
        {/* OP body (first floor, flowing) */}
        <div style={{padding:"22px 22px 8px"}}>
          {floors[0].blocks.map((b,i)=> <FloorBlock key={i} b={b} onImg={openImg}/>)}
        </div>
        {/* replies */}
        <div className="kicker" style={{padding:"14px 22px 0"}}>{thread.replies} 条回复</div>
        <div className="feed-div" style={{margin:"14px 22px 0"}}></div>
        {floors.slice(1).map((f,i)=>(
          <React.Fragment key={f.floor}>
            <Floor f={f} idx={i} onImg={openImg}/>
            {i<floors.length-2 && <div className="feed-div" style={{margin:"0 22px"}}></div>}
          </React.Fragment>
        ))}
        <div className="serif" style={{textAlign:"center", fontSize:12, color:"var(--faint)", padding:"22px 0 18px"}}>—  到底啦  —</div>
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

// ===================== Image viewer =====================
const ImageViewer = ({images, index}) => {
  const nav = window.useNav();
  const [i, setI] = React.useState(index||0);
  const [dx, setDx] = React.useState(0);      // live drag offset in px
  const [dragging, setDragging] = React.useState(false);
  const startX = React.useRef(0);
  const startY = React.useRef(0);
  const trackW = React.useRef(0);
  const axisLock = React.useRef(null);        // 'x' | 'y' | null
  const n = images.length;

  const onStart = (e)=>{
    const t = e.touches ? e.touches[0] : e;
    startX.current = t.clientX; startY.current = t.clientY;
    trackW.current = e.currentTarget.offsetWidth;
    axisLock.current = null;
    setDragging(true);
  };
  const onMove = (e)=>{
    if(!dragging) return;
    const t = e.touches ? e.touches[0] : e;
    const mx = t.clientX - startX.current;
    const my = t.clientY - startY.current;
    if(axisLock.current===null && (Math.abs(mx)>6 || Math.abs(my)>6)){
      axisLock.current = Math.abs(mx) > Math.abs(my) ? "x" : "y";
    }
    if(axisLock.current!=="x") return;
    if(e.cancelable) e.preventDefault();
    let d = mx;
    // rubber-band at the ends
    if((i===0 && d>0) || (i===n-1 && d<0)) d = d*0.32;
    setDx(d);
  };
  const onEnd = ()=>{
    if(!dragging) return;
    const w = trackW.current || 1;
    const threshold = Math.min(90, w*0.22);
    let ni = i;
    if(dx <= -threshold && i < n-1) ni = i+1;
    else if(dx >= threshold && i > 0) ni = i-1;
    setI(ni);
    setDx(0);
    setDragging(false);
    axisLock.current = null;
  };

  return (
    <div style={{position:"absolute", inset:0, background:"#0d0a09", display:"flex", flexDirection:"column", zIndex:1}}>
      <div className="statusbar" style={{color:"#fff"}}>
        <span className="sb-time">9:08</span>
        <span className="sb-right" style={{opacity:.9}}>
          <svg width="18" height="12" viewBox="0 0 18 12" fill="#fff"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0.5" width="3" height="11.5" rx="1" opacity=".4"/></svg>
        </span>
      </div>
      <div className="row" style={{padding:"0 18px 8px", justifyContent:"space-between"}}>
        <div className="navback" style={{background:"rgba(255,255,255,.14)", color:"#fff"}} onClick={nav.closeViewer}><Ic name="close" size={20}/></div>
        <span style={{color:"#fff", fontFamily:"var(--font-head)", fontWeight:600, fontSize:15}}>{i+1} / {n}</span>
        <div className="navback" style={{background:"rgba(255,255,255,.14)", color:"#fff"}} onClick={()=>nav.toast("已保存到相册")}><Ic name="download" size={20}/></div>
      </div>
      <div
        style={{flex:1, display:"flex", alignItems:"center", overflow:"hidden", position:"relative", touchAction:"pan-y"}}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
      >
        <div style={{
          display:"flex", width:"100%", height:"100%",
          transform:`translateX(calc(${-i*100}% + ${dx}px))`,
          transition: dragging ? "none" : "transform .34s cubic-bezier(.32,.72,.34,1)"
        }}>
          {images.map((img,k)=>(
            <div key={k} style={{flex:"0 0 100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", padding:"0 16px"}}>
              <div className="stripe" style={{width:"100%", height:"100%", maxHeight:520, borderRadius:12, pointerEvents:"none"}}>
                <span className="stripe-cap">{img.cap||"图片占位"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:"flex", gap:6, justifyContent:"center", padding:"14px 0 8px"}}>
        {images.map((_,k)=> <div key={k} onClick={()=>setI(k)} style={{width:k===i?20:7, height:7, borderRadius:4, background:k===i?"#fff":"rgba(255,255,255,.35)", transition:".25s", cursor:"pointer"}}></div>)}
      </div>
      <div style={{textAlign:"center", color:"rgba(255,255,255,.6)", fontFamily:"var(--font-head)", fontSize:12, padding:"4px 0 22px"}}>左右滑动切换</div>
    </div>
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

Object.assign(window, { ThreadScreen, ImageViewer, ProfileScreen, InfoRow, ActionRow, ReaderEntry });
