// Propagate a user conversion's thrown value before converting later arguments.
const first = { valueOf: () => { throw 'first'; } };
const second = { valueOf: () => { throw 'second'; } };
// @ts-expect-error — exercise JavaScript ToNumber beyond the TypeScript number signature.
export default String.fromCharCode(65, first, second);
