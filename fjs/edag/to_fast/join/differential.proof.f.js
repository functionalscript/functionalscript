/**
 * A block that evaluates successfully before `_joinResults` evaluates to the
 * same value after it, over blocks generated from a seed.
 *
 * The pass decides where a deferred recipe may be required. A rule that
 * requires one on a path that never read it turns a program that completes
 * into one that fails, so every generated block holds one recipe that fails
 * when evaluated, `cell`, and reads of it wherever a value can stand.
 * Evaluated with the parameter `false` and `true`, a block that completes
 * says which paths never met the recipe; the placed block has to complete
 * on the same ones, with the same value.
 *
 * What is generated is what the placement rules tell apart: selections on
 * the parameter and on computed tests, operands an optional step can skip,
 * blocks and captures, a binding declared anew, statements one arm of which
 * returns or fails, and loops with `break` and `continue`.
 *
 * A `return` inside a value is left out: `fromFast` refuses a nonlocal
 * transfer in a value region by throwing, and a proof cannot catch. The
 * single cases in [`proof.f.js`](./proof.f.js) hold that shape.
 *
 * @import { BindingId, Block, Function as FastFunction, FunctionTarget, LoopTarget, Statement, Value } from '../../../js/ast/types.ts'
 */

import { assertStructurallySame } from '../../../asserts/module.f.js'
import { _joinResults } from './module.f.js'
import { identityAnalysis } from '../../analysis/module.f.js'
import { fromFast } from '../../from_fast/module.f.js'
import { memo } from '../../memo/module.f.js'
import { toData } from '../../value/to_unknown/module.f.js'
import { generate } from '../../../types/array/module.f.js'

/** The bindings a generated block shares, new for each block. */
const bindings = () => ({
    condition: /** @type {BindingId} */ ({ index: 0 }),
    cell: /** @type {BindingId} */ ({ index: 1 }),
    empty: /** @type {BindingId} */ ({ index: 2 }),
    identity: /** @type {BindingId} */ ({ index: 3 }),
    nothing: /** @type {BindingId} */ ({ index: 4 }),
    other: /** @type {BindingId} */ ({ index: 5 }),
    owner: /** @type {FunctionTarget} */ ({ kind: 'function', index: 0 }),
})

/** A Lehmer step: the products stay below 2 ** 53. @type {(seed: number) => number} */
const next = seed => seed * 48_271 % 0x7fff_ffff

/** The seed of the `k`-th part of what a seed generates. @type {(seed: number, k: number) => number} */
const part = (seed, k) => next(next(seed + k * 7_919) + 1)

/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]

/** @type {(value: Value, statements?: readonly Statement[]) => Block} */
const result = (value, statements = []) => ({ statements, exit: ['yield', [value]] })

/** @type {(exit: Block['exit'], statements?: readonly Statement[]) => Block} */
const ending = (exit, statements = []) => ({ statements, exit })

/** @type {(seed: number) => BindingId} */
const fresh = seed => ({ index: 100 + seed })

/** A read of the recipe the parameter skips where it holds. @type {(names: ReturnType<typeof bindings>) => Value} */
const guarded = ({ condition, cell }) => ['if', ref(condition), result(0), result(ref(cell))]

/** @type {(names: ReturnType<typeof bindings>, seed: number) => Value} */
const leaf = (names, seed) => [
    guarded(names), guarded(names), guarded(names), ref(names.cell),
    ref(names.condition), 0, ref(names.empty), ref(names.nothing),
][Number(seed % 8)]

/**
 * A loop that goes round once or twice, may leave early on a computed test,
 * and yields a generated value.
 *
 * @type {(value: (seed: number, depth: number) => Value) => (seed: number, yielded: BindingId) => Statement}
 */
