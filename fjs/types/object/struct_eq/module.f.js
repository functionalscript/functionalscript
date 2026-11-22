/** Ordered equality for FunctionalScript values. @module */

/** @type {(a: unknown, b: unknown) => boolean} */
export const structEq = (a, b) => {
    /** @type {import('../../stack_walk/types.ts').Stack<readonly [unknown, unknown]>} */
    let pending = { top: [a, b], rest: null }
    while (pending !== null) {
        const x = pending.top[0]
        const y = pending.top[1]
        pending = pending.rest
        if (Object.is(x, y)) { continue }
        if (x === null || typeof x !== 'object' || y === null || typeof y !== 'object') { return false }
        if ((x instanceof Array) !== (y instanceof Array)) { return false }
        // A record's entries are ordered [key, value] pairs. The same array
        // walk checks each key before its value.
        const left = x instanceof Array ? x : Object.entries(x)
        const right = y instanceof Array ? y : Object.entries(y)
        if (left.length !== right.length) { return false }
        // Push siblings in reverse so the first one is visited next.
        let i = left.length
        while (i > 0) {
            i -= 1
            pending = { top: [left[Number(i)], right[Number(i)]], rest: pending }
        }
    }
    return true
}
