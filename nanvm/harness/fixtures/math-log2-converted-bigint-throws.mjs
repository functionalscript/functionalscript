// ToPrimitive may produce BigInt; the subsequent ToNumber still rejects it.
const value = { valueOf: () => 8n };
// @ts-expect-error — exercise JavaScript ToNumber beyond its number signature.
export default Math.log2(value);
