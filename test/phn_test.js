/* Smoke test: load enhance.js against faithful HN DOM fixtures in jsdom. */
const fs = require("fs");
const { JSDOM } = require("jsdom");
const EXT = require("path").join(__dirname, "..");
const code = fs.readFileSync(EXT + "/content/enhance.js", "utf8");

function fakeChrome(store) {
  return {
    storage: {
      local: {
        get(key, cb) { cb({ [key]: store[key] }); },
        set(obj) { Object.assign(store, obj); }
      },
      onChanged: { addListener() {} }
    }
  };
}
function prep(w, store, dark) {
  w.chrome = fakeChrome(store || {});
  w.matchMedia = () => ({ matches: !!dark, addEventListener() {}, addListener() {} });
  Object.defineProperty(w.HTMLElement.prototype, "offsetParent", { get() { return this.parentNode; } });
  w.HTMLElement.prototype.scrollIntoView = function () {};
}
function report(name, d, checks) {
  let pass = true;
  const lines = checks.map(c => {
    let ok=false, det="";
    try { const r=c.fn(d); ok=!!r; det = typeof r === "string" ? r : ""; }
    catch(e){ det="threw: "+e.message; }
    if(!ok) pass=false;
    return `   ${ok?"PASS":"FAIL"}  ${c.name}${det?" — "+det:""}`;
  });
  console.log(`\n== ${name} ==\n` + lines.join("\n"));
  return pass;
}
function run(name, url, html, store, dark, checks) {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true, runScripts: "dangerously" });
  prep(dom.window, store, dark);
  const s = dom.window.document.createElement("script");
  s.textContent = code;
  dom.window.document.body.appendChild(s);
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
  return report(name, dom.window.document, checks);
}

let allPass = true;

/* Fixture 1: list page */
const listHTML = `<!DOCTYPE html><html><body><center><table id="hnmain"><tbody>
<tr><td bgcolor="#ff6600"><span class="pagetop"><b class="hnname"><a href="news">Hacker News</a></b>
<a href="newest">new</a> | <a href="login">login</a></span></td></tr>
<tr><td><table class="itemlist"><tbody>
<tr class="athing submission" id="111"><td class="title"><span class="rank">1.</span></td>
<td class="votelinks"><center><a id="up_111" href="vote?id=111"><div class="votearrow"></div></a></center></td>
<td class="title"><span class="titleline"><a href="https://example.com/post">A cool post</a>
<span class="sitebit comhead"> (<a href="from?site=example.com"><span class="sitestr">example.com</span></a>)</span></span></td></tr>
<tr><td colspan="2"></td><td class="subtext"><span class="subline">
<span class="score">42 points</span> by <a href="user?id=alice" class="hnuser">alice</a>
<span class="age" title="2026-06-15T10:00:00"><a href="item?id=111">2 hours ago</a></span> |
<a href="item?id=111">12 comments</a></span></td></tr>
<tr class="spacer"></tr>
<tr class="athing submission" id="112"><td class="title"><span class="rank">2.</span></td>
<td class="votelinks"><center><a href="vote?id=112"><div class="votearrow"></div></a></center></td>
<td class="title"><span class="titleline"><a href="item?id=112">Ask HN: a self post</a></span></td></tr>
</tbody></table></td></tr></tbody></table></center></body></html>`;
allPass &= run("List page (/news)", "https://news.ycombinator.com/news", listHTML, {}, false, [
  { name: "data-phn enabled on <html>", fn: d => d.documentElement.getAttribute("data-phn") === "on" },
  { name: "style is clearer (single shipped style)", fn: d => d.documentElement.getAttribute("data-phn-style") === "clearer" },
  { name: "Single-row header built", fn: d => !!d.querySelector(".phn-ahead .phn-nav") },
  { name: "nav has active top tab", fn: d => { const t=[...d.querySelectorAll(".phn-nav a")].find(a=>a.textContent==="top"); return t && t.classList.contains("phn-on"); } },
  { name: "original pipe nav hidden", fn: d => d.querySelector(".pagetop").classList.contains("phn-hidden") },
  { name: "theme toggle moved into header", fn: d => !!d.querySelector(".phn-ahead-user .phn-toggle") },
  { name: "pipes tidied to middots", fn: d => { const t=d.querySelector(".subline").textContent; return t.indexOf("|") === -1 && t.indexOf("·") !== -1; } },
]);

