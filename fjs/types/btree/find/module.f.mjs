/**
 * Lookup operations for persistent B-tree structures.
 *
 * @module
 *
 * @import { TNode, Tree } from '../types/types.ts'
 * @import { Compare } from '../../function/compare/types.ts'
 * @import { First, Path, PathItem, Result } from './types.ts'
 */

import { index3, index5 } from '../../function/compare/module.f.js'

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
                // `index3` asserts `i` is 0, 1 or 2
                switch (i) {
                    case 0: case 2: { return append([i, node])(node[i]) }
                    default: { return done([i, node]) }
                }
            }
            case 5: {
                const i = i5([node[1], node[3]])
                // `index5` asserts `i` is 0 to 4
                switch (i) {
                    case 0: case 2: case 4: { return append([i, node])(node[i]) }
                    default: { return done([i, node]) }
                }
            }
            default: { throw ['not a B-tree node', node] }
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

/**
 * The stored value `c` matches in a possibly empty tree, or `null` when there
 * is none.
 *
 * @type {<T>(c: Compare<T>) => (tree: Tree<T>) => T | null}
 */
export const findValue = c => {
    const f = find(c)
    return tree => tree === null ? null : value(f(tree).first)
}

/**
 * Whether a possibly empty tree holds a value `c` matches.
 *
 * @type {<T>(c: Compare<T>) => (tree: Tree<T>) => boolean}
 */
export const contains = c => {
    const f = find(c)
    return tree => tree !== null && isFound(f(tree).first)
}
