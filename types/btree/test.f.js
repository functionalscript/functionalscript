const btree = require('./index.f.js')
const { values } = btree
const json = require('../../json/index.f.js')
const { sort } = require('../object/index.f.js')
const { stringCmp } = require('../function/compare/index.f.js')
const list = require('../list/index.f.js')
const s = require('./set/index.f.js')
const f = require('./find/index.f.js')

require('./find/test.f.js')
require('./set/test.f.js')
require('./remove/test.f.js')

const jsonStr = json.stringify(sort)

/** @type {(sequence: list.List<json.Unknown>) => string} */
const stringify = sequence => jsonStr(list.toArray(sequence))

/** @type {(node: btree.Node<string>) => (value: string) => btree.Node<string>} */
const set = node => value => s.set(stringCmp(value))(value)(node)

{
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

{
    /** @type {btree.Node<string>} */
    let _map = ['1']
    for(let i = 2; i <= 10; i++)
        _map = set(_map)((i*i).toString())
    let result = stringify(values(_map))
    if (result !== '["1","100","16","25","36","4","49","64","81","9"]') { throw result }
}

{
    /** @type {btree.Node<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    const result = f.value(f.find(stringCmp('b'))(_map).first)
    if (result !== 'b') { throw result }
}

{
    /** @type {btree.Node<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    const result = f.value(f.find(stringCmp('e'))(_map).first)
    if (result !== undefined) { throw result }
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
        while (_item !== undefined) {
            _item = list.next(_item.tail)
        }
    }
}

test()