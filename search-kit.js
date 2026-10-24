/* search-kit — small, dependency-free ranked search. Zero dependencies.
 *
 * The shared search behind the repertory apps, materia medica readers and notes:
 * build an index once, then query it with prefix and fuzzy matching.
 *
 *   const idx = Search.index(rubrics, { keys: ["name", "remedies"] });
 *   idx.query("head bursting", { limit: 10, fuzzy: true });
 *
 * MIT License. (c) 2026 Dr Sohil Momin.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Search = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var S = { version: "0.2.0" };

  function norm(s) { return String(s == null ? "" : s).toLowerCase(); }
  function tokenise(s) {
    return norm(s).replace(/[^a-z0-9\u0900-\u097F\u0A80-\u0AFF]+/g, " ").split(" ").filter(Boolean);
  }

  /* Levenshtein distance, capped at max (cheap early exit). */
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      var cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function fieldText(item, keys) {
    if (typeof item === "string") return item;
    if (!keys || !keys.length) return Object.keys(item).map(function (k) { return item[k]; }).join(" ");
    return keys.map(function (k) {
      var v = item[k];
      return Array.isArray(v) ? v.join(" ") : (v == null ? "" : String(v));
    }).join(" ");
  }

  S.index = function (items, opts) {
    opts = opts || {};
    items = items || [];
    var keys = opts.keys || null;
    var postings = {};                 // token -> {doc: count}
    var tokens = [];                   // per doc
    items.forEach(function (item, di) {
      var tk = tokenise(fieldText(item, keys));
      tokens[di] = tk;
      var seen = {};
      tk.forEach(function (t) {
        if (seen[t]) { postings[t][di] += 1; return; }
        seen[t] = 1;
        (postings[t] = postings[t] || {})[di] = 1;
      });
    });
    var vocab = Object.keys(postings);

    // tf-idf weighting (adopted from ml-kit): a term that appears in few documents
    // is worth more, and a hit in a long document is worth less. So a rare, exact
    // term outranks a common one, which is what makes ranked search feel right.
    function idf(term) {
      var df = postings[term] ? Object.keys(postings[term]).length : 0;
      return Math.log((1 + items.length) / (1 + df)) + 1;
    }

    function candidates(term) {
      var docs = {}, any = false;
      if (postings[term]) {
        any = true;
        Object.keys(postings[term]).forEach(function (d) { docs[d] = (docs[d] || 0) + postings[term][d]; });
      }
      vocab.forEach(function (t) {
        if (t !== term && t.indexOf(term) === 0) {
          any = true;
          Object.keys(postings[t]).forEach(function (d) { docs[d] = (docs[d] || 0) + postings[t][d] * 0.6; });
        }
      });
      return any ? { term: term, docs: docs, weight: 1 } : null;
    }
    function fuzzyCandidates(term) {
      if (term.length < 4) return null;
      var docs = {}, any = false;
      vocab.forEach(function (t) {
        if (Math.abs(t.length - term.length) <= 1 && lev(t, term, 1) <= 1) {
          any = true;
          Object.keys(postings[t]).forEach(function (d) { docs[d] = (docs[d] || 0) + postings[t][d]; });
        }
      });
      return any ? { term: term, docs: docs, weight: 0.4 } : null;
    }

    function query(q, qopts) {
      qopts = qopts || {};
      var terms = tokenise(q);
      if (!terms.length) return [];
      var scores = {};
      terms.forEach(function (term) {
        var c = candidates(term) || (qopts.fuzzy ? fuzzyCandidates(term) : null);
        if (!c) return;
        var w = c.weight * idf(term);            // tf-idf: term rarity x match quality
        Object.keys(c.docs).forEach(function (d) {
          var dl = (tokens[d] && tokens[d].length) || 1;
          scores[d] = (scores[d] || 0) + (c.docs[d] / dl) * w;   // normalised tf x idf
        });
      });
      var out = Object.keys(scores).map(function (d) { return { item: items[d], index: +d, score: scores[d] }; });
      out.sort(function (a, b) { return (b.score - a.score) || (a.index - b.index); });
      return qopts.limit ? out.slice(0, qopts.limit) : out;
    }

    return { query: query, size: items.length, vocabulary: vocab.length };
  };

  
/* ---------------------------------------------------------------------------
 * Frecency, a command palette, and exclusions.
 *
 * The idea behind zoxide: score = FREQUENCY x RECENCY, with a decay so stale hits
 * sink, so "what I use most, most recently" floats to the top. It is an ADDITIONAL
 * ordering - nothing that worked before stops working.
 *
 * The three parts are deliberately separated:
 *   frecency(events)            a pure scorer
 *   paletteFilter(items, q)     a pure filter - fuzzy match, frecency-ordered
 *   palette(opts)               a small overlay that uses the filter
 *
 * The first two are pure so they can be TESTED. An overlay cannot be tested without
 * a DOM, and a feature whose logic lives inside its overlay is a feature nobody
 * checks. That is the whole reason for the split.
 *
 * EXCLUSIONS: ranked search must honour a user-defined ignore list - the lesson
 * ripgrep, fd and the_silver_searcher all share. An ignore entry may be a string
 * (substring), a RegExp, or a predicate function.
 * ------------------------------------------------------------------------- */

