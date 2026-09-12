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
 * runtime performs it. What a browser is measuring is a bigint shift loop
 * against a string conversion, and neither this module nor the runtime knows
 * that: one describes the work, the other times it.
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
 * `log2` by string length, the implementation the module's own does not use.
 *
 * It is here rather than imported because it is not part of the API: it is the
 * thing `log2` is faster than, and the demo exists to show by how much. Base 32
 * of the candidates measured, being the one that was closest.
 *
 * @type {(v: bigint) => bigint}
 */
export const stringLog2 = n => {
    const i = (BigInt(n.toString(32).length) - 1n) * 5n
    return i + 31n - BigInt(Math.clz32(Number(n >> i)))
}

/**
 * The work each implementation is timed on: `log2` of every power of two from
 * `2**size` down, and of the number one below it.
 *
 * **Each answer is checked, so a fast wrong implementation cannot win.** A
 * benchmark that only measures is a benchmark that rewards returning nothing.
 *
 * The size is the demo's, not the original page's, and the comparison survives
 * the change: what is measured is a loop over bits against a base conversion,
 * and both grow with the same input.
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

/** The implementations compared, in the order a reader sees them. */
const candidates = /** @type {const} */ ([
    ['log2', log2],
    ['stringLog2', stringLog2],
])

/**
 * Where the comparison starts unless the reader says otherwise.
 *
 * Big enough that the two separate — around 21 ms against 58 ms in Chrome, and
 * indistinguishable at 4000 — and small enough that the page does not appear
 * to hang.
 */
const defaultSize = '20000'

/**
 * The largest exponent this page will measure.
 *
 * **A bound, because the cost grows with the square of it.** The work is one
 * pass per bit over numbers that wide, so ten times the exponent is a hundred
 * times the wait: 20000 is a fifth of a second, 200000 is a couple of seconds,
 * and the million the original page used is minutes of a frozen tab. A reader
 * who mistypes a zero should be told, not punished.
 */
const maxSize = 200_000n

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
 * Times every candidate, one after another.
 *
 * One at a time rather than together: they are competing for the same core,
 * and a measurement taken while another is running measures the contention.
 *
 * @type {(size: bigint) => Effect<Sandbox, DemoState, never>}
 */
const measure = size => foldStep(
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
        }))))

/** @type {(row: DemoRow) => string} */
const rowText = ({ name, outcome }) =>
    `${name.padEnd(12)} ${typeof outcome === 'number' ? `${outcome.toFixed(1)} ms` : outcome}`

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
            return pureOk({ ...state, size: event.value })
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
