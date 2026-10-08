// GamePanda: an iMessage-style games app (think GamePigeon) for apanda.dev.
// Exposes window.GamePanda.init({ button, onSend, onResult }).
//   button:   the composer's + button; opens the app drawer
//   onSend:   (cardEl, session) => void   put the game card in the thread
//   onResult: (result) => void            { id, title, outcome: "win"|"lose"|"draw", summary }
//   apps:     [{ name, sub, icon, run }]  extra rows in the app drawer
(function () {
  "use strict";

  var still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- styles ---------- */
  var css = `
  .gp-backdrop{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.28);opacity:0;transition:opacity .3s}
  .gp-backdrop.on{opacity:1}
  .gp-sheet{position:fixed;left:50%;bottom:0;z-index:91;width:min(560px,100%);transform:translate(-50%,105%);
    background:color-mix(in srgb,var(--field) 92%,transparent);-webkit-backdrop-filter:blur(30px) saturate(1.8);backdrop-filter:blur(30px) saturate(1.8);
    border-radius:22px 22px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.18);padding:8px 16px calc(20px + env(safe-area-inset-bottom));
    transition:transform .42s cubic-bezier(.2,.9,.25,1);color:var(--fg)}
  .gp-sheet.on{transform:translate(-50%,0)}
  .gp-grab{width:36px;height:5px;border-radius:3px;background:color-mix(in srgb,var(--muted) 45%,transparent);margin:0 auto 12px}
  .gp-row{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:14px;width:100%;padding:8px 6px;border-radius:14px;cursor:pointer;font-size:17px}
  .gp-row:hover{background:color-mix(in srgb,var(--fg) 5%,transparent)}
  .gp-row:focus-visible,.gp-tile:focus-visible,.gp-btn:focus-visible{outline:2px solid var(--out);outline-offset:2px}
  .gp-row small{display:block;font-size:13px;color:var(--muted)}
  .gp-appicon{width:44px;height:44px;border-radius:11px;display:grid;place-items:center;font-size:28px;flex:none;
    background:linear-gradient(180deg,#b8e0ff,#6cb6f5);box-shadow:inset 0 0 0 .5px rgba(0,0,0,.08)}
  .gp-head{display:flex;align-items:center;gap:10px;margin:0 0 14px;font-weight:600;font-size:17px}
  .gp-head .gp-appicon{width:30px;height:30px;font-size:19px;border-radius:8px}
  .gp-back{all:unset;cursor:pointer;color:var(--out);font-size:17px;display:flex;align-items:center;gap:2px;padding:4px 6px 4px 0}
  .gp-back svg{width:13px;height:20px}
  .gp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .gp-tile{all:unset;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;font-size:13px;font-weight:500;text-align:center;
    transition:transform .15s}
  .gp-tile:active{transform:scale(.95)}
  .gp-tile .gp-art{width:100%;aspect-ratio:1;border-radius:22%;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.14),inset 0 0 0 .5px rgba(0,0,0,.1)}
  .gp-art svg{display:block;width:100%;height:100%}
  .gp-view{animation:gpIn .3s cubic-bezier(.2,.9,.3,1)}
  @keyframes gpIn{from{opacity:0;transform:translateX(14px)}}

  /* game card in the thread */
  .b.gp-card{padding:0;overflow:hidden;width:232px;max-width:75%;cursor:pointer;background:var(--in);color:var(--fg);border-radius:18px!important;white-space:normal}
  .gp-card .gp-art{aspect-ratio:16/10}
  .gp-cap{padding:8px 12px 10px;font-size:14px;line-height:1.3}
  .gp-cap b{display:block;font-weight:600}
  .gp-cap span{color:var(--muted);font-size:13px}
  .gp-card.done{cursor:default}
  .gp-card.won .gp-cap span{color:#34c759}
  .gp-card:not(.done):hover{filter:brightness(.97)}

  /* game window */
  .gp-ov{position:fixed;inset:0;z-index:100;display:grid;place-items:center;background:rgba(0,0,0,.45);
    -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);opacity:0;transition:opacity .3s}
  .gp-ov.on{opacity:1}
  .gp-win{position:relative;width:min(420px,100vw);height:min(800px,calc(100dvh - 40px));border-radius:34px;overflow:hidden;
    background:var(--bg);color:var(--fg);display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(0,0,0,.4);
    transform:translateY(24px) scale(.97);transition:transform .45s cubic-bezier(.2,.9,.25,1)}
  .gp-ov.on .gp-win{transform:none}
  @media (max-width:520px),(max-height:620px){.gp-win{width:100vw;height:100dvh;border-radius:0}}
  .gp-top{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:calc(10px + env(safe-area-inset-top)) 14px 8px;
    position:relative;z-index:2}
  .gp-done{all:unset;cursor:pointer;color:var(--out);font-size:17px;font-weight:500;padding:6px 4px;justify-self:start}
  .gp-title{text-align:center;font-weight:600;font-size:16px;line-height:1.2}
  .gp-title small{display:block;font-weight:400;font-size:12px;color:var(--muted)}
  .gp-score{justify-self:end;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--muted)}
  .gp-stage{flex:1;position:relative;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 16px}
  .gp-status{align-self:center;margin:6px auto calc(16px + env(safe-area-inset-bottom));padding:8px 16px;border-radius:999px;font-size:15px;font-weight:500;
    background:color-mix(in srgb,var(--fg) 7%,transparent);min-height:36px;display:flex;align-items:center;gap:8px;transition:background .3s,color .3s;position:relative;z-index:2}
  .gp-status.you{background:color-mix(in srgb,var(--out) 16%,transparent);color:var(--out)}
  .gp-status i{width:8px;height:8px;border-radius:50%;background:currentColor;animation:gpPulse 1s ease-in-out infinite}
  @keyframes gpPulse{50%{opacity:.25}}
  .gp-btn{all:unset;cursor:pointer;padding:12px 22px;border-radius:14px;font-size:16px;font-weight:600;text-align:center;
    background:var(--out);color:#fff;transition:transform .12s,filter .15s}
  .gp-btn:active{transform:scale(.96)}
  .gp-btn.alt{background:color-mix(in srgb,var(--fg) 8%,transparent);color:var(--fg)}
  .gp-btns{display:flex;gap:10px;justify-content:center;margin-top:16px}

  /* result card */
  .gp-result{position:absolute;inset:0;z-index:5;display:grid;place-items:center;background:color-mix(in srgb,var(--bg) 55%,transparent);
    -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);animation:gpFade .35s ease}
  @keyframes gpFade{from{opacity:0}}
  .gp-result>div{text-align:center;padding:28px 26px;border-radius:26px;background:var(--field);box-shadow:0 18px 50px rgba(0,0,0,.2);
    min-width:250px;animation:gpPop .5s cubic-bezier(.2,1.4,.4,1)}
  @keyframes gpPop{from{transform:scale(.8);opacity:0}}
  .gp-result .big{font-size:52px;line-height:1}
  .gp-result h3{font-size:24px;margin:10px 0 4px;font-weight:700}
  .gp-result p{color:var(--muted);font-size:15px;margin:0}
  .gp-confetti{position:absolute;inset:0;pointer-events:none;z-index:6}

  /* four in a row */
  .c4{width:min(100%,380px);touch-action:manipulation;user-select:none;-webkit-user-select:none}
  .c4 svg{display:block;width:100%;height:auto;overflow:visible;cursor:pointer}
  .c4 .disc{transition:transform .5s cubic-bezier(.33,0,.67,1)}
  .c4 .disc.land{animation:c4Bounce .28s ease-out}
  @keyframes c4Bounce{40%{transform:translateY(-14px)}}
  .c4 .ghost{transition:transform .12s,opacity .2s}
  .c4 .win{animation:c4Win .9s ease-in-out infinite}
  @keyframes c4Win{50%{opacity:.45}}

  /* basketball */
  .bb{position:absolute;inset:0;touch-action:none}
  .bb canvas{display:block;width:100%;height:100%}

  /* sea battle */
  .sb{width:min(100%,360px);display:flex;flex-direction:column;align-items:center;gap:10px}
  .sb-label{align-self:flex-start;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
  .sb-board{position:relative;width:100%;aspect-ratio:1;border-radius:16px;overflow:hidden;
    background:linear-gradient(160deg,#5ac8fa,#0a84ff 70%,#0060df);box-shadow:inset 0 0 0 .5px rgba(0,0,0,.15)}
  .sb-board.mini{width:46%;border-radius:10px}
  .sb-grid{position:absolute;inset:0;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr)}
  .sb-grid button{all:unset;position:relative;cursor:pointer;box-shadow:inset 0 0 0 .5px rgba(255,255,255,.18)}
  .sb-grid button:hover:not(:disabled){background:rgba(255,255,255,.14)}
  .sb-grid button:disabled{cursor:default}
  .sb-ship{position:absolute;border-radius:999px;background:linear-gradient(180deg,#f2f2f7,#aeaeb2);box-shadow:0 2px 6px rgba(0,0,0,.25),inset 0 0 0 .5px rgba(0,0,0,.2);
    transition:opacity .3s}
  .sb-board.setup .sb-ship{cursor:grab;touch-action:none;z-index:2;transition:left .15s,top .15s,width .2s,height .2s,transform .15s,box-shadow .15s}
  .sb-board.setup .sb-ship:focus-visible{outline:2px solid #fff;outline-offset:2px}
  .sb-board.setup .sb-ship.drag{cursor:grabbing;transform:scale(1.05);box-shadow:0 10px 24px rgba(0,0,0,.35);z-index:3}
  .sb-ship.bad{background:linear-gradient(180deg,#ff8a80,#ff3b30)}
  .sb-ship.shake{animation:sbShake .35s}
  @keyframes sbShake{20%,60%{translate:-5px 0}40%,80%{translate:5px 0}}
  .sb-ship.enemy{background:linear-gradient(180deg,#ff9f0a,#ff6b00);animation:gpPop .4s cubic-bezier(.2,1.4,.4,1)}
  .sb-mark{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;z-index:1}
  .sb-mark::after{content:"";width:30%;height:30%;border-radius:50%;background:#fff;opacity:.9;animation:sbDrop .35s cubic-bezier(.2,1.4,.4,1)}
  .sb-mark.hit::after{width:46%;height:46%;background:radial-gradient(circle,#fff 0 18%,#ff3b30 22%);box-shadow:0 0 0 3px rgba(255,59,48,.35);opacity:1}
  .sb-mark.ripple::before{content:"";position:absolute;inset:20%;border-radius:50%;border:2px solid #fff;animation:sbRipple .6s ease-out forwards}
  @keyframes sbDrop{from{transform:scale(0)}}
  @keyframes sbRipple{from{transform:scale(.3);opacity:.9}to{transform:scale(1.6);opacity:0}}
  .sb-fleet{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;font-size:12px;color:var(--muted)}
  .sb-fleet span{padding:3px 8px;border-radius:999px;background:color-mix(in srgb,var(--fg) 7%,transparent)}
  .sb-fleet span.sunk{text-decoration:line-through;opacity:.5}
  .sb-row{display:flex;gap:12px;align-items:flex-start;width:100%}
  .sb-row .sb-fleet{flex:1;justify-content:flex-start;align-content:flex-start}
  @media (prefers-reduced-motion:reduce){.gp-sheet,.gp-win,.c4 .disc{transition:none}.gp-view,.gp-result,.gp-result>div,.c4 .win,.gp-status i{animation:none}}
  `;
  var styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---------- helpers ---------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function haptic(ms) {
    if (navigator.vibrate) navigator.vibrate(ms || 8);
  }
  function rand(n) {
    return Math.floor(Math.random() * n);
  }
  var chevron = '<svg viewBox="0 0 13 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2L3 10l7 8"/></svg>';

  // Tiny synth for UI sounds; created on first use (always inside a tap).
  var actx;
  function sfx(kind) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var t = actx.currentTime,
        g = actx.createGain();
      g.connect(actx.destination);
      function tone(type, f0, f1, dur, vol) {
        var o = actx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        var gg = actx.createGain();
        gg.gain.setValueAtTime(vol, t);
        gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(gg).connect(g);
        o.start(t);
        o.stop(t + dur);
      }
      function noise(dur, vol, freq) {
        var buf = actx.createBuffer(1, actx.sampleRate * dur, actx.sampleRate),
          d = buf.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        var s = actx.createBufferSource(),
          f = actx.createBiquadFilter(),
          gg = actx.createGain();
        f.type = "bandpass";
        f.frequency.value = freq;
        gg.gain.value = vol;
        s.buffer = buf;
        s.connect(f).connect(gg).connect(g);
        s.start(t);
      }
      if (kind === "drop") tone("sine", 220, 90, 0.12, 0.25);
      else if (kind === "tap") tone("sine", 900, 600, 0.05, 0.08);
      else if (kind === "swish") noise(0.35, 0.5, 2400);
      else if (kind === "rim") tone("triangle", 520, 380, 0.15, 0.15);
      else if (kind === "splash") noise(0.3, 0.35, 900);
      else if (kind === "boom") (noise(0.5, 0.9, 160), tone("sine", 120, 40, 0.4, 0.35));
      else if (kind === "win") [523, 659, 784, 1047].forEach(function (f, i) {
        setTimeout(function () { sfx("note:" + f); }, i * 110);
      });
      else if (kind === "lose") [392, 330, 262].forEach(function (f, i) {
        setTimeout(function () { sfx("note:" + f); }, i * 140);
      });
      else if (kind.indexOf("note:") === 0) tone("sine", +kind.slice(5), +kind.slice(5), 0.22, 0.15);
    } catch (e) {}
  }

  function confetti(host) {
    if (still) return;
    var c = el("canvas", "gp-confetti"),
      ctx = c.getContext("2d"),
      dpr = devicePixelRatio || 1,
      W = host.clientWidth,
      H = host.clientHeight,
      colors = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#0a84ff", "#af52de"],
      ps = [];
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.scale(dpr, dpr);
    host.appendChild(c);
    for (var i = 0; i < 120; i++)
      ps.push({ x: W / 2, y: H * 0.45, vx: (Math.random() - 0.5) * 900, vy: -Math.random() * 900 - 200,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 12, w: 6 + Math.random() * 6, col: colors[i % 6] });
    var last = performance.now(),
      t0 = last;
    (function frame(now) {
      var dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, W, H);
      ps.forEach(function (p) {
        p.vy += 1500 * dt;
        p.vx *= 0.99;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r += p.vr * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.col;
        ctx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2);
        ctx.restore();
      });
      if (now - t0 < 2600) requestAnimationFrame(frame);
      else c.remove();
    })(last);
  }

  /* ---------- game art (icons + card images) ---------- */
  var ART = {
    c4:
      '<svg viewBox="0 0 120 120"><defs><linearGradient id="c4a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d9bff"/><stop offset="1" stop-color="#0060df"/></linearGradient></defs>' +
      '<rect width="120" height="120" fill="url(#c4a)"/>' +
      (function () {
        var s = "", cols = 4, rows = 4, filled = { "0,3": "#ffcc00", "1,3": "#ff3b30", "1,2": "#ff3b30", "2,3": "#ffcc00", "2,2": "#ffcc00", "2,1": "#ff3b30", "3,3": "#ff3b30", "3,2": "#ffcc00", "3,1": "#ff3b30", "3,0": "#ff3b30" };
        for (var c = 0; c < cols; c++)
          for (var r = 0; r < rows; r++)
            s += '<circle cx="' + (24 + c * 24) + '" cy="' + (24 + r * 24) + '" r="9" fill="' + (filled[c + "," + r] || "rgba(0,0,0,.28)") + '"/>';
        return s;
      })() +
      "</svg>",
    bb:
      '<svg viewBox="0 0 120 120"><defs><linearGradient id="bba" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb340"/><stop offset="1" stop-color="#ff6b00"/></linearGradient>' +
      '<radialGradient id="bbb" cx=".35" cy=".35"><stop offset="0" stop-color="#ffa64d"/><stop offset="1" stop-color="#d9530b"/></radialGradient></defs>' +
      '<rect width="120" height="120" fill="url(#bba)"/>' +
      '<rect x="30" y="14" width="60" height="40" rx="4" fill="#fff" opacity=".95"/><rect x="48" y="28" width="24" height="18" fill="none" stroke="#ff3b30" stroke-width="3"/>' +
      '<path d="M44 54h32l-5 22H49z" fill="none" stroke="#fff" stroke-width="2" opacity=".85"/><path d="M50 54l3 22M60 54v22M70 54l-3 22" stroke="#fff" stroke-width="1.4" opacity=".7"/>' +
      '<ellipse cx="60" cy="54" rx="17" ry="4" fill="none" stroke="#e8380d" stroke-width="3.5"/>' +
      '<circle cx="78" cy="88" r="17" fill="url(#bbb)"/><path d="M61 88h34M78 71v34M66 76c6 6 6 18 0 24M90 76c-6 6-6 18 0 24" stroke="#5a2408" stroke-width="1.6" fill="none"/></svg>',
    sb:
      '<svg viewBox="0 0 120 120"><defs><linearGradient id="sba" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ac8fa"/><stop offset="1" stop-color="#0050c8"/></linearGradient>' +
      '<linearGradient id="sbb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f2f7"/><stop offset="1" stop-color="#8e8e93"/></linearGradient></defs>' +
      '<rect width="120" height="120" fill="url(#sba)"/>' +
      '<g stroke="#fff" stroke-opacity=".22">' + [20, 40, 60, 80, 100].map(function (v) { return '<path d="M' + v + ' 0v120M0 ' + v + 'h120"/>'; }).join("") + "</g>" +
      '<rect x="22" y="44" width="76" height="16" rx="8" fill="url(#sbb)"/><rect x="50" y="36" width="20" height="10" rx="3" fill="#d1d1d6"/>' +
      '<circle cx="84" cy="90" r="9" fill="#ff3b30"/><circle cx="84" cy="90" r="3.5" fill="#fff"/><circle cx="32" cy="90" r="5" fill="#fff" opacity=".9"/><circle cx="58" cy="22" r="5" fill="#fff" opacity=".9"/></svg>',
  };

  var GAMES = [
    { id: "c4", title: "Four in a Row", blurb: "Line up four before adi does", make: fourInARow },
    { id: "bb", title: "Basketball", blurb: "Flick to shoot. 30 seconds", make: basketball },
    { id: "sb", title: "Sea Battle", blurb: "Sink adi's fleet first", make: seaBattle },
  ];

  /* ---------- app drawer ---------- */
  var drawer, backdrop, opts;
  function openDrawer() {
    if (drawer) return closeDrawer();
    backdrop = el("div", "gp-backdrop");
    drawer = el("div", "gp-sheet");
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-label", "iMessage apps");
    document.body.append(backdrop, drawer);
    showApps();
    opts.button.classList.add("open");
    opts.button.setAttribute("aria-expanded", "true");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        backdrop.classList.add("on");
        drawer.classList.add("on");
      });
    });
    backdrop.onclick = closeDrawer;
  }
  function closeDrawer() {
    if (!drawer) return;
    var d = drawer,
      b = backdrop;
    drawer = backdrop = null;
    d.classList.remove("on");
    b.classList.remove("on");
    opts.button.classList.remove("open");
    opts.button.setAttribute("aria-expanded", "false");
    setTimeout(function () {
      d.remove();
      b.remove();
    }, still ? 0 : 420);
  }
  function showApps() {
    drawer.innerHTML = '<div class="gp-grab"></div>';
    var v = el("div", "gp-view"),
      row = el("button", "gp-row", '<span class="gp-appicon">🐼</span><span>GamePanda<small>Play games with adi</small></span>');
    row.type = "button";
    row.onclick = function () {
      sfx("tap");
      showGames();
    };
    v.appendChild(row);
    // Other iMessage apps (Location, GitHub, ...) passed in via init({ apps })
    (opts.apps || []).forEach(function (app) {
      var r = el("button", "gp-row", app.icon + "<span>" + app.name + "<small>" + app.sub + "</small></span>");
      r.type = "button";
      r.onclick = function () {
        sfx("tap");
        closeDrawer();
        app.run();
      };
      v.appendChild(r);
    });
    drawer.appendChild(v);
    row.focus({ preventScroll: true });
  }
  function showGames() {
    drawer.innerHTML = '<div class="gp-grab"></div>';
    var v = el("div", "gp-view"),
      head = el("div", "gp-head"),
      back = el("button", "gp-back", chevron + "Apps");
    back.type = "button";
    back.onclick = showApps;
    head.append(back);
    head.insertAdjacentHTML("beforeend", '<span class="gp-appicon">🐼</span>GamePanda');
    var grid = el("div", "gp-grid");
    GAMES.forEach(function (g) {
      var t = el("button", "gp-tile", '<span class="gp-art">' + ART[g.id] + "</span>" + g.title);
      t.type = "button";
      t.onclick = function () {
        sfx("tap");
        closeDrawer();
        start(g);
      };
      grid.appendChild(t);
    });
    v.append(head, grid);
    drawer.appendChild(v);
    grid.firstChild.focus({ preventScroll: true });
  }

  /* ---------- sessions: card in the thread + game window ---------- */
  function start(g) {
    // Square art, cropped to fill the wide card image
    var cardArt = ART[g.id].replace("<svg ", '<svg preserveAspectRatio="xMidYMid slice" ');
    var card = el("div", "b out gp-card", '<div class="gp-art">' + cardArt + '</div><div class="gp-cap"><b>' + g.title + "</b><span>GamePanda · tap to play</span></div>");
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    var session = { game: g, card: card, state: null, done: false };
    card.onclick = function () {
      if (!session.done) openGame(session);
    };
    card.onkeydown = function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        card.onclick();
      }
    };
    opts.onSend(card, session);
    setTimeout(function () { openGame(session); }, still ? 0 : 450);
  }

  var current = null;
  function openGame(session) {
    if (current) return;
    var g = session.game,
      ov = el("div", "gp-ov"),
      win = el("div", "gp-win"),
      top = el("div", "gp-top"),
      done = el("button", "gp-done", "Done"),
      title = el("div", "gp-title", g.title + "<small>🐼 GamePanda</small>"),
      score = el("div", "gp-score"),
      stage = el("div", "gp-stage"),
      status = el("div", "gp-status");
    done.type = "button";
    top.append(done, title, score);
    win.append(top, stage, status);
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-label", g.title);
    ov.appendChild(win);
    document.body.appendChild(ov);
    var prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { ov.classList.add("on"); });
    });

    var api = {
      stage: stage,
      win: win,
      status: function (text, mine, thinking) {
        status.innerHTML = (thinking ? "<i></i>" : "") + text;
        status.classList.toggle("you", !!mine);
      },
      score: function (text) { score.textContent = text; },
      end: function (outcome, summary, big) {
        if (session.done) return;
        session.done = true;
        var words = { win: "You win!", lose: "adi wins", draw: "It's a draw" };
        sfx(outcome === "win" ? "win" : outcome === "lose" ? "lose" : "tap");
        haptic(outcome === "win" ? [10, 60, 10] : 20);
        var r = el("div", "gp-result", '<div><div class="big">' + (big || (outcome === "win" ? "🏆" : outcome === "lose" ? "🐼" : "🤝")) + "</div><h3>" + words[outcome] + "</h3><p>" + summary + '</p><div class="gp-btns"></div></div>');
        var again = el("button", "gp-btn alt", "Play Again"),
          ok = el("button", "gp-btn", "Done");
        again.type = ok.type = "button";
        again.onclick = function () {
          close();
          setTimeout(function () { start(g); }, still ? 0 : 350);
        };
        ok.onclick = close;
        r.querySelector(".gp-btns").append(again, ok);
        win.appendChild(r);
        if (outcome === "win") confetti(win);
        ok.focus({ preventScroll: true });
        // Update the card in the thread and let the chat react
        session.card.classList.add("done");
        if (outcome === "win") session.card.classList.add("won");
        session.card.querySelector(".gp-cap span").textContent = words[outcome] + " · " + summary;
        opts.onResult({ id: g.id, title: g.title, outcome: outcome, summary: summary });
      },
      sfx: sfx,
      haptic: haptic,
    };
    var game = g.make(api, session);
    current = { close: close };

    function onKey(e) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    done.onclick = close;
    function close() {
      if (!current) return;
      current = null;
      document.removeEventListener("keydown", onKey);
      if (game && game.pause) game.pause();
      ov.classList.remove("on");
      document.documentElement.style.overflow = prevOverflow;
      setTimeout(function () {
        if (game && game.destroy) game.destroy();
        ov.remove();
      }, still ? 0 : 320);
      if (!session.done) session.card.querySelector(".gp-cap span").textContent = "GamePanda · tap to keep playing";
      opts.button.focus({ preventScroll: true });
    }
  }

  /* ==========================================================
     Four in a Row: you (red) vs adi (yellow), alpha-beta AI
     ========================================================== */
  function fourInARow(api, session) {
    var R = 6, C = 7, S = 100, PAD = 14,
      st = session.state || (session.state = { b: Array.from({ length: R }, function () { return Array(C).fill(0); }), turn: 1, over: false, moves: 0 }),
      b = st.b,
      busy = false;
    var wrap = el("div", "c4");
    var W = C * S + PAD * 2, H = R * S + PAD * 2;
    var holes = "";
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) holes += '<circle cx="' + (PAD + c * S + S / 2) + '" cy="' + (PAD + r * S + S / 2) + '" r="' + S * 0.39 + '" fill="#000"/>';
    wrap.innerHTML =
      '<svg viewBox="0 -' + S + " " + W + " " + (H + S) + '" role="grid" aria-label="Four in a Row board">' +
      '<defs><mask id="c4m"><rect x="0" y="0" width="' + W + '" height="' + H + '" rx="34" fill="#fff"/>' + holes + "</mask>" +
      '<linearGradient id="c4p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d9bff"/><stop offset="1" stop-color="#0060df"/></linearGradient>' +
      '<radialGradient id="c4r" cx=".4" cy=".35"><stop offset="0" stop-color="#ff6b62"/><stop offset="1" stop-color="#d70015"/></radialGradient>' +
      '<radialGradient id="c4y" cx=".4" cy=".35"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#f5a800"/></radialGradient></defs>' +
      '<circle class="ghost" r="' + S * 0.39 + '" cy="' + -S / 2 + '" cx="' + (PAD + S / 2) + '" fill="url(#c4r)" opacity="0"/>' +
      '<g class="discs"></g>' +
      '<rect x="0" y="0" width="' + W + '" height="' + H + '" rx="34" fill="url(#c4p)" mask="url(#c4m)"/>' +
      '<rect x="1" y="1" width="' + (W - 2) + '" height="' + (H - 2) + '" rx="33" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="2" mask="url(#c4m)"/>' +
      '<g class="wins"></g></svg>';
    api.stage.appendChild(wrap);
    var svg = wrap.querySelector("svg"),
      discs = wrap.querySelector(".discs"),
      ghost = wrap.querySelector(".ghost"),
      winsG = wrap.querySelector(".wins");

    function cx(c) { return PAD + c * S + S / 2; }
    function cy(r) { return PAD + r * S + S / 2; }
    function drawDisc(r, c, who, animate) {
      var d = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      d.setAttribute("class", "disc");
      d.setAttribute("cx", cx(c));
      d.setAttribute("cy", cy(r));
      d.setAttribute("r", S * 0.39);
      d.setAttribute("fill", who === 1 ? "url(#c4r)" : "url(#c4y)");
      discs.appendChild(d);
      if (animate && !still) {
        var dist = cy(r) + S / 2;
        d.style.transition = "none";
        d.style.transform = "translateY(" + -dist + "px)";
        d.getBoundingClientRect();
        d.style.transition = "transform " + (0.22 + r * 0.055) + "s cubic-bezier(.45,0,1,1)";
        d.style.transform = "translateY(0)";
        setTimeout(function () {
          d.classList.add("land");
          sfx("drop");
          haptic(10);
        }, (0.22 + r * 0.055) * 1000);
      }
    }
    // Restore a resumed game
    for (var rr = 0; rr < R; rr++) for (var cc = 0; cc < C; cc++) if (b[rr][cc]) drawDisc(rr, cc, b[rr][cc], false);

    function openRow(board, c) {
      for (var r = R - 1; r >= 0; r--) if (!board[r][c]) return r;
      return -1;
    }
    function winner(board) {
      var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
      for (var r = 0; r < R; r++)
        for (var c = 0; c < C; c++) {
          var p = board[r][c];
          if (!p) continue;
          for (var k = 0; k < 4; k++) {
            var cells = [[r, c]];
            for (var i = 1; i < 4; i++) {
              var r2 = r + dirs[k][0] * i, c2 = c + dirs[k][1] * i;
              if (r2 < 0 || r2 >= R || c2 < 0 || c2 >= C || board[r2][c2] !== p) break;
              cells.push([r2, c2]);
            }
            if (cells.length === 4) return { p: p, cells: cells };
          }
        }
      return null;
    }
    function full(board) { return board[0].every(Boolean); }

    // Heuristic: score every window of four for the AI (2) vs you (1)
    function evaluate(board) {
      var score = 0;
      for (var r = 0; r < R; r++) if (board[r][3] === 2) score += 3; else if (board[r][3] === 1) score -= 3;
      function win4(a) {
        var ai = 0, me = 0, e = 0;
        a.forEach(function (v) { if (v === 2) ai++; else if (v === 1) me++; else e++; });
        if (ai === 4) return 1000;
        if (me === 4) return -1000;
        if (ai === 3 && e === 1) return 6;
        if (ai === 2 && e === 2) return 2;
        if (me === 3 && e === 1) return -8;
        if (me === 2 && e === 2) return -2;
        return 0;
      }
      for (r = 0; r < R; r++)
        for (var c = 0; c < C; c++) {
          if (c + 3 < C) score += win4([board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]]);
          if (r + 3 < R) score += win4([board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]]);
          if (r + 3 < R && c + 3 < C) score += win4([board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]]);
          if (r + 3 < R && c - 3 >= 0) score += win4([board[r][c], board[r + 1][c - 1], board[r + 2][c - 2], board[r + 3][c - 3]]);
        }
      return score;
    }
    var ORDER = [3, 2, 4, 1, 5, 0, 6];
    function minimax(board, depth, alpha, beta, maxing) {
      var w = winner(board);
      if (w) return w.p === 2 ? 100000 + depth : -100000 - depth;
      if (full(board)) return 0;
      if (depth === 0) return evaluate(board);
      var best = maxing ? -Infinity : Infinity;
      for (var i = 0; i < 7; i++) {
        var c = ORDER[i], r = openRow(board, c);
        if (r < 0) continue;
        board[r][c] = maxing ? 2 : 1;
        var v = minimax(board, depth - 1, alpha, beta, !maxing);
        board[r][c] = 0;
        if (maxing) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
        else { best = Math.min(best, v); beta = Math.min(beta, v); }
        if (alpha >= beta) break;
      }
      return best;
    }
    function aiMove() {
      // Mostly strong, occasionally shallow so it stays beatable
      var depth = Math.random() < 0.25 ? 2 : 5,
        best = -Infinity, choices = [];
      ORDER.forEach(function (c) {
        var r = openRow(b, c);
        if (r < 0) return;
        b[r][c] = 2;
        var v = minimax(b, depth - 1, -Infinity, Infinity, false);
        b[r][c] = 0;
        if (v > best) { best = v; choices = [c]; }
        else if (v === best) choices.push(c);
      });
      return choices[rand(choices.length)];
    }

    function play(c, who) {
      var r = openRow(b, c);
      if (r < 0) return false;
      b[r][c] = who;
      st.moves++;
      drawDisc(r, c, who, true);
      return true;
    }
    function after(cb) {
      setTimeout(cb, still ? 0 : 520);
    }
    function check() {
      var w = winner(b);
      if (w) {
        st.over = true;
        w.cells.forEach(function (p) {
          var ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          ring.setAttribute("class", "win");
          ring.setAttribute("cx", cx(p[1]));
          ring.setAttribute("cy", cy(p[0]));
          ring.setAttribute("r", S * 0.2);
          ring.setAttribute("fill", "#fff");
          winsG.appendChild(ring);
        });
        setTimeout(function () {
          api.end(w.p === 1 ? "win" : "lose", w.p === 1 ? "four in a row in " + Math.ceil(st.moves / 2) + " moves" : "adi connected four");
        }, still ? 0 : 900);
        api.status(w.p === 1 ? "Four in a row!" : "adi got four", w.p === 1);
        return true;
      }
      if (full(b)) {
        st.over = true;
        api.status("Board's full");
        setTimeout(function () { api.end("draw", "the board filled up"); }, 700);
        return true;
      }
      return false;
    }
    function yourTurn() {
      st.turn = 1;
      busy = false;
      api.status("Your turn · tap a column", true);
    }
    function adiTurn() {
      st.turn = 2;
      busy = true;
      api.status("adi is thinking", false, true);
      setTimeout(function () {
        play(aiMove(), 2);
        after(function () {
          if (!check()) yourTurn();
        });
      }, still ? 0 : 650 + rand(500));
    }

    function colAt(e) {
      var pt = svg.getBoundingClientRect(),
        x = ((e.clientX - pt.left) / pt.width) * W;
      return Math.max(0, Math.min(C - 1, Math.floor((x - PAD) / S)));
    }
    svg.addEventListener("pointermove", function (e) {
      if (busy || st.over || e.pointerType === "touch") return;
      var c = colAt(e);
      ghost.style.transform = "translateX(" + (c * S) + "px)";
      ghost.setAttribute("opacity", openRow(b, c) < 0 ? "0" : ".55");
    });
    svg.addEventListener("pointerleave", function () { ghost.setAttribute("opacity", "0"); });
    svg.addEventListener("click", function (e) {
      if (busy || st.over || st.turn !== 1) return;
      var c = colAt(e);
      if (openRow(b, c) < 0) return;
      busy = true;
      ghost.setAttribute("opacity", "0");
      play(c, 1);
      after(function () {
        if (!check()) adiTurn();
      });
    });
    api.score("you vs adi");
    if (st.over) api.status("Game over");
    else if (st.turn === 2) adiTurn();
    else yourTurn();
    return {};
  }

  /* ==========================================================
     Basketball: flick the ball up into the hoop, 30 seconds
     ========================================================== */
  function basketball(api, session) {
    var TIME = 30,
      st = session.state || (session.state = { score: 0, left: TIME, best: 0, started: false, adi: 9 + rand(9) }),
      wrap = el("div", "bb"),
      cv = el("canvas"),
      ctx = cv.getContext("2d");
    wrap.appendChild(cv);
    api.stage.style.padding = "0";
    api.stage.appendChild(wrap);
    var W, H, dpr, hoop, ball, pointer = null, raf, last, running = true, flash = null, netPull = 0, streak = 0;

    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = wrap.clientWidth;
      H = wrap.clientHeight;
      cv.width = W * dpr;
      cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Hoop position is stored as fractions of the court so it survives resizes and reopening
      hoop = st.hoop || (st.hoop = { fx: 0.5, fy: 0.3, from: [0.5, 0.3], to: [0.5, 0.3], move: 1, stay: 5 + Math.random() * 5 });
      hoop.rw = Math.min(W * 0.3, 112);
      placeHoop();
      if (!ball || ball.state === "ready") resetBall();
    }
    function placeHoop() {
      hoop.x = hoop.fx * W;
      hoop.y = hoop.fy * H;
    }
    // After 5-10s in one spot, glide to a random new spot. Only moves while the ball
    // is in your hand, so a shot is never ruined mid-flight.
    function moveHoop(dt) {
      if (hoop.move < 1) {
        hoop.move = Math.min(1, hoop.move + dt / 0.7);
        var e = 1 - Math.pow(1 - hoop.move, 3);
        hoop.fx = hoop.from[0] + (hoop.to[0] - hoop.from[0]) * e;
        hoop.fy = hoop.from[1] + (hoop.to[1] - hoop.from[1]) * e;
        if (hoop.move === 1) hoop.stay = 5 + Math.random() * 5;
      } else if (st.started && st.left > 0) {
        hoop.stay -= dt;
        if (hoop.stay <= 0 && ball.state === "ready") {
          var margin = (hoop.rw * 0.8 + 10) / W, fx, fy;
          do {
            fx = margin + Math.random() * (1 - margin * 2);
            fy = 0.22 + Math.random() * 0.14;
          } while (Math.abs(fx - hoop.fx) < 0.12);
          hoop.from = [hoop.fx, hoop.fy];
          hoop.to = [fx, fy];
          hoop.move = still ? 1 : 0;
          if (still) (hoop.fx = fx), (hoop.fy = fy), (hoop.stay = 5 + Math.random() * 5);
          sfx("tap");
        }
      }
      placeHoop();
    }
    function R0() { return hoop.rw * 0.5; }
    function R1() { return hoop.rw * 0.33; }
    function resetBall() {
      ball = { x: W / 2, y: H * 0.82, vx: 0, vy: 0, z: 0, state: "ready", r: R0(), rot: 0, touched: false, tpeak: 0, t: 0, scored: false, fade: still ? 1 : 0 };
    }
    var ro = new ResizeObserver(size);
    ro.observe(wrap);
    size();

    function onDown(e) {
      if (ball.state !== "ready" || st.left <= 0) return;
      var dx = e.clientX - wrap.getBoundingClientRect().left - ball.x,
        dy = e.clientY - wrap.getBoundingClientRect().top - ball.y;
      if (Math.hypot(dx, dy) > ball.r * 2.2 && e.clientY - wrap.getBoundingClientRect().top < H * 0.55) return;
      pointer = { id: e.pointerId, type: e.pointerType, pts: [{ x: e.clientX, y: e.clientY, t: performance.now() }] };
      wrap.setPointerCapture(e.pointerId);
    }
    function onMove(e) {
      if (!pointer || e.pointerId !== pointer.id) return;
      pointer.pts.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (pointer.pts.length > 12) pointer.pts.shift();
    }
    function onUp(e) {
      if (!pointer || e.pointerId !== pointer.id) return;
      var pts = pointer.pts, now = performance.now(), type = pointer.type;
      pointer = null;
      var first = pts[0];
      for (var i = pts.length - 1; i >= 0; i--) if (now - pts[i].t > 90) { first = pts[i]; break; }
      var lastP = pts[pts.length - 1], dt = Math.max(16, lastP.t - first.t) / 1000,
        vx = (lastP.x - first.x) / dt, vy = (lastP.y - first.y) / dt;
      if (vy > -250) return; // not a flick upward
      shoot(vx, vy, type);
    }
    wrap.addEventListener("pointerdown", onDown);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerup", onUp);
    wrap.addEventListener("pointercancel", function () { pointer = null; });

    var G;
    // A perfect flick is ~2.4 screen-heights per second on touch, ~1.3 with a mouse or
    // trackpad (drags are slower). Close shots get nudged toward the hoop, GamePigeon-style.
    function shoot(vx, vy, type) {
      if (!st.started) {
        st.started = true;
        api.status("Go!", true);
      }
      G = H * 2.4;
      var bh = hoop.rw * 1.0,
        apexIdeal = ball.y - hoop.y + R1() + bh * 0.22,
        launchIdeal = Math.sqrt(2 * G * apexIdeal),
        ratio = -vy / (H * (type === "touch" ? 2.4 : 1.3));
      if (Math.abs(ratio - 1) < 0.55) ratio = 1 + (ratio - 1) * 0.12;
      ratio = Math.max(0.55, Math.min(1.5, ratio));
      var launch = launchIdeal * ratio,
        tpeak = launch / G,
        tDepth = tpeak * 0.9,
        vxIdeal = (hoop.x - ball.x) / tDepth,
        vxShot = (vx / -vy) * launch * 0.55,
        tol = (hoop.rw * 2) / tDepth;
      if (Math.abs(vxShot - vxIdeal) < tol) vxShot = vxIdeal + (vxShot - vxIdeal) * 0.12;
      ball.vy = -launch;
      ball.vx = vxShot;
      ball.tpeak = tpeak;
      ball.t = 0;
      ball.state = "flying";
      ball.touched = false;
      sfx("tap");
      haptic(6);
    }

    function step(dt) {
      if (st.started && st.left > 0) {
        st.left = Math.max(0, st.left - dt);
        if (st.left === 0) finish();
      }
      moveHoop(dt);
      netPull = Math.max(0, netPull - dt * 3);
      if (ball.fade < 1) ball.fade = Math.min(1, ball.fade + dt * 4);
      if (ball.state === "ready") return;
      ball.t += dt;
      ball.vy += G * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.rot += ball.vx * dt * 0.02 + dt * 4;
      // Depth: the ball reaches the hoop's plane just before its peak
      var z = Math.min(1, ball.t / (ball.tpeak * 0.9)),
        bw = hoop.rw * 1.55, bh = hoop.rw * 1.0, bTop = hoop.y - bh + 6;
      // Reaching the hoop's plane above the backboard: the shot sails over and lands behind it
      if (z >= 1 && ball.z < 1 && ball.y < bTop - ball.r * 1.4) ball.beyond = true;
      ball.z = ball.beyond ? Math.min(1.6, ball.t / (ball.tpeak * 0.9)) : z;
      ball.r = R0() + (R1() - R0()) * ball.z;
      if (z < 1 || ball.beyond) {
        if (ball.beyond && ball.y > H + ball.r) ball.y = H + ball.r * 3; // done falling behind the board
        return endCheck();
      }
      var rimL = { x: hoop.x - hoop.rw / 2, y: hoop.y }, rimR = { x: hoop.x + hoop.rw / 2, y: hoop.y };
      // Backboard: rising ball inside the board bounces back down
      if (ball.vy < 0 && ball.y < hoop.y - ball.r * 0.4 && ball.y > bTop && Math.abs(ball.x - hoop.x) < bw / 2) {
        ball.vy = Math.abs(ball.vy) * 0.35;
        ball.vx *= 0.6;
        ball.touched = true;
        sfx("rim");
      }
      [rimL, rimR].forEach(function (p) {
        var dx = ball.x - p.x, dy = ball.y - p.y, d = Math.hypot(dx, dy), min = ball.r + 3;
        if (d < min && d > 0) {
          var nx = dx / d, ny = dy / d, dot = ball.vx * nx + ball.vy * ny;
          if (dot < 0) {
            ball.vx -= 1.6 * dot * nx;
            ball.vy -= 1.6 * dot * ny;
            ball.vx *= 0.8;
            ball.vy *= 0.8;
          }
          ball.x = p.x + nx * min;
          ball.y = p.y + ny * min;
          if (Math.abs(ball.x - hoop.x) < hoop.rw / 2) ball.vx += (hoop.x - ball.x) * 3;
          if (!ball.touched || Math.abs(dot) > 60) sfx("rim");
          ball.touched = true;
        }
      });
      // Through the rim, going down
      if (!ball.scored && ball.vy > 0 && ball.y - ball.vy * dt < hoop.y && ball.y >= hoop.y && ball.x > rimL.x + ball.r * 0.2 && ball.x < rimR.x - ball.r * 0.2) {
        ball.scored = true;
        st.score++;
        streak++;
        netPull = 1;
        ball.vx *= 0.3;
        sfx("swish");
        haptic([8, 30, 8]);
        flash = { text: !ball.touched ? (streak >= 3 ? "on fire" : "swish") : "+1", t: 0, x: hoop.x, y: hoop.y - hoop.rw * 0.9 };
        api.score(st.score + " pts");
      }
      endCheck();
    }
    function endCheck() {
      if (ball.y > H + ball.r * 2 || ball.x < -ball.r * 3 || ball.x > W + ball.r * 3 || (ball.scored && ball.y > hoop.y + hoop.rw * 1.6)) {
        if (!ball.scored) streak = 0;
        if (st.left > 0) resetBall();
        else ball.state = "ready";
      }
    }

    function drawBall() {
      if (ball.state === "ready" && st.left <= 0) return;
      var r = ball.r;
      ctx.save();
      ctx.globalAlpha = ball.fade;
      // floor shadow while in hand
      if (ball.z < 0.2) {
        ctx.fillStyle = "rgba(0,0,0,.18)";
        ctx.beginPath();
        ctx.ellipse(ball.x, H * 0.82 + R0() * 1.05, r * 0.9 * (1 - ball.z), r * 0.22 * (1 - ball.z), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.translate(ball.x, ball.y);
      ctx.rotate(ball.rot);
      var g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
      g.addColorStop(0, "#ffa64d");
      g.addColorStop(1, "#d4500a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(70,25,5,.75)";
      ctx.lineWidth = Math.max(1.2, r * 0.06);
      ctx.beginPath();
      ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
      ctx.moveTo(0, -r); ctx.lineTo(0, r);
      ctx.moveTo(-r * 0.62, -r * 0.78); ctx.quadraticCurveTo(-r * 0.15, 0, -r * 0.62, r * 0.78);
      ctx.moveTo(r * 0.62, -r * 0.78); ctx.quadraticCurveTo(r * 0.15, 0, r * 0.62, r * 0.78);
      ctx.stroke();
      ctx.restore();
    }
    function drawHoopBack() {
      var rw = hoop.rw, bw = rw * 1.55, bh = rw * 1.0, x = hoop.x, y = hoop.y;
      // pole + board
      ctx.fillStyle = "rgba(120,120,128,.35)";
      ctx.fillRect(x - 4, y - bh - 40, 8, 40);
      ctx.fillStyle = "rgba(255,255,255,.96)";
      ctx.shadowColor = "rgba(0,0,0,.15)";
      ctx.shadowBlur = 14;
      roundRect(x - bw / 2, y - bh + 6, bw, bh, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ff3b30";
      ctx.lineWidth = 3;
      ctx.strokeRect(x - rw * 0.32, y - rw * 0.55, rw * 0.64, rw * 0.46);
      // back half of the rim
      ctx.strokeStyle = "#c2410c";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(x, y, rw / 2, rw * 0.11, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    function drawHoopFront() {
      var rw = hoop.rw, x = hoop.x, y = hoop.y, nh = rw * 0.62 * (1 + netPull * 0.35), pinch = 0.32 - netPull * 0.08;
      ctx.strokeStyle = "rgba(255,255,255,.9)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (var i = 0; i <= 6; i++) {
        var u = i / 6, tx = x - rw / 2 + rw * u, bx = x - rw * pinch + rw * 2 * pinch * u;
        ctx.moveTo(tx, y);
        ctx.lineTo(bx, y + nh);
      }
      for (var j = 1; j <= 3; j++) {
        var v = j / 3, half = rw / 2 - (rw / 2 - rw * pinch) * v;
        ctx.moveTo(x - half, y + nh * v);
        ctx.lineTo(x + half, y + nh * v);
      }
      ctx.stroke();
      ctx.strokeStyle = "#ff6b00";
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.ellipse(x, y, rw / 2, rw * 0.11, 0, 0, Math.PI);
      ctx.stroke();
    }
    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    function draw() {
      var dark = matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light" || document.documentElement.dataset.theme === "dark";
      var sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, dark ? "#1c1c1e" : "#eaf4ff");
      sky.addColorStop(0.62, dark ? "#2c2c2e" : "#d7e9fb");
      sky.addColorStop(0.62, dark ? "#3a2a1e" : "#f3c58b");
      sky.addColorStop(1, dark ? "#2a1d14" : "#e2a564");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      // court lines
      ctx.strokeStyle = dark ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(W / 2, H * 0.62, W * 0.42, H * 0.06, 0, 0, Math.PI);
      ctx.stroke();
      // big faded score
      ctx.fillStyle = dark ? "rgba(255,255,255,.07)" : "rgba(10,132,255,.09)";
      ctx.font = "700 " + Math.round(H * 0.16) + "px Figtree, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(st.score, W / 2, H * 0.5);
      // timer ring
      var tx = W - 34, ty = 30, frac = st.left / TIME;
      ctx.lineWidth = 4;
      ctx.strokeStyle = dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.08)";
      ctx.beginPath(); ctx.arc(tx, ty, 18, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = st.left < 6 ? "#ff3b30" : "#0a84ff";
      ctx.beginPath(); ctx.arc(tx, ty, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke();
      ctx.fillStyle = dark ? "#f5f5f4" : "#0a0a0a";
      ctx.font = "600 13px Figtree, system-ui, sans-serif";
      ctx.fillText(Math.ceil(st.left), tx, ty + 1);

      if (ball.beyond) drawBall();
      drawHoopBack();
      if (ball.beyond) drawHoopFront();
      else if (ball.z >= 1) {
        drawBall();
        drawHoopFront();
      } else {
        drawHoopFront();
        drawBall();
      }
      if (flash) {
        flash.t += 1 / 60;
        ctx.globalAlpha = Math.max(0, 1 - flash.t * 1.4);
        ctx.fillStyle = "#ff9500";
        ctx.font = "800 " + Math.round(hoop.rw * 0.32) + "px Figtree, system-ui, sans-serif";
        ctx.fillText(flash.text, flash.x, flash.y - flash.t * 40);
        ctx.globalAlpha = 1;
        if (flash.t > 0.8) flash = null;
      }
      if (!st.started) {
        ctx.fillStyle = dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.45)";
        ctx.font = "500 15px Figtree, system-ui, sans-serif";
        ctx.fillText("swipe up on the ball", W / 2, H * 0.94);
      }
    }
    function frame(now) {
      if (!running) return;
      var dt = Math.min(0.033, (now - (last || now)) / 1000);
      last = now;
      step(dt);
      draw();
      raf = requestAnimationFrame(frame);
    }
    function finish() {
      api.status("Time!");
      var you = st.score, adi = st.adi;
      setTimeout(function () {
        api.end(you > adi ? "win" : you < adi ? "lose" : "draw", "you scored " + you + ", adi scored " + adi, "🏀");
      }, 700);
    }
    api.score(st.score + " pts");
    api.status(st.started ? "Keep shooting" : "adi scored " + st.adi + " · beat it in 30s", true);
    raf = requestAnimationFrame(frame);
    return {
      pause: function () { running = false; cancelAnimationFrame(raf); },
      destroy: function () { running = false; cancelAnimationFrame(raf); ro.disconnect(); },
    };
  }

  /* ==========================================================
     Sea Battle: 8x8, fleet of 4/3/3/2, hit = shoot again
     ========================================================== */
  function seaBattle(api, session) {
    var N = 8, FLEET = [["battleship", 4], ["cruiser", 3], ["submarine", 3], ["destroyer", 2]];
    function place() {
      var grid = Array.from({ length: N }, function () { return Array(N).fill(-1); }), ships = [];
      FLEET.forEach(function (f, idx) {
        for (;;) {
          var horiz = Math.random() < 0.5, len = f[1],
            r = rand(horiz ? N : N - len + 1), c = rand(horiz ? N - len + 1 : N), ok = true, cells = [];
          for (var i = 0; i < len; i++) {
            var rr = r + (horiz ? 0 : i), cc = c + (horiz ? i : 0);
            // keep a one-cell gap around ships
            for (var a = -1; a <= 1; a++) for (var b2 = -1; b2 <= 1; b2++) {
              var r2 = rr + a, c2 = cc + b2;
              if (r2 >= 0 && r2 < N && c2 >= 0 && c2 < N && grid[r2][c2] !== -1) ok = false;
            }
            cells.push([rr, cc]);
          }
          if (!ok) continue;
          cells.forEach(function (p) { grid[p[0]][p[1]] = idx; });
          ships.push({ name: f[0], len: len, cells: cells, horiz: horiz, hits: 0 });
          break;
        }
      });
      return { grid: grid, ships: ships, shots: Array.from({ length: N }, function () { return Array(N).fill(0); }) };
    }
    var st = session.state || (session.state = { phase: "setup", me: place(), adi: place(), turn: 1, ai: { targets: [] } });
    var root = el("div", "sb");
    api.stage.appendChild(root);

    function shipEl(s, cls) {
      var e = el("div", "sb-ship" + (cls ? " " + cls : ""));
      posShip(e, s);
      return e;
    }
    // Inset each ship ~1% of the board so it sits inside its cells
    function posShip(e, s) {
      var cell = 100 / N, w = (s.horiz ? s.len : 1) * cell, h = (s.horiz ? 1 : s.len) * cell;
      e.style.left = s.cells[0][1] * cell + 1.1 + "%";
      e.style.top = s.cells[0][0] * cell + 1.1 + "%";
      e.style.width = w - 2.2 + "%";
      e.style.height = h - 2.2 + "%";
    }
    function board(side, interactive, mini) {
      var data = st[side], wrap = el("div", "sb-board" + (mini ? " mini" : "")), grid = el("div", "sb-grid");
      if (side === "me" || st.phase === "over") data.ships.forEach(function (s) { wrap.appendChild(shipEl(s, side === "adi" ? "enemy" : "")); });
      else data.ships.forEach(function (s) { if (s.hits === s.len) wrap.appendChild(shipEl(s, "enemy")); });
      for (var r = 0; r < N; r++)
        for (var c = 0; c < N; c++) {
          var btn = el("button");
          btn.type = "button";
          btn.dataset.r = r;
          btn.dataset.c = c;
          btn.setAttribute("aria-label", String.fromCharCode(65 + r) + (c + 1));
          var shot = data.shots[r][c];
          if (shot) btn.appendChild(el("span", "sb-mark" + (shot === 2 ? " hit" : "")));
          btn.disabled = !interactive || !!shot;
          grid.appendChild(btn);
        }
      wrap.appendChild(grid);
      return wrap;
    }
    function fleetList(side) {
      var f = el("div", "sb-fleet");
      st[side].ships.forEach(function (s) {
        f.appendChild(el("span", s.hits === s.len ? "sunk" : "", s.name + " · " + s.len));
      });
      return f;
    }

    function render() {
      root.innerHTML = "";
      if (st.phase === "setup") {
        api.score("");
        root.appendChild(el("div", "sb-label", "Your fleet"));
        var mine = board("me", false);
        mine.classList.add("setup");
        root.appendChild(mine);
        arrange(mine);
        var btns = el("div", "gp-btns"),
          shuffle = el("button", "gp-btn alt", "Shuffle"),
          go = el("button", "gp-btn", "Start");
        shuffle.type = go.type = "button";
        shuffle.onclick = function () {
          st.me = place();
          sfx("tap");
          render();
        };
        go.onclick = function () {
          st.phase = "play";
          sfx("tap");
          render();
          api.status("Your shot · tap adi's waters", true);
        };
        btns.append(shuffle, go);
        root.appendChild(btns);
        api.status("Drag ships to move · tap to rotate", true);
        return;
      }
      var left = st.adi.ships.filter(function (s) { return s.hits < s.len; }).length;
      api.score(left + " ship" + (left === 1 ? "" : "s") + " left");
      root.appendChild(el("div", "sb-label", "adi's waters"));
      var enemy = board("adi", st.phase === "play" && st.turn === 1);
      enemy.querySelector(".sb-grid").addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn || btn.disabled) return;
        fire(+btn.dataset.r, +btn.dataset.c);
      });
      root.appendChild(enemy);
      var row = el("div", "sb-row");
      var mine = el("div");
      mine.style.cssText = "width:46%;display:flex;flex-direction:column;gap:6px";
      mine.appendChild(el("div", "sb-label", "Your fleet"));
      var mb = board("me", false, true);
      mb.style.width = "100%";
      mine.appendChild(mb);
      var info = el("div");
      info.style.cssText = "flex:1;display:flex;flex-direction:column;gap:6px";
      info.appendChild(el("div", "sb-label", "adi's fleet"));
      info.appendChild(fleetList("adi"));
      row.append(mine, info);
      root.appendChild(row);
    }

    // Ship placement: ships may touch but not overlap, and must stay on the board
    function cellsFor(len, r0, c0, horiz) {
      var out = [];
      for (var i = 0; i < len; i++) out.push([r0 + (horiz ? 0 : i), c0 + (horiz ? i : 0)]);
      return out;
    }
    function fits(skip, cells) {
      return cells.every(function (p) {
        if (p[0] < 0 || p[0] >= N || p[1] < 0 || p[1] >= N) return false;
        return st.me.ships.every(function (o, j) {
          return j === skip || !o.cells.some(function (q) { return q[0] === p[0] && q[1] === p[1]; });
        });
      });
    }
    function commitShips() {
      var g = st.me.grid;
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) g[r][c] = -1;
      st.me.ships.forEach(function (s, i) {
        s.cells.forEach(function (p) { g[p[0]][p[1]] = i; });
      });
    }
    function arrange(wrap) {
      var els = wrap.querySelectorAll(".sb-ship");
      st.me.ships.forEach(function (s, i) {
        var e = els[i];
        e.tabIndex = 0;
        e.setAttribute("role", "button");
        e.setAttribute("aria-label", s.name + ", " + s.len + " long. Drag to move, Enter to rotate");
        e.addEventListener("pointerdown", function (ev) {
          ev.preventDefault();
          var rect = wrap.getBoundingClientRect(), size = rect.width / N,
            at = function (x, y) { return [Math.floor((y - rect.top) / size), Math.floor((x - rect.left) / size)]; },
            p0 = at(ev.clientX, ev.clientY),
            off = s.horiz ? p0[1] - s.cells[0][1] : p0[0] - s.cells[0][0],
            sx = ev.clientX, sy = ev.clientY, moved = false, cand = null;
          e.setPointerCapture(ev.pointerId);
          e.classList.add("drag");
          function move(m) {
            if (!moved && Math.hypot(m.clientX - sx, m.clientY - sy) < 6) return;
            moved = true;
            var p = at(m.clientX, m.clientY),
              r0 = s.horiz ? p[0] : p[0] - off,
              c0 = s.horiz ? p[1] - off : p[1];
            // Clamp to the board so the ship never leaves the grid while dragging
            r0 = Math.max(0, Math.min(N - (s.horiz ? 1 : s.len), r0));
            c0 = Math.max(0, Math.min(N - (s.horiz ? s.len : 1), c0));
            var cells = cellsFor(s.len, r0, c0, s.horiz),
              ok = fits(i, cells);
            if (!cand || cand.r0 !== r0 || cand.c0 !== c0) haptic(4);
            cand = { r0: r0, c0: c0, cells: cells, ok: ok };
            posShip(e, { cells: cells, horiz: s.horiz, len: s.len });
            e.classList.toggle("bad", !ok);
          }
          function up() {
            e.removeEventListener("pointermove", move);
            e.removeEventListener("pointerup", up);
            e.removeEventListener("pointercancel", up);
            e.classList.remove("drag", "bad");
            if (!moved) return rotate(i, e);
            if (cand && cand.ok) {
              s.cells = cand.cells;
              commitShips();
              sfx("drop");
            } else sfx("tap");
            posShip(e, s);
          }
          e.addEventListener("pointermove", move);
          e.addEventListener("pointerup", up);
          e.addEventListener("pointercancel", up);
        });
        e.addEventListener("keydown", function (ev) {
          var d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[ev.key];
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            rotate(i, e);
          } else if (d) {
            ev.preventDefault();
            var cells = s.cells.map(function (p) { return [p[0] + d[0], p[1] + d[1]]; });
            if (fits(i, cells)) {
              s.cells = cells;
              commitShips();
              posShip(e, s);
            }
          }
        });
      });
    }
    // Rotate around the first cell; slide back onto the board if it would hang off
    function rotate(i, e) {
      var s = st.me.ships[i], horiz = !s.horiz,
        r0 = Math.min(s.cells[0][0], N - (horiz ? 1 : s.len)),
        c0 = Math.min(s.cells[0][1], N - (horiz ? s.len : 1)),
        cells = cellsFor(s.len, r0, c0, horiz);
      if (!fits(i, cells)) {
        e.classList.remove("shake");
        e.offsetWidth;
        e.classList.add("shake");
        haptic(20);
        return;
      }
      s.horiz = horiz;
      s.cells = cells;
      commitShips();
      posShip(e, s);
      sfx("tap");
      haptic(6);
    }

    function shoot(side, r, c) {
      var data = st[side];
      var idx = data.grid[r][c];
      if (idx === -1) {
        data.shots[r][c] = 1;
        return { hit: false };
      }
      data.shots[r][c] = 2;
      var s = data.ships[idx];
      s.hits++;
      return { hit: true, sunk: s.hits === s.len ? s : null };
    }
    function allSunk(side) {
      return st[side].ships.every(function (s) { return s.hits === s.len; });
    }
    function markRipple(side, r, c) {
      var boards = root.querySelectorAll(".sb-board"),
        b = side === "adi" ? boards[0] : boards[1],
        btn = b && b.querySelector('button[data-r="' + r + '"][data-c="' + c + '"]');
      var m = btn && btn.querySelector(".sb-mark");
      if (m) m.classList.add("ripple");
    }

    function fire(r, c) {
      var res = shoot("adi", r, c);
      if (res.hit) {
        sfx("boom");
        haptic([10, 40, 20]);
      } else {
        sfx("splash");
        haptic(6);
      }
      if (allSunk("adi")) {
        st.phase = "over";
        render();
        api.status("Fleet destroyed!", true);
        var shots = st.adi.shots.flat().filter(Boolean).length;
        setTimeout(function () { api.end("win", "sank adi's fleet in " + shots + " shots", "⚓️"); }, still ? 0 : 800);
        return;
      }
      st.turn = res.hit ? 1 : 2;
      render();
      markRipple("adi", r, c);
      if (res.sunk) api.status("You sank adi's " + res.sunk.name + "! Go again", true);
      else if (res.hit) api.status("Hit! Go again", true);
      else {
        api.status("Miss. adi is aiming", false, true);
        setTimeout(adiTurn, still ? 0 : 900);
      }
    }

    // Hunt with a checkerboard pattern; after a hit, work outward along the line
    function aiPick() {
      var shots = st.me.shots, ai = st.ai;
      while (ai.targets.length) {
        var t = ai.targets.shift();
        if (t[0] >= 0 && t[0] < N && t[1] >= 0 && t[1] < N && !shots[t[0]][t[1]]) return t;
      }
      var opts2 = [];
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (!shots[r][c] && (r + c) % 2 === 0) opts2.push([r, c]);
      if (!opts2.length) for (r = 0; r < N; r++) for (c = 0; c < N; c++) if (!shots[r][c]) opts2.push([r, c]);
      return opts2[rand(opts2.length)];
    }
    function adiTurn() {
      if (st.phase !== "play") return;
      var p = aiPick(), res = shoot("me", p[0], p[1]);
      if (res.hit) {
        sfx("boom");
        haptic(20);
        var hits = st.ai.hits || (st.ai.hits = []);
        hits.push(p);
        if (res.sunk) {
          st.ai.targets = [];
          st.ai.hits = [];
        } else if (hits.length >= 2) {
          // Line found: only extend along it
          var horiz = hits[0][0] === hits[1][0], line = hits.slice().sort(function (a, b) { return horiz ? a[1] - b[1] : a[0] - b[0]; }),
            a = line[0], z = line[line.length - 1];
          st.ai.targets = horiz ? [[a[0], a[1] - 1], [z[0], z[1] + 1]] : [[a[0] - 1, a[1]], [z[0] + 1, z[1]]];
        } else st.ai.targets = [[p[0] - 1, p[1]], [p[0] + 1, p[1]], [p[0], p[1] - 1], [p[0], p[1] + 1]].sort(function () { return Math.random() - 0.5; });
      } else sfx("splash");
      if (allSunk("me")) {
        st.phase = "over";
        render();
        api.status("adi sank your fleet");
        setTimeout(function () { api.end("lose", "adi found all your ships", "🌊"); }, still ? 0 : 800);
        return;
      }
      render();
      markRipple("me", p[0], p[1]);
      if (res.hit) {
        api.status(res.sunk ? "adi sank your " + res.sunk.name : "adi hit you", false, true);
        setTimeout(adiTurn, still ? 0 : 850);
      } else {
        st.turn = 1;
        render();
        api.status("adi missed · your shot", true);
      }
    }

    render();
    if (st.phase === "play") {
      if (st.turn === 2) {
        api.status("adi is aiming", false, true);
        setTimeout(adiTurn, 600);
      } else api.status("Your shot · tap adi's waters", true);
    }
    return {};
  }

  window.GamePanda = {
    init: function (o) {
      opts = o;
      o.button.setAttribute("aria-haspopup", "dialog");
      o.button.setAttribute("aria-expanded", "false");
      o.button.addEventListener("click", openDrawer);
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && drawer) closeDrawer();
      });
    },
  };
})();
