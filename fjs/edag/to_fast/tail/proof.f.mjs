/**
 * @import { Block, BindingId, Function as FastFunction, Loop, LoopTarget, Statement, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { _tailCalls } from './module.f.mjs'
import { proof as semantic, _tailFunction } from '../tail_calls/proof.f.mjs'
import { toFast } from '../module.f.mjs'
import { fromFast } from '../../from_fast/module.f.mjs'
import { evaluate, failure } from '../../from_fast/member_returns/proof.f.mjs'

/** @type {(index?: number) => BindingId} */
const id = (index = 0) => ({ index })
/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]

/** @type {(value: Value, statements?: readonly Statement[]) => Block} */
const yielded = (value, statements = []) => ({ statements, exit: ['yield', [value]] })

/** Statement identity is independent of the spelling of its diagnostic index. @type {(root: Block) => readonly Statement[]} */
const statementsOf = root => {
    /** @type {readonly Block[]} */
    let pending = [root]
    /** @type {readonly Statement[]} */
    let statements = []
    while (pending.length !== 0) {
        const [block, ...rest] = pending
        statements = [...statements, ...block.statements]
        pending = [...block.statements.flatMap(statement => statement[0] === 'block' ? [statement[2]]
            : statement[0] === 'if' ? [statement[3], statement[4]] : statement[0] === 'loop' ? [statement[1].body] : []), ...rest]
    }
    return statements
}

/** @type {(root: Block) => readonly Block['exit'][]} */
const exitsOf = root => [root.exit, ...statementsOf(root).flatMap(statement => statement[0] === 'block' ? [statement[2].exit]
    : statement[0] === 'if' ? [statement[3].exit, statement[4].exit] : statement[0] === 'loop' ? [statement[1].body.exit] : [])]

/** Interpret both sides without requiring a host compilation boundary.
 * @type {(source: Block, parameters: readonly BindingId[], self: BindingId) => { readonly original: Exp; readonly lowered: Exp; readonly body: Block }}
 */
const lowering = (source, parameters, self) => {
    const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
    const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
    const body = _tailCalls(source, parameters, self, target)
    assert(body !== null && source.exit[0] === 'yield')
    /** @type {FastFunction} */
    const original = { target: owner, parameters, rest: null, self, captures: [],
        body: { statements: source.statements, exit: ['return', owner, source.exit[1][0]] } }
    const entry = parameters.map(() => id()), result = id()
    /** @type {Loop} */
    const loop = { target, parameters, initial: entry.map(ref), results: [result], body }
    /** @type {FastFunction} */
    const lowered = { ...original, parameters: entry,
        body: { statements: [['loop', loop]], exit: ['return', owner, ref(result)] } }
    return { original: fromFast(yielded(['function', original])), lowered: fromFast(yielded(['function', lowered])), body }
}

