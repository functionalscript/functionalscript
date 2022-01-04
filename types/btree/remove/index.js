const _ = require('..')
const { todo } = require('../../../dev')
const cmp = require('../../function/compare')
const find = require('../find')
const list = require('../../list')

/**
 * @template T
 * @typedef {undefined | _.Leaf1<T>} Leaf01
 */

/**
 * @template T
 * @typedef {{
 *  readonly first: Leaf01<T>,
 *  readonly tail: find.Path<T>
 * }} RemovePath
 */

/** @type {<T>(tail: find.Path<T>) => (n: _.Node<T>) => readonly[T, RemovePath<T>]} */
const path = tail => n => {
    switch (n.length) {
        case 1: { return [n[0], { first: undefined, tail }] }
        case 2: { return [n[0], { first: [n[1]], tail }] }
        case 3: { return path({ first: [0, n], tail })(n[0]) }
        case 5: { return path({ first: [0, n], tail })(n[0]) }
    }
}

/** @type {<T>(c: cmp.Compare<T>) => (node: _.Node<T>) => undefined | RemovePath<T>} */
const remove = c => node => {
    /** @typedef {typeof c extends cmp.Compare<infer T> ? T : never} T */
    const { first, tail } = find.find(c)(node)
    /** @type {(n: _.Node<T>) => (f: (v: T) => find.PathItem<T>) => RemovePath<T>} */
    const branch = n => f => {
        const [v, p] = path(/** @type {find.Path<T>} */(undefined))(n)
        return { first: p.first, tail: list.concat(p.tail)({ first: f(v), tail }) }
    }
    switch (first[0]) {
        case 1: {
            const n = first[1]
            switch (n.length) {
                case 1: { return { first: undefined, tail } }
                case 2: { return { first: [n[1]], tail } }
                case 3: { return branch(n[2])(v => [2, [n[0], v, n[2]]]) }
                case 5: { return branch(n[2])(v => [2, [n[0], v, n[2], n[3], n[4]]]) }
            }
        }
        case 3: {
            const n = first[1]
            switch (n.length) {
                case 2: { return { first: [n[0]], tail } }
                case 5: { return branch(n[4])(v => [2, [n[0], n[1], n[2], v, n[4]]]) }
            }
        }
        default: { return undefined }
    }
}

module.exports = {
    /** @readonly */
    remove,
}