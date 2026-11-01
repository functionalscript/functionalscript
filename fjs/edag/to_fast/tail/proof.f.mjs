/**
 * @import { Block, BindingId, LoopTarget, Statement, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { _tailCalls } from './module.f.mjs'
import { proof as semantic, _tailFunction } from '../tail_calls/proof.f.mjs'
import { toFast } from '../module.f.mjs'
import { fromFast } from '../../from_fast/module.f.mjs'
import { evaluate } from '../../from_fast/member_returns/proof.f.mjs'

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

export const proof = /** @type {const} */ ({
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
    independentInterleavedRecipesKeepTheirExistingLayout: () => {
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
        assertEq(_tailCalls(source, [parameter], self, target), null)
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
