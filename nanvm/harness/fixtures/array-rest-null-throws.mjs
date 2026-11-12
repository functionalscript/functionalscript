// A rest-only declaration still checks iterability when the tail is unused.
// @ts-expect-error — null is not iterable.
const [...unused] = null;
export default 7;
