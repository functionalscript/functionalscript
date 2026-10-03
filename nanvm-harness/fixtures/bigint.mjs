/**
 * Compiled by `fjs compile` into `../gen.fixtures/bigint.rs`, committed and
 * drift-checked by `npm run gen` (see `../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins a bigint literal at and past the end of `i64`, which
 * the generated module spells as `bigint_any` and as `bigint_any_words`.
 */
export default [
    9223372036854775807n, -9223372036854775808n,
    9223372036854775808n, -9223372036854775809n,
    0xFFFFFFFFFFFFFFFFFn, 123456789012345678901234567890n,
];
