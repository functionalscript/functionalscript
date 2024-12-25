import * as _ from './module.f.ts'
import * as list from '../../list/module.f.ts'
import * as json from '../../../json/module.f.ts'
import { sort } from '../../object/module.f.ts'
import type * as btree from '../types/module.f.ts'
import * as string from '../../string/module.f.ts'
const { cmp } = string
import * as s from '../set/module.f.ts'

const jsonStr = json.stringify(sort)

const set
    : (node: btree.TNode<string>) => (value: string) => btree.TNode<string>
    = node => value => s.set(cmp(value))(() => value)(node)

const str
    : (r: _.Result<json.Unknown>) => string
    = r => jsonStr(list.toArray(list.map((x: any) => x[0])(r)))

const find
    : (i: string) => (m: btree.TNode<string>) => string
    = i => m => str(_.find(cmp(i))(m))

const test = () => {
    let _map: btree.TNode<string> = ['1']
    for (let i = 2; i <= 10; i++) {
        _map = set(_map)((i * i).toString())
    }
    {
        const s = jsonStr(_map)
        if (s !== '[[["1","100"],"16",["25","36"]],"4",[["49"],"64",["81","9"]]]') { throw s }
    }
    //
    {
        const r = find("0")(_map)
        if (r !== '[0,0,0]') { throw r }
    }
    {
        const r = find("1")(_map)
        if (r !== '[1,0,0]') { throw r }
    }
    {
        const r = find("10")(_map)
        if (r !== '[2,0,0]') { throw r }
    }
    {
        const r = find("100")(_map)
        if (r !== '[3,0,0]') { throw r }
    }
    {
        const r = find("12")(_map)
        if (r !== '[4,0,0]') { throw r }
    }
    {
        const r = find("16")(_map)
        if (r !== '[1,0]') { throw r }
    }
    {
        const r = find("17")(_map)
        if (r !== '[0,2,0]') { throw r }
    }
    {
        const r = find("25")(_map)
        if (r !== '[1,2,0]') { throw r }
    }
    {
        const r = find("26")(_map)
        if (r !== '[2,2,0]') { throw r }
    }
    {
        const r = find("36")(_map)
        if (r !== '[3,2,0]') { throw r }
    }
    {
        const r = find("37")(_map)
        if (r !== '[4,2,0]') { throw r }
    }
    {
        const r = find("4")(_map)
        if (r !== '[1]') { throw r }
    }
    {
        const r = find("41")(_map)
        if (r !== '[0,0,2]') { throw r }
    }
    {
        const r = find("49")(_map)
        if (r !== '[1,0,2]') { throw r }
    }
    {
        const r = find("5")(_map)
        if (r !== '[2,0,2]') { throw r }
    }
    {
        const r = find("64")(_map)
        if (r !== '[1,2]') { throw r }
    }
    {
        const r = find("65")(_map)
        if (r !== '[0,2,2]') { throw r }
    }
    {
        const r = find("81")(_map)
        if (r !== '[1,2,2]') { throw r }
    }
    {
        const r = find("85")(_map)
        if (r !== '[2,2,2]') { throw r }
    }
    {
        const r = find("9")(_map)
        if (r !== '[3,2,2]') { throw r }
    }
    {
        const r = find("91")(_map)
        if (r !== '[4,2,2]') { throw r }
    }
}

export default test
