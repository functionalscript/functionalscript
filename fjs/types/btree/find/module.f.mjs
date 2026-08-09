/**
 * Lookup operations for persistent B-tree structures.
 *
 * @module
 */
/** @import { Leaf1, Leaf2, Branch3, Branch5, TNode } from '../types/module.f.mjs' */
/** @import { List } from '../../list/module.f.mjs' */

import { index3, index5 } from '../../function/compare/module.f.mjs'
/** @import { Compare } from '../../function/compare/module.f.mjs' */

/** @import { KeyOf, Index } from '../../array/module.f.mjs' */

/**
 * @template T
 * @typedef {readonly[Index<3>, Leaf1<T>]} _FirstLeaf1
 */

/**
 * @template T
 * @typedef {readonly[1, Branch3<T>]} _FirstBranch3
 */

/**
 * @template T
 * @typedef {readonly[Index<5>, Leaf2<T>]} _FirstLeaf2
 */

/**
 * @template T
 * @typedef {readonly[1|3, Branch5<T>]} _FirstBranch5
 */

/**
 * @template T
 * @typedef {_FirstLeaf1<T> | _FirstBranch3<T> | _FirstLeaf2<T> | _FirstBranch5<T>} First
 */

/**
 * @template T
 * @typedef {readonly[0|2, Branch3<T>]} _PathItem3
 */

/**
 * @template T
 * @typedef {readonly[0|2|4, Branch5<T>]} _PathItem5
 */

/**
 * @template T
 * @typedef {_PathItem3<T> | _PathItem5<T>} PathItem
 */

/** @type {<T>(item: PathItem<T>) => TNode<T>} */
const child = item => {
    /** @typedef {typeof item extends PathItem<infer T> ? T : never} T */
    return /** @type {TNode<T>} */ (item[1][item[0]])
}

/**
 * @template T
 * @typedef {List<PathItem<T>>} Path
 */

/**
 * @template T
 * @typedef {{
 *   readonly first: First<T>,
 *   readonly tail: Path<T>
 * }} Result
 */

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
