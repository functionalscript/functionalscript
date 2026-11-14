/** A null input makes the shared entries enumerator throw. */
// @ts-expect-error — null is not an input Object.values can enumerate.
export default Object.values(null);