/* shared comment builders */
function comhead(user, ageTitle) {
  return `<div class="comhead"><a href="user?id=${user}" class="hnuser">${user}</a>
  <span class="age" title="${ageTitle}"><a href="#">x</a></span>
  <span class="navs"> | <a class="togg" href="javascript:void(0)">[–]</a></span></div>`;
}
function commentRow(id, user, level, age, text) {
  return `<tr class="athing comtr" id="${id}"><td><table><tbody><tr>
  <td class="ind" indent="${level}"><img src="s.gif" width="${level*40}" height="1"></td>
  <td class="votelinks"><center><a href="vote?id=${id}"><div class="votearrow"></div></a></center></td>
  <td class="default"><div>${comhead(user, age)}</div>
  <div class="comment"><div class="commtext c00">${text}</div>
  <div class="reply"><a href="reply?id=${id}">reply</a></div></div></td>
  </tr></tbody></table></td></tr>`;
}

/* Fixture 2: item/comments */
const itemHTML = `<!DOCTYPE html><html><body><center><table id="hnmain"><tbody>
<tr><td bgcolor="#ff6600"><span class="pagetop"><a href="login">login</a></span></td></tr>
<tr><td><table class="fatitem"><tbody>
<tr class="athing" id="500"><td class="title"><span class="titleline"><a href="https://blog.dev/x">My launch</a></span></td></tr>
<tr><td class="subtext"><span class="subline"><span class="score">100 points</span> by
<a href="user?id=carol" class="hnuser">carol</a> <span class="age" title="2026-06-14T09:00:00"><a href="item?id=500">1 day ago</a></span></span></td></tr>
</tbody></table>
<table class="comment-tree"><tbody>
${commentRow(501, "dave", 0, "2026-06-15T08:00:00", "Top level reply")}
${commentRow(502, "carol", 1, "2026-06-15T11:30:00", "OP responding here")}
${commentRow(503, "erin", 0, "2026-06-14T10:00:00", "Older comment")}
</tbody></table></td></tr></tbody></table></center></body></html>`;
const store2 = { phnVisits: { "500": Date.parse("2026-06-15T09:00:00") } };
allPass &= run("Item / comments page", "https://news.ycombinator.com/item?id=500", itemHTML, store2, true, [
  { name: "dark theme resolved from matchMedia", fn: d => d.documentElement.getAttribute("data-phn-theme") === "dark" },
  { name: "OP comment tagged (carol)", fn: d => { const r=d.getElementById("502"); return r.classList.contains("phn-op") && !!r.querySelector(".phn-op-tag"); } },
  { name: "non-OP not tagged", fn: d => !d.getElementById("501").classList.contains("phn-op") },
  { name: "new-since-visit marked on 11:30 comment", fn: d => { const r=d.getElementById("502"); return r.classList.contains("phn-fresh") && !!r.querySelector(".phn-new-dot"); } },
  { name: "old comment not fresh", fn: d => !d.getElementById("503").classList.contains("phn-fresh") },
  { name: "comment toolbar inserted once", fn: d => d.querySelectorAll(".phn-bar").length === 1 },
  { name: "3 toolbar buttons", fn: d => d.querySelectorAll(".phn-bar button").length === 3 },
  { name: "visit record stores {t,c}", fn: () => { const r = store2.phnVisits["500"]; return r && typeof r === "object" && r.t > Date.parse("2026-06-15T09:00:00") && r.c === 3; } },
]);

/* Fixture 2b: read / new-comment tracking on the feed */
const feedHTML = `<!DOCTYPE html><html><body><center><table id="hnmain"><tbody>
<tr><td bgcolor="#ff6600"><span class="pagetop"><b class="hnname"><a href="news">Hacker News</a></b> <a href="login">login</a></span></td></tr>
<tr><td><table class="itemlist"><tbody>
<tr class="athing submission" id="900"><td class="title"><span class="rank">1.</span></td>
<td class="votelinks"><center><a href="vote?id=900"><div class="votearrow"></div></a></center></td>
<td class="title"><span class="titleline"><a href="https://ex.com/a">Seen story with new replies</a></span></td></tr>
<tr><td colspan="2"></td><td class="subtext"><span class="subline"><span class="score">50 points</span> by <a class="hnuser">x</a> <a href="item?id=900">40&nbsp;comments</a></span></td></tr>
<tr class="athing submission" id="901"><td class="title"><span class="rank">2.</span></td>
<td class="votelinks"><center><a href="vote?id=901"><div class="votearrow"></div></a></center></td>
<td class="title"><span class="titleline"><a href="https://ex.com/b">Unseen story</a></span></td></tr>
<tr><td colspan="2"></td><td class="subtext"><span class="subline"><span class="score">10 points</span> by <a class="hnuser">y</a> <a href="item?id=901">5&nbsp;comments</a></span></td></tr>
</tbody></table></td></tr></tbody></table></center></body></html>`;
allPass &= run("Feed read/new tracking", "https://news.ycombinator.com/news", feedHTML,
  { phnVisits: { "900": { t: Date.parse("2026-06-15T08:00:00"), c: 32 } } }, false, [
  { name: "visited story dimmed (phn-read)", fn: d => d.getElementById("900").classList.contains("phn-read") },
  { name: "unseen story not dimmed", fn: d => !d.getElementById("901").classList.contains("phn-read") },
  { name: "+N new badge shows +8 (40-32)", fn: d => { const b = d.querySelector(".phn-newcount"); return b && b.textContent === "+8"; } },
  { name: "+N badge has an explanatory tooltip", fn: d => { const b = d.querySelector(".phn-newcount"); return b && /new comments? since your last visit/.test(b.title); } },
  { name: "no leading dot is added (consolidated to badge)", fn: d => d.querySelector(".phn-activity-dot") === null },
  { name: "no badge on unseen story", fn: d => d.getElementById("901").nextElementSibling.querySelector(".phn-newcount") === null },
]);

