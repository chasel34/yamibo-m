const { Icon: I3, StatusBar: SB3, Avatar: Av3, GroupPill: GP3, NavHeader: NH3 } = window;

// ===================== Messages =====================
const MessagesScreen = () => {
  const nav = window.useNav();
  const D = window.DATA;
  const [seg, setSeg] = React.useState("remind");
  return (
    <>
      <SB3/>
      <div style={{padding:"6px 22px 14px"}}>
        <div className="row" style={{marginBottom:18}}>
          <span className="headline" style={{fontSize:25, flex:1}}>消息</span>
          <div className="iconbtn" onClick={()=>nav.toast("全部已读")}><I3 name="check" size={20}/></div>
        </div>
        <div className="row" style={{gap:24}}>
          {[["remind","提醒"],["dm","私信"]].map(([k,l])=>(
            <span key={k} onClick={()=>setSeg(k)} style={{cursor:"pointer", fontFamily:"var(--font-head)", fontSize:16,
              fontWeight: seg===k?700:500, color: seg===k?"var(--ink)":"var(--faint)", paddingBottom:3,
              borderBottom: seg===k?"2px solid var(--accent)":"2px solid transparent", transition:".15s"}}>{l}</span>
          ))}
        </div>
      </div>
      <div className="feed-div"></div>
      <div className="scroll">
        {seg==="remind" ? (
          D.reminders.map((r,i)=>(
            <React.Fragment key={r.id}>
              <div className="flatrow fade-up" style={{alignItems:"flex-start", animationDelay:(i*35)+"ms"}} onClick={()=>nav.toast("打开提醒")}>
                <span style={{display:"flex", color:"var(--ink-soft)", flex:"0 0 auto", marginTop:1}}><I3 name={r.icon} size={20}/></span>
                <div style={{flex:1, minWidth:0}}>
                  <div className="row" style={{gap:7, marginBottom:5}}>
                    <span style={{fontFamily:"var(--font-head)", fontSize:14.5, fontWeight:600, color:"var(--ink)"}}>{r.who}</span>
                    {r.unread && <span className="dot"></span>}
                  </div>
                  <div className="serif" style={{fontSize:14, color:"var(--ink-soft)", marginBottom:6, lineHeight:1.55}}>{r.text}</div>
                  <span className="timestamp" style={{fontSize:11.5}}>{r.time}</span>
                </div>
              </div>
              {i<D.reminders.length-1 && <div className="feed-div" style={{margin:"0 22px 0 56px"}}></div>}
            </React.Fragment>
          ))
        ) : (
          D.dms.length ? (
            D.dms.map((d,i)=>(
              <React.Fragment key={d.id}>
                <div className="flatrow fade-up" style={{animationDelay:(i*35)+"ms"}} onClick={()=>nav.toast("会话：敬请期待")}>
                  <Av3 user={d.user} size={46}/>
                  <div style={{flex:1, minWidth:0}}>
                    <div className="row" style={{gap:6, marginBottom:5}}>
                      <span style={{fontFamily:"var(--font-head)", fontSize:15, fontWeight:600, color:"var(--ink)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{d.user.name}</span>
                      <span className="timestamp" style={{fontSize:11.5}}>{d.time}</span>
                    </div>
                    <div className="row" style={{gap:8}}>
                      <span className="serif" style={{fontSize:14, color:"var(--ink-soft)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{d.last}</span>
                      {d.unread>0 && <span style={{minWidth:18, height:18, padding:"0 5px", borderRadius:9, background:"var(--accent)", color:"#fff", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"var(--font-head)"}}>{d.unread}</span>}
                    </div>
                  </div>
                </div>
                {i<D.dms.length-1 && <div className="feed-div" style={{margin:"0 22px 0 78px"}}></div>}
              </React.Fragment>
            ))
          ) : <EmptyState/>
        )}
        <div style={{height:20}}></div>
      </div>
    </>
  );
};

const EmptyState = ({label="还没有新消息", sub="安安静静，等一朵花开"}) => (
  <div style={{display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"80px 40px", textAlign:"center"}}>
    <window.Lily size={58} stroke={1.4} color="var(--faint)"/>
    <div className="headline" style={{fontSize:17, margin:"22px 0 8px"}}>{label}</div>
    <div className="serif" style={{fontSize:14, color:"var(--muted)"}}>{sub}</div>
  </div>
);

// ===================== Mine tab =====================
const MineScreen = () => {
  const nav = window.useNav();
  const D = window.DATA;
  const me = D.ME;
  return (
    <>
      <SB3/>
      <div className="scroll">
        <div style={{padding:"6px 22px 8px"}}>
          <span className="headline" style={{fontSize:25}}>我的</span>
        </div>
        {/* profile row */}
        <div className="flatrow" style={{padding:"16px 22px"}} onClick={()=>nav.push("profile",{user:me, self:true})}>
          <Av3 user={me} size={58}/>
          <div style={{flex:1, minWidth:0}}>
            <div className="headline" style={{fontSize:20, marginBottom:5}}>{me.name}</div>
            <div className="timestamp" style={{fontSize:12.5}}>{me.group} · 总积分 {me.credits[0].value.toLocaleString()}</div>
          </div>
          <I3 name="chevRight" size={20} style={{color:"var(--faint)"}}/>
        </div>
        {/* stats */}
        <div className="row" style={{padding:"6px 16px 20px"}}>
          {[["收藏",me.stats.collections],["主题",me.stats.themes],["回复",me.stats.replies],["关注",me.stats.follow]].map(([l,n],i)=>(
            <div key={i} style={{flex:1, textAlign:"center"}}>
              <div className="headline" style={{fontSize:18}}>{n}</div>
              <div className="timestamp" style={{fontSize:11.5, marginTop:3}}>{l}</div>
            </div>
          ))}
        </div>
        <div className="feed-div"></div>
        <MRow icon="bookmark" label="我的收藏" sub={me.stats.collections+" 篇"} onClick={()=>nav.push("collections",{})}/>
        <div className="feed-div" style={{margin:"0 22px 0 56px"}}></div>
        <MRow icon="doc" label="我的发帖" sub={me.stats.themes+" 篇"} onClick={()=>nav.toast("我的发帖")}/>
        <div className="feed-div" style={{margin:"0 22px 0 56px"}}></div>
        <MRow icon="history" label="浏览历史" onClick={()=>nav.push("history",{})}/>
        <div className="feed-div"></div>
        <MRow icon="gear" label="设置" onClick={()=>nav.push("settings",{})}/>
        <div className="feed-div" style={{margin:"0 22px 0 56px"}}></div>
        <MRow icon="info" label="关于" onClick={()=>nav.push("about",{})}/>
        <div className="feed-div" style={{margin:"0 22px 0 56px"}}></div>
        <MRow icon="logout" label="退出登录" danger onClick={()=>nav.logout()}/>
        <div style={{height:24}}></div>
      </div>
    </>
  );
};
const MRow = ({icon, label, sub, onClick, danger}) => (
  <div className="flatrow" onClick={onClick}>
    <span style={{display:"flex", color:danger?"var(--accent)":"var(--ink-soft)", flex:"0 0 auto"}}><I3 name={icon} size={21}/></span>
    <span style={{flex:1, fontFamily:"var(--font-head)", fontSize:15.5, fontWeight:500, color:danger?"var(--accent)":"var(--ink)"}}>{label}</span>
    {sub && <span className="lr-sub">{sub}</span>}
    <I3 name="chevRight" size={18} style={{color:"var(--faint)", marginLeft:8}}/>
  </div>
);

// ===================== Settings — grouped cards (only place cards appear) =====================
const SettingsScreen = () => {
  const nav = window.useNav();
  const [fetchFull, setFetchFull] = React.useState(false);
  return (
    <>
      <SB3/>
      <NH3 title="设置" onBack={nav.pop}/>
      <div className="scroll">
        <div className="kicker" style={{padding:"6px 22px 11px"}}>外观</div>
        <div className="card" style={{margin:"0 16px", overflow:"hidden"}}>
          <div className="listrow">
            <span className="lr-ic"><I3 name="moon" size={20}/></span>
            <span className="lr-title">深色模式</span>
            <window.Toggle on={nav.theme==="dark"} onChange={(v)=>nav.setTheme(v?"dark":"light")}/>
          </div>
          <div className="hr" style={{margin:"0 18px 0 57px"}}></div>
          <div className="listrow">
            <span className="lr-ic"><I3 name="type" size={20}/></span>
            <span className="lr-title">字号</span>
            <FontSizePicker/>
          </div>
        </div>

        <div className="kicker" style={{padding:"24px 22px 11px"}}>阅读</div>
        <div className="card" style={{margin:"0 16px", overflow:"hidden"}}>
          <div className="listrow">
            <span className="lr-ic"><I3 name="doc" size={20}/></span>
            <div style={{flex:1}}>
              <div className="lr-title">总是抓取全文</div>
              <div className="serif" style={{fontSize:12, color:"var(--muted)", marginTop:2}}>仅有摘要的来源将抓取网页全文</div>
            </div>
            <window.Toggle on={fetchFull} onChange={setFetchFull}/>
          </div>
          <div className="hr" style={{margin:"0 18px 0 57px"}}></div>
          <div className="listrow click" onClick={()=>nav.toast("缓存已清除")}>
            <span className="lr-ic"><I3 name="trash" size={20}/></span>
            <span className="lr-title">清除缓存</span>
            <span className="lr-sub">42.6 MB</span>
          </div>
        </div>

        <div className="kicker" style={{padding:"24px 22px 11px"}}>账户</div>
        <div className="card" style={{margin:"0 16px", overflow:"hidden"}}>
          <div className="listrow click" onClick={()=>nav.push("about",{})}>
            <span className="lr-ic"><I3 name="info" size={20}/></span>
            <span className="lr-title">关于百合会客户端</span>
            <I3 name="chevRight" size={18} style={{color:"var(--faint)"}}/>
          </div>
          <div className="hr" style={{margin:"0 18px 0 57px"}}></div>
          <div className="listrow click" onClick={()=>nav.logout()}>
            <span className="lr-ic" style={{color:"var(--accent)"}}><I3 name="logout" size={20}/></span>
            <span className="lr-title" style={{color:"var(--accent)"}}>退出登录</span>
          </div>
        </div>
        <div style={{height:24}}></div>
      </div>
    </>
  );
};
const FontSizePicker = () => {
  const [s, setS] = React.useState(1);
  return (
    <div style={{display:"flex", gap:6}}>
      {["小","中","大"].map((l,i)=>(
        <span key={i} onClick={()=>setS(i)} style={{width:34, height:30, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:8,
          fontFamily:"var(--font-head)", fontSize:13, fontWeight:600, cursor:"pointer",
          background: s===i?"var(--accent)":"var(--card-2)", color: s===i?"#fff":"var(--ink-soft)"}}>{l}</span>
      ))}
    </div>
  );
};

// ===================== Collections =====================
const CollectionsScreen = () => {
  const nav = window.useNav();
  const D = window.DATA;
  const list = D.threads.slice(0,4);
  return (
    <>
      <SB3/>
      <NH3 title="我的收藏" onBack={nav.pop}/>
      <div className="feed-div"></div>
      <div className="scroll">
        {list.map((t,i)=>(
          <React.Fragment key={t.id}>
            <window.FeedItem t={t} idx={i} onOpen={(th)=>nav.push("thread",{thread:th})}/>
            {i<list.length-1 && <div className="feed-div"></div>}
          </React.Fragment>
        ))}
        <div className="serif" style={{textAlign:"center", fontSize:12, color:"var(--faint)", padding:"14px 0 24px"}}>—  共 {D.ME.stats.collections} 篇收藏  —</div>
      </div>
    </>
  );
};

// ===================== History =====================
const HistoryScreen = () => {
  const nav = window.useNav();
  const D = window.DATA;
  const groups = [{day:"今天", items:D.threads.slice(0,3)},{day:"昨天", items:D.threads.slice(3,6)}];
  return (
    <>
      <SB3/>
      <NH3 title="浏览历史" onBack={nav.pop} right={<div className="navback" onClick={()=>nav.toast("已清空历史")}><I3 name="trash" size={18}/></div>}/>
      <div className="scroll">
        {groups.map((g,gi)=>(
          <div key={gi}>
            <div className="kicker" style={{padding:"16px 22px 4px"}}>{g.day}</div>
            {g.items.map((t,i)=>(
              <React.Fragment key={t.id}>
                <div className="flatrow" style={{alignItems:"flex-start", padding:"16px 22px"}} onClick={()=>nav.push("thread",{thread:t})}>
                  <div style={{flex:1, minWidth:0}}>
                    <div className="headline" style={{fontSize:16, lineHeight:1.4, marginBottom:6, display:"-webkit-box", WebkitLineClamp:1, WebkitBoxOrient:"vertical", overflow:"hidden"}}>{t.title}</div>
                    <div className="timestamp" style={{fontSize:12}}>{t.author.name} · {t.time}</div>
                  </div>
                  <I3 name="chevRight" size={17} style={{color:"var(--faint)", marginTop:3}}/>
                </div>
                {i<g.items.length-1 && <div className="feed-div" style={{margin:"0 22px"}}></div>}
              </React.Fragment>
            ))}
            {gi<groups.length-1 && <div className="feed-div"></div>}
          </div>
        ))}
        <div style={{height:24}}></div>
      </div>
    </>
  );
};

// ===================== About =====================
const AboutScreen = () => {
  const nav = window.useNav();
  return (
    <>
      <SB3/>
      <NH3 title="关于" onBack={nav.pop}/>
      <div className="scroll">
        <div style={{display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", padding:"34px 30px 0"}}>
          <window.Lily size={56} stroke={1.5}/>
          <div className="headline" style={{fontSize:22, letterSpacing:"2px", marginTop:18}}>百合会</div>
          <div className="timestamp" style={{fontSize:13, marginTop:7}}>阅读客户端 v1.0</div>
          <div className="serif" style={{fontSize:14.5, color:"var(--ink-soft)", marginTop:20, lineHeight:1.75, maxWidth:280}}>
            一个温柔、清爽的第三方阅读客户端。当前版本仅支持浏览与登录，写操作将在后续版本中陆续开放。
          </div>
        </div>
        <div style={{height:34}}></div>
        <div className="feed-div"></div>
        <MRow icon="doc" label="社区规范" onClick={()=>nav.toast("将跳转网页")}/>
        <div className="feed-div" style={{margin:"0 22px 0 56px"}}></div>
        <MRow icon="info" label="版权声明" onClick={()=>nav.toast("将跳转网页")}/>
        <div className="feed-div" style={{margin:"0 22px 0 56px"}}></div>
        <MRow icon="heart" label="鸣谢汉化组与同好" onClick={()=>nav.toast("感谢每一位创作者")}/>
        <div className="feed-div"></div>
        <div className="serif" style={{textAlign:"center", fontSize:11.5, color:"var(--faint)", padding:"26px 0", lineHeight:1.7}}>非官方客户端 · 仅供学习交流<br/>内容版权归原作者与论坛所有</div>
      </div>
    </>
  );
};

Object.assign(window, { MessagesScreen, MineScreen, SettingsScreen, CollectionsScreen, HistoryScreen, AboutScreen, EmptyState, MRow });
