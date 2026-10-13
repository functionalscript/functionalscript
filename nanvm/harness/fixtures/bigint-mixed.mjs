/**
 * Compiled by `fjs compile` into `../gen.fixtures/bigint_mixed.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins the mixed-type failure: an arithmetic operator on a
 * bigint and a number throws a `TypeError` in JavaScript, and the compiled
 * module answers it as its `Err`, like `throws.mjs`, whose failure is a division
 * by zero. The operands are operations, so no literal pair is folded.
 */
const n = 2n * 3n;
const m = 2 * 3;
// @ts-expect-error — the point is the mix TypeScript refuses.
export default n + m;