/** Three independent roots share required and deferred values in their arguments. */
const independent = () => {
    const self = id(), count = id(), choice = id(), previous = id()
    const required = id(), shared = id(), first = id(), second = id(), third = id()
    const firstLocal = id(), secondLocal = id()
    /** @type {Statement} */
    const prefix = ['define', required, ['array', [ref(count)]], 'required']
    /** @type {Statement} */
    const deferred = ['define', shared, ['array', [ref(count)]], 'lazy']
    /** @type {Statement} */
    const firstPrefix = ['define', firstLocal, ['array', [1]], 'required']
    /** @type {Statement} */
    const secondPrefix = ['define', secondLocal, ['array', [2]], 'required']
    /** @type {Value} */
    const payload = ['array', [ref(previous), ref(required), ref(shared), ref(shared)]]
    /** @type {Value} */
    const firstValue = ['block', yielded(['()', ref(self), [['-', ref(count), 1], 0, payload]], [firstPrefix])]
    /** @type {Value} */
    const secondValue = ['block', yielded(['()', ref(self), [['-', ref(count), 1], 1, payload]], [secondPrefix])]
    /** @type {Value} */
    const thirdValue = ['array', [ref(required), ref(shared), ref(shared)]]
    /** @type {Value} */
    const left = ['if', ['===', ref(choice), 0], yielded(ref(first)),
        yielded(['if', ['===', ref(choice), 1], yielded(ref(second)), yielded(ref(third))])]
    /** @type {Value} */
    const right = ['if', ['===', ref(choice), 2], yielded(ref(third)),
        yielded(['if', ['===', ref(choice), 1], yielded(ref(second)), yielded(ref(first))])]
    const source = yielded(['if', ['>', ref(count), 0],
        yielded(['if', ['>', ref(count), 2], yielded(left), yielded(right)]), yielded(ref(previous))], [
        prefix, deferred, ['define', first, firstValue, 'lazy'], ['define', second, secondValue, 'lazy'], ['define', third, thirdValue, 'lazy'],
    ])
    return { source, parameters: [count, choice, previous], self, first, second, third, required, shared,
        prefix, deferred, firstPrefix, secondPrefix }
}

