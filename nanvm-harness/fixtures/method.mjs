/**
 * Compiled by `fjs compile` into the sibling `method.rs`, committed and
 * drift-checked by `npm run gen` (see `../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins the method call, `['.', o, 'f', ['|()', args]]`
 * (`fjs/edag/README.md`, Chains): the read and the call are one node, so
 * the property is called on its receiver — `Any::dot(…).end_call(…)`, one
 * expression, the arguments a thunk the read's own throw would leave
 * untouched.
 */
/** @type {(...a: readonly unknown[]) => unknown} */
const f = (...a) => a[0];
const o = { f: f };
export default o.f(42);
