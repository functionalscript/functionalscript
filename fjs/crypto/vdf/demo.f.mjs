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
 * y is the value verified. Verify times one call to sloth.verify. Each
 * duration appears below its result; no repeated runs or statistics are gathered.
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

import { withInputs } from '../../website/demo/sharing/module.f.mjs'
import { resultMarker } from '../../website/style/module.f.js'
import { p, sloth } from './module.f.js'
import { tryUtf8 } from '../../text/module.f.mjs'
import { codePoints, decimalValue, hexDigitsValue } from '../../text/ascii/module.f.js'
import { pureOk, resultStep } from '../../effects/module.f.mjs'
import { textField, inputField, caption, refusal } from '../../website/demo/module.f.mjs'
import { codeBlock } from '../../website/demo/code/module.f.js'
import { computeSync, sha256 } from '../sha2/module.f.mjs'
import { sandbox } from '../../effects/common/module.f.mjs'
import { _formatDuration, _validDuration } from './performance/module.f.mjs'
import { maxLengthBytes, uint } from '../../types/bit_vec/module.f.mjs'
import { encodeScalar } from '../../basen/base16/module.f.mjs'

/** Steps evaluated per browser turn: a few tens of milliseconds. */
const batch = 10n

const sha256Sync = computeSync(sha256)
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
export const parseSteps = text => decimalValue(codePoints(text))

/** A non-empty hexadecimal number, or null.
 * @type {(text: string) => bigint | null}
 */
export const parseHex = text => hexDigitsValue(codePoints(text))

/** `y` in hex, padded to the width of `p`.
 * @type {(y: bigint) => string}
 */
export const hexOfY = encodeScalar(yDigits)

/** Time only the evaluation call, keeping Stop and input available between batches.
 * @type {(state: DemoState, run: DemoRun) => Effect<Sandbox, DemoState, never>}
 */
const advance = (state, run) => {
    const count = run.steps - run.done < batch ? run.steps - run.done : batch
    /** @type {DemoState} */
    const errorState = { ...state, run: null, verificationDuration: null, verdict: null, note: 'Evaluation error: no timing is available.' }
    return resultStep(sandbox(() => sloth.eval(count)(run.value)), /** @returns {Effect<never, DemoState, never>} */ measured => {
        const [tag, payload] = measured
        if (tag === 'error') { return pureOk(errorState) }
        const { result, duration } = payload
        const [resultTag, value] = result
        if (resultTag === 'error') { return pureOk(errorState) }
        if (typeof value !== 'bigint' || !_validDuration(duration)) {
            return pureOk({ ...state, run: null, verificationDuration: null, verdict: null, note: 'Evaluation did not produce a measurable result.' })
        }
        const done = run.done + count
        return pureOk({ ...state, run: { ...run, done, value, running: done < run.steps, duration: run.duration + duration } })
    })
}

/** Start, stop or resume evaluation. Starting a new run clears previous timings.
 * @type {(state: DemoState) => Effect<Sandbox, DemoState, never>}
 */
const toggle = state => {
    const { run } = state
    if (run !== null && run.done < run.steps) {
        return pureOk({ ...state, run: { ...run, running: !run.running } })
    }
    const steps = parseSteps(state.steps)
    const x = xOf(state.text)
    return steps === null || x === null ? pureOk(state)
        : advance({ ...state, verdict: null, verificationDuration: null, note: null }, { steps, done: 0n, value: x, running: true, duration: 0 })
}

/** @type {(run: DemoRun | null) => readonly Element[]} */
const progress = run =>
    run === null ? []
        : run.running ? [['p', { role: 'status' }, `Evaluating: step ${run.done} of ${run.steps}.`]]
            : run.done < run.steps ? [['p', { role: 'status' }, `Stopped at step ${run.done} of ${run.steps}.`]]
                : [['p', { role: 'status' }, `Evaluated ${run.steps} sequential square roots.`]]

/** Measure a verifier call; parse and hash outside the timed thunk.
 * @type {(state: DemoState) => Effect<Sandbox, DemoState, never>}
 */
