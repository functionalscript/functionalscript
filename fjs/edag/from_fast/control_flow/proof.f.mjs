/**
 * The shared control-flow functions are what their names say, and the
 * builders spell FAST as the proofs that use them read it.
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { _controlFlowFunctions, block, func, functionTarget, id, ref } from './module.f.js'

export const proof = /** @type {const} */ ({
    // Equal indices, distinct identities: FAST tells bindings and targets
    // apart by identity, so each call is a new one.
    identities: () => {
        assertStructurallySame(id(), { index: 0 })
        assert(id() !== id())
        assertStructurallySame(functionTarget(), { kind: 'function', index: 0 })
        assert(functionTarget() !== functionTarget())
    },
    builders: () => {
        const binding = id()
        const target = functionTarget()
        assertStructurallySame(ref(binding), ['ref', binding])
        // a block with no statements unless given some
        assertStructurallySame(block(['yield', []]), { statements: [], exit: ['yield', []] })
        const body = block(['return', target, 1], [['define', binding, 2, 'required']])
        assertEq(body.statements.length, 1)
        // a function with no captures unless given some
        assertStructurallySame(func(target, [binding], body), ['function', { target, parameters: [binding], rest: null, self: null, captures: [], body }])
        const captures = /** @type {const} */ ([{ binding, value: 3 }])
        assertStructurallySame(func(target, [], body, captures), ['function', { target, parameters: [], rest: null, self: null, captures, body }])
    },
    // The three functions by their parameters: the nested example takes a
    // selector, an incoming value, a factory and a continuation; both
    // encodings of the parameterized join take a selector, a stop and an
    // operation, and only the helper encoding defines its continuation.
    functions: () => {
        const { nested, parameterizedJoin, parameterizedHelper } = _controlFlowFunctions
        assertEq(nested.parameters.length, 4)
        assertEq(parameterizedJoin.parameters.length, 3)
        assertEq(parameterizedHelper.parameters.length, 3)
        assertEq(parameterizedJoin.body.statements[0][0], 'if')
        assertEq(parameterizedHelper.body.statements[0][0], 'define')
    },
})
