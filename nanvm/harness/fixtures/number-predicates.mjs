/**
 * Compiled by `fjs compile` into `../gen.fixtures/number_predicates.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`.
 */
// The four `Number` predicates, static functions: each over every kind of
// value, none converting its argument — `"1"` is no integer and `"NaN"` no
// `NaN` — and each one function on every read, destructured or not. The
// safe-integer bounds and the integers just past them are on both sides, so
// either of `isSafeInteger`'s comparisons can decide.
const { isInteger, isSafeInteger } = Number;
const values = [0, -0, 1, 1.5, 0x1f_ffff_ffff_ffff, 0x20_0000_0000_0000, -0x1f_ffff_ffff_ffff, -0x20_0000_0000_0000, NaN, Infinity, -Infinity, 1n, "1", "NaN", true, null, undefined, [], {}];
const read = () => Number.isFinite;
export default [
    values.map(v => isInteger(v)),
    values.map(v => isSafeInteger(v)),
    values.map(v => Number.isNaN(v)),
    values.map(v => Number?.isFinite(v)),
    [isInteger === Number.isInteger, read() === read(), typeof Number.isNaN, Number.isInteger.length],
];
