/**
 * Evaluate the Sloth VDF slowly, then verify the result quickly. The UTF-8
 * input is hashed with SHA-256 and the digest, as a big-endian integer, is
 * `x`. Evaluation runs a small batch of steps per browser turn, so the page
 * shows progress and can stop; batching is exact because
 * `eval(a + b)(x) = eval(b)(eval(a)(x))`. The output `y` is an editable
 * field: verification re-runs on every edit, so a changed digit fails at once.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 * @import { DemoState, DemoRun } from './types.ts'
 */

import { p, sloth } from './module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { digitsValue, hexDigitValue } from '../../text/ascii/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { textField, inputField } from '../../website/demo/module.f.mjs'
import { digestOf } from '../../website/demo/hash/module.f.mjs'
import { codeBlock } from '../../website/demo/code/module.f.mjs'
import { computeSync, sha256 } from '../sha2/module.f.mjs'
import { uint } from '../../types/bit_vec/module.f.mjs'

/** Steps evaluated per browser turn: a few tens of milliseconds. */
const batch = 10n

const sha256Digest = digestOf(sha256)
const sha256Sync = computeSync(sha256)
const decimalValue = digitsValue(10n)
const yDigits = p.toString(16).length

/** `x`: the SHA-256 digest of the text's UTF-8 bytes as an integer.
 * @type {(text: string) => bigint}
 */
export const xOf = text => uint(sha256Sync([utf8(text)]))

/** A non-negative decimal step count, or null while its field is invalid.
 * @type {(text: string) => bigint | null}
 */
export const parseSteps = text => decimalValue([...text].map(c => c.charCodeAt(0)))

/** A non-empty hexadecimal number, or null.
 * @type {(text: string) => bigint | null}
 */
export const parseHex = text => {
    const digits = [...text].map(c => hexDigitValue(c.charCodeAt(0)))
    return digits.length === 0 || digits.some(d => d === null) ? null
        : digits.reduce((n, d) => n * 16n + BigInt(/** @type {number} */ (d)), 0n)
}

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
    return { ...state, y: running ? '' : hexOfY(value), run: { ...run, done, value, running } }
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
    return steps === null ? state
        : advance(state, { steps, done: 0n, value: xOf(state.text), running: true })
}

/** @type {(message: string) => readonly Element[]} */
const refusal = message => [['p', { role: 'status', 'data-result': 'error' }, message]]

/** @type {(run: DemoRun | null) => readonly Element[]} */
const progress = run =>
    run === null ? []
        : run.running ? [['p', { role: 'status' }, `Evaluating: step ${run.done} of ${run.steps}.`]]
            : run.done < run.steps ? [['p', { role: 'status' }, `Stopped at step ${run.done} of ${run.steps}.`]]
                : [['p', { role: 'status' }, `Evaluated ${run.steps} sequential square roots.`]]

/** @type {(state: DemoState) => readonly Element[]} */
const verification = state => {
    const steps = parseSteps(state.steps)
    const y = parseHex(state.y)
    if (state.y === '' || steps === null) { return [] }
    if (y === null) { return refusal('Enter y as hexadecimal digits.') }
    if (y >= p) { return refusal('y must be less than the modulus p.') }
    return sloth.verify(steps)(xOf(state.text))(y)
        ? [['p', { role: 'status', 'data-result': 'ok' }, `✓ y verifies: squaring it ${steps} times returns x, up to sign.`]]
        : [['p', { role: 'status', 'data-result': 'error' }, '✗ y does not verify for this x and number of steps.']]
}

/** @type {(state: DemoState) => string} */
const buttonLabel = ({ run }) =>
    run === null || run.done === run.steps ? 'Evaluate'
        : run.running ? 'Stop'
            : 'Resume'

/** @type {Demo<DemoState, DemoEvent>} */
export const demo = {
    init: { text: 'Hello, FunctionalScript!', steps: '1000', y: '', run: null },
    nextEvent: state => state.run?.running ? { kind: 'click', name: 'evaluate-next' } : null,
    update: state => event => {
        if (event.kind === 'input') {
            return pureOk(event.name === 'text' ? { ...state, text: event.value, y: '', run: null }
                : event.name === 'steps' ? { ...state, steps: event.value, y: '', run: null }
                    : event.name === 'y' ? { ...state, y: event.value }
                        : state)
        }
        if (event.kind !== 'click') { return pureOk(state) }
        if (event.name === 'evaluate') { return pureOk(toggle(state)) }
        const { run } = state
        return pureOk(event.name === 'evaluate-next' && run !== null && run.running ? advance(state, run) : state)
    },
    view: state => ['div',
        ['p', 'A verifiable delay function takes many sequential steps to evaluate, while anyone can check the result quickly. Sloth evaluates by repeated modular square roots; verification squares the result back.'],
        textField({ name: 'text', label: 'Input' }, state.text),
        ['p', 'Input x = SHA-256 of the text, hex:'],
        codeBlock(sha256Digest(state.text), 'Copy x'),
        inputField({ name: 'steps', label: 'Steps' }, state.steps),
        ...(parseSteps(state.steps) === null ? refusal('Enter a non-negative decimal number of steps.') : []),
        ['p', ['button', { type: 'button', name: 'evaluate' }, buttonLabel(state)]],
        ...progress(state.run),
        textField({ name: 'y', label: 'Output y, hex', rows: 6 }, state.y),
        ['p', 'Edit any digit to see verification fail.'],
        ...verification(state),
    ],
}
