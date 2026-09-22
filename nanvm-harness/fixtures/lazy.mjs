/**
 * Compiled by `fjs compile` into the sibling `lazy.rs`, committed and
 * drift-checked by `npm run gen` (see `../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins the four lazy operators end to end, each in a
 * module the grammar produces: a conditionally established operand is the
 * thunk `nanvm-lib` takes, so the operand a `&&`, `||` or `??` never
 * reaches, and the arm a `?:` does not select, is never run — each of them
 * here `1n / 0n`, which throws when it is.
 *
 * Each deciding value is read out of a literal rather than written bare:
 * `tsc` sees through a literal condition and reports it as the mistake it
 * would be in a program, while a read it does not fold says what the
 * module means and reaches the VM as the same value.
 */
const t = [1].length;
const f = [].length;
const n = [null, 1][0];
const u = [undefined, 1][0];
const e = ["", "x"][0];
const z = [0, null][0];
const b = [false, null][0];
export default [
    f && 1n / 0n, t && 2, n && 1n / 0n,
    t || 1n / 0n, f || 3, e || "x",
    z ?? 1n / 0n, n ?? 4, u ?? 5, b ?? 6,
    t ? 7 : 1n / 0n, f ? 1n / 0n : 8,
    t && 2 || 3, n ?? f ? 9 : 10, f ? 1 : t ? 11 : 12,
];
