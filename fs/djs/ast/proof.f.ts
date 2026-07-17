import { sort } from '../../types/object/module.f.ts'
import { run } from './module.f.ts'
import { stringifyAsTree } from '../serializer/module.f.ts'
import { assert, assertEq } from '../../asserts/module.f.ts'

export const proof = {
    test: () => {
        const djs = run([1])([])
        const result = stringifyAsTree(sort)(djs)
        assert(result === '1', result)
    },
    testCref: () => {
        const djs = run([1, 2, 3, 4, 5, ['cref', 3]])([11, 12, 13, 14, 15])
        const result = stringifyAsTree(sort)(djs)
        assert(result === '4', result)
    },
    testAref: () => {
        const djs = run([1, 2, 3, 4, 5, ['aref', 3]])([11, 12, 13, 14, 15])
        const result = stringifyAsTree(sort)(djs)
        assert(result === '14', result)
    },
    testArray: () => {
        const djs = run([1, 2, 3, 4, 5, ['array', [['aref', 3], ['cref', 3]]]])([11, 12, 13, 14, 15])
        const result = stringifyAsTree(sort)(djs)
        assert(result === '[14,4]', result)
    },
    testObj: () => {
        const djs = run([1, 2, 3, 4, 5, {"key": { "key2": ['array', [['aref', 3], ['cref', 3]]]}}])([11, 12, 13, 14, 15])
        const result = stringifyAsTree(sort)(djs)
        if (result !== '{"key":{"key2":[14,4]}}') { throw result }
    },
    testBool: () => {
        assertEq(stringifyAsTree(sort)(run([true])([])), 'true')
        assertEq(stringifyAsTree(sort)(run([false])([])), 'false')
    },
    testStr: () => {
        assertEq(stringifyAsTree(sort)(run(['hello'])([])), '"hello"')
    },
    testNull: () => {
        assertEq(stringifyAsTree(sort)(run([null])([])), 'null')
    },
    testBigint: () => {
        assertEq(stringifyAsTree(sort)(run([42n])([])), '42n')
    },
    testUndefined: () => {
        assertEq(stringifyAsTree(sort)(run([undefined])([])), 'undefined')
    },
}
