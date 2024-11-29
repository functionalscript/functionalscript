import _ from './module.f.mjs'
const { range } = _
import json from '../../json/module.f.mjs'
import { sort } from '../../types/object/module.f.cjs'

const stringify = json.stringify(sort)

export default {
    range: () => {
        const r = stringify(range("A"))
        if (r !== '[65,65]') { throw r }
    }
}