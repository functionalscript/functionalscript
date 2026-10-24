/**
 * Root-loop reconstruction preserves the existing function boundary only for
 * the canonical invocation layout; aliases introduce no invocation setup.
 *
 * @import { Block, Function as FastFunction, Loop, Value } from '../../../js/ast/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { aggregateHelper, invocationAliases, namesBinding, readsEntryParameters, rootLoopOf, scalarHelper } from './module.f.mjs'

const parameter = { index: 0 }
const state = { index: 1 }
const result = { index: 2 }
const alias = { index: 3 }
const other = { index: 4 }
const target = /** @type {const} */ ({ kind: 'function', index: 0 })
const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })

/** @type {Loop} */
const loop = {
    target: loopTarget,
    parameters: [state],
    initial: [['ref', parameter]],
    results: [result],
    body: { statements: [], exit: ['break', loopTarget, [['ref', state]]] },
}

/** @type {(body: Block) => FastFunction} */
const fn = body => ({ target, parameters: [parameter], rest: null, self: null, captures: [], body })

/** @type {(loop: Loop) => FastFunction} */
const root = loop => fn({ statements: [['loop', loop]], exit: ['return', target, ['ref', result]] })

export const proof = {
    // A `ref` to the binding names it; a `ref` to another binding, and a
    // primitive, do not.
    namesBinding: () => {
        assert(namesBinding(['ref', state], state))
        assert(!namesBinding(['ref', other], state))
        assert(!namesBinding(1, state))
    },
    invocationAliases: () => {
        const value = { ...fn({ statements: [], exit: ['yield', []] }), parameters: [parameter, state], self: other, captures: [{ binding: result, value: 1 }] }
        assertStructurallySame(invocationAliases(value, [
            ['define', alias, ['ref', state], 'lazy'],
            ['define', { index: 5 }, ['ref', result], 'lazy'],
            ['define', { index: 6 }, ['ref', other], 'lazy'],
        ]), [[parameter], [state, alias]])
        assertStructurallySame(invocationAliases({ ...value, parameters: [] }, []), [])
    },
    entryParameters: () => {
        assertEq(readsEntryParameters(loop, [[parameter, alias]]), false)
        const retained = { ...loop, body: { statements: [], exit: /** @type {Block['exit']} */ (['break', loopTarget, [['ref', parameter]]]) } }
        assertEq(readsEntryParameters(retained, [[parameter, alias]]), true)
        assertEq(rootLoopOf(root(retained)), null)
    },
    helper: () => {
        const captured = { ...loop, body: { ...loop.body, statements: /** @type {Block['statements']} */ ([['define', alias, ['array', [['ref', other], ['ref', other]]], 'required']]) } }
        const helper = scalarHelper(captured)
        assertEq(helper.parameters[0], state)
        assertStructurallySame(helper.captures, [{ binding: other, value: ['ref', other] }])
        assertEq(helper.rest, null)
        assertEq(helper.self, null)
        assert(rootLoopOf(helper) !== null)
    },
    aggregateHelper: () => {
        // Presentation indices deliberately coincide; the state, invocation
        // input, result and captures keep separate resolved identities.
        const first = { index: 0 }, second = { index: 0 }, local = { index: 0 }
        const definition = /** @type {const} */ (['define', local, ['array', [['ref', second], ['ref', state], ['ref', first], ['ref', second]]], 'required'])
        const source = /** @type {Loop} */ ({ ...loop, parameters: [state, alias], initial: [1, 2], results: [result, other],
            body: { statements: [definition], exit: ['break', loopTarget, [['ref', local], ['ref', alias]]] } })
        const helper = aggregateHelper(source)
        const packed = rootLoopOf(helper)
        assert(packed !== null)
        assertEq(helper.parameters.length, 1)
        assertEq(helper.rest, null)
        assertEq(helper.self, null)
        assertEq(helper.target.index, loopTarget.index)
        assertEq(packed.target, loopTarget)
        assertEq(packed.parameters.length, 1)
        assertEq(packed.results.length, 1)
        const identities = [helper.parameters[0], packed.parameters[0], packed.results[0]]
        assertEq(new Set(identities).size, 3)
        for (const identity of identities) {
            assertEq(identity.index, loopTarget.index)
            assert(!source.parameters.includes(identity))
            assert(!source.results.includes(identity))
        }
        assertStructurallySame(helper.captures, [{ binding: second, value: ['ref', second] }, { binding: first, value: ['ref', first] }])
        assertEq(helper.captures[0].binding, second)
        assertEq(helper.captures[1].binding, first)
        assertStructurallySame(packed.initial, [['ref', helper.parameters[0]]])
        assertStructurallySame(helper.body.exit, ['return', helper.target, ['ref', packed.results[0]]])
        assertStructurallySame(packed.body.statements.slice(0, 2), [
            ['define', state, ['.', ['ref', packed.parameters[0]], 0], 'lazy'],
            ['define', alias, ['.', ['ref', packed.parameters[0]], 1], 'lazy'],
        ])
        assertEq(packed.body.statements[2], definition)
        assertStructurallySame(packed.body.exit, ['break', loopTarget, [['array', [['ref', local], ['ref', alias]]]]])
        const another = aggregateHelper(source)
        assert(another.target !== helper.target)
        assert(another.parameters[0] !== helper.parameters[0])
    },
    aggregateResultSignatures: () => {
        // Every normal result is an aggregate, including zero and one result;
        // the state and result signatures are independent.
        for (const values of /** @type {readonly (readonly Value[])[]} */ ([[], [7], [1, ['array', [2]], 3]])) {
            const source = { ...loop, parameters: [], initial: [], results: values.map((_, index) => ({ index })),
                body: { statements: [], exit: /** @type {Block['exit']} */ (['break', loopTarget, values]) } }
            const helper = aggregateHelper(source)
            const packed = rootLoopOf(helper)
            assert(packed !== null)
            assertEq(packed.body.statements.length, 0)
            assertEq(helper.captures.length, 0)
            assertStructurallySame(packed.body.exit, ['break', loopTarget, [['array', values]]])
        }
    },
    aggregateDeepRegions: () => {
        /** @type {Block} */
        let region = { statements: [], exit: ['break', loopTarget, []] }
        for (let depth = 0; depth < 20_000; ++depth) {
            region = { statements: [['block', [], region]], exit: ['continue', loopTarget, []] }
        }
        const packed = rootLoopOf(aggregateHelper({ ...loop, parameters: [], initial: [], results: [], body: region }))
        assert(packed !== null)
        let nested = packed.body
        for (let depth = 0; depth < 20_000; ++depth) {
            assertStructurallySame(nested.exit, ['continue', loopTarget, [['array', []]]])
            const statement = nested.statements[0]
            assert(statement[0] === 'block')
            nested = statement[2]
        }
        assertStructurallySame(nested.exit, ['break', loopTarget, [['array', []]]])
    },
    aggregateStatementRegions: () => {
        const local = { index: 5 }
        const nestedTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const nested = /** @type {Value} */ (['function', { target: nestedTarget, parameters: [], rest: null, self: null, captures: [],
            body: { statements: [], exit: ['return', nestedTarget, 9] } }])
        const definition = /** @type {const} */ (['define', local, nested, 'required'])
        const yielded = /** @type {Block['exit']} */ (['yield', []])
        const thrown = /** @type {Block['exit']} */ (['throw', 'failure'])
        const inner = { ...loop, target: /** @type {const} */ ({ kind: 'loop', index: 0 }) }
        const innerStatement = /** @type {const} */ (['loop', inner])
        const source = /** @type {Loop} */ ({ ...loop, body: {
            statements: [definition,
                ['block', [], { statements: [['if', [], true,
                    { statements: [], exit: ['break', loopTarget, [7]] },
                    { statements: [], exit: thrown }]], exit: yielded }],
                ['if', [], false, { statements: [], exit: ['continue', loopTarget, [8]] }, { statements: [], exit: yielded }],
                innerStatement,
            ], exit: ['continue', loopTarget, [['ref', state]]],
        } })
        const packed = rootLoopOf(aggregateHelper(source))
        assert(packed !== null)
        assertEq(packed.body.statements[1], definition)
        const block = packed.body.statements[2]
        assert(block[0] === 'block')
        assertEq(block[2].exit, yielded)
        const conditional = block[2].statements[0]
        assert(conditional[0] === 'if')
        assertStructurallySame(conditional[3].exit, ['break', loopTarget, [['array', [7]]]])
        assertEq(conditional[4].exit, thrown)
        const next = packed.body.statements[3]
        assert(next[0] === 'if')
        assertStructurallySame(next[3].exit, ['continue', loopTarget, [['array', [8]]]])
        assertEq(next[4].exit, yielded)
        assertEq(packed.body.statements[4], innerStatement)
        assertStructurallySame(packed.body.exit, ['continue', loopTarget, [['array', [['ref', state]]]]])
    },
    aggregateTransferBoundaries: () => {
        const anotherLoop = /** @type {const} */ ({ kind: 'loop', index: loopTarget.index })
        // Escaping transfers retain their target and payload for the resolver
        // to refuse; function/value boundaries are not silently retargeted.
        for (const exit of /** @type {readonly Block['exit'][]} */ ([
            ['yield', [1]], ['throw', 'failure'], ['return', target, 2],
            ['break', anotherLoop, [3]], ['continue', anotherLoop, [4]],
        ])) {
            const packed = rootLoopOf(aggregateHelper({ ...loop, body: { statements: [], exit } }))
            assert(packed !== null)
            assertEq(packed.body.exit, exit)
        }
        const operand = /** @type {Value} */ (['block', { statements: [], exit: ['break', loopTarget, [6]] }])
        const definition = /** @type {const} */ (['define', alias, operand, 'required'])
        const packed = rootLoopOf(aggregateHelper({ ...loop, body: { statements: [definition], exit: ['break', loopTarget, [1]] } }))
        assert(packed !== null)
        assertEq(packed.body.statements[1], definition)
    },
    canonical: () => {
        assert(rootLoopOf(root(loop)) === loop)
        const aliased = { ...loop, initial: /** @type {readonly Value[]} */ ([['ref', other]]) }
        assert(rootLoopOf(fn({
            statements: [
                ['define', alias, ['ref', parameter], 'required'],
                ['define', other, ['ref', alias], 'lazy'],
                ['loop', aliased],
            ],
            exit: ['return', target, ['ref', result]],
        })) === aliased)
        // Captures and retained self stay on the existing function, unchanged.
        assert(rootLoopOf({ ...root(loop), self: other, captures: [{ binding: alias, value: 1 }] }) === loop)
    },
    invocationLayout: () => {
        assertEq(rootLoopOf({ ...root(loop), parameters: [] }), null)
        assertEq(rootLoopOf({ ...root(loop), rest: other }), null)
        const pair = {
            ...loop,
            parameters: [state, alias],
            initial: /** @type {readonly Value[]} */ ([['ref', parameter], 0]),
        }
        assertEq(rootLoopOf(root(pair)), null)
        assertEq(rootLoopOf(root({ ...loop, parameters: [], initial: [] })), null)
        assertEq(rootLoopOf(root({ ...loop, results: [result, other] })), null)
        for (const value of /** @type {readonly Value[]} */ ([0, ['array', []], ['ref', other], ['ref', { index: parameter.index }]])) {
            assertEq(rootLoopOf(root({ ...loop, initial: [value] })), null)
        }
    },
    establishedAliases: () => {
        const self = { index: 5 }
        const selfAlias = { index: 6 }
        const captureAlias = { index: 7 }
        const captureAliasAgain = { index: 8 }
        const value = {
            ...fn({
                statements: [
                    ['define', selfAlias, ['ref', self], 'lazy'],
                    ['define', captureAlias, ['ref', other], 'lazy'],
                    ['define', captureAliasAgain, ['ref', captureAlias], 'lazy'],
                    ['define', alias, ['ref', parameter], 'lazy'],
                    ['loop', { ...loop, initial: [['ref', alias]] }],
                ],
                exit: ['return', target, ['ref', result]],
            }),
            self,
            captures: [{ binding: other, value: /** @type {Value} */ (['array', []]) }],
        }
        assert(rootLoopOf(value) === value.body.statements.at(-1)?.[1])
        // Established captures and self are not the current invocation input.
        for (const binding of [selfAlias, captureAliasAgain]) {
            assertEq(rootLoopOf({ ...value, body: { ...value.body, statements: [...value.body.statements.slice(0, -1), ['loop', { ...loop, initial: [['ref', binding]] }]] } }), null)
        }
    },
    resultProcessing: () => {
        assertEq(rootLoopOf(fn({ statements: [], exit: ['return', target, 0] })), null)
        assertEq(rootLoopOf(fn({ statements: [['define', result, 0, 'required']], exit: ['return', target, ['ref', result]] })), null)
        assertEq(rootLoopOf(fn({ statements: [['loop', loop], ['define', alias, ['+', ['ref', result], 1], 'required']], exit: ['return', target, ['ref', alias]] })), null)
        assertEq(rootLoopOf(fn({ statements: [['loop', loop]], exit: ['yield', [['ref', result]]] })), null)
        assertEq(rootLoopOf(fn({ statements: [['loop', loop]], exit: ['return', { kind: 'function', index: target.index }, ['ref', result]] })), null)
        for (const value of /** @type {readonly Value[]} */ ([0, ['array', []], ['ref', other]])) {
            assertEq(rootLoopOf(fn({ statements: [['loop', loop]], exit: ['return', target, value] })), null)
        }
    },
    oneTimeSetup: () => {
        const empty = /** @type {Block} */ ({ statements: [], exit: ['yield', []] })
        assertEq(rootLoopOf(fn({ statements: [['block', [], empty], ['loop', loop]], exit: ['return', target, ['ref', result]] })), null)
        for (const value of /** @type {readonly Value[]} */ ([0, ['array', []], ['ref', other]])) {
            assertEq(rootLoopOf(fn({ statements: [['define', alias, value, 'required'], ['loop', loop]], exit: ['return', target, ['ref', result]] })), null)
        }
    },
}
