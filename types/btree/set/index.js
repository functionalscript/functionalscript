const _ = require('..')
const find = require('../find')
const cmp = require('../../function/compare')
const list = require('../../list')

/**
 * @template T
 * @typedef {_.Branch1<T> | _.Branch3<T>} Bracnh1To3
 */

/** @type {<T>(b: _.Branch5<T> | _.Branch7<T>) => Bracnh1To3<T>} */
const b57 = b => b.length === 5 ? [b] : [[b[0], b[1], b[2]], b[3], [b[4], b[5], b[6]]]

/** @type {<T>(a: Bracnh1To3<T>) => (i: find.PathItem<T>) => Bracnh1To3<T>} */
const reduce = a => i => {
    switch (i[0]) {
        case 0: {
            const x = i[1]
            switch (x.length) {
                case 3: { return [[...a, x[1], x[2]]] }
                case 5: { return b57([...a, x[1], x[2], x[3], x[4]]) }
            }
        }
        case 2: {
            const x = i[1]
            switch (x.length) {
                case 3: { return [[x[0], x[1], ...a]] }
                case 5: { return b57([x[0], x[1], ...a, x[3], x[4]]) }
            }
        }
        case 4: {
            const x = i[1]
            return b57([x[0], x[1], x[2], x[3], ...a])
        }
    }
}

/** @type {<T>(c: cmp.Compare<T>) => (value: T) => (node: _.Node<T>) => _.Node<T>} */
const nodeSet = c => value => node => {
    const { first, tail } = find.find(c)(node)
    /** @typedef {typeof value} T */
    /** @type {() => Bracnh1To3<T>} */
    const f = () => {
        switch (first[0]) {
            case 0: {
                // insert
                const x = first[1]
                switch (x.length) {
                    case 1: { return [[value, x[0]]] }
                    case 2: { return [[value], x[0], [x[1]]] }
                }
            }
            case 1: {
                // replace
                const x = first[1];
                switch (x.length) {
                    case 1: { return [[value]] }
                    case 2: { return [[value, x[1]]] }
                    case 3: { return [[x[0], value, x[2]]] }
                    case 5: { return [[x[0], value, x[2], x[3], x[4]]] }
                }
            }
            case 2: {
                // insert
                const x = first[1];
                switch (x.length) {
                    case 1: { return [[x[0], value]] }
                    case 2: { return [[x[0]], value, [x[1]]] }
                }
            }
            case 3: {
                // replace
                const x = first[1];
                switch (x.length) {
                    case 2: { return [[x[0], value]] }
                    case 5: { return [[x[0], x[1], x[2], value, x[4]]]}
                }
            }
            case 4: {
                // insert
                const [v0, v1] = first[1];
                return [[v0], v1, [value]]
            }
        }
    }
    const r = list.reduce(reduce)(f())(tail)
    return r.length === 1 ? r[0] : r
}

/** @type {<T>(c: cmp.Compare<T>) => (value: T) => (tree: _.Tree<T>) => _.Tree<T>} */
const set = c => value => tree => tree === undefined ? [value] : nodeSet(c)(value)(tree)

module.exports = {
    /** @readonly */
    nodeSet,
    /** @readonly */
    set,
}
