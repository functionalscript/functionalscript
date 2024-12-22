import * as _ from '../types/module.f.ts'
import * as List from '../../list/module.f.ts'
import * as cmp from '../../function/compare/module.f.ts'
const { index3, index5 } = cmp
import * as Array from '../../array/module.f.ts'

type FirstLeaf1<T> = readonly[cmp.Index3, _.Leaf1<T>]

type FirstBranch3<T> = readonly[1, _.Branch3<T>]

type FirstLeaf2<T> = readonly[cmp.Index5, _.Leaf2<T>]

type FirstBranch5<T> = readonly[1|3, _.Branch5<T>]

type First<T> = FirstLeaf1<T> | FirstBranch3<T> | FirstLeaf2<T> | FirstBranch5<T>

type PathItem3<T> = readonly[0|2, _.Branch3<T>]

type PathItem5<T> = readonly[0|2|4, _.Branch5<T>]

export type PathItem<T> = PathItem3<T> | PathItem5<T>

const child
= <T>(item: PathItem<T>): _.TNode<T> => (item[1][item[0]] as _.TNode<T>)

export type Path<T> = List.List<PathItem<T>>

export type Result<T> = {
    readonly first: First<T>,
    readonly tail: Path<T>
}

export const find
= <T>(c: cmp.Compare<T>): (node: _.TNode<T>) => Result<T> => {
    const i3 = index3(c)
    const i5 = index5(c)
    // /** @typedef {typeof c extends cmp.Compare<infer T> ? T : never} T */
    const f
        = (tail: Path<T>) => (node: _.TNode<T>): Result<T> => {
        const append
            : (index: Array.KeyOf<typeof node>) => Result<T>
            = index => {
            const first = [index, node] as PathItem<T>
            return f({ first, tail })(child(first))
        }
        const done
            : (index: Array.KeyOf<typeof node>) => Result<T>
            = index => ({ first: [index, node] as First<T>, tail })
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

export const isFound = <T>([i]: First<T>): boolean => {
    switch (i) {
        case 1: case 3: { return true }
        default: { return false }
    }
}

export const value = <T>([i, r]: First<T>): T | null => {
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
