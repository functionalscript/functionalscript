// One function, called from two sites: one value, bound once and cloned, so
// the two calls share an identity as they do in JavaScript.
/** @type {(...a: readonly unknown[]) => unknown} */
const f = (...a) => a[0];
export default [f(1), f(2)];
