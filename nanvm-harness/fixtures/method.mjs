// A method call: the property read, then called — with no `this` to carry.
/** @type {(...a: readonly unknown[]) => unknown} */
const f = (...a) => a[0];
const o = { f: f };
export default o.f(41);
