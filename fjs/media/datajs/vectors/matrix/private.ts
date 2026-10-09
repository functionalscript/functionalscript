/**
 * Implementation-private types of the class-by-role matrix: what a cell is,
 * decided once and then either rendered or counted.
 *
 * @module
 */

/**
 * One cell's answer: the role's sets have not landed, the ids the role has
 * for the class, or the index of the reason the corpus gives for having none.
 * An empty cell with no reason is not one of them; it is a defect.
 */
export type _Cell =
    | readonly ['awaiting']
    | readonly ['ids', readonly string[]]
    | readonly ['reason', number]
