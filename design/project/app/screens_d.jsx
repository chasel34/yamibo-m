const { Icon: Id, StatusBar: SBd, NavHeader: NHd } = window;

// ===================== 我的主题 / 我的回复 =====================
const MetaBit = ({icon, v}) => (
  <span className="row" style={{gap:5, alignItems:"center", color:"var(--faint)"}}>
    <Id name={icon} size={13.5} stroke={1.8}/>
    <span style={{fontFamily:"var(--font-head)", fontSize:12, fontWeight:600}}>{v}</span>
  </span>
);

const ThemeRow = ({t, idx, onOpen}) => (
  <div className="feed-item fade-up" style={{animationDelay:(idx*28)+"ms"}} onClick={()=>onOpen(t)}>
    <div className="row" style={{gap:8, alignItems:"center", marginBottom:9}}>
      <window.Avatar user={t.author} size={22}/>
      <span style={{fontFamily:"var(--font-head)", fontSize:12.5, fontWeight:600, color:"var(--ink-soft)"}}>{t.author.name}</span>
      <span className="timestamp" style={{marginLeft:"auto"}}>{t.time}</span>
    </div>
    <div className="feed-title" style={{marginBottom:7}}>
      {t.flag && <span className="tagpill" style={{background:"var(--accent-soft)", color:"var(--accent-ink)", marginRight:8, verticalAlign:"2px"}}>{t.flag}</span>}
      {t.title}
    </div>
    {t.excerpt && <div className="feed-excerpt" style={{marginBottom:10, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden"}}>{t.excerpt}</div>}
    <div className="row" style={{gap:14, alignItems:"center"}}>
      <span className="tagpill" style={{background:"var(--card-2)", color:"var(--muted)"}}>{t.boardName}{t.cat ? " · "+t.cat : ""}</span>
      <span style={{marginLeft:"auto", display:"flex", gap:14}}>
        <MetaBit icon="eye" v={t.views}/>
        <MetaBit icon="reply" v={t.replies}/>
      </span>
    </div>
  </div>
);

const ReplyRow = ({r, idx, onOpen}) => (
  <div className="feed-item fade-up" style={{animationDelay:(idx*28)+"ms"}} onClick={()=>onOpen(r)}>
    <div className="row" style={{gap:10, alignItems:"baseline", marginBottom:10}}>
      <span style={{flex:1, minWidth:0, fontFamily:"var(--font-head)", fontSize:15.5, fontWeight:600, color:"var(--ink)", lineHeight:1.45,
        display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden"}}>
        {r.thread.flag && <span className="tagpill" style={{background:"var(--accent-soft)", color:"var(--accent-ink)", marginRight:7, verticalAlign:"1px"}}>{r.thread.flag}</span>}
        {r.thread.title}
      </span>
      <Id name="chevRight" size={16} style={{color:"var(--faint)", flex:"0 0 auto"}}/>
    </div>
    <div style={{background:"var(--card-2)", borderRadius:10, padding:"12px 14px"}}>
      <div className="serif" style={{fontSize:14.5, color:"var(--ink-2)", lineHeight:1.6}}>{r.text}</div>
    </div>
    <div className="row" style={{gap:12, alignItems:"center", marginTop:9}}>
      <span className="timestamp" style={{fontSize:11.5}}>{r.time}</span>
      <span className="timestamp" style={{fontSize:11.5}}>第 {r.floor} 楼</span>
      <span className="timestamp" style={{fontSize:11.5, marginLeft:"auto"}}>{r.thread.boardName}</span>
    </div>
  </div>
);

const UserPostsScreen = ({user, self, tab}) => {
  const nav = window.useNav();
  const D = window.DATA;
  const [seg, setSeg] = React.useState(tab || "themes");
  const themes = React.useMemo(()=> D.themesFor(user), [user]);
  const replies = React.useMemo(()=> D.repliesFor(user), [user]);
  const openThread = (t)=> nav.push("thread", {thread:t});
  const openReply = (r)=> nav.push("thread", {thread:r.thread, jumpFloor:r.floor, myReply:{floor:r.floor, text:r.text, time:r.time, user}});
  const list = seg==="themes" ? themes : replies;
  return (
    <>
      <SBd/>
      <NHd title={self ? "我的发言" : user.name} onBack={nav.pop}/>
      <div style={{padding:"0 22px 14px"}}>
        <div className="row" style={{gap:26}}>
          {[["themes","主题",user.stats.themes],["replies","回复",user.stats.replies]].map(([k,l,n])=>(
            <span key={k} onClick={()=>setSeg(k)} style={{cursor:"pointer", display:"flex", alignItems:"baseline", gap:7, paddingBottom:4,
              borderBottom: seg===k ? "2px solid var(--accent)" : "2px solid transparent", transition:".15s"}}>
              <span style={{fontFamily:"var(--font-head)", fontSize:16, fontWeight:seg===k?700:500, color:seg===k?"var(--ink)":"var(--faint)"}}>{l}</span>
              <span style={{fontFamily:"var(--font-head)", fontSize:12, fontWeight:600, color:seg===k?"var(--accent-ink)":"var(--faint)"}}>{n}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="feed-div"></div>
      <div className="scroll">
        {seg==="themes"
          ? themes.map((t,i)=>(
            <React.Fragment key={t.id}>
              <ThemeRow t={t} idx={i} onOpen={openThread}/>
              {i<themes.length-1 && <div className="feed-div"></div>}
            </React.Fragment>
          ))
          : replies.map((r,i)=>(
            <React.Fragment key={r.id}>
              <ReplyRow r={r} idx={i} onOpen={openReply}/>
              {i<replies.length-1 && <div className="feed-div"></div>}
            </React.Fragment>
          ))}
        <div className="serif" style={{textAlign:"center", fontSize:12, color:"var(--faint)", padding:"16px 0 28px"}}>
          —  共 {seg==="themes" ? user.stats.themes+" 篇主题" : user.stats.replies+" 条回复"} · 仅展示最近 {list.length} 条  —
        </div>
      </div>
    </>
  );
};

Object.assign(window, { UserPostsScreen });
