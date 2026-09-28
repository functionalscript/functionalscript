/**
 * Compiled by `fjs compile` into `../gen.fixtures/at.rs`, committed and
 * drift-checked by `npm run gen` (see `../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins `at`, the first built-in member function of one
 * type (`nanvm-lib/todo/member-functions.md`): an array's element from the
 * start or the end, `undefined` out of range, the index converted as
 * `ToIntegerOrInfinity` converts it, and a missing argument element `0`.
 */
const a = [10, 20, 30];
export default [
    a.at(0),
    a.at(-1),
    a.at(3) === undefined,
    a.at(-4) === undefined,
    a.at(1.7),
    // @ts-expect-error — the point is the conversion TypeScript refuses.
    a.at("1"),
    // @ts-expect-error — and the argument it insists on.
    a.at(),
];