const loop = value => (seed, yielded) => {
    const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 10 + seed })
    const step = fresh(part(seed, 1))
    /** @type {Value} */
    const increment = ['+', ref(step), 1]
    /** @type {Statement} */
    const round = ['if', [], ['<', ref(step), 1 + seed % 2],
        ending(['continue', target, [part(seed, 2) % 2 === 0 ? increment : [',', [value(part(seed, 3), 1), increment]]]]), ending(['yield', []])]
    /** @type {readonly Statement[]} */
    const early = part(seed, 4) % 2 === 0 ? []
        : [['if', [], value(part(seed, 5), 1), ending(['break', target, [value(part(seed, 6), 1)]]), ending(['yield', []])]]
    /** @type {readonly Statement[]} */
    const first = part(seed, 7) % 2 === 0 ? [['define', fresh(part(seed, 8)), value(part(seed, 9), 1), 'required']] : []
    return ['loop', { target, parameters: [step], initial: [0], results: [yielded],
        body: ending(['break', target, [value(part(seed, 10), 2)]], [...first, round, ...early]) }]
}

/** @type {(names: ReturnType<typeof bindings>) => (seed: number, depth: number) => Value} */
const valueOf = names => {
    const { condition, cell, empty, identity, nothing } = names
    /** @type {(seed: number, depth: number) => Value} */
    const value = (seed, depth) => {
        if (depth <= 0) { return leaf(names, seed) }
        /** @type {(k: number) => Value} */
        const sub = k => value(part(seed, k), depth - 1)
        switch (seed % 23) {
            case 0: { return ['array', [sub(1), sub(2)]] }
            case 1: { return ['array', [['...', ['array', [sub(1)]]], sub(2)]] }
            case 2: { return ['object', [[':', 'a', sub(1)], [':', 'b', sub(2)]]] }
            case 3: { return ['if', ref(condition), result(sub(1)), result(sub(2))] }
            case 4: { return ['if', sub(1), result(sub(2)), result(sub(3))] }
            case 5: { return ['?:', ref(condition), sub(1), sub(2)] }
            case 6: { return ['.', ['object', [[':', 'a', sub(1)]]], 'a'] }
            case 7: { return ['.', ref(empty), 'm', ['|?.()', [sub(1)]]] }
            case 8: { return ['?.', ref(nothing), 'a', ['|()', [sub(1)]]] }
            case 9: { return ['?.()', ref(nothing), [sub(1)]] }
            case 10: { return ['?.()', ref(identity), [sub(1)]] }
            case 11: { return ['()', ref(identity), [sub(1)]] }
            case 12: { return ['.', ['object', [[':', 'f', ref(identity)]]], 'f', ['|()', [sub(1)]]] }
            case 13: { return [',', [sub(1), sub(2)]] }
            case 14: { return ['===', sub(1), sub(2)] }
            case 15: { return ['!', sub(1)] }
            case 16: { return ['block', result(sub(1), [['define', fresh(part(seed, 3)), sub(2), 'required']])] }
            case 17: { return ['block', result(sub(1), [['define', cell, 7, 'required']])] }
            case 18: {
                const yielded = fresh(part(seed, 3))
                return ['block', result(seed % 2 === 0 ? ref(yielded) : sub(1), [loop(value)(part(seed, 2), yielded)])]
            }
            case 19: { return ['if', sub(1), ending(['throw', 'refused']), result(sub(2))] }
            case 20: {
                const target = /** @type {FunctionTarget} */ ({ kind: 'function', index: 2 })
                return ['()', ['function', { target, parameters: [], rest: null, self: null,
                    captures: [{ binding: fresh(part(seed, 2)), value: sub(1) }], body: ending(['return', target, 5]) }], []]
            }
            default: { return leaf(names, part(seed, 1)) }
        }
    }
    return value
}

