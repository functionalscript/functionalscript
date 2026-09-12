/**
 * How fast `log2` is here, measured in the browser you are reading this in.
 *
 * The numbers in [`README.md`](./README.md) came from a hand-written page and
 * a hand-written script, run once per browser and pasted into a table. This is
 * that page, as a demo: the same comparison, on the module's own page, with no
 * HTML of its own.
 *
 * **It is the first demo that asks for something.** Timing needs a clock, and
 * a demo is FunctionalScript — so it names `sandbox`, the host-neutral
 * operation that runs a thunk and reports how long it took, and the shared
 * runtime performs it. What a browser is measuring is eight ways to find the
 * high bit of a `bigint`, and neither this module nor the runtime knows that:
 * one describes the work, the other times it.
 *
 * @module
 *
 * @import { Sandbox, SandboxResult } from '../../effects/common/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Result } from '../result/types.ts'
 * @import { DemoRow, DemoState } from './types.ts'
 */

import { log2 } from './module.f.mjs'
import { sandbox } from '../../effects/common/module.f.mjs'
import { foldStep, pureOk, resultStep } from '../../effects/module.f.mjs'

/**
 * `benchmark.mjs`'s own `log2`, which is **not** the one that shipped.
 *
 * Named for what separates the two: it narrows from `32n` and finishes with
 * `Math.clz32`, where the module's narrows from `0x400n` and finishes with
 * `Math.log2`. Both are in the comparison because the difference is the point.
 *
 * `clz32Log2` is [`README.md`](./README.md)'s name for it, not a new one — the
 * tables there have carried that column since 2024, under a heading the
 * benchmark file itself never had.
 *
 * @type {(v: bigint) => bigint}
 */
const clz32Log2 = v => {
    if (v <= 0n) { return -1n }
    let result = 31n
    let i = 32n
    while (true) {
        const n = v >> i
        if (n === 0n) { break }
        v = n
        result += i
        i <<= 1n
    }
    while (i !== 32n) {
        i >>= 1n
        const n = v >> i
        if (n !== 0n) {
            result += i
            v = n
        }
    }
    return result - BigInt(Math.clz32(Number(v)))
}

/**
 * The first version: the same doubling search, stepping from `1n` and with no
 * remainder phase at all.
 *
 * @type {(v: bigint) => bigint}
 */
const oldLog2 = v => {
    if (v <= 0n) { return -1n }
    let result = 0n
    let i = 1n
    while (true) {
        const n = v >> i
        if (n === 0n) { break }
        v = n
        result += i
        i <<= 1n
    }
    while (i !== 1n) {
        i >>= 1n
        const n = v >> i
        if (n !== 0n) {
            result += i
            v = n
        }
    }
    return result
}

/**
 * Length of the binary text. The shortest to write, and the slowest to run —
 * it builds a string as long as the number has bits.
 *
 * @type {(v: bigint) => bigint}
 */
const stringLog2 = v => BigInt(v.toString(2).length) - 1n

/**
 * Length of the hexadecimal text, then `Math.clz32` for the last four bits.
 *
 * @type {(v: bigint) => bigint}
 */
const stringHexLog2 = v => {
    const len = (BigInt(v.toString(16).length) - 1n) << 2n
    const x = v >> len
    return len + 31n - BigInt(Math.clz32(Number(x)))
}

/**
 * The same idea in base 32, so the string is a fifth the length.
 *
 * @type {(v: bigint) => bigint}
 */
const string32Log2 = n => {
    const i = (BigInt(n.toString(32).length) - 1n) * 5n
    return i + 31n - BigInt(Math.clz32(Number(n >> i)))
}

/**
 * Doubling from `1023n`, finishing with `Math.log2` but without the infinity
 * check {@link ylog2} and the module's `log2` both have.
 *
 * @type {(v: bigint) => bigint}
 */