/* Fixture 2c: collapse / expand-all detection (HN collapsed toggle = "[N more]") */
function crow(id, lvl, togg) {
  return `<tr class="athing comtr" id="${id}"><td><table><tbody><tr>
  <td class="ind"><img src="s.gif" width="${lvl*40}"></td>
  <td class="votelinks"><center><a href="vote?id=${id}"><div class="votearrow"></div></a></center></td>
  <td class="default"><div class="comhead"><a class="hnuser">u${id}</a>
  <span class="age" title="2026-06-15T08:00:00"><a href="#">x</a></span>
  <a class="togg" href="javascript:void(0)">${togg}</a></div>
  <div class="comment"><div class="commtext c00">c${id}</div><div class="reply"><a href="reply?id=${id}">reply</a></div></div></td>
  </tr></tbody></table></td></tr>`;
}
const collHTML = `<!DOCTYPE html><html><body><center><table id="hnmain"><tbody>
<tr><td bgcolor="#ff6600"><span class="pagetop"><b class="hnname"><a href="news">Hacker News</a></b> <a href="login">login</a></span></td></tr>
<tr><td><table class="fatitem"><tbody><tr class="athing" id="700"><td class="subtext"><span class="subline"><a href="user?id=op" class="hnuser">op</a></span></td></tr></tbody></table>
<table class="comment-tree"><tbody>
${crow(701, 0, "[–]")}
${crow(702, 0, "[3 more]")}
</tbody></table></td></tr></tbody></table></center></body></html>`;

allPass &= run("Expand all targets collapsed roots", "https://news.ycombinator.com/item?id=700", collHTML, {}, false, [
  { name: "expand clicks the collapsed root only", fn: d => {
      let c701 = 0, c702 = 0;
      d.getElementById("701").querySelector("a.togg").addEventListener("click", () => c701++);
      d.getElementById("702").querySelector("a.togg").addEventListener("click", () => c702++);
      const eb = [...d.querySelectorAll(".phn-bar button")].find(b => /expand/i.test(b.textContent));
      eb.click();
      return c702 === 1 && c701 === 0; } },
]);
allPass &= run("Collapse all targets expanded roots", "https://news.ycombinator.com/item?id=700", collHTML, {}, false, [
  { name: "collapse clicks the expanded root only", fn: d => {
      let c701 = 0, c702 = 0;
      d.getElementById("701").querySelector("a.togg").addEventListener("click", () => c701++);
      d.getElementById("702").querySelector("a.togg").addEventListener("click", () => c702++);
      const cb = [...d.querySelectorAll(".phn-bar button")].find(b => /collapse/i.test(b.textContent));
      cb.click();
      return c701 === 1 && c702 === 0; } },
]);

