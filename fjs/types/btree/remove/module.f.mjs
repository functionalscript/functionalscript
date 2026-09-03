/**
 * Removal operations for persistent B-tree structures.
 *
 * @module
 *
 * @import { Leaf1, TNode, Branch1, Branch3, Branch5, Tree } from '../types/types.ts'
 * @import { Compare } from '../../function/compare/types.ts'
 * @import { Path, PathItem } from '../find/types.ts'
 * @import { FixedArray } from '../../array/types.ts'
 * @import { _Branch, _Leaf01, _Merge, _RemovePath } from './private.ts'
 */

import { collapseRoot } from '../types/module.f.mjs'
import { find } from '../find/module.f.mjs'
import { fold, concat, next } from '../../list/module.f.mjs'
import { map } from '../../nullable/module.f.mjs'

/** @type {<T>(tail: Path<T>) => (n: TNode<T>) => readonly[T, _RemovePath<T>]} */
const path = tail => n => {
    switch (n.length) {
        case 1: { return [n[0], { first: null, tail }] }
        case 2: { return [n[0], { first: [n[1]], tail }] }
        case 3: { return path({ first: [0, n], tail })(n[0]) }
        case 5: { return path({ first: [0, n], tail })(n[0]) }
    }
}

/** @type {<T>(a: _Branch<T>) => (n: Branch3<T>) => Branch1<T> | Branch3<T>} */
const reduceValue0 = a => n => {
    const [, v1, n2] = n
    if (a.length === 1) {
        switch (n2.length) {
            case 3: { return [[a[0], v1, ...n2]] }
            case 5: { return [[a[0], v1, n2[0]], n2[1], [n2[2], n2[3], n2[4]]] }
            default: { throw 'invalid node' }
        }
    } else {
        return [a, v1, n2]
    }
}

/** @type {<T>(a: _Branch<T>) => (n: Branch3<T>) => Branch1<T> | Branch3<T>} */
const reduceValue2 = a => n => {
    const [n0, v1, ] = n
    if (a.length === 1) {
        switch (n0.length) {
            case 3: { return [[...n0, v1, a[0]]] }
            case 5: { return [[n0[0], n0[1], n0[2]], n0[3], [n0[4], v1, a[0]]] }
            default: { throw 'invalid node' }
        }
    } else {
        return [n0, v1, a]
    }
}

/** @type {<T>(a: _Leaf01<T>) => (n: Branch3<T>) => Branch1<T> | Branch3<T>} */
const initValue0 = a => n => {
    const [, v1, n2] = n
    if (a === null) {
        switch (n2.length) {
            case 1: { return [[v1, ...n2]] }
            case 2: { return [[v1], n2[0], [n2[1]]] }
            default: { throw 'invalid node' }
        }
    } else {
        return [a, v1, n2]
    }
}

/** @type {<T>(a: _Leaf01<T>) => (n: Branch3<T>) => Branch1<T> | Branch3<T>} */
const initValue1 = a => n => {
    const [n0, v1] = n
    if (a === null) {
        switch (n0.length) {
            case 1: { return [[...n0, v1]] }
            case 2: { return [[n0[0]], n0[1], [v1]] }
            default: { throw 'invalid node' }
        }
    } else { return [n0, v1, a] }
}

/** @type {<A, T>(ms: FixedArray<2, _Merge<A, T>>) => (item: PathItem<T>) => (a: A) => _Branch<T>} */
const reduceX = ms => ([i, n]) => a => {
    /** @typedef {(typeof n)[1]} T */
    const [m0, m2] = ms
    /** @type {(m: typeof m0) => _Branch<T>} */
    const f = m => {
        const ra = m(a)
        return n.length === 3 ? ra(n) : [...ra([n[0], n[1], n[2]]), n[3], n[4]]
    }
    switch (i) {
        case 0: { return f(m0) }
        case 2: { return f(m2) }
        case 4: { return [n[0], n[1], ...m2(a)([n[2], n[3], n[4]])] }
    }
}

const reduce = fold(reduceX([reduceValue0, reduceValue2]))

const initReduce = reduceX([initValue0, initValue1])

/** @type {<T>(c: Compare<T>) => (node: TNode<T>) => Tree<T>} */
export const nodeRemove = c => node => {
    /** @typedef {typeof c extends Compare<infer T> ? T : never} T */
    /** @type {() => null | _RemovePath<T>} */
    const f = () => {
        const { first, tail } = find(c)(node)
        /** @type {(n: TNode<T>) => (f: (v: T) => PathItem<T>) => _RemovePath<T>} */
        const branch = n => f => {
            const [v, p] = path(null)(n)
            return { first: p.first, tail: concat(p.tail)({ first: f(v), tail }) }
        }
        const [i, n] = first
        switch (i) {
            case 1: {
                switch (n.length) {
                    case 1: { return { first: null, tail } }
                    case 2: { return { first: [n[1]], tail } }
                    case 3: { return branch(n[2])(v => [2, [n[0], v, n[2]]]) }
                    case 5: { return branch(n[2])(v => [2, [n[0], v, n[2], n[3], n[4]]]) }
                }
            }
            case 3: {
                switch (n.length) {
                    case 2: { return { first: [n[0]], tail } }
                    case 5: { return branch(n[4])(v => [4, [n[0], n[1], n[2], v, n[4]]]) }
                }
            }
            default: { return null }
        }
    }
    const r = f()
    if (r === null) { return node }
    const { first, tail } = r
    const tailR = next(tail)
    if (tailR === null) { return first }
    const { first: tf, tail: tt } = tailR
    return collapseRoot(reduce(initReduce(tf)(first))(tt))
}

/** @type {<T>(c: Compare<T>) => (tree: Tree<T>) => Tree<T>} */
export const remove = c => map(nodeRemove(c))

// `reduceValue0`/`reduceValue2`/`initValue0`/`initValue1` merge a Branch1's lone
// child into its Branch3 sibling. The sibling is always a Branch (length 3 or 5)
// in every reachable tree shape, so the `default` arm guarding a mismatched
// (leaf) sibling length can't be hit through the public `remove` API. Exercise
// it directly here so the invariant guard itself stays covered.
export const proof = {
    throw: {
        reduceValue0DefaultBranch: () => {
            reduceValue0([['leaf']])([['x'], 's', ['y']])
        },
        reduceValue2DefaultBranch: () => {
            reduceValue2([['leaf']])([['x'], 's', ['y']])
        },
        initValue0DefaultBranch: () => {
            initValue0(null)([['x'], 's', [['a'], 'b', ['c']]])
        },
        initValue1DefaultBranch: () => {
            initValue1(null)([[['a'], 'b', ['c']], 'd', ['e']])
        },
    },
}
