/**
 * Compiled by `fjs compile` into `../gen.fixtures/closure_identity.rs`, committed and
 * drift-checked by `npm run gen` (see `../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`.
 */
// Closure identity: two closures made by one function are distinct while one
// binding read twice is the same; a captured object keeps its identity.
/** @type {(...a: readonly number[]) => () => number} */
const make = (...a) => () => a[0];
const f = make(1);
const g = make(1);
const o = { x: [1] };
/** @type {(...a: readonly (readonly number[])[]) => () => readonly number[]} */
const hold = (...a) => () => a[0];
const get = hold(o.x);
export default [f(), g(), f === g, f === f, get() === o.x, get() === get()];
