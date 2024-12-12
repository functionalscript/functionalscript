import * as BTree from './types/module.f.mjs'
import * as _ from './module.f.mjs'
const { values } = _
import * as json from '../../json/module.f.mjs'
import o from '../object/module.f.mjs'
const { sort } = o
import str from '../string/module.f.mjs'
const { cmp } = str
import list, * as List from '../list/module.f.mjs'
import * as s from './set/module.f.mjs'
import * as f from './find/module.f.mjs'

const jsonStr = json.stringify(sort)

/** @type {(sequence: List.List<json.Unknown>) => string} */
const stringify = sequence => jsonStr(list.toArray(sequence))

/** @type {(node: BTree.Node<string>) => (value: string) => BTree.Node<string>} */
const set = node => value => s.set(cmp(value))(() => value)(node)

const valueTest1 = () => {
    /** @type {BTree.Node<string>} */
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
    /** @type {BTree.Node<string>} */
    let _map = ['1']
    for(let i = 2; i <= 10; i++)
        _map = set(_map)((i*i).toString())
    let result = stringify(values(_map))
    if (result !== '["1","100","16","25","36","4","49","64","81","9"]') { throw result }
}

const findTrue = () => {
    /** @type {BTree.Node<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    const result = f.value(f.find(cmp('b'))(_map).first)
    if (result !== 'b') { throw result }
}

const find = () => {
    /** @type {BTree.Node<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    const result = f.value(f.find(cmp('e'))(_map).first)
    if (result !== null) { throw result }
}

const test = () => {
    /** @type {BTree.Node<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    _map = set(_map)('d')
    _map = set(_map)('e')
    _map = set(_map)('f')
    //
    {
        /** @type {List.Result<string>} */
        let _item = list.next(values(_map))
        while (_item !== null) {
            _item = list.next(_item.tail)
        }
    }
}

export default {
    valueTest1,
    valuesTest2,
    findTrue,
    find,
    test,
}