// ===================== Icons =====================
const Icon = ({name, size=22, stroke=1.7, fill="none", style}) => {
  const p = { width:size, height:size, viewBox:"0 0 24 24", fill, stroke:"currentColor",
    strokeWidth:stroke, strokeLinecap:"round", strokeLinejoin:"round", style };
  const I = {
    search:<><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.7" y2="16.7"/></>,
    gear:<><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1A2 2 0 1 1 6.9 4.5l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 .9-1.4V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5.9z"/></>,
    back:<polyline points="15 5 8 12 15 19"/>,
    close:<><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></>,
    check:<polyline points="5 12.5 10 17.5 19.5 6.5"/>,
    heart:<path d="M19 8.5c0 4-7 9.5-7 9.5s-7-5.5-7-9.5a3.7 3.7 0 0 1 7-1.6 3.7 3.7 0 0 1 7 1.6z"/>,
    share:<><circle cx="6" cy="12" r="2.4"/><circle cx="17" cy="6" r="2.4"/><circle cx="17" cy="18" r="2.4"/><line x1="8" y1="11" x2="15" y2="7"/><line x1="8" y1="13" x2="15" y2="17"/></>,
    reply:<><polyline points="9 7 4 12 9 17"/><path d="M4 12h9a6 6 0 0 1 6 6v1"/></>,
    forum:<><path d="M4 5h16v10H9l-4 4V5z"/></>,
    bell:<><path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 8-2.5 8h17S18 15 18 9z"/><path d="M10.5 21a2 2 0 0 0 3 0"/></>,
    mail:<><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7 12 13l8.5-6"/></>,
    user:<><circle cx="12" cy="8.5" r="3.7"/><path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5"/></>,
    users:<><circle cx="9" cy="8.5" r="3.2"/><path d="M2.5 20c0-3.3 2.9-5 6.5-5s6.5 1.7 6.5 5"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6.4"/><path d="M17.5 15.2c2.6.5 4 2.2 4 4.8"/></>,
    infinity:<path d="M6.5 9.5c-2 0-3.5 1.1-3.5 2.5s1.5 2.5 3.5 2.5c3 0 5-5 8-5 2 0 3.5 1.1 3.5 2.5s-1.5 2.5-3.5 2.5c-3 0-5-5-8-5z"/>,
    star:<polygon points="12 4 14.2 9.2 19.8 9.6 15.5 13.2 16.9 18.6 12 15.6 7.1 18.6 8.5 13.2 4.2 9.6 9.8 9.2"/>,
    chevDown:<polyline points="6 9.5 12 15.5 18 9.5"/>,
    chevRight:<polyline points="9.5 6 15.5 12 9.5 18"/>,
    lock:<><rect x="5" y="11" width="14" height="9" rx="2.4"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>,
    eye:<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/></>,
    bookmark:<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.2L6 20V5a1 1 0 0 1 1-1z"/>,
    history:<><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><polyline points="3 3.5 3 8 7.5 8"/><polyline points="12 7.5 12 12 15.5 14"/></>,
    info:<><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16.5"/><circle cx="12" cy="7.8" r="0.4" fill="currentColor"/></>,
    logout:<><path d="M14 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8"/><polyline points="17 8 21 12 17 16"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    at:<><circle cx="12" cy="12" r="4"/><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1"/></>,
    pin:<><path d="M9 4h6l-1 5 3 3v2h-5v5l-1 1-1-1v-5H4v-2l3-3z"/></>,
    bell2:<><path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 8-2.5 8h17S18 15 18 9z"/></>,
    sprout:<><path d="M12 20v-7"/><path d="M12 13c0-3 2-5 5-5 0 3-2 5-5 5z"/><path d="M12 14c0-3-2.2-5.2-5.2-5.2 0 3 2.2 5.2 5.2 5.2z"/></>,
    sparkle:<><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z"/><path d="M18.5 16l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z"/></>,
    wave:<><path d="M3 8c2 0 2 2 4.5 2S10 8 12 8s2 2 4.5 2S19 8 21 8"/><path d="M3 13c2 0 2 2 4.5 2S10 13 12 13s2 2 4.5 2S19 13 21 13"/></>,
    book:<><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5A2.5 2.5 0 0 1 20 21.5z"/></>,
    game:<><rect x="2.5" y="7" width="19" height="10" rx="4"/><line x1="7" y1="11" x2="7" y2="13"/><line x1="6" y1="12" x2="8" y2="12"/><circle cx="16" cy="11.5" r="0.6" fill="currentColor"/><circle cx="18" cy="13.5" r="0.6" fill="currentColor"/></>,
    film:<><rect x="3" y="4" width="18" height="16" rx="2.5"/><line x1="8" y1="4" x2="8" y2="20"/><line x1="16" y1="4" x2="16" y2="20"/><line x1="3" y1="12" x2="21" y2="12"/></>,
    box:<><path d="M3.5 8 12 4l8.5 4-8.5 4z"/><path d="M3.5 8v8L12 20l8.5-4V8"/><line x1="12" y1="12" x2="12" y2="20"/></>,
    doc:<><path d="M7 3h7l4 4v14H7z"/><polyline points="14 3 14 7 18 7"/></>,
    refresh:<><polyline points="20 5 20 10 15 10"/><path d="M19 10A8 8 0 1 0 20 14"/></>,
    moon:<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>,
    type:<><polyline points="4 7 4 5 20 5 20 7"/><line x1="12" y1="5" x2="12" y2="19"/><line x1="9" y1="19" x2="15" y2="19"/></>,
    trash:<><polyline points="4 7 20 7"/><path d="M6 7l1 13h10l1-13"/><path d="M9.5 7V4.5h5V7"/></>,
    download:<><path d="M12 4v11"/><polyline points="7 11 12 16 17 11"/><line x1="5" y1="20" x2="19" y2="20"/></>,
    zoom:<><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.7" y2="16.7"/><line x1="11" y1="8.5" x2="11" y2="13.5"/><line x1="8.5" y1="11" x2="13.5" y2="11"/></>,
  };
  return <svg {...p}>{I[name]||null}</svg>;
};

