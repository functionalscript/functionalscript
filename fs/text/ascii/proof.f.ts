import { one, range } from './module.f.ts'
import { stringify as jsonStringify } from '../../json/module.f.ts'
import { sort } from '../../types/object/module.f.ts'

const stringify = jsonStringify(sort)

export const proof = {
    range: () => {
        const r = stringify(range("A"))
        if (r !== '[65,65]') { throw r }
    },
    oneThrowsOnEmpty: () => {
        let threw = false
        try { one('') } catch (_) { threw = true }
        if (!threw) { throw 'expected throw' }
    },
}
