/**
 * Lookup operations for persistent B-tree structures.
 *
 * @module
 */
/** @import { TNode } from '../types/types.ts' */

import { index3, index5 } from '../../function/compare/module.f.mjs'
/** @import { Compare } from '../../function/compare/types.ts' */

/** @import { KeyOf } from '../../array/types.ts' */
/** @import { First, Path, PathItem, Result } from './types.ts' */

/** @type {<T>(item: PathItem<T>) => TNode<T>} */
const child = item => {
    /** @typedef {typeof item extends PathItem<infer T> ? T : never} T */
    return /** @type {TNode<T>} */ (item[1][item[0]])
}

/** @type {<T>(c: Compare<T>) => (node: TNode<T>) => Result<T>} */
export const find = c => {
    /** @typedef {typeof c extends Compare<infer T> ? T : never} T */
    const i3 = index3(c)
    const i5 = index5(c)
    /** @type {(tail: Path<T>) => (node: TNode<T>) => Result<T>} */
    const f = tail => node => {
        /** @type {(index: KeyOf<typeof node>) => Result<T>} */
        const append = index => {
            const first = /** @type {PathItem<T>} */ ([index, node])
            return f({ first, tail })(child(first))
        }
        /** @type {(index: KeyOf<typeof node>) => Result<T>} */
        const done = index => ({ first: /** @type {First<T>} */ ([index, node]), tail })
        switch (node.length) {
            case 1: { return done(i3(node[0])) }
            case 2: { return done(i5(node)) }
            case 3: {
                const i = i3(node[1])
                switch (i) {
                    case 0: case 2: { return append(i) }
                    case 1: { return done(i) }
                }
            }
            case 5: {
                const i = i5([node[1], node[3]])
                switch (i) {
                    case 0: case 2: case 4: { return append(i) }
                    case 1: case 3: { return done(i) }
                }
            }
        }
    }
    return f(null)
}

/** @type {<T>(first: First<T>) => boolean} */
export const isFound = ([i]) => {
    switch (i) {
        case 1: case 3: { return true }
        default: { return false }
    }
}

/** @type {<T>(first: First<T>) => T | null} */
export const value = ([i, r]) => {
    switch (i) {
        case 1: {
            switch (r.length) {
                case 1: case 2: { return r[0] }
                default: { return r[1] }
            }
        }
        case 3: {
            return r.length === 2 ? r[1] : r[3]
        }
        default: {
            return null
        }
    }
}
