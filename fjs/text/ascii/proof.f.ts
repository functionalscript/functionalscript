import { one, range } from './module.f.mjs'
import { stringify as jsonStringify } from '../../media/json/sede/module.f.ts'
import { sort } from '../../types/object/module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

const stringify = jsonStringify(sort)

export const proof = {
    range: () => {
        const r = stringify(range("A"))
        assertEq(r, '[65,65]')
    },
    throw: {
        oneThrowsOnEmpty: () => one(''),
    },
}
