/**
 * The control-flow functions the conformance proofs and the native harness
 * share, as normalized FAST, with the builders that spell them: one table, so
 * that JavaScript and Rust execute the same inputs.
 *
 * Read by proofs and by the harness generator
 * ([`nanvm/fast/immutable_joins`](../../../nanvm/fast/immutable_joins/module.f.js)),
 * which the `_` of {@link _controlFlowFunctions} says.
 *
 * @module
 * @import { BindingId, Block, Capture, Function as FastFunction, FunctionTarget, Statement, Value } from '../../../js/ast/types.ts'
 */

/** Equal presentation indices deliberately retain distinct identities. @type {() => BindingId} */
export const id = () => ({ index: 0 })
/** @type {() => FunctionTarget} */
export const functionTarget = () => ({ kind: 'function', index: 0 })
/** @type {(binding: BindingId) => Value} */
export const ref = binding => ['ref', binding]
/** @type {(exit: Block['exit'], statements?: readonly Statement[]) => Block} */
export const block = (exit, statements = []) => ({ statements, exit })
/** @type {(target: FunctionTarget, parameters: readonly BindingId[], body: Block, captures?: readonly Capture[]) => Value} */
export const func = (target, parameters, body, captures = []) => ['function', { target, parameters, rest: null, self: null, captures, body }]

/** The task owner's nested m example keeps its normal continuation outside the branch. @type {() => FastFunction} */
const nestedMutable = () => {
    const target = functionTarget()
    const selected = id()
    const incoming = id()
    const factory = id()
    const following = id()
    const local = id()
    const updated = id()
    const joined = id()
    return { target, parameters: [selected, incoming, factory, following], rest: null, self: null, captures: [],
        body: block(['return', target, ['()', ref(following), [ref(joined)]]], [
            ['if', [joined], ref(selected), block(['yield', [ref(updated)]], [
                ['define', local, ['()', ref(factory), []], 'required'],
                ['define', updated, ['.', ref(local), 'a'], 'required'],
                ['if', [], ['.', ref(local), 'b'], block(['return', target, ['.', ref(local), 'c']]), block(['yield', []])],
            ]), block(['yield', [ref(incoming)]])],
        ]),
    }
}

/** K(z) is reached with different immutable values; a helper is another valid encoding. @type {(helper: boolean) => FastFunction} */
const parameterized = helper => {
    const target = functionTarget()
    const selected = id()
    const stop = id()
    const operation = id()
    const joined = id()
    const continuation = id()
    const input = id()
    const capture = id()
    const continuationTarget = functionTarget()
    const continuationValue = func(continuationTarget, [input], block(['return', continuationTarget, ['()', ref(capture), [['+', ref(input), 5]]]]), [
        { binding: capture, value: ref(operation) },
    ])
    /** @type {Statement} */
    const stopped = ['if', [], ref(stop), block(['return', target, 42]), block(['yield', []])]
    return { target, parameters: [selected, stop, operation], rest: null, self: null, captures: [],
        body: helper
            ? block(['return', target, ['()', ref(continuation), [0]]], [
                ['define', continuation, continuationValue, 'required'],
                ['if', [], ref(selected), block(['return', target, ['()', ref(continuation), [3]]], [stopped]), block(['yield', []])],
            ])
            : block(['return', target, ['()', ref(operation), [['+', ref(joined), 5]]]], [
                ['if', [joined], ref(selected), block(['yield', [3]], [stopped]), block(['yield', [0]])],
            ]),
    }
}

/** The host conformance proof emits these same immutable normalized FAST functions. */
export const _controlFlowFunctions = /** @type {const} */ ({
    nested: nestedMutable(),
    parameterizedJoin: parameterized(false),
    parameterizedHelper: parameterized(true),
})
