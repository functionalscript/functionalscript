/**
 * Compiled by `fjs compile` into `../gen.fixtures/object_is.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`.
 */
// `Object.is`, the one static function: one function on every read, at the
// module's level and in two invocations of a function that reads it, and
// SameValue when called, `0` and `-0` apart and `NaN` itself.
const read = () => Object.is;
const { is } = Object;
export default [read() === read(), Object.is === Object.is, read() === is, is(0, -0), Object.is(NaN, NaN), typeof Object.is];
