/**
 * Compiled by `fjs compile` into `../gen.fixtures/guarded_calls.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins a guarded call of a built-in: `a?.at(0)` and `a.at?.(0)` on an array that has the member, and the same chains on a nullish base, which skip the call. `undefined` has no JSON, so each skipped chain is read through `??`.
 */
const a = [10, 20];
const n = /** @type {readonly number[] | undefined} */ (/** @type {unknown} */ (undefined));
/** @type {{ readonly s?: string }} */
const o = {};
export default [
    a?.at(0),
    a.at?.(1),
    n?.at(0) ?? 0,
    n?.map(x => x)?.at(0) ?? 0,
    o.s?.endsWith("x") ?? 0,
    "abc"?.startsWith("a"),
];
