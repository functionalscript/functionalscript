import { run, sharing, unreached } from './module.f.mjs'
import { _stringifyTree } from '../module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

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
        // a member a later duplicate shadows is applied by the EDAG's object
        // constructor, so a reference in it reaches, where for sharing it
        // does not
        shadowed: () => {
            assertEq(unreachedOf([['./a'], [['array', []], ['object', [['x', ['cref', 0]], ['x', ['aref', 0]], ['x', 0]]]]]), 'consts ; imports ')
        },
        consts: () => {
            assertEq(unreachedOf([[], [['array', []], 1]]), 'consts 0; imports ')
            assertEq(unreachedOf([[], [['array', []], ['cref', 0], ['array', [['cref', 0]]], ['cref', 0]]]), 'consts 1,2; imports ')
        },
        // an access reaches its base
        access: () => {
            assertEq(unreachedOf([[], [['object', []], ['.', ['cref', 0], 'x']]]), 'consts ; imports ')
            assertEq(unreachedOf([['./a'], [['array', [['.', ['aref', 0], 0]]]]]), 'consts ; imports ')
        },
        imports: () => {
            assertEq(unreachedOf([['./a'], [1]]), 'consts ; imports 0')
            assertEq(unreachedOf([['./a', './b'], [['aref', 1]]]), 'consts ; imports 0')
            assertEq(unreachedOf([['./a', './b'], [['aref', 1], 1]]), 'consts 0; imports 0,1')
        },
    },
    // an access is taken as a container by the sharing sweep: what it
    // denotes is the value's to say, and refusing is the safe answer
    sharing: {
        accessTwice: () => {
            assert(sharing([['object', []], ['.', ['cref', 0], 'x'], ['array', [['cref', 1], ['cref', 1]]]])([]).shared)
            assert(!sharing([['object', []], ['.', ['cref', 0], 'x'], ['array', [['cref', 1]]]])([]).shared)
        },
    },
    // an access has no value yet: `transpile` refuses a module holding one
    // before it runs the body, and the branch says so
    throw: {
        access: () => run([['object', []], ['.', ['cref', 0], 'x']])([]),
    },
}
