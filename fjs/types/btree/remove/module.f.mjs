/**
 * Removal operations for persistent B-tree structures.
 *
 * @module
 *
 * @import { Leaf1, TNode, Branch1, Branch3, Branch5, Tree } from '../types/types.ts'
 * @import { Compare } from '../../function/compare/types.ts'
 * @import { Path, PathItem } from '../find/types.ts'
 * @import { FixedArray } from '../../array/types.ts'
 * @import { _Branch, _Leaf01, _Merge, _RemovePath, _Side } from './private.ts'
 */

import { collapseRoot } from '../types/module.f.js'
import { find } from '../find/module.f.mjs'
import { fold, concat, next } from '../../list/module.f.mjs'
import { map } from '../../nullable/module.f.js'

/** @type {<T>(tail: Path<T>) => (n: TNode<T>) => readonly[T, _RemovePath<T>]} */
const path = tail => n => {
    switch (n.length) {
        case 1: { return [n[0], { first: null, tail }] }
        case 2: { return [n[0], { first: [n[1]], tail }] }
        case 3: { return path({ first: [0, n], tail })(n[0]) }
        case 5: { return path({ first: [0, n], tail })(n[0]) }
    }
}

// The merges below are written for the left child (`a` at slot 0, its sibling
// at slot 2). A `_Side` orients every tuple they read or build: `left` keeps it
// as is, `right` reverses it, which turns each merge into its right-child mirror.

/** @type {_Side} */
const left = { l2: x => x, b3: x => x, b5: x => x }

/** @type {_Side} */
const right = {
    l2: ([a, b]) => [b, a],
    b3: ([a, b, c]) => [c, b, a],
    b5: ([a, b, c, d, e]) => [e, d, c, b, a],
}

/** @type {(side: _Side) => <T>(a: _Branch<T>) => (n: Branch3<T>) => Branch1<T> | Branch3<T>} */
const reduceValue = ({ b3, b5 }) => a => n => {
    const [, v1, s] = b3(n)
    if (a.length !== 1) { return b3([a, v1, s]) }
    switch (s.length) {
        case 3: {
            const [s0, s1, s2] = b3(s)
            return [b5([a[0], v1, s0, s1, s2])]
        }
        case 5: {
            const [s0, s1, s2, s3, s4] = b5(s)
            return b3([b3([a[0], v1, s0]), s1, b3([s2, s3, s4])])
        }
        default: { throw 'invalid node' }
    }
}

/** @type {(side: _Side) => <T>(a: _Leaf01<T>) => (n: Branch3<T>) => Branch1<T> | Branch3<T>} */
const initValue = ({ l2, b3 }) => a => n => {
    const [, v1, s] = b3(n)
    if (a !== null) { return b3([a, v1, s]) }
    switch (s.length) {
        case 1: { return [l2([v1, s[0]])] }
        case 2: {
            const [s0, s1] = l2(s)
            return b3([[v1], s0, [s1]])
        }
        default: { throw 'invalid node' }
    }
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

const reduce = fold(reduceX([reduceValue(left), reduceValue(right)]))

const initReduce = reduceX([initValue(left), initValue(right)])

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

// `reduceValue`/`initValue` merge a Branch1's lone child into its Branch3
// sibling. The sibling is always a Branch (length 3 or 5) in every reachable
// tree shape, so the `default` arm guarding a mismatched (leaf) sibling length
// can't be hit through the public `remove` API. Exercise it directly here so
// the invariant guard itself stays covered.
export const proof = {
    throw: {
        reduceValueDefaultBranch: () => {
            reduceValue(left)([['leaf']])([['x'], 's', ['y']])
        },
        initValueDefaultBranch: () => {
            initValue(right)(null)([[['a'], 'b', ['c']], 'd', ['e']])
        },
    },
}
