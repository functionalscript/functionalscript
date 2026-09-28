/**
 * Lookup operations for persistent B-tree structures.
 *
 * @module
 *
 * @import { TNode } from '../types/types.ts'
 * @import { Compare } from '../../function/compare/types.ts'
 * @import { First, Path, PathItem, Result } from './types.ts'
 */

import { index3, index5 } from '../../function/compare/module.f.mjs'

/** @type {<T>(c: Compare<T>) => (node: TNode<T>) => Result<T>} */
export const find = c => {
    /** @typedef {typeof c extends Compare<infer T> ? T : never} T */
    const i3 = index3(c)
    const i5 = index5(c)
    /** @type {(tail: Path<T>) => (node: TNode<T>) => Result<T>} */
    const f = tail => node => {
        /** @type {(first: PathItem<T>) => (child: TNode<T>) => Result<T>} */
        const append = first => f({ first, tail })
        /** @type {(first: First<T>) => Result<T>} */
        const done = first => ({ first, tail })
        switch (node.length) {
            case 1: { return done([i3(node[0]), node]) }
            case 2: { return done([i5(node), node]) }
            case 3: {
                const i = i3(node[1])
                switch (i) {
                    case 0: case 2: { return append([i, node])(node[i]) }
                    case 1: { return done([i, node]) }
                }
            }
            case 5: {
                const i = i5([node[1], node[3]])
                switch (i) {
                    case 0: case 2: case 4: { return append([i, node])(node[i]) }
                    case 1: case 3: { return done([i, node]) }
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
