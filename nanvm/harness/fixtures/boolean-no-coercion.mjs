/**
 * Truthiness never converts an object to a primitive, even when its own
 * conversion methods would fail. Arrays and functions stay truthy too.
 */
const fail = () => { throw "Boolean must not coerce"; };
const object = /** @type {const} */ ({ valueOf: fail, toString: fail });
const array = /** @type {const} */ ([object]);
const fn = () => object;

export default [Boolean(object), Boolean(array), Boolean(fn), Boolean({ valueOf: () => 0, toString: () => "" })];
