import { range } from './module.f.ts'
import * as json from '../../json/module.f.ts'
import { sort } from '../../types/object/module.f.ts'

const stringify = json.stringify(sort)

export default {
    range: () => {
        const r = stringify(range("A"))
        if (r !== '[65,65]') { throw r }
    }
}
