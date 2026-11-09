/* A DOM stub small enough to reason about, and faithful in the one thing that
 * matters here: events bubble. */
function El(tag) {
  this.tagName = tag; this.children = []; this.parentNode = null;
  this.style = {}; this.attrs = {}; this.listeners = {}; this.textContent = "";
  this._innerHTML = ""; this.value = ""; this.focused = false;
}
El.prototype.appendChild = function (c) { c.parentNode = this; this.children.push(c); return c; };
El.prototype.removeChild = function (c) { var i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; };
El.prototype.setAttribute = function (k, v) { this.attrs[k] = String(v); };
El.prototype.addEventListener = function (t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); };
El.prototype.removeEventListener = function (t, fn) { var l = this.listeners[t] || []; var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); };
El.prototype.focus = function () { this.focused = true; };
Object.defineProperty(El.prototype, "innerHTML", {
  get: function () { return this._innerHTML; },
  set: function (v) { this._innerHTML = v; if (v === "") this.children = []; },
});
function makeDocument() {
  var body = new El("body");
  var doc = {
    body: body,
    createElement: function (t) { return new El(t); },
    addEventListener: function (t, fn) { (doc.listeners = doc.listeners || {}); (doc.listeners[t] = doc.listeners[t] || []).push(fn); },
    removeEventListener: function () {},
  };
  return doc;
}
function dispatch(target, event) {
  var n = target;
  while (n) {
    var l = (n.listeners && n.listeners[event.type]) || [];
    for (var i = 0; i < l.length; i++) l[i](event);
    n = n.parentNode;
  }
}
module.exports = { makeDocument: makeDocument, dispatch: dispatch, El: El };
