// Every argument expression evaluates before the first operand is converted.
const left = { valueOf: () => { throw 'must not convert left'; } };
const fail = () => { throw 'imul extra argument'; };
// @ts-expect-error — JavaScript evaluates the extra argument.
export default Math.imul(left, 4, fail());
