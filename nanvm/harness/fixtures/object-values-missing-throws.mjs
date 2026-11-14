/** Omitting the argument fails as explicitly passing undefined does. */
// @ts-expect-error — the built-in requires an argument.
export default Object.values();
