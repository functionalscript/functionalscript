// Required prefix destructuring must execute even when no binding is read.
// @ts-expect-error — the first element is not iterable.
const [[unused], ...tail] = [null];
export default 7;
