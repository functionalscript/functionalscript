/**
 * Self-alias elimination must retain bindings needed by untouched regions.
 * Loops and lazy initializers can need no memo transport while still reading
 * an established alias or capturing it in an ordinary nested function.
 * @import { Block, Definition, Function as FastFunction, Value } from '../types.ts'
 */

import { assert, assertEq, assertError, assertOk } from '../../../asserts/module.f.js'
import { identityAnalysis } from '../../../edag/analysis/module.f.mjs'
import { fromFast } from '../../../edag/from_fast/module.f.mjs'
import { memo } from '../../../edag/memo/module.f.mjs'
import { prepareFunction } from '../prepare/module.f.mjs'
import { functionStringify } from '../serializer/module.f.mjs'
import { _freshSelf, normalizeLazyReturns, normalizeMemo } from './module.f.mjs'

/** @type {(kind: 'ordinary' | 'terminal' | 'nested' | 'nested-terminal' | 'lazy' | 'lazy-loop' | 'recipe-lazy' | 'recipe-lazy-loop', mode: Definition[3], capture: boolean) => FastFunction} */
const fixture = (kind, mode, capture) => {
    const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
    const nestedOwner = /** @type {const} */ ({ kind: 'function', index: 1 })
    const outer = /** @type {const} */ ({ kind: 'loop', index: 0 })
    const inner = /** @type {const} */ ({ kind: 'loop', index: 1 })
    const self = /** @type {const} */ ({ index: 0 })
    const alias = /** @type {const} */ ({ index: 1 })
    const again = /** @type {const} */ ({ index: 2 })
    const selected = /** @type {const} */ ({ index: 3 })
    const cell = /** @type {const} */ ({ index: 4 })
    const output = /** @type {const} */ ({ index: 5 })
    const innerOutput = /** @type {const} */ ({ index: 6 })
    const closure = /** @type {const} */ ({ index: 7 })
    const captured = /** @type {const} */ ({ index: 8 })
    const kept = /** @type {const} */ ({ index: 9 })
    /** @type {Value} */
    const comparison = ['===', capture ? ['()', ['ref', closure], []] : ['ref', again], ['ref', self]]
    /** @type {Value} */
    const closureValue = ['function', { target: nestedOwner,
        parameters: [], rest: null, self: null, captures: [{ binding: captured, value: ['ref', again] }],
        body: { statements: [], exit: ['return', nestedOwner, ['ref', captured]] } }]
    /** @type {readonly Definition[]} */
    const capturePrefix = capture ? [['define', closure, closureValue, 'required']] : []
    /** @type {Block} */
    const terminalBody = { statements: capturePrefix, exit: ['return', owner, comparison] }
    const terminal = kind === 'terminal' || kind === 'nested-terminal'
    const nested = kind === 'nested' || kind === 'nested-terminal' || kind === 'recipe-lazy-loop'
    /** @type {Block} */
    const innerBody = terminal ? terminalBody : { statements: capturePrefix, exit: ['break', inner, [comparison]] }
    /** @type {Block} */
    const outerBody = nested ? terminal
        ? { statements: [], exit: ['loop', { target: inner, parameters: [], initial: [], results: [], body: innerBody }] }
        : { statements: [['loop', { target: inner, parameters: [], initial: [], results: [innerOutput], body: innerBody }]],
            exit: ['break', outer, [['ref', innerOutput]]] }
        : terminal ? terminalBody : { statements: capturePrefix, exit: ['break', outer, [comparison]] }
    /** @type {readonly Definition[]} */
    const prefix = [
        ['define', alias, ['ref', self], mode],
        ['define', again, ['ref', alias], mode],
        ['define', cell, ['block', { statements: [], exit: ['return', owner, 7] }], 'lazy'],
    ]
    const local = kind === 'recipe-lazy' || kind === 'recipe-lazy-loop'
    const lazyLoop = kind === 'lazy-loop' || kind === 'recipe-lazy-loop'
    /** @type {Value} */
    const keptValue = lazyLoop ? ['block', { statements: [['loop', { target: outer, parameters: [], initial: [], results: [output], body: outerBody }]],
        exit: ['yield', [['ref', output]]] }] : ['array', [capture ? closureValue : ['ref', again]]]
    /** @type {Value} */
    const keptResult = lazyLoop ? ['ref', kept] : ['===', capture ? ['()', ['.', ['ref', kept], 0], []] : ['.', ['ref', kept], 0], ['ref', self]]
    /** @type {Value} */
    const localRecipe = ['block', { statements: [...prefix.slice(0, 2), ['define', kept, keptValue, 'lazy'],
        ['if', [], ['ref', selected], { statements: [], exit: ['return', owner, 7] }, { statements: [], exit: ['yield', []] }]],
        exit: ['yield', [keptResult]] }]
    /** @type {Block} */
    const body = local ? { statements: [['define', cell, localRecipe, 'lazy']], exit: ['return', owner, ['ref', cell]] }
        : kind === 'lazy' || kind === 'lazy-loop' ? { statements: [...prefix, ['define', kept, keptValue, 'lazy']],
        exit: ['return', owner, ['if', ['ref', selected],
            { statements: [], exit: ['yield', [['ref', cell]]] },
            { statements: [], exit: ['yield', [keptResult]] }]] }
        : terminal ? { statements: [...prefix, ['if', [], ['ref', selected],
            { statements: [], exit: ['return', owner, ['ref', cell]] }, { statements: [], exit: ['yield', []] }]],
            exit: ['loop', { target: outer, parameters: [], initial: [], results: [], body: outerBody }] }
            : { statements: [...prefix, ['loop', { target: outer, parameters: [], initial: [], results: [output], body: outerBody }]],
                exit: ['return', owner, ['if', ['ref', selected],
                    { statements: [], exit: ['yield', [['ref', cell]]] }, { statements: [], exit: ['yield', [['ref', output]]] }]] }
    return { target: owner, parameters: [selected], rest: null, self, captures: [], body }
}

