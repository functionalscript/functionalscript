/**
 * Invariant-state graph normalization retains eager work and established
 * identities, including source reads that disappeared during alias pruning.
 *
 * @import { BindingId, Block, Loop, Value } from '../../js/ast/types.ts'
 */

import { assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { fromFast } from './module.f.mjs'
import { evaluate, failure } from './member_returns/proof.f.mjs'
import { parse } from '../../compiler/transpiler/module.f.mjs'
import { _defaultExport, unresolved } from '../../compiler/edag/module.f.mjs'

/** @type {() => BindingId} */
const id = () => ({ index: 0 })
/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]

const entry = id(), stable = id(), count = id(), saved = id(), output = id(), failed = id()
const target = /** @type {const} */ ({ kind: 'loop', index: 0 })

/** @type {(condition?: Value, statements?: Block['statements']) => Loop} */
const loop = (condition = ['<', ref(count), ref(stable)], statements = []) => ({
    target, parameters: [stable, count], initial: [ref(entry), 0], results: [saved, output],
    body: { statements: [['if', [], condition,
        { statements, exit: ['continue', target, [ref(stable), ['+', ref(count), 1]]] },
        { statements: [], exit: ['break', target, [ref(stable), ref(count)]] },
    ]], exit: ['yield', []] },
})

/** @type {(state: Loop, result: Value, initializer?: Value) => Block} */
const run = (state, result, initializer = 3) => ({
    statements: [['define', entry, initializer, 'required'], ['loop', state]], exit: ['yield', [result]],
})

export const proof = /** @type {const} */ ({
    recoversTheOldScalarGraph: () => {
        const state = loop()
        const scalar = /** @type {Loop} */ ({
            target, parameters: [count], initial: [0], results: [output],
            body: { statements: [['if', [], ['<', ref(count), ref(entry)],
                { statements: [], exit: ['continue', target, [['+', ref(count), 1]]] },
                { statements: [], exit: ['break', target, [ref(count)]] },
            ]], exit: ['yield', []] },
        })
        const initial = /** @type {const} */ (['+', 2, 1])
        assertStructurallySame(fromFast(run(state, ref(output), initial)), fromFast(run(scalar, ref(output), initial)))
        assertEq(evaluate(fromFast(run(state, ref(output)))), 3)
    },
    preservesRequiredEntryAndStepWork: () => {
        const skipped = loop(false)
        failure(fromFast(run(skipped, ref(output), ['.', null, 'x'])))
        const state = loop(['<', ref(count), 1], [['define', failed, ['.', null, 'x'], 'required']])
        // The invariant result aliases entry directly. Consuming that alias
        // must still execute the loop and its earlier required failing step.
        failure(fromFast(run(state, ref(saved))))
        const deferred = /** @type {Block} */ ({
            statements: [['define', entry, ['.', null, 'x'], 'lazy'], ['loop', skipped]], exit: ['yield', [ref(output)]],
        })
        failure(fromFast(deferred))
        for (const source of /** @type {const} */ ([
            'export default (()=>{let limit=null.x;limit=limit;let i=0;while(i<0){const unused=limit;i=i+1;}return i;})();',
            'export default (()=>{let limit=3;limit=limit;let i=0;while(i<limit){const failed=null.x;i=i+1;}return limit;})();',
        ])) {
            const parsed = assertOk(parse('')(source))
            failure(_defaultExport(unresolved(parsed).edag))
        }
    },
    preservesEstablishedIdentityOnSkippedAndReachedLoops: () => {
        const same = /** @type {Value} */ (['===', ref(saved), ref(entry)])
        assertEq(evaluate(fromFast(run(loop(false), same, ['array', []]))), true)
        assertEq(evaluate(fromFast(run(loop(['<', ref(count), 3]), same, ['array', []]))), true)
        assertEq(evaluate(fromFast(run(loop(false), ref(saved)))), 3)
        const sharedInitial = /** @type {Loop} */ ({ ...loop(false), initial: [ref(entry), ref(entry)] })
        assertEq(evaluate(fromFast(run(sharedInitial, ['===', ref(saved), ref(output)], ['array', []]))), true)
    },
})
