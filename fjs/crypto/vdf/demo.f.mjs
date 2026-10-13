/**
 * Evaluate the Sloth VDF slowly, then verify the result quickly. The UTF-8
 * input is hashed with SHA-256 and the digest, as a big-endian integer, is
 * `x`. Evaluation runs a small batch of steps per browser turn, so the page
 * shows progress and can stop; batching is exact because
 * `eval(a + b)(x) = eval(b)(eval(a)(x))`.
 *
 * **Prover and verifier are separate sections.** Evaluation shows its `y`
 * read-only, with a Copy button; the verifier has its own empty field, so the
 * hand-over is the reader's paste, and a `y` from anywhere else can be checked
 * without evaluating. Changing a digit there before Verify shows a rejection
 * while the evaluated `y` stays above it.
 *
 * **Verification runs on Verify, never on a keystroke.** It is fast per step
 * but not free, so a large step count with verification in `view` would block
 * the page on every edit. As in the bigint demo, nothing is refused for being
 * slow: `wait` says how long a large verification will take before it starts.
 *
 * Each evaluation batch is timed by `sandbox`, whose host brackets the actual
 * call with performance.now(). Their sum is active evaluation time, excluding
 * hashing, rendering, scheduling and stopped time. Sloth has no separate proof:
 * y is the value verified. Verify measures only sloth.verify, up to five calls
 * on later turns against the same y. A call reaching 50 ms ends the batch.
 * Every call must succeed; only a completed matching prover run is compared.
 *
 * **Refusals belong to the input they block.** Oversized text and invalid
 * steps can each show a live refusal box. Evaluate and Verify controls stay
 * visible so readers can correct the fields; verification verdicts keep
 * their own result presentation.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 * @import { DemoState, DemoRun } from './types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { Sandbox } from '../../effects/common/types.ts'
 */

import { resultMarker } from '../../website/style/module.f.js'
import { p, sloth } from './module.f.mjs'
import { tryUtf8 } from '../../text/module.f.mjs'
import { digitsValue, hexDigitsValue } from '../../text/ascii/module.f.mjs'
import { pureOk, resultStep } from '../../effects/module.f.mjs'
import { textField, inputField, caption, refusal } from '../../website/demo/module.f.mjs'
import { codeBlock } from '../../website/demo/code/module.f.mjs'
import { computeSync, sha256 } from '../sha2/module.f.mjs'
import { sandbox } from '../../effects/common/module.f.mjs'
import { formatDuration, median, ratio, validDuration } from './performance/module.f.mjs'
import { maxLengthBytes, uint } from '../../types/bit_vec/module.f.mjs'

/** Steps evaluated per browser turn: a few tens of milliseconds. */
const batch = 10n

const sha256Sync = computeSync(sha256)
const decimalValue = digitsValue(10n)
const yDigits = p.toString(16).length

/** Verification steps per second, measured in Node at `aa87d8cd`. */
const verifyStepsPerSecond = 500_000n

/** `x`: the SHA-256 digest of the text's UTF-8 bytes as an integer, or null
 * when the text is longer than a bit vector holds.
 * @type {(text: string) => bigint | null}
 */
export const xOf = text => {
    const bytes = tryUtf8(text)
    return bytes === null ? null : uint(sha256Sync([bytes]))
}

/** A non-negative decimal step count, or null while its field is invalid.
 * @type {(text: string) => bigint | null}
 */
export const parseSteps = text => decimalValue([...text].map(c => c.charCodeAt(0)))

/** A non-empty hexadecimal number, or null.
 * @type {(text: string) => bigint | null}
 */
export const parseHex = text => hexDigitsValue([...text].map(c => c.charCodeAt(0)))

/** `y` in hex, padded to the width of `p`.
 * @type {(y: bigint) => string}
 */
export const hexOfY = y => y.toString(16).padStart(yDigits, '0')