/** @type {(fn: FastFunction, selected: boolean) => import('../../../edag/value/control/types.ts').ValueResult} */
const invoke = (fn, selected) => {
    const graph = fromFast({ statements: [], exit: ['yield', [['()', ['function', fn], [selected]]]] })
    return memo(assertOk(identityAnalysis(graph)))({ args: [] })
}

/** @type {(fn: FastFunction, selected: boolean) => unknown} */
const evaluate = (fn, selected) => assertOk(invoke(fn, selected))

/** The outer function's self and a nested binding can share a resolved ID. @type {(kind: 'loop' | 'loop-result' | 'define' | 'block' | 'if', mode: Definition[3]) => FastFunction} */
const shadowFixture = (kind, mode) => {
    const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
    const loop = /** @type {const} */ ({ kind: 'loop', index: 0 })
    const self = /** @type {const} */ ({ index: 0 })
    const alias = /** @type {const} */ ({ index: 1 })
    const cell = /** @type {const} */ ({ index: 2 })
    const output = /** @type {const} */ ({ index: 3 })
    const selected = /** @type {const} */ ({ index: 4 })
    /** @type {Value} */
    const comparison = ['===', ['ref', alias], ['ref', self]]
    /** @type {Block} */
    const seven = { statements: [], exit: ['yield', [7]] }
    /** @type {Block['statements']} */
    const shadow = kind === 'loop'
        ? [['loop', { target: loop, parameters: [self], initial: [7], results: [output],
            body: { statements: [], exit: ['break', loop, [comparison]] } }]]
        : kind === 'loop-result' ? [['loop', { target: loop, parameters: [], initial: [], results: [self],
            body: { statements: [], exit: ['break', loop, [7]] } }]]
            : kind === 'define' ? [['define', self, 7, 'required']]
            : kind === 'block' ? [['block', [self], seven]]
                : [['if', [self], true, seven, { statements: [], exit: ['yield', [9]] }]]
    return { target: owner, parameters: [selected], rest: null, self, captures: [], body: {
        statements: [['define', alias, ['ref', self], mode],
            ['define', cell, ['block', { statements: [], exit: ['return', owner, 23] }], 'lazy'], ...shadow],
        exit: ['return', owner, ['if', ['ref', selected],
            { statements: [], exit: ['yield', [['ref', cell]]] },
            { statements: [], exit: ['yield', [kind === 'loop' ? ['ref', output] : comparison]] }]],
    } }
}

