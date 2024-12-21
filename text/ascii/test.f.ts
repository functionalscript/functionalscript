import * as _ from './module.f.ts'
const { range } = _
import * as json from '../../json/module.f.ts'
import * as o from '../../types/object/module.f.ts'
const { sort } = o

const stringify = json.stringify(sort)

export default {
    range: () => {
        const r = stringify(range("A"))
        if (r !== '[65,65]') { throw r }
    }
}
