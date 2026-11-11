/**
 * Compiled and compared by the cross-executor corpus: omitting Object.keys'
 * argument has the same failure as passing undefined.
 */
// @ts-expect-error — the built-in requires an argument.
export default Object.keys();
