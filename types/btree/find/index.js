const _ = require('..')
const list = require('../../list')
const cmp = require('../../function/compare')
const array = require('../../array')

/**
 * @template T
 * @typedef {readonly[cmp.Index3, _.Leaf1<T>]} FirstLeaf1
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

/** @type {<T>(item: PathItem<T>) => _.Node<T>} */
const child = item => {
    /** @typedef {typeof item extends PathItem<infer T> ? T : never} T */
    return /** @type {_.Node<T>} */(item[1][item[0]])
}

/**
 * @template T
 * @typedef {list.List<PathItem<T>>} Path
 */

/**
 * @template T
 * @typedef {{
 *  readonly first: First<T>,
 *  readonly tail: Path<T>
 * }} Result<T>
 */

/** @type {<T>(c: cmp.Compare<T>) => (node: _.Node<T>) => Result<T>} */
const find = c => {
    const i3 = cmp.index3(c)
    const i5 = cmp.index5(c)
    /** @typedef {typeof c extends cmp.Compare<infer T> ? T : never} T */
    /** @type {(prior: Path<T>) => (node: _.Node<T>) => Result<T>} */
    const f = tail => node => {
        /** @type {(index: array.KeyOf<typeof node>) => Result<T>} */
        const append = index => {
            const first = /** @type {PathItem<T>} */([index, node])
            return f({ first, tail })(child(first))
        }
        /** @type {(index: array.KeyOf<typeof node>) => Result<T>} */
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
    return f(undefined)
}

/** @type {<T>(first: First<T>) => boolean} */
const isFound = first => {
    switch (first[0]) {
        case 1: case 3: { return true }
        default: { return false }
    }
}

/** @type {<T>(first: First<T>) => T | undefined} */
const value = first => {
    switch (first[0]) {
        case 1: {
            const x = first[1]
            switch (x.length) {
                case 1: case 2: { return x[0] }
                default: { return x[1] }
            }
        }
        case 3: {
            const x = first[1]
            return x.length === 2 ? x[1] : x[3]
        }
        default: {
            return undefined
        }
    }
}

module.exports = {
    /** @readonly */
    find,
    /** @readonly */
    value,
    /** @readonly */
    isFound,
}
