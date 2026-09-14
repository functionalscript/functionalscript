import { run, sharing, unreached, values } from './module.f.mjs'
import { _stringifyTree } from '../module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

/** Whether the sweep finds a shared node in a body with no imports, given its values. @type {(body: import('./types.ts').AstBody) => boolean} */
const sharedOf = body => sharing(body)([])(unwrap(values(body)([]))).shared

/** What the sweep says of a body over `imports`, given the values the body has over them. @type {(imports: readonly import('./types.ts').Import[]) => (body: import('./types.ts').AstBody) => import('./types.ts').Sharing} */
const sharingWith = imports => body => sharing(body)(imports)(unwrap(values(body)(imports.map(m => m.value))))

/** @type {(module: import('./types.ts').AstModule) => string} */
const unreachedOf = module => {
    const { consts, imports } = unreached(module)
    return `consts ${consts.join()}; imports ${imports.join()}`
}

export const proof = {
    test: () => {
        const djs = unwrap(run([1])([]))
        const result = _stringifyTree(djs)
        assertEq(result, '1')
    },
    testCref: () => {
        const djs = unwrap(run([1, 2, 3, 4, 5, ['cref', 3]])([11, 12, 13, 14, 15]))
        const result = _stringifyTree(djs)
        assertEq(result, '4')
    },
    testAref: () => {
        const djs = unwrap(run([1, 2, 3, 4, 5, ['aref', 3]])([11, 12, 13, 14, 15]))
        const result = _stringifyTree(djs)
        assertEq(result, '14')
    },
    testArray: () => {
        const djs = unwrap(run([1, 2, 3, 4, 5, ['array', [['aref', 3], ['cref', 3]]]])([11, 12, 13, 14, 15]))
        const result = _stringifyTree(djs)
        assertEq(result, '[14,4]')
    },
    testObj: () => {
        const djs = unwrap(run([1, 2, 3, 4, 5, ['object', [['key', ['object', [['key2', ['array', [['aref', 3], ['cref', 3]]]]]]]]]])([11, 12, 13, 14, 15]))
        const result = _stringifyTree(djs)
        if (result !== '{"key":{"key2":[14,4]}}') { throw result }
    },
    testBool: () => {
        assertEq(_stringifyTree(unwrap(run([true])([]))), 'true')
        assertEq(_stringifyTree(unwrap(run([false])([]))), 'false')
    },
    testStr: () => {
        assertEq(_stringifyTree(unwrap(run(['hello'])([]))), '"hello"')
    },
    testNull: () => {
        assertEq(_stringifyTree(unwrap(run([null])([]))), 'null')
    },
    testBigint: () => {
        assertEq(_stringifyTree(unwrap(run([42n])([]))), '42n')
    },
    testUndefined: () => {
        assertEq(_stringifyTree(unwrap(run([undefined])([]))), 'undefined')
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
    // a property access reads its base's own property — never the
    // prototype chain — and `undefined` where there is none; a `null` or
    // `undefined` base is the failure JavaScript throws for
    access: {
        own: () => {
            assertEq(_stringifyTree(unwrap(run([['object', [['b', ['array', [1, 2]]]]], ['.', ['cref', 0], 'b']])([]))), '[1,2]')
            assertEq(unwrap(run([['object', [['b', ['array', [1, 2]]]]], ['.', ['.', ['cref', 0], 'b'], 1]])([])), 2)
            assertEq(unwrap(run([['object', [['b', ['array', [1, 2]]]]], ['.', ['.', ['cref', 0], 'b'], 'length']])([])), 2)
            assertEq(unwrap(run([['.', ['aref', 0], 'length']])(['ab'])), 2)
            assertEq(unwrap(run([['.', ['aref', 0], '0']])(['ab'])), 'a')
        },
        none: () => {
            assertEq(unwrap(run([['object', []], ['.', ['cref', 0], 'toString']])([])), undefined)
            assertEq(unwrap(run([['array', []], ['.', ['cref', 0], 'map']])([])), undefined)
            assertEq(unwrap(run([1, ['.', ['cref', 0], 'x']])([])), undefined)
            assertEq(unwrap(run([true, ['.', ['cref', 0], 'x']])([])), undefined)
            assertEq(unwrap(run([1n, ['.', ['cref', 0], 'x']])([])), undefined)
        },
        failure: () => {
            const [tag, message] = run([null, ['.', ['cref', 0], 'x']])([])
            assertEq(tag, 'error')
            assertEq(message, 'cannot read property "x" of null')
            const [tag2, message2] = run([['object', []], ['.', ['.', ['cref', 0], 'a'], 'b']])([])
            assertEq(tag2, 'error')
            assertEq(message2, 'cannot read property "b" of undefined')
            assertEq(run([undefined, ['array', [['.', ['cref', 0], 0]]]])([])[0], 'error')
            assertEq(run([undefined, ['object', [['k', ['.', ['cref', 0], 0]]]]])([])[0], 'error')
        },
        // every entry's value, in order
        all: () => {
            assertEq(_stringifyTree(unwrap(values([['array', [1]], ['.', ['cref', 0], 0], ['array', [['cref', 1], ['cref', 1]]]])([]))), '[[1],1,[1,1]]')
        },
    },
    // Two references share a node when one's keys are the other's or a
    // prefix of them, and the node they reach is a container; the values
    // say which, so `a.x` twice on a leaf `x` shares nothing.
    sharing: {
        whole: () => {
            assert(sharedOf([['array', []], ['array', [['cref', 0], ['cref', 0]]]]))
            assert(!sharedOf([1, ['array', [['cref', 0], ['cref', 0]]]]))
        },
        access: () => {
            /** @type {readonly import('./types.ts').AstConst[]} */
            const container = [['object', [['x', ['array', []]], ['y', ['array', []]]]]]
            assert(sharedOf([...container, ['array', [['.', ['cref', 0], 'x'], ['.', ['cref', 0], 'x']]]]))
            assert(sharedOf([...container, ['array', [['cref', 0], ['.', ['cref', 0], 'x']]]]))
            assert(!sharedOf([...container, ['array', [['.', ['cref', 0], 'x'], ['.', ['.', ['cref', 0], 'x'], 'length']]]]))
            assert(!sharedOf([...container, ['array', [['.', ['cref', 0], 'x'], ['.', ['cref', 0], 'y']]]]))
            assert(!sharedOf([['object', [['x', 1]]], ['array', [['.', ['cref', 0], 'x'], ['.', ['cref', 0], 'x']]]]))
            assert(!sharedOf([['object', []], ['array', [['.', ['cref', 0], 'x'], ['.', ['cref', 0], 'x']]]]))
        },
        // an entry reached through an access is walked along the access's
        // keys only: what lies under another member is not in the value
        routes: () => {
            /** @type {readonly import('./types.ts').AstConst[]} */
            const a = [['array', []], ['object', [['s', 1], ['o', ['array', [['cref', 0], ['cref', 0]]]]]]]
            assert(!sharedOf([...a, ['.', ['cref', 1], 's']]))
            assert(sharedOf([...a, ['.', ['cref', 1], 'o']]))
            assert(sharedOf([...a, ['cref', 1]]))
            assert(!sharedOf([...a, ['.', ['.', ['cref', 1], 'o'], 0]]))
            assert(!sharedOf([...a, ['array', [['.', ['cref', 1], 's'], ['.', ['cref', 1], 's']]]]))
            assert(!sharedOf([...a, ['.', ['cref', 1], 'length']]))
            assert(!sharedOf([['array', [['array', []]]], ['.', ['.', ['cref', 0], 'length'], 0]]))
        },
        // `0` and `"0"` name one element; a node inside another is reached
        // twice when both are; one node under two keys is a `const`
        // referenced twice inside the base, counted there
        keys: () => {
            assert(sharedOf([['array', [['array', []]]], ['array', [['.', ['cref', 0], 0], ['.', ['cref', 0], '0']]]]))
            assert(!sharedOf([['array', [['array', []]]], ['array', [['.', ['cref', 0], 0], ['.', ['cref', 0], '00']]]]))
            assert(sharedOf([['array', [['array', [['array', []]]]]], ['array', [['.', ['.', ['cref', 0], 0], 0], ['.', ['cref', 0], 0]]]]))
            assert(sharedOf([['array', []], ['object', [['x', ['cref', 0]], ['y', ['cref', 0]]]], ['array', [['.', ['cref', 1], 'x'], ['.', ['cref', 1], 'y']]]]))
        },
        imports: () => {
            /** @type {readonly import('./types.ts').Import[]} */
            const imports = [{ id: 'm', value: { x: [1], y: [2], z: 3 }, shared: false, reaches: [] }]
            const over = sharingWith(imports)
            assert(over([['array', [['.', ['aref', 0], 'x'], ['.', ['aref', 0], 'x']]]]).shared)
            assert(!over([['array', [['.', ['aref', 0], 'x'], ['.', ['aref', 0], 'y']]]]).shared)
            assert(!over([['array', [['.', ['aref', 0], 'z'], ['.', ['aref', 0], 'z']]]]).shared)
            assert(over([['array', [['aref', 0], ['.', ['aref', 0], 'x']]]]).shared)
            assert(!over([['array', [['aref', 0], ['.', ['aref', 0], 'z']]]]).shared)
            assertEq(over([['array', [['.', ['aref', 0], 'x'], ['.', ['aref', 0], 'y']]]]).reaches.join(), 'm')
            assertEq(over([['array', [['.', ['aref', 0], 'z']]]]).reaches.join(), '')
            // an import the export does not reach is not reached, whatever it holds
            /** @type {readonly import('./types.ts').Import[]} */
            const two = [...imports, { id: 'n', value: [1], shared: false, reaches: [] }]
            assertEq(sharing([['.', ['aref', 0], 'x']])(two)([[1]]).reaches.join(), 'm')
            // a module's id may spell a `const`'s index, and is another group
            /** @type {readonly import('./types.ts').Import[]} */
            const zero = [{ id: '0', value: [], shared: false, reaches: [] }]
            assert(!sharingWith(zero)([['array', []], ['array', [['cref', 0], ['aref', 0]]]]).shared)
        },
    },
}
