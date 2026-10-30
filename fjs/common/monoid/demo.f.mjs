/**
 * The weighted fold, drawn as a merge tree: pick a sequence of `N` numbers,
 * counting up, counting down, shuffled, shuffled with signs, or a heavy
 * value before or after ones, and watch
 * `fold` add them one move at a time.
 *
 * **The monoid is addition, and a value weighs its magnitude.** A merged run
 * weighs the magnitude of its sum, as a concatenation weighs the lengths of
 * its operands, so the drawing shows the rule `fold` applies to one: a value
 * sits on the stack where the run two below it outweighs it, and otherwise
 * the two runs beneath it merge first. A heavy value is never merged on
 * arrival, and values of one weight carry like a binary counter. The signed
 * sequence, `1` to `N / 2` and their negations shuffled, sums to zero: a
 * merged run there can weigh less than either of its operands, and the fold
 * reads that weight afresh, so the terms above a light run merge in turn.
 *
 * **Each line is one state of the fold.** The runs are drawn in the columns
 * of the values they cover, so a run keeps its place as it grows:
 *
 * - underscores join the two runs about to merge, and the next line holds
 *   their sum;
 * - a line ending in `|` is a push complete, the value just pushed at the
 *   right of its stack;
 * - lines ending in `.` are the fold at the end, which merges the stack
 *   into one run;
 * - the last line is the sum.
 *
 * The lines are the moves of {@link move}, the fold's own transition, drawn
 * as they are made, so the page shows the algorithm rather than a picture of
 * it.
 *
 * **It needs no operations.** The shuffle orders the values by a hash of a
 * seed the state holds, so a shared link draws the same tree and the
 * `Shuffle` button advances the seed; `update` returns its next state
 * through `pureOk`.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 * @import { _DemoState, Monoid, Stack, Walk } from './types.ts'
 * @import { _Span } from './private.ts'
 */

import { pureOk } from '../../effects/module.f.mjs'
import { codeMarker, drawingMarker } from '../../website/style/module.f.js'
import { button, caption, option, selectField } from '../../website/demo/module.f.mjs'
import { withInputs } from '../../website/demo/sharing/module.f.mjs'
import { toArray } from '../../types/list/alt/module.f.mjs'
import { max } from '../../types/number/max/module.f.js'
import { move, runs } from './module.f.mjs'

const { abs, floor, imul } = Math

/** How many values every sequence holds, the `N` of the page. @type {number} */
export const n = 30

/** @type {Monoid<_Span>} */
const addition = {
    identity: { sum: 0, count: 0 },
    operation: a => b => ({ sum: a.sum + b.sum, count: a.count + b.count }),
    weight: span => abs(span.sum),
}

/** One move of a push. @type {(walk: Walk<_Span>) => Walk<_Span>} */
const push = move(addition)(false)

/** One move of the fold at the end. @type {(walk: Walk<_Span>) => Walk<_Span>} */
const collect = move(addition)(true)

/** `0` to `n - 1`. @type {readonly number[]} */
const indices = Array.from({ length: n }, (_, i) => i)

/**
 * A 32-bit hash that mixes every bit of `x` into every bit of the result
 * (Chris Wellons's `lowbias32`), so the keys of one seed order the values as
 * well as random ones would, and consecutive seeds order them unalike.
 *
 * @type {(x: number) => number}
 */
const mix = x => {
    const a = imul(x ^ (x >>> 16), 0x7feb_352d)
    const b = imul(a ^ (a >>> 15), 0x846c_a68b)
    return (b ^ (b >>> 16)) >>> 0
}

/** `1` to `n`. @type {readonly number[]} */
const counting = indices.map(i => i + 1)

/** `1` to `n / 2` and their negations, which sum to zero. @type {readonly number[]} */
const cancelling = indices.map(i => (i % (n / 2) + 1) * (i < n / 2 ? 1 : -1))

/**
 * The values in the order of their hashes with `seed`, a different order for
 * every seed.
 *
 * @type {(seed: number) => (values: readonly number[]) => readonly number[]}
 */
const shuffle = seed => values => values.toSorted((a, b) => mix(seed ^ a) - mix(seed ^ b))

/** Whether a kind's sequence is shuffled, so that the seed changes it. @type {(kind: string) => boolean} */
const shuffled = kind => kind === 'random' || kind === 'signed'

/**
 * The sequence a kind names: `1` to `n` counting up for `increasing`, down
 * for `decreasing` and shuffled with `seed` for `random`; `1` to `n / 2` and
 * their negations shuffled for `signed`; `n + 1` before or after `n - 1`
 * ones for `heavy-first` and `heavy-last`.
 *
 * @type {(kind: string, seed: number) => readonly number[]}
 */
export const sequence = (kind, seed) =>
    kind === 'decreasing' ? counting.toReversed()
    : kind === 'random' ? shuffle(seed)(counting)
    : kind === 'signed' ? shuffle(seed)(cancelling)
    : kind === 'heavy-first' ? indices.map(i => i === 0 ? n + 1 : 1)
    : kind === 'heavy-last' ? indices.map(i => i === n - 1 ? n + 1 : 1)
    : counting

