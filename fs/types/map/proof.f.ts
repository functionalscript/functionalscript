import { mapSet, mapDelete } from './module.f.ts'
import { assert, assertEq } from '../../asserts/module.f.ts'

export const proof = {
    set: () => {
        const map = mapSet(new Map(), 'a', 'b')
        assert(map.get('a') === 'b', 'error')
        assert(map.size === 1, 'error')
    },
    delete: () => {
        const map = mapDelete(mapSet(new Map(), 'a', 'b'), 'a')
        assert(map.get('a') === undefined, 'error')
        assert(map.size === 0, 'error')
    },
    deleteOneOfMany: () => {
        const m0 = mapSet(new Map<string, number>(), 'a', 1)
        const m1 = mapSet(m0, 'b', 2)
        const result = mapDelete(m1, 'a')
        assertEq(result.get('b'), 2)
        assertEq(result.get('a'), undefined)
        assertEq(result.size, 1)
    },
}
