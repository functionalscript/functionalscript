// A property read on a nullish base throws when the module runs, as
// JavaScript throws: the compiler writes the program and predicts nothing.
const o = { a: null };
// @ts-expect-error: the throw is the point.
export default o.a.x;
