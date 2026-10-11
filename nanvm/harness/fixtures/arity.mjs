// `length` is the count of arguments a call supplied, whatever the function reads.
/** @type {(...a: readonly unknown[]) => unknown} */
const f = (...a) => a.length;
export default [f(), f(1, 2)];
