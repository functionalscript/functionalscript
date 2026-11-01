/**
 * @import { BindingId, Block, Function as FastFunction, Loop, Statement, Value } from '../../../../js/ast/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../../asserts/module.f.js'
import { _owningTailCalls } from './module.f.mjs'

const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
const foreign = /** @type {const} */ ({ kind: 'function', index: 0 })
const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
const n = /** @type {const} */ ({ index: 0 })
const a = /** @type {const} */ ({ index: 0 })
const self = /** @type {const} */ ({ index: 0 })
const alias = /** @type {const} */ ({ index: 0 })
const local = /** @type {const} */ ({ index: 0 })
const rest = /** @type {const} */ ({ index: 0 })

/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]

/** @type {(exit: Block['exit'], statements?: readonly Statement[]) => Block} */
const body = (exit, statements = []) => ({ statements, exit })

/** @type {(region: Block) => FastFunction} */
const fn = region => ({ target: owner, parameters: [n, a], rest: null, self, captures: [], body: region })

/** @type {(region: Block) => Loop} */
const loopOf = region => ({ target, parameters: [], initial: [], results: [], body: region })

/** @type {(args?: readonly Value[], callee?: BindingId) => Value} */
const recursive = (args = [['-', ref(n), 1], ['+', ref(a), 1]], callee = self) => ['()', ref(callee), args]

/** @type {(value: Value) => FastFunction} */
const crossed = value => fn(body(['loop', loopOf(body(['return', owner, value]))]))

/** Require the actual invocation root, whose identity is construction provenance.
 * @type {(source: FastFunction) => { readonly fn: FastFunction; readonly root: Loop }}
 */
const normalized = source => {
    const result = _owningTailCalls(source)
    assert(result.root !== null)
    assert(result.fn !== source)
    assertEq(result.fn.target, source.target)
    assert(result.fn.self !== null && result.fn.self !== source.self)
    assertEq(result.fn.captures, source.captures)
    return { fn: result.fn, root: result.root }
}

