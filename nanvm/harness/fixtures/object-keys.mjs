/**
 * Compiled by `fjs compile` into `../gen.fixtures/object_keys.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs` and the cross-executor corpus.
 */
// The shared `Object.keys` body projects native entries through array map.
// Index keys come first in ascending order; the remaining own enumerable keys
// retain their order, including undefined values and an own `__proto__`.
// Strings expose UTF-16 indices, and scalars/functions expose no keys.
const { keys } = Object;
const source = /** @type {const} */ ({ b: 1, "10": 2, "2": 3, u: undefined, ["__proto__"]: 4, "01": 5, a: 6 });
const values = /** @type {const} */ ([source, [7, [8]], "a😀\ud800", "", 1, true, 1n, () => 0, {}, Object.keys]);
const read = () => Object.keys;
export default [
    values.map(v => keys(v)),
    values.map(keys),
    Object["keys"](source),
    Object.keys?.(source),
    keys({ ...source, b: 9, z: undefined }),
    keys({ constructor: 1, toString: 2, value: () => { throw 7; } }),
    [read() === read(), keys === Object.keys, keys === Object["keys"], typeof Object.keys, Object.keys.length, String(Object.keys)],
    [keys(source) === keys(source), keys([]) === keys([]), keys("") === keys("")],
    // @ts-expect-error — the built-in ignores an extra argument.
    keys(source, 1),
];
