import * as list from '../../types/object/module.f.ts'
const { sort } = list
import * as shared from './module.f.ts'
import { stringifyAsTree } from '../serializer/module.f.ts'

export default {
    test: () => {
        const djs = shared.run([1])([])
        const result = stringifyAsTree(sort)(djs)
        if (result !== '1') { throw result }
    },
    testCref: () => {
        const djs = shared.run([1, 2, 3, 4, 5, ['cref', 3]])([11, 12, 13, 14, 15])
        const result = stringifyAsTree(sort)(djs)
        if (result !== '4') { throw result }
    },
    testAref: () => {
        const djs = shared.run([1, 2, 3, 4, 5, ['aref', 3]])([11, 12, 13, 14, 15])
        const result = stringifyAsTree(sort)(djs)
        if (result !== '14') { throw result }
    },
    testArray: () => {
        const djs = shared.run([1, 2, 3, 4, 5, ['array', [['aref', 3], ['cref', 3]]]])([11, 12, 13, 14, 15])
        const result = stringifyAsTree(sort)(djs)
        if (result !== '[14,4]') { throw result }
    },
    testObj: () => {
        const djs = shared.run([1, 2, 3, 4, 5, {"key": { "key2": ['array', [['aref', 3], ['cref', 3]]]}}])([11, 12, 13, 14, 15])
        const result = stringifyAsTree(sort)(djs)
        if (result !== '{"key":{"key2":[14,4]}}') { throw result }
    },    
}