const mathLog2 = v => {
    if (v <= 0n) { return -1n }
    let result = -1n
    let i = 1023n
    while (true) {
        const n = v >> i
        if (n === 0n) { break }
        v = n
        result += i
        i <<= 1n
    }
    while (i !== 1023n) {
        i >>= 1n
        const n = v >> i
        if (n !== 0n) {
            result += i
            v = n
        }
    }
    const x = BigInt(Math.log2(Number(v)) | 0)
    return result + x + (v >> x)
}

/** The benchmark's alias for `Math.log2`, kept because {@link ylog2} used it. */
const mLog2 = Math.log2

/**
 * The one that won, almost: `module.f.mjs`'s `log2` is this algorithm plus one
 * guard.
 *
 * **Kept in the comparison because it is a near-duplicate.** Two rows running
 * the same instructions are the page's evidence that its timings mean
 * anything — a measurement nothing reproduces is not a measurement — and they
 * do land together, at about 19 ms and 17 ms in Chrome.
 *
 * **The guard is `if (v <= 0n) { return -1n }`, and it is load-bearing.** For
 * every positive input the two agree exactly, including across the `2**1024`
 * boundary where the `isFinite` branch lives. Below that they part: `0n` gives
 * `1023n` here against `log2`'s `-1n`, and a negative input **never returns**,
 * because `-1n >> j` is `-1n` at any shift, so the doubling loop has no zero
 * to find.
 *
 * That is worse than a wrong answer and the one failure this page could not
 * absorb: {@link work} turns a wrong answer into a row because the candidate
 * *throws*, and `sandbox` catches throws. It cannot catch a loop. What keeps
 * this safe is that `work` never passes anything below `1n` — which is why
 * that is stated there as an invariant rather than left as an accident.
 *
 * @type {(v: bigint) => bigint}
 */
const ylog2 = n => {
    let i = -1n
    let j = 0x400n
    while (true) {
        const m = n >> j
        if (m === 0n) { break }
        n = m
        i += j
        j <<= 1n
    }
    while (j !== 0x400n) {
        j >>= 1n
        const m = n >> j
        if (m !== 0n) {
            i += j
            n = m
        }
    }
    const nl = mLog2(Number(n))
    if (isFinite(nl)) {
        const rem = BigInt(nl | 0)
        i += rem + (n >> rem)
    } else {
        i += 0x400n
    }
    return i
}

/**
 * The work each implementation is timed on: `log2` of every power of two from
 * `2**size` down, and of the number one below it.
 *
 * **Each answer is checked, so a fast wrong implementation cannot win.** A
 * benchmark that only measures is a benchmark that rewards returning nothing.
 *
 * **Never below `1n`**, and that is an invariant, not an incident: `e` stops
 * at `1`, so the smallest input any candidate sees is `1n`. {@link ylog2} does
 * not terminate on a negative, and no `sandbox` can catch a loop the way it
 * catches a throw — so widening this range is not a small change.
 *
 * The size is the demo's, not the original page's, and the comparison survives
 * the change: every candidate's cost grows with the same input, so shrinking
 * it moves the rows together without reordering them.
 *
 * @type {(size: bigint) => (f: (v: bigint) => bigint) => void}
 */
export const work = size => f => {
    let e = size
    let c = 1n << e
    while (e > 0n) {
        const x = f(c)
        if (x !== e) { throw [e, x] }
        const y = f(c - 1n)
        if (y !== e - 1n) { throw [e, y] }
        c >>= 1n
        --e
    }
}

/**
 * The implementations compared, in the order a reader sees them: the one that
 * shipped first, then the seven it was chosen over.
 *
 * **None of the others is exported, and none is an implementation of `log2`.**
 * They are the things it is measured against. Every one came off the retired
 * benchmark page, where it was tried and not chosen, and they are kept verbatim
 * so the page measures what was written rather than a tidied version of it.
 *
 * Publishing them would publish their disagreements. The base-conversion ones
 * answer the width of the digits they printed for a negative input, where
 * `log2` answers `-1n` — a plausible wrong value rather than a refusal, which
 * is the one thing this repository will not ship
 * ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
 * Measuring with them is safe because {@link work} checks every answer against
 * the exponent it asked for, so a candidate that is fast and wrong loses.
 *
 * `mLog2`, the benchmark's alias for `Math.log2`, is deliberately not a row.
 * It is not an implementation of anything — it takes a `number`, so it throws
 * on the first `bigint` handed to it — and the benchmark never timed it
 * either. It survives above as what {@link ylog2} calls, which is all it was.
 */
