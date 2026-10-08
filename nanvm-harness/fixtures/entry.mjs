// The `entry` helper, the one read of a property named at run time, compiled
// as the EDAG's `['entry']` and run natively by `Any::entry`: an object's
// field, an array's or a string's element by the key once converted, nothing
// of a function, and a function like any other to read and to pass.
/** @type {(a: unknown, b: any) => unknown} */
const entry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable ? x.value : undefined;
};
const o = { x: 1, length: 3 };
export default [
    entry(o, "x"),
    entry(o, "length"),
    entry(o, "y") === undefined,
    entry([7, 8], 1),
    entry([7, 8], "1"),
    entry([7, 8], "01") === undefined,
    entry([7, 8], "length") === undefined,
    entry("ab", 0),
    entry("ab", "length") === undefined,
    entry(entry, "length") === undefined,
    entry.length,
    typeof entry,
    entry({ "1": 9 }, 1),
    entry({ "[object Object]": 5 }, {}),
    entry(5, "x") === undefined,
    [10, 20].map(entry)[1] === undefined,
];
