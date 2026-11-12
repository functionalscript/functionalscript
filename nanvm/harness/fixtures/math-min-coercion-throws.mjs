// Conversion proceeds in argument order and stops at the first failure.
const first = { valueOf: () => { throw 'min first conversion'; }, toString: () => '3' };
const second = { valueOf: () => { throw 'must not convert second'; } };
// @ts-expect-error — exercise ToNumber beyond its number signature.
export default Math.min(first, second);
