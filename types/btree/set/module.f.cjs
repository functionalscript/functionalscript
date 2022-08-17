const _ = require('../types/module.f.cjs')
const btreeFind = require('../find/module.f.cjs')
const { find } = btreeFind
const cmp = require('../../function/compare/module.f.cjs')
const list = require('../../list/module.f.cjs')
const { reduce } = list

/**
 * @template T
 * @typedef {_.Branch1<T> | _.Branch3<T>} Branch1To3
 */

/** @type {<T>(b: _.Branch5<T> | _.Branch7<T>) => Branch1To3<T>} */
const b57 = b => b.length === 5 ? [b] : [[b[0], b[1], b[2]], b[3], [b[4], b[5], b[6]]]

/** @type {<T>(i: btreeFind.PathItem<T>) => (a: Branch1To3<T>) => Branch1To3<T>} */
const reduceOp = ([i, x]) => a => {
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

const reduceBranch = reduce(reduceOp)

/** @type {<T>(c: cmp.Compare<T>) => (value: T) => (node: _.Node<T>) => _.Node<T>} */
const nodeSet = c => value => node => {
    const { first, tail } = find(c)(node)
    const [i, x] = first;
    /** @typedef {typeof value} T */
    /** @type {() => Branch1To3<T>} */
    const f = () => {
        switch (i) {
            case 0: {
                // insert
                switch (x.length) {
                    case 1: { return [[value, x[0]]] }
                    case 2: { return [[value], x[0], [x[1]]] }
                }
            }
            case 1: {
                // replace
                switch (x.length) {
                    case 1: { return [[value]] }
                    case 2: { return [[value, x[1]]] }
                    case 3: { return [[x[0], value, x[2]]] }
                    case 5: { return [[x[0], value, x[2], x[3], x[4]]] }
                }
            }
            case 2: {
                // insert
                switch (x.length) {
                    case 1: { return [[x[0], value]] }
                    case 2: { return [[x[0]], value, [x[1]]] }
                }
            }
            case 3: {
                // replace
                switch (x.length) {
                    case 2: { return [[x[0], value]] }
                    case 5: { return [[x[0], x[1], x[2], value, x[4]]]}
                }
            }
            case 4: {
                // insert
                const [v0, v1] = x;
                return [[v0], v1, [value]]
            }
        }
    }
    const r = reduceBranch(f())(tail)
    return r.length === 1 ? r[0] : r
}

/** @type {<T>(c: cmp.Compare<T>) => (value: T) => (tree: _.Tree<T>) => _.Node<T>} */
const set = c => value => tree => tree === undefined ? [value] : nodeSet(c)(value)(tree)

module.exports = {
    /** @readonly */
    set,
}
