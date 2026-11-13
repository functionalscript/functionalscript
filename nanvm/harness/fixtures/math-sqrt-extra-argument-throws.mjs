// An ignored argument still evaluates before any input conversion.
const value = { valueOf: () => { throw 'must not convert'; } };
const fail = () => { throw 'sqrt extra argument'; };
// @ts-expect-error — JavaScript evaluates the extra argument.
export default Math.sqrt(value, fail());