/**
 * The runs of a walk in the order of the input: the stack bottom to top,
 * the value, then the pending runs nearest first.
 *
 * @type {(walk: Walk<_Span>) => readonly _Span[]}
 */
const row = ({ stack, value, pending }) => [...toArray(runs(stack)).toReversed(), value, ...toArray(runs(pending))]

/**
 * One line of the drawing: every run's sum centred over the columns of the
 * values it covers, `width` characters each, and the run at `merging` joined
 * to the next by underscores.
 *
 * @type {(width: number) => (spans: readonly _Span[], merging: number | null) => string}
 */
const line = width => (spans, merging) => spans.reduce(({ text, column }, { sum, count }, index) => {
    const digits = String(sum)
    const start = column + floor((count * width - digits.length) / 2)
    const gap = (merging !== null && index === merging + 1 ? '_' : ' ').repeat(start - text.length)
    return { text: `${text}${gap}${digits}`, column: column + count * width }
}, { text: '', column: 0 }).text.trimEnd()

/**
 * The merge tree of adding `input` with the fold, line by line, in the
 * notation the module doc describes; empty for an empty input.
 *
 * @type {(input: readonly number[]) => string}
 */
export const trace = input => {
    const draw = line(input.reduce((width, value) => max(width, String(value).length), 0) + 1)
    /**
     * Moves a walk to its end, drawing a line at every merge on the way: the
     * row before it, the two runs that merge joined, and `mark` after it. A
     * move keeps every run it does not merge, so the merged pair starts at
     * the first run the next row does not hold.
     *
     * @type {(next: (walk: Walk<_Span>) => Walk<_Span>, mark: string) => (lines: readonly string[], from: Walk<_Span>) => readonly [readonly string[], Walk<_Span>]}
     */
    const settle = (next, mark) => (lines, from) => {
        let drawn = lines
        let walk = from
        while (true) {
            const moved = next(walk)
            if (moved === walk) { return [drawn, walk] }
            const before = row(walk)
            const after = row(moved)
            if (after.length < before.length) {
                drawn = [...drawn, `${draw(before, before.findIndex((span, i) => span !== after[i]))}${mark}`]
            }
            walk = moved
        }
    }
    const pushed = settle(push, '')
    const folded = settle(collect, ' .')
    /** @type {readonly string[]} */
    let lines = []
    /** @type {Stack<_Span>} */
    let stack = null
    for (const value of input) {
        const [drawn, walk] = pushed(lines, { stack, value: { sum: value, count: 1 }, pending: null })
        stack = { value: walk.value, rest: walk.stack }
        lines = [...drawn, `${draw(row(walk), null)} |`]
    }
    if (stack === null) { return '' }
    const [drawn, walk] = folded(lines, { stack: stack.rest, value: stack.value, pending: null })
    return [...drawn, draw([walk.value], null)].join('\n')
}

/** The sequences on offer: the value of each option and its text. @type {readonly (readonly [string, string])[]} */
const sequences = [
    ['increasing', `1, 2, …, ${n}`],
    ['decreasing', `${n}, ${n - 1}, …, 1`],
    ['heavy-first', `${n + 1}, 1, …, 1 (|....)`],
    ['heavy-last', `1, …, 1, ${n + 1} (....|)`],
    ['random', 'shuffled'],
    ['signed', `±1, …, ±${n / 2}, shuffled`],
]

/** @type {Demo<_DemoState, DemoEvent>} */
const definition = {
    init: { sequence: 'random', seed: 0 },
    update: state => event => pureOk(
        event.kind === 'input' && event.name === 'sequence' ? { ...state, sequence: event.value }
        : event.kind === 'click' && event.name === 'shuffle' ? { ...state, seed: state.seed + 1 }
        : state),
    view: state => {
        const input = sequence(state.sequence, state.seed)
        return ['div',
            ['p', `Adds ${n} numbers with the weighted fold, each weighing its magnitude, and draws every move. A value sits on the stack where the run two below it outweighs it; otherwise the two runs beneath it merge first, so a heavy value is never merged on arrival and equal values carry like a binary counter.`],
            ['p', 'Each line is one state, the runs over the values they cover: underscores join the two runs about to merge, a line ending in | is a push complete, lines ending in . are the fold at the end, and the last line is the sum.'],
            selectField({ name: 'sequence', label: 'Sequence' }, sequences.map(([kind, text]) => option(kind, text, kind === state.sequence))),
            ['p', button('shuffle', 'Shuffle', !shuffled(state.sequence))],
            caption('Input:'),
            ['pre', { [codeMarker]: '' }, input.join(' ')],
            caption('Merge tree:'),
            ['pre', { [codeMarker]: '', [drawingMarker]: '' }, trace(input)],
        ]
    },
}

export const demo = withInputs(definition, ['sequence', 'seed'], { sequence: sequences.map(([kind]) => kind) })
