/** Control-flow conformance from normalized FAST, independently of source admission.
 * @import { BindingId, Block, Capture, Function as FastFunction, FunctionTarget, Loop, LoopTarget, Statement, Value } from '../../js/ast/types.ts'
 * @import { ValueResult } from '../value/control/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { fromFast } from './module.f.mjs'
import { identityAnalysis } from '../analysis/module.f.mjs'
import { memo } from '../memo/module.f.mjs'
import { toData } from '../value/to_unknown/module.f.mjs'

/** Equal presentation indices deliberately retain distinct identities. @type {() => BindingId} */
const id = () => ({ index: 0 })
/** @type {() => FunctionTarget} */
const functionTarget = () => ({ kind: 'function', index: 0 })
/** @type {() => LoopTarget} */
const loopTarget = () => ({ kind: 'loop', index: 0 })
/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]
/** @type {(exit: Block['exit'], statements?: readonly Statement[]) => Block} */
const block = (exit, statements = []) => ({ statements, exit })
/** @type {(target: FunctionTarget, parameters: readonly BindingId[], body: Block, captures?: readonly Capture[]) => Value} */
const func = (target, parameters, body, captures = []) => ['function', { target, parameters, rest: null, self: null, captures, body }]
/** @type {(fn: FastFunction, args?: readonly Value[]) => ValueResult} */
const called = (fn, args = []) => memo(assertOk(identityAnalysis(fromFast(block(['yield', [['()', ['function', fn], args]]])))))({ args: [] })
/** @type {(fn: FastFunction, args?: readonly Value[]) => unknown} */
const evaluated = (fn, args = []) => assertOk(toData(assertOk(called(fn, args))))
/** @type {(value: unknown, item: unknown) => void} */
const sharedPair = (value, item) => {
    assert(value instanceof Array)
    assertStructurallySame(value, [item, item])
    assertEq(value[0], value[1])
}

/** @type {(value: Value) => Value} */
const constant = value => {
    const target = functionTarget()
    return func(target, [], block(['return', target, value]))
}

/** One fresh allocation is returned through two object properties. @type {(stop: boolean) => Value} */
const objectFactory = stop => {
    const target = functionTarget(), allocation = id()
    return func(target, [], block(['return', target, ['object', [
        [':', 'a', ref(allocation)], [':', 'b', stop], [':', 'c', ref(allocation)],
    ]]], [['define', allocation, ['array', [41]], 'required']]))
}

/** @type {() => Value} */
const duplicateArgument = () => {
    const target = functionTarget(), value = id()
    return func(target, [value], block(['return', target, ['array', [ref(value), ref(value)]]]))
}

/** @type {() => Value} */
const allocatedPair = () => {
    const target = functionTarget(), value = id(), allocation = id()
    return func(target, [value], block(['return', target, ['array', [ref(allocation), ref(allocation)]]], [
        ['define', allocation, ['array', [ref(value)]], 'required'],
    ]))
}

/** @type {(tag: string) => Value} */
const tagged = tag => {
    const target = functionTarget(), value = id()
    return func(target, [value], block(['return', target, ['array', [tag, ref(value)]]]))
}

/** @type {() => Value} */
const failing = () => {
    const target = functionTarget()
    return func(target, [], block(['throw', 'failure']))
}