/* Fixture 2d: 20-per-page (no-network path: last page with 25 items) */
function storyUnit(id, rank) {
  return `<tr class="athing submission" id="${id}"><td class="title"><span class="rank">${rank}.</span></td>
  <td class="votelinks"><center><a href="vote?id=${id}"><div class="votearrow"></div></a></center></td>
  <td class="title"><span class="titleline"><a href="https://ex.com/${id}">Story ${rank}</a></span></td></tr>
  <tr><td colspan="2"></td><td class="subtext"><span class="subline"><span class="score">10 points</span> by <a class="hnuser">u</a> <a href="item?id=${id}">3 comments</a></span></td></tr>
  <tr class="spacer"></tr>`;
}
let units25 = ""; for (let i = 0; i < 25; i++) units25 += storyUnit(1000 + i, i + 1);
const pageHTML = `<!DOCTYPE html><html><body><center><table id="hnmain"><tbody>
<tr><td bgcolor="#ff6600"><span class="pagetop"><b class="hnname"><a href="news">Hacker News</a></b> <a href="login">login</a></span></td></tr>
<tr><td><table><tbody>${units25}</tbody></table></td></tr></tbody></table></center></body></html>`;
function visibleStories(d) { return [...d.querySelectorAll("tr.athing")].filter(r => r.querySelector(".titleline") && r.style.display !== "none").length; }
function click(d, el) { el.dispatchEvent(new d.defaultView.MouseEvent("click", { bubbles: true, cancelable: true })); }
allPass &= run("20-per-page real pagination", "https://news.ycombinator.com/news", pageHTML, {}, false, [
  { name: "window 1 shows 20 of 25", fn: d => visibleStories(d) === 20 },
  { name: "pager: prev hidden, next shown, page 1 (space reserved)", fn: d => {
      const prev = d.querySelector(".phn-prev"), next = d.querySelector(".phn-next"), num = d.querySelector(".phn-pagenum");
      return prev.style.visibility === "hidden" && next.style.visibility === "visible" && num.textContent === "page 1"; } },
  { name: "Next → window 2 shows last 5, next hides (space reserved)", fn: d => {
      click(d, d.querySelector(".phn-next"));
      const prev = d.querySelector(".phn-prev"), next = d.querySelector(".phn-next"), num = d.querySelector(".phn-pagenum");
      return visibleStories(d) === 5 && prev.style.visibility === "visible" && next.style.visibility === "hidden" && num.textContent === "page 2"; } },
  { name: "Prev → back to window 1 (20)", fn: d => {
      click(d, d.querySelector(".phn-prev"));
      return visibleStories(d) === 20 && d.querySelector(".phn-pagenum").textContent === "page 1"; } },
]);

/* Fixture 3: threads/inbox */
const threadsHTML = `<!DOCTYPE html><html><body><center><table id="hnmain"><tbody>
<tr><td bgcolor="#ff6600"><span class="pagetop"><a id="me" href="user?id=carol">carol</a> | <a href="logout">logout</a></span></td></tr>
<tr><td><table class="comment-tree"><tbody>
${commentRow(601, "carol", 0, "2026-06-15T08:00:00", "My comment")}
${commentRow(602, "frank", 1, "2026-06-15T09:00:00", "A reply to carol")}
${commentRow(603, "carol", 0, "2026-06-14T08:00:00", "Another of my comments")}
</tbody></table></td></tr></tbody></table></center></body></html>`;
allPass &= run("Threads page (inbox)", "https://news.ycombinator.com/threads?id=carol", threadsHTML, {}, false, [
  { name: "inbox filter bar inserted", fn: d => !!d.querySelector(".phn-inbox-bar") },
  { name: "two filter pills", fn: d => d.querySelectorAll(".phn-inbox-bar .phn-pill").length === 2 },
  { name: "own comment marked phn-mine", fn: d => d.getElementById("601").classList.contains("phn-mine") },
  { name: "reply marked + tagged", fn: d => { const r=d.getElementById("602"); return r.classList.contains("phn-reply") && !!r.querySelector(".phn-reply-tag"); } },
  { name: "reply count shows (1)", fn: d => /\(1\)/.test(d.querySelectorAll(".phn-pill")[1].textContent) },
]);

/* Fixture 4: submit */
const submitHTML = `<!DOCTYPE html><html><body><center><table id="hnmain"><tbody>
<tr><td bgcolor="#ff6600"><span class="pagetop"><a href="news">HN</a></span></td></tr>
<tr><td><form action="r" method="post"><table><tbody>
<tr><td>title</td><td><input type="text" name="title" value=""></td></tr>
<tr><td>url</td><td><input type="url" name="url" value=""></td></tr>
<tr><td>text</td><td><textarea name="text"></textarea></td></tr>
</tbody></table><input type="submit" value="submit"></form></td></tr></tbody></table></center></body></html>`;
allPass &= run("Submit page", "https://news.ycombinator.com/submit", submitHTML, {}, false, [
  { name: "title hint added", fn: d => !!d.querySelector('input[name="title"]').parentNode.querySelector(".phn-hint") },
  { name: "url hint added", fn: d => !!d.querySelector('input[name="url"]').parentNode.querySelector(".phn-hint") },
  { name: "title prefix detection works", fn: d => { const i=d.querySelector('input[name="title"]'); i.value="Show HN: my project"; i.dispatchEvent(new d.defaultView.Event("input")); const h=i.parentNode.querySelector(".phn-hint"); return /prefix detected/.test(h.textContent) && h.classList.contains("phn-ok"); } },
]);

console.log("\n" + (allPass ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"));
process.exit(allPass ? 0 : 1);