/** @type {(names: ReturnType<typeof bindings>, seed: number) => Statement} */
const statement = (names, seed) => {
    const { condition, cell, nothing, other, owner } = names
    const value = valueOf(names)
    const leaving = ending(['return', owner, 6])
    /** @type {(test: Value, going: Block, first: boolean) => Statement} */
    const oneLeaves = (test, going, first) => first ? ['if', [], test, leaving, going] : ['if', [], test, going, leaving]
    switch (seed % 11) {
        case 0: { return ['define', fresh(part(seed, 1)), value(part(seed, 2), 2), 'required'] }
        case 1: { return ['define', other, value(part(seed, 2), 2), 'lazy'] }
        case 2: { return ['if', [], value(part(seed, 1), 1), ending(['yield', []], [['define', fresh(part(seed, 2)), value(part(seed, 3), 2), 'required']]), ending(['yield', []])] }
        case 3: { return ['if', [], ref(condition), leaving, ending(['yield', []])] }
        case 4: { return oneLeaves(value(part(seed, 1), 1), ending(['yield', []], [['define', fresh(part(seed, 2)), value(part(seed, 3), 2), 'required']]), part(seed, 4) % 2 === 0) }
        case 5: {
            const going = ending(['yield', []], [['define', fresh(part(seed, 2)), part(seed, 3) % 2 === 0 ? ref(cell) : guarded(names), 'required']])
            // the arm that goes on is taken where the parameter holds, or always
            return part(seed, 4) % 2 === 0 ? oneLeaves(ref(condition), going, false) : oneLeaves(ref(nothing), going, true)
        }
        case 6: { return ['define', cell, 3, 'required'] }
        case 7: { return ['if', [], value(part(seed, 1), 1), ending(['throw', 'refused']), ending(['yield', []])] }
        default: { return loop(value)(part(seed, 1), fresh(part(seed, 2))) }
    }
}

/** A block, with the bindings it reads declared before it and its recipe deferred. @type {(seed: number) => readonly [ReturnType<typeof bindings>, Block]} */
const block = seed => {
    const shared = bindings()
    const { cell, empty, identity, nothing } = shared
    const parameter = /** @type {BindingId} */ ({ index: 6 })
    const target = /** @type {FunctionTarget} */ ({ kind: 'function', index: 1 })
    /** @type {readonly Statement[]} */
    const prefix = [
        ['define', empty, ['object', []], 'required'],
        ['define', identity, ['function', { target, parameters: [parameter], rest: null, self: null, captures: [], body: ending(['return', target, ref(parameter)]) }], 'required'],
        ['define', nothing, null, 'required'],
        ['define', cell, ['block', ending(['throw', 'cell'])], 'lazy'],
    ]
    const more = generate(seed % 6, k => statement(shared, part(seed, k + 1)))
    return [shared, result(valueOf(shared)(part(seed, 7), 3), [...prefix, ...more])]
}

/**
 * What the block answers as the body of a function called with `argument`:
 * its value as data, or `null` where it fails or answers what is no data.
 *
 * @type {(names: ReturnType<typeof bindings>, block: Block, argument: boolean) => readonly [unknown] | null}
 */
const answer = ({ condition, owner }, { statements, exit }, argument) => {
    const fn = /** @type {FastFunction} */ ({ target: owner, parameters: [condition], rest: null, self: null, captures: [],
        body: { statements, exit: ['return', owner, exit[0] === 'yield' ? exit[1][0] : undefined] } })
    const analysis = identityAnalysis(['()', fromFast(result(['function', fn])), [argument]])
    if (analysis[0] !== 'ok') { return null }
    const value = memo(analysis[1])({ args: [] })
    if (value[0] !== 'ok') { return null }
    const data = toData(value[1])
    return data[0] === 'ok' ? [data[1]] : null
}

/** How many blocks completed before the pass, each compared after it. @type {(first: number, count: number) => number} */
const compared = (first, count) => generate(count, k => first + k).reduce((/** @type {number} */ completed, seed) => {
    const [shared, before] = block(seed)
    const after = _joinResults(before)
    return [false, true].reduce((total, argument) => {
        const expected = answer(shared, before, argument)
        if (expected === null) { return total }
        assertStructurallySame(answer(shared, after, argument), expected)
        return total + 1
    }, completed)
}, 0)

// Forty blocks a part take about a second each. Removing any one of five
// conditions from the pass makes a part fail: a loop's body as no first
// demand, operands an optional step skips, a binding declared anew, a
// `return` as a way to end unread, and what the arm that goes on must hold.
export const proof = {
    part0: () => { compared(1, 40) },
    part1: () => { compared(41, 40) },
    part2: () => { compared(81, 40) },
    part3: () => { compared(121, 40) },
}
