/**
 * Compiled by `fjs compile` into `../gen.fixtures/number_predicates.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`.
 */
// The four `Number` predicates, static functions: each over every kind of
// value, none converting its argument — `"1"` is no integer and `"NaN"` no
// `NaN` — and each one function on every read, destructured or not.
const { isInteger, isSafeInteger } = Number;
const values = [0, -0, 1, 1.5, 9007199254740991, 9007199254740992, NaN, Infinity, -Infinity, 1n, "1", "NaN", true, null, undefined, [], {}];
const read = () => Number.isFinite;
export default [
    values.map(v => isInteger(v)),
    values.map(v => isSafeInteger(v)),
    values.map(v => Number.isNaN(v)),
    values.map(v => Number?.isFinite(v)),
    [isInteger === Number.isInteger, read() === read(), typeof Number.isNaN, Number.isInteger.length],
];
