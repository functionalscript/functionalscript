import { one, range } from './module.f.ts'
import { stringify as jsonStringify } from '../../media/json/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { assert } from '../../asserts/module.f.ts'

const stringify = jsonStringify(sort)

export const proof = {
    range: () => {
        const r = stringify(range("A"))
        assert(r === '[65,65]', r)
    },
    oneThrowsOnEmpty: () => {
        let threw = false
        try { one('') } catch (_) { threw = true }
        assert(threw, 'expected throw')
    },
}
