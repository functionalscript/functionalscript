/**
 * @import { BindingId, Block, Exit, Function as FastFunction, Loop, Statement, Value } from '../../../../js/ast/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../../asserts/module.f.js'
import { completeBlockTransfers, completeTransfers } from './module.f.mjs'

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

/** @type {(Block: Block) => Loop} */
const blockLoop = block => {
    const statement = block.statements[0]
    assert(statement[0] === 'loop')
    return statement[1]
}

/** @type {(completion: BindingId, kind: 'break' | 'continue', id: number) => Value} */
const transferGuard = (completion, kind, id) => ['if', ['===', ['.', ['ref', completion], 0], kind],
    body(['yield', [['===', ['.', ['ref', completion], 1], id]]]), body(['yield', [false]])]

/** @type {(completion: BindingId, length: number) => readonly Value[]} */
const transferValues = (completion, length) => Array.from({ length }, (_, i) => ['.', ['.', ['ref', completion], 2], i])

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
        assertEq(completeTransfers(source, null), source)
        assertEq(completeTransfers(fn(body(['yield', []])), null).body.exit[0], 'yield')
        const foreign = /** @type {const} */ ({ kind: 'function', index: target.index })
        const foreignSource = containing(loopOf(body(['return', foreign, 6])))
        assertEq(completeTransfers(foreignSource, null), foreignSource)
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
        const normalized = completeTransfers(source, null)
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
        assert(firstLoop(completeTransfers(source, null)).results[0] !== completion)
    },
    resultSignatures: () => {
        for (const length of [0, 1, 3]) {
            const results = Array.from({ length }, () => /** @type {const} */ ({ index: 0 }))
            const values = results.map((_, index) => index)
            const loop = loopOf(body(['break', loopTarget, values], [
                ['block', [], body(['return', target, 8])],
            ]), results)
            const normalized = completeTransfers(containing(loop), null)
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
            const wrapped = firstLoop(completeTransfers(containing(loop), null))
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
            const normalized = completeTransfers(source, null)
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
        assertEq(completeTransfers(source, root), source)
        assert(completeTransfers(source, { ...root }) !== source)
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: root.target.index })
        const innerResult = /** @type {const} */ ({ index: 0 })
        const inner = /** @type {Loop} */ ({ ...loopOf(body(['return', target, 6]), [innerResult]), target: innerTarget })
        const nestedRoot = /** @type {Loop} */ ({ ...root, body: body(root.body.exit, [['loop', inner]]) })
        const nestedSource = /** @type {FastFunction} */ ({ ...source, body: body(source.body.exit, [['loop', nestedRoot]]) })
        const normalized = completeTransfers(nestedSource, nestedRoot)
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
        const normalized = completeTransfers(containing(outer), null)
        const wrapped = firstLoop(normalized)
        const child = wrapped.body.statements[0]
        assert(child[0] === 'loop')
        assertEq(child[1].target, innerTarget)
        const dispatch = wrapped.body.statements[1]
        assert(dispatch[0] === 'if')
        assertStructurallySame(dispatch[3].exit, ['break', loopTarget, [['array', ['return', ['.', ['ref', child[1].results[0]], 1]]]]])
        assertEq(normalized.body.statements.length, 2)
    },
    lexicalTransferCases: () => {
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const left = /** @type {const} */ ({ index: 0 })
        const right = /** @type {const} */ ({ index: 0 })
        const leftResult = /** @type {const} */ ({ index: 0 })
        const rightResult = /** @type {const} */ ({ index: 0 })
        const thirdResult = /** @type {const} */ ({ index: 0 })
        const ownContinue = /** @type {Exit} */ (['continue', innerTarget, []])
        const inner = /** @type {Loop} */ ({ ...loopOf(body(['break', innerTarget, [['array', ['continue', 0, ['array', [9]]]]]], [
            ['if', [], true, body(['continue', outerTarget, [3, 4]]), body(['break', outerTarget, [5, 6, 7]])],
            ['if', [], false, body(ownContinue), body(['yield', []])],
        ])), target: innerTarget })
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [left, right], initial: [1, 2], results: [leftResult, rightResult, thirdResult],
            body: body(['break', outerTarget, [7, 8, 9]], [['loop', inner]]),
        })
        const source = body(['yield', [['ref', leftResult], ['ref', rightResult], ['ref', thirdResult]]], [['loop', outer]])
        const normalized = completeBlockTransfers(source)
        assert(normalized !== source)
        const owner = blockLoop(normalized)
        assertEq(owner.results, outer.results)
        assertEq(owner.body.exit, outer.body.exit)
        assertEq(normalized.statements.length, 1)
        const wrapped = blockLoop(owner.body)
        const completion = wrapped.results[0]
        assertEq(wrapped.parameters, inner.parameters)
        assertEq(wrapped.initial, inner.initial)
        assertEq(wrapped.results.length, 1)
        const escaped = wrapped.body.statements[0]
        assert(escaped[0] === 'if')
        assertStructurallySame(escaped[3].exit, ['break', innerTarget, [['array', ['continue', 0, ['array', [3, 4]]]]]])
        assertStructurallySame(escaped[4].exit, ['break', innerTarget, [['array', ['break', 0, ['array', [5, 6, 7]]]]]])
        const continued = wrapped.body.statements[1]
        assert(continued[0] === 'if')
        assertEq(continued[3].exit, ownContinue)
        assertStructurallySame(wrapped.body.exit, ['break', innerTarget, [['array', ['normal', ['array', [['array', ['continue', 0, ['array', [9]]]]]]]]]])
        const dispatch = owner.body.statements[1]
        assert(dispatch[0] === 'if')
        assertEq(dispatch[1], inner.results)
        // Kind order is deterministic, even when the source sees continue first.
        assertStructurallySame(dispatch[2], transferGuard(completion, 'break', 0))
        assertStructurallySame(dispatch[3], body(['break', outerTarget, transferValues(completion, outer.results.length)]))
        assertEq(dispatch[4].statements.length, 1)
        const next = dispatch[4].statements[0]
        assert(next[0] === 'if')
        assertEq(next[1].length, 0)
        assertStructurallySame(next[2], transferGuard(completion, 'continue', 0))
        assertStructurallySame(next[3], body(['continue', outerTarget, transferValues(completion, outer.parameters.length)]))
        assertStructurallySame(next[4], body(['yield', []]))
        assertStructurallySame(dispatch[4].exit, ['yield', [['.', ['.', ['ref', completion], 1], 0]]])
    },
    ancestorIdsAndIntermediatePropagation: () => {
        for (const index of [0, 91]) {
            const outerTarget = /** @type {const} */ ({ kind: 'loop', index })
            const middleTarget = /** @type {const} */ ({ kind: 'loop', index })
            const innerTarget = /** @type {const} */ ({ kind: 'loop', index })
            const state = /** @type {const} */ ({ index: 0 })
            const middleResult = /** @type {const} */ ({ index: 0 })
            const inner = /** @type {Loop} */ ({ ...loopOf(body(['continue', outerTarget, [8]], [
                ['if', [], true, body(['break', middleTarget, [7]]), body(['yield', []])],
            ])), target: innerTarget })
            const middle = /** @type {Loop} */ ({ ...loopOf(body(['break', middleTarget, [6]], [['loop', inner]]), [middleResult]), target: middleTarget })
            const outer = /** @type {Loop} */ ({ ...loopOf(body(['break', outerTarget, [5]], [['loop', middle]])),
                target: outerTarget, parameters: [state], initial: [0] })
            const normalized = completeBlockTransfers(body(['yield', []], [['loop', outer]]))
            const enclosing = blockLoop(normalized)
            const wrappedMiddle = blockLoop(enclosing.body)
            const wrappedInner = blockLoop(wrappedMiddle.body)
            assertEq(enclosing.results, outer.results)
            assert(wrappedMiddle.results[0] !== middleResult)
            const conditional = wrappedInner.body.statements[0]
            assert(conditional[0] === 'if')
            // The two targets have equal debug indices; lexical IDs remain 0/1.
            assertStructurallySame(conditional[3].exit, ['break', innerTarget, [['array', ['break', 1, ['array', [7]]]]]])
            assertStructurallySame(wrappedInner.body.exit, ['break', innerTarget, [['array', ['continue', 0, ['array', [8]]]]]])
            const innerDispatch = wrappedMiddle.body.statements[1]
            assert(innerDispatch[0] === 'if')
            assertStructurallySame(innerDispatch[2], transferGuard(wrappedInner.results[0], 'continue', 0))
            // The middle helper returns the escape to its caller; it does not
            // call the outer helper or perform its state transition itself.
            assertStructurallySame(innerDispatch[3].exit, ['break', middleTarget, [['array', ['continue', 0,
                ['array', transferValues(wrappedInner.results[0], outer.parameters.length)]]]]])
            const outerDispatch = enclosing.body.statements[1]
            assert(outerDispatch[0] === 'if')
            assertStructurallySame(outerDispatch[3].exit, ['continue', outerTarget, transferValues(wrappedMiddle.results[0], outer.parameters.length)])
        }
    },
    returnAndTransferCases: () => {
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({ ...loopOf(body(['return', target, ['array', ['break', 0, ['array', [4]]]]], [
            ['if', [], true, body(['break', outerTarget, [5]]), body(['yield', []])],
        ])), target: innerTarget })
        const outer = /** @type {Loop} */ ({ ...loopOf(body(['break', outerTarget, [6]], [['loop', inner]])), target: outerTarget })
        const source = containing(outer)
        const normalized = completeTransfers(source, outer)
        const owner = firstLoop(normalized)
        const wrapped = blockLoop(owner.body)
        const completion = wrapped.results[0]
        assertEq(owner.results, outer.results)
        assertStructurallySame(wrapped.body.exit, ['break', innerTarget, [['array', ['return', ['array', ['break', 0, ['array', [4]]]]]]]])
        const dispatch = owner.body.statements[1]
        assert(dispatch[0] === 'if')
        assertEq(dispatch[1], inner.results)
        assertStructurallySame(dispatch[2], ['===', ['.', ['ref', completion], 0], 'return'])
        assertStructurallySame(dispatch[3], body(['return', target, ['.', ['ref', completion], 1]]))
        const escaped = dispatch[4].statements[0]
        assert(escaped[0] === 'if')
        assertEq(escaped[1].length, 0)
        assertStructurallySame(escaped[2], transferGuard(completion, 'break', 0))
        assertStructurallySame(escaped[3], body(['break', outerTarget, transferValues(completion, outer.results.length)]))
        assertStructurallySame(dispatch[4].exit, ['yield', [['.', ['.', ['ref', completion], 1], 0]]])
    },
    nonlexicalTransferBoundaries: () => {
        const firstTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const secondTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const foreignTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const first = /** @type {Loop} */ ({ ...loopOf(body(['continue', secondTarget, []])), target: firstTarget })
        const second = /** @type {Loop} */ ({ ...loopOf(body(['break', firstTarget, [1]])), target: secondTarget })
        const source = body(['yield', []], [['loop', first], ['loop', second]])
        assertEq(completeBlockTransfers(source), source)
        assertEq(completeTransfers(fn(source), null).body, source)
        const foreign = body(['yield', []], [['loop', { ...first, body: body(['break', foreignTarget, [2]]) }]])
        assertEq(completeBlockTransfers(foreign), foreign)
        const returned = body(['yield', []], [['loop', { ...first, body: body(['return', target, 3]) }]])
        // A standalone block has no owning source function; it cannot encode
        // a function return merely because the presentation index coincides.
        assertEq(completeBlockTransfers(returned), returned)
        const empty = body(['yield', []])
        assertEq(completeBlockTransfers(empty), empty)
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const escaped = /** @type {Exit} */ (['continue', secondTarget, []])
        const returnedExit = /** @type {Exit} */ (['return', target, 4])
        const inner = /** @type {Loop} */ ({ ...loopOf(body(returnedExit, [
            ['if', [], true, body(['break', firstTarget, [5]]), body(escaped)],
        ])), target: innerTarget })
        const outer = /** @type {Loop} */ ({ ...first, body: body(['break', firstTarget, [6]], [['loop', inner]]) })
        const normalized = completeBlockTransfers(body(['yield', []], [['loop', outer], ['loop', second]]))
        const wrapped = blockLoop(blockLoop(normalized).body)
        assertEq(wrapped.body.exit, returnedExit)
        const branch = wrapped.body.statements[0]
        assert(branch[0] === 'if')
        assertEq(branch[4].exit, escaped)
        assertEq(normalized.statements[1][1], second)
    },
    lexicalInventoryOrder: () => {
        const beforeTarget = /** @type {const} */ ({ kind: 'loop', index: 99 })
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 99 })
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 99 })
        const hiddenTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const hidden = /** @type {Value} */ (['function', { target: hiddenTarget, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', hiddenTarget, 1], [['loop', loopOf(body(['break', loopTarget, [2]]))]]) }])
        const definition = /** @type {Statement} */ (['define', { index: 0 }, hidden, 'required'])
        const operand = /** @type {Statement} */ (['define', { index: 0 }, ['block', body(['yield', [1]], [['loop', loopOf(body(['break', loopTarget, [2]]))]])], 'required'])
        const before = /** @type {Loop} */ ({ ...loopOf(body(['break', beforeTarget, [3]])), target: beforeTarget })
        const inner = /** @type {Loop} */ ({ ...loopOf(body(['continue', outerTarget, []])), target: innerTarget })
        const outer = /** @type {Loop} */ ({ ...loopOf(body(['break', outerTarget, [4]], [['loop', inner]])), target: outerTarget })
        const source = body(['yield', []], [definition, operand,
            ['if', [], false, body(['yield', []], [['loop', before]]), body(['yield', []])],
            ['block', [], body(['yield', []], [['loop', outer]])],
        ])
        const normalized = completeBlockTransfers(source)
        assertEq(normalized.statements[0], definition)
        assertEq(normalized.statements[1], operand)
        assertEq(normalized.statements[2], source.statements[2])
        const region = normalized.statements[3]
        assert(region[0] === 'block')
        const wrapped = blockLoop(blockLoop(region[2]).body)
        // The statement loop in the earlier conditional is ID 0; opaque value
        // and nested-function loops consume no IDs, so this outer loop is ID 1.
        assertStructurallySame(wrapped.body.exit, ['break', innerTarget, [['array', ['continue', 1, ['array', []]]]]])
    },
    deepRegions: () => {
        /** @type {Block} */
        let region = body(['return', target, 7])
        for (let depth = 0; depth < 20_000; ++depth) { region = body(['yield', []], [['block', [], region]]) }
        const wrapped = firstLoop(completeTransfers(containing(loopOf(region)), null))
        let result = wrapped.body
        for (let depth = 0; depth < 20_000; ++depth) {
            const statement = result.statements[0]
            assert(statement[0] === 'block')
            result = statement[2]
        }
        assertStructurallySame(result.exit, ['break', loopTarget, [['array', ['return', 7]]]])
    },
}
