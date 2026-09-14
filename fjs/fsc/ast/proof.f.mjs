import { run, unreached } from './module.f.mjs'
import { _stringifyTree } from '../module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

/** @type {(module: import('./types.ts').AstModule) => string} */
const unreachedOf = module => {
    const { consts, imports } = unreached(module)
    return `consts ${consts.join()}; imports ${imports.join()}`
}

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
        const djs = run([1, 2, 3, 4, 5, ['object', [['key', ['object', [['key2', ['array', [['aref', 3], ['cref', 3]]]]]]]]]])([11, 12, 13, 14, 15])
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
    // what the sweep from the export leaves out, by index
    unreached: {
        nothing: () => {
            assertEq(unreachedOf([[], [1]]), 'consts ; imports ')
            assertEq(unreachedOf([['./a'], [['aref', 0]]]), 'consts ; imports ')
            assertEq(unreachedOf([['./a'], [['aref', 0], ['cref', 0]]]), 'consts ; imports ')
            assertEq(unreachedOf([['./a'], [['array', []], ['object', [['k', ['array', [['cref', 0], ['aref', 0]]]]]]]]), 'consts ; imports ')
        },
        consts: () => {
            assertEq(unreachedOf([[], [['array', []], 1]]), 'consts 0; imports ')
            assertEq(unreachedOf([[], [['array', []], ['cref', 0], ['array', [['cref', 0]]], ['cref', 0]]]), 'consts 1,2; imports ')
        },
        imports: () => {
            assertEq(unreachedOf([['./a'], [1]]), 'consts ; imports 0')
            assertEq(unreachedOf([['./a', './b'], [['aref', 1]]]), 'consts ; imports 0')
            assertEq(unreachedOf([['./a', './b'], [['aref', 1], 1]]), 'consts 0; imports 0,1')
        },
    },
}
