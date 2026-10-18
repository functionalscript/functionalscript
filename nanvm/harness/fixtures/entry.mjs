// The `entry` helper, the one read of a property named at run time, compiled
// as the EDAG's `['entry']` and run natively by `Any::entry`: an option — a
// one-element array holding an object's field, an array's or a string's
// element by the key once converted, and an empty array for anything else,
// a `length` or anything of a function — and a function like any other to
// read and to pass.
/** @type {(a: unknown, b: any) => readonly [unknown] | readonly []} */
export const entry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable ? [x.value] : [];
};
// The `hasEntry` helper beside it, compiled as `['hasEntry']` and run by
// `Any::has_entry`: the presence the option tells, as a boolean.
/** @type {(a: unknown, b: any) => boolean} */
export const hasEntry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable === true;
};
const o = { x: 1, length: 3, u: undefined };
export default [
    entry(o, "x"),
    entry(o, "length"),
    entry(o, "y"),
    entry(o, "u").length,
    entry([7, 8], 1),
    entry([7, 8], "1"),
    entry([7, 8], "01"),
    entry([7, 8], "length"),
    entry("ab", 0),
    entry("ab", "length"),
    entry(entry, "length"),
    entry.length,
    typeof entry,
    entry({ "1": 9 }, 1),
    entry({ "[object Object]": 5 }, {}),
    entry(5, "x"),
    [10, 20].map(entry),
    [...entry(o, "y"), 0][0],
    ["x", "y", "length"].flatMap(k => entry(o, k)),
    hasEntry(o, "x"),
    hasEntry(o, "u"),
    hasEntry(o, "y"),
    hasEntry([7, 8], 1),
    hasEntry([7, 8], "length"),
    hasEntry("ab", "1"),
    hasEntry(hasEntry, "length"),
    hasEntry.length,
    typeof hasEntry,
    hasEntry({ "1": 9 }, 1),
    hasEntry(5, "x"),
    [hasEntry(o, "z") ? 1 : 2, entry(o, "x")[0]],
];
