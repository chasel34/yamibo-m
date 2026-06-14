const { Icon, Lily, StatusBar, Toggle, Avatar, StripeImg, NavHeader } = window;

// ===================== Flat feed item (no card) =====================
const FeedItem = ({t, onOpen, idx=0, showBoard=false}) => (
  <div className="feed-item fade-up" style={{animationDelay:(idx*30)+"ms"}} onClick={()=>onOpen(t)}>
    <div className="kicker" style={{marginBottom:8}}>{showBoard ? t.boardName : t.tag}{t.pinned ? "  ·  置顶" : ""}</div>
    <div className="feed-title" style={{marginBottom:t.excerpt?7:8}}>{t.title}</div>
    {t.excerpt && <div className="feed-excerpt" style={{marginBottom:9, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden"}}>{t.excerpt}</div>}
    <div className="timestamp">{t.time}</div>
  </div>
);
// keep old name as alias
const ThreadCard = FeedItem;

// ===================== Login =====================
const LoginScreen = () => {
  const nav = window.useNav();
  const [remember, setRemember] = React.useState(true);
  const [u, setU] = React.useState("");
  const [pw, setPw] = React.useState("");
  return (
    <div style={{position:"absolute", inset:0, display:"flex", flexDirection:"column", background:"var(--bg)"}}>
      <StatusBar/>
      <div className="scroll" style={{padding:"0 30px"}}>
        <div style={{height:72}}></div>
        <div style={{display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center"}}>
          <Lily size={66} stroke={1.5}/>
          <div className="headline" style={{fontSize:30, letterSpacing:"3px", margin:"22px 0 10px"}}>百合会</div>
          <div className="serif" style={{fontSize:15, color:"var(--muted)"}}>温柔的第三方阅读客户端</div>
        </div>
        <div style={{height:54}}></div>
        <div style={{display:"flex", flexDirection:"column", gap:12}}>
          <input className="field" placeholder="用户名 / 邮箱" value={u} onChange={e=>setU(e.target.value)}/>
          <input className="field" type="password" placeholder="密码" value={pw} onChange={e=>setPw(e.target.value)}/>
        </div>
        <div className="row" style={{justifyContent:"space-between", margin:"20px 2px 26px"}}>
          <div className="row click" style={{gap:10}} onClick={()=>setRemember(!remember)}>
            <Toggle on={remember} onChange={setRemember}/>
            <span style={{fontFamily:"var(--font-head)", fontSize:14, color:"var(--ink-soft)", fontWeight:500}}>记住我</span>
          </div>
          <span className="click" style={{fontFamily:"var(--font-head)", fontSize:14, color:"var(--ink-soft)", fontWeight:600}} onClick={()=>nav.toast("找回密码将跳转网页")}>找回密码</span>
        </div>
        <button className="btn-primary" onClick={()=>nav.login()}>登录</button>
        <div className="row" style={{justifyContent:"center", margin:"24px 0 8px", gap:5}}>
          <span className="click" style={{fontFamily:"var(--font-head)", fontSize:14.5, color:"var(--ink-soft)", fontWeight:600}} onClick={()=>nav.login()}>游客浏览</span>
          <Icon name="chevRight" size={16} style={{color:"var(--faint)"}}/>
        </div>
        <div style={{height:30}}></div>
        <div className="serif" style={{textAlign:"center", fontSize:11.5, color:"var(--faint)", lineHeight:1.8}}>登录即表示同意社区规范与版权声明<br/>v1.0 · 仅供阅读</div>
      </div>
    </div>
  );
};

// ===================== Forum home (flat board index) =====================
const BoardRow = ({b, onOpen, last}) => (
  <div>
    <div className="flatrow" onClick={()=>onOpen(b)}>
      <span style={{color:"var(--ink-soft)", flex:"0 0 auto", display:"flex"}}><Icon name={b.icon} size={22} stroke={1.6}/></span>
      <div style={{flex:1, minWidth:0}}>
        <div className="row" style={{gap:9, marginBottom:3}}>
          <span style={{fontFamily:"var(--font-head)", fontSize:16.5, fontWeight:700, color:"var(--ink)"}}>{b.name}</span>
          {b.today>0 && <span style={{fontFamily:"var(--font-head)", fontSize:12, fontWeight:600, color:"var(--accent-ink)"}}>{b.today}</span>}
        </div>
        <div className="serif" style={{fontSize:13.5, color:"var(--muted)", display:"-webkit-box", WebkitLineClamp:1, WebkitBoxOrient:"vertical", overflow:"hidden"}}>{b.desc}</div>
      </div>
      <Icon name="chevRight" size={18} style={{color:"var(--faint)", flex:"0 0 auto"}}/>
    </div>
    {!last && <div className="feed-div" style={{margin:"0 22px 0 58px"}}></div>}
  </div>
);

const ForumScreen = () => {
  const nav = window.useNav();
  const D = window.DATA;
  const openBoard = (b)=> nav.push("board", {board:b});
  return (
    <>
      <StatusBar/>
      <div className="scroll">
        <div style={{padding:"6px 22px 18px"}}>
          <div className="row" style={{gap:12}}>
            <div style={{flex:1}}>
              <div className="headline" style={{fontSize:25, letterSpacing:"1.5px", lineHeight:1}}>百合会</div>
              <div className="serif" style={{fontSize:13, color:"var(--muted)", marginTop:6}}>晚上好，{D.ME.name}</div>
            </div>
            <div className="iconbtn" onClick={()=>nav.toast("搜索：敬请期待")}><Icon name="search" size={20}/></div>
          </div>
        </div>

        {D.groups.map((g, gi)=>(
          <div key={g.id} style={{marginBottom:14}}>
            <div className="kicker" style={{padding:"14px 22px 12px"}}>{g.name}</div>
            {g.boards.map((b,i)=> <BoardRow key={b.id} b={b} onOpen={openBoard} last={i===g.boards.length-1}/>)}
            {gi<D.groups.length-1 && <div style={{height:8}}></div>}
          </div>
        ))}
        <div className="serif" style={{textAlign:"center", fontSize:12, color:"var(--faint)", padding:"10px 0 30px"}}>—  到底啦  —</div>
      </div>
    </>
  );
};

// ===================== Sub-board chip (子板块 · 等分一排) =====================
const SubBoardChip = ({s, onOpen}) => (
  <div className="click" onClick={()=>onOpen(s)} style={{display:"flex", alignItems:"center", justifyContent:"center", gap:6, height:36, padding:"0 12px",
    borderRadius:999, border:"1px solid var(--line-strong)", background:"transparent", flex:"1 1 0", minWidth:0}}>
    <span style={{fontFamily:"var(--font-head)", fontSize:13.5, fontWeight:600, color:"var(--ink)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", minWidth:0}}>{s.name}</span>
    <span style={{fontFamily:"var(--font-head)", fontSize:12, fontWeight:700, color:"var(--accent-ink)", flex:"0 0 auto"}}>{s.today}</span>
  </div>
);

// ===================== Pinned / notice row (置顶 · 公告) =====================
const PinnedRow = ({item, onOpen}) => {
  const notice = item.kind==="notice";
  return (
    <div className="click" style={{display:"flex", alignItems:"center", gap:11, padding:"11px 22px"}} onClick={()=>onOpen(item)}>
      <span className="tagpill" style={notice
        ? {background:"var(--accent)", color:"#fff", flex:"0 0 auto"}
        : {background:"var(--accent-soft)", color:"var(--accent-ink)", flex:"0 0 auto"}}>{notice?"公告":"置顶"}</span>
      <span style={{flex:1, minWidth:0, fontFamily:"var(--font-head)", fontSize:14.5, fontWeight:600,
        color: notice?"var(--accent-ink)":"var(--ink)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{item.title}</span>
    </div>
  );
};

// ===================== Board thread list (flat feed) =====================
const BoardScreen = ({board}) => {
  const nav = window.useNav();
  const D = window.DATA;
  const data = React.useMemo(()=> D.threadsFor(board), [board]);
  const [sort, setSort] = React.useState("全部");
  const [cat, setCat] = React.useState(null);      // null = 全部
  const [extra, setExtra] = React.useState([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [pull, setPull] = React.useState(0);
  const scRef = React.useRef(null);
  const drag = React.useRef({active:false, y0:0});

  const cats = board.cats || [];

  // pinned only on the default tab, and not filtered into a non-公告 category
  const showPinned = (sort==="全部") && (cat===null || cat==="公告");
  const pinned = showPinned ? data.pinned : [];

  let list = data.list.concat(extra);
  if(cat) list = list.filter(t=> t.cat===cat);
  if(sort==="精华") list = list.filter(t=> t.essence);
  else if(sort==="热门") list = list.slice().sort((a,b)=> (b.replies||0)-(a.replies||0));

  const doRefresh = () => { setRefreshing(true); setTimeout(()=>{ setRefreshing(false); setPull(0); nav.toast("已是最新内容"); }, 1100); };
  const onPointerDown = (e)=>{ if(scRef.current && scRef.current.scrollTop<=0){ drag.current={active:true, y0:e.clientY}; } };
  const onPointerMove = (e)=>{ if(!drag.current.active) return; const dy=e.clientY-drag.current.y0; if(dy>0 && scRef.current.scrollTop<=0){ setPull(Math.min(dy*0.5, 70)); } };
  const onPointerUp = ()=>{ if(!drag.current.active) return; drag.current.active=false; if(pull>46){ doRefresh(); } else { setPull(0); } };

  const onScroll = (e)=>{
    const el=e.target;
    if(el.scrollTop+el.clientHeight >= el.scrollHeight-60 && !loadingMore && extra.length < data.list.length*2){
      setLoadingMore(true);
      setTimeout(()=>{ setExtra(prev=>[...prev, ...data.list.map((t,i)=>({...t, id:t.id+"_x"+prev.length+i}))]); setLoadingMore(false); }, 800);
    }
  };

  const openThread = (th)=> nav.push("thread", {thread:th, board});

  return (
    <>
      <StatusBar/>
      <NavHeader title={board.name} onBack={nav.pop} right={<div className="navback" onClick={()=>nav.toast("版规：友善交流，禁止剧透与上升")}><Icon name="info" size={19}/></div>}/>
      <div className="scroll" ref={scRef} onScroll={onScroll}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
        <div className={"ptr"+(pull>4||refreshing?" show":"")} style={!refreshing?{height:pull}:{}}>
          {refreshing ? <><span className="spin"></span>正在刷新…</> : <>{pull>46?"释放刷新":"下拉刷新"}</>}
        </div>

        {/* board sub-line */}
        <div style={{padding:"0 22px 12px"}}>
          <div className="serif" style={{fontSize:13.5, color:"var(--muted)"}}>{board.desc}</div>
        </div>

        {/* board announcement (only some boards) */}
        {board.announce && (
          <div style={{margin:"0 22px 14px", padding:"13px 15px", background:"var(--accent-soft-2)", borderRadius:14}}>
            <div className="serif" style={{fontSize:13, color:"var(--accent-ink)", lineHeight:1.72}}>{board.announce}</div>
          </div>
        )}

        {/* sticky filter bar: 排序（主） + 分类（轻量次级） */}
        <div style={{position:"sticky", top:0, zIndex:3, background:"var(--bg)"}}>
          <div style={{display:"flex", gap:22, overflowX:"auto", padding:"4px 22px 0", scrollbarWidth:"none"}}>
            {D.sortModes.map(s=>(
              <span key={s} onClick={()=>setSort(s)} style={{whiteSpace:"nowrap", cursor:"pointer", fontFamily:"var(--font-head)", fontSize:15.5,
                fontWeight: sort===s?700:500, color: sort===s?"var(--ink)":"var(--faint)", paddingBottom:9, transition:"color .15s",
                borderBottom: sort===s?"2px solid var(--accent)":"2px solid transparent"}}>{s}</span>
            ))}
            <div style={{flex:"0 0 6px"}}></div>
          </div>
          {cats.length>0 && (
            <div style={{display:"flex", gap:17, overflowX:"auto", padding:"11px 22px 12px", scrollbarWidth:"none"}}>
              {cats.map(c=>(
                <span key={c} onClick={()=>setCat(cat===c?null:c)} style={{whiteSpace:"nowrap", cursor:"pointer",
                  fontFamily:"var(--font-head)", fontSize:13.5, fontWeight: cat===c?700:500,
                  color: cat===c?"var(--accent-ink)":"var(--faint)"}}>{c}</span>
              ))}
              <div style={{flex:"0 0 4px"}}></div>
            </div>
          )}
          <div className="feed-div" style={{margin:0}}></div>
        </div>

        {/* sub-boards (子板块) — compact single row, placed under the tags */}
        {board.subs && board.subs.length>0 && (
          <>
            <div className="kicker" style={{padding:"13px 22px 10px"}}>子板块</div>
            <div style={{display:"flex", gap:8, padding:"0 22px 14px"}}>
              {board.subs.map(s=> <SubBoardChip key={s.id} s={s} onOpen={(sb)=>{ setExtra([]); nav.push("board",{board:sb}); }}/>)}
            </div>
            <div className="feed-div"></div>
          </>
        )}

        {/* pinned / notice block */}
        {pinned.map((p)=> <PinnedRow key={p.id} item={p} onOpen={openThread}/>)}
        {pinned.length>0 && list.length>0 && <div className="feed-div"></div>}

        {/* feed */}
        {list.map((t,i)=>(
          <React.Fragment key={t.id}>
            <FeedItem t={t} idx={i} onOpen={openThread}/>
            {i<list.length-1 && <div className="feed-div"></div>}
          </React.Fragment>
        ))}

        {/* empty / loading */}
        {pinned.length===0 && list.length===0 && (
          <div className="serif" style={{textAlign:"center", fontSize:13, color:"var(--faint)", padding:"36px 22px"}}>
            {sort==="精华" ? "这个分类下还没有精华帖" : "这里还没有内容"}
          </div>
        )}
        <div style={{height:loadingMore?44:18, display:"flex", alignItems:"center", justifyContent:"center", gap:8, color:"var(--muted)", fontFamily:"var(--font-head)", fontSize:12.5}}>
          {loadingMore ? <><span className="spin"></span>加载更多…</> : (extra.length>=data.list.length*2 && list.length>0 ? "—  没有更多了  —":"")}
        </div>
        <div style={{height:12}}></div>
      </div>
    </>
  );
};

Object.assign(window, { FeedItem, ThreadCard, LoginScreen, ForumScreen, BoardScreen, BoardRow, PinnedRow });
