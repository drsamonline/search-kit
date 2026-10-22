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
