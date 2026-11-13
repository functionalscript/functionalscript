// Every argument expression evaluates before any operand is converted.
const value = { valueOf: () => { throw 'must not convert'; } };
const fail = () => { throw 'max argument expression'; };
// @ts-expect-error — argument expression failure precedes the conversion hook.
export default Math.max(value, fail());
