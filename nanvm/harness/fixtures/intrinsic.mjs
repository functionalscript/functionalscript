/**
 * Compiled by `fjs compile` into `../gen.fixtures/intrinsic.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`.
 */
// An intrinsic's helper, `slice`, compiled as `['slice']` and run as the
// library's call step on its first argument: the member call `s.slice(a, b)`
// with no runtime — a string's substring, positions clamped and a negative one
// from the end; an array's slice; an own property first — a function of
// `length` 3, fresh where it is written, as every arrow is. Its text, the
// helper's one spelling on every executor but the host, which keeps the
// source's, is pinned where the executors print it. A receiver without the
// member throws: `intrinsic-throws.mjs`. The second intrinsic, `charCodeAt`,
// is the code unit at the position, `NaN` outside the string.
/** @type {(s: string, start?: number, end?: number) => string} */
const slice = (s, start, end) => s.slice(start, end);
/** @type {(s: unknown, start: unknown, end: unknown) => unknown} */
const any = /** @type {(s: unknown, start: unknown, end: unknown) => unknown} */ (/** @type {unknown} */ (slice));
/** @type {(s: string, a?: number, b?: number) => string} */
const again = (s, a, b) => s.slice(a, b);
/** @type {(s: string, at: number) => number} */
const charCodeAt = (s, at) => s.charCodeAt(at);
export default [
    slice("abcdef", 1, 3),
    slice("abcdef", 2),
    slice("abcdef"),
    slice("abcdef", -2),
    slice("abcdef", 4, 2),
    slice("abcdef", 0, 100),
    slice("", 0, 1),
    any([7, 8, 9], 1, 2),
    any({ slice: () => "own" }, 0, 1),
    slice.length,
    typeof slice,
    slice === again,
    [slice, again].map(f => f("xyz", 1)),
    charCodeAt("abc", 1),
    Number.isNaN(charCodeAt("abc", 3)),
    charCodeAt("\uD83D\uDE00", 1),
    charCodeAt.length,
];