const candidates = /** @type {const} */ ([
    ['log2', log2],
    ['clz32Log2', clz32Log2],
    ['oldLog2', oldLog2],
    ['stringLog2', stringLog2],
    ['stringHexLog2', stringHexLog2],
    ['string32Log2', string32Log2],
    ['mathLog2', mathLog2],
    ['ylog2', ylog2],
])

/**
 * Where the comparison starts unless the reader says otherwise.
 *
 * Big enough that the eight separate — in Chrome they spread from about
 * 16 ms to about 236 ms, and at 4000 they are indistinguishable — and small
 * enough that the whole run is about half a second, which the busy state
 * covers without the page appearing to hang.
 *
 * @type {string}
 */
const defaultSize = '20000'

/**
 * The largest exponent this page will measure.
 *
 * **A bound, because the cost grows with the square of it.** The work is one
 * pass per bit over numbers that wide, so three times the exponent is nine
 * times the wait. Measured over all eight: 20000 is half a second, 60000 is
 * 4.3, and the million the original page used would be hours of a frozen tab.
 * A reader who mistypes a zero should be told, not punished.
 *
 * **Lowered from 200000 when the comparison grew from two candidates to
 * eight.** The old bound was chosen against two, where it cost a few seconds;
 * against eight the same number is the better part of a minute, which is a
 * hung tab by any reader's reckoning. The bound is a wait, not an exponent,
 * so it moves when the work does.
 *
 * @type {bigint}
 */
const maxSize = 60_000n

/**
 * The exponent a reader asked for, or `null` if they did not ask for a number.
 *
 * Digits only, and at least one of them: `BigInt` would accept whitespace, a
 * sign, and `0x` forms, and none of those is what a field labelled with an
 * exponent means. No regular expression — this repository has none — and no
 * `try`: the check is what makes the conversion safe.
 *
 * @type {(text: string) => bigint | null}
 */
export const parseSize = text => {
    if (text.length === 0) { return null }
    for (const c of text) {
        if (c < '0' || c > '9') { return null }
    }
    const value = BigInt(text)
    return value === 0n ? null : value
}

/**
 * One implementation's time, or what it said instead.
 *
 * **A throw is a row, not a failure of the demo.** `sandbox` catches what the
 * work throws, which is how a wrong answer reports itself here: the row says
 * so where its milliseconds would have been, and the other rows still appear.
 * That is what the demo's `never` error channel obliges it to do — absorb the
 * failure into what it renders.
 *
 * @type {(name: string) => (r: Result<SandboxResult<unknown>, unknown>) => DemoRow}
 */
const row = name => r => r[0] === 'error'
    ? { name, outcome: 'not available here' }
    : r[1].result[0] === 'error'
        ? { name, outcome: 'wrong answer' }
        : { name, outcome: r[1].duration }

/**
 * The smaller of two exponents, so a reader who asks for less than the warm-up
 * does not wait through a warm-up larger than the measurement.
 *
 * @type {(a: bigint) => (b: bigint) => bigint}
 */
const min = a => b => a < b ? a : b

/**
 * The exponent every candidate is run at, untimed, before any of them is
 * timed.
 *
 * **Without it the first row is libelled.** Whichever candidate runs first
 * pays for warming the engine's `bigint` paths, and it is not a small bias:
 * `log2` and `ylog2` are the same algorithm under two names, and in Chrome
 * the one placed first measured 31.5 ms against the other's 17.1 ms. Swapping
 * them swapped the numbers — 34.5 against 17.5 — which is how the cause was
 * identified. With this pass they read 19.2 and 16.4.
 *
 * A fifth of the default exponent, so the whole warm-up costs about a
 * twenty-fifth of one measurement: the work is quadratic in the exponent.
 *
 * @type {bigint}
 */
