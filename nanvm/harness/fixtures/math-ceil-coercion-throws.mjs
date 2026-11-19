// A failing conversion propagates without trying the fallback hook.
const value = { valueOf: () => { throw 'ceil conversion'; }, toString: () => '4' };
// @ts-expect-error — exercise JavaScript ToNumber beyond its number signature.
export default Math.ceil(value);