var DAY_MS = 86400000;

// Half-life in days: after this long, a visit counts half as much. 30 makes a
// habit beat a one-off - ten visits a month ago (10 x 0.5 = 5) outrank one visit
// today (1 x 1 = 1). A much shorter half-life would do the opposite, which is the
// decay test's whole point.
var FRECENCY_HALF_LIFE_DAYS = 30;

// The ignore list matches the KEY and the LABEL. A user writing /repert/i means
// "don't show me repertory things", and what they see is the label - checking only
// the key would silently fail on the exact rule they wrote. Found by a test that
// asserted the right thing while the code did not.
function _ignored(names, ignore) {
  if (!ignore) return false;
  var list = Array.isArray(ignore) ? ignore : [ignore];
  var cands = Array.isArray(names) ? names : [names];
  for (var j = 0; j < cands.length; j++) {
    var name = cands[j];
    if (name === undefined || name === null) continue;
    for (var i = 0; i < list.length; i++) {
      var rule = list[i];
      if (rule == null) continue;
      if (typeof rule === "function") { if (rule(name)) return true; continue; }
      if (rule instanceof RegExp) { if (rule.test(String(name))) return true; continue; }
      if (String(name).indexOf(String(rule)) !== -1) return true;
    }
  }
  return false;
}

/* events: [{ key, at }] where `at` is a timestamp in ms, or { key, count, at } for
 * an aggregated history. Returns an array of { key, score, visits, last }, sorted
 * by score descending. */
function frecency(events, opts) {
  opts = opts || {};
  var now = opts.now === undefined ? Date.now() : opts.now;
  var half = opts.halfLifeDays === undefined ? FRECENCY_HALF_LIFE_DAYS : opts.halfLifeDays;
  var ignore = opts.ignore;
  var by = {};

  (events || []).forEach(function (e) {
    if (!e) return;
    var key = e.key === undefined ? e.name : e.key;
    if (key === undefined || key === null) return;
    key = String(key);
    if (_ignored(key, ignore)) return;
    var at = typeof e.at === "number" ? e.at : Date.parse(e.at);
    if (!isFinite(at)) at = now;
    var count = e.count === undefined ? 1 : Math.max(0, e.count);
    if (!by[key]) by[key] = { key: key, score: 0, visits: 0, last: at };
    var ageDays = Math.max(0, (now - at) / DAY_MS);
    // the decay: each visit is worth half as much every `half` days
    var weight = half <= 0 ? 1 : Math.pow(0.5, ageDays / half);
    by[key].score += count * weight;
    by[key].visits += count;
    if (at > by[key].last) by[key].last = at;
  });

  var out = Object.keys(by).map(function (k) { return by[k]; });
  out.forEach(function (r) { r.score = Math.round(r.score * 1000) / 1000; });
  out.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    if (b.last !== a.last) return b.last - a.last;      // a tie breaks on recency
    return a.key < b.key ? -1 : (a.key > b.key ? 1 : 0); // then deterministically
  });
  return out;
}

/* A subsequence match: every character of the query appears in order. Returns
 * { hit, score } where a tighter, earlier match scores higher. */
function _fuzzyMatch(text, q) {
  if (!q) return { hit: true, score: 0 };
  var t = String(text).toLowerCase(), s = String(q).toLowerCase();
  var ti = 0, score = 0, last = -1, streak = 0;
  for (var i = 0; i < s.length; i++) {
    var c = s[i];
    var found = t.indexOf(c, ti);
    if (found === -1) return { hit: false, score: 0 };
    if (found === last + 1) { streak++; score += 6 + streak; } else { streak = 0; score += 2; }
    score -= Math.min(found - ti, 20) * 0.1;      // earlier is better
    last = found; ti = found + 1;
  }
  score -= Math.min(t.length, 40) * 0.05;          // a shorter candidate wins a tie
  return { hit: true, score: score };
}

/* The palette's brain, without a palette: filter and order a list.
 * items: [{ key, label, hint }] or plain strings.
 * history: the same `events` frecency takes. */
