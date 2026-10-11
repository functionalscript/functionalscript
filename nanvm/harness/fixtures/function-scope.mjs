// spec/README.md's own sharing example: `pair` is one array reached twice
// inside the function, bound once in the function's own scope, where `a` is.
/** @type {(...a: readonly unknown[]) => unknown} */
const f = (...a) => { const first = a[0]; const pair = [first, first]; return [pair, pair]; };
export default f(1);
