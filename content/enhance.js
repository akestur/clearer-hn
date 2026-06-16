/* ============================================================
   Clearer HN — enhance.js  (content script, runs at document_start)
   Philosophy: restyle in place. We never tear out HN's markup,
   so voting / replying / login keep working with their auth tokens.
   Every module is wrapped in try/catch so a DOM change on HN's side
   can never break the underlying site.
   ============================================================ */
(function () {
  "use strict";
  if (window.__phnInit) return;
  window.__phnInit = true;

  var DEFAULTS = {
    enabled: true,
    theme: "auto", // auto | light | dark
    style: "clearer", // the single shipped style
    comments: true,
    inbox: true,
    submit: true,
    readState: true, // dim visited stories + show "+N new comments"
    paging: true // show 20 list items per page instead of HN's 30
  };
  var settings = Object.assign({}, DEFAULTS);
  var root = document.documentElement;

  /* ---------- tiny helpers ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function safe(fn) { try { fn(); } catch (e) { /* never break HN */ } }
  function prefersDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function resolvedTheme() {
    return settings.theme === "auto" ? (prefersDark() ? "dark" : "light") : settings.theme;
  }

  /* ---------- theme (applied as early as possible) ---------- */
  function applyTheme() {
    if (!settings.enabled) { root.removeAttribute("data-phn"); return; }
    root.setAttribute("data-phn", "on");
    root.setAttribute("data-phn-theme", resolvedTheme());
    root.setAttribute("data-phn-style", "clearer"); // single shipped style
  }

  // Provisional theme before storage resolves, to avoid a flash.
  safe(function () {
    root.setAttribute("data-phn", "on");
    root.setAttribute("data-phn-theme", prefersDark() ? "dark" : "light");
    root.setAttribute("data-phn-style", "clearer");
  });

  function loadSettings(cb) {
    try {
      chrome.storage.local.get("phnSettings", function (res) {
        if (res && res.phnSettings) settings = Object.assign({}, DEFAULTS, res.phnSettings);
        cb();
      });
    } catch (e) { cb(); }
  }
  function saveSettings() {
    try { chrome.storage.local.set({ phnSettings: settings }); } catch (e) {}
  }

  // React to OS theme changes when in auto mode.
  safe(function () {
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
        if (settings.theme === "auto") applyTheme();
      });
    }
  });

  // React to changes from the popup live.
  safe(function () {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "local" || !changes.phnSettings) return;
      settings = Object.assign({}, DEFAULTS, changes.phnSettings.newValue || {});
      applyTheme();
    });
  });

  /* ---------- page type ---------- */
  function pageType() {
    var p = location.pathname.replace(/\/+$/, "") || "/";
    if (p === "/item") return "item";
    if (p === "/threads") return "threads";
    if (p === "/submit") return "submit";
    var lists = ["/", "/news", "/newest", "/front", "/ask", "/show", "/shownew",
      "/active", "/best", "/noobstories", "/jobs", "/pool", "/invited",
      "/submitted", "/favorites", "/upvoted", "/newpoll"];
    if (lists.indexOf(p) !== -1) return "list";
    return "other";
  }

  /* ---------- theme toggle button in the top bar ---------- */
  function injectThemeToggle() {
    // prefer the rebuilt header (the original pagetop is hidden)
    var top = $(".phn-ahead-user") || $(".pagetop");
    if (!top || $(".phn-toggle", top)) return;
    var icons = { auto: "◐", light: "☀", dark: "☾" };
    var btn = el("span", "phn-toggle");
    function render() {
      btn.textContent = icons[settings.theme] + " " +
        settings.theme.charAt(0).toUpperCase() + settings.theme.slice(1);
    }
    render();
    btn.title = "Clearer HN theme (click to cycle: auto / light / dark)";
    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      var order = ["auto", "light", "dark"];
      settings.theme = order[(order.indexOf(settings.theme) + 1) % order.length];
      render();
      applyTheme();
      saveSettings();
    });
    top.appendChild(btn);
  }

  /* ---------- comment tree helpers ---------- */
  function commentRows() {
    var rows = $$("tr.comtr");
    if (!rows.length) rows = $$("tr.athing.comtr");
    return rows;
  }
  function levelOf(row) {
    var img = row.querySelector("td.ind img");
    if (!img) return 0;
    var w = parseInt(img.getAttribute("width") || img.width || "0", 10);
    return Math.round((isNaN(w) ? 0 : w) / 40);
  }
  function toggOf(row) { return row.querySelector("a.togg"); }
  // HN shows "[–]" when expanded and "[+]" or "[N more]" when collapsed.
  // So treat "a dash inside brackets" as the only expanded state.
  function isCollapsed(togg) {
    return !togg || !/\[\s*[–\-]\s*\]/.test(togg.textContent);
  }

  /* ---------- comments page enhancements ---------- */
  function enhanceComments() {
    if (!settings.comments) return;
    var rows = commentRows();
    if (!rows.length) return;
    safe(tidySublines); // tidy the story subtext + per-comment nav pipes

    // Who is the original poster?
    var opUser = "";
    var opEl = $("table.fatitem .hnuser") || $(".fatitem .hnuser") || $(".subtext .hnuser");
    if (opEl) opUser = opEl.textContent.trim();

    // last-visit time for "new" markers
    var itemId = (new URLSearchParams(location.search)).get("id") || "x";
    var visits = {};
    try {
      chrome.storage.local.get("phnVisits", function (res) {
        visits = (res && res.phnVisits) || {};
        var rec = visits[itemId];
        // records are {t: lastVisitMs, c: commentCountSeen}; tolerate old number form
        var lastT = (rec && typeof rec === "object") ? rec.t : (typeof rec === "number" ? rec : 0);
        markComments(rows, opUser, lastT);
        // record this visit + how many comments we saw (powers "+N new" on the feed)
        visits[itemId] = { t: Date.now(), c: commentRows().length };
        var keys = Object.keys(visits);
        if (keys.length > 500) keys.slice(0, keys.length - 500).forEach(function (k) { delete visits[k]; });
        try { chrome.storage.local.set({ phnVisits: visits }); } catch (e) {}
      });
    } catch (e) {
      markComments(rows, opUser, 0);
    }

    buildCommentBar();
    enableKeyboardNav(rows);
  }

  function markComments(rows, opUser, lastVisit) {
    rows.forEach(function (row) {
      safe(function () {
        var userEl = row.querySelector(".hnuser");
        var head = row.querySelector(".comhead");
        // depth class (computed from original indent, before any rescaling)
        var lvl = Math.min(levelOf(row), 6);
        if (lvl >= 1) row.classList.add("phn-d" + lvl);
        // OP tag
        if (opUser && userEl && userEl.textContent.trim() === opUser && head) {
          row.classList.add("phn-op");
          if (!head.querySelector(".phn-op-tag")) {
            var tag = el("span", "phn-op-tag", "OP");
            tag.title = "Original poster";
            userEl.insertAdjacentElement("afterend", tag);
          }
        }
        // new-since-last-visit
        if (lastVisit) {
          var age = row.querySelector(".age");
          var t = age && (age.getAttribute("title") || "");
          var ts = t ? Date.parse(t.split(" ")[0]) : NaN;
          if (!isNaN(ts) && ts > lastVisit && head && !head.querySelector(".phn-new-dot")) {
            row.classList.add("phn-fresh");
            var nd = el("span", "phn-new-dot");
            nd.title = "New since your last visit";
            head.insertBefore(nd, head.firstChild);
          }
        }
      });
    });
  }

  function buildCommentBar() {
    var rows = commentRows();
    if (!rows.length) return;
    var anchorTable = rows[0].closest("table");
    if (!anchorTable || $(".phn-bar")) return;

    var bar = el("div", "phn-bar");
    var collapse = el("button", null, "Collapse all");
    var expand = el("button", null, "Expand all");
    var freshCount = $$(".phn-fresh").length;
    var nextNew = el("button", null, freshCount ? ("Next new (" + freshCount + ")") : "Next new");

    collapse.addEventListener("click", function () { toggleTopLevel(true); });
    expand.addEventListener("click", function () { toggleTopLevel(false); });

    var freshIdx = -1;
    nextNew.addEventListener("click", function () {
      var fresh = $$(".phn-fresh");
      if (!fresh.length) return;
      freshIdx = (freshIdx + 1) % fresh.length;
      fresh[freshIdx].scrollIntoView({ behavior: "smooth", block: "center" });
      flash(fresh[freshIdx]);
    });

    bar.appendChild(collapse);
    bar.appendChild(expand);
    bar.appendChild(nextNew);
    var sep = el("span", "phn-bar-sep"); bar.appendChild(sep);
    var hint = el("span");
    hint.innerHTML = "Keys: <kbd>j</kbd>/<kbd>k</kbd> move · <kbd>z</kbd> collapse";
    bar.appendChild(hint);

    anchorTable.parentNode.insertBefore(bar, anchorTable);
    makeStickyBar(bar);
  }

  /* Keep the comment toolbar visible while scrolling.
     HN's nested <table> layout breaks CSS position:sticky (the toolbar
     sits in a table-cell containing block), so we pin it with a small
     scroll handler using position:fixed relative to the viewport.
     It floats as a pill GAP px from the top once scrolled past. */
  var PHN_BAR_GAP = 8;
  function makeStickyBar(bar) {
    if (!bar || bar.__phnSticky) return;
    bar.__phnSticky = true;
    var holder = el("div", "phn-bar-holder");
    holder.style.height = "0px";
    bar.parentNode.insertBefore(holder, bar);
    var stuck = false, originTop = 0;
    function recalc() { if (!stuck) originTop = holder.getBoundingClientRect().top + window.scrollY; }
    function onScroll() {
      var threshold = originTop - PHN_BAR_GAP;
      if (!stuck && window.scrollY > threshold) {
        holder.style.height = bar.offsetHeight + "px";
        var hr = holder.getBoundingClientRect();
        bar.style.position = "fixed";
        bar.style.top = PHN_BAR_GAP + "px";
        bar.style.left = hr.left + "px";
        bar.style.width = hr.width + "px";
        bar.style.zIndex = "40";
        bar.style.margin = "0";
        bar.classList.add("phn-bar-stuck");
        stuck = true;
      } else if (stuck && window.scrollY <= threshold) {
        bar.style.position = ""; bar.style.top = ""; bar.style.left = "";
        bar.style.width = ""; bar.style.zIndex = ""; bar.style.margin = "";
        bar.classList.remove("phn-bar-stuck");
        holder.style.height = "0px";
        stuck = false; recalc();
      }
    }
    window.addEventListener("scroll", function () { requestAnimationFrame(onScroll); }, { passive: true });
    window.addEventListener("resize", function () {
      if (stuck) {
        var hr = holder.getBoundingClientRect();
        bar.style.left = hr.left + "px"; bar.style.width = hr.width + "px";
      } else { recalc(); }
    });
    recalc(); onScroll();
  }

  function toggleTopLevel(collapse) {
    commentRows().forEach(function (row) {
      if (levelOf(row) !== 0) return;
      var togg = toggOf(row);
      if (!togg) return;
      var collapsed = isCollapsed(togg);
      if (collapse && !collapsed) togg.click();
      if (!collapse && collapsed) togg.click();
    });
  }

  function flash(row) {
    row.classList.add("phn-kbd-focus");
    setTimeout(function () { row.classList.remove("phn-kbd-focus"); }, 900);
  }

  function enableKeyboardNav(rows) {
    var idx = -1;
    document.addEventListener("keydown", function (e) {
      var tag = (e.target && e.target.tagName) || "";
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
      var visible = commentRows().filter(function (r) { return r.offsetParent !== null; });
      if (!visible.length) return;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        if (idx >= 0 && rows[idx]) rows[idx].classList.remove("phn-kbd-focus");
        var cur = visible[Math.max(0, visible.indexOf(rows[idx]))];
        var vi = visible.indexOf(rows[idx]);
        vi = e.key === "j" ? Math.min(visible.length - 1, vi + 1) : Math.max(0, vi - 1);
        if (vi < 0) vi = 0;
        var target = visible[vi];
        idx = rows.indexOf(target);
        target.classList.add("phn-kbd-focus");
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (e.key === "z") {
        if (idx >= 0 && rows[idx]) {
          var togg = toggOf(rows[idx]);
          if (togg) togg.click();
        }
      }
    });
  }

  /* ---------- threads page → activity inbox ---------- */
  function enhanceInbox() {
    if (!settings.inbox) return;
    var rows = commentRows();
    if (!rows.length) return;

    // Whose threads page is this?
    var owner = (new URLSearchParams(location.search)).get("id");
    if (!owner) {
      var me = $("#me") || $('.pagetop a[href^="user?id="]');
      if (me) owner = (me.textContent || "").trim();
    }
    if (!owner) return;

    var replyCount = 0;
    rows.forEach(function (row) {
      safe(function () {
        var userEl = row.querySelector(".hnuser");
        var head = row.querySelector(".comhead");
        if (!userEl) return;
        var author = userEl.textContent.trim();
        if (author === owner) {
          row.classList.add("phn-mine");
        } else {
          row.classList.add("phn-reply");
          replyCount++;
          if (head && !head.querySelector(".phn-reply-tag")) {
            userEl.insertAdjacentElement("afterend", el("span", "phn-reply-tag", "reply"));
          }
        }
      });
    });

    // filter bar
    var anchorTable = rows[0].closest("table");
    if (!anchorTable || $(".phn-inbox-bar")) return;
    var bar = el("div", "phn-inbox-bar");
    var all = el("span", "phn-pill phn-on", "All");
    var onlyReplies = el("span", "phn-pill", "Replies to me" + (replyCount ? " (" + replyCount + ")" : ""));
    bar.appendChild(all);
    bar.appendChild(onlyReplies);

    function setMode(repliesOnly) {
      all.classList.toggle("phn-on", !repliesOnly);
      onlyReplies.classList.toggle("phn-on", repliesOnly);
      commentRows().forEach(function (row) {
        if (repliesOnly && row.classList.contains("phn-mine")) row.classList.add("phn-reply-hidden");
        else row.classList.remove("phn-reply-hidden");
      });
    }
    all.addEventListener("click", function () { setMode(false); });
    onlyReplies.addEventListener("click", function () { setMode(true); });

    anchorTable.parentNode.insertBefore(bar, anchorTable);
  }

  /* ---------- submit page hints ---------- */
  function enhanceSubmit() {
    if (!settings.submit) return;
    var title = $('input[name="title"]');
    var url = $('input[name="url"]');
    if (title) attachTitleHint(title);
    if (url) attachUrlHint(url);
  }

  function attachTitleHint(input) {
    var hint = el("div", "phn-hint");
    input.parentNode.appendChild(hint);
    function update() {
      var v = input.value || "";
      var len = v.length;
      var prefix = /^(show|ask|tell|launch)\s+hn:/i.test(v.trim());
      hint.className = "phn-hint" + (len > 80 ? " phn-warn" : prefix ? " phn-ok" : "");
      var msg = len + " / 80 characters";
      if (len > 80) msg += " — HN trims past 80";
      else if (prefix) msg = "“" + v.trim().split(":")[0] + ":” prefix detected — " + msg;
      hint.textContent = msg;
    }
    input.addEventListener("input", update);
    update();
  }

  function attachUrlHint(input) {
    var hint = el("div", "phn-hint");
    input.parentNode.appendChild(hint);
    var timer = null;
    function check() {
      var v = (input.value || "").trim();
      if (!/^https?:\/\/.+\..+/.test(v)) { hint.className = "phn-hint"; hint.textContent = ""; return; }
      hint.className = "phn-hint"; hint.textContent = "Checking if already submitted…";
      var api = "https://hn.algolia.com/api/v1/search?restrictSearchableAttributes=url&query=" +
        encodeURIComponent(v.replace(/\/$/, ""));
      fetch(api).then(function (r) { return r.json(); }).then(function (d) {
        var hits = (d && d.hits) || [];
        var match = hits.filter(function (h) {
          return h.url && h.url.replace(/\/$/, "") === v.replace(/\/$/, "");
        });
        if (match.length) {
          var top = match.sort(function (a, b) { return (b.points || 0) - (a.points || 0); })[0];
          hint.className = "phn-hint phn-warn";
          hint.textContent = "Already submitted " + match.length + "× (top: " +
            (top.points || 0) + " points). Reposting is allowed if it didn't get traction.";
        } else {
          hint.className = "phn-hint phn-ok";
          hint.textContent = "Not previously submitted — you're clear.";
        }
      }).catch(function () { hint.className = "phn-hint"; hint.textContent = ""; });
    }
    input.addEventListener("input", function () {
      clearTimeout(timer); timer = setTimeout(check, 600);
    });
    input.addEventListener("blur", check);
  }

  /* ---------- Compact feed: tidy separators + read/new tracking ---------- */
  function tidySublines() {
    // swap HN's pipe separators for quiet middots (cosmetic, safe)
    $$(".subline, .subtext, .navs").forEach(function (sl) {
      Array.prototype.forEach.call(sl.childNodes, function (n) {
        if (n.nodeType === 3 && n.nodeValue.indexOf("|") !== -1) {
          n.nodeValue = n.nodeValue.replace(/\|/g, "·");
        }
      });
    });
  }

  function enhanceFeed() {
    safe(tidySublines);
    if (!settings.readState) return;
    var rows = $$("tr.athing").filter(function (r) { return r.id && r.querySelector(".titleline"); });
    if (!rows.length) return;
    try {
      chrome.storage.local.get("phnVisits", function (res) {
        var visits = (res && res.phnVisits) || {};
        rows.forEach(function (row) {
          safe(function () {
            var rec = visits[row.id];
            if (!rec) return;                 // never opened -> leave as unread
            row.classList.add("phn-read");    // dim visited stories
            var storedC = (typeof rec === "object") ? (rec.c || 0) : 0;
            if (storedC <= 0) return;         // no baseline count to compare against
            // find the "N comments" link in this story's subtext row
            var sub = row.nextElementSibling;
            if (!sub) return;
            var clink = null;
            $$('a[href^="item?id="]', sub).forEach(function (a) {
              if (/comment/.test(a.textContent)) clink = a;
            });
            if (!clink) return;
            var m = clink.textContent.match(/(\d+)/);
            var cur = m ? parseInt(m[1], 10) : 0;
            if (cur > storedC && !clink.parentNode.querySelector(".phn-newcount")) {
              var n = cur - storedC;
              var badge = el("span", "phn-newcount", "+" + n);
              badge.title = n + " new comment" + (n === 1 ? "" : "s") + " since your last visit";
              clink.insertAdjacentElement("afterend", badge);
            }
          });
        });
      });
    } catch (e) {}
  }

  /* ---------- 20 items per page, real pagination ----------
     HN serves 30/page; we show a 20-item window and drive Prev/Next
     ourselves, updating the URL (?cp=N) via history so Back/Forward and
     bookmarks behave like normal pages. HN's own pages are fetched
     (same-origin, so the user's session + vote tokens come along) as a
     buffer and kept in the DOM; only the current window is shown.
     Falls back gracefully if a fetch fails. */
  var PHN_PAGE = 20;
  function paginate20() {
    if (!settings.paging) return;
    // HN's stories table has no stable class/id, so find it via the rows.
    var firstAthing = $("tr.athing");
    if (!firstAthing) return;
    var table = firstAthing.closest("table");
    if (!table) return;
    var tbody = table.tBodies[0] || table;
    table.style.width = "100%"; // HN's stories table is shrink-to-fit; pin it
                                // full-width so the centered pager never drifts

    function abs(h, base) { try { return new URL(h, base || location.href).href; } catch (e) { return null; } }
    function collect(tb) {
      var units = [], cur = null;
      Array.prototype.forEach.call(tb.children, function (r) {
        if (r.querySelector && r.querySelector("a.morelink")) return; // skip "More" rows
        if (r.matches && r.matches("tr.athing") && r.querySelector(".titleline")) {
          cur = { rows: [r] }; units.push(cur);
        } else if (cur && !(r.matches && r.matches("tr.athing"))) {
          cur.rows.push(r);
        }
      });
      return units;
    }

    var allUnits = collect(tbody);
    var nativeMoreA = $("a.morelink");
    if (allUnits.length <= PHN_PAGE && !nativeMoreA) return; // a single short page; nothing to do
    var nextServerUrl = nativeMoreA ? abs(nativeMoreA.getAttribute("href")) : null;
    if (nativeMoreA) { var nmr = nativeMoreA.closest("tr"); if (nmr) nmr.style.display = "none"; }

    // our pager (kept last in the table). A single full-width cell
    // (colspan spans every column) so the pager centers across the whole
    // row, not the variable-width title cell.
    var pagerRow = document.createElement("tr"); pagerRow.className = "phn-pager-row";
    var pcell = document.createElement("td"); pcell.colSpan = 9;
    var pager = el("div", "phn-pager");
    var prevA = el("a", "phn-pagebtn phn-prev", "‹ Prev"); prevA.href = "#";
    var pnum = el("span", "phn-pagenum");
    var nextA = el("a", "morelink phn-next", "More ›"); nextA.href = "#";
    pager.appendChild(prevA); pager.appendChild(pnum); pager.appendChild(nextA);
    pcell.appendChild(pager); pagerRow.appendChild(pcell);
    tbody.appendChild(pagerRow);

    var fetching = false;
    function setHidden(u, h) { u.rows.forEach(function (tr) { tr.style.display = h ? "none" : ""; }); }
    function curPage() { var p = parseInt((new URLSearchParams(location.search)).get("cp") || "1", 10); return p > 0 ? p : 1; }
    function maxPage() { return Math.max(1, Math.ceil(allUnits.length / PHN_PAGE)); }
    function hasNext(p) { return allUnits.length > p * PHN_PAGE || !!nextServerUrl; }

    // fetch HN pages until we have at least `target` items buffered
    function ensureLoaded(target, cb) {
      if (allUnits.length >= target || !nextServerUrl || fetching) { cb(); return; }
      fetching = true;
      var from = nextServerUrl;
      fetch(from, { credentials: "same-origin" })
        .then(function (r) { return r.text(); })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, "text/html");
          var na = doc.querySelector("tr.athing");
          var nt = na ? na.closest("table") : null;
          var ntb = nt ? (nt.tBodies[0] || nt) : null;
          var nMore = doc.querySelector("a.morelink");
          nextServerUrl = nMore ? abs(nMore.getAttribute("href"), from) : null;
          if (ntb) {
            collect(ntb).forEach(function (u) {
              var imp = { rows: [] };
              u.rows.forEach(function (tr) { var n = document.importNode(tr, true); n.style.display = "none"; tbody.insertBefore(n, pagerRow); imp.rows.push(n); });
              allUnits.push(imp);
            });
            safe(tidySublines); safe(enhanceFeed); // dim/tidy the new rows too
          }
          fetching = false;
          if (allUnits.length < target && nextServerUrl) ensureLoaded(target, cb);
          else cb();
        })
        .catch(function () { fetching = false; cb(); });
    }

    function renderPager(p) {
      // visibility (not display) so the cluster keeps a constant width
      // and "More" never shifts sideways when Prev/Next appear or hide
      prevA.style.visibility = p > 1 ? "visible" : "hidden";
      nextA.style.visibility = hasNext(p) ? "visible" : "hidden";
      pnum.textContent = "page " + p;
    }
    // Keep the pager at a constant vertical spot: pin it to the tallest
    // page seen so far (pages vary in height as titles wrap), so it stops
    // bouncing up/down between pages.
    var maxBodyH = 0;
    function stabilizePager() {
      pager.style.marginTop = "0px";
      var h = pagerRow.getBoundingClientRect().top - table.getBoundingClientRect().top;
      if (h > maxBodyH) maxBodyH = h;
      pager.style.marginTop = Math.max(0, maxBodyH - h) + "px";
    }
    function showWindow(p) {
      var start = (p - 1) * PHN_PAGE;
      allUnits.forEach(function (u, i) { setHidden(u, !(i >= start && i < start + PHN_PAGE)); });
      renderPager(p);
      stabilizePager();
    }
    function goTo(p, push) {
      if (p < 1) p = 1;
      nextA.textContent = "Loading…";
      ensureLoaded(p * PHN_PAGE, function () {
        nextA.textContent = "More ›";
        if (p > maxPage()) p = maxPage();
        var u = new URL(location.href);
        if (p <= 1) u.searchParams.delete("cp"); else u.searchParams.set("cp", String(p));
        var rel = u.pathname + (u.search || "");
        if (push) { try { history.pushState({ cp: p }, "", rel); } catch (e) {} }
        showWindow(p);
        try { window.scrollTo(0, 0); } catch (e) {}
      });
    }

    prevA.addEventListener("click", function (e) { e.preventDefault(); goTo(curPage() - 1, true); });
    nextA.addEventListener("click", function (e) { e.preventDefault(); goTo(curPage() + 1, true); });
    window.addEventListener("popstate", function () { goTo(curPage(), false); });

    try { history.replaceState({ cp: curPage() }, "", location.pathname + location.search); } catch (e) {}
    allUnits.forEach(function (u) { setHidden(u, true); }); // hide all, then render the window
    goTo(curPage(), false);
  }

  /* ---------- Rebuilt header (compact single-row nav) ---------- */
  function buildHeader() {
    var pts = $$(".pagetop");
    if (!pts.length) return;
    var pt0 = pts[0];
    if (!pt0 || $(".phn-ahead")) return;

    // One compact row: wordmark · quiet nav · user (keeps it dense)
    var ahead = el("div", "phn-ahead");

    // wordmark (clones HN's own "Hacker News" link so it still navigates)
    var wm = el("span", "phn-wordmark");
    var hn = pt0.querySelector(".hnname a");
    if (hn) { var wl = hn.cloneNode(true); wl.className = ""; wm.appendChild(wl); }
    else { wm.textContent = "Hacker News"; }
    ahead.appendChild(wm);

    // quiet inline nav from the existing section links
    var nav = el("div", "phn-nav");
    var curPath = location.pathname.replace(/^\//, "").split("?")[0] || "news";
    var topChip = el("a", null, "top"); // synthetic front-page tab (HN's /news link is the wordmark)
    topChip.href = "/news";
    if (curPath === "news") topChip.classList.add("phn-on");
    nav.appendChild(topChip);
    $$("a", pt0).forEach(function (a) {
      if (a.closest(".hnname")) return;
      var path;
      try { path = new URL(a.href).pathname.replace(/^\//, "").split("?")[0]; }
      catch (e) { path = ""; }
      var link = a.cloneNode(true);
      link.className = "";
      if (path === curPath) link.classList.add("phn-on");
      nav.appendChild(link);
    });
    ahead.appendChild(nav);

    // user / login block (cloned, preserves auth-tokened links), pushed right
    var user = el("span", "phn-ahead-user");
    if (pts[1]) {
      Array.prototype.forEach.call(pts[1].childNodes, function (n) {
        user.appendChild(n.cloneNode(true));
      });
    }
    ahead.appendChild(user);

    pt0.parentNode.insertBefore(ahead, pt0);
    pt0.classList.add("phn-hidden");
    if (pts[1]) pts[1].classList.add("phn-hidden");
  }

  /* ---------- Tighter comment indentation ---------- */
  function tightenIndent() {
    var scale = 22; // HN default is 40px per level
    $$("td.ind img").forEach(function (img) {
      var w = parseInt(img.getAttribute("width") || img.width || "0", 10);
      if (isNaN(w)) return;
      var lvl = Math.round(w / 40);
      img.setAttribute("width", lvl * scale);
      img.width = lvl * scale;
    });
  }

  /* ---------- run ---------- */
  function run() {
    applyTheme();
    if (!settings.enabled) return;
    var type = pageType();
    // build the header first so the theme toggle lands inside it
    safe(buildHeader);
    safe(injectThemeToggle);
    if (type === "list") { safe(enhanceFeed); safe(paginate20); }
    if (type === "item") safe(enhanceComments);
    if (type === "threads") safe(enhanceInbox);
    if (type === "submit") safe(enhanceSubmit);
    if (type === "item" || type === "threads") safe(tightenIndent);
  }

  function boot() {
    loadSettings(function () {
      applyTheme();
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run);
      } else {
        run();
      }
    });
  }

  boot();
})();
