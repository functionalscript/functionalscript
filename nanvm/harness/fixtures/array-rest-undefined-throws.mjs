// An unused parameter tail still requires an iterable argument.
/** @type {(source: readonly unknown[]) => number} */
const ignore = ([...unused]) => 7;
// @ts-expect-error — undefined is not iterable.
export default ignore(undefined);