export const proof = {
    functionsWithoutCrossingTailCallsKeepTheirIdentity: () => {
        /** @type {FastFunction} */
        const missing = { ...crossed(7), self: null }
        assertEq(_owningTailCalls(missing).fn, missing)
        assertEq(_owningTailCalls(missing).root, null)
        for (const source of [
            fn(body(['return', owner, recursive()])),
            crossed(['+', recursive(), 1]),
            crossed(7),
            fn(body(['throw', ref(n)])),
        ]) {
            const result = _owningTailCalls(source)
            assertEq(result.fn, source)
            assertEq(result.root, null)
        }
    },
    alwaysTailInvocationNeedsNoNormalResult: () => {
        const source = crossed(recursive())
        const result = normalized(source)
        assertEq(result.fn.body.statements.length, 0)
        assert(result.fn.body.exit[0] === 'loop')
        assertEq(result.fn.body.exit[1], result.root)
        assertEq(result.root.results.length, 0)
        assertEq(result.root.parameters[0], n)
        assertEq(result.root.parameters[1], a)
        assert(result.fn.parameters[0] !== n)
        assert(result.fn.parameters[1] !== a)
        assert(result.fn.parameters[0] !== result.fn.parameters[1])
        assertStructurallySame(result.root.initial, result.fn.parameters.map(ref))
        const inside = result.root.body.exit
        assert(inside[0] === 'loop')
        assertEq(inside[1].target, target)
        assertStructurallySame(inside[1].body.exit, ['continue', result.root.target, [['-', ref(n), 1], ['+', ref(a), 1]]])
    },
    invocationSetupAndBaseResultsRemainInsideEachIteration: () => {
        const capture = /** @type {const} */ ({ index: 0 })
        /** @type {Value} */
        const initializer = ['+', ref(n), 1]
        /** @type {FastFunction} */
        const source = {
            ...fn(body(['loop', loopOf(body(['return', owner, recursive()], [
                ['if', [], ['===', ref(n), 0], body(['return', owner, ['array', [ref(local), ref(capture)]]]), body(['yield', []])],
            ]))], [['define', local, initializer, 'required']])),
            captures: [{ binding: capture, value: 7 }],
        }
        const result = normalized(source)
        assertEq(result.root.results.length, 1)
        assertEq(result.fn.body.statements.length, 1)
        assert(result.fn.body.statements[0][0] === 'loop')
        assertEq(result.fn.body.statements[0][1], result.root)
        assertStructurallySame(result.fn.body.exit, ['return', owner, ref(result.root.results[0])])
        const definition = result.root.body.statements[0]
        assert(definition[0] === 'define')
        assertEq(definition[1], local)
        assertStructurallySame(definition[2], initializer)
        const inside = result.root.body.exit
        assert(inside[0] === 'loop')
        const branch = inside[1].body.statements[0]
        assert(branch[0] === 'if')
        assertStructurallySame(branch[3].exit, ['break', result.root.target, [['array', [ref(local), ref(capture)]]]])
        assertStructurallySame(branch[4].exit, ['yield', []])
    },
    ordinaryLoopTransfersKeepTheirExactOwner: () => {
        /** @type {Loop} */
        const loop = { ...loopOf(body(['break', target, [ref(a)]], [
            ['if', [], ref(n), body(['return', owner, recursive()]), body(['continue', target, [ref(n)]])],
        ])), parameters: [local], initial: [ref(n)], results: [alias] }
        const result = normalized(fn(body(['return', owner, ref(a)], [['loop', loop]])))
        const inside = result.root.body.statements[0]
        assert(inside[0] === 'loop')
        assertEq(inside[1].target, target)
        assertStructurallySame(inside[1].body.exit, ['break', target, [ref(a)]])
        const branch = inside[1].body.statements[0]
        assert(branch[0] === 'if')
        assert(branch[3].exit[0] === 'continue')
        assertEq(branch[3].exit[1], result.root.target)
        assertStructurallySame(branch[4].exit, ['continue', target, [ref(n)]])
        assertStructurallySame(result.root.body.exit, ['break', result.root.target, [ref(a)]])
    },
    selfAliasesDisappearWithTheirReferencesCanonicalized: () => {
        const nextAlias = /** @type {const} */ ({ index: 0 })
        const source = fn(body(['loop', loopOf(body(['return', owner, recursive(undefined, nextAlias)]))], [
            ['define', alias, ref(self), 'lazy'],
            ['define', nextAlias, ref(alias), 'required'],
        ]))
        const result = normalized(source)
        assertEq(result.root.body.statements.length, 0)
        const inside = result.root.body.exit
        assert(inside[0] === 'loop')
        assertEq(inside[1].body.exit[0], 'continue')
        const returnedAlias = normalized(fn(body(['loop', loopOf(body(['return', owner, ref(alias)], [
            ['if', [], ref(n), body(['return', owner, recursive()]), body(['yield', []])],
        ]))], [['define', alias, ref(self), 'lazy']])))
        const returned = returnedAlias.root.body.exit
        assert(returned[0] === 'loop')
        const exit = returned[1].body.exit
        assert(exit[0] === 'break')
        const value = exit[2][0]
        assert(value instanceof Array && value[0] === 'ref')
        assertEq(value[1], returnedAlias.fn.self)
    },
    selfAliasesKeepTheirValueAcrossShadowingLoopBindings: () => {
        for (const shadowParameter of [false, true]) {
            /** @type {Loop} */
            const loop = { target, parameters: shadowParameter ? [self] : [], initial: shadowParameter ? [7] : [],
                results: shadowParameter ? [local] : [self], body: body(['break', target, [['===', ref(alias), ref(self)]]], [
                    ['if', [], ref(n), body(['return', owner, recursive(undefined, alias)]), body(['yield', []])],
                ]) }
            const result = normalized(fn(body(['return', owner, ['===', ref(alias), ref(self)]], [
                ['define', alias, ref(self), 'lazy'], ['loop', loop],
            ])))
            const exit = result.root.body.exit
            assert(exit[0] === 'break')
            const comparison = exit[2][0]
            assert(comparison instanceof Array && comparison[0] === '===')
            const aliased = comparison[1], original = comparison[2]
            assert(aliased instanceof Array && aliased[0] === 'ref')
            assertEq(aliased[1], result.fn.self)
            assert(original instanceof Array && original[0] === 'ref')
            assertEq(original[1], shadowParameter ? result.fn.self : self)
            const statement = result.root.body.statements[0]
            assert(statement[0] === 'loop' && statement[1].body.exit[0] === 'break')
            const inner = statement[1].body.exit[2][0]
            assert(inner instanceof Array && inner[0] === '===')
            const incoming = inner[2]
            assert(incoming instanceof Array && incoming[0] === 'ref')
            assertEq(incoming[1], shadowParameter ? self : result.fn.self)
        }
    },
    laterDefinitionsAndRegionResultsShadowSelfAliases: () => {
        /** @type {readonly Statement[]} */
        const bindings = [
            ['define', alias, 7, 'required'],
            ['block', [alias], body(['yield', [7]])],
            ['if', [alias], ref(n), body(['yield', [7]]), body(['yield', [8]])],
        ]
        for (const binding of bindings) {
            const result = normalized(fn(body(['loop', loopOf(body(['return', owner, ref(alias)], [
                ['if', [], ref(n), body(['return', owner, recursive()]), body(['yield', []])],
            ]))], [['define', alias, ref(self), 'lazy'], binding])))
            const inside = result.root.body.exit
            assert(inside[0] === 'loop')
            const exit = inside[1].body.exit
            assert(exit[0] === 'break')
            const value = exit[2][0]
            assert(value instanceof Array && value[0] === 'ref')
            assertEq(value[1], alias)
        }
    },
    returnedRegionsKeepTheirTailPosition: () => {
        /** @type {readonly Value[]} */
        const values = [
            ['block', body(['yield', [recursive()]], [['define', local, ['-', ref(n), 1], 'required']])],
            ['if', ref(n), body(['yield', [recursive()]]), body(['yield', [ref(a)]])],
            ['if', ref(n), body(['yield', [ref(a)]]), body(['yield', [recursive()]])],
            ['?:', ref(n), recursive(), ref(a)],
            ['?:', ref(n), ref(a), recursive()],
            [',', [['()', ref(local), []], recursive()]],
        ]
        for (const value of values) {
            const result = normalized(crossed(value))
            assertEq(result.root.target.kind, 'loop')
            assertEq(result.root.parameters[0], n)
            assertEq(result.root.parameters[1], a)
        }
        const prefixed = normalized(crossed(values[5]))
        const inside = prefixed.root.body.exit
        assert(inside[0] === 'loop')
        assertStructurallySame(inside[1].body.statements[0][2], ['()', ref(local), []])
        assert(inside[1].body.exit[0] === 'continue')
        assertEq(inside[1].body.exit[1], prefixed.root.target)
    },
    nestedStatementRegionsKeepTheirBindingAndCompletionSignatures: () => {
        const result = normalized(fn(body(['loop', loopOf(body(['throw', 7], [
            ['block', [local], body(['yield', [1]], [
                ['if', [], ref(n), body(['return', owner, recursive()]), body(['yield', []])],
            ])],
        ]))])))
        const inside = result.root.body.exit
        assert(inside[0] === 'loop')
        const region = inside[1].body.statements[0]
        assert(region[0] === 'block')
        assertEq(region[1][0], local)
        assertStructurallySame(region[2].exit, ['yield', [1]])
        assertStructurallySame(inside[1].body.exit, ['throw', 7])
    },
    nestedFunctionBodiesStayOpaqueWhileCapturesAreEvaluated: () => {
        const nestedSelf = /** @type {const} */ ({ index: 0 })
        const nestedBody = body(['return', foreign, ['()', ref(nestedSelf), []]])
        /** @type {FastFunction} */
        const nested = { target: foreign, parameters: [], rest: null, self: nestedSelf,
            captures: [{ binding: local, value: ['block', body(['return', owner, recursive()])] }], body: nestedBody }
        const source = fn(body(['loop', loopOf(body(['throw', 7], [['define', alias, ['function', nested], 'required']]))]))
        const result = normalized(source)
        const inside = result.root.body.exit
        assert(inside[0] === 'loop')
        const definition = inside[1].body.statements[0]
        assert(definition[0] === 'define')
        const value = definition[2]
        assert(value instanceof Array && value[0] === 'function')
        assertEq(value[1].body, nestedBody)
        assertEq(value[1].self, nestedSelf)
        const captured = value[1].captures[0].value
        assert(captured instanceof Array && captured[0] === 'block')
        assert(captured[1].exit[0] === 'continue')
        assertEq(captured[1].exit[1], result.root.target)
        const opaque = fn(body(['return', owner, ['function', { ...nested, captures: [] }]]))
        assertEq(_owningTailCalls(opaque).fn, opaque)
    },
    operandRegionsExposeOnlyTheirOwningReturns: () => {
        for (const returningThen of [true, false]) {
            const returned = body(['return', owner, recursive()])
            const yielded = body(['yield', [1]])
            /** @type {Value} */
            const operand = ['if', ref(n), returningThen ? returned : yielded, returningThen ? yielded : returned]
            const source = fn(body(['loop', loopOf(body(['return', owner, 7], [['define', local, ['+', operand, 1], 'required']]))]))
            const result = normalized(source)
            const inside = result.root.body.exit
            assert(inside[0] === 'loop')
            const definition = inside[1].body.statements[0]
            assert(definition[0] === 'define')
            const addition = definition[2]
            assert(addition instanceof Array && addition[0] === '+')
            const conditional = addition[1]
            assert(conditional instanceof Array && conditional[0] === 'if')
            const transfer = returningThen ? conditional[2] : conditional[3]
            const normal = returningThen ? conditional[3] : conditional[2]
            assert(transfer.exit[0] === 'continue')
            assertEq(transfer.exit[1], result.root.target)
            assertStructurallySame(normal.exit, ['yield', [1]])
        }
    },
    recursiveArgumentsRetainTheirEarlierOwningReturn: () => {
        /** @type {Value} */
        const argument = ['block', body(['return', owner, recursive([0, ref(a)])])]
        const result = normalized(crossed(recursive([argument, ref(a)])))
        const inside = result.root.body.exit
        assert(inside[0] === 'loop')
        const exit = inside[1].body.exit
        assert(exit[0] === 'continue')
        assertEq(exit[1], result.root.target)
        const first = exit[2][0]
        assert(first instanceof Array && first[0] === 'block')
        assertStructurallySame(first[1].exit, ['continue', result.root.target, [0, ref(a)]])
    },
    restInvocationsKeepFreshEntryAndTransitionBindings: () => {
        /** @type {FastFunction} */
        const source = { ...crossed(recursive([ref(n), ref(a), ref(rest)])), rest }
        const result = normalized(source)
        assert(result.fn.rest !== null && result.fn.rest !== rest)
        assertEq(result.root.parameters[2], rest)
        assertStructurallySame(result.root.initial[2], ref(result.fn.rest))
        const inside = result.root.body.exit
        assert(inside[0] === 'loop')
        assertEq(inside[1].body.statements.length, 1)
        assert(inside[1].body.exit[0] === 'continue')
        assertEq(inside[1].body.exit[2].length, 3)
        const nextRest = inside[1].body.exit[2][2]
        assert(nextRest instanceof Array && nextRest[0] === '()')
    },
    foreignReturnsAndUnreachableNormalExitsKeepTheirMeaning: () => {
        const source = fn(body(['return', foreign, 7], [['loop', loopOf(body(['return', owner, recursive()]))]]))
        const result = normalized(source)
        assertStructurallySame(result.root.body.exit, ['return', foreign, 7])
        const selected = normalized(crossed(['block', body(['yield', []], [
            ['if', [], ref(n), body(['return', owner, recursive()]), body(['return', owner, 1])],
        ])]))
        const inside = selected.root.body.exit
        assert(inside[0] === 'loop')
        assertStructurallySame(inside[1].body.exit, ['yield', []])
    },
}
