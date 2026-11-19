// A failing conversion propagates without trying the fallback hook.
const value = /** @type {const} */ ({ valueOf: () => { throw 'floor conversion'; }, toString: () => '1.9' });
// @ts-expect-error — exercise JavaScript ToNumber beyond its number signature.
export default Math.floor(value);
