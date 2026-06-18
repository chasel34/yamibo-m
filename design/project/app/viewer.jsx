// ===================== Manga reader (Mihon-style, UI aligned to the novel reader) =====================
// 左右翻页 (LTR) · 点击中央唤出UI · 左右热区翻页 · 底部进度滑块 · 上下滑动退出 · 双击/捏合缩放
// 顶/底栏、状态栏、滑块、图标按钮、操作行全部对齐阅读模式（跟随 reader 的当前主题，默认纸白）。
const VIc = window.Icon;

// deterministic page aspect ratios (most portrait, occasional wide spread)
const pageAR = (k) => {
  const r = [0.69, 0.70, 0.68, 0.71, 0.69][k % 5];
  return (k > 0 && k % 6 === 0) ? 1.4 : r;
};

// —— mini status line (复刻 reader 的 RStatus，主题化) ——
const VStatus = ({ T }) => (
  <div style={{ height: 36, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px 0 26px", fontFamily: "var(--font-head)", color: T.ink, fontWeight: 600 }}>
    <span style={{ fontSize: 14, fontVariantNumeric: "tabular-nums" }}>9:08</span>
    <span style={{ display: "flex", alignItems: "center", gap: 6, opacity: .85 }}>
      <svg width="17" height="11" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0.5" width="3" height="11.5" rx="1" opacity=".4" /></svg>
      <svg width="24" height="12" viewBox="0 0 26 13" fill="none"><rect x="0.5" y="0.5" width="21" height="12" rx="3.2" stroke="currentColor" opacity="0.4" /><rect x="2" y="2" width="15" height="9" rx="1.8" fill="currentColor" /><rect x="23" y="4" width="1.6" height="5" rx="0.8" fill="currentColor" opacity="0.4" /></svg>
    </span>
  </div>
);

// —— page progress slider (复刻 reader 的 ChapterSlider，按页定位) ——
const PageSlider = ({ i, n, T, onJump }) => {
  const trackRef = React.useRef(null);
  const [drag, setDrag] = React.useState(null);
  const idx = drag != null ? drag : i;
  const ratio = n <= 1 ? 1 : idx / (n - 1);
  const pick = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return Math.round(t * (n - 1));
  };
  const start = (e) => { if (n <= 1) return; e.stopPropagation(); const t = e.touches ? e.touches[0] : e; setDrag(pick(t.clientX)); };
  const move = (e) => { if (drag == null) return; e.stopPropagation(); if (e.cancelable && e.touches) e.preventDefault(); const t = e.touches ? e.touches[0] : e; setDrag(pick(t.clientX)); };
  const end = (e) => { if (drag == null) return; e.stopPropagation(); const ni = drag; setDrag(null); if (ni !== i) onJump(ni); };
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 9, fontFamily: "var(--font-head)", fontSize: 12.5, color: T.soft }}>
        <span style={{ color: drag != null ? T.accent : T.soft, fontWeight: drag != null ? 700 : 500 }}>第 {idx + 1} 页</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{n <= 1 ? "单页" : (idx + 1) + " / " + n}</span>
      </div>
      <div ref={trackRef} onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={(e) => drag != null && end(e)}
        style={{ position: "relative", height: 26, display: "flex", alignItems: "center", cursor: n > 1 ? "pointer" : "default", touchAction: "none" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 3, borderRadius: 2, background: T.line }}></div>
        <div style={{ position: "absolute", left: 0, width: (ratio * 100) + "%", height: 3, borderRadius: 2, background: T.accent, opacity: .85 }}></div>
        <div style={{ position: "absolute", left: `calc(${ratio * 100}% - 9px)`, width: 18, height: 18, borderRadius: "50%", background: T.accent, boxShadow: "0 1px 4px rgba(0,0,0,.25)", transition: drag != null ? "none" : "left .2s" }}></div>
      </div>
    </div>
  );
};

// —— mini page placeholder (用于目录网格 & 翻页画布) ——
const PagePaper = ({ cap, capSize = 10.5 }) => (
  <div style={{
    width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#f4f1ee", backgroundImage: "repeating-linear-gradient(135deg, rgba(120,90,80,.08) 0 11px, rgba(120,90,80,.03) 11px 22px)",
  }}>
    <span style={{ fontFamily: 'ui-monospace,"SF Mono",Menlo,monospace', fontSize: capSize, letterSpacing: ".4px", color: "#9a857c", background: "rgba(255,255,255,.7)", padding: "3px 9px", borderRadius: 6 }}>{cap}</span>
  </div>
);

