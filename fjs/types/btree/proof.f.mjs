/**
 * @import { Unknown } from '../../media/json/types.ts'
 * @import { TNode } from './types/types.ts'
 * @import { List, Result } from '../list/types.ts'
 */

import { values } from './module.f.mjs'
import { stringify as jsonStringify } from '../../media/json/module.f.mjs'
import { sort } from '../object/module.f.mjs'
import { cmp } from '../string/module.f.mjs'
import { next, toArray } from '../list/module.f.mjs'
import { set as setSet } from './set/module.f.mjs'
import { value, find as findFind } from './find/module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

const jsonStr = jsonStringify(sort)

/** @type {(sequence: List<Unknown>) => string} */
const stringify = sequence => jsonStr(toArray(sequence))

/** @type {(node: TNode<string>) => (value: string) => TNode<string>} */
const set = node => value => setSet(cmp(value))(() => value)(node)

const valueTest1 =() => {
    /** @type {TNode<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    _map = set(_map)('d')
    _map = set(_map)('e')
    _map = set(_map)('f')
    const result = stringify(values(_map))
    assertEq(result, '["a","b","c","d","e","f"]')
}

const valuesTest2 = () => {
    /** @type {TNode<string>} */
    let _map = ['1']
    for(let i = 2; i <= 10; i++)
        _map = set(_map)((i*i).toString())
    const result = stringify(values(_map))
    assertEq(result, '["1","100","16","25","36","4","49","64","81","9"]')
}

const findTrue = () => {
    /** @type {TNode<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    const result = value(findFind(cmp('b'))(_map).first)
    assertEq(result, 'b')
}

const find = () => {
    /** @type {TNode<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    const result = value(findFind(cmp('e'))(_map).first)
    assertEq(result, null)
}

const test = () => {
    /** @type {TNode<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    _map = set(_map)('d')
    _map = set(_map)('e')
    _map = set(_map)('f')
    //
    {
        /** @type {Result<string>} */
        let _item = next(values(_map))
        while (_item !== null) {
            _item = next(_item.tail)
        }
    }
}

export const proof = {
    valueTest1,
    valuesTest2,
    findTrue,
    find,
    test,
}