/** Time only the evaluation call, keeping Stop and input available between batches.
 * @type {(state: DemoState, run: DemoRun) => Effect<Sandbox, DemoState, never>}
 */
const advance = (state, run) => {
    const count = run.steps - run.done < batch ? run.steps - run.done : batch
    return resultStep(sandbox(() => sloth.eval(count)(run.value)), /** @returns {Effect<never, DemoState, never>} */ measured => {
        if (measured[0] === 'error' || measured[1].result[0] === 'error') {
            return pureOk({ ...state, run: null, verification: null, verdict: null, note: 'Evaluation error: no timing comparison is available.' })
        }
        const { result: [, value], duration } = measured[1]
        if (typeof value !== 'bigint' || !validDuration(duration)) {
            return pureOk({ ...state, run: null, verification: null, verdict: null, note: 'Evaluation did not produce a measurable result.' })
        }
        const done = run.done + count
        return pureOk({ ...state, run: { ...run, done, value, running: done < run.steps, duration: run.duration + duration } })
    })
}

/** Start, stop or resume evaluation. Starting a new run clears comparisons.
 * @type {(state: DemoState) => Effect<Sandbox, DemoState, never>}
 */
const toggle = state => {
    const { run } = state
    if (run !== null && run.done < run.steps) {
        return pureOk({ ...state, run: { ...run, running: !run.running }, verification: null, verdict: null })
    }
    const steps = parseSteps(state.steps)
    const x = xOf(state.text)
    return steps === null || x === null ? pureOk(state)
        : advance({ ...state, verdict: null, verification: null, note: null }, { steps, done: 0n, value: x, running: true, duration: 0 })
}

/** @type {(run: DemoRun | null) => readonly Element[]} */
const progress = run =>
    run === null ? []
        : run.running ? [['p', { role: 'status' }, `Evaluating: step ${run.done} of ${run.steps}.`]]
            : run.done < run.steps ? [['p', { role: 'status' }, `Stopped at step ${run.done} of ${run.steps}.`]]
                : [['p', { role: 'status' }, `Evaluated ${run.steps} sequential square roots.`]]

/** Measure a verifier call; parse and hash outside the timed thunk.
 * Five fast calls give a small bounded median sample. Yielding between calls
 * keeps the UI responsive; a call reaching 50 ms ends the batch.
 * @type {(state: DemoState) => Effect<Sandbox, DemoState, never>}
 */
const verify = state => {
    const steps = parseSteps(state.steps)
    const x = xOf(state.text)
    const cleared = { ...state, verification: null, verdict: null }
    if (steps === null || x === null) { return pureOk(cleared) }
    if (state.claimed.length > yDigits) { return pureOk({ ...cleared, verdict: 'tooLong' }) }
    const y = parseHex(state.claimed)
    if (y === null) { return pureOk({ ...cleared, verdict: 'notHex' }) }
    if (y >= p) { return pureOk({ ...cleared, verdict: 'notBelowP' }) }
    const check = sloth.verify(steps)(x)
    return resultStep(sandbox(() => check(y)), /** @returns {Effect<never, DemoState, never>} */ measured => {
        if (measured[0] === 'error' || measured[1].result[0] === 'error') {
            return pureOk({ ...cleared, verdict: 'error' })
        }
        const { result: [, valid], duration } = measured[1]
        if (valid !== true) { return pureOk({ ...cleared, verdict: 'rejected' }) }
        if (!validDuration(duration)) { return pureOk({ ...cleared, verdict: 'error' }) }
        const samples = [...(state.verification?.samples ?? []), duration]
        const running = samples.length < 5 && duration < 50
        return pureOk({ ...state, verdict: running ? null : 'verified', verification: { samples, running } })
    })
}

