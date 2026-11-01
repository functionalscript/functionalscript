/**
 * Deferred owning self returns retain their tail position at first demand.
 * @import { BindingId, Block, Exit, Function as FastFunction, Item, Statement, Value } from '../types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { identityAnalysis } from '../../../edag/analysis/module.f.mjs'
import { fromFast } from '../../../edag/from_fast/module.f.mjs'
import { memo } from '../../../edag/memo/module.f.mjs'
import { toData } from '../../../edag/value/to_unknown/module.f.mjs'
import { normalizeLazyReturns, normalizeMemo } from './module.f.mjs'

const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
const nestedOwner = /** @type {const} */ ({ kind: 'function', index: 1 })
const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
const self = /** @type {const} */ ({ index: 0 })
const n = /** @type {const} */ ({ index: 1 })
const accumulator = /** @type {const} */ ({ index: 2 })
const rest = /** @type {const} */ ({ index: 3 })
const lazy = /** @type {const} */ ({ index: 4 })
const output = /** @type {const} */ ({ index: 5 })
const alias = /** @type {const} */ ({ index: 6 })
const nextAlias = /** @type {const} */ ({ index: 7 })
const prerequisite = /** @type {const} */ ({ index: 8 })
const local = /** @type {const} */ ({ index: 9 })
const capture = /** @type {const} */ ({ index: 10 })
const closure = /** @type {const} */ ({ index: 11 })
const unused = /** @type {const} */ ({ index: 12 })

/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]
/** @type {(exit: Exit, statements?: readonly Statement[]) => Block} */
const body = (exit, statements = []) => ({ statements, exit })
/** @type {(value: Value, statements?: readonly Statement[]) => Value} */
const recipe = (value, statements = []) => ['block', body(['yield', [value]], statements)]
/** @type {(args?: readonly Item<Value>[], callee?: BindingId) => Value} */
const recur = (args = [['-', ref(n), 1], ['+', ref(accumulator), 1]], callee = self) => ['()', ref(callee), args]

/** Demand the recipe from a source loop, before returning its normal result. @type {(initializer: Value, prefix?: readonly Statement[]) => FastFunction} */
const source = (initializer, prefix = []) => ({ target: owner, parameters: [n, accumulator], rest: null, self, captures: [],
    body: body(['return', owner, ref(output)], [...prefix, ['define', lazy, initializer, 'lazy'], ['loop', {
        target, parameters: [], initial: [], results: [output], body: body(['break', target, [ref(lazy)]]),
    }]]) })

/** @type {(fn: FastFunction) => FastFunction} */
const normalize = fn => ({ ...fn, body: normalizeMemo(fn.body, [], fn.target, fn.self) })
/** @type {(fn: FastFunction) => FastFunction} */
const normalizeReturns = fn => ({ ...fn, body: normalizeLazyReturns(fn.body, fn.target, fn.self) })
/** @type {(fn: FastFunction, args: readonly Item<Value>[]) => import('../../../edag/value/control/types.ts').ValueResult} */
const evaluate = (fn, args) => memo(assertOk(identityAnalysis(fromFast(body(['yield', [['()', ['function', fn], args]]])))))({ args: [] })
/** @type {(fn: FastFunction, args: readonly Item<Value>[]) => unknown} */
const data = (fn, args) => assertOk(toData(assertOk(evaluate(fn, args))))

/** Inspect generated syntax without evaluating recipes or their captures. @type {(node: unknown, predicate: (node: unknown) => boolean) => boolean} */
const contains = (node, predicate) => predicate(node) || node !== null && typeof node === 'object'
    && Object.values(node).some(value => contains(value, predicate))

/** @type {(node: unknown) => boolean} */
const tailPacket = node => node instanceof Array && node[0] === 'array' && node[1] instanceof Array && node[1][0] === 'tail'
/** @type {(node: unknown) => boolean} */
const selfCall = node => node instanceof Array && node[0] === '()' && node[1] instanceof Array
    && node[1][0] === 'ref' && node[1][1] === self
/** @type {(node: unknown) => boolean} */
const owningSelfReturn = node => node instanceof Array && node[0] === 'return' && node[1] === owner
    && (selfCall(node[2]) || node[2] instanceof Array && node[2][0] === 'if'
        && [node[2][2], node[2][3]].some(region => region.exit[0] === 'yield'
            && region.exit[1].length === 1 && selfCall(region.exit[1][0])))

/** @type {(block: Block) => readonly FastFunction[]} */
const getters = block => block.statements.flatMap(statement => statement[0] === 'define'
    && statement[2] instanceof Array && statement[2][0] === 'function' ? [statement[2][1]] : [])

