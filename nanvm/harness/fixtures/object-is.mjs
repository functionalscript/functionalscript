/**
 * Compiled by `fjs compile` into `../gen.fixtures/object_is.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`.
 */
// `Object.is`, a static function: one function on every read, at the
// module's level and in two invocations of a function that reads it;
// SameValue when called, `0` and `-0` apart and `NaN` itself; and its
// text the NativeFunction syntax ECMA-262 requires of a built-in, its
// name's and never its body's, the same on every executor.
const read = () => Object.is;
const { is } = Object;
export default [read() === read(), Object.is === Object.is, read() === is, is(0, -0), Object.is(NaN, NaN), typeof Object.is, String(Object.is), String(is), `${read()}`];
