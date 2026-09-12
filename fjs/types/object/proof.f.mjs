import { at, fromMap } from './module.f.mjs'
import { empty, setReplace } from '../ordered_map/module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

export const proof = {
    // an ordered map as an object: its entries in the map's order, sorted
    fromMap: () => {
        const map = setReplace('b')(1)(setReplace('a')(2)(empty))
        const object = fromMap(map)
        assertEq(Object.keys(object).join(), 'a,b')
        assertEq(object.a, 2)
        assertEq(object.b, 1)
    },
    ctor: () => {
        const a = {}
        const value = at('constructor')(a)
        assertEq(value, null)
    },
    property: () => {
        const a = { constructor: 42 }
        const value = at('constructor')(a)
        assertEq(value, 42)
    }
}
