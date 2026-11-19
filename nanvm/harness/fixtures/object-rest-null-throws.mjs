// A rest-only declaration must reject null even when its result is unused.
// @ts-expect-error — null cannot supply an object-rest source.
const { ..._unused } = null;
export default 7;
