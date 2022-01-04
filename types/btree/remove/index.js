const _ = require('..')
const { todo } = require('../../../dev')
const cmp = require('../../function/compare')
const find = require('../find')

/** @type {<T>(c: cmp.Compare<T>) => (node: _.Node<T>) => _.Node<T>} */
const remove = c => node => {
    const r = find.find(c)(node)
    return todo()
}
