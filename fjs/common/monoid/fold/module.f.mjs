/**
 * @module
 *
 * @import { Sized, Fold } from './types.ts'
 */

/** @type {<T>(sized: Sized<T>) => Fold<T>}*/
export const fold = ({ size, monoid: { identity, operation } }) => ({
    push: (first, tail) => {
        while (tail !== null && size(tail.first) >= size(first)) {
            first = operation(tail.first)(first)
            tail = tail.tail
        }
        return { first, tail }
    },
    result: tail => {
        let first = identity
        while (tail !== null) {
            first = operation(tail.first)(first)
            tail = tail.tail
        }
        return first
    }
})
