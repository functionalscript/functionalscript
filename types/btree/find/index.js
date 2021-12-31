const _ = require('..')
const { todo } = require('../../../dev')
const list = require('../../list')
const cmp = require('../../function/compare')

/**
 * @template T
 * @typedef {readonly[cmp.Index3, _.Leaf1<T>|_.Branch3<T>]} FirstLeaf1
 */

/**
 * @template T
 * @typedef {readonly[1, _.Branch3<T>]} FirstBranch3
 */

/**
 * @template T
 * @typedef {readonly[cmp.Index5, _.Leaf2<T>]} FirstLeaf2
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

/**
 * @template T
 * @typedef {list.List<PathItem<T>>} Path
 */

/**
 * @template T
 * @typedef {readonly[First<T>, Path<T>]} Result<T>
 */

/** @type {<T>(c: cmp.Compare<T>) => (node: _.Node<T>) => Result<T>} */
const find = c => {
    const i3 = cmp.index3(c)
    const i5 = cmp.index5(c)
    /** @typedef {typeof c extends cmp.Compare<infer T> ? T : never} T */
    /** @type {(node: _.Node<T>) => Result<T>} */
    const f = node => {
        switch (node.length) {
            case 1: { return [[i3(node[0]), node], undefined] }
            case 2: { return [[i5(node), node], undefined] }
            case 3: {
                const i = i3(node[1])
                switch (i) {
                    case 0: case 2: {
                        const [first, tail] = f(node[i])
                        return [first, { first: [i, node], tail}]
                    }
                    case 1: { return [[i, node], undefined] }
                }
                return todo()
            }
            case 5: {
                const i = i5([node[1], node[3]])
                switch (i) {
                    case 0: case 2: case 4: {
                        const [first, tail] = f(node[i])
                        return [first, { first: [i, node], tail }]
                    }
                    case 1: case 3: { return [[i, node], undefined]}
                }
            }
        }
        return todo()
    }
    return f
}
