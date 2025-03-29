import { countRefs } from './module.f.ts'
import * as list from '../../types/object/module.f.ts'
const { sort } = list
import * as serializer from '../serializer/module.f.ts'

const stringify = serializer.stringify(sort)

export default {
    test: () => {
        const djs = [1, 2, 2, 2, true, false, undefined, null, 3n, "str"]
        const refs = countRefs(djs)
        if (refs.size !== 5) { throw refs.size }
        const refsRoot = stringify(refs.get(djs))
        if (refsRoot !== '[0,1]') { throw refsRoot }
        const refs1 = stringify(refs.get(1))
        if (refs1 !== '[1,1]') { throw refs1 }
        const refs2 = stringify(refs.get(2))
        if (refs2 !== '[2,3]') { throw refs2 }
        const refsBigInt = stringify(refs.get(3n))
        if (refsBigInt !== '[3,1]') { throw refsBigInt }
        const refsString = stringify(refs.get("str"))
        if (refsString !== '[4,1]') { throw refsString }
    },
    testObj: () => {
        const obj = {"a": 1, "b": 2}
        const djs = [obj, obj, 1]
        const refs = countRefs(djs)
        if (refs.size !== 4) { throw refs.size }
        const refsRoot = stringify(refs.get(djs))
        if (refsRoot !== '[0,1]') { throw refsRoot }
        const refsObj = stringify(refs.get(obj))
        if (refsObj !== '[1,2]') { throw refsObj }
        const refs1 = stringify(refs.get(1))
        if (refs1 !== '[2,2]') { throw refs1 }
        const refs2 = stringify(refs.get(2))
        if (refs2 !== '[3,1]') { throw refs2 }
    }
}