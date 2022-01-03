const _ = require('.')
const btree = require('..')
const { stringCmp } = require('../../function/compare')
const json = require('../../../json')
const { sort } = require('../../object')

/** @type {(node: btree.Node<string>) => (value: string) => btree.Node<string>} */
const set = node => value => _.set(stringCmp(value))(value)(node)

const jsonStr = json.stringify(sort)

{
    /** @type {btree.Node<string>} */
    let _map = ['1']
    for (let i = 2; i <= 10; i++)
        _map = set(_map)((i * i).toString())
    const r = jsonStr(_map)
    if (r !== '[[["1","100"],"16",["25","36"]],"4",[["49"],"64",["81","9"]]]') { throw r }
}