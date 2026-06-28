// ===================== 应用更新（OTA / 大版本）=====================
// 思路：不打断阅读。检查从设置/关于发起 → 底部弹层 UpdateSheet 呈现多状态；
// 自动更新在启动时静默下载，就绪后用底部轻提示 UpdateReadyBanner 轻轻告知，
// 由用户决定何时重启（绝不自动重启）。全部克制、温和，提示降低焦虑而非报错。
const UIc = window.Icon;

// 版本信息（演示用）
window.UPDATE_INFO = {
  current: "v1.0",
  ota: {
    version: "v1.0.3",
    size: "2.4 MB",
    notes: ["修复夜间模式下偶发的闪屏", "长帖楼层加载更快更省流", "记住你设置的阅读字号"],
  },
  native: {
    version: "v2.0",
    size: "38 MB",
    where: "yamibo.app/download",
    notes: ["全新离线缓存，地铁里也能读", "支持发帖、回复与私信", "需要安装新的安装包"],
  },
};

// 把场景标识映射到结果阶段
const SCENARIO_TO_PHASE = {
  ota: "ota-found",
  none: "none",
  native: "native",
  error: "error",
  unsupported: "unsupported",
};

// —— 控制器：集中管理检查 / 下载 / 就绪 / 重启 + 启动静默更新 ——
function useUpdater(getScenario, toast) {
  const [sheet, setSheet] = React.useState(null);   // null | "open" | "closing"
  const [phase, setPhase] = React.useState("idle"); // checking | none | ota-found | downloading | ready | error | unsupported | native
  const [progress, setProgress] = React.useState(0);
  const [staged, setStaged] = React.useState(false); // OTA 已下载、等待重启
  const [restarting, setRestarting] = React.useState(false);
  const [banner, setBanner] = React.useState(null);  // null | "open" | "closing"
  const timers = React.useRef([]);
  const wantBanner = React.useRef(false);  // 下载完成后用 banner（而非弹层 ready）提示
  const downloading = React.useRef(false);
  const after = (ms, fn) => { const id = setTimeout(fn, ms); timers.current.push(id); return id; };
  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const resolveCheck = React.useCallback(() => {
    const sc = getScenario();
    // 已在后台下载完成：直接给「就绪」
    if (staged && sc === "ota") { setPhase("ready"); return; }
    setPhase("checking");
    after(1400, () => setPhase(SCENARIO_TO_PHASE[sc] || "none"));
  }, [getScenario, staged]);

  const openCheck = React.useCallback(() => {
    setSheet("open");
    resolveCheck();
  }, [resolveCheck]);

  const closeSheet = React.useCallback(() => {
    setSheet("closing");
    after(240, () => { setSheet(null); });
  }, []);

  const runDownload = React.useCallback(() => {
    if (downloading.current) return;
    downloading.current = true;
    setProgress(0);
    let p = 0;
    const tick = () => {
      p += Math.random() * 16 + 8;
      if (p >= 100) {
        setProgress(100);
        setStaged(true);
        downloading.current = false;
        if (wantBanner.current) { setBanner("open"); }
        else { after(280, () => setPhase("ready")); }
      } else {
        setProgress(p);
        after(180 + Math.random() * 140, tick);
      }
    };
    after(260, tick);
  }, []);

  const startDownload = React.useCallback(() => {
    wantBanner.current = false;
    setPhase("downloading");
    runDownload();
  }, [runDownload]);

  const downloadInBackground = React.useCallback(() => {
    // 继续已在进行的下载，关闭弹层，完成后用 banner 提示
    wantBanner.current = true;
    closeSheet();
    toast && toast("将在后台继续下载");
  }, [closeSheet, toast]);

  const retry = React.useCallback(() => { resolveCheck(); }, [resolveCheck]);

  const restartNow = React.useCallback(() => {
    setSheet(null); setBanner(null);
    setRestarting(true);
    after(1700, () => {
      setRestarting(false);
      setStaged(false);
      setPhase("idle");
      toast && toast("已更新到 " + window.UPDATE_INFO.ota.version);
    });
  }, [toast]);

  const dismissBanner = React.useCallback(() => {
    setBanner("closing");
    after(240, () => setBanner(null));
  }, []);

  // 启动静默检查（演示：可重放）
  const launchSilentCheck = React.useCallback(() => {
    const sc = getScenario();
    if (sc !== "ota") return;          // 仅 OTA 场景演示静默下载
    if (staged) { setBanner("open"); return; }
    wantBanner.current = true;
    after(2600, runDownload);
  }, [getScenario, staged, runDownload]);

  return {
    sheet, phase, progress, staged, restarting, banner,
    openCheck, closeSheet, startDownload, downloadInBackground,
    retry, restartNow, dismissBanner, launchSilentCheck,
  };
}

