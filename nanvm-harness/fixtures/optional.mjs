/**
 * Compiled by `fjs compile` into `../gen.fixtures/optional.rs`, committed
 * and drift-checked by `npm run gen` (see `../../fjs/ci/README.md`).
 * Consumed by `../src/lib.rs`. Pins the optional chains of
 * `fjs/edag/README.md`'s Chains as the VM runs them: a guarded access and
 * its steps skipped on a nullish base, `Any::option_dot(…).dot(…)`, a
 * guarded call on a property reference, `Any::dot(…).option_call(…)`, a
 * guarded call on a nullish callee, and a group ending the region, two
 * nodes where `a?.b.c` is one.
 */
/** @type {(...a: readonly unknown[]) => unknown} */
const f = (...a) => a[0];
const o = { a: { b: 1 }, f: f };
/** @type {{ readonly a?: { readonly b: number }, readonly f?: (...a: readonly unknown[]) => unknown }} */
const n = {};
// `undefined`, the answer of a skipped chain, has no JSON, so each one is
// read through `??` as `0` for the harness to print.
export default [o?.a.b, n.a?.b ?? 0, n?.a?.b ?? 0, o.f?.(2), n.f?.(3) ?? 0, (o?.a).b];
