/**
 * Compiled by `fjs compile` into `../gen.fixtures/throw.rs`, committed and
 * drift-checked by `npm run gen` (see `../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins the language's own `throw` end to end: a function
 * whose block body ends in the statement fails with the value when called,
 * and the module, calling it at load, answers that value as its `Err` — as
 * `throws.mjs`'s failing operation does.
 */
/** @type {(...a: readonly unknown[]) => never} */
const fail = (...a) => { throw a[0]; };
export default fail(7);