// —— 进入动画小钩子 ——
function useRise() {
  const [m, setM] = React.useState(false);
  React.useEffect(() => { const a = setTimeout(() => setM(true), 16); return () => clearTimeout(a); }, []);
  return m;
}

// —— 通用底部弹层外壳 ——
const Sheet = ({ exiting, onClose, children }) => {
  const m = useRise();
  const shown = m && !exiting;
  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,12,8,.42)", zIndex: 54,
        opacity: shown ? 1 : 0, transition: "opacity .24s ease" }}></div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 55,
        transform: shown ? "translateY(0)" : "translateY(102%)",
        transition: "transform .3s cubic-bezier(.32,.72,.34,1)" }}>
        <div style={{ background: "var(--card)", borderRadius: "26px 26px 0 0", padding: "10px 22px calc(26px + env(safe-area-inset-bottom,0px))",
          boxShadow: "0 -14px 50px rgba(30,18,12,.22)" }}>
          <div style={{ width: 38, height: 5, borderRadius: 3, background: "var(--line-strong)", margin: "0 auto 6px" }}></div>
          {children}
        </div>
      </div>
    </>
  );
};

// —— 圆形图标章 ——
const Medallion = ({ name, tone = "accent", size = 56 }) => {
  const accent = tone === "accent";
  return (
    <div style={{ width: size, height: size, borderRadius: 17, margin: "8px auto 0",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: accent ? "var(--accent-soft)" : "var(--card-2)",
      color: accent ? "var(--accent-ink)" : "var(--ink-soft)" }}>
      <UIc name={name} size={size * 0.46} stroke={1.7} />
    </div>
  );
};

const sheetTitle = { fontFamily: "var(--font-head)", fontSize: 19, fontWeight: 700, color: "var(--ink)", textAlign: "center", marginTop: 16, letterSpacing: "-.2px" };
const sheetBody = { fontFamily: "var(--font-body)", fontSize: 14.5, color: "var(--ink-soft)", textAlign: "center", marginTop: 11, lineHeight: 1.72, padding: "0 6px" };
const verLine = { fontFamily: "var(--font-head)", fontSize: 13, fontWeight: 600, color: "var(--muted)", textAlign: "center", marginTop: 9, fontVariantNumeric: "tabular-nums" };

const PrimaryBtn = ({ onClick, children, icon }) => (
  <button onClick={onClick} className="btn-primary" style={{ marginTop: 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
    {icon && <UIc name={icon} size={19} />}{children}
  </button>
);
const GhostBtn = ({ onClick, children }) => (
  <button onClick={onClick} style={{ width: "100%", height: 52, borderRadius: 999, marginTop: 10, cursor: "pointer",
    border: "none", background: "var(--card-2)", color: "var(--ink-2)", fontFamily: "var(--font-head)", fontSize: 16.5, fontWeight: 600 }}>
    {children}
  </button>
);

// —— 更新说明清单 ——
const NoteList = ({ notes }) => (
  <div style={{ background: "var(--card-2)", borderRadius: 15, padding: "15px 16px", marginTop: 18 }}>
    <div className="kicker" style={{ fontSize: 10.5, marginBottom: 10 }}>本次更新</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {notes.map((n, i) => (
        <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flex: "0 0 auto", marginTop: 8 }}></span>
          <span style={{ fontFamily: "var(--font-head)", fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.5 }}>{n}</span>
        </div>
      ))}
    </div>
  </div>
);

