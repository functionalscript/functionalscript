// An ignored argument still has its expression evaluated before the call.
const fail = () => { throw 'floor extra argument'; };
// @ts-expect-error — JavaScript evaluates the extra argument.
export default Math.floor(1.9, fail());