/** @type {(state: DemoState) => readonly Element[]} */
const verdictView = ({ verdict, steps }) =>
    verdict === null ? []
        : verdict === 'error' ? [refusal('Verification error: no timing comparison is available.')]
        : verdict === 'tooLong' ? [refusal(`Enter y with at most ${yDigits} hexadecimal digits.`)]
            : verdict === 'notHex' ? [refusal('Enter y as hexadecimal digits.')]
                : verdict === 'notBelowP' ? [refusal('y must be less than the modulus p.')]
                    : verdict === 'verified'
                        ? [['p', { role: 'status', [resultMarker]: 'ok' }, `✓ y verifies: squaring it ${steps} times returns x, up to sign.`]]
                        : [['p', { role: 'status', [resultMarker]: 'error' }, '✗ y does not verify for this x and number of steps.']]

/** `x` in hex, or the refusal of a text too long to hash.
 * @type {(x: bigint | null) => readonly Element[]}
 */
const xView = x => x === null
    ? [refusal(`Input too long: more than ${maxLengthBytes} UTF-8 bytes.`)]
    : [caption('Input x = SHA-256 of the text, hex:'), codeBlock(x.toString(16).padStart(64, '0'), 'Copy x')]

/** The evaluated `y`, once every step is done.
 * @type {(run: DemoRun | null) => readonly Element[]}
 */
const result = run =>
    run === null || run.done < run.steps ? []
        : [caption('Result y, hex:'), codeBlock(hexOfY(run.value), 'Copy y')]

/**
 * How long a verification at this many steps takes, when it is long enough
 * that the page would otherwise look stuck, or null.
 *
 * @type {(state: DemoState) => string | null}
 */
const waitNote = state => {
    const steps = parseSteps(state.steps)
    const seconds = steps === null ? 0n : steps / verifyStepsPerSecond
    return seconds === 0n ? null
        : seconds < 120n ? `verifying ${state.steps} steps takes about ${seconds} s`
            : `verifying ${state.steps} steps takes about ${seconds / 60n} min`
}

/** @type {(state: DemoState) => string} */
const buttonLabel = ({ run }) =>
    run === null || run.done === run.steps ? 'Evaluate'
        : run.running ? 'Stop'
            : 'Resume'

/** Actual proportions, with a separate visibility marker for tiny bars.
 * @type {(label: string, duration: number, maximum: number, compare: boolean) => Element}
 */
const timingBar = (label, duration, maximum, compare) => {
    const width = maximum === 0 ? 0 : 100 * duration / maximum
    return ['div',
        caption(`${label}: ${formatDuration(duration)}`),
        ...(compare ? [/** @type {const} */ (['svg', { preserveAspectRatio: 'none', viewBox: '0 0 100 4', width: '100%', height: '16', 'aria-hidden': 'true' },
            ['rect', { width: String(width), height: '4', fill: 'currentColor' }],
            ...(width > 0 && width < 1 ? [/** @type {const} */ (['path', { d: 'M0 0V4', stroke: 'currentColor', 'stroke-width': '1' }])] : []),
        ])] : []),
    ]
}

/** Only compare a successful verification of this run's exact output.
 * @type {(state: DemoState) => readonly Element[]}
 */
