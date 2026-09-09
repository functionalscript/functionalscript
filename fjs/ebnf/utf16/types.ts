/**
 * Type-level API of the UTF-16 alphabet: the metadata of a code unit.
 *
 * @module
 */

/**
 * The metadata of a code unit with nothing the grammar ignored about it —
 * the alphabet's `id` and nothing else. A caller that knows more about a
 * unit, its position say, hands over a record carrying this `id` beside
 * it, and a parser over this alphabet accepts it as it is.
 */
export type Utf16 = { readonly id: 'utf16' }
