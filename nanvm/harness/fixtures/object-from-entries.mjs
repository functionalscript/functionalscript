/**
 * Compiled by `fjs compile` into `../gen.fixtures/object_from_entries.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`.
 */
// `Object.fromEntries`, the static function whose body the runtime holds: a
// fresh object from an array of entries, a key written twice at its first
// position with its last value, index keys first, ascending, as every object
// orders them; each key converted to a string, a missing value `undefined`,
// `__proto__` an own key like any other, and an entry read by index, so an
// object with `"0"` and `"1"` is one; the inverse of `Object.entries`; read
// destructured or not, one function on every read, and every answer fresh;
// and its text, the NativeFunction syntax ECMA-262 requires of a built-in, the
// same on every executor. A non-object entry throws:
// `object-from-entries-throws.mjs`, and so does a value that is not an
// array: `object-from-entries-not-array-throws.mjs`.
const { fromEntries } = Object;
const read = () => Object.fromEntries;
export default [
    fromEntries([["b", 1], ["10", 2], ["2", 3], ["b", 4]]),
    fromEntries([]),
    fromEntries([[1, "number"], [true, "boolean"], [undefined, "undefined"], [null, "null"], [2n, "bigint"]]),
    fromEntries([["a"]]),
    Object.entries(fromEntries([["__proto__", 1]])),
    // @ts-expect-error — an entry that is an object, not an array.
    fromEntries([{ "0": "a", "1": 1 }]),
    fromEntries(Object.entries({ x: 1, y: [2] })),
    [["a", 1], ["b", 2]].map(e => fromEntries([e])),
    [read() === read(), fromEntries === Object.fromEntries, fromEntries === Object["fromEntries"], typeof Object.fromEntries, Object.fromEntries.length, String(Object.fromEntries)],
    fromEntries([]) === fromEntries([]),
];