/** @type {(kind: Parameters<typeof shadowFixture>[0]) => void} */
const checkShadow = kind => {
    for (const mode of /** @type {const} */ (['required', 'lazy'])) {
        const original = shadowFixture(kind, mode)
        const fresh = _freshSelf(original)
        assert(fresh.self !== original.self)
        assertEq(fresh.target, original.target)
        assertEq(fresh.parameters, original.parameters)
        assertEq(fresh.captures, original.captures)
        /** @type {readonly FastFunction[]} */
        const versions = [original, fresh,
            { ...original, body: normalizeMemo(original.body, [], original.target, null) },
            { ...original, body: normalizeMemo(original.body, [], original.target, original.self) },
            { ...original, body: normalizeLazyReturns(original.body, original.target, null) },
            { ...original, body: normalizeLazyReturns(original.body, original.target, original.self) },
            _freshSelf({ ...original, body: normalizeMemo(original.body, [], original.target, original.self) }),
            _freshSelf({ ...original, body: normalizeLazyReturns(original.body, original.target, original.self) }),
        ]
        for (const version of versions) {
            assertEq(evaluate(version, false), false)
            assertEq(evaluate(version, true), 23)
        }
    }
}

/** @type {(kind: Parameters<typeof fixture>[0]) => void} */
const check = kind => {
    for (const mode of /** @type {const} */ (['required', 'lazy'])) {
        for (const capture of [false, true]) {
            const original = fixture(kind, mode, capture)
            /** @type {readonly ((self: FastFunction['self']) => FastFunction)[]} */
            const normalizers = [
                self => ({ ...original, body: normalizeMemo(original.body, [], original.target, self) }),
                self => ({ ...original, body: normalizeLazyReturns(original.body, original.target, self) }),
            ]
            for (const normalize of normalizers) {
                const baseline = normalize(null)
                const current = normalize(original.self)
                assertEq(evaluate(baseline, false), true)
                assertEq(evaluate(current, false), true)
                assertEq(evaluate(baseline, true), 7)
                assertEq(evaluate(current, true), 7)
            }
        }
    }
}