// ===================== Lily logo (line mark) =====================
const Lily = ({size=46, stroke=1.7, color="var(--accent)"}) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none"
    stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {/* back petals */}
    <path d="M32 34C24 30 17 22 18 13c7 0 13 6 14 14" opacity="0.55"/>
    <path d="M32 34C40 30 47 22 46 13c-7 0-13 6-14 14" opacity="0.55"/>
    {/* front three petals */}
    <path d="M32 36C26 31 22 22 25 13c5 2 8 9 7 16"/>
    <path d="M32 36c6-5 10-14 7-23-5 2-8 9-7 16"/>
    <path d="M32 36c0-9 0-18 0-25-4 4-5 12-3 18 1 3 3 5 3 7z" opacity="0"/>
    <path d="M32 11c-3 4-4 13-1 19"/>
    <path d="M32 11c3 4 4 13 1 19"/>
    {/* stamens */}
    <path d="M32 36c0 6-1 11-1 11M32 36c-3 5-5 8-5 8M32 36c3 5 5 8 5 8"/>
    <circle cx="31" cy="48.5" r="1.3" fill={color} stroke="none"/>
    <circle cx="26.5" cy="45" r="1.3" fill={color} stroke="none"/>
    <circle cx="37.5" cy="45" r="1.3" fill={color} stroke="none"/>
    {/* stem */}
    <path d="M32 47c0 6-1 9-4 12" opacity="0.5"/>
  </svg>
);

// ===================== Status bar =====================
const StatusBar = ({time="9:08"}) => (
  <div className="statusbar">
    <span className="sb-time">{time}</span>
    <span className="sb-right">
      <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1" opacity="0.35"/><rect x="15" y="0.5" width="3" height="11.5" rx="1" opacity="0.35"/></svg>
      <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor"><path d="M8.5 2.5c2.4 0 4.6.9 6.2 2.4l1.2-1.3A11 11 0 0 0 8.5.5 11 11 0 0 0 1.1 3.6l1.2 1.3A9 9 0 0 1 8.5 2.5z"/><path d="M8.5 6c1.3 0 2.5.5 3.4 1.4l1.2-1.3A7 7 0 0 0 8.5 4 7 7 0 0 0 3.9 6.1l1.2 1.3A5 5 0 0 1 8.5 6z"/><circle cx="8.5" cy="10" r="1.6"/></svg>
      <svg width="26" height="13" viewBox="0 0 26 13" fill="none"><rect x="0.5" y="0.5" width="21" height="12" rx="3.2" stroke="currentColor" opacity="0.4"/><rect x="2" y="2" width="16" height="9" rx="1.8" fill="currentColor"/><rect x="23" y="4" width="1.6" height="5" rx="0.8" fill="currentColor" opacity="0.4"/></svg>
    </span>
  </div>
);