const verify = state => {
    const steps = parseSteps(state.steps)
    const x = xOf(state.text)
    const cleared = { ...state, verificationDuration: null, verdict: null }
    if (steps === null || x === null) { return pureOk(cleared) }
    if (state.claimed.length > yDigits) { return pureOk({ ...cleared, verdict: 'tooLong' }) }
    const y = parseHex(state.claimed)
    if (y === null) { return pureOk({ ...cleared, verdict: 'notHex' }) }
    if (y >= p) { return pureOk({ ...cleared, verdict: 'notBelowP' }) }
    const check = sloth.verify(steps)(x)
    /** @type {DemoState} */
    const errorState = { ...cleared, verdict: 'error' }
    return resultStep(sandbox(() => check(y)), /** @returns {Effect<never, DemoState, never>} */ measured => {
        const [tag, payload] = measured
        if (tag === 'error') { return pureOk(errorState) }
        const { result, duration } = payload
        const [resultTag, valid] = result
        if (resultTag === 'error') { return pureOk(errorState) }
        if (typeof valid !== 'boolean' || !_validDuration(duration)) {
            return pureOk(errorState)
        }
        return pureOk({ ...state, verdict: valid ? 'verified' : 'rejected', verificationDuration: duration })
    })
}

/** @type {(state: DemoState) => readonly Element[]} */
const verdictView = ({ verdict, steps }) =>
    verdict === null ? []
        : verdict === 'error' ? [refusal('Verification error: no timing is available.')]
        : verdict === 'tooLong' ? [refusal(`Enter y with at most ${yDigits} hexadecimal digits.`)]
            : verdict === 'notHex' ? [refusal('Enter y as hexadecimal digits.')]
                : verdict === 'notBelowP' ? [refusal('y must be less than the modulus p.')]
                    : verdict === 'verified'
                        ? [['p', { role: 'status', [resultMarker]: 'ok' }, `✓ y verifies: squaring it ${steps} times returns x, up to sign.`]]
                        : [['p', { role: 'status', [resultMarker]: 'error' }, '✗ y does not verify for this x and number of steps.']]

/** A SHA-256 digest as 64 hexadecimal digits. */
const hexOfX = encodeScalar(64)

/** `x` in hex, or the refusal of a text too long to hash.
 * @type {(x: bigint | null) => readonly Element[]}
 */
const xView = x => x === null
    ? [refusal(`Input too long: more than ${maxLengthBytes} UTF-8 bytes.`)]
    : [caption('Input x = SHA-256 of the text, hex:'), codeBlock(hexOfX(x), 'Copy x')]

/** The evaluated `y`, once every step is done.
 * @type {(run: DemoRun | null) => readonly Element[]}
 */
const result = run =>
    run === null || run.done < run.steps ? []
        : [caption('Result y, hex:'), codeBlock(hexOfY(run.value), 'Copy y'),
            ['p', `Evaluation time (active computation): ${_formatDuration(run.duration)}`]]

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

/** @type {Demo<DemoState, DemoEvent, Sandbox>} */
const definition = {
    init: { text: 'Hello, FunctionalScript!', steps: '1000', claimed: '', run: null, verdict: null, verificationDuration: null, note: null },
    nextEvent: state => state.run?.running ? { kind: 'click', name: 'evaluate-next' } : null,
    wait: waitNote,
    update: state => event => {
        if (event.kind === 'input') {
            return pureOk(event.name === 'text' ? { ...state, text: event.value, run: null, verdict: null, verificationDuration: null, note: null }
                : event.name === 'steps' ? { ...state, steps: event.value, run: null, verdict: null, verificationDuration: null, note: null }
                    : event.name === 'claimed' ? { ...state, claimed: event.value, verdict: null, verificationDuration: null }
                        : state)
        }
        if (event.kind !== 'click') { return pureOk(state) }
        if (event.name === 'evaluate') { return toggle(state) }
        // Not while evaluating: incremental turns must stay small, and the
        // runtime shows no `wait` note for them.
        if (event.name === 'verify') { return state.run?.running ? pureOk(state) : verify(state) }
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
            ['p', ['button', { type: 'button', name: 'evaluate' }, buttonLabel(state)]],
            ...progress(state.run),
            ...result(state.run),
        ],
        ['section',
            ['h3', 'Verify'],
            textField({ name: 'claimed', label: 'Claimed y, hex', rows: 6 }, state.claimed),
            ['p', ['button', { type: 'button', name: 'verify', ...(state.run?.running ? { disabled: '' } : {}) }, 'Verify']],
            ...verdictView(state),
            ...(state.verificationDuration === null ? [] : [/** @type {const} */ (['p', `Verification time: ${_formatDuration(state.verificationDuration)}`])]),
        ],
        ...(state.note === null ? [] : [refusal(state.note)]),
    ],
}

export const demo = withInputs(definition, ['text', 'steps', 'claimed'], {})
