/* SubLingo — styles injected into shadow roots */
var SL = (typeof SL !== 'undefined') ? SL : {};
SL.UI_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.sl-root { font-family: "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif; color: #f5f5f5; -webkit-font-smoothing: antialiased; }
button { font: inherit; color: inherit; cursor: pointer; }

/* ---------- words ---------- */
.sl-w { cursor: pointer; border-radius: 4px; padding: 0 1px; transition: background .1s; }
.sl-w:hover { background: rgba(255,255,255,.22); }
.sl-learning { color: #fb923c; }
.sl-known { color: #4ade80; }
.sl-suggested { color: #fde68a; }
.sl-unknown { color: #93c5fd; }
.sl-rare { opacity: .55; }
.sl-ignored { opacity: .75; }
.sl-special { }
.sl-marked { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; text-decoration-color: currentColor; }
.sl-now { background: rgba(250,204,21,.38) !important; box-shadow: 0 0 0 2px rgba(250,204,21,.38); border-radius: 4px; transition: background .08s; }
.sl-said { opacity: .82; }
.sl-w.sl-sel { background: none !important; }
.sl-selmark { position: absolute; z-index: -1; pointer-events: none; border-radius: 5px;
  background: rgba(250,204,21,.38); box-shadow: 0 0 0 2px rgba(250,204,21,.38);
  transition: left .24s cubic-bezier(.25,.8,.25,1), top .24s cubic-bezier(.25,.8,.25,1), width .24s cubic-bezier(.25,.8,.25,1), height .24s ease, opacity .2s ease, border-radius .2s; }
.sl-selmark.first { border-top-right-radius: 2px; border-bottom-right-radius: 2px; }
.sl-selmark.last { border-top-left-radius: 2px; border-bottom-left-radius: 2px; }
.sl-selmark.mid { border-radius: 2px; }
.sl-w.sl-active { background: rgba(249,115,22,.45) !important; }

/* ---------- overlay subtitles ---------- */
.sl-overlay { position: absolute; left: 0; right: 0; bottom: 9%; display: flex; flex-direction: column; align-items: center; pointer-events: none; z-index: 60; padding: 0 2%; transition: transform .22s ease; }
.sl-wrap { position: relative; display: inline-block; max-width: max(60%, min(92%, calc(100% - 230px))); pointer-events: auto; }
.sl-wrap .sl-orig { max-width: 100%; display: inline-block; }
.sl-side { position: absolute; top: 50%; transform: translateY(-50%); display: flex; gap: 5px; opacity: 0; pointer-events: none; transition: opacity .15s; }
.sl-left { right: 100%; padding-right: 8px; }
.sl-right { left: 100%; padding-left: 8px; }
.sl-wrap:hover .sl-side, .sl-menuopen .sl-side { opacity: 1; pointer-events: auto; }
.sl-sbtn { width: 32px; height: 32px; border-radius: 50%; background: rgba(15,15,18,.78); border: 1px solid rgba(255,255,255,.22); color: #fff; font-size: 14px; line-height: 1; padding: 0; display: inline-flex; align-items: center; justify-content: center; text-shadow: none; }
.sl-sbtn:hover { background: #f97316; border-color: #f97316; color: #111; }
.sl-sbtn.sm { width: 24px; height: 24px; font-size: 13px; }
.sl-grip { cursor: grab; font-size: 15px; }
.sl-dragging, .sl-dragging * { cursor: grabbing !important; user-select: none !important; }
.sl-dragging { transition: none !important; }
.sl-dragging .sl-line { box-shadow: 0 0 0 2px rgba(249,115,22,.65); }
.sl-orig, .sl-trans { cursor: grab; }
.sl-orig .sl-w, .sl-orig .sl-n { cursor: pointer; }
.sl-menu { min-width: 280px; overflow-y: auto; overscroll-behavior: contain; background: rgba(23,23,26,.97); border: 1px solid #333; border-radius: 12px; padding: 6px; display: flex; flex-direction: column; gap: 1px; box-shadow: 0 14px 40px rgba(0,0,0,.5); text-shadow: none; }
.sl-mi { display: flex; justify-content: space-between; align-items: center; gap: 14px; background: none; border: 0; padding: 5px 10px; border-radius: 7px; font-size: 13px; color: #e5e5e5; text-align: left; }
.sl-mi:hover { background: #2a2a2f; }
.sl-mi.on { color: #fb923c; }
.sl-mi.on span:before { content: "✓ "; }
.sl-mi i { font-style: normal; color: #71717a; font-size: 11px; border: 1px solid #3f3f46; border-radius: 4px; padding: 0 5px; min-width: 18px; text-align: center; }
.sl-mi i:empty { display: none; }
.sl-look { border-top: 1px solid #2a2a2f; border-bottom: 1px solid #2a2a2f; margin: 4px 0; padding: 4px 0; }
.sl-lrow { display: flex; align-items: center; gap: 8px; padding: 4px 10px; font-size: 13px; color: #e5e5e5; }
.sl-lrow span { width: 112px; flex: none; }
.sl-lrow input[type=range] { flex: 1; min-width: 70px; accent-color: #f97316; cursor: pointer; }
.sl-lrow b { font-weight: 500; font-size: 12px; color: #a1a1aa; width: 40px; text-align: right; }
.sl-mrow { display: flex; align-items: center; gap: 6px; padding: 6px 10px; font-size: 13px; color: #e5e5e5; }
.sl-mrow span { flex: 1; }
.sl-mrow b { font-weight: 500; font-size: 12px; color: #a1a1aa; min-width: 44px; text-align: center; }
.sl-overlay.sl-hidden { display: none; }
.sl-line { pointer-events: auto; max-width: 92%; text-align: center; line-height: 1.32; margin-top: 4px; border-radius: 8px; padding: 2px 12px 4px; text-shadow: 0 1px 2px rgba(0,0,0,.9); user-select: text; }
.sl-orig { font-weight: 500; }
.sl-trans { color: #e5e7eb; font-weight: 400; }
.sl-trans.sl-blur { filter: blur(6px); opacity: .7; transition: filter .15s; cursor: pointer; }
.sl-trans.sl-blur:hover { filter: none; opacity: 1; }
.sl-badge { pointer-events: auto; position: absolute; top: -34px; right: 6%; font-size: 13px; background: rgba(249,115,22,.95); color: #111; font-weight: 700; padding: 3px 10px; border-radius: 6px; }
.sl-status { pointer-events: auto; font-size: 14px; background: rgba(0,0,0,.65); padding: 4px 12px; border-radius: 6px; color: #ddd; }

/* ---------- side panel ---------- */
.sl-panel { position: fixed; top: 0; right: 0; height: 100vh; width: 400px; background: #121214; border-left: 1px solid #2a2a2e; z-index: 2147483000; display: flex; flex-direction: column; font-size: 14px; color: #e7e7ea; box-shadow: -8px 0 30px rgba(0,0,0,.4); }
.sl-panel.sl-hidden { display: none; }
.sl-resize { position: absolute; left: -4px; top: 0; bottom: 0; width: 8px; cursor: ew-resize; }
.sl-ph { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #26262a; }
.sl-logo { font-weight: 800; color: #f97316; letter-spacing: .3px; font-size: 15px; }
.sl-ph .sl-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #a1a1aa; font-size: 12px; }
.sl-ibtn { background: transparent; border: 0; color: #bbb; border-radius: 6px; padding: 4px 7px; font-size: 15px; line-height: 1; }
.sl-ibtn:hover { background: #2a2a2e; color: #fff; }
.sl-ibtn.on { color: #f97316; }
.sl-tabs { display: flex; border-bottom: 1px solid #26262a; }
.sl-tab { flex: 1; background: none; border: 0; padding: 9px 4px; color: #a1a1aa; border-bottom: 2px solid transparent; font-size: 13px; }
.sl-tab.on { color: #fff; border-bottom-color: #f97316; }
.sl-bar { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px; border-bottom: 1px solid #26262a; align-items: center; }
.sl-panel .sl-bar { max-height: 260px; overflow: hidden; transition: max-height .25s ease, padding .25s ease, opacity .2s ease, border-color .25s; }
.sl-panel .sl-bar.sl-collapsed { max-height: 0; padding-top: 0; padding-bottom: 0; opacity: 0; border-bottom-color: transparent; pointer-events: none; }
.sl-barbtn { font-size: 13px; transition: transform .25s ease, color .15s; }
.sl-barbtn.closed { transform: rotate(180deg); color: #f97316; }
.sl-bar select, .sl-bar input[type=text], .sl-input { background: #1d1d21; color: #e7e7ea; border: 1px solid #333; border-radius: 6px; padding: 4px 6px; font-size: 12px; max-width: 100%; }
.sl-chip { background: #1d1d21; border: 1px solid #333; border-radius: 999px; padding: 3px 10px; font-size: 12px; color: #ccc; }
.sl-chip:hover { border-color: #f97316; }
.sl-chip.on { background: #f97316; border-color: #f97316; color: #111; font-weight: 600; }
.sl-body { flex: 1; overflow-y: auto; overscroll-behavior: contain; }
.sl-body::-webkit-scrollbar { width: 10px; } .sl-body::-webkit-scrollbar-thumb { background: #333; border-radius: 6px; }
.sl-row { display: flex; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #1d1d21; cursor: pointer; }
.sl-row:hover { background: #18181b; }
.sl-row.cur { background: #1f1a16; box-shadow: inset 3px 0 0 #f97316; }
.sl-rt { font-size: 11px; color: #71717a; width: 42px; flex: none; padding-top: 2px; font-variant-numeric: tabular-nums; }
.sl-rc { flex: 1; min-width: 0; }
.sl-ro { font-size: 15px; line-height: 1.4; color: #f4f4f5; }
.sl-rtr { font-size: 13px; line-height: 1.35; color: #a1a1aa; margin-top: 2px; }
.sl-ra { display: flex; flex-direction: column; gap: 2px; opacity: 0; }
.sl-row:hover .sl-ra, .sl-row .sl-ra .on { opacity: 1; }
.sl-row:hover .sl-ra { opacity: 1; }
.sl-star.on { color: #facc15; opacity: 1; }
.sl-foot { border-top: 1px solid #26262a; padding: 8px 12px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; font-size: 12px; color: #a1a1aa; }
.sl-wrow { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-bottom: 1px solid #1d1d21; }
.sl-wrow .sl-ww { flex: 1; font-size: 15px; }
.sl-wrow .sl-wc { color: #71717a; font-size: 12px; width: 34px; text-align: right; }
.sl-wrow .sl-wt { color: #a1a1aa; font-size: 12px; flex: 1.2; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sl-mini { font-size: 11px; padding: 2px 7px; border-radius: 5px; border: 1px solid #333; background: #1d1d21; color: #ccc; }
.sl-mini:hover { border-color: #f97316; color: #fff; }
.sl-mini.k { color: #4ade80; } .sl-mini.l { color: #fb923c; }
.sl-cov { padding: 10px 12px; border-bottom: 1px solid #26262a; font-size: 13px; color: #d4d4d8; }
.sl-covbar { height: 7px; border-radius: 4px; background: #27272a; overflow: hidden; margin-top: 6px; display: flex; }
.sl-covbar i { display: block; height: 100%; }
.sl-empty { padding: 30px 16px; text-align: center; color: #71717a; line-height: 1.6; }
.sl-kbd { display: inline-block; min-width: 18px; text-align: center; padding: 0 5px; border: 1px solid #3f3f46; border-bottom-width: 2px; border-radius: 4px; font-size: 11px; color: #d4d4d8; background: #18181b; margin-right: 2px; }
.sl-help { padding: 12px; font-size: 13px; line-height: 1.9; color: #c4c4c8; }

/* ---------- dictionary popup ---------- */
.sl-dict { position: fixed; z-index: 2147483600; width: 400px; max-width: calc(100vw - 16px); max-height: min(72vh, 640px); overflow: hidden; display: flex; flex-direction: column; background: #17171a; color: #ececef; border: 1px solid #2f2f35; border-radius: 12px; box-shadow: 0 18px 50px rgba(0,0,0,.55); font-size: 14px; line-height: 1.45; }
.sl-dh { padding: 12px 14px 8px; border-bottom: 1px solid #26262b; }
.sl-dw { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.sl-dword { font-size: 22px; font-weight: 700; color: #fff; }
.sl-dlemma { color: #a1a1aa; font-size: 13px; }
.sl-dphon { color: #a1a1aa; font-size: 13px; }
.sl-drank { margin-left: auto; font-size: 11px; color: #a1a1aa; background: #232327; border-radius: 6px; padding: 2px 7px; }
.sl-dict.sl-compact { width: 300px; }
.sl-dict.sl-compact .sl-dh { border-bottom: 0; padding-bottom: 10px; }
.sl-dict.sl-compact .sl-dword { font-size: 19px; }
.sl-alts { color: #a1a1aa; font-size: 13px; margin-top: 1px; }
.sl-dict.sl-compact .sl-stages { margin-top: 8px; }
.sl-dict.sl-compact .sl-stage { padding: 3px 9px; font-size: 12px; }
.sl-more { margin-left: auto; background: none; border: 0; color: #93c5fd; font-size: 12px; padding: 4px 2px; }
.sl-more:hover { color: #bfdbfe; text-decoration: underline; }
.sl-dmain { font-size: 17px; color: #fdba74; margin-top: 4px; font-weight: 600; }
.sl-dbody { overflow-y: auto; padding: 4px 14px 12px; }
.sl-dbody::-webkit-scrollbar { width: 8px; } .sl-dbody::-webkit-scrollbar-thumb { background: #333; border-radius: 6px; }
.sl-stages { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; align-items: center; }
.sl-stage { border: 1px solid #3a3a40; background: #1f1f23; border-radius: 8px; padding: 5px 10px; font-size: 13px; color: #ddd; }
.sl-stage:hover { border-color: #f97316; }
.sl-stage.on.known { background: #16a34a; border-color: #16a34a; color: #fff; }
.sl-stage.on.learning { background: #f97316; border-color: #f97316; color: #111; font-weight: 600; }
.sl-stage.on.ignored { background: #52525b; border-color: #52525b; color: #fff; }
.sl-tags { display: flex; gap: 5px; margin-left: auto; }
.sl-tagdot { width: 16px; height: 16px; border-radius: 50%; border: 2px solid transparent; opacity: .45; padding: 0; }
.sl-tagdot.on { opacity: 1; border-color: #fff; }
.sl-sec { margin-top: 12px; }
.sl-sech { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: #8b8b93; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
.sl-pos { color: #a78bfa; font-size: 12px; font-style: italic; margin-right: 4px; }
.sl-terms { color: #e4e4e7; }
.sl-term { display: inline; }
.sl-term + .sl-term:before { content: ", "; color: #71717a; }
.sl-term[title] { border-bottom: 1px dotted #555; cursor: help; }
.sl-def { margin: 3px 0 3px 0; color: #d4d4d8; }
.sl-ex { color: #a1a1aa; font-style: italic; margin: 1px 0 4px 10px; font-size: 13px; }
.sl-ctx { background: #1e1e22; border-radius: 8px; padding: 8px 10px; color: #e4e4e7; }
.sl-ctx b { color: #fdba74; }
.sl-ctxt { color: #a1a1aa; margin-top: 4px; font-size: 13px; }
.sl-links { display: flex; flex-wrap: wrap; gap: 5px; }
.sl-link { font-size: 12px; color: #93c5fd; text-decoration: none; background: #1e1e22; border-radius: 6px; padding: 2px 8px; }
.sl-link:hover { background: #26262b; color: #bfdbfe; }
.sl-note { width: 100%; background: #1e1e22; border: 1px solid #333; color: #eee; border-radius: 8px; padding: 6px 8px; font: inherit; font-size: 13px; resize: vertical; min-height: 34px; }
.sl-ai { white-space: pre-wrap; background: #1a1d24; border: 1px solid #2b3240; border-radius: 8px; padding: 8px 10px; font-size: 13px; color: #dbeafe; }
.sl-muted { color: #8b8b93; font-size: 12px; }
.sl-dclose { position: absolute; top: 6px; right: 6px; }
.sl-btn { background: #26262b; border: 1px solid #36363c; border-radius: 7px; padding: 4px 10px; font-size: 12px; color: #e4e4e7; }
.sl-btn:hover { border-color: #f97316; }
.sl-btn.primary { background: #f97316; border-color: #f97316; color: #111; font-weight: 600; }
.sl-spin { display: inline-block; width: 12px; height: 12px; border: 2px solid #555; border-top-color: #f97316; border-radius: 50%; animation: slspin .7s linear infinite; vertical-align: -2px; }
@keyframes slspin { to { transform: rotate(360deg); } }

/* ---------- hover translation ---------- */
.sl-tip { position: fixed; z-index: 2147483601; max-width: 320px; padding: 5px 10px; border-radius: 8px; background: rgba(20,20,23,.96); color: #fdba74; font-size: 14px; font-weight: 600; line-height: 1.3; border: 1px solid #36363c; box-shadow: 0 8px 24px rgba(0,0,0,.45); pointer-events: none; opacity: 0; transform: translateY(3px); transition: opacity .14s ease, transform .14s ease; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sl-tip.show { opacity: 1; transform: none; }
.sl-tip.x { white-space: normal; color: #e5e5e5; font-weight: 500; }
.sl-tip.x b { color: #5eead4; font-weight: 600; }

/* ---------- устойчивые выражения ---------- */
.sl-xp { text-decoration: underline dotted rgba(94,234,212,.85); text-decoration-thickness: 2px; text-underline-offset: 6px; text-decoration-skip-ink: none; }
.sl-xp.sl-xpsaved { text-decoration-style: solid; text-decoration-color: rgba(251,146,60,.9); }
.sl-xsurf { font-size: 12px; color: #a1a1aa; margin-top: 2px; }
.sl-xwords { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-top: 8px; font-size: 12px; color: #a1a1aa; }
.sl-xword { background: #232328; border: 1px solid #36363c; color: #e5e5e5; border-radius: 6px; padding: 1px 8px; font-size: 13px; cursor: pointer; }
.sl-xword:hover { border-color: #f97316; color: #fff; }

/* ---------- итог по видео ---------- */
.sl-sum { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(620px, 94%); max-height: 92%; overflow-y: auto; overscroll-behavior: contain; z-index: 2147483100; background: rgba(23,23,26,.97); color: #ececef; border: 1px solid #333; border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.6); padding: 16px 18px; font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; pointer-events: auto; animation: slSumIn .22s ease; }
@keyframes slSumIn { from { opacity: 0; transform: translate(-50%, -46%); } }
.sl-sum h3 { margin: 0 26px 2px 0; font-size: 17px; color: #fff; }
.sl-sum .sl-sumsub { color: #a1a1aa; font-size: 12px; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sl-sum h4 { margin: 12px 0 5px; font-size: 12px; font-weight: 600; color: #a1a1aa; text-transform: uppercase; letter-spacing: .05em; }
.sl-sum .sl-sumx { position: absolute; top: 10px; right: 10px; }
.sl-sumrow { display: flex; align-items: baseline; gap: 8px; padding: 3px 6px; border-radius: 7px; }
.sl-sumrow:hover { background: #222227; }
.sl-sumrow .w { font-weight: 600; cursor: pointer; color: #fb923c; }
.sl-sumrow .w.u { color: #93c5fd; }
.sl-sumrow .w.x { color: #5eead4; }
.sl-sumrow .t { color: #a1a1aa; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sl-sumrow .n { color: #71717a; font-size: 12px; }
.sl-sumrow .sl-mini { flex: none; }
.sl-sumempty { color: #71717a; font-size: 13px; padding: 2px 6px; }
.sl-sumfoot { margin-top: 12px; display: flex; gap: 8px; align-items: center; color: #71717a; font-size: 12px; }

/* ---------- меню: мостик между ⋯ и списком, автопауза, скрытый перевод в панели ---------- */
.sl-mfloat { position: absolute; z-index: 2147483200; pointer-events: auto; box-sizing: border-box; }
.sl-seg { display: flex; border: 1px solid #3f3f46; border-radius: 7px; overflow: hidden; flex: none; }
.sl-seg button { background: none; border: 0; color: #a1a1aa; font-size: 12px; padding: 3px 8px; cursor: pointer; }
.sl-seg button + button { border-left: 1px solid #3f3f46; }
.sl-seg button:hover { color: #fff; background: #2a2a2f; }
.sl-seg button.on { background: #f97316; color: #111; font-weight: 600; }
.sl-blurtr .sl-rtr { filter: blur(5px); opacity: .7; transition: filter .15s, opacity .15s; }
.sl-blurtr .sl-rtr:hover { filter: none; opacity: 1; }
.sl-row.sl-hard .sl-rt::after { content: ""; display: block; width: 6px; height: 6px; border-radius: 50%; background: #f97316; margin: 5px auto 0; }

/* ---------- selection bubble / toast ---------- */
.sl-bubble { position: fixed; z-index: 2147483500; background: #f97316; color: #111; border-radius: 8px; padding: 4px 9px; font-size: 13px; font-weight: 600; box-shadow: 0 6px 18px rgba(0,0,0,.35); border: 0; }
.sl-toast { position: fixed; z-index: 2147483647; left: 50%; bottom: 60px; transform: translateX(-50%); background: rgba(20,20,22,.95); color: #fff; padding: 9px 16px; border-radius: 9px; font-size: 14px; border: 1px solid #333; box-shadow: 0 10px 30px rgba(0,0,0,.4); pointer-events: none; }
`;