// ===================== Toggle =====================
const Toggle = ({on, onChange}) => (
  <div className={"toggle"+(on?" on":"")} onClick={(e)=>{e.stopPropagation(); onChange&&onChange(!on);}}>
    <div className="knob"></div>
  </div>
);

// ===================== Avatar (monochrome warm) =====================
const Avatar = ({user, size=44, radius="50%"}) => {
  return (
    <div className="avatar" style={{width:size, height:size, borderRadius:radius,
      background:"var(--card-2)", color:"var(--ink-soft)", fontWeight:600, fontSize:size*0.40}}>
      {(user&&user.avatar)|| (user&&user.name&&user.name[0]) || "?"}
    </div>
  );
};
function shade(hex, amt){
  try{ let c=hex.replace('#',''); if(c.length===3)c=c.split('').map(x=>x+x).join('');
    let r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);
    const f=x=>Math.max(0,Math.min(255,Math.round(x*(1+amt/100))));
    return `rgb(${f(r)},${f(g)},${f(b)})`; }catch(e){ return hex; }
}

// group label -> plain muted text (no colored pill)
const GROUP_TONES = {
  sprout:{bg:"transparent", fg:"var(--muted)"},
  scholar:{bg:"transparent", fg:"var(--muted)"},
  staff:{bg:"transparent", fg:"var(--accent-ink)"},
  reg:{bg:"transparent", fg:"var(--muted)"},
};
const GroupPill = ({tone="sprout", children}) => {
  const t = GROUP_TONES[tone]||GROUP_TONES.sprout;
  return <span style={{fontFamily:"var(--font-head)", fontSize:12, fontWeight:600, color:t.fg}}>{children}</span>;
};

// ===================== Stripe placeholder =====================
const StripeImg = ({h=170, cap="图片占位", radius="var(--r-md)", style}) => (
  <div className="stripe" style={{height:h, borderRadius:radius, ...style}}>
    <span className="stripe-cap">{cap}</span>
  </div>
);

// ===================== Nav header =====================
const NavHeader = ({title, onBack, right}) => (
  <div className="navhead">
    <div className="navback" onClick={onBack}><Icon name="back" size={21}/></div>
    <div className="nh-title">{title}</div>
    {right || <div style={{width:40, flex:"0 0 auto"}}></div>}
  </div>
);

// ===================== Tab bar =====================
const TABS = [
  {id:"forum", label:"论坛", icon:"forum"},
  {id:"messages", label:"消息", icon:"bell", badge:2},
  {id:"mine", label:"我的", icon:"user"},
];
const TabBar = ({active, onTab}) => (
  <div className="tabbar">
    {TABS.map(t=>(
      <div key={t.id} className={"tabitem"+(active===t.id?" active":"")} onClick={()=>onTab(t.id)} style={{position:"relative"}}>
        <div style={{position:"relative"}}>
          <Icon name={t.icon} size={25} stroke={active===t.id?2:1.7} fill={active===t.id&&t.id==="forum"?"none":"none"}/>
          {t.badge ? <span className="tab-badge">{t.badge}</span> : null}
        </div>
        <span className="tab-label">{t.label}</span>
      </div>
    ))}
  </div>
);

// ===================== Toast hook =====================
const Toast = ({msg}) => msg ? <div className="toast">{msg}</div> : null;

// export
Object.assign(window, {
  Icon, Lily, StatusBar, Toggle, Avatar, GroupPill, GROUP_TONES,
  StripeImg, NavHeader, TabBar, TABS, Toast, shade,
});