function paletteFilter(items, q, opts) {
  opts = opts || {};
  var ignore = opts.ignore;
  var history = opts.history || [];
  var scored = frecency(history, { now: opts.now, halfLifeDays: opts.halfLifeDays, ignore: ignore });
  var bonus = {};
  scored.forEach(function (r) { bonus[r.key] = r.score; });

  var out = [];
  (items || []).forEach(function (it) {
    var key = typeof it === "string" ? it : (it.key === undefined ? it.label : it.key);
    if (key === undefined || key === null) return;
    key = String(key);
    var label = typeof it === "string" ? it : (it.label === undefined ? key : it.label);
    var hint = typeof it === "string" ? "" : (it.hint || "");
    // BOTH, so a rule written against either one works
    if (_ignored([key, label], ignore)) return;
    var m = _fuzzyMatch(label, q);
    if (!m.hit) return;
    out.push({
      key: key, label: label, hint: hint,
      match: m.score,
      frecency: bonus[key] || 0,
      score: m.score + (bonus[key] || 0),
    });
  });
  // With no query the frecency is the whole ordering; with a query the match leads
  // and frecency breaks the ties. Both matter, and they matter in that order.
  out.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.key < b.key ? -1 : (a.key > b.key ? 1 : 0);
  });
  return out;
}

/* The overlay. Small on purpose: it is a list, a box and a key handler, not a
 * framework. Untested here - there is no DOM in node - which is exactly why the
 * two functions above exist separately. */
function palette(opts) {
  opts = opts || {};
  var doc = opts.document || (typeof document !== "undefined" ? document : null);
  if (!doc) return { open: function () {}, close: function () {}, destroy: function () {} };
  var items = opts.items || [];
  var history = opts.history || [];
  var ignore = opts.ignore;
  var onPick = opts.onPick || function () {};

  var wrap = doc.createElement("div");
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-label", opts.label || "Command palette");
  wrap.style.cssText = "position:fixed;inset:0;display:none;z-index:9999;background:rgba(0,0,0,.35)";
  var box = doc.createElement("div");
  box.style.cssText = "max-width:520px;margin:12vh auto 0;background:var(--surface,#fff);"
    + "border:1px solid var(--line,#ddd);border-radius:var(--radius,10px);overflow:hidden";
  var input = doc.createElement("input");
  input.type = "search";
  input.placeholder = opts.placeholder || "Search…";
  input.setAttribute("aria-label", input.placeholder);
  input.style.cssText = "width:100%;padding:12px;border:0;outline:0;font:inherit";
  var list = doc.createElement("ul");
  list.style.cssText = "margin:0;padding:4px 0;list-style:none;max-height:46vh;overflow:auto";
  box.appendChild(input); box.appendChild(list); wrap.appendChild(box);
  doc.body.appendChild(wrap);

  var shown = [], active = 0;
  function render() {
    list.innerHTML = "";
    shown = paletteFilter(items, input.value, { history: history, ignore: ignore, now: opts.now });
    if (opts.limit) shown = shown.slice(0, opts.limit);
    if (!shown.length) {
      var li = doc.createElement("li");
      li.textContent = "No match";
      li.style.cssText = "padding:10px 14px;color:var(--faint,#888)";
      list.appendChild(li);
      return;
    }
    shown.forEach(function (r, i) {
      var li = doc.createElement("li");
      li.textContent = r.label + (r.hint ? "  " + r.hint : "");
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", i === active ? "true" : "false");
      li.style.cssText = "padding:9px 14px;cursor:pointer"
        + (i === active ? ";background:var(--bg1,#f4ede1)" : "");
      li.onclick = function () { pick(r); };
      list.appendChild(li);
    });
  }
  function pick(r) { close(); onPick(r); }
  function open() { wrap.style.display = "block"; input.value = ""; active = 0; render(); input.focus(); }
  function close() { wrap.style.display = "none"; }
  function onKey(e) {
    if (e.key === "Escape") { close(); }
    else if (e.key === "ArrowDown") { active = Math.min(active + 1, shown.length - 1); render(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = Math.max(active - 1, 0); render(); e.preventDefault(); }
    else if (e.key === "Enter" && shown[active]) { pick(shown[active]); e.preventDefault(); }
  }
  input.addEventListener("input", function () { active = 0; render(); });
  input.addEventListener("keydown", onKey);
  wrap.addEventListener("keydown", onKey);
  wrap.addEventListener("click", function (e) { if (e.target === wrap) close(); });
  // Ctrl-K / Cmd-K opens it. The handler is returned so the caller can remove it.
  var hotkey = function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); open(); }
  };
  doc.addEventListener("keydown", hotkey);

  return {
    open: open, close: close,
    destroy: function () {
      doc.removeEventListener("keydown", hotkey);
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    },
    filter: function (q) { return paletteFilter(items, q, { history: history, ignore: ignore, now: opts.now }); },
  };
}

/* ------------------------------------------------------------------------- */


  // ---- frecency, the command palette, and exclusions ----------------------
  // ADDITIONS. Nothing above changed, and the default ordering is untouched:
  // frecency is an extra ordering you ask for, not one imposed on you.
  S.frecency = frecency;
  S.paletteFilter = paletteFilter;
  S.palette = palette;
  S.fuzzyMatch = _fuzzyMatch;
  S.FRECENCY_HALF_LIFE_DAYS = FRECENCY_HALF_LIFE_DAYS;

  return S;
});
