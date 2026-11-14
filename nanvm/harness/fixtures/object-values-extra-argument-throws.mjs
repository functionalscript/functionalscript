/** The extra argument throws before enumeration can reject the null input. */
const fail = () => { throw 'extra argument'; };
// @ts-expect-error — the built-in ignores an extra argument after evaluating it.
export default Object.values(null, fail());
