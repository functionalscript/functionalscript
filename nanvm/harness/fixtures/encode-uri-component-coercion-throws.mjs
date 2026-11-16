// Neither own conversion method can produce a primitive string input.
const value = /** @type {const} */ ({ toString: 0, valueOf: 0 });
// @ts-expect-error — exercise JavaScript ToString beyond its declared input types.
export default encodeURIComponent(value);
