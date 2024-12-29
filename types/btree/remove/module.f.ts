import type { Leaf1, TNode, Branch1, Branch3, Branch5, Tree } from '../types/module.f.ts'
import type { Compare } from '../../function/compare/module.f.ts'
import { type Path, type PathItem, find } from '../find/module.f.ts'
import { fold, concat, next } from '../../list/module.f.ts'
import type { Array2 } from '../../array/module.f.ts'
import { map } from '../../nullable/module.f.ts'

type Leaf01<T> = null | Leaf1<T>

type RemovePath<T> = {
   readonly first: Leaf01<T>,
   readonly tail: Path<T>
}

const path = <T>(tail: Path<T>) => (n: TNode<T>): readonly[T, RemovePath<T>] => {
    switch (n.length) {
        case 1: { return [n[0], { first: null, tail }] }
        case 2: { return [n[0], { first: [n[1]], tail }] }
        case 3: { return path({ first: [0, n], tail })(n[0]) }
        case 5: { return path({ first: [0, n], tail })(n[0]) }
    }
}

type Branch<T> = Branch1<T> | Branch3<T> | Branch5<T>

const reduceValue0 = <T>(a: Branch<T>) => (n: Branch3<T>): Branch1<T> | Branch3<T> => {
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

const reduceValue2 = <T>(a: Branch<T>) => (n: Branch3<T>): Branch1<T> | Branch3<T> => {
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

const initValue0 = <T>(a: Leaf01<T>) => (n: Branch3<T>): Branch1<T> | Branch3<T> => {
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

const initValue1 = <T>(a: Leaf01<T>) => (n: Branch3<T>): Branch1<T> | Branch3<T> => {
    const [n0, v1] = n
    if (a === null) {
        switch (n0.length) {
            case 1: { return [[...n0, v1]] }
            case 2: { return [[n0[0]], n0[1], [v1]] }
            default: { throw 'invalid node' }
        }
    } else { return [n0, v1, a] }
}

type Merge<A, T> = (a: A) => (n: Branch3<T>) => Branch1<T> | Branch3<T>

const reduceX = <A, T>(ms: Array2<Merge<A, T>>) => ([i, n]: PathItem<T>) => (a: A): Branch<T> => {
    const [m0, m2] = ms
    const f
        : (m: Merge<A, T>) => Branch<T>
        = m => {
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

export const nodeRemove
    = <T>(c: Compare<T>) => (node: TNode<T>): Tree<T> => {
    const f = (): null | RemovePath<T> => {
        const { first, tail } = find(c)(node)
        const branch
            : (n: TNode<T>) => (f: (v: T) => PathItem<T>) => RemovePath<T>
            = n => f => {
                const [v, p] = path(null as Path<T>)(n)
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
    const result = reduce(initReduce(tf)(first))(tt)
    return result.length === 1 ? result[0] : result
}

export const remove: <T>(c: Compare<T>) => (tree: Tree<T>) => Tree<T>
    = c => map(nodeRemove(c))
