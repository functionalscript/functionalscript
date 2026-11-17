// An ignored argument still evaluates before any input conversion.
const value = { valueOf: () => { throw 'must not convert'; } };
const fail = () => { throw 'clz32 extra argument'; };
// @ts-expect-error — JavaScript evaluates the extra argument.
export default Math.clz32(value, fail());
