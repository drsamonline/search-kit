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
  var S = { version: "0.1.0" };

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
        Object.keys(c.docs).forEach(function (d) {
          scores[d] = (scores[d] || 0) + c.docs[d] * c.weight;
        });
      });
      var out = Object.keys(scores).map(function (d) { return { item: items[d], index: +d, score: scores[d] }; });
      out.sort(function (a, b) { return (b.score - a.score) || (a.index - b.index); });
      return qopts.limit ? out.slice(0, qopts.limit) : out;
    }

    return { query: query, size: items.length, vocabulary: vocab.length };
  };

  return S;
});
