import type * as _ from '../types/module.f.ts'
import { find, type PathItem } from '../find/module.f.ts'
import type * as Cmp from '../../function/compare/module.f.ts'
import { fold } from '../../list/module.f.ts'

type Branch1To3<T> = _.Branch1<T> | _.Branch3<T>

const b57
    : <T>(b: _.Branch5<T> | _.Branch7<T>) => Branch1To3<T>
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
    = <T>(c: Cmp.Compare<T>) => (g: (value: T | null) => T) => (node: _.TNode<T>): _.TNode<T> => {
    const { first, tail } = find(c)(node)
    const [i, x] = first;
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
                switch (x.length) {
                    case 1: { return [[x[0], value]] }
                    case 2: { return [[x[0]], value, [x[1]]] }
                }
            }
            case 3: {
                // replace
                switch (x.length) {
                    case 2: { return [[x[0], g(x[1])]] }
                    case 5: { return [[x[0], x[1], x[2], g(x[3]), x[4]]]}
                }
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
    : <T>(c: Cmp.Compare<T>) => (f: (value: T|null) => T) => (tree: _.Tree<T>) => _.TNode<T>
    = c => f => tree => tree === null ? [f(null)] : nodeSet(c)(f)(tree)
