/**
 * Execute prepared JavaScript output at its actual host boundary. These cases
 * verify parse-sensitive grouping, lazy chain regions, captures and physical
 * transfers; the serializer itself remains a pure text transformation.
 *
 * @import { BindingId } from '../types.ts'
 * @import { Block, Function as PreparedFunction, Value } from '../prepare/types.ts'
 */

import { throws } from 'node:assert/strict'
import { assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { untagged } from '../../../text/marked/module.f.mjs'
import { functionStringify, renderModule, stringify } from './module.f.mjs'

/** @type {(index: number) => BindingId} */
const id = index => ({ index })

/** @type {(value: Value) => Block} */
const yielding = value => ({ statements: [], exit: ['yield', [value]] })

/** Prepared choice fixtures; source logical lowering is tested in sugar. @type {(condition: Value, then: Value, otherwise: Value) => Value} */
const choice = (condition, then, otherwise) => ['if', condition, yielding(then), yielding(otherwise)]

/** @type {(block: Block, runtime?: boolean) => any} */
const runBlock = (block, runtime = true) => Function(`"use strict";return (${stringify(block, 'expression', runtime)});`)()

/** @type {(value: Value) => any} */
const run = value => runBlock(yielding(value))

/** @type {(fn: PreparedFunction, external?: readonly unknown[]) => (...args: readonly unknown[]) => any} */
const compile = (fn, external = []) => Function(...external.map((_, index) => `$${index}`), `"use strict";return (${functionStringify(fn)});`)(...external)

export const proof = {
    expressions: () => {
        const andValue = choice(true, 1, true)
        const nullishValue = choice(choice(['===', undefined, null], true, ['===', undefined, undefined]), 2, undefined)
        const blocked = /** @type {Value} */ (['block', yielding(andValue)])
        /** @type {readonly (readonly [Value, unknown])[]} */
        const cases = [
            [undefined, undefined], [NaN, NaN], [-0, -0], [4n, 4n],
            [['+', 1, ['*', 2, 3]], 7], [['-', 10, ['-', 4, 1]], 7],
            [['+', 1, ['+', 2]], 3], [['-', 3, -1], 4],
            [['**', ['**', 2, 3], 2], 64], [['**', 2, ['**', 3, 2]], 512],
            [['**', ['-', 2], 2], 4], [['-', ['-', 2]], 2],
            [['**', -2, 2], 4], [['**', -0, 2], 0], [['**', -2n, 2n], 4n],
            [['**', ['block', yielding(['block', yielding(-2)])], 2], 4],
            [['~', 1], -2], [['!', 1], false], [['typeof', 2], 'number'],
            [['Number', '2'], 2], [['String', 2], '2'],
            [choice(false, false, 2), 2], [choice(true, 2, true), 2], [nullishValue, 2],
            [choice(choice(['===', andValue, null], true, ['===', andValue, undefined]), 2, andValue), 1], [choice(true, nullishValue, true), 2],
            [choice(choice(['===', blocked, null], true, ['===', blocked, undefined]), 2, blocked), 1],
            [['|', 1, 2], 3], [['^', 1, 3], 2], [['&', 3, 1], 1],
            [['===', 1, 2], false], [['!==', 1, 2], true],
            [['<', 1, 2], true], [['<=', 1, 1], true], [['>', 2, 1], true], [['>=', 2, 2], true],
            [['<<', 1, 2], 4], [['>>', 8, 2], 2], [['>>>', -1, 2], 0x3fff_ffff],
            [['*', 2, 3], 6], [['/', 4, 2], 2], [['%', 5, 2], 1],
            [['instanceof', ['array', []], 'Array'], true],
            [[',', []], undefined], [[',', [1, 2]], 2],
            [['?:', false, ['block', { statements: [], exit: ['throw', 1] }], 2], 2],
            [['array', [1, ['...', ['array', [2, 3]]]]], [1, 2, 3]],
            [['.', ['array', [8]], 0], 8], [['.', 1, 'x'], undefined], [['.', 2n, 'x'], undefined],
            [['.', ['object', [[':', 'NaN', 3], [':', 'x', 9]]], ['Number', 'x']], 3],
            [['.', ['entry'], 'length'], 2], [['.', ['hasEntry'], 'length'], 2], [['.', ['slice'], 'length'], 3],
            [['()', ['entry'], [['object', [[':', 'x', 3]]], 'x']], 3],
            [['()', ['hasEntry'], [['object', [[':', 'x', undefined]]], 'x']], true],
            [['()', ['slice'], ['abcd', 1, 3]], 'bc'], [['()', ['Object.is'], [0, -0]], false],
        ]
        for (const [value, expected] of cases) { assertStructurallySame(run(value), expected) }
        const object = run(['object', [
            [':', '__proto__', 3],
            [':', ['+', 'x', 'y'], 4],
            ['...', ['object', [[':', 'z', 5]]]],
        ]])
        assertEq(Object.getOwnPropertyDescriptor(object, '__proto__')?.value, 3)
        assertEq(object.xy, 4)
        assertEq(object.z, 5)
        throws(() => run(['block', { statements: [], exit: ['throw', 1] }]))
        throws(() => run(['()', -1, []]), TypeError)
        throws(() => run(['?.()', -1n, []]), TypeError)
    },
    chains: () => {
        /** @type {Value} */
        const failure = ['block', { statements: [], exit: ['throw', 1] }]
        assertEq(run(['?.', null, ['Number', failure]]), undefined)
        assertEq(run(['?.()', undefined, [failure]]), undefined)
        assertEq(run(['?.', null, 'f', ['|()', [failure], ['|.', ['Number', failure]]]]), undefined)
        assertEq(run(['.', ['object', [[':', 'f', undefined]]], 'f', ['|?.()', [failure], ['|.', 'x']]]), undefined)
        assertEq(run(['.', 'abcd', 'slice', ['|?.()', [1, 3], ['|.', 'length']]]), 2)
        assertEq(run(['?.', 'abcd', 'slice', ['|()', [1, 3], ['|.', 'length']]]), 2)
        assertEq(run(['?.', 'abcd', 'slice', ['|!()', [1, 3]]]), 'bc')
        throws(() => run(['?.', null, 'f', ['|!()', [failure]]]))
        throws(() => run(['.', null, 'f', ['|()', [failure]]]))
        throws(() => run(['.', ['block', yielding(['?.', null, 'x'])], 'y']))
        throws(() => run(['.', ['block', yielding(['?.()', undefined, []])], 'y']))
        throws(() => run(['.', ['.', ['object', [[':', 'f', undefined]]], 'f', ['|?.()', []]], 'y']))
        throws(() => run(['.', failure, 'x']))
        throws(() => run(['*', failure, 2]))
        const local = id(0)
        assertEq(run(['.', ['block', { statements: [['define', local, ['array', []]]], exit: ['yield', [['ref', local]]] }], 'length']), 0)
        assertEq(run(['*', ['block', { statements: [['define', local, 3]], exit: ['yield', [['ref', local]]] }], 2]), 6)
        assertEq(run(['.', ['.', 'abcd', 'slice', ['|()', [0, 1]]], 'length']), 1)
    },
    functionBoundaries: () => {
        const target = { kind: /** @type {const} */ ('function'), index: 0 }
        const parameter = id(0)
        const rest = id(1)
        const self = id(2)
        const capture = id(3)
        const binding = id(4)
        /** @type {PreparedFunction} */
        const fn = { target, parameters: [parameter], rest, self: null, captures: [], body: { statements: [], exit: ['return', target, ['array', [['ref', parameter], ['...', ['ref', rest]]]]] } }
        const compiled = compile(fn)
        assertEq(compiled.length, 1)
        assertStructurallySame(compiled(1, 2, 3), [1, 2, 3])
        assertEq(compile({ ...fn, parameters: [], rest: null, captures: [{ binding: capture, value: 0 }], body: { statements: [], exit: ['return', target, ['ref', capture]] } }, [9])(), 9)
        const recursive = compile({ ...fn, parameters: [], rest: null, self, body: { statements: [], exit: ['return', target, ['ref', self]] } })
        assertEq(recursive(), recursive)
        const sourceRecursive = runBlock({ statements: [['define', binding, ['function', { ...fn, parameters: [], rest: null, self, body: { statements: [], exit: ['return', target, ['ref', self]] } }]]], exit: ['yield', [['ref', binding]]] }, false)
        assertEq(sourceRecursive(), sourceRecursive)
        const closure = run(['function', { ...fn, parameters: [], rest: null, captures: [{ binding: capture, value: ['array', [7]] }], body: { statements: [], exit: ['return', target, ['ref', capture]] } }])
        assertStructurallySame(closure(), [7])
        const secondCapture = id(5)
        const reordered = compile({ ...fn, parameters: [], rest: null, captures: [{ binding: capture, value: 0 }, { binding: secondCapture, value: 0 }], body: { statements: [], exit: ['return', target, ['array', [['ref', secondCapture], ['ref', capture]]]] } }, [8, 9])
        assertStructurallySame(reordered(), [9, 8])
        const shared = id(6)
        const repeated = runBlock({ statements: [['define', shared, ['array', []]]], exit: ['yield', [['function', { ...fn, parameters: [], rest: null, captures: [{ binding: capture, value: ['ref', shared] }, { binding: secondCapture, value: ['ref', shared] }], body: { statements: [], exit: ['return', target, ['array', [['ref', capture], ['ref', secondCapture]]]] } }]]] })()
        assertEq(repeated[0], repeated[1])
        /** @type {PreparedFunction} */
        let nested = { ...fn, parameters: [], rest: null, captures: [], body: { statements: [], exit: ['return', target, 7] } }
        for (let depth = 0; depth < 27; ++depth) {
            nested = { ...fn, parameters: [], rest: null, captures: [{ binding: id(depth + 10), value: 0 }], body: { statements: [], exit: ['return', target, ['function', nested]] } }
        }
        let result = compile(nested)
        for (let depth = 0; depth < 27; ++depth) { result = result() }
        assertEq(result(), 7)
    },
    physicalInstructions: () => {
        const slot = id(0)
        const result = id(1)
        const memo = id(2)
        const valueSlot = id(3)
        const doneSlot = id(4)
        const loop = { kind: /** @type {const} */ ('loop'), index: 0 }
        const iterations = runBlock({
            statements: [
                ['slot', slot, 0, true],
                ['loop', loop, { statements: [['if', ['<', ['ref', slot], 3], { statements: [['write', slot, ['+', ['ref', slot], 1]]], exit: ['continue', loop] }, { statements: [], exit: ['break', loop] }]], exit: ['continue', loop] }],
            ],
            exit: ['yield', [['ref', slot]]],
        })
        assertEq(iterations, 3)
        const nestedLoop = { kind: /** @type {const} */ ('loop'), index: 0 }
        assertEq(runBlock({ statements: [['loop', loop, {
            statements: [['loop', nestedLoop, { statements: [], exit: ['break', loop] }]],
            exit: ['continue', loop],
        }]], exit: ['yield', [4]] }), 4)
        assertEq(runBlock({ statements: [['while', { target: loop, slot, initial: 0, condition: ['<', ['ref', slot], 3], body: { statements: [['write', slot, ['+', ['ref', slot], 1]]], exit: ['yield', []] }, result, mutable: true }]], exit: ['yield', [['ref', result]]] }), 3)
        /** @type {Block} */
        const memoBlock = { statements: [['memo', { binding: memo, valueSlot, doneSlot, initializer: yielding(['array', []]) }]], exit: ['yield', [['array', [['demand', memo], ['demand', memo]]]]] }
        const first = runBlock(memoBlock)
        const second = runBlock(memoBlock)
        assertEq(first[0], first[1])
        assertEq(first[0] === second[0], false)
    },
    moduleBoundary: async () => {
        const shared = id(0)
        const text = untagged(renderModule({
            statements: [['define', shared, ['array', [3]]]],
            exit: ['yield', [['object', [
                [':', 'default', ['ref', shared]],
                [':', 'named', ['ref', shared]],
            ]]]],
        }))
        const module = await import(`data:text/javascript,${encodeURIComponent(text)}`)
        assertEq(module.default, module.named)
        assertStructurallySame(module.named, [3])
        const factory = await import(`data:text/javascript,${encodeURIComponent(stringify(yielding(4), 'factory'))}`)
        assertEq(factory.default(), 4)
    },
}
