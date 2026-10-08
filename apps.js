// iMessage apps that make adi "send" a card into the thread: Location, GitHub and Hackatime.
// Exposes window.ChatApps = [{ id, name, sub, icon, card() -> Promise<{ el, note }> }].
//   el:   the card element (an incoming bubble)
//   note: a short line added to the AI's context so adi knows what was sent
(function () {
  "use strict";

  var css = `
  .b.app-card{display:block;padding:0;overflow:hidden;border-radius:18px!important;text-decoration:none;color:var(--fg);background:var(--in);cursor:pointer;white-space:normal}
  .b.app-card:hover{filter:brightness(.97)}
  .app-cap{padding:8px 12px 10px;font-size:14px;line-height:1.3}
  .app-cap b{display:block;font-weight:600}
  .app-cap span{color:var(--muted);font-size:13px}

  /* Location */
  .loc{width:260px;max-width:100%}
  .loc-map{position:relative;height:170px;overflow:hidden;background:#e8e4dc}
  .loc-map img{display:block;width:100%;height:100%;object-fit:cover;user-select:none;-webkit-user-drag:none;filter:saturate(.7) brightness(1.04) contrast(.95)}
  /* Night map: invert the light tiles and turn the hue back so water and parks keep their colors */
  :root[data-theme=dark] .loc-map img{filter:invert(.9) hue-rotate(180deg) saturate(.55) brightness(.95)}
  @media (prefers-color-scheme:dark){:root:not([data-theme=light]) .loc-map img{filter:invert(.9) hue-rotate(180deg) saturate(.55) brightness(.95)}}
  .loc-pin{position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,.3))}
  .loc-pin span{width:44px;height:44px;border-radius:50%;border:3px solid #fff;display:grid;place-items:center;font-size:24px;
    background:linear-gradient(180deg,#b8e0ff,#6cb6f5)}
  .loc-pin i{width:0;height:0;border:7px solid transparent;border-top:9px solid #fff;margin-top:-2px}
  .loc-pulse{position:absolute;left:50%;top:50%;width:70px;height:70px;margin:-35px 0 0 -35px;border-radius:50%;background:rgba(10,132,255,.25);
    animation:locPulse 2.4s ease-out infinite}
  @keyframes locPulse{from{transform:scale(.3);opacity:1}to{transform:scale(1.6);opacity:0}}
  .loc-attr{position:absolute;right:6px;bottom:4px;font-size:9px;color:rgba(0,0,0,.55);background:rgba(255,255,255,.6);padding:0 4px;border-radius:4px}
  :root[data-theme=dark] .loc-attr{color:rgba(255,255,255,.6);background:rgba(0,0,0,.45)}
  @media (prefers-color-scheme:dark){:root:not([data-theme=light]) .loc-attr{color:rgba(255,255,255,.6);background:rgba(0,0,0,.45)}}

  /* GitHub */
  .gh{width:320px;max-width:100%}
  .gh-head{display:flex;align-items:center;gap:8px;padding:10px 12px 4px;font-size:14px}
  .gh-icon svg{display:block;width:26px;height:26px}
  .gh-head svg{width:18px;height:18px;flex:none}
  .gh-head b{font-weight:600}
  .gh-graph{padding:4px 10px 2px}
  .gh-graph svg{display:block;width:100%;height:auto}
  .gh-graph text{font:10px Figtree,system-ui,sans-serif;fill:var(--muted)}
  .gh .l0{fill:#ebedf0}.gh .l1{fill:#9be9a8}.gh .l2{fill:#40c463}.gh .l3{fill:#30a14e}.gh .l4{fill:#216e39}
  :root[data-theme=dark] .gh .l0{fill:#2d333b}:root[data-theme=dark] .gh .l1{fill:#0e4429}:root[data-theme=dark] .gh .l2{fill:#006d32}:root[data-theme=dark] .gh .l3{fill:#26a641}:root[data-theme=dark] .gh .l4{fill:#39d353}
  @media (prefers-color-scheme:dark){:root:not([data-theme=light]) .gh .l0{fill:#2d333b}:root:not([data-theme=light]) .gh .l1{fill:#0e4429}:root:not([data-theme=light]) .gh .l2{fill:#006d32}:root:not([data-theme=light]) .gh .l3{fill:#26a641}:root:not([data-theme=light]) .gh .l4{fill:#39d353}}
  .gh-legend{display:flex;align-items:center;justify-content:flex-end;gap:3px;font-size:11px;color:var(--muted);padding:0 12px}
  .gh-legend svg{width:9px;height:9px}

  /* Hackatime */
  .hk{width:340px;max-width:100%}
  .hk-head{display:flex;align-items:center;gap:8px;padding:10px 12px 8px;font-size:14px}
  .hk-head img{width:20px;height:20px;border-radius:5px;flex:none}
  .hk-head b{font-weight:600}
  .hk-badge{padding:0 10px}
  .hk-badge img{display:block;width:100%;height:auto;aspect-ratio:495/190;border-radius:8px;background:#151515}
  @media (prefers-reduced-motion:reduce){.loc-pulse{animation:none;opacity:.5}}
  `;
  var styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  var GH_MARK = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a12 12 0 00-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.3 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0012 .5z"/></svg>';

  /* ---------- Location: Phoenix on a map, opens Apple Maps ---------- */
  // phoenix-map.png is a one-time render of OpenStreetMap tiles (z11, 520x340, centered on
  // downtown Phoenix), so visitors never hit a tile server.
  var PLACE = { name: "Phoenix, AZ", lat: 33.4484, lon: -112.074 };
  function locationCard() {
    var a = document.createElement("a");
    a.className = "b in app-card loc";
    a.href = "https://maps.apple.com/?ll=" + PLACE.lat + "," + PLACE.lon + "&q=" + encodeURIComponent(PLACE.name) + "&z=11";
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("aria-label", "adi's location: " + PLACE.name + ". Opens Apple Maps");
    a.innerHTML =
      '<div class="loc-map"><img src="phoenix-map.png" alt="" width="260" height="170">' +
      '<div class="loc-pulse"></div><div class="loc-pin"><span>🐼</span><i></i></div>' +
      '<div class="loc-attr">© OpenStreetMap</div></div>' +
      '<div class="app-cap"><b>adi</b><span>' + PLACE.name + " · Open in Maps</span></div>";
    var img = a.querySelector("img");
    return new Promise(function (res) {
      // Wait for the map so the card doesn't pop in empty
      img.onload = img.onerror = function () {
        res({ el: a, note: "(sent my location: phoenix, arizona)" });
      };
    });
  }

  /* ---------- GitHub: contribution graph for the past year ---------- */
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function githubCard() {
    return fetch("/api/github")
      .then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok || !d.days) throw new Error(d.error || "HTTP " + r.status);
          return d;
        });
      })
      .then(function (d) {
        var CELL = 10, GAP = 2, STEP = CELL + GAP, TOPPAD = 14,
          first = new Date(d.days[0].date + "T00:00:00"),
          offset = first.getDay(),
          weeks = Math.ceil((d.days.length + offset) / 7),
          rects = "",
          labels = "",
          lastMonth = -1;
        d.days.forEach(function (day, i) {
          var k = i + offset, w = Math.floor(k / 7), dow = k % 7, dt = new Date(day.date + "T00:00:00");
          rects += '<rect class="l' + day.level + '" x="' + w * STEP + '" y="' + (TOPPAD + dow * STEP) + '" width="' + CELL + '" height="' + CELL + '" rx="2"><title>' +
            (day.count || "No") + " contribution" + (day.count === 1 ? "" : "s") + " on " + MONTHS[dt.getMonth()] + " " + dt.getDate() + "</title></rect>";
          // Month label above the first full week of each month
          if (dow === 0 && dt.getMonth() !== lastMonth && dt.getDate() <= 7) {
            lastMonth = dt.getMonth();
            if (w < weeks - 2) labels += '<text x="' + w * STEP + '" y="10">' + MONTHS[lastMonth] + "</text>";
          }
        });
        var legend = [0, 1, 2, 3, 4].map(function (l) {
          return '<svg viewBox="0 0 10 10"><rect class="l' + l + '" width="10" height="10" rx="2"/></svg>';
        }).join("");
        var a = document.createElement("a");
        a.className = "b in app-card gh";
        a.href = "https://github.com/" + d.user;
        a.target = "_blank";
        a.rel = "noopener";
        a.setAttribute("aria-label", d.total + " GitHub contributions in the last year. Opens GitHub");
        a.innerHTML =
          '<div class="gh-head">' + GH_MARK + "<b>" + d.user + "</b></div>" +
          '<div class="gh-graph"><svg viewBox="0 0 ' + (weeks * STEP - GAP) + " " + (TOPPAD + 7 * STEP - GAP) + '" role="img" aria-label="Contribution graph">' + labels + rects + "</svg></div>" +
          '<div class="gh-legend">Less ' + legend + " More</div>" +
          '<div class="app-cap"><b>' + d.total.toLocaleString() + " contributions in the last year</b><span>github.com/" + d.user + "</span></div>";
        return { el: a, note: "(sent my github contribution graph: " + d.total + " contributions in the last year)" };
      });
  }

  /* ---------- Hackatime: coding time by language, from the Hack Club stats badge ---------- */
  var HK_LOGO = "https://hackatime.hackclub.com/images/new-icon-rounded.png";
  var HK_BADGE = "https://github-readme-stats.hackclub.dev/api/wakatime?username=23&api_domain=hackatime.hackclub.com" +
    "&theme=dark&custom_title=Hackatime+Stats&layout=compact&cache_seconds=0&langs_count=8";
  function hackatimeCard() {
    var a = document.createElement("a");
    a.className = "b in app-card hk";
    a.href = "https://hackatime.hackclub.com/";
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("aria-label", "adi's Hackatime coding stats. Opens Hackatime");
    a.innerHTML =
      '<div class="hk-head"><img src="' + HK_LOGO + '" alt=""><b>Hackatime</b></div>' +
      '<div class="hk-badge"><img src="' + HK_BADGE + '" alt="Hackatime stats: adi\'s most used languages" width="495" height="190"></div>' +
      '<div class="app-cap"><b>adi\'s coding stats</b><span>languages by time spent, tracked with Hackatime</span></div>';
    var img = a.querySelector(".hk-badge img");
    return new Promise(function (res, rej) {
      // Wait for the badge so the card doesn't pop in empty
      img.onload = function () {
        res({ el: a, note: "(sent my hackatime stats card: languages i've coded in most, by time)" });
      };
      img.onerror = function () {
        rej(new Error("hackatime badge failed to load"));
      };
    });
  }

  window.ChatApps = [
    {
      id: "location",
      name: "Location",
      sub: "See where adi is",
      icon: '<span class="gp-appicon" style="background:linear-gradient(180deg,#8fd9a8,#34c759)"><svg viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M20.5 3.5L3 10.6l7.3 2.1 2.1 7.3z"/></svg></span>',
      card: locationCard,
    },
    {
      id: "github",
      name: "GitHub",
      sub: "adi's commits this year",
      icon: '<span class="gp-appicon gh-icon" style="background:#1f2328;color:#fff">' + GH_MARK + "</span>",
      card: githubCard,
    },
    {
      id: "hackatime",
      name: "Hackatime",
      sub: "What adi codes in",
      icon: '<img class="gp-appicon" style="background:none" src="' + HK_LOGO + '" alt="">',
      card: hackatimeCard,
    },
  ];
})();
