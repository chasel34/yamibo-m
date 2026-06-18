const { StatusBar: SBm, TabBar: TBm } = window;

// Push layer: timeout-driven transition (works even when CSS animation clock is throttled).
// Resting state is forced with transition:none once settled, so content is never stuck off-screen.
function PushLayer({exiting, children}){
  const [mounted, setMounted] = React.useState(false);
  const [settled, setSettled] = React.useState(false);
  React.useEffect(()=>{
    const a = setTimeout(()=> setMounted(true), 16);
    const b = setTimeout(()=> setSettled(true), 420);
    return ()=>{ clearTimeout(a); clearTimeout(b); };
  }, []);
  let transform = "translateX(0)";
  if(!mounted) transform = "translateX(100%)";
  if(exiting) transform = "translateX(100%)";
  const transition = (settled && !exiting) ? "none" : "transform .3s cubic-bezier(.32,.72,.34,1)";
  return (
    <div className="layer" style={{transform, transition, boxShadow:"-12px 0 40px rgba(40,20,15,.12)", zIndex:5}}>
      {children}
    </div>
  );
}

const SCREENS = {
  forum:   (p)=> <window.ForumScreen {...p}/>,
  board:   (p)=> <window.BoardScreen {...p}/>,
  thread:  (p)=> <window.ThreadScreen {...p}/>,
  profile: (p)=> <window.ProfileScreen {...p}/>,
  messages:(p)=> <window.MessagesScreen {...p}/>,
  mine:    (p)=> <window.MineScreen {...p}/>,
  settings:(p)=> <window.SettingsScreen {...p}/>,
  collections:(p)=> <window.CollectionsScreen {...p}/>,
  history: (p)=> <window.HistoryScreen {...p}/>,
  about:   (p)=> <window.AboutScreen {...p}/>,
  reader:  (p)=> <window.Reader {...p}/>,
};
const TAB_SCREENS = { forum:1, messages:1, mine:1 };

function App(){
  const [theme, setThemeState] = React.useState(()=> localStorage.getItem("yh_theme") || "light");
  const [booted, setBooted] = React.useState(()=> localStorage.getItem("yh_booted")==="1");
  const [activeTab, setActiveTab] = React.useState("forum");
  const [stack, setStack] = React.useState([]);      // [{screen, params, key, state}]
  const [viewer, setViewer] = React.useState(null);  // {images, index, state}
  const [toastMsg, setToastMsg] = React.useState(null);
  const toastTimer = React.useRef(null);
  const keyRef = React.useRef(1);

  React.useEffect(()=>{ document.documentElement.setAttribute("data-theme", theme); }, [theme]);

  const setTheme = (t)=>{ setThemeState(t); localStorage.setItem("yh_theme", t); };

  const toast = (msg)=>{
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(()=> setToastMsg(null), 1700);
  };

  const push = (screen, params)=>{
    setStack(s=> [...s, {screen, params:params||{}, key:keyRef.current++, state:"enter"}]);
  };
  const pop = ()=>{
    setStack(s=>{
      if(!s.length) return s;
      const copy = s.slice();
      copy[copy.length-1] = {...copy[copy.length-1], state:"exit"};
      return copy;
    });
    setTimeout(()=> setStack(s=> s.slice(0,-1)), 270);
  };
  const switchTab = (tab)=>{ setStack([]); setActiveTab(tab); };
  const openViewer = (images, index, title)=> setViewer({images, index:index||0, title, state:"enter"});
  const closeViewer = ()=>{
    setViewer(v=> v? {...v, state:"exit"}:v);
    setTimeout(()=> setViewer(null), 210);
  };
  const login = ()=>{ setBooted(true); localStorage.setItem("yh_booted","1"); };
  const logout = ()=>{ setStack([]); setActiveTab("forum"); setBooted(false); localStorage.removeItem("yh_booted"); toast("已退出登录"); };

  const nav = { push, pop, switchTab, openViewer, closeViewer, login, logout, toast, theme, setTheme };

  const tabBarVisible = stack.length===0 && TAB_SCREENS[activeTab];

  return (
    <window.Nav.Provider value={nav}>
      <div className="phone">
        {/* base tab layer */}
        {booted && (
          <div className="layer layer-base">
            {SCREENS[activeTab]({})}
            {tabBarVisible && <TBm active={activeTab} onTab={switchTab}/>}
          </div>
        )}

        {/* pushed stack */}
        {booted && stack.map((it)=>(
          <PushLayer key={it.key} exiting={it.state==="exit"}>
            {SCREENS[it.screen](it.params)}
          </PushLayer>
        ))}

        {/* login (modal-ish full) */}
        {!booted && (
          <div className="layer" style={{zIndex:20}}>
            <window.LoginScreen/>
          </div>
        )}

        {/* image viewer */}
        {viewer && (
          <div style={{position:"absolute", inset:0, zIndex:40, opacity: viewer.state==="exit"?0:1, transition:"opacity .2s ease"}}>
            <window.ImageViewer images={viewer.images} index={viewer.index} title={viewer.title}/>
          </div>
        )}

        <window.Toast msg={toastMsg}/>
        {booted && <div className="home-indicator"></div>}
      </div>
    </window.Nav.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
