// A read past the arguments supplied is `undefined`, never a panic.
/** @type {(...a: readonly unknown[]) => unknown} */
const f = (...a) => a[1];
export default f(41);
