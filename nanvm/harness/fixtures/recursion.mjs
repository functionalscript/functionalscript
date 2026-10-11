// A function that names itself: a `const`'s name read in the function that
// is its whole value is the function, `['self']` in the EDAG — one identity
// however often it is read — so it can call itself, and a function nested
// in it captures the name into its frame as it captures any other value.
/** @type {(n: number) => number} */
const fact = n => n < 2 ? 1 : n * fact(n - 1);
/** @type {() => boolean} */
const same = () => same === same;
/** @type {(n: number) => () => number} */
const nested = n => () => n < 1 ? 0 : nested(n - 1)() + 1;
export default [fact(5), same(), nested(3)()];
