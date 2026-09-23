// Closures: a function captures what its body names from the scopes around
// it — an enclosing function's arguments, a module `const` — into its frame,
// and a function nested deeper captures through its parent.
/** @type {(...a: readonly number[]) => (...b: readonly number[]) => number} */
const add = (...a) => (...b) => a[0] + b[0];
const base = [10];
/** @type {(...a: readonly number[]) => number} */
const offset = (...a) => base[0] + a[0];
/** @type {(...a: readonly number[]) => (...b: readonly number[]) => (...c: readonly number[]) => readonly number[]} */
const three = (...a) => (...b) => (...c) => [a[0], b[0], c[0], a[0]];
export default [add(1)(2), offset(5), three(1)(2)(3)];
