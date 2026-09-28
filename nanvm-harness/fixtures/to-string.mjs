/**
 * Compiled by `fjs compile` into `../gen.fixtures/to_string.rs`, committed and
 * drift-checked by `npm run gen` (see `../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins the first built-in member function, `toString`, as
 * a method call on every type that owns no property of the name — a
 * number, a boolean, a string, a bigint, an array and an object — and an
 * own `toString` shadowing it (`nanvm-lib/todo/member-functions.md`). A
 * function's `toString` is a stub and is left out.
 */
/** @type {(...a: readonly unknown[]) => unknown} */
const own = (...a) => "own";
const shadowed = { toString: own };
export default [
    (1.5).toString(),
    true.toString(),
    "ab".toString(),
    (5n).toString(),
    [1, "b"].toString(),
    ({}).toString(),
    shadowed.toString(),
];
