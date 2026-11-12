// A successful first conversion is followed by the second conversion.
const left = { valueOf: () => 3, toString: () => { throw 'must not use fallback'; } };
const right = { valueOf: () => { throw 'imul second conversion'; }, toString: () => '4' };
// @ts-expect-error — a second conversion failure propagates.
export default Math.imul(left, right);