/** The task owner's nested m example keeps its normal continuation outside the branch. @type {() => FastFunction} */
const nestedMutable = () => {
    const target = functionTarget(), selected = id(), incoming = id(), factory = id(), following = id(), local = id(), updated = id(), joined = id()
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
    const target = functionTarget(), selected = id(), stop = id(), operation = id(), joined = id(), continuation = id(), input = id(), capture = id()
    const continuationTarget = functionTarget()
    const continuationValue = func(continuationTarget, [input], block(['return', continuationTarget, ['()', ref(capture), [['+', ref(input), 5]]]]), [
        { binding: capture, value: ref(operation) },
    ])
    const stopped = /** @type {Statement} */ (['if', [], ref(stop), block(['return', target, 42]), block(['yield', []])])
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
export const controlFlowFunctions = /** @type {const} */ ({
    nested: nestedMutable(),
    parameterizedJoin: parameterized(false),
    parameterizedHelper: parameterized(true),
})

/** Two normal results carry the values at break, including the preceding increment. @type {() => FastFunction} */
const multiState = () => {
    const target = functionTarget(), loop = loopTarget(), left = id(), right = id(), first = id(), second = id()
    return { target, parameters: [], rest: null, self: null, captures: [],
        body: block(['return', target, ['array', [ref(second), ref(first)]]], [
            ['loop', { target: loop, parameters: [left, right], initial: [0, 1], results: [first, second],
                body: block(['continue', loop, [['+', ref(left), ref(right)], ['+', ref(right), 1]]], [
                    ['if', [], ['===', ref(right), 4], block(['break', loop, [ref(left), ['+', ref(right), 1]]]), block(['yield', []])],
                    ['if', [], ['===', ref(left), 0], block(['continue', loop, [['+', ref(left), 2], ref(right)]]), block(['yield', []])],
                ]),
            }],
        ]),
    }
}

/** @type {() => FastFunction} */
const snapshots = () => {
    const target = functionTarget(), loop = loopTarget(), limit = id(), round = id(), left = id(), right = id(), held = id(), created = id(), captured = id()
    const first = id(), second = id(), saved = id(), closureTarget = functionTarget()
    const closure = func(closureTarget, [], block(['return', closureTarget, ref(captured)]), [{ binding: captured, value: ref(left) }])
    return { target, parameters: [limit], rest: null, self: null, captures: [],
        body: block(['return', target, ['array', [ref(first), ref(second), ['()', ref(saved), []]]]], [
            ['loop', { target: loop, parameters: [round, left, right, held], initial: [0, 1, 2, constant(-1)], results: [first, second, saved],
                body: block(['yield', []], [
                    ['if', [], ['<', ref(round), ref(limit)],
                        block(['continue', loop, [['+', ref(round), 1], ref(right), ['+', ref(left), ref(right)], ref(created)]], [
                            ['define', created, closure, 'required'],
                        ]), block(['break', loop, [ref(left), ref(right), ref(held)]])],
                ]),
            }],
        ]),
    }
}

/** The loop return leaves the containing function, not its generated helper. @type {() => FastFunction} */
const returningLoop = () => {
    const target = functionTarget(), loop = loopTarget(), limit = id(), normal = id(), early = id(), state = id(), first = id(), second = id(), result = id()
    return { target, parameters: [limit, normal, early], rest: null, self: null, captures: [],
        body: block(['return', target, ['()', ref(normal), [ref(result)]]], [
            ['loop', { target: loop, parameters: [state], initial: [0], results: [result],
                body: block(['continue', loop, [['+', ref(second), 1]]], [
                    ['define', first, ['+', ref(state), 1], 'required'],
                    ['if', [], ['>=', ref(first), ref(limit)], block(['break', loop, [ref(first)]]), block(['yield', []])],
                    ['define', second, ['+', ref(first), 1], 'required'],
                    ['if', [], ['>=', ref(second), ref(limit)], block(['return', target, ['()', ref(early), [ref(second)]]]), block(['yield', []])],
                ]),
            }],
        ]),
    }
}

/** Dispatch is complete before case execution follows its fall-through edge. @type {() => FastFunction} */
const fallingSwitch = () => {
    const target = functionTarget(), region = loopTarget(), tag = id(), failLabel = id(), selected = id(), first = id(), result = id(), inner = id()
    const laterLabel = /** @type {Value} */ (['if', ref(failLabel), block(['throw', 'unreached label']), block(['yield', [1]])])
    return { target, parameters: [tag, failLabel], rest: null, self: null, captures: [],
        body: block(['return', target, ref(result)], [
            ['loop', { target: region, parameters: [], initial: [], results: [result], body: block(['break', region, [9]], [
                ['if', [selected], ['===', ref(tag), 0], block(['yield', [0]]), block(['yield', [ref(inner)]], [
                    ['if', [inner], ['===', ref(tag), laterLabel], block(['yield', [1]]), block(['yield', [2]])],
                ])],
                ['if', [first], ['===', ref(selected), 0], block(['yield', [1]]), block(['yield', [0]])],
                ['if', [], ['<=', ref(selected), 1], block(['break', region, [['+', ref(first), 2]]]), block(['yield', []])],
            ]) }],
        ]),
    }
}

/** A switch-local break resumes the iteration; continue skips its remaining work. @type {() => FastFunction} */
const switchInLoop = () => {
    const target = functionTarget(), outer = loopTarget(), region = loopTarget(), count = id(), total = id(), next = id(), contribution = id(), rounds = id(), result = id()
    const selected = /** @type {Loop} */ ({ target: region, parameters: [], initial: [], results: [contribution],
        body: block(['break', region, [ref(next)]], [
            ['if', [], ['===', ref(next), 2], block(['continue', outer, [ref(next), ref(total)]]), block(['yield', []])],
            ['if', [], ['===', ref(next), 4], block(['break', region, [40]]), block(['yield', []])],
        ]),
    })
    return { target, parameters: [], rest: null, self: null, captures: [],
        body: block(['return', target, ['array', [ref(rounds), ref(result)]]], [
            ['loop', { target: outer, parameters: [count, total], initial: [0, 0], results: [rounds, result],
                body: block(['continue', outer, [ref(next), ['+', ref(total), ref(contribution)]]], [
                    ['if', [], ['>=', ref(count), 5], block(['break', outer, [ref(count), ref(total)]]), block(['yield', []])],
                    ['define', next, ['+', ref(count), 1], 'required'], ['loop', selected],
                ]),
            }],
        ]),
    }
}

/** The false test completes the loop without entering its body. @type {() => FastFunction} */
const conditionalLoop = () => {
    const target = functionTarget(), loop = loopTarget(), limit = id(), failBody = id(), state = id(), result = id(), unused = id()
    return { target, parameters: [limit, failBody], rest: null, self: null, captures: [],
        body: block(['return', target, ref(result)], [
            ['loop', { target: loop, parameters: [state], initial: [0], results: [result], body: block(['yield', []], [
                ['if', [], ['<', ref(state), ref(limit)], block(['continue', loop, [['+', ref(state), 1]]], [
                    ['define', unused, ['if', ref(failBody), block(['throw', 'reached body']), block(['yield', [undefined]])], 'required'],
                ]), block(['break', loop, [ref(state)]])],
            ]) }],
        ]),
    }
}

export const proof = /** @type {const} */ ({
    nestedMutableJoinAndOwningReturn: () => {
        const fn = controlFlowFunctions.nested, incoming = /** @type {Value} */ (['array', [5]])
        sharedPair(evaluated(fn, [false, incoming, failing(), duplicateArgument()]), [5])
        sharedPair(evaluated(fn, [true, incoming, objectFactory(false), duplicateArgument()]), [41])
        assertStructurallySame(evaluated(fn, [true, incoming, objectFactory(true), failing()]), [41])
        assertError(called(fn, [true, incoming, failing(), duplicateArgument()]))
        assertError(called(fn, [true, incoming, objectFactory(false), failing()]))
    },
    establishedCallResultKeepsAllocationSharing: () => {
        const target = functionTarget(), factory = id(), local = id()
        const fn = /** @type {FastFunction} */ ({ target, parameters: [factory], rest: null, self: null, captures: [],
            body: block(['return', target, ['array', [['.', ref(local), 'a'], ['.', ref(local), 'c']]]], [
                ['define', local, ['()', ref(factory), []], 'required'],
            ]),
        })
        sharedPair(evaluated(fn, [objectFactory(false)]), [41])
    },
    parameterizedContinuationsAgreeAcrossEncodings: () => {
        for (const fn of [controlFlowFunctions.parameterizedJoin, controlFlowFunctions.parameterizedHelper]) {
            sharedPair(evaluated(fn, [false, false, allocatedPair()]), [5])
            sharedPair(evaluated(fn, [false, true, allocatedPair()]), [5])
            sharedPair(evaluated(fn, [true, false, allocatedPair()]), [8])
            assertEq(evaluated(fn, [true, true, failing()]), 42)
            assertError(called(fn, [false, false, failing()]))
            assertError(called(fn, [true, false, failing()]))
        }
    },
    multiStateBreakAndContinueUseCurrentVersions: () => {
        assertStructurallySame(evaluated(multiState()), [5, 8])
    },
    loopTransfersKeepCreatingIterationSnapshots: () => {
        const fn = snapshots()
        assertStructurallySame(evaluated(fn, [0]), [1, 2, -1])
        assertStructurallySame(evaluated(fn, [3]), [5, 8, 3])
    },
    loopReturnSkipsNormalContinuation: () => {
        const fn = returningLoop()
        for (const limit of [1, 4]) {
            assertStructurallySame(evaluated(fn, [limit, tagged('normal'), failing()]), ['normal', limit])
        }
        for (const limit of [2, 5]) {
            assertStructurallySame(evaluated(fn, [limit, failing(), tagged('early')]), ['early', limit])
        }
        assertError(called(fn, [1, failing(), tagged('early')]))
        assertError(called(fn, [2, tagged('normal'), failing()]))
    },
    switchFallsThroughWithoutRetestingLabels: () => {
        const fn = fallingSwitch()
        assertEq(evaluated(fn, [0, true]), 3)
        assertEq(evaluated(fn, [1, false]), 2)
        assertEq(evaluated(fn, [2, false]), 9)
        assertError(called(fn, [1, true]))
    },
    switchBreakAndOuterContinueHaveDifferentOwners: () => {
        assertStructurallySame(evaluated(switchInLoop()), [5, 49])
    },
    conditionalLoopHasZeroAndRepeatedIterations: () => {
        const fn = conditionalLoop()
        assertEq(evaluated(fn, [0, true]), 0)
        for (const limit of [1, 4]) { assertEq(evaluated(fn, [limit, false]), limit) }
        assertError(called(fn, [1, true]))
    },
})