const performanceView = ({ run, verification, verdict, claimed }) => {
    const work = run !== null && run.done === run.steps ? run.duration : null
    const verified = verdict === 'verified' && verification !== null ? median(verification.samples) : null
    if (work === null && verified === null) { return [] }
    const matching = work !== null && verified !== null && run !== null && parseHex(claimed) === run.value
    const speedup = matching ? ratio(work, verified) : null
    const maximum = Math.max(work ?? 0, verified ?? 0)
    return [['section', { 'aria-label': 'Performance comparison' },
        ['h3', 'Performance comparison'],
        ['div', { 'data-vdf-timings': '' },
            ...(work === null ? [] : [timingBar('Work (active evaluation)', work, maximum, matching)]),
            ...(verified === null || verification === null ? [] : [timingBar(`Median verification time (${verification.samples.length} runs)`, verified, maximum, matching)]),
        ],
        ...(speedup === null ? [] : [/** @type {const} */ (['p', speedup > 1 ? `${speedup.toFixed(1)}× faster verification` : `${speedup.toFixed(2)}× work / verification; verification was not faster.`])]),
        ...(matching ? speedup === null ? [/** @type {const} */ (['p', 'Timing is too close to timer resolution to report a ratio.'])] : []
            : [/** @type {const} */ (['p', 'Compare only after verifying the exact y produced by this evaluation.'])]),
        ['p', 'Work requires sequential computation; verification checks the result and proof more efficiently. Sloth uses y itself, with no separate proof.'],
        ['p', ['small', 'Work excludes pauses, scheduling, rendering and input hashing. Bars use actual proportions; a line marks bars below 1% width. Results depend on browser, hardware, input, steps and execution environment. Educational measurements, not cryptographic security benchmarks; verification is not always faster.']],
    ]]
}

/** @type {Demo<DemoState, DemoEvent, Sandbox>} */
export const demo = {
    init: { text: 'Hello, FunctionalScript!', steps: '1000', claimed: '', run: null, verdict: null, verification: null, note: null },
    nextEvent: state => state.run?.running ? { kind: 'click', name: 'evaluate-next' }
        : state.verification?.running ? { kind: 'click', name: 'verify-next' } : null,
    wait: waitNote,
    update: state => event => {
        if (event.kind === 'input') {
            return pureOk(event.name === 'text' ? { ...state, text: event.value, run: null, verdict: null, verification: null, note: null }
                : event.name === 'steps' ? { ...state, steps: event.value, run: null, verdict: null, verification: null, note: null }
                    : event.name === 'claimed' ? { ...state, claimed: event.value, verdict: null, verification: null }
                        : state)
        }
        if (event.kind !== 'click') { return pureOk(state) }
        if (event.name === 'evaluate') { return state.verification?.running ? pureOk(state) : toggle(state) }
        // Not while evaluating: incremental turns must stay small, and the
        // runtime shows no `wait` note for them.
        if (event.name === 'verify') { return state.run?.running || state.verification?.running ? pureOk(state) : verify({ ...state, verification: null }) }
        if (event.name === 'verify-next') { return state.verification?.running ? verify(state) : pureOk(state) }
        const { run } = state
        return event.name === 'evaluate-next' && run !== null && run.running ? advance(state, run) : pureOk(state)
    },
    view: state => ['div',
        ['p', 'A verifiable delay function takes many sequential steps to evaluate, while anyone can check the result quickly. Sloth evaluates by repeated modular square roots; verification squares the result back. Evaluate, copy y into the verifier, and press Verify; change a digit to see it rejected.'],
        textField({ name: 'text', label: 'Input' }, state.text),
        ...xView(xOf(state.text)),
        inputField({ name: 'steps', label: 'Steps' }, state.steps),
        ...(parseSteps(state.steps) === null ? [refusal('Enter a non-negative decimal number of steps.')] : []),
        ['section',
            ['h3', 'Evaluate'],
            ['p', ['button', { type: 'button', name: 'evaluate', ...(state.verification?.running ? { disabled: '' } : {}) }, buttonLabel(state)]],
            ...progress(state.run),
            ...result(state.run),
        ],
        ['section',
            ['h3', 'Verify'],
            textField({ name: 'claimed', label: 'Claimed y, hex', rows: 6 }, state.claimed),
            ['p', ['button', { type: 'button', name: 'verify', ...(state.run?.running || state.verification?.running ? { disabled: '' } : {}) }, 'Verify']],
            ...(state.verification?.running ? [/** @type {const} */ (['p', { role: 'status' }, 'Verifying: measuring repeated calls.'])] : []),
            ...verdictView(state),
        ],
        ...(state.note === null ? [] : [refusal(state.note)]),
        ...performanceView(state),
    ],
}
