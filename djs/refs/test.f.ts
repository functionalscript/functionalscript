import { countRefs } from './module.f.ts'
import * as list from '../../types/object/module.f.ts'
const { sort } = list
import * as serializer from '../serializer/module.f.ts'

const stringify = serializer.stringify(sort)

export default {
    test: () => {
        const djs = [1, 2, 2, 2]
        const refs = countRefs(djs)
        if (refs.size !== 3) { throw refs.size }
        const refs0 = stringify(refs.get(djs))
        if (refs0 !== '[0,1]') { throw refs0 }
        const refs1 = stringify(refs.get(1))
        if (refs1 !== '[1,1]') { throw refs1 }
        const refs2 = stringify(refs.get(2))
        if (refs2 !== '[2,3]') { throw refs2 }
    }  
}