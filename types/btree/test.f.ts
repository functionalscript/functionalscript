import type { TNode } from './types/module.f.ts'
import { values } from './module.f.ts'
import * as json from '../../json/module.f.ts'
import { sort } from '../object/module.f.ts'
import { cmp } from '../string/module.f.ts'
import { next, toArray, type List, type Result } from '../list/module.f.ts'
import * as s from './set/module.f.ts'
import * as f from './find/module.f.ts'

const jsonStr = json.stringify(sort)

const stringify
    : (sequence: List<json.Unknown>) => string
    = sequence => jsonStr(toArray(sequence))

const set
    : (node: TNode<string>) => (value: string) => TNode<string>
    = node => value => s.set(cmp(value))(() => value)(node)

const valueTest1 =() => {
    let _map: TNode<string> = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    _map = set(_map)('d')
    _map = set(_map)('e')
    _map = set(_map)('f')
    const result = stringify(values(_map))
    if (result !== '["a","b","c","d","e","f"]') { throw result }
}

const valuesTest2 = () => {
    let _map: TNode<string> = ['1']
    for(let i = 2; i <= 10; i++)
        _map = set(_map)((i*i).toString())
    const result = stringify(values(_map))
    if (result !== '["1","100","16","25","36","4","49","64","81","9"]') { throw result }
}

const findTrue = () => {
    let _map: TNode<string> = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    const result = f.value(f.find(cmp('b'))(_map).first)
    if (result !== 'b') { throw result }
}

const find = () => {
    let _map: TNode<string> = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    const result = f.value(f.find(cmp('e'))(_map).first)
    if (result !== null) { throw result }
}

const test = () => {
    let _map: TNode<string> = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    _map = set(_map)('d')
    _map = set(_map)('e')
    _map = set(_map)('f')
    //
    {
        let _item: Result<string> = next(values(_map))
        while (_item !== null) {
            _item = next(_item.tail)
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
