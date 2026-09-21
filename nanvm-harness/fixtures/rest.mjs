// The whole arguments array, forwarded back out as the value.
/** @type {(...a: readonly unknown[]) => unknown} */
const f = (...a) => a;
export default f(1, 2, 3);
