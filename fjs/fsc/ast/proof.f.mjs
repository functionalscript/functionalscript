import { run } from './module.f.mjs'
import { _stringifyTree } from '../module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

export const proof = {
    test: () => {
        const djs = run([1])([])
        const result = _stringifyTree(djs)
        assertEq(result, '1')
    },
    testCref: () => {
        const djs = run([1, 2, 3, 4, 5, ['cref', 3]])([11, 12, 13, 14, 15])
        const result = _stringifyTree(djs)
        assertEq(result, '4')
    },
    testAref: () => {
        const djs = run([1, 2, 3, 4, 5, ['aref', 3]])([11, 12, 13, 14, 15])
        const result = _stringifyTree(djs)
        assertEq(result, '14')
    },
    testArray: () => {
        const djs = run([1, 2, 3, 4, 5, ['array', [['aref', 3], ['cref', 3]]]])([11, 12, 13, 14, 15])
        const result = _stringifyTree(djs)
        assertEq(result, '[14,4]')
    },
    testObj: () => {
        const djs = run([1, 2, 3, 4, 5, {"key": { "key2": ['array', [['aref', 3], ['cref', 3]]]}}])([11, 12, 13, 14, 15])
        const result = _stringifyTree(djs)
        if (result !== '{"key":{"key2":[14,4]}}') { throw result }
    },
    testBool: () => {
        assertEq(_stringifyTree(run([true])([])), 'true')
        assertEq(_stringifyTree(run([false])([])), 'false')
    },
    testStr: () => {
        assertEq(_stringifyTree(run(['hello'])([])), '"hello"')
    },
    testNull: () => {
        assertEq(_stringifyTree(run([null])([])), 'null')
    },
    testBigint: () => {
        assertEq(_stringifyTree(run([42n])([])), '42n')
    },
    testUndefined: () => {
        assertEq(_stringifyTree(run([undefined])([])), 'undefined')
    },
}
