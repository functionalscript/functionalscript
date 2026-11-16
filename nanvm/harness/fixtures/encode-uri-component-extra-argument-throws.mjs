// Unused arguments still run before the encoder is called.
const fail = () => { throw 'extra argument'; };
// @ts-expect-error — extra argument expressions must still be evaluated.
export default encodeURIComponent('x', fail());
