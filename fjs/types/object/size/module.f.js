/**
 * The size of a value as a tree: how many nodes it has.
 *
 * A proof that bounds how fast a structure grows needs one number for a
 * whole value. The length of its JSON text was that number, and depended on
 * how each leaf is spelled; this counts the structure and nothing else.
 *
 * @module
 */

/**
 * One for `value` itself, and the size of each item of an array or each
 * member of an object. A value shared between two places is counted at
 * both, as text would write it twice.
 *
 * @type {(value: unknown) => number}
 */
export const size = value => {
    /** @type {(sum: number, item: unknown) => number} */
    const add = (sum, item) => sum + size(item)
    return value instanceof Array ? value.reduce(add, 1)
        : typeof value === 'object' && value !== null ? Object.values(value).reduce(add, 1)
        : 1
}
