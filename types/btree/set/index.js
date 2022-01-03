const _ = require('..')
const { find } = require('../find')
const cmp = require('../../function/compare')
const { todo } = require('../../../dev')

/** @type {<T>(c: cmp.Compare<T>) => (value: T) => (node: _.Node<T>) => _.Node<T>} */
const set = c => value => node => {
    const { first, tail } = find(c)(node)
    switch (first[0]) {
        case 0: {
            // x2
            const x = first[1]
            return todo()
        }
        case 1: {
            // x4
            const x = first[1];
            return todo()
        }
        case 2: {
            // x2
            const x = first[1];
            return todo()
        }
        case 3: {
            // x2
            const x = first[1];
            return todo()
        }
        case 4: {
            // x1
            const x = first[1];
            return todo()
        }
    }
    return todo()
}

module.exports = {}