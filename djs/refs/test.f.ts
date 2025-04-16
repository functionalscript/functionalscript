import { countRefs, serializeWithConstants } from './module.f.ts'
import * as list from '../../types/object/module.f.ts'
const { sort } = list
import * as serializer from '../serializer/module.f.ts'

const stringify = serializer.stringify(sort)

export default {
    testPrimitives: () => {
        const djs = [1, 2, 2, 2, true, false, undefined, null, 3n, "str"]
        const refs = countRefs(djs)
        if (refs.size !== 5) { throw refs.size }
        const refs1 = stringify(refs.get(1))
        if (refs1 !== '[0,1,false]') { throw refs1 }
        const refs2 = stringify(refs.get(2))
        if (refs2 !== '[1,3,false]') { throw refs2 }
        const refsBigInt = stringify(refs.get(3n))
        if (refsBigInt !== '[2,1,false]') { throw refsBigInt }
        const refsString = stringify(refs.get("str"))
        if (refsString !== '[3,1,false]') { throw refsString }        
        const refsRoot = stringify(refs.get(djs))
        if (refsRoot !== '[4,1,false]') { throw refsRoot }
        if (refs.get(null) !== undefined) { throw refs.get(null) }
    },
    testArray: () => {
        const array = [null]
        const djs = [array,array,array]
        const refs = countRefs(djs)
        if (refs.size !== 2) { throw refs.size }
        const refsArray = stringify(refs.get(array))
        if (refsArray !== '[0,3,false]') { throw refsArray }
        const refsRoot = stringify(refs.get(djs))
        if (refsRoot !== '[1,1,false]') { throw refsRoot }
    },
    testObj: () => {
        const obj = {"a": 1, "b": 2}
        const djs = [obj, obj, 1]
        const refs = countRefs(djs)
        if (refs.size !== 4) { throw refs.size }    
        const refs1 = stringify(refs.get(1))
        if (refs1 !== '[0,2,false]') { throw refs1 }
        const refs2 = stringify(refs.get(2))
        if (refs2 !== '[1,1,false]') { throw refs2 }
        const refsObj = stringify(refs.get(obj))
        if (refsObj !== '[2,2,false]') { throw refsObj }
        const refsRoot = stringify(refs.get(djs))
        if (refsRoot !== '[3,1,false]') { throw refsRoot }    
    },
    testSerialization: () => {
        const obj = {"a": 1, "b": 2}
        const djs = [obj, obj, 1]
        const res = serializeWithConstants(sort)(djs)
        if (res !== 'const c0 = 1\nconst c2 = {"a":c0,"b":2}\nexport default [c2,c2,c0]') { throw res }
    }    
}