const warmupSize = 4_000n

/**
 * Times every candidate, one after another.
 *
 * One at a time rather than together: they are competing for the same core,
 * and a measurement taken while another is running measures the contention.
 *
 * The warm-up is a `sandbox` of its own whose duration is dropped — see
 * {@link warmupSize}. It is not folded into the first candidate's thunk,
 * because that is exactly the row it exists to stop distorting.
 *
 * @type {(size: bigint) => Effect<Sandbox, DemoState, never>}
 */
const measure = size => resultStep(
    sandbox(() => {
        for (const [, f] of candidates) { work(min(size)(warmupSize))(f) }
    }),
    () => foldStep(
    pureOk(candidates),
    /** @type {DemoState} */ ({ kind: 'done', size: String(size), rows: [], note: null }),
    ([name, f]) => state => resultStep(
        sandbox(() => work(size)(f)),
        // **`resultStep`, not `step`.** A demo's channel is `never`, so the
        // refusal a runtime answers with — this page implements `sandbox`, but
        // another need not — has to become a row rather than travel upward.
        // The type is what says so: `step` here does not compile.
        r => pureOk(/** @type {DemoState} */ ({
            ...state,
            rows: [...state.rows, row(name)(r)],
        })))))

/** @type {(row: DemoRow) => string} */
const rowText = ({ name, outcome }) =>
    `${name.padEnd(14)} ${typeof outcome === 'number' ? `${outcome.toFixed(1)} ms` : outcome}`

/**
 * What a `Measure` produces: rows, or the reason there are none.
 *
 * **The refusals are the demo's own, absorbed into what it renders**, which is
 * what its `never` error channel obliges it to do. A value that is not a whole
 * number and one that is larger than this page will measure are both the
 * reader's to see and fix, not failures of the demo.
 *
 * @type {(state: DemoState) => Effect<Sandbox, DemoState, never>}
 */
const onRun = state => {
    const size = parseSize(state.size)
    if (size === null) {
        return pureOk({ ...state, kind: 'done', rows: [], note: 'a whole number, please' })
    }
    if (size > maxSize) {
        return pureOk({
            ...state,
            kind: 'done',
            rows: [],
            note: `${maxSize} is as far as this page goes — the wait grows with the square`,
        })
    }
    return measure(size)
}

/** @type {Demo<DemoState, DemoEvent, Sandbox>} */
export const demo = {
    init: { kind: 'idle', size: defaultSize, rows: [], note: null },
    update: state => event => {
        // Typing changes what will be measured and nothing else: a keystroke is
        // not a request to measure, and the field is checked when `Measure` is
        // pressed rather than under the reader's fingers.
        if (event.kind === 'input' && event.name === 'size') {
            // **And it clears what was measured.** A table left beside a field
            // the reader has just changed reads as that field's result: 20000's
            // timings under a box saying 40000 are a plausible wrong answer,
            // which is the one thing this repository will not show
            // ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
            // Nothing has been measured for what the field now says, and an
            // empty section says exactly that — where a "stale" label would be
            // one more thing to render and to read.
            return pureOk({ kind: 'idle', size: event.value, rows: [], note: null })
        }
        return event.kind === 'click' && event.name === 'run'
            ? onRun(state)
            : pureOk(state)
    },
    view: state => ['div',
        ['p',
            ['button', { type: 'button', name: 'run' }, 'Measure'],
            ' log2 of every power of two below 2^',
            ['input', {
                type: 'text',
                name: 'size',
                value: state.size,
                size: '7',
                'aria-label': 'exponent',
            }],
            ', and the number below each.',
        ],
        ...(state.note !== null
            ? [/** @type {const} */ (['p', state.note])]
            : state.kind === 'idle'
                ? []
                : [/** @type {const} */ (['pre', state.rows.map(rowText).join('\n')])]),
    ],
}