export const proof = /** @type {const} */ ({
    functionsWithoutSelfNeedNoFreshBinding: () => {
        const source = shadowFixture('loop', 'required')
        /** @type {FastFunction} */
        const plain = { ...source, self: null, body: { statements: [], exit: ['return', source.target, 7] } }
        assertEq(_freshSelf(plain), plain)
        assertEq(evaluate(plain, false), 7)
    },
    initialOnlySelfRenamingSurvivesAnUnchangedOrdinaryLoop: () => {
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const self = /** @type {const} */ ({ index: 0 })
        const state = /** @type {const} */ ({ index: 1 })
        const output = /** @type {const} */ ({ index: 2 })
        const callable = /** @type {const} */ ({ index: 3 })
        /** @type {FastFunction} */
        const original = { target: owner, parameters: [], rest: null, self, captures: [], body: {
            statements: [['loop', { target, parameters: [state], initial: [['ref', self]], results: [output],
                body: { statements: [], exit: ['break', target, [['ref', state]]] } }]],
            exit: ['return', owner, ['ref', output]],
        } }
        const fresh = _freshSelf(original)
        assert(fresh.self !== null && fresh.self !== self)
        const [source] = original.body.statements
        const [mapped] = fresh.body.statements
        assert(source[0] === 'loop' && mapped[0] === 'loop')
        assertEq(mapped[1].body, source[1].body)
        const [initial] = mapped[1].initial
        assert(initial instanceof Array && initial[0] === 'ref')
        assertEq(initial[1], fresh.self)
        for (const fn of [original, fresh]) {
            const graph = fromFast({ statements: [['define', callable, ['function', fn], 'required']],
                exit: ['yield', [['===', ['()', ['ref', callable], []], ['ref', callable]]]] })
            assertEq(assertOk(memo(assertOk(identityAnalysis(graph)))({ args: [] })), true)
            assert(functionStringify(prepareFunction(fn)).length !== 0)
        }
    },
    freshSelfRenamingPreservesDefinitionsAndUnreachableSyntax: () => {
        const source = shadowFixture('loop', 'required')
        const oldSelf = source.self
        assert(oldSelf !== null)
        const unused = /** @type {const} */ ({ index: 8 })
        /** @type {FastFunction} */
        const input = { ...source, body: { statements: [
            ['block', [], { statements: [], exit: ['return', source.target, 7] }],
            ['define', unused, ['array', [['ref', oldSelf]]], 'lazy'],
        ], exit: ['return', source.target, ['ref', oldSelf]] } }
        const fresh = _freshSelf(input)
        assert(fresh.self !== null && fresh.self !== oldSelf)
        assertEq(fresh.body.statements.length, 2)
        const declaration = fresh.body.statements[1]
        assert(declaration[0] === 'define' && declaration[2] instanceof Array && declaration[2][0] === 'array')
        const read = declaration[2][1][0]
        assert(read instanceof Array && read[0] === 'ref')
        assertEq(read[1], fresh.self)
        assertEq(declaration[1], unused)
        assertEq(declaration[3], 'lazy')
        assert(fresh.body.exit[0] === 'return' && fresh.body.exit[2] instanceof Array && fresh.body.exit[2][0] === 'ref')
        assertEq(fresh.body.exit[1], source.target)
        assertEq(fresh.body.exit[2][1], fresh.self)
        assertEq(evaluate(fresh, false), 7)
    },
    freshSelfRenamingPreservesOwningOperandReturns: () => {
        const source = shadowFixture('block', 'required')
        const oldSelf = source.self
        assert(oldSelf !== null)
        const result = /** @type {const} */ ({ index: 8 })
        /** @type {FastFunction} */
        const input = { ...source, body: { statements: [['define', result, ['block', {
            statements: [], exit: ['return', source.target, ['ref', oldSelf]],
        }], 'required']], exit: ['return', source.target, ['ref', result]] } }
        const fresh = _freshSelf(input)
        const declaration = fresh.body.statements[0]
        assert(declaration[0] === 'define' && declaration[2] instanceof Array && declaration[2][0] === 'block')
        const exit = declaration[2][1].exit
        assert(exit[0] === 'return' && exit[2] instanceof Array && exit[2][0] === 'ref')
        assertEq(exit[1], source.target)
        assertEq(exit[2][1], fresh.self)
    },
    ordinaryLoopsRetainEstablishedAliases: () => { check('ordinary') },
    terminalLoopsRetainEstablishedAliases: () => { check('terminal') },
    nestedLoopsRetainEstablishedAliases: () => { check('nested') },
    nestedTerminalLoopsRetainEstablishedAliases: () => { check('nested-terminal') },
    unselectedLazyInitializersRetainEstablishedAliases: () => { check('lazy') },
    unselectedLazyLoopInitializersRetainEstablishedAliases: () => { check('lazy-loop') },
    recipeLocalUnselectedInitializersRetainEstablishedAliases: () => { check('recipe-lazy') },
    recipeLocalUnselectedLoopInitializersRetainEstablishedAliases: () => { check('recipe-lazy-loop') },
    loopParametersCannotReplaceTheEstablishedSelfAnchor: () => { checkShadow('loop') },
    loopResultsCannotReplaceTheEstablishedSelfAnchor: () => { checkShadow('loop-result') },
    localDefinitionsCannotReplaceTheEstablishedSelfAnchor: () => { checkShadow('define') },
    blockResultsCannotReplaceTheEstablishedSelfAnchor: () => { checkShadow('block') },
    conditionalResultsCannotReplaceTheEstablishedSelfAnchor: () => { checkShadow('if') },
    aliasOnlyRewritingDoesNotRunDeferredPrefixes: () => {
        const failed = /** @type {const} */ ({ index: 10 })
        for (const mode of /** @type {const} */ (['required', 'lazy'])) {
            const original = fixture('lazy-loop', mode, true)
            const kept = original.body.statements.at(-1)
            assert(kept !== undefined && kept[0] === 'define')
            /** @type {Value} */
            const initializer = ['block', { statements: [['define', failed, ['+', 1, 1n], 'required']], exit: ['yield', [kept[2]]] }]
            /** @type {FastFunction} */
            const fn = { ...original, body: { ...original.body,
                statements: [...original.body.statements.slice(0, -1), ['define', kept[1], initializer, 'lazy']] } }
            /** @type {readonly FastFunction[]} */
            const versions = [fn,
                { ...fn, body: normalizeMemo(fn.body, [], fn.target, fn.self) },
                { ...fn, body: normalizeLazyReturns(fn.body, fn.target, fn.self) },
            ]
            for (const version of versions) {
                assertEq(evaluate(version, true), 7)
                assertError(invoke(version, false))
            }
        }
    },
})
