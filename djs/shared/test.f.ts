import * as list from '../../types/object/module.f.ts'
const { sort } = list
import * as shared from './module.f.ts'
import { stringify } from '../module.f.ts'

export default {
    test: () => {        
        const djs = shared.run([1])([])
        const result = stringify(sort)(djs)
        if (result !== '1') { throw result }
    }
}
