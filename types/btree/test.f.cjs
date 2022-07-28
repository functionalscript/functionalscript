const btree = require('./types/main.f.cjs')
const { values } = require('./main.f.cjs')
const json = require('../../json/main.f.cjs')
const { sort } = require('../object/main.f.cjs')
const { stringCmp } = require('../function/compare/main.f.cjs')
const list = require('../list/main.f.cjs')
const s = require('./set/main.f.cjs')
const f = require('./find/main.f.cjs')

require('./find/test.f.cjs')
require('./set/test.f.cjs')
require('./remove/test.f.cjs')

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