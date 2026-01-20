import type { Branch1, Branch3, Branch5, Branch7, Leaf2, TNode, Tree } from '../types/module.f.ts'
import { find, type First, type PathItem, type Result } from '../find/module.f.ts'
import type { Compare } from '../../function/compare/module.f.ts'
import { fold } from '../../list/module.f.ts'

type Branch1To3<T> = Branch1<T> | Branch3<T>

const b57
    : <T>(b: Branch5<T> | Branch7<T>) => Branch1To3<T>
    = b => b.length === 5 ? [b] : [[b[0], b[1], b[2]], b[3], [b[4], b[5], b[6]]]

const reduceOp
    : <T>(i: PathItem<T>) => (a: Branch1To3<T>) => Branch1To3<T>
    = ([i, x]) => a => {
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

const nodeSet
    = <T>(c: Compare<T>) => (g: (value: T | null) => T) => (node: TNode<T>): TNode<T> => {
    // export type Result<T> = {
    //    readonly first: First<T>,
    //    readonly tail: Path<T>
    //}
    const { first, tail }: Result<T> = find(c)(node)
    // export type Index2 = 0 | 1
    // export type Index3 = Index2 | 2 // 0 | 1 | 2
    // export type Index4 = Index3 | 3 // 0 | 1 | 2 | 3
    // export type Index5 = Index4 | 4 // 0 | 1 | 2 | 3 | 4
    // type FirstLeaf1<T> = readonly[Index3, Leaf1<T>]
    // type FirstBranch3<T> = readonly[1, Branch3<T>]
    // type FirstLeaf2<T> = readonly[Index5, Leaf2<T>]
    // type FirstBranch5<T> = readonly[1|3, Branch5<T>]
    // export type First<T> = FirstLeaf1<T> | FirstBranch3<T> | FirstLeaf2<T> | FirstBranch5<T>
    const [i, x]: First<T> = first;
    const f = (): Branch1To3<T> => {
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
                const _xl: 1|2 = x.length
                switch (x.length) {
                    case 1: { return [[x[0], value]] }
                    case 2: { return [[x[0]], value, [x[1]]] }
                }
                // TODO: remove after TSGO fix the regression.
                throw 'unreachable'
            }
            case 3: {
                // replace
                // TODO: remove after TSGO fix the regression.
                const _xl: 2|5 = x.length
                switch (x.length) {
                    case 2: { return [[x[0], g(x[1])]] }
                    case 5: { return [[x[0], x[1], x[2], g(x[3]), x[4]]]}
                }
                // TODO: remove after TSGO fix the regression.
                throw 'unreachable'
            }
            case 4: {
                // insert
                const [v0, v1] = x;
                return [[v0], v1, [g(null)]]
            }
        }
    }
    const r = reduceBranch(f())(tail)
    return r.length === 1 ? r[0] : r
}

export const set
    : <T>(c: Compare<T>) => (f: (value: T|null) => T) => (tree: Tree<T>) => TNode<T>
    = c => f => tree => tree === null ? [f(null)] : nodeSet(c)(f)(tree)
