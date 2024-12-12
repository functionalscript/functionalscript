// @ts-self-types="./module.f.d.mts"
import * as _ from '../types/module.f.mjs'
import * as List from '../../list/module.f.mjs'
import cmp, * as cmpT from '../../function/compare/module.f.mjs'
const { index3, index5 } = cmp
import * as Array from '../../array/module.f.mjs'

/**
 * @template T
 * @typedef {readonly[cmpT.Index3, _.Leaf1<T>]} FirstLeaf1
 */

/**
 * @template T
 * @typedef {readonly[1, _.Branch3<T>]} FirstBranch3
 */

/**
 * @template T
 * @typedef {readonly[cmpT.Index5, _.Leaf2<T>]} FirstLeaf2
 */

/**
 * @template T
 * @typedef {readonly[1|3, _.Branch5<T>]} FirstBranch5
 */

/**
 * @template T
 * @typedef {FirstLeaf1<T> | FirstBranch3<T> | FirstLeaf2<T> | FirstBranch5<T>} First
 */

/**
 * @template T
 * @typedef {readonly[0|2, _.Branch3<T>]} PathItem3
 */

/**
 * @template T
 * @typedef {readonly[0|2|4, _.Branch5<T>]} PathItem5
 */

/**
 * @template T
 * @typedef {PathItem3<T> | PathItem5<T>} PathItem
 */

/** @type {<T>(item: PathItem<T>) => _.Node<T>} */
const child = item =>
    /** @type {typeof item extends PathItem<infer T> ? _.Node<T> : never} */(item[1][item[0]])

/**
 * @template T
 * @typedef {List.List<PathItem<T>>} Path
 */

/**
 * @template T
 * @typedef {{
 *  readonly first: First<T>,
 *  readonly tail: Path<T>
 * }} Result<T>
 */

/** @type {<T>(c: cmpT.Compare<T>) => (node: _.Node<T>) => Result<T>} */
export const find = c => {
    const i3 = index3(c)
    const i5 = index5(c)
    /** @typedef {typeof c extends cmpT.Compare<infer T> ? T : never} T */
    /** @type {(prior: Path<T>) => (node: _.Node<T>) => Result<T>} */
    const f = tail => node => {
        /** @type {(index: Array.KeyOf<typeof node>) => Result<T>} */
        const append = index => {
            const first = /** @type {PathItem<T>} */([index, node])
            return f({ first, tail })(child(first))
        }
        /** @type {(index: Array.KeyOf<typeof node>) => Result<T>} */
        const done = index => ({ first: /** @type {First<T>} */([index, node]), tail })
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
