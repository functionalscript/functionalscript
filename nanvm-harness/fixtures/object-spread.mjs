/**
 * Compiled by `fjs compile` into `../gen.fixtures/object_spread.rs`,
 * committed and drift-checked by `npm run gen` (see `../../fjs/ci/README.md`).
 * Consumed by `../src/lib.rs`. Pins object spread (`spec/README.md`,
 * Object Spread) end to end, through `object_spread`: an object's own
 * properties copied in place, a later value winning at the earlier key's
 * position, an array's elements by index, a string's code units, and
 * nothing from `null`.
 */
const o = { a: 1, b: 2 };
export default [
    { ...o, c: 3 },
    // @ts-expect-error — the point is the key the spread overwrites.
    { b: 0, ...o },
    { ...o, a: 0 },
    { ...['p'], z: 0 },
    // @ts-expect-error — and the values TypeScript refuses to spread.
    { ...'a😀' },
    // @ts-expect-error — likewise.
    { ...null },
];
