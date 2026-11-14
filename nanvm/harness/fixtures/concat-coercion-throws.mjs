// Conversion stops at the first failing argument in the common string body.
const first = /** @type {const} */ ({ toString: () => { throw 'first concat conversion'; } });
const second = /** @type {const} */ ({ toString: () => { throw 'second concat conversion'; } });
// @ts-expect-error — exercise JavaScript ToString beyond the string signature.
export default ''.concat(first, second);
