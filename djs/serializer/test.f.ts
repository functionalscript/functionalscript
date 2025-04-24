import { countRefs, stringify } from './module.f.ts'
import * as list from '../../types/object/module.f.ts'
const { sort } = list
import * as serializer from '../serializer-old/module.f.ts'
import { identity } from '../../types/function/module.f.ts'

const stringifyOld = serializer.stringify(sort)

export default {
    testPrimitives: () => {
        const djs = [1, 2, 2, 2, true, false, undefined, null, 3n, "str"]
        const refs = countRefs(djs)
        if (refs.size !== 3) { throw refs.size }
        const refsBigInt = stringifyOld(refs.get(3n))
        if (refsBigInt !== '[0,1,false]') { throw refsBigInt }
        const refsString = stringifyOld(refs.get("str"))
        if (refsString !== '[1,1,false]') { throw refsString }        
        const refsRoot = stringifyOld(refs.get(djs))
        if (refsRoot !== '[2,1,false]') { throw refsRoot }
        if (refs.get(null) !== undefined) { throw refs.get(null) }
    },
    testArray: () => {
        const array = [null]
        const djs = [array,array,array]
        const refs = countRefs(djs)
        if (refs.size !== 2) { throw refs.size }
        const refsArray = stringifyOld(refs.get(array))
        if (refsArray !== '[0,3,false]') { throw refsArray }
        const refsRoot = stringifyOld(refs.get(djs))
        if (refsRoot !== '[1,1,false]') { throw refsRoot }
    },
    testObj: () => {
        const obj = {"a": 1, "b": 2}
        const djs = [obj, obj, 1]
        const refs = countRefs(djs)
        if (refs.size !== 2) { throw refs.size }            
        const refsObj = stringifyOld(refs.get(obj))
        if (refsObj !== '[0,2,false]') { throw refsObj }
        const refsRoot = stringifyOld(refs.get(djs))
        if (refsRoot !== '[1,1,false]') { throw refsRoot }    
    },
    testSort: () => {
        const obj = {"a": 1, "c": 2n, "b": [undefined, null, true, false]}
        const djs = [obj, obj, 1]
        const res = stringify(sort)(djs)
        if (res !== 'const c2 = {"a":1,"b":[undefined,null,true,false],"c":2n}\nexport default [c2,c2,1]') { throw res }
    },
    testIdentity: () => {
        const obj = {"a": 1, "c": 2n, "b": [undefined, null, true, false]}
        const djs = [obj, obj, 1]
        const res = stringify(identity)(djs)
        if (res !== 'const c2 = {"a":1,"c":2n,"b":[undefined,null,true,false]}\nexport default [c2,c2,1]') { throw res }
    }
}