const S = require(require("path").join(__dirname, "search-kit.js"));
let pass = 0, fail = 0;
function ok(n, c, e) { c ? (pass++, console.log("PASS  " + n + (e ? "  (" + e + ")" : ""))) : (fail++, console.log("FAIL  " + n + (e ? "  (" + e + ")" : ""))); }

const docs = [
  { name: "Head, pain, bursting", remedies: ["Bell", "Apis"] },
  { name: "Head, pain, < motion", remedies: ["Bry", "Bell"] },
  { name: "Stomach, nausea", remedies: ["Ipec", "Nux-v"] },
  { name: "Cough, dry, night", remedies: ["Bry", "Bell"] },
];
const idx = S.index(docs, { keys: ["name", "remedies"] });

ok("index size", idx.size === 4);

const r1 = idx.query("bursting");
ok("exact token finds the doc", r1.length === 1 && r1[0].item.name.indexOf("bursting") !== -1);

const r2 = idx.query("head");
ok("multi-doc match", r2.length === 2);

const r3 = idx.query("motion");
ok("single match", r3.length === 1 && r3[0].item.name.indexOf("motion") !== -1);

const r4 = idx.query("bell");
ok("matches inside an array field", r4.length === 3);

const r5 = idx.query("bell head", { limit: 5 });
ok("multi-term ranks the doc with both highest", r5[0].item.name.indexOf("Head") !== -1 && r5[0].item.remedies.indexOf("Bell") !== -1, "score " + r5[0].score);

const r6 = idx.query("nausa", { fuzzy: true });
ok("fuzzy finds 'nausea' from 'nausa'", r6.length === 1 && r6[0].item.name.indexOf("nausea") !== -1);

const r7 = idx.query("nausa");
ok("without fuzzy, a typo finds nothing", r7.length === 0);

const r8 = idx.query("hea");
ok("prefix matches", r8.length === 2);

ok("empty query returns nothing", idx.query("").length === 0);

const str = S.index(["alpha", "beta", "alphabet"]);
ok("string items work", str.query("alpha").length === 2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

// ---- frecency, the palette filter, and exclusions ---------------------
(function () {
  let fails = [];
const ok = (w, c, d) => { if (!c) fails.push(w + (d ? "  -> " + d : "")); };

// 1. frequent beats recent-but-rare (the spec's first case)
let ev = [];
for (let i = 0; i < 10; i++) ev.push({ key: "habit", at: NOW - 30 * DAY });
ev.push({ key: "oneoff", at: NOW });
let r = S.frecency(ev, { now: NOW });
ok("frequent beats recent-but-rare", r[0].key === "habit", r.map(x => x.key + ":" + x.score).join(", "));
ok("scores are the decayed sums", Math.abs(r[0].score - 5) < 0.01 && Math.abs(r[1].score - 1) < 0.01,
   JSON.stringify(r.map(x => x.score)));

// 2. the decay: a short half-life flips it, which is what a decay is FOR
let r2 = S.frecency(ev, { now: NOW, halfLifeDays: 1 });
ok("with a 1-day half-life the recent one wins", r2[0].key === "oneoff", r2.map(x => x.key + ":" + x.score).join(", "));
ok("the decay actually decayed", r2[1].score < 0.01, String(r2[1].score));

// 3. the palette filter
const items = [
  { key: "today-card", label: "Today Card", hint: "one card for the day" },
  { key: "panchang",   label: "Panchang",   hint: "the Indian almanac" },
  { key: "case-kit",   label: "Case Kit",   hint: "clinical case tracking" },
  { key: "kent",       label: "Kent Repertory", hint: "74,667 rubrics" },
];
let f = S.paletteFilter(items, "card", { now: NOW });
ok("a query narrows the list", f.length === 1 && f[0].key === "today-card", JSON.stringify(f.map(x => x.key)));
let f2 = S.paletteFilter(items, "ca", { now: NOW });
ok("a subsequence matches", f2.some(x => x.key === "today-card") && f2.some(x => x.key === "case-kit"),
   JSON.stringify(f2.map(x => x.key)));
let f3 = S.paletteFilter(items, "zzz", { now: NOW });
ok("no match gives an empty list, not an error", f3.length === 0);
// with no query, frecency IS the ordering
let hist = [{ key: "panchang", at: NOW }, { key: "panchang", at: NOW - DAY }, { key: "panchang", at: NOW - 2 * DAY }];
let f4 = S.paletteFilter(items, "", { history: hist, now: NOW });
ok("with no query frecency leads", f4[0].key === "panchang", JSON.stringify(f4.map(x => x.key)));
// with a query, the MATCH leads and frecency breaks ties
let f5 = S.paletteFilter(items, "a", { history: hist, now: NOW });
ok("with a query the match leads", f5.length > 0 && f5[0].match >= f5[f5.length - 1].match);

// 4. exclusions
let f6 = S.paletteFilter(items, "", { now: NOW, ignore: ["case-"] });
ok("a string ignore rule excludes", !f6.some(x => x.key === "case-kit"), JSON.stringify(f6.map(x => x.key)));
let f7 = S.paletteFilter(items, "", { now: NOW, ignore: /repert/i });
ok("a regexp ignore rule excludes", !f7.some(x => x.key === "kent"));
let f8 = S.frecency(ev, { now: NOW, ignore: k => k === "habit" });
ok("a predicate ignore rule excludes", !f8.some(x => x.key === "habit"));
ok("an ignored key does not appear in frecency at all", f8.length === 1);

// and the ordering is deterministic on a tie
let tie = S.frecency([{ key: "b", at: NOW }, { key: "a", at: NOW }], { now: NOW });
ok("a tie breaks deterministically", tie.map(x => x.key).join("") === "ab", JSON.stringify(tie.map(x => x.key)));

if (fails.length) { console.log("FAILED " + fails.length + ":"); fails.forEach(x => console.log("   " + x)); process.exit(1); }
console.log("all search tests passed: frecency ordering, decay, palette filter, exclusions, deterministic ties");
})();