const ImageViewer = ({ images, index, title }) => {
  const nav = window.useNav();
  const n = images.length;
  const T = window.RTHEMES.paper;   // 固定纸白 chrome（贴合阅读模式默认外观，不跟随/切换主题）

  const seen = React.useRef(localStorage.getItem("yh_viewer_hint") === "1");
  const [hint, setHint] = React.useState(() => !seen.current);
  const [ui, setUi] = React.useState(() => seen.current);
  const [panel, setPanel] = React.useState(null);   // grid
  const [i, setI] = React.useState(index || 0);
  const [dx, setDx] = React.useState(0);
  const [dy, setDy] = React.useState(0);
  const [scale, setScale] = React.useState(1);
  const [tx, setTx] = React.useState(0);
  const [ty, setTy] = React.useState(0);
  const [anim, setAnim] = React.useState(true);

  const view = React.useRef(null);
  const g = React.useRef({});
  const tap = React.useRef({ t: 0, x: 0, y: 0, timer: null });
  const [vp, setVp] = React.useState({ W: 0, H: 0 });   // 视口尺寸，用于按比例 contain
  React.useLayoutEffect(() => {
    const measure = () => { const r = view.current?.getBoundingClientRect(); if (r) setVp({ W: r.width, H: r.height }); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  // 按页面比例在视口内 contain：纵图上下留黑，宽图左右留黑
  const pageBox = (k) => {
    const R = pageAR(k);
    const { W, H } = vp;
    if (!W || !H) return { width: "auto", height: "100%", aspectRatio: String(R) };
    let w = H * R, h = H;
    if (w > W) { w = W; h = W / R; }
    return { width: Math.round(w) + "px", height: Math.round(h) + "px" };
  };

  const dismissHint = () => { setHint(false); localStorage.setItem("yh_viewer_hint", "1"); };
  React.useEffect(() => { if (hint) { const t = setTimeout(dismissHint, 4200); return () => clearTimeout(t); } }, [hint]);
  React.useEffect(() => { if (!hint && ui) { const t = setTimeout(() => setUi(false), 2200); return () => clearTimeout(t); } }, [hint]);
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") go(i + 1);
      else if (e.key === "ArrowLeft") go(i - 1);
      else if (e.key === "Escape") nav.closeViewer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const resetZoom = () => { setScale(1); setTx(0); setTy(0); };
  const go = (ni) => { if (ni < 0 || ni > n - 1) return; setAnim(true); resetZoom(); setI(ni); };
  const dims = () => { const r = view.current?.getBoundingClientRect(); return { W: r?.width || 375, H: r?.height || 600 }; };
  const clampPan = (x, y, s) => {
    const { W, H } = dims();
    const mx = (s - 1) * W / 2, my = (s - 1) * H / 2;
    return [Math.max(-mx, Math.min(mx, x)), Math.max(-my, Math.min(my, y))];
  };

  const onStart = (e) => {
    const ts = e.touches;
    if (ts && ts.length === 2) {
      const d = Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
      g.current = { mode: "pinch", d0: d, s0: scale };
      setAnim(false);
      return;
    }
    const p = ts ? ts[0] : e;
    g.current = { mode: scale > 1 ? "pan" : "idle", x0: p.clientX, y0: p.clientY, tx0: tx, ty0: ty, moved: false, t0: Date.now() };
    setAnim(false);
  };
  const onMove = (e) => {
    const s = g.current; if (!s.mode) return;
    const ts = e.touches;
    if (s.mode === "pinch" && ts && ts.length === 2) {
      if (e.cancelable) e.preventDefault();
      const d = Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
      let ns = Math.max(1, Math.min(4, s.s0 * (d / s.d0)));
      setScale(ns);
      const [cx, cy] = clampPan(tx, ty, ns); setTx(cx); setTy(cy);
      return;
    }
    const p = ts ? ts[0] : e;
    const mx = p.clientX - s.x0, my = p.clientY - s.y0;
    if (Math.abs(mx) > 6 || Math.abs(my) > 6) s.moved = true;
    if (s.mode === "pan") {
      if (e.cancelable) e.preventDefault();
      const [cx, cy] = clampPan(s.tx0 + mx, s.ty0 + my, scale);
      setTx(cx); setTy(cy);
      return;
    }
    if (s.mode === "idle") {
      if (s.axis == null && (Math.abs(mx) > 8 || Math.abs(my) > 8))
        s.axis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
      if (s.axis === "x") {
        if (e.cancelable) e.preventDefault();
        let d = mx;
        if ((i === 0 && d > 0) || (i === n - 1 && d < 0)) d *= 0.32;
        setDx(d);
      } else if (s.axis === "y") {
        if (e.cancelable) e.preventDefault();
        setDy(my);
      }
    }
  };
  const onEnd = () => {
    const s = g.current; if (!s.mode) return;
    if (s.mode === "pinch") { if (scale < 1.08) { setAnim(true); resetZoom(); } g.current = {}; return; }
    if (s.mode === "pan") { g.current = {}; return; }
    if (s.axis === "x") {
      const { W } = dims();
      const th = Math.min(90, W * 0.22);
      setAnim(true);
      if (dx <= -th && i < n - 1) { resetZoom(); setI(i + 1); }
      else if (dx >= th && i > 0) { resetZoom(); setI(i - 1); }
      setDx(0);
    } else if (s.axis === "y") {
      if (Math.abs(dy) > 120) { nav.closeViewer(); }
      else { setAnim(true); setDy(0); }
    } else if (!s.moved) {
      handleTap(s);
    }
    g.current = {};
  };

  const handleTap = (s) => {
    const now = Date.now();
    const dt = tap.current;
    if (now - dt.t < 280 && Math.abs(s.x0 - dt.x) < 40 && Math.abs(s.y0 - dt.y) < 40) {
      clearTimeout(dt.timer); dt.t = 0;
      doubleTap(s.x0, s.y0);
    } else {
      tap.current = { t: now, x: s.x0, y: s.y0, timer: setTimeout(() => singleTap(s.x0), 280) };
    }
  };
  const singleTap = (clientX) => {
    if (scale > 1) { setUi(v => !v); return; }
    const r = view.current?.getBoundingClientRect(); if (!r) return;
    const f = (clientX - r.left) / r.width;
    if (f < 0.30) go(i - 1);
    else if (f > 0.70) go(i + 1);
    else setUi(v => !v);
  };
  const doubleTap = (clientX, clientY) => {
    setAnim(true);
    if (scale > 1) { resetZoom(); return; }
    const r = view.current?.getBoundingClientRect(); if (!r) { setScale(2.4); return; }
    const ns = 2.4;
    const px = clientX - r.left - r.width / 2;
    const py = clientY - r.top - r.height / 2;
    const [cx, cy] = clampPan(px * (1 - ns), py * (1 - ns), ns);
    setScale(ns); setTx(cx); setTy(cy);
  };

  // chrome tokens — 与 ReaderChrome 完全一致
  const tr = "transform .3s cubic-bezier(.32,.72,.34,1)";
  const iconBtn = { width: 42, height: 42, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.ink, background: "transparent", border: "none" };
  const chevBtn = (dis) => ({ width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: dis ? "default" : "pointer", color: dis ? T.soft : T.ink, opacity: dis ? .4 : 1, background: "none", border: "none" });
  const actBtn = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "6px 0", cursor: "pointer", color: T.ink, background: "none", border: "none", fontFamily: "var(--font-head)", fontSize: 11.5, fontWeight: 600 };
  const dimByPull = Math.min(0.6, Math.abs(dy) / 600);

  return (
    <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${(1 - dimByPull).toFixed(3)})`, display: "flex", flexDirection: "column", zIndex: 1, overflow: "hidden" }}>
      {/* page track */}
      <div
        ref={view}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
        style={{ position: "absolute", inset: 0, touchAction: "none", transform: `translateY(${dy}px)`, transition: anim ? "transform .3s cubic-bezier(.32,.72,.34,1)" : "none" }}
      >
        <div style={{ display: "flex", width: "100%", height: "100%", transform: `translateX(calc(${-i * 100}% + ${dx}px))`, transition: anim ? "transform .32s cubic-bezier(.32,.72,.34,1)" : "none" }}>
          {images.map((img, k) => (
            <div key={k} style={{ flex: "0 0 100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <div style={{
                ...pageBox(k),
                transform: k === i ? `scale(${scale}) translate(${tx / (scale || 1)}px,${ty / (scale || 1)}px)` : "none",
                transition: anim ? "transform .26s cubic-bezier(.32,.72,.34,1)" : "none",
                transformOrigin: "center center",
              }}>
                <PagePaper cap={img.cap || `第 ${k + 1} 页`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* tap-zone chevron affordance (over dark canvas) */}
      {ui && scale === 1 && !panel && (
        <React.Fragment>
          <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,.5)", pointerEvents: "none", opacity: i > 0 ? 1 : .2, transition: "opacity .2s" }}><VIc name="back" size={26} /></div>
          <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,.5)", pointerEvents: "none", opacity: i < n - 1 ? 1 : .2, transition: "opacity .2s" }}><VIc name="chevRight" size={26} /></div>
        </React.Fragment>
      )}

      {/* ---- first-use intro (对齐 reader 的首次提示，更完整) ---- */}
      {hint && (
        <div onClick={dismissHint} style={{ position: "absolute", inset: 0, zIndex: 30, display: "flex", flexDirection: "column", background: "rgba(15,10,8,.82)", cursor: "pointer" }}>
          <div style={{ flex: 1, display: "flex" }}>
            {[
              { ic: "back", t: "上一页", s: "轻点左侧" },
              { ic: "forum", t: "切换菜单", s: "轻点中央" },
              { ic: "chevRight", t: "下一页", s: "轻点右侧" },
            ].map((z, k) => (
              <div key={k} style={{
                flex: k === 1 ? "0 0 40%" : "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
                color: "#fff", background: "rgba(20,14,11," + (k === 1 ? ".34" : ".18") + ")",
                borderLeft: k ? "1px dashed rgba(255,255,255,.22)" : "none",
              }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,.4)", display: "flex", alignItems: "center", justifyContent: "center" }}><VIc name={z.ic} size={24} /></div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-head)", fontSize: 14, fontWeight: 700 }}>{z.t}</div>
                  <div style={{ fontFamily: "var(--font-head)", fontSize: 11.5, color: "rgba(255,255,255,.6)", marginTop: 3 }}>{z.s}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ flex: "0 0 auto", padding: "20px 26px calc(28px + env(safe-area-inset-bottom))", textAlign: "center", background: "rgba(20,14,11,.34)", borderTop: "1px solid rgba(255,255,255,.1)" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 22, marginBottom: 16, color: "rgba(255,255,255,.85)", fontFamily: "var(--font-head)", fontSize: 12.5, fontWeight: 600 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><VIc name="zoom" size={16} />双击 / 捏合放大</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><VIc name="chevDown" size={16} />上下滑动退出</span>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", height: 40, padding: "0 22px", borderRadius: 999, background: T.accent, color: "#fff", fontFamily: "var(--font-head)", fontSize: 14, fontWeight: 600 }}>知道了</span>
          </div>
        </div>
      )}

      {/* ---- top bar (对齐 ReaderChrome.top) ---- */}
      <div onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
        background: T.chrome, borderBottom: "1px solid " + T.line, boxShadow: "0 4px 24px rgba(30,18,12,.10)",
        transform: ui ? "translateY(0)" : "translateY(-100%)", transition: tr,
      }}>
        <VStatus T={T} />
        <div className="row" style={{ padding: "2px 12px 12px", gap: 6 }}>
          <button onClick={nav.closeViewer} style={iconBtn}><VIc name="back" size={22} /></button>
          <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-head)", fontSize: 15, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title || "汉化图集"}</div>
            <div style={{ fontFamily: "var(--font-head)", fontSize: 11.5, color: T.soft, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{i + 1} / {n}</div>
          </div>
          <button onClick={() => nav.toast("已保存到相册")} style={iconBtn}><VIc name="download" size={21} /></button>
        </div>
      </div>

      {/* ---- bottom bar (对齐 ReaderChrome.bottom：导航行 + 操作行) ---- */}
      <div onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20,
        background: T.chrome, borderTop: "1px solid " + T.line, boxShadow: "0 -4px 24px rgba(30,18,12,.10)", padding: "16px 22px 22px",
        transform: ui ? "translateY(0)" : "translateY(100%)", transition: tr,
      }}>
        <div className="row" style={{ gap: 8, marginBottom: 6 }}>
          <button onClick={() => go(i - 1)} style={chevBtn(i === 0)} disabled={i === 0}><VIc name="back" size={20} /></button>
          <div style={{ flex: 1 }}><PageSlider i={i} n={n} T={T} onJump={go} /></div>
          <button onClick={() => go(i + 1)} style={chevBtn(i === n - 1)} disabled={i === n - 1}><VIc name="chevRight" size={20} /></button>
        </div>
        <div className="row" style={{ borderTop: "1px solid " + T.line, marginTop: 10, paddingTop: 6, justifyContent: "center" }}>
          <button onClick={() => setPanel("grid")} style={{ ...actBtn, flex: "0 0 auto", padding: "6px 40px" }}><VIc name="doc" size={21} />目录</button>
        </div>
      </div>

      {/* ---- panels (复用 reader 的 RSheet) ---- */}
      {panel === "grid" && (
        <window.RSheet T={T} onClose={() => setPanel(null)} title={"目录 · 共 " + n + " 页"}>
          <div className="rd-scroll" style={{ overflowY: "auto", margin: "0 -4px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, padding: "2px 4px 6px" }}>
              {images.map((img, k) => {
                const cur = k === i;
                return (
                  <div key={k} onClick={() => { go(k); setPanel(null); }} style={{ cursor: "pointer" }}>
                    <div style={{ aspectRatio: "0.7", borderRadius: 9, overflow: "hidden", border: cur ? "2.5px solid " + T.accent : "1px solid " + T.line }}>
                      <PagePaper cap={String(k + 1)} capSize={12} />
                    </div>
                    <div style={{ textAlign: "center", marginTop: 5, fontFamily: "var(--font-head)", fontSize: 11.5, fontWeight: cur ? 700 : 500, color: cur ? T.accent : T.soft, fontVariantNumeric: "tabular-nums" }}>{cur ? "当前" : k + 1}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </window.RSheet>
      )}
    </div>
  );
};

Object.assign(window, { ImageViewer });
