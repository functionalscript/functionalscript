/**
 * Insertion and update operations for persistent B-tree structures.
 *
 * @module
 *
 * @import { Branch1, Branch3, Branch5, Branch7, TNode, Tree } from '../types/types.ts'
 * @import { First, PathItem, Result } from '../find/types.ts'
 * @import { Compare } from '../../function/compare/types.ts'
 */

import { collapseRoot } from '../types/module.f.mjs'
import { find } from '../find/module.f.mjs'
import { fold } from '../../list/module.f.mjs'
import { assert } from '../../../asserts/module.f.mjs'

/** @type {<T>(b: Branch5<T> | Branch7<T>) => Branch1<T> | Branch3<T>} */
const b57 = b => b.length === 5 ? [b] : [[b[0], b[1], b[2]], b[3], [b[4], b[5], b[6]]]

/** @type {<T>(i: PathItem<T>) => (a: Branch1<T> | Branch3<T>) => Branch1<T> | Branch3<T>} */
const reduceOp = ([i, x]) => a => {
    switch (i) {
        case 0: {
            switch (x.length) {
                case 3: { return [[...a, x[1], x[2]]] }
                case 5: { return b57([...a, x[1], x[2], x[3], x[4]]) }
            }
        }
        case 2: {
            switch (x.length) {
                case 3: { return [[x[0], x[1], ...a]] }
                case 5: { return b57([x[0], x[1], ...a, x[3], x[4]]) }
            }
        }
        case 4: {
            return b57([x[0], x[1], x[2], x[3], ...a])
        }
    }
}

const reduceBranch = fold(reduceOp)

/** @type {<T>(c: Compare<T>) => (g: (value: T | null) => T) => (node: TNode<T>) => TNode<T>} */
const nodeSet = c => g => node => {
    /** @typedef {typeof c extends Compare<infer T> ? T : never} T */
    // Result<T> is { readonly first: First<T>, readonly tail: Path<T> }.
    /** @type {Result<T>} */
    const { first, tail } = find(c)(node)
    // First<T> is one of:
    //   readonly[Index<3>, Leaf1<T>]
    //   readonly[1, Branch3<T>]
    //   readonly[Index<5>, Leaf2<T>]
    //   readonly[1|3, Branch5<T>]
    /** @type {First<T>} */
    const [i, x] = first
    /** @type {() => Branch1<T> | Branch3<T>} */
    const f = () => {
        switch (i) {
            case 0: {
                // insert
                const value = g(null)
                switch (x.length) {
                    case 1: { return [[value, x[0]]] }
                    case 2: { return [[value], x[0], [x[1]]] }
                }
            }
            case 1: {
                // replace
                switch (x.length) {
                    case 1: { return [[g(x[0])]] }
                    case 2: { return [[g(x[0]), x[1]]] }
                    case 3: { return [[x[0], g(x[1]), x[2]]] }
                    case 5: { return [[x[0], g(x[1]), x[2], x[3], x[4]]] }
                }
            }
            case 2: {
                // insert
                const value = g(null)
                // TODO: remove after TSGO fix the regression.
                const xL = x.length
                // See https://github.com/microsoft/typescript-go/issues/4613
                assert(xL === 1 || xL === 2)
                switch (xL) {
                    case 1: { return [[x[0], value]] }
                    case 2: { return [[x[0]], value, [x[1]]] }
                }
            }
            case 3: {
                // replace
                // TODO: remove after TSGO fix the regression.
                const xL = x.length
                // See https://github.com/microsoft/typescript-go/issues/4613
                assert(xL === 2 || xL === 5)
                switch (xL) {
                    case 2: { return [[x[0], g(x[1])]] }
                    case 5: { return [[x[0], x[1], x[2], g(x[3]), x[4]]] }
                }
            }
            case 4: {
                // insert
                const [v0, v1] = x
                return [[v0], v1, [g(null)]]
            }
        }
    }
    return collapseRoot(reduceBranch(f())(tail))
}

/** @type {<T>(c: Compare<T>) => (f: (value: T|null) => T) => (tree: Tree<T>) => TNode<T>} */
export const set = c => f => tree => tree === null ? [f(null)] : nodeSet(c)(f)(tree)
