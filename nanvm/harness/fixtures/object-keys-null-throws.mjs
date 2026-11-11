/**
 * Compiled and compared by the cross-executor corpus: a null input to the
 * shared `Object.keys` body throws before producing an array.
 */
// @ts-expect-error — null is not an input Object.keys can enumerate.
export default Object.keys(null);
