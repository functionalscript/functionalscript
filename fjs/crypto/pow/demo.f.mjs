/**
 * Explore SHA-256 proof-of-work manually or with a stoppable nonce search. Hash UTF-8 input followed
 * by the decimal nonce, decode the compact nBits target, and compare the digest
 * as a big-endian integer. This illustrates the module's single-hash contract;
 * Bitcoin block headers use double SHA-256 and a different byte order.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 * @import { DemoState } from './types.ts'
 */

import { sha256Pow, targetFromNBits } from './module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { digitsValue, hexDigitValue } from '../../text/ascii/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { textField, inputField } from '../../website/demo/module.f.mjs'
import { codeBlock } from '../../website/demo/code/module.f.mjs'

const decimalValue = digitsValue(10n)

/** A non-negative decimal nonce, or null while its field is invalid.
 * @type {(text: string) => bigint | null}
 */
export const parseNonce = text => decimalValue([...text].map(c => c.charCodeAt(0)))

/** A compact unsigned 32-bit nBits value written in hexadecimal.
 * @type {(text: string) => bigint | null}
 */
export const parseNBits = text => {
    if (!text.startsWith('0x') && !text.startsWith('0X')) { return null }
    const digits = [...text.slice(2)].map(c => hexDigitValue(c.charCodeAt(0)))
    return digits.length === 0 || digits.length > 8 || digits.some(d => d === null)
        ? null
        : digits.reduce((n, d) => n * 16n + BigInt(/** @type {number} */ (d)), 0n)
}

/** @type {(state: DemoState) => bigint | null} */
const targetOf = state => {
    const bits = parseNBits(state.nBits)
    return bits === null ? null : targetFromNBits(bits)
}

/** @type {(state: DemoState, nonce: bigint, target: bigint, start: bigint, attempts: bigint) => DemoState} */
const tried = (state, nonce, target, start, attempts) => ({
    ...state, nonce: String(nonce), searchStart: start, attempts,
    running: sha256Pow.hashInt(utf8(`${state.text}${nonce}`)) > target,
})

/** @type {(state: DemoState, nonce: bigint, succeeded: boolean) => readonly Element[]} */
const searchSummary = (state, nonce, succeeded) => {
    if (state.searchStart === null) { return [] }
    const failedEnd = succeeded ? nonce - 1n : nonce
    return [['p',
        `${state.running ? 'Searching' : succeeded ? `Found nonce ${nonce}` : 'Stopped'} after ${state.attempts} ${state.attempts === 1n ? 'attempt' : 'attempts'}. `,
        failedEnd < state.searchStart ? 'No failed nonces.'
            : failedEnd === state.searchStart ? `Failed nonce: ${failedEnd}.`
                : `Failed nonces: ${state.searchStart}–${failedEnd}.`,
    ]]
}

/** @type {(state: DemoState) => readonly Element[]} */
const output = state => {
    const bits = parseNBits(state.nBits)
    const target = bits === null ? null : targetFromNBits(bits)
    const nonce = parseNonce(state.nonce)
    if (bits === null) { return [['p', { role: 'status' }, 'Enter nBits as 0x followed by 1–8 hexadecimal digits.']] }
    if (target === null || target === 0n) { return [['p', { role: 'status' }, 'nBits must decode to a positive 256-bit target.']] }
    /** @type {readonly Element[]} */
    const targetView = [
        ['p', 'Target, hex:'],
        codeBlock(target.toString(16).padStart(64, '0'), 'Copy target'),
    ]
    if (nonce === null) { return [...targetView, ['p', { role: 'status' }, 'Enter a non-negative decimal nonce.']] }
    const text = `${state.text}${nonce}`
    const hash = sha256Pow.hashInt(utf8(text))
    const succeeded = hash <= target
    return [
        ...targetView,
        ['p', 'Hashed input (UTF-8):'],
        codeBlock(text, 'Copy hashed input'),
        ['p', 'Hash, hex:'],
        codeBlock(hash.toString(16).padStart(64, '0'), 'Copy hash'),
        ['p', 'Proof of Work:'],
        ['p', { role: 'status' }, succeeded
            ? '✅ Hash meets target (hash ≤ target)'
            : '❌ Hash does not meet target (hash > target)'],
        ...searchSummary(state, nonce, succeeded),
    ]
}

