/**
 * Type-level API of the byte alphabet: the metadata of a byte.
 *
 * @module
 */

/**
 * The metadata of a byte with nothing the grammar ignored about it — the
 * alphabet's `id` and nothing else. A caller that knows more about a byte,
 * its offset say, hands over a record carrying this `id` beside it, and a
 * parser over this alphabet accepts it as it is.
 */
export type Byte = { readonly id: 'byte' }
