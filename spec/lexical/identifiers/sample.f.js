/**
 * The example of [`README.md`](./README.md) (Identifiers) as a function of
 * one number, for the page's WASM demo: ASCII names with `_` and `$`, and
 * reserved words as keys.
 *
 * @module
 */

const _x = 1;
const $0 = 2;
const a_$1 = { if: 3, default: 4 };
/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => [_x + a[0], $0, a_$1.if, a_$1.default];
