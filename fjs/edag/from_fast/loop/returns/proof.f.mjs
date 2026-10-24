/**
 * @import { BindingId, Block, Exit, Function as FastFunction, Loop, Statement, Value } from '../../../../js/ast/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../../asserts/module.f.js'
import { completeReturns } from './module.f.mjs'

const target = /** @type {const} */ ({ kind: 'function', index: 0 })
const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
const output = /** @type {const} */ ({ index: 0 })

/** @type {(exit: Exit, statements?: readonly Statement[]) => Block} */
const body = (exit, statements = []) => ({ statements, exit })

/** @type {(body: Block) => FastFunction} */
const fn = body => ({ target, parameters: [], rest: null, self: null, captures: [], body })

/** @type {(body: Block, results?: readonly BindingId[]) => Loop} */
const loopOf = (body, results = [output]) => ({ target: loopTarget, parameters: [], initial: [], results, body })

/** @type {(loop: Loop) => FastFunction} */
const containing = loop => fn(body(['yield', [9]], [['loop', loop]]))

/** @type {(fn: FastFunction) => Loop} */
const firstLoop = fn => {
    const statement = fn.body.statements[0]
    assert(statement[0] === 'loop')
    return statement[1]
}

export const proof = {
    unchanged: () => {
        const nestedTarget = /** @type {const} */ ({ kind: 'function', index: target.index })
        const nested = /** @type {Value} */ (['function', {
            target: nestedTarget, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', nestedTarget, 3], [['loop', loopOf(body(['return', nestedTarget, 4]))]]),
        }])
        const definition = /** @type {Statement} */ (['define', { index: 0 }, nested, 'required'])
        const operand = /** @type {Statement} */ (['define', { index: 0 }, ['block', body(['return', target, 5])], 'required'])
        const loop = loopOf(body(['break', loopTarget, [1]]))
        const source = fn(body(['return', target, 8], [
            definition, operand, ['block', [], body(['yield', []])],
            ['if', [], true, body(['yield', []]), body(['throw', 'failure'])], ['loop', loop],
        ]))
        assertEq(completeReturns(source, null), source)
        assertEq(completeReturns(fn(body(['yield', []])), null).body.exit[0], 'yield')
        const foreign = /** @type {const} */ ({ kind: 'function', index: target.index })
        const foreignSource = containing(loopOf(body(['return', foreign, 6])))
        assertEq(completeReturns(foreignSource, null), foreignSource)
    },
    completionLayout: () => {
        const state = /** @type {const} */ ({ index: 0 })
        const initial = /** @type {Value} */ (['array', [4]])
        const loop = /** @type {Loop} */ ({
            target: loopTarget, parameters: [state], initial: [initial], results: [output],
            body: body(['continue', loopTarget, [['ref', state]]], [
                ['if', [], true, body(['return', target, ['array', ['return', 7]]]), body(['break', loopTarget, [['array', ['normal', 8]]]])],
            ]),
        })
        const source = containing(loop)
        const normalized = completeReturns(source, null)
        assert(normalized !== source)
        assertEq(normalized.target, source.target)
        assertEq(normalized.parameters, source.parameters)
        assertEq(normalized.captures, source.captures)
        assertEq(normalized.rest, source.rest)
        assertEq(normalized.self, source.self)
        assertEq(normalized.body.exit, source.body.exit)
        const wrapped = firstLoop(normalized)
        assertEq(wrapped.target, loop.target)
        assertEq(wrapped.parameters, loop.parameters)
        assertEq(wrapped.initial, loop.initial)
        assertEq(wrapped.results.length, 1)
        const completion = wrapped.results[0]
        assertEq(completion.index, loop.target.index)
        assert(completion !== output)
        assert(completion !== state)
        assertEq(wrapped.body.exit, loop.body.exit)
        const conditional = wrapped.body.statements[0]
        assert(conditional[0] === 'if')
        assertStructurallySame(conditional[3].exit, ['break', loopTarget, [['array', ['return', ['array', ['return', 7]]]]]])
        assertStructurallySame(conditional[4].exit, ['break', loopTarget, [['array', ['normal', ['array', [['array', ['normal', 8]]]]]]]])
        const dispatch = normalized.body.statements[1]
        assert(dispatch[0] === 'if')
        assertEq(dispatch[1], loop.results)
        assertStructurallySame(dispatch[2], ['===', ['.', ['ref', completion], 0], 'return'])
        assertStructurallySame(dispatch[3], body(['return', target, ['.', ['ref', completion], 1]]))
        assertStructurallySame(dispatch[4], body(['yield', [['.', ['.', ['ref', completion], 1], 0]]]))
        assert(firstLoop(completeReturns(source, null)).results[0] !== completion)
    },
    resultSignatures: () => {
        for (const length of [0, 1, 3]) {
            const results = Array.from({ length }, () => /** @type {const} */ ({ index: 0 }))
            const values = results.map((_, index) => index)
            const loop = loopOf(body(['break', loopTarget, values], [
                ['block', [], body(['return', target, 8])],
            ]), results)
            const normalized = completeReturns(containing(loop), null)
            const wrapped = firstLoop(normalized)
            assertStructurallySame(wrapped.body.exit, ['break', loopTarget, [['array', ['normal', ['array', values]]]]])
            const dispatch = normalized.body.statements[1]
            assert(dispatch[0] === 'if')
            assertEq(dispatch[1], results)
            const completion = wrapped.results[0]
            assertStructurallySame(dispatch[4].exit, ['yield', results.map((_, i) => ['.', ['.', ['ref', completion], 1], i])])
        }
    },
    exitBoundaries: () => {
        const foreignFunction = /** @type {const} */ ({ kind: 'function', index: target.index })
        const foreignLoop = /** @type {const} */ ({ kind: 'loop', index: loopTarget.index })
        const definition = /** @type {Statement} */ (['define', { index: 0 }, ['block', body(['return', target, 4])], 'required'])
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: loopTarget.index })
        const inner = /** @type {Loop} */ ({ ...loopOf(body(['break', innerTarget, [5]])), target: innerTarget })
        const innerStatement = /** @type {Statement} */ (['loop', inner])
        const ordinary = /** @type {Statement} */ (['block', [], body(['yield', []])])
        const unchangedIf = /** @type {Statement} */ (['if', [], true, body(['yield', []]), body(['throw', 'failure'])])
        for (const exit of /** @type {readonly Exit[]} */ ([
            ['break', foreignLoop, [1]], ['continue', foreignLoop, [2]],
            ['return', foreignFunction, 3], ['throw', 'failure'], ['yield', []],
        ])) {
            const loop = loopOf(body(exit, [
                definition, innerStatement, ordinary, unchangedIf,
                ['block', [], body(['yield', []], [['if', [], false, body(['throw', 'skipped']), body(['return', target, 9])]])],
            ]))
            const wrapped = firstLoop(completeReturns(containing(loop), null))
            assertEq(wrapped.body.exit, exit)
            assertEq(wrapped.body.statements[0], definition)
            assertEq(wrapped.body.statements[1], innerStatement)
            assertEq(wrapped.body.statements[2], ordinary)
            assertEq(wrapped.body.statements[3], unchangedIf)
            const block = wrapped.body.statements[4]
            assert(block[0] === 'block')
            const conditional = block[2].statements[0]
            assert(conditional[0] === 'if')
            assertEq(conditional[3].exit[0], 'throw')
            assertStructurallySame(conditional[4].exit, ['break', loopTarget, [['array', ['return', 9]]]])
        }
    },
    functionRegions: () => {
        const returnedLoop = loopOf(body(['return', target, 7]))
        const stable = /** @type {Statement} */ (['define', { index: 0 }, 8, 'required'])
        for (const otherwise of [false, true]) {
            const branch = body(['yield', []], [['block', [], body(['yield', []], [['loop', returnedLoop]])]])
            const empty = body(['yield', []])
            const source = fn(body(['yield', []], [
                ['if', [], false, otherwise ? empty : branch, otherwise ? branch : empty], stable,
            ]))
            const normalized = completeReturns(source, null)
            assert(normalized !== source)
            assertEq(normalized.body.statements[1], stable)
            const conditional = normalized.body.statements[0]
            assert(conditional[0] === 'if')
            const changed = otherwise ? conditional[4] : conditional[3]
            const block = changed.statements[0]
            assert(block[0] === 'block')
            assertEq(block[2].statements.length, 2)
        }
    },
    rootExemption: () => {
        const self = /** @type {const} */ ({ index: 0 })
        const root = loopOf(body(['return', target, ['()', ['ref', self], []]]))
        const source = /** @type {FastFunction} */ ({ ...fn(body(['return', target, ['ref', output]], [['loop', root]])), self })
        assertEq(completeReturns(source, root), source)
        assert(completeReturns(source, { ...root }) !== source)
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: root.target.index })
        const innerResult = /** @type {const} */ ({ index: 0 })
        const inner = /** @type {Loop} */ ({ ...loopOf(body(['return', target, 6]), [innerResult]), target: innerTarget })
        const nestedRoot = /** @type {Loop} */ ({ ...root, body: body(root.body.exit, [['loop', inner]]) })
        const nestedSource = /** @type {FastFunction} */ ({ ...source, body: body(source.body.exit, [['loop', nestedRoot]]) })
        const normalized = completeReturns(nestedSource, nestedRoot)
        const outer = firstLoop(normalized)
        assertEq(outer.results, nestedRoot.results)
        assertEq(outer.body.exit, nestedRoot.body.exit)
        assertEq(normalized.body.statements.length, 1)
        assertEq(outer.body.statements.length, 2)
        const loop = outer.body.statements[0]
        assert(loop[0] === 'loop')
        assert(loop[1].results[0] !== inner.results[0])
        const dispatch = outer.body.statements[1]
        assert(dispatch[0] === 'if')
        assertEq(dispatch[3].exit[0], 'return')
    },
    nestedPropagation: () => {
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: loopTarget.index })
        const innerResult = /** @type {const} */ ({ index: 0 })
        const inner = /** @type {Loop} */ ({ ...loopOf(body(['return', target, 6]), [innerResult]), target: innerTarget })
        const outer = loopOf(body(['break', loopTarget, [7]], [['loop', inner]]))
        const normalized = completeReturns(containing(outer), null)
        const wrapped = firstLoop(normalized)
        const child = wrapped.body.statements[0]
        assert(child[0] === 'loop')
        assertEq(child[1].target, innerTarget)
        const dispatch = wrapped.body.statements[1]
        assert(dispatch[0] === 'if')
        assertStructurallySame(dispatch[3].exit, ['break', loopTarget, [['array', ['return', ['.', ['ref', child[1].results[0]], 1]]]]])
        assertEq(normalized.body.statements.length, 2)
    },
    deepRegions: () => {
        /** @type {Block} */
        let region = body(['return', target, 7])
        for (let depth = 0; depth < 20_000; ++depth) { region = body(['yield', []], [['block', [], region]]) }
        const wrapped = firstLoop(completeReturns(containing(loopOf(region)), null))
        let result = wrapped.body
        for (let depth = 0; depth < 20_000; ++depth) {
            const statement = result.statements[0]
            assert(statement[0] === 'block')
            result = statement[2]
        }
        assertStructurallySame(result.exit, ['break', loopTarget, [['array', ['return', 7]]]])
    },
}
