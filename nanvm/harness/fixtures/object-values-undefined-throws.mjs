/** An undefined input makes the shared entries enumerator throw. */
// @ts-expect-error — undefined is not an input Object.values can enumerate.
export default Object.values(undefined);
