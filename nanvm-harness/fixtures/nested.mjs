// A function returning a function, the inner one called with its own arguments.
/** @type {(...a: readonly unknown[]) => (...b: readonly unknown[]) => unknown} */
const f = (...a) => (...b) => b;
export default f(1)(2, 3);
