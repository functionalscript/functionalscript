import * as list from '../../types/object/module.f.ts'
const { sort } = list
import * as shared from './module.f.ts'
import { stringify } from '../module.f.ts'

export default {
    test: () => {        
        const djs = shared.run([1])([])
        const result = stringify(sort)(djs)
        if (result !== '1') { throw result }
    },
    testCref: () => {        
        const djs = shared.run([1, 2, 3, 4, 5, ['cref', 3]])([])
        const result = stringify(sort)(djs)
        if (result !== '4') { throw result }
    }
}