/** @type {Demo<DemoState, DemoEvent>} */
export const demo = {
    init: { text: 'Hello, FunctionalScript!', nonce: '42', nBits: '0x200fffff', running: false, searchStart: null, attempts: 0n },
    nextEvent: state => state.running ? { kind: 'click', name: 'auto-next' } : null,
    update: state => event => {
        if (event.kind === 'input') {
            const reset = { ...state, running: false, searchStart: null, attempts: 0n }
            return pureOk(event.name === 'text' ? { ...reset, text: event.value }
                : event.name === 'nonce' ? { ...reset, nonce: event.value }
                    : event.name === 'nBits' ? { ...reset, nBits: event.value }
                        : state)
        }
        const nonce = parseNonce(state.nonce)
        if (event.kind !== 'click') { return pureOk(state) }
        if (event.name === 'auto-run') {
            if (state.running) { return pureOk({ ...state, running: false }) }
            const target = targetOf(state)
            if (nonce === null || target === null || target === 0n) { return pureOk(state) }
            const current = tried(state, nonce, target, nonce, 1n)
            return pureOk(current.running ? current : tried(state, nonce + 1n, target, nonce + 1n, 1n))
        }
        if (event.name === 'auto-next') {
            if (!state.running) { return pureOk(state) }
            const target = targetOf(state)
            return pureOk(nonce === null || target === null || target === 0n || state.searchStart === null
                ? { ...state, running: false }
                : tried(state, nonce + 1n, target, state.searchStart, state.attempts + 1n))
        }
        return pureOk(event.name === 'next-nonce' && nonce !== null
            ? { ...state, nonce: String(nonce + 1n), running: false, searchStart: null, attempts: 0n }
            : state)
    },
    view: state => ['div',
        ['p', 'Proof of Work'],
        ['p', 'Hash algorithm: SHA-256'],
        ['p', 'The nonce is appended to the UTF-8 input and hashed with SHA-256.'],
        ['p', 'The proof succeeds when the resulting hash is at most the target.'],
        textField({ name: 'text', label: 'Input' }, state.text),
        inputField({ name: 'nonce', label: 'Nonce' }, state.nonce),
        ['p',
            ['button', { type: 'button', name: 'next-nonce' }, 'Try next nonce'],
            ' ',
            ['button', { type: 'button', name: 'auto-run' }, state.running ? 'Stop' : 'Auto-run nonce'],
        ],
        inputField({ name: 'nBits', label: 'nBits' }, state.nBits),
        ['details', { class: 'pow-effort' },
            ['summary', 'Expected search effort'],
            ['table', { class: 'pow-search-effort', 'aria-label': 'Expected search effort' },
                ['thead', ['tr', ['th', { scope: 'col' }, 'nBits'], ['th', { scope: 'col' }, 'Average attempts']]],
                ['tbody',
                    ['tr', ['td', ['code', '0x200fffff'], ['span', { class: 'pow-effort-label' }, 'Default']], ['td', '≈16']],
                    ['tr', ['td', ['code', '0x1f0fffff']], ['td', '≈4,096']],
                    ['tr', ['td', ['code', '0x1f00ffff']], ['td', '≈65,537']],
                    ['tr', ['td', ['code', '0x1d00ffff'], ['span', { class: 'pow-effort-label' }, 'Bitcoin genesis']], ['td', '≈4.3 billion']],
                ],
            ],
            ['p', { class: 'pow-effort-note' }, 'These are averages; a search may finish sooner or take longer.'],
            ['p', { class: 'pow-effort-note' }, 'The nonce is written in decimal; hashes are compared as big-endian integers. Bitcoin uses double SHA-256 of a binary block header.'],
        ],
        ...output(state),
    ],
}
