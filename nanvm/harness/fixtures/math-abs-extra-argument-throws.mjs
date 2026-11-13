// An ignored argument still has its expression evaluated before the call.
const fail = () => { throw 'abs extra argument'; };
// @ts-expect-error — JavaScript evaluates the extra argument.
export default Math.abs(-1.9, fail());
