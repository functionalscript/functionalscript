/** Generated common-runtime specialization. @module
 * @import { _StructEqStack } from '../../types/object/struct_eq/private.ts'
 * @import { Entry } from '../../types/object/types.ts'
 */

/** @type {(sameValue: (a: unknown, b: unknown) => boolean, entries: typeof Object.entries) => (a: unknown, b: unknown) => boolean} */
export const makeStructEq = (sameValue, entries) => (a, b) => {
    /** @type {_StructEqStack<unknown, Entry<unknown>>} */
    let pending = { tag: 'value', a, b, n: undefined }
    while (pending !== undefined) {
        /** @type {NonNullable<_StructEqStack<unknown, Entry<unknown>>>} */
        const frame = pending
        pending = frame.n
        if (frame.tag !== 'value') {
            const i = frame.i
            if (i === frame.a.length) { continue }
            /** @type {_StructEqStack<unknown, Entry<unknown>>} */
            const next = i + 1 === frame.a.length ? pending : { ...frame, i: i + 1 }
            if (frame.tag === 'array') {
                pending = { tag: 'value', a: frame.a[Number(i)], b: frame.b[Number(i)], n: next }
            } else {
                const left = frame.a[Number(i)]
                const right = frame.b[Number(i)]
                if (left[0] !== right[0]) { return false }
                pending = { tag: 'value', a: left[1], b: right[1], n: next }
            }
            continue
        }
        const x = frame.a
        const y = frame.b
        if (sameValue(x, y)) { continue }
        if (x === null || typeof x !== 'object' || y === null || typeof y !== 'object') { return false }
        if (x instanceof Array) {
            if (!(y instanceof Array) || x.length !== y.length) { return false }
            pending = { tag: 'array', a: x, b: y, i: 0, n: pending }
        } else {
            if (y instanceof Array) { return false }
            const left = entries(x)
            const right = entries(y)
            if (left.length !== right.length) { return false }
            pending = { tag: 'object', a: left, b: right, i: 0, n: pending }
        }
    }
    return true
}
