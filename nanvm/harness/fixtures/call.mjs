// The smallest static call: a function of one rest parameter, called with a literal.
/** @type {(...a: readonly unknown[]) => unknown} */
const f = (...a) => a[0];
export default f(41);