export const proof = /** @type {const} */ ({
    normalAndTailArmsRetainAnExplicitOwningSelfReturn: () => {
        const original = source(recipe(ref(accumulator), [
            ['if', [], ['>', ref(n), 0], body(['return', owner, recur()]), body(['yield', []])],
        ]))
        for (const convert of [normalize, normalizeReturns]) {
            const normalized = convert(original)
            assert(contains(normalized.body, tailPacket), 'a getter must return the arguments of its deferred self tail call')
            assert(contains(normalized.body, owningSelfReturn), 'the source demand must reconstruct an owning self tail return')
            assert(getters(normalized.body).every(fn => fn.captures.every(capture => capture.binding !== self)),
                'the deferred tail callee must not become a getter capture')
            assertEq(data(normalized, [0, 7]), 7)
            assertEq(data(normalized, [4, 7]), 11)
        }
    },
    unusedSelfContextKeepsExistingDeferredReturnPrograms: () => {
        const original = source(recipe(ref(accumulator), [
            ['if', [], ['>', ref(n), 0], body(['return', owner, 23]), body(['yield', []])],
        ]))
        /** @type {readonly ((block: Block, sourceSelf?: BindingId | null) => Block)[]} */
        const normalizers = [
            (block, sourceSelf) => normalizeMemo(block, [], owner, sourceSelf),
            (block, sourceSelf) => normalizeLazyReturns(block, owner, sourceSelf),
        ]
        for (const convert of normalizers) {
            const normalized = convert(original.body, self)
            assertStructurallySame(normalized, convert(original.body, null))
            assertStructurallySame(normalized, convert(original.body))
            assertEq(data({ ...original, body: normalized }, [0, 7]), 7)
            assertEq(data({ ...original, body: normalized }, [1, 7]), 23)
        }
    },
    returnedConditionalsAndCommaPrefixesKeepTheirTailRegion: () => {
        const original = source(recipe(ref(accumulator), [
            ['if', [], ['>', ref(n), 0], body(['return', owner, ['?:', ['===', ref(n), 1],
                [',', [['array', [ref(n)]], recur()]], recur()]]), body(['yield', []])],
        ]))
        const normalized = normalize(original)
        assert(contains(normalized.body, tailPacket))
        assertEq(data(normalized, [3, 2]), 5)
    },
    returnedConditionalArmsKeepTheirAbruptCompletion: () => {
        const original = source(['block', body(['return', owner, ['if', ['<', ref(n), 0],
            body(['throw', 'negative recursion input']),
            body(['yield', [['?:', ['>', ref(n), 0], recur(), ref(accumulator)]]]),
        ]])])
        for (const convert of [normalize, normalizeReturns]) {
            const normalized = convert(original)
            assert(contains(normalized.body, tailPacket))
            assertEq(data(normalized, [0, 7]), 7)
            assertEq(data(normalized, [3, 7]), 10)
            assertError(evaluate(normalized, [-1, 7]))
        }
    },
    nestedGettersSharePrerequisitesAndForwardTailPackets: () => {
        const inner = recipe(ref(prerequisite), [
            ['if', [], ['>', ref(n), 0], body(['return', owner, recur([
                ['-', ref(n), 1], ['+', ['.', ref(prerequisite), 0], 1],
            ])]), body(['yield', []])],
        ])
        const original = source(recipe(['array', [ref(local), ref(local), ref(prerequisite)]], [
            ['define', local, inner, 'lazy'],
        ]), [['define', prerequisite, ['array', [ref(accumulator)]], 'lazy']])
        const normalized = normalize(original)
        assert(contains(normalized.body, tailPacket))
        const value = data(normalized, [3, 4])
        assertStructurallySame(value, [[7], [7], [7]])
        assert(value instanceof Array)
        assertEq(value[0], value[1])
        assertEq(value[0], value[2])
    },
    selfAliasesAndReachedCapturesKeepTheirSourceOwner: () => {
        /** @type {FastFunction} */
        const nested = { target: nestedOwner, parameters: [], rest: null, self: null,
            captures: [{ binding: capture, value: ['if', ['>', ref(n), 0],
                body(['return', owner, recur(undefined, nextAlias)]), body(['yield', [ref(accumulator)]])] }],
            body: body(['return', nestedOwner, ref(capture)]) }
        const original = source(recipe(['()', ref(closure), []], [
            ['define', closure, ['function', nested], 'required'],
        ]), [['define', alias, ref(self), 'lazy'], ['define', nextAlias, ref(alias), 'required']])
        const normalized = normalize(original)
        assert(contains(normalized.body, tailPacket))
        assert(contains(normalized.body, owningSelfReturn))
        assert(getters(normalized.body).every(fn => fn.captures.every(capture => capture.binding !== self
            && capture.binding !== alias && capture.binding !== nextAlias)))
        assertEq(data(normalized, [3, 4]), 7)
    },
    selfAliasSnapshotsSurviveLaterDeclarationsOfTheSameBinding: () => {
        const initializer = recipe(ref(accumulator), [
            ['if', [], ['>', ref(n), 0], body(['return', owner, recur(undefined, alias)]), body(['yield', []])],
        ])
        const original = source(initializer, [['define', alias, ref(self), 'required']])
        const statements = original.body.statements
        /** @type {FastFunction} */
        const shadowed = { ...original, body: body(original.body.exit, [
            ...statements.slice(0, -1), ['define', alias, ref(accumulator), 'required'], statements[statements.length - 1],
        ]) }
        const normalized = normalize(shadowed)
        assert(contains(normalized.body, tailPacket))
        assertEq(data(normalized, [3, 4]), 7)

        /** @type {FastFunction} */
        const ordinary = { target: nestedOwner, parameters: [], rest: null, self: null,
            captures: [{ binding: capture, value: ref(accumulator) }], body: body(['return', nestedOwner, ['+', ref(capture), 100]]) }
        const later = source(['block', body(['return', owner, ['()', ref(alias), []]], [
            ['define', local, ref(prerequisite), 'required'],
        ])], [
            ['define', alias, ref(self), 'required'], ['define', prerequisite, initializer, 'lazy'],
            ['define', alias, ['function', ordinary], 'required'],
        ])
        assertEq(data(normalize(later), [3, 4]), 107)
    },
    skippedTailArgumentsAndUnusedCapturesRemainDeferred: () => {
        /** @type {FastFunction} */
        const hidden = { target: nestedOwner, parameters: [], rest: null, self: null,
            captures: [{ binding: capture, value: ['+', 1, 1n] }], body: body(['return', nestedOwner, ref(capture)]) }
        const original = source(recipe(ref(accumulator), [
            ['if', [], ['>', ref(n), 0], body(['return', owner, recur([0, 0, ['+', 1, 1n]])]), body(['yield', []])],
        ]), [['define', unused, ['function', hidden], 'lazy']])
        /** @type {FastFunction} */
        const skipped = { ...original, body: body(['return', owner, 23], original.body.statements.slice(0, -1)) }
        assertEq(data(normalize(skipped), [1, 8]), 23)
        const normalized = normalize(original)
        assertEq(data(normalized, [0, 8]), 8)
        assertError(evaluate(normalized, [1, 8]))
    },
    extraArgumentsSpreadsAndMissingValuesRetainCallSemantics: () => {
        /** @type {readonly (readonly Item<Value>[])[]} */
        const argumentsList = [
            [0, ['+', ref(accumulator), 1], 99],
            [['...', ['array', [0, ['+', ref(accumulator), 1], 99]]]],
            [0],
        ]
        for (const args of argumentsList) {
            const normalized = normalize(source(recipe(ref(accumulator), [
                ['if', [], ['>', ref(n), 0], body(['return', owner, recur(args)]), body(['yield', []])],
            ])))
            assertEq(data(normalized, [1, 4]), args.length === 1 && args[0] === 0 ? undefined : 5)
        }
        for (const call of [recur([0, 4, ['+', 1, 1n]]), recur([['...', null]])]) {
            const normalized = normalize(source(recipe(ref(accumulator), [
                ['if', [], ['>', ref(n), 0], body(['return', owner, call]), body(['yield', []])],
            ])))
            assertError(evaluate(normalized, [1, 4]))
        }
    },
    restSnapshotsKeepFreshInvocationIdentityAndSavedValues: () => {
        /** @type {FastFunction} */
        const original = { ...source(recipe(['array', [['===', ref(accumulator), ref(rest)], ref(accumulator), ref(rest)]], [
            ['if', [], ['>', ref(n), 0], body(['return', owner, recur([
                ['-', ref(n), 1], ref(rest), ['...', ref(rest)],
            ])]), body(['yield', []])],
        ])), rest }
        const value = data(normalize(original), [2, null, 7, 8])
        assertStructurallySame(value, [false, [7, 8], [7, 8]])
        assert(value instanceof Array)
        assert(value[1] !== value[2])
    },
    commaWorkStillFailsBeforeTheDeferredTailCall: () => {
        const normalized = normalize(source(recipe(ref(accumulator), [
            ['if', [], ['>', ref(n), 0], body(['return', owner, [',', [['+', 1, 1n], recur()]]]), body(['yield', []])],
        ])))
        assertEq(data(normalized, [0, 6]), 6)
        assertError(evaluate(normalized, [1, 6]))
    },
})
