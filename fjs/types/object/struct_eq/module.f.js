/** Ordered equality for FunctionalScript values. @module */

/** @type {(a: unknown, b: unknown) => boolean} */
export const structEq = (a, b) => {
    if (Object.is(a, b)) { return true }
    if (a === null || typeof a !== 'object' || b === null || typeof b !== 'object') { return false }
    if (a instanceof Array) {
        return b instanceof Array && a.length === b.length
            && a.every((value, i) => structEq(value, b[Number(i)]))
    }
    if (b instanceof Array) { return false }
    const left = Object.entries(a)
    const right = Object.entries(b)
    return left.length === right.length && left.every((item, i) => {
        const other = right[Number(i)]
        return item[0] === other[0] && structEq(item[1], other[1])
    })
}
