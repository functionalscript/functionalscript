const btree = require('./types/module.f.cjs')
const { values } = require('./module.f.cjs')
const jsonT = require('../../json/module.f.mjs')
const json = jsonT.default
const { sort } = require('../object/module.f.cjs')
const { cmp } = require('../string/module.f.cjs')
const list = require('../list/module.f.cjs')
const s = require('./set/module.f.mjs').default
const f = require('./find/module.f.mjs').default

require('./find/test.f.mjs')
require('./set/test.f.mjs')
require('./remove/test.f.mjs')

const jsonStr = json.stringify(sort)

/** @type {(sequence: list.List<jsonT.Unknown>) => string} */
const stringify = sequence => jsonStr(list.toArray(sequence))

/** @type {(node: btree.Node<string>) => (value: string) => btree.Node<string>} */
const set = node => value => s.set(cmp(value))(() => value)(node)

const valueTest1 = () => {
    /** @type {btree.Node<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    _map = set(_map)('d')
    _map = set(_map)('e')
    _map = set(_map)('f')
    let result = stringify(values(_map))
    if (result !== '["a","b","c","d","e","f"]') { throw result }
}

const valuesTest2 = () => {
    /** @type {btree.Node<string>} */
    let _map = ['1']
    for(let i = 2; i <= 10; i++)
        _map = set(_map)((i*i).toString())
    let result = stringify(values(_map))
    if (result !== '["1","100","16","25","36","4","49","64","81","9"]') { throw result }
}

const findTrue = () => {
    /** @type {btree.Node<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    const result = f.value(f.find(cmp('b'))(_map).first)
    if (result !== 'b') { throw result }
}

const find = () => {
    /** @type {btree.Node<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    const result = f.value(f.find(cmp('e'))(_map).first)
    if (result !== null) { throw result }
}

const test = () => {
    /** @type {btree.Node<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    _map = set(_map)('d')
    _map = set(_map)('e')
    _map = set(_map)('f')
    //
    {
        /** @type {list.Result<string>} */
        let _item = list.next(values(_map))
        while (_item !== null) {
            _item = list.next(_item.tail)
        }
    }
}

module.exports = {
    valueTest1,
    valuesTest2,
    findTrue,
    find,
    test,
}