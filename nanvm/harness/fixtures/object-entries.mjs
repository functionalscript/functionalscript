/**
 * Compiled by `fjs compile` into `../gen.fixtures/object_entries.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`.
 */
// `Object.entries`, the static function no body defines, which every executor
// binds natively: an object's entries in JavaScript's own-key order — index
// keys first, ascending, and a key written twice at its first position with
// its last value, an `undefined` one listed — an array's elements and a
// string's code units under their index strings, and nothing for a number, a
// boolean, a `bigint` or a function; passed as a callback, read destructured
// or not, one function on every read, and every answer fresh; and its text,
// the NativeFunction syntax ECMA-262 requires of a built-in, the same on
// every executor. A nullish receiver throws: `object-entries-throws.mjs`.
const { entries } = Object;
// @ts-expect-error — the point is the key written twice.
const values = [{ b: 1, "10": 2, "2": 3, b: 4, u: undefined }, [7, [8]], "a😀", "", 1, true, 1n, () => 0, {}];
const read = () => Object.entries;
const o = { a: 1 };
export default [
    values.map(v => entries(v)),
    values.map(entries),
    [read() === read(), entries === Object.entries, entries === Object?.["entries"], typeof Object.entries, Object.entries.length, String(Object.entries)],
    [entries(o) === entries(o), entries(o)[0] === entries(o)[0]],
];
