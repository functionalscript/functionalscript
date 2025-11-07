import { range } from './module.f.ts'
import { stringify as jsonStringify } from '../../json/module.f.ts'
import { sort } from '../../types/object/module.f.ts'

const stringify = jsonStringify(sort)

export default {
    range: () => {
        const r = stringify(range("A"))
        if (r !== '[65,65]') { throw r }
    }
}
