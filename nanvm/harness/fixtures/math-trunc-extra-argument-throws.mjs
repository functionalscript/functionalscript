// An ignored argument still has its expression evaluated before the call.
const fail = () => { throw 'trunc extra argument'; };
// @ts-expect-error — JavaScript evaluates the extra argument.
export default Math.trunc(1.9, fail());
