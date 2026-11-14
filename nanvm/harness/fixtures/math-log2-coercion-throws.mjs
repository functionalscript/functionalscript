// Conversion propagates the user's failure, without trying toString.
const value = /** @type {const} */ ({ valueOf: () => { throw 'log2 conversion'; }, toString: () => '8' });
// @ts-expect-error — exercise JavaScript ToNumber beyond its number signature.
export default Math.log2(value);
