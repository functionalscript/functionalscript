/** @import { Unknown } from '../../../media/json/types.ts' */

/** @import { Result } from './types.ts' */
import { find as btreeFind } from './module.f.mjs'
import { map, toArray } from '../../list/module.f.mjs'
import { stringify } from '../../../media/json/module.f.mjs'
import { sort } from '../../object/module.f.mjs'
/** @import { TNode } from '../types/types.ts' */
import { cmp } from '../../string/module.f.mjs'
import { set as setSet } from '../set/module.f.mjs'
import { assertEq } from '../../../asserts/module.f.mjs'

const jsonStr = stringify(sort)

/** @type {(node: TNode<string>) => (value: string) => TNode<string>} */
const set = node => value => setSet(cmp(value))(() => value)(node)

/** @type {(r: Result<Unknown>) => string} */
const str = r => jsonStr(toArray(map((/** @type {any} */ x) => x[0])(r)))

/** @type {(i: string) => (m: TNode<string>) => string} */
const find = i => m => str(btreeFind(cmp(i))(m))

const test = () => {
    /** @type {TNode<string>} */
    let _map = ['1']
    for (let i = 2; i <= 10; i++) {
        _map = set(_map)((i * i).toString())
    }
    {
        const s = jsonStr(_map)
        assertEq(s, '[[["1","100"],"16",["25","36"]],"4",[["49"],"64",["81","9"]]]')
    }
    //
    {
        const r = find("0")(_map)
        assertEq(r, '[0,0,0]')
    }
    {
        const r = find("1")(_map)
        assertEq(r, '[1,0,0]')
    }
    {
        const r = find("10")(_map)
        assertEq(r, '[2,0,0]')
    }
    {
        const r = find("100")(_map)
        assertEq(r, '[3,0,0]')
    }
    {
        const r = find("12")(_map)
        assertEq(r, '[4,0,0]')
    }
    {
        const r = find("16")(_map)
        assertEq(r, '[1,0]')
    }
    {
        const r = find("17")(_map)
        assertEq(r, '[0,2,0]')
    }
    {
        const r = find("25")(_map)
        assertEq(r, '[1,2,0]')
    }
    {
        const r = find("26")(_map)
        assertEq(r, '[2,2,0]')
    }
    {
        const r = find("36")(_map)
        assertEq(r, '[3,2,0]')
    }
    {
        const r = find("37")(_map)
        assertEq(r, '[4,2,0]')
    }
    {
        const r = find("4")(_map)
        assertEq(r, '[1]')
    }
    {
        const r = find("41")(_map)
        assertEq(r, '[0,0,2]')
    }
    {
        const r = find("49")(_map)
        assertEq(r, '[1,0,2]')
    }
    {
        const r = find("5")(_map)
        assertEq(r, '[2,0,2]')
    }
    {
        const r = find("64")(_map)
        assertEq(r, '[1,2]')
    }
    {
        const r = find("65")(_map)
        assertEq(r, '[0,2,2]')
    }
    {
        const r = find("81")(_map)
        assertEq(r, '[1,2,2]')
    }
    {
        const r = find("85")(_map)
        assertEq(r, '[2,2,2]')
    }
    {
        const r = find("9")(_map)
        assertEq(r, '[3,2,2]')
    }
    {
        const r = find("91")(_map)
        assertEq(r, '[4,2,2]')
    }
}

export const proof = test
