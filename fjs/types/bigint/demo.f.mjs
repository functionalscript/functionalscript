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
 * @import { _Row, _State } from './private.ts'
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
 * How large a number the comparison starts from.
 *
 * Big enough that the two separate — under Node they are 20 ms against 54 ms
 * here, and indistinguishable at 4000 — and small enough that the page does
 * not appear to hang. The original ran from `2**1048575` a thousand times,
 * which is a wait nobody browsing a module asked for.
 */
const size = 20_000n

/**
 * One implementation's time, or what it said instead.
 *
 * **A throw is a row, not a failure of the demo.** `sandbox` catches what the
 * work throws, which is how a wrong answer reports itself here: the row says
 * so where its milliseconds would have been, and the other rows still appear.
 * That is what the demo's `never` error channel obliges it to do — absorb the
 * failure into what it renders.
 *
 * @type {(name: string) => (r: Result<SandboxResult<unknown>, unknown>) => _Row}
 */
const row = name => r => r[0] === 'error'
    ? { name, ms: null, note: 'not available here' }
    : r[1].result[0] === 'error'
        ? { name, ms: null, note: 'wrong answer' }
        : { name, ms: r[1].duration, note: null }

/**
 * Times every candidate, one after another.
 *
 * One at a time rather than together: they are competing for the same core,
 * and a measurement taken while another is running measures the contention.
 *
 * @type {() => Effect<Sandbox, _State, never>}
 */
const measure = () => foldStep(
    pureOk(candidates),
    /** @type {_State} */ ({ kind: 'done', rows: [] }),
    ([name, f]) => state => resultStep(
        sandbox(() => work(size)(f)),
        // **`resultStep`, not `step`.** A demo's channel is `never`, so the
        // refusal a runtime answers with — this page implements `sandbox`, but
        // another need not — has to become a row rather than travel upward.
        // The type is what says so: `step` here does not compile.
        r => pureOk(/** @type {_State} */ ({
            kind: 'done',
            rows: [...state.rows, row(name)(r)],
        }))))

/** @type {(row: _Row) => string} */
const rowText = ({ name, ms, note }) =>
    `${name.padEnd(12)} ${note ?? `${ms?.toFixed(1)} ms`}`

/**
 * @type {Demo<_State, DemoEvent, Sandbox>}
 */
export const demo = {
    init: { kind: 'idle', rows: [] },
    update: state => event =>
        event.kind === 'click' && event.name === 'run' ? measure() : pureOk(state),
    view: state => ['div',
        ['p',
            ['button', { type: 'button', name: 'run' }, 'Measure'],
            ` log2 of every power of two below 2^${size}, and the number below each.`,
        ],
        ...(state.kind === 'idle'
            ? []
            : [/** @type {const} */ (['pre', state.rows.map(rowText).join('\n')])]),
    ],
}
