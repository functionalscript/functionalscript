// Calling what is not a function throws, as JavaScript does.
const f = 1;
// @ts-expect-error: the call is the point.
export default f();
