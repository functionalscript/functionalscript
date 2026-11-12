// Every argument expression evaluates before any operand is converted.
const value = { valueOf: () => { throw 'must not convert'; } };
const fail = () => { throw 'min argument expression'; };
// @ts-expect-error — argument expression failure precedes the conversion hook.
export default Math.min(value, fail());
