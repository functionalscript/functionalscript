// A function's one property: its `length`, `0` for a rest parameter as for none.
/** @type {(...a: readonly unknown[]) => unknown} */
const f = (...a) => a;
export default f.length;
