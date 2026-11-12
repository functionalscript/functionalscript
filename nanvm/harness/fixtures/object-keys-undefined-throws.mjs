/**
 * Compiled and compared by the cross-executor corpus: an undefined input to
 * the shared `Object.keys` body throws before producing an array.
 */
// @ts-expect-error — undefined is not an input Object.keys can enumerate.
export default Object.keys(undefined);
