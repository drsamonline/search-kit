'use strict';
/* The palette's keyboard handling, tested against a DOM stub that bubbles.
 *
 *   node tests/palette-keys.test.js
 *
 * The bug this exists for: `onKey` was attached to the input AND to the wrapper,
 * and a keydown on the input bubbles to the wrapper — so one arrow press moved
 * the selection two rows, and Escape ran twice.
 */
const path = require("path");
const { makeDocument, dispatch } = require("./dom-stub.js");
const Search = require(path.join(__dirname, "..", "search-kit.js"));

let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? (pass++, console.log("PASS  " + n)) : (fail++, console.log("FAIL  " + n + (d ? "  (" + d + ")" : ""))); };

const doc = makeDocument();
const picked = [];
const items = ["alpha", "bravo", "charlie", "delta"].map((l) => ({ key: l, label: l }));
const p = Search.palette({ document: doc, items: items, onPick: (r) => picked.push(r.key) });
p.open();

const wrap = doc.body.children[doc.body.children.length - 1];
const input = wrap.children[0].children[0];
const list = wrap.children[0].children[1];

const selected = () => list.children.findIndex((li) => li.attrs["aria-selected"] === "true");

ok("four rows render", list.children.length === 4, list.children.length);
ok("the first row starts selected", selected() === 0, selected());

dispatch(input, { type: "keydown", key: "ArrowDown", preventDefault() {} });
ok("one ArrowDown moves one row", selected() === 1, "selected " + selected());

dispatch(input, { type: "keydown", key: "ArrowDown", preventDefault() {} });
dispatch(input, { type: "keydown", key: "ArrowUp", preventDefault() {} });
ok("down then up returns to the same row", selected() === 1, "selected " + selected());

dispatch(input, { type: "keydown", key: "Enter", preventDefault() {} });
ok("Enter picks the selected row", picked.length === 1 && picked[0] === "bravo", JSON.stringify(picked));

p.open();
dispatch(input, { type: "keydown", key: "Escape", preventDefault() {} });
ok("Escape closes once", wrap.style.display === "none", wrap.style.display);

console.log("\n" + (fail === 0 ? "palette keys: OK" : fail + " failed"));
process.exit(fail === 0 ? 0 : 1);
