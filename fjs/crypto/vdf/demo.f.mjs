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
 * There is no timing yet. `sandbox` could measure it, as the bigint demo does,
 * but evaluation runs in `nextEvent` turns, whose contract asks for no
 * operations; timing it means revisiting that contract first.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 * @import { DemoState, DemoRun, DemoVerdict } from './types.ts'
 */

import { resultMarker } from '../../website/style/module.f.mjs'
import { p, sloth } from './module.f.mjs'
import { tryUtf8 } from '../../text/module.f.mjs'
import { digitsValue, hexDigitsValue } from '../../text/ascii/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { textField, inputField, caption } from '../../website/demo/module.f.mjs'
import { codeBlock } from '../../website/demo/code/module.f.mjs'
import { computeSync, sha256 } from '../sha2/module.f.mjs'
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

/** Evaluate the next batch; the last one publishes `y`.
 * @type {(state: DemoState, run: DemoRun) => DemoState}
 */
const advance = (state, run) => {
    const count = run.steps - run.done < batch ? run.steps - run.done : batch
    const value = /** @type {bigint} */ (sloth.eval(count)(run.value))
    const done = run.done + count
    const running = done < run.steps
    return { ...state, run: { ...run, done, value, running } }
}

/** Start, stop or resume the evaluation.
 * @type {(state: DemoState) => DemoState}
 */
const toggle = state => {
    const { run } = state
    if (run !== null && run.done < run.steps) {
        return { ...state, run: { ...run, running: !run.running } }
    }
    const steps = parseSteps(state.steps)
    const x = xOf(state.text)
    return steps === null || x === null ? state
        : advance(state, { steps, done: 0n, value: x, running: true })
}

/** @type {(message: string) => readonly Element[]} */
const refusal = message => [['p', { role: 'status', [resultMarker]: 'error' }, message]]

/** @type {(run: DemoRun | null) => readonly Element[]} */
const progress = run =>
    run === null ? []
        : run.running ? [['p', { role: 'status' }, `Evaluating: step ${run.done} of ${run.steps}.`]]
            : run.done < run.steps ? [['p', { role: 'status' }, `Stopped at step ${run.done} of ${run.steps}.`]]
                : [['p', { role: 'status' }, `Evaluated ${run.steps} sequential square roots.`]]

/** What Verify finds for the claimed `y`, or null while steps are invalid.
 * @type {(state: DemoState) => DemoVerdict | null}
 */
const verify = state => {
    const steps = parseSteps(state.steps)
    const x = xOf(state.text)
    if (steps === null || x === null) { return null }
    // Length first: parsing a long paste into a bigint is itself slow.
    if (state.claimed.length > yDigits) { return 'tooLong' }
    const y = parseHex(state.claimed)
    return y === null ? 'notHex'
        : y >= p ? 'notBelowP'
            : sloth.verify(steps)(x)(y) ? 'verified' : 'rejected'
}

/** @type {(state: DemoState) => readonly Element[]} */
const verdictView = ({ verdict, steps }) =>
    verdict === null ? []
        : verdict === 'tooLong' ? refusal(`Enter y with at most ${yDigits} hexadecimal digits.`)
            : verdict === 'notHex' ? refusal('Enter y as hexadecimal digits.')
                : verdict === 'notBelowP' ? refusal('y must be less than the modulus p.')
                    : verdict === 'verified'
                        ? [['p', { role: 'status', [resultMarker]: 'ok' }, `✓ y verifies: squaring it ${steps} times returns x, up to sign.`]]
                        : [['p', { role: 'status', [resultMarker]: 'error' }, '✗ y does not verify for this x and number of steps.']]

/** `x` in hex, or the refusal of a text too long to hash.
 * @type {(x: bigint | null) => readonly Element[]}
 */
const xView = x => x === null
    ? refusal(`Input too long: more than ${maxLengthBytes} UTF-8 bytes.`)
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

/** @type {Demo<DemoState, DemoEvent>} */
export const demo = {
    init: { text: 'Hello, FunctionalScript!', steps: '1000', claimed: '', run: null, verdict: null },
    nextEvent: state => state.run?.running ? { kind: 'click', name: 'evaluate-next' } : null,
    wait: waitNote,
    update: state => event => {
        if (event.kind === 'input') {
            return pureOk(event.name === 'text' ? { ...state, text: event.value, run: null, verdict: null }
                : event.name === 'steps' ? { ...state, steps: event.value, run: null, verdict: null }
                    : event.name === 'claimed' ? { ...state, claimed: event.value, verdict: null }
                        : state)
        }
        if (event.kind !== 'click') { return pureOk(state) }
        if (event.name === 'evaluate') { return pureOk(toggle(state)) }
        // Not while evaluating: incremental turns must stay small, and the
        // runtime shows no `wait` note for them.
        if (event.name === 'verify') { return pureOk(state.run?.running ? state : { ...state, verdict: verify(state) }) }
        const { run } = state
        return pureOk(event.name === 'evaluate-next' && run !== null && run.running ? advance(state, run) : state)
    },
    view: state => ['div',
        ['p', 'A verifiable delay function takes many sequential steps to evaluate, while anyone can check the result quickly. Sloth evaluates by repeated modular square roots; verification squares the result back. Evaluate, copy y into the verifier, and press Verify; change a digit to see it rejected.'],
        textField({ name: 'text', label: 'Input' }, state.text),
        ...xView(xOf(state.text)),
        inputField({ name: 'steps', label: 'Steps' }, state.steps),
        ...(parseSteps(state.steps) === null ? refusal('Enter a non-negative decimal number of steps.') : []),
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
        ],
    ],
}