export const proof = /** @type {const} */ ({
    invocationPrefixSnapshotsUseOnlyEstablishedInputsAndDependencies: () => {
        const self = id(), parameter = id(), rest = id(), literal = id(), alias = id(), array = id(), object = id(), reader = id(), capture = id()
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const owner = /** @type {const} */ ({ kind: 'function', index: 1 })
        /** @type {readonly Statement[]} */
        const definitions = [
            ['define', literal, 7, 'lazy'],
            ['define', alias, ref(parameter), 'lazy'],
            ['define', array, ['array', [ref(alias), ref(self), ref(rest)]], 'lazy'],
            ['define', object, ['object', [[':', 'snapshot', ref(array)], [':', 0, ref(literal)]]], 'lazy'],
            ['define', reader, ['function', { target: owner, parameters: [], rest: null, self: null,
                captures: [{ binding: capture, value: ref(object) }], body: { statements: [], exit: ['return', owner, ref(capture)] } }], 'lazy'],
        ]
        const source = yielded(['()', ref(self), [ref(parameter)]], definitions)
        const result = _tailCalls(source, [parameter], self, target, rest)
        assert(result !== null)
        for (const [index, original] of definitions.entries()) {
            const definition = result.statements[index]
            assert(original[0] === 'define' && definition[0] === 'define')
            assertEq(definition[1], original[1])
            assertEq(definition[2], original[2])
            assertEq(definition[3], 'required')
        }
    },
    invocationPrefixSnapshotsDoNotDemandUnknownOwnersOrWork: () => {
        const self = id(), parameter = id(), unknown = id(), required = id()
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const owner = /** @type {const} */ ({ kind: 'function', index: 1 })
        const capture = id()
        /** @type {readonly Value[]} */
        const deferred = [
            ref(unknown), ['array', [ref(unknown)]], ['array', [['...', ref(parameter)]]],
            ['object', [['...', ref(parameter)]]], ['object', [[':', ['Number', ref(parameter)], 1]]],
            ['object', [[':', 'unknown', ref(unknown)]]],
            ['function', { target: owner, parameters: [], rest: null, self: null,
                captures: [{ binding: capture, value: ref(unknown) }], body: { statements: [], exit: ['return', owner, ref(capture)] } }],
            ['()', ref(parameter), []], ['.', ref(parameter), 'value'], ['+', ref(parameter), 1],
        ]
        /** @type {readonly Statement[]} */
        const definitions = [
            ...deferred.map(/** @returns {Statement} */ value => ['define', id(), value, 'lazy']),
            ['define', required, ['()', ref(parameter), []], 'required'],
            ['define', id(), ['array', [ref(required)]], 'lazy'],
        ]
        const result = _tailCalls(yielded(['()', ref(self), [ref(parameter)]], definitions), [parameter], self, target)
        assert(result !== null)
        for (const [index, definition] of definitions.slice(0, -1).entries()) { assertEq(result.statements[index], definition) }
        const promoted = result.statements.at(-1)
        assert(promoted !== undefined && promoted[0] === 'define')
        assertEq(promoted[3], 'required')
    },
    invocationPrefixSnapshotsStopAtControlStatements: () => {
        const self = id(), parameter = id(), value = id()
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        /** @type {Statement} */
        const decision = ['if', [], true, { statements: [], exit: ['yield', []] }, { statements: [], exit: ['yield', []] }]
        /** @type {Statement} */
        const deferred = ['define', value, ['array', [ref(parameter)]], 'lazy']
        const result = _tailCalls(yielded(['()', ref(self), [ref(parameter)]], [decision, deferred]), [parameter], self, target)
        assert(result !== null)
        assertEq(result.statements[0], decision)
        assertEq(result.statements[1], deferred)
    },
    terminalLoopsKeepRecipeUsesInsideTheirOwningLoop: () => {
        const self = /** @type {const} */ ({ index: 0 })
        const parameter = /** @type {const} */ ({ index: 1 })
        const recipe = /** @type {const} */ ({ index: 2 })
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        /** @type {Block} */
        const terminal = { statements: [], exit: ['loop', { target, parameters: [], initial: [], results: [],
            body: { statements: [], exit: ['continue', target, []] } }] }
        assertEq(_tailCalls(terminal, [parameter], self, target), null)
        /** @type {Block} */
        const withRecipe = { statements: [['define', recipe, ['array', [['ref', parameter]]], 'lazy']], exit: ['loop', {
            target, parameters: [], initial: [], results: [], body: { statements: [['define', parameter, ['ref', recipe], 'required']], exit: ['continue', target, []] },
        }] }
        assertEq(_tailCalls(withRecipe, [parameter], self, target), null)
        const selected = _tailCalls(yielded(['if', true, yielded(['ref', recipe]), terminal],
            [['define', recipe, ['array', [['ref', parameter]]], 'lazy']]), [parameter], self, target)
        assert(selected !== null)
        const branch = selected.statements[0]
        assert(branch[0] === 'if')
        assertEq(branch[4].exit, terminal.exit)
    },
    terminalBaseRecipesNeedNoRecursiveBackedge: () => {
        const self = /** @type {BindingId} */ ({ index: 0 })
        const parameter = /** @type {BindingId} */ ({ index: 1 })
        const recipe = /** @type {BindingId} */ ({ index: 2 })
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const value = /** @type {Value} */ (['array', [['ref', parameter]]])
        const source = yielded(['if', true, yielded(['ref', recipe]), yielded(['ref', recipe])], [['define', recipe, value, 'lazy']])
        const normalized = _tailCalls(source, [parameter], self, target)
        assert(normalized !== null)
        assert(normalized.exit[0] === 'break')
        assertStructurallySame(normalized.exit, ['break', target, [value]])
        assertEq(normalized.exit[2][0], value)
    },
    sharedTerminalRecipesKeepOneRequiredPrefixAndTransition: () => {
        const self = /** @type {BindingId} */ ({ index: 0 })
        const parameter = /** @type {BindingId} */ ({ index: 1 })
        const recipe = /** @type {BindingId} */ ({ index: 2 })
        const local = /** @type {BindingId} */ ({ index: 3 })
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const prefix = /** @type {Statement} */ (['define', local, ['array', [['ref', parameter]]], 'required'])
        const next = /** @type {Value} */ (['-', ['ref', parameter], 1])
        const continuation = /** @type {Value} */ (['block', yielded(['()', ['ref', self], [next]], [prefix])])
        const source = yielded(['if', ['>', ['ref', parameter], 0],
            yielded(['if', ['===', ['%', ['ref', parameter], 2], 0], yielded(['ref', recipe]), yielded(['ref', recipe])]),
            yielded('done')], [['define', recipe, continuation, 'lazy']])
        const normalized = _tailCalls(source, [parameter], self, target)
        assert(normalized !== null)
        assertEq(statementsOf(normalized).filter(statement => statement === prefix).length, 1)
        assert(!statementsOf(normalized).some(statement => statement[0] === 'define' && statement[1] === recipe))
        assert(normalized.exit[0] === 'continue')
        assertEq(normalized.exit[2][0], next)
        const selection = normalized.statements[0]
        assert(selection[0] === 'if')
        assertStructurallySame(selection[4].exit, ['break', target, ['done']])
        const failed = /** @type {Block} */ ({ statements: [], exit: ['throw', 7] })
        const selectedFailure = _tailCalls(yielded(['if', true, yielded(['ref', recipe]), failed], [['define', recipe, continuation, 'lazy']]), [parameter], self, target)
        assert(selectedFailure !== null)
        const condition = selectedFailure.statements[0]
        assert(condition[0] === 'if')
        assertEq(condition[4], failed)
    },
    exclusiveLazyDependenciesKeepTheirDemandOrder: () => {
        const self = /** @type {BindingId} */ ({ index: 0 })
        const parameter = /** @type {BindingId} */ ({ index: 1 })
        const first = /** @type {BindingId} */ ({ index: 2 })
        const second = /** @type {BindingId} */ ({ index: 3 })
        const before = /** @type {Statement} */ (['define', { index: 4 }, ['array', [1]], 'required'])
        const after = /** @type {Statement} */ (['define', { index: 5 }, ['array', [2]], 'required'])
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const call = /** @type {Value} */ (['block', yielded(['()', ['ref', self], [['-', ['ref', parameter], 1]]], [after])])
        for (const recipe of /** @type {readonly (readonly ['ref', BindingId] | readonly ['block', Block])[]} */ ([['ref', first], ['block', yielded(['if', true, yielded(['ref', first]), yielded(['ref', first])], [before])]])) {
            const source = yielded(['if', ['>', ['ref', parameter], 0], yielded(['ref', second]), yielded(0)], [
                ['define', first, call, 'lazy'], ['define', second, recipe, 'lazy'],
            ])
            const normalized = _tailCalls(source, [parameter], self, target)
            assert(normalized !== null)
            const statements = statementsOf(normalized)
            assertEq(statements.filter(statement => statement === after).length, 1)
            assertEq(statements.filter(statement => statement === before).length, recipe[0] === 'ref' ? 0 : 1)
            if (recipe[0] !== 'ref') { assert(statements.indexOf(before) < statements.indexOf(after)) }
            assert(!statements.some(statement => statement[0] === 'define' && (statement[1] === first || statement[1] === second)))
        }
    },
    recipeDemandsInOtherOwnersRemainOrdinaryCalls: () => {
        const self = /** @type {BindingId} */ ({ index: 0 })
        const parameter = /** @type {BindingId} */ ({ index: 1 })
        const recipe = /** @type {BindingId} */ ({ index: 2 })
        const alias = /** @type {BindingId} */ ({ index: 3 })
        const captured = /** @type {BindingId} */ ({ index: 4 })
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const nested = /** @type {LoopTarget} */ ({ kind: 'loop', index: 1 })
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const call = /** @type {Value} */ (['()', ['ref', self], [['-', ['ref', parameter], 1]]])
        const definition = /** @type {Statement} */ (['define', recipe, call, 'lazy'])
        /** @type {readonly Block[]} */
        const sources = [
            yielded(['if', ['ref', recipe], yielded(['ref', recipe]), yielded(0)], [definition]),
            yielded(['+', ['ref', recipe], 1], [definition]),
            yielded(['()', ['ref', parameter], [['ref', recipe]]], [definition]),
            yielded(['function', { target: owner, parameters: [], rest: null, self: null,
                captures: [{ binding: captured, value: ['ref', recipe] }], body: { statements: [], exit: ['return', owner, ['ref', captured]] } }], [definition]),
            yielded(['ref', alias], [definition, ['define', alias, ['ref', recipe], 'required']]),
            yielded(['ref', alias], [definition, ['block', [alias], yielded(['ref', recipe])]]),
            yielded(['ref', alias], [definition, ['if', [alias], true, yielded(['ref', recipe]), yielded(0)]]),
            yielded(['ref', alias], [definition, ['loop', { target: nested, parameters: [captured], initial: [['ref', recipe]], results: [alias], body: {
                statements: [], exit: ['break', nested, [['ref', recipe]]],
            } }]]),
            yielded(0, [definition]),
        ]
        for (const source of sources) { assertEq(_tailCalls(source, [parameter], self, target), null) }
        const retained = _tailCalls(yielded(['block', yielded(['ref', alias], [['define', alias, ['ref', recipe], 'lazy']])], [definition]), [parameter], self, target)
        assert(retained !== null)
        assert(statementsOf(retained).includes(definition))
        assertStructurallySame(retained.exit, ['break', target, [['ref', recipe]]])
        assertEq(_tailCalls({ statements: [], exit: ['throw', 7] }, [parameter], self, target), null)
    },
    independentInterleavedRecipesHaveOneContinuationEach: () => {
        const self = /** @type {BindingId} */ ({ index: 0 })
        const parameter = /** @type {BindingId} */ ({ index: 1 })
        const first = /** @type {BindingId} */ ({ index: 2 })
        const second = /** @type {BindingId} */ ({ index: 3 })
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const arm = /** @type {Value} */ (['if', true, yielded(['ref', first]), yielded(['ref', second])])
        const source = yielded(['if', true, yielded(arm), yielded(arm)], [
            ['define', first, ['()', ['ref', self], [1]], 'lazy'],
            ['define', second, ['()', ['ref', self], [2]], 'lazy'],
        ])
        const normalized = _tailCalls(source, [parameter], self, target)
        assert(normalized !== null)
        const selection = normalized.statements[0]
        assert(selection[0] === 'block' && selection[1].length === 1)
        const dispatch = normalized.statements[1]
        assert(dispatch[0] === 'if' && dispatch[1].length === 0)
        assertStructurallySame(dispatch[2], ['===', ['ref', selection[1][0]], 0])
        const transfers = exitsOf(normalized).filter(exit => exit[0] === 'continue')
        assertStructurallySame(transfers, [['continue', target, [1]], ['continue', target, [2]]])
        assert(!statementsOf(normalized).some(statement => statement[0] === 'define' && (statement[1] === first || statement[1] === second)))
    },
    independentRecipesKeepSharedDependenciesOutsideTheSelector: () => {
        const fixture = independent()
        const { original, lowered, body } = lowering(fixture.source, fixture.parameters, fixture.self)
        assertEq(body.statements[0], fixture.prefix)
        assertStructurallySame(body.statements[1], ['define', fixture.shared, fixture.deferred[2], 'required'])
        const statements = statementsOf(body)
        assertEq(statements.filter(statement => statement === fixture.firstPrefix).length, 1)
        assertEq(statements.filter(statement => statement === fixture.secondPrefix).length, 1)
        assert(!statements.some(statement => statement[0] === 'define' && [fixture.first, fixture.second, fixture.third].includes(statement[1])))
        assertEq(exitsOf(body).filter(exit => exit[0] === 'continue').length, 2)
        for (const choice of /** @type {const} */ ([0, 1, 2])) {
            const args = /** @type {const} */ ([3, choice, null])
            const actual = evaluate(['()', lowered, args])
            assertStructurallySame(actual, evaluate(['()', original, args]))
            assert(actual instanceof Array)
            if (choice === 2) {
                assertEq(actual[1], actual[2])
                assert(actual[0] !== actual[1])
            } else {
                assertEq(actual[2], actual[3])
                assert(actual[1] !== actual[2])
                const previous = actual[0]
                assert(previous instanceof Array)
                assert(previous[2] !== actual[2])
            }
        }
    },
    independentRecipesKeepSelectedFailuresAndArgumentOrder: () => {
        const fixture = independent()
        /** @type {Block} */
        const failed = { statements: [], exit: ['throw', 'third recipe'] }
        /** @type {Statement} */
        const before = ['define', id(), ['block', { statements: [], exit: ['throw', 'before arguments'] }], 'required']
        /** @type {Value} */
        const argument = ['block', { statements: [], exit: ['throw', 'argument'] }]
        /** @type {Block} */
        const source = { ...fixture.source, statements: fixture.source.statements.map(/** @returns {Statement} */ statement =>
            statement[0] !== 'define' ? statement : statement[1] === fixture.first
                ? ['define', fixture.first, ['block', yielded(['()', ref(fixture.self), [argument, 0, null]], [before])], 'lazy']
                : statement[1] === fixture.third ? ['define', fixture.third, ['block', failed], 'lazy'] : statement) }
        const { original, lowered, body } = lowering(source, fixture.parameters, fixture.self)
        assertEq(statementsOf(body).filter(statement => statement === before).length, 1)
        assert(exitsOf(body).includes(failed.exit))
        for (const graph of /** @type {const} */ ([original, lowered])) {
            assertEq(failure(['()', graph, [3, 0, null]]), 'before arguments')
            assertEq(failure(['()', graph, [3, 2, null]]), 'third recipe')
        }
        assertStructurallySame(evaluate(['()', lowered, [3, 1, null]]), evaluate(['()', original, [3, 1, null]]))
    },
    independentRootsMoveTheirExclusiveChildrenInDemandOrder: () => {
        const fixture = independent()
        const first = fixture.source.statements[2], second = fixture.source.statements[3]
        assert(first[0] === 'define' && second[0] === 'define')
        const firstChild = id(), secondChild = id()
        /** @type {Statement} */
        const before = ['define', id(), ['array', [2]], 'required']
        /** @type {Block} */
        const source = { ...fixture.source, statements: [fixture.prefix, fixture.deferred,
            ['define', firstChild, first[2], 'lazy'], ['define', fixture.first, ref(firstChild), 'lazy'],
            ['define', secondChild, second[2], 'lazy'],
            ['define', fixture.second, ['block', yielded(['if', true, yielded(ref(secondChild)), yielded(ref(secondChild))], [before])], 'lazy'],
            fixture.source.statements[4],
        ] }
        const { original, lowered, body } = lowering(source, fixture.parameters, fixture.self)
        const statements = statementsOf(body)
        for (const prefix of /** @type {const} */ ([before, fixture.firstPrefix, fixture.secondPrefix])) {
            assertEq(statements.filter(statement => statement === prefix).length, 1)
        }
        assert(statements.indexOf(before) < statements.indexOf(fixture.secondPrefix))
        assert(!statements.some(statement => statement[0] === 'define' && [firstChild, secondChild].includes(statement[1])))
        for (const choice of /** @type {const} */ ([0, 1, 2])) {
            assertStructurallySame(evaluate(['()', lowered, [3, choice, null]]), evaluate(['()', original, [3, choice, null]]))
        }
    },
    multiRecipeSelectionKeepsUnselectedTerminalOwners: () => {
        const fixture = independent()
        const nested = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        /** @type {Block} */
        const terminal = { statements: [], exit: ['loop', { target: nested, parameters: [], initial: [], results: [],
            body: { statements: [], exit: ['continue', nested, []] } }] }
        /** @type {Block} */
        const thrown = { statements: [], exit: ['throw', 'selected base'] }
        for (const ending of /** @type {const} */ ([terminal, thrown])) {
            // The inner decision uses the same recipes without redeclaring them.
            const original = yielded(['if', ['>', ref(fixture.parameters[0]), 0],
                { ...fixture.source, statements: [] }, ending], fixture.source.statements)
            const body = _tailCalls(original, fixture.parameters, fixture.self, target)
            assert(body !== null)
            assert(exitsOf(body).includes(ending.exit))
            assertEq(statementsOf(body).filter(statement => statement === fixture.firstPrefix).length, 1)
        }
    },
    semantic,
    extraArgumentsMaterializeBeforeSimultaneousParameterUpdates: () => {
        const self = /** @type {BindingId} */ ({ index: 1 })
        const first = /** @type {BindingId} */ ({ index: 2 })
        const second = /** @type {BindingId} */ ({ index: 3 })
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const args = /** @type {const} */ ([['ref', second], ['ref', first], ['+', ['ref', first], ['ref', second]]])
        const normalized = _tailCalls({ statements: [], exit: ['yield', [['()', ['ref', self], args]]] }, [first, second], self, target)
        assert(normalized !== null)
        assertEq(normalized.statements.length, 1)
        const definition = normalized.statements[0]
        assert(definition[0] === 'define')
        assertEq(definition[3], 'required')
        assertStructurallySame(definition[2], ['array', args])
        assert(definition[2] instanceof Array && definition[2][0] === 'array')
        assertEq(definition[2][1], args)
        assertStructurallySame(normalized.exit, ['continue', target, [['.', ['ref', definition[1]], 0], ['.', ['ref', definition[1]], 1]]])
        assert(definition[1] !== first && definition[1] !== second && definition[1] !== self)
    },
    spreadArgumentsMaterializeBeforeReadingTheirExpandedPrefix: () => {
        const self = /** @type {BindingId} */ ({ index: 0 })
        const first = /** @type {BindingId} */ ({ index: 1 })
        const second = /** @type {BindingId} */ ({ index: 2 })
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const args = /** @type {const} */ ([['...', ['array', [['ref', second], ['ref', first]]]]])
        const normalized = _tailCalls({ statements: [], exit: ['yield', [['()', ['ref', self], args]]] }, [first, second], self, target)
        assert(normalized !== null)
        assertEq(normalized.statements.length, 1)
        const definition = normalized.statements[0]
        assert(definition[0] === 'define')
        assertEq(definition[3], 'required')
        assertStructurallySame(definition[2], ['array', args])
        assertStructurallySame(normalized.exit, ['continue', target, [['.', ['ref', definition[1]], 0], ['.', ['ref', definition[1]], 1]]])
    },
    nestedFinalSequencesRetainTheirTailEvaluation: () => {
        const graph = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', ['arg', 0], 0],
            [',', [['[]', [1]], [',', [['{}', []], ['()', ['self'], [['-', ['arg', 0], 1]]]]]]], 'done']])
        assertEq(_tailFunction(graph).body.statements[0][0], 'loop')
        assertEq(evaluate(['()', fromFast(assertOk(toFast(graph))), [3]]), 'done')
    },
    deepTerminalRegions: () => {
        const self = /** @type {BindingId} */ ({ index: 0 })
        const parameter = /** @type {BindingId} */ ({ index: 1 })
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        /** @type {Block} */
        let source = { statements: [], exit: ['yield', [['()', ['ref', self], [['ref', parameter]]]]] }
        const count = /** @type {const} */ (20_000)
        for (let depth = 0; depth < count; depth += 1) {
            source = { statements: [], exit: ['yield', [['if', true, source, { statements: [], exit: ['yield', [depth]] }]]] }
        }
        let converted = _tailCalls(source, [parameter], self, target)
        assert(converted !== null)
        for (let depth = 0; depth < count; depth += 1) {
            assert(converted.statements[0][0] === 'if')
            converted = converted.statements[0][3]
        }
        assertEq(converted.exit[0], 'continue')
        assertEq(converted.exit[1], target)
    },
})