// —— 弹层内容（按 phase 切换）——
const SheetContent = ({ ctrl }) => {
  const D = window.UPDATE_INFO;
  switch (ctrl.phase) {
    case "checking":
      return (
        <div style={{ padding: "34px 0 30px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <span className="spin" style={{ width: 26, height: 26, borderWidth: 2.5 }}></span>
          <span style={{ fontFamily: "var(--font-head)", fontSize: 15, fontWeight: 600, color: "var(--ink-soft)" }}>正在检查更新…</span>
        </div>
      );
    case "none":
      return (
        <div style={{ paddingBottom: 4 }}>
          <Medallion name="check" tone="soft" />
          <div style={sheetTitle}>已是最新版本</div>
          <div style={sheetBody}>你正在使用最新版本 百合会 {D.current}，无需更新。</div>
          <PrimaryBtn onClick={ctrl.closeSheet}>知道了</PrimaryBtn>
        </div>
      );
    case "ota-found":
      return (
        <div style={{ paddingBottom: 4 }}>
          <Medallion name="download" />
          <div style={sheetTitle}>发现新版本</div>
          <div style={verLine}>{D.current} → {D.ota.version} · {D.ota.size}</div>
          <NoteList notes={D.ota.notes} />
          <div style={{ ...sheetBody, fontSize: 13, marginTop: 14, color: "var(--muted)" }}>更新很小，将在后台下载，完成后由你决定何时重启。</div>
          <PrimaryBtn onClick={ctrl.startDownload} icon="download">下载更新</PrimaryBtn>
          <GhostBtn onClick={ctrl.closeSheet}>稍后</GhostBtn>
        </div>
      );
    case "downloading": {
      const pct = Math.round(ctrl.progress);
      return (
        <div style={{ padding: "6px 0 4px" }}>
          <Medallion name="download" />
          <div style={sheetTitle}>正在下载更新…</div>
          <div style={{ ...verLine, marginTop: 10, fontSize: 22, color: "var(--ink)", fontWeight: 700 }}>{pct}%</div>
          <div style={{ width: "100%", height: 5, borderRadius: 3, background: "var(--card-2)", marginTop: 16, overflow: "hidden" }}>
            <div style={{ height: "100%", width: pct + "%", background: "var(--accent)", borderRadius: 3, transition: "width .22s ease" }}></div>
          </div>
          <div style={{ ...sheetBody, fontSize: 13, marginTop: 16, color: "var(--muted)" }}>下载时可以继续阅读，不会打断你。</div>
          <GhostBtn onClick={ctrl.downloadInBackground}>在后台下载</GhostBtn>
        </div>
      );
    }
    case "ready":
      return (
        <div style={{ paddingBottom: 4 }}>
          <Medallion name="sparkle" />
          <div style={sheetTitle}>更新已准备好</div>
          <div style={sheetBody}>重启应用后即可用上 {D.ota.version}。下次自行打开也会自动生效，不必着急。</div>
          <PrimaryBtn onClick={ctrl.restartNow} icon="refresh">立即重启</PrimaryBtn>
          <GhostBtn onClick={ctrl.closeSheet}>稍后</GhostBtn>
        </div>
      );
    case "error":
      return (
        <div style={{ paddingBottom: 4 }}>
          <Medallion name="wave" tone="soft" />
          <div style={sheetTitle}>检查更新失败</div>
          <div style={sheetBody}>网络好像不太稳定，没能完成检查。歇一会儿再试也不迟。</div>
          <PrimaryBtn onClick={ctrl.retry} icon="refresh">重试</PrimaryBtn>
          <GhostBtn onClick={ctrl.closeSheet}>稍后</GhostBtn>
        </div>
      );
    case "unsupported":
      return (
        <div style={{ paddingBottom: 4 }}>
          <Medallion name="info" tone="soft" />
          <div style={sheetTitle}>暂不支持在线更新</div>
          <div style={sheetBody}>当前版本（开发版本或未配置更新通道）暂不支持在线更新，可前往发布页获取最新版本。</div>
          <PrimaryBtn onClick={ctrl.closeSheet}>知道了</PrimaryBtn>
        </div>
      );
    case "native":
      return (
        <div style={{ paddingBottom: 4 }}>
          <Medallion name="box" />
          <div style={sheetTitle}>发现新版安装包</div>
          <div style={verLine}>{D.current} → {D.native.version} · {D.native.size}</div>
          <NoteList notes={D.native.notes} />
          <div style={{ ...sheetBody, fontSize: 13, marginTop: 14, color: "var(--muted)" }}>这是一次较大的更新，需前往发布页下载并安装新的安装包。</div>
          <PrimaryBtn onClick={() => { ctrl.closeSheet(); ctrl._goDownload(); }} icon="external">去下载</PrimaryBtn>
          <GhostBtn onClick={ctrl.closeSheet}>稍后</GhostBtn>
        </div>
      );
    default:
      return null;
  }
};

const UpdateSheet = ({ ctrl }) => {
  if (!ctrl.sheet) return null;
  return (
    <Sheet exiting={ctrl.sheet === "closing"} onClose={ctrl.phase === "downloading" || ctrl.phase === "checking" ? () => {} : ctrl.closeSheet}>
      <SheetContent ctrl={ctrl} />
    </Sheet>
  );
};

// —— 启动 / 后台下载完成后的轻提示（底部，不打断）——
const UpdateReadyBanner = ({ ctrl }) => {
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    if (ctrl.banner === "open") { const a = setTimeout(() => setShown(true), 16); return () => clearTimeout(a); }
    setShown(false);
  }, [ctrl.banner]);
  if (!ctrl.banner) return null;
  const D = window.UPDATE_INFO;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 52, display: "flex", justifyContent: "center",
      padding: "0 14px 26px", pointerEvents: "none" }}>
      <div style={{ pointerEvents: "auto", width: "100%", maxWidth: 348, display: "flex", alignItems: "center", gap: 12,
        background: "var(--card)", border: "1px solid var(--line)", borderRadius: 18, boxShadow: "var(--shadow-pop)",
        padding: "13px 13px 13px 16px",
        transform: shown ? "translateY(0)" : "translateY(140%)", opacity: shown ? 1 : 0,
        transition: "transform .34s cubic-bezier(.32,.72,.34,1), opacity .34s ease" }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, flex: "0 0 auto", background: "var(--accent-soft)",
          color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center" }}><UIc name="sparkle" size={20} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: "var(--font-head)", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>新版本已准备好</span>
          <span style={{ display: "block", fontFamily: "var(--font-head)", fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{D.ota.version} · 重启后生效</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "0 0 auto" }}>
          <button onClick={ctrl.dismissBanner} style={{ border: "none", background: "transparent", color: "var(--ink-soft)",
            fontFamily: "var(--font-head)", fontSize: 13, fontWeight: 600, height: 34, padding: "0 10px", borderRadius: 999, cursor: "pointer" }}>稍后</button>
          <button onClick={ctrl.restartNow} style={{ border: "none", background: "var(--accent)", color: "#fff",
            fontFamily: "var(--font-head)", fontSize: 13, fontWeight: 600, height: 34, padding: "0 14px", borderRadius: 999, cursor: "pointer" }}>立即重启</button>
        </div>
      </div>
    </div>
  );
};

// —— 重启遮罩（模拟应用重启）——
const RestartOverlay = ({ on }) => {
  if (!on) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 70, background: "var(--bg)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}>
      <div style={{ animation: "updPulse 1.3s ease-in-out infinite" }}>
        <window.Lily size={62} stroke={1.5} />
      </div>
      <span style={{ fontFamily: "var(--font-head)", fontSize: 14, fontWeight: 600, color: "var(--muted)", letterSpacing: ".4px" }}>正在重启…</span>
    </div>
  );
};

(function injectUpdCSS() {
  if (document.getElementById("upd-css")) return;
  const s = document.createElement("style"); s.id = "upd-css";
  s.textContent = `@keyframes updPulse{0%,100%{opacity:.45;transform:scale(.94)}50%{opacity:1;transform:scale(1)}}`;
  document.head.appendChild(s);
})();

Object.assign(window, { useUpdater, UpdateSheet, UpdateReadyBanner, RestartOverlay });
