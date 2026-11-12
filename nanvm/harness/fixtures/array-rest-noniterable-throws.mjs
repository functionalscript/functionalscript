// An array-like object is not an iterable; skipping a prefix changes nothing.
const source = { 0: 1, length: 1 };
// @ts-expect-error — the object has no iterator.
const [, ..._unused] = source;
export default 7;
