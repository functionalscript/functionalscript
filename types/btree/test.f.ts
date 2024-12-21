import * as BTree from './types/module.f.mjs'
import * as _ from './module.f.ts'
const { values } = _
import * as json from '../../json/module.f.ts'
import * as o from '../object/module.f.ts'
const { sort } = o
import * as str from '../string/module.f.ts'
const { cmp } = str
import * as list from '../list/module.f.mjs'
import * as s from './set/module.f.ts'
import * as f from './find/module.f.ts'

const jsonStr = json.stringify(sort)

const stringify
    : (sequence: list.List<json.Unknown>) => string
    = sequence => jsonStr(list.toArray(sequence))

const set
    : (node: BTree.Node<string>) => (value: string) => BTree.Node<string>
    = node => value => s.set(cmp(value))(() => value)(node)

const valueTest1 =() => {
    let _map
        : BTree.Node<string>
        = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    _map = set(_map)('d')
    _map = set(_map)('e')
    _map = set(_map)('f')
    let result = stringify(values(_map))
    if (result !== '["a","b","c","d","e","f"]') { throw result }
}

const valuesTest2 = () => {
    let _map
        : BTree.Node<string>
        = ['1']
    for(let i = 2; i <= 10; i++)
        _map = set(_map)((i*i).toString())
    let result = stringify(values(_map))
    if (result !== '["1","100","16","25","36","4","49","64","81","9"]') { throw result }
}

const findTrue = () => {
    let _map
        : BTree.Node<string>
        = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    const result = f.value(f.find(cmp('b'))(_map).first)
    if (result !== 'b') { throw result }
}

const find = () => {
    let _map
        : BTree.Node<string>
        = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    const result = f.value(f.find(cmp('e'))(_map).first)
    if (result !== null) { throw result }
}

const test = () => {
    let _map
        : BTree.Node<string>
        = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    _map = set(_map)('d')
    _map = set(_map)('e')
    _map = set(_map)('f')
    //
    {
        let _item
            : list.Result<string>
            = list.next(values(_map))
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
