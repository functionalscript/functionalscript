import * as _ from './module.f.mjs'
const { range } = _
import * as json from '../../json/module.f.mjs'
import o from '../../types/object/module.f.mjs'
const { sort } = o

const stringify = json.stringify(sort)

export default {
    range: () => {
        const r = stringify(range("A"))
        if (r !== '[65,65]') { throw r }
    }
}