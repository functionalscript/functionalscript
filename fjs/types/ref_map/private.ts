/**
 * Implementation types of the reference map.
 *
 * @module
 */

/**
 * A node of the trie a reference map keeps its values in: the value of the
 * id whose path ends here, and the nodes one more bit along, `0` and `1`.
 */
export type _RefMapNode = {
    readonly value: unknown
    readonly zero: _RefMapNode
    readonly one: _RefMapNode
} | undefined
