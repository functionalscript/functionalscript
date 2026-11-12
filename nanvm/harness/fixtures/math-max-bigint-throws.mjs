// NaN does not prevent the following operand's ToNumber conversion.
// @ts-expect-error — ToNumber rejects BigInt even after NaN.
export default Math.max(NaN, 1n);
