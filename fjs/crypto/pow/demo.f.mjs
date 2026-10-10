/**
 * Explore SHA-256 proof-of-work manually or with a stoppable nonce search. Hash UTF-8 input followed
 * by the decimal nonce, decode the compact nBits target, and compare the digest
 * as a big-endian integer. This illustrates the module's single-hash contract;
 * Bitcoin block headers use double SHA-256 and a different byte order.
 * Multiline input preserves pasted UTF-8 text.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 * @import { DemoState, DemoSearch } from './types.ts'
 */

import { resultMarker, powResultMarker } from '../../website/style/module.f.mjs'
import { sha256Pow, targetFromNBits } from './module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { digitsValue, hexDigitValue } from '../../text/ascii/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { textField, inputField, caption } from '../../website/demo/module.f.mjs'
import { codeBlock } from '../../website/demo/code/module.f.mjs'
import { hexOf } from '../../website/demo/hash/module.f.mjs'
import { sha256 } from '../sha2/module.f.mjs'
import { vec } from '../../types/bit_vec/module.f.mjs'

const decimalValue = digitsValue(10n)
const formatHex = hexOf(sha256)
const hashBits = vec(sha256.hashLength)

/** @type {(value: bigint) => string} */
const hexUint = value => formatHex(hashBits(value))

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
    if (digits.length === 0 || digits.some(d => d === null)) { return null }
    const value = digits.reduce((n, d) => n * 16n + BigInt(/** @type {number} */ (d)), 0n)
    return value <= 0xffff_ffffn ? value : null
}

/** @type {(state: DemoState) => bigint | null} */
const targetOf = state => {
    const bits = parseNBits(state.nBits)
    return bits === null ? null : targetFromNBits(bits)
}

/** @type {(state: DemoState, nonce: bigint, target: bigint, start: bigint, attempts: bigint) => DemoState & { readonly search: DemoSearch }} */
const tried = (state, nonce, target, start, attempts) => {
    const hash = sha256Pow.hashInt(utf8(`${state.text}${nonce}`))
    return { ...state, nonce: String(nonce), search: { nonce, target, hash, start, attempts, running: hash > target } }
}

/** @type {(state: DemoState, nonce: bigint, succeeded: boolean) => readonly Element[]} */
const searchSummary = (state, nonce, succeeded) => {
    if (state.search === null) { return [] }
    const { start, attempts, running } = state.search
    const failedEnd = succeeded ? nonce - 1n : nonce
    return [['p', { 'data-pow-search-summary': '' },
        `${running ? 'Searching' : succeeded ? `Found nonce ${nonce}` : 'Stopped'} after ${attempts} ${attempts === 1n ? 'attempt' : 'attempts'}.`,
        ['br'],
        failedEnd < start ? 'No failed nonces.'
            : failedEnd === start ? `Failed nonce: ${failedEnd}.`
                : `Failed nonces: ${start}–${failedEnd}.`,
    ]]
}

/** @type {(message: string) => readonly Element[]} */
const refusal = message => [
    caption('Refused:'),
    ['pre', { role: 'status', [resultMarker]: 'error' }, message],
]

/** @type {(state: DemoState) => readonly Element[]} */
const output = state => {
    const bits = parseNBits(state.nBits)
    const target = targetOf(state)
    const nonce = parseNonce(state.nonce)
    if (bits === null) { return refusal('Enter nBits as a hexadecimal 32-bit value starting with 0x.') }
    if (target === null || target === 0n) { return refusal('nBits must decode to a positive 256-bit target.') }
    /** @type {readonly Element[]} */
    const targetView = [
        caption('Target, hex:'),
        codeBlock(hexUint(target), 'Copy target'),
    ]
    if (nonce === null) { return [...targetView, ...refusal('Enter a non-negative decimal nonce.')] }
    const text = `${state.text}${nonce}`
    const hash = state.search === null ? sha256Pow.hashInt(utf8(text)) : state.search.hash
    const succeeded = hash <= target
    return [
        caption('Hashed input (UTF-8):'),
        codeBlock(text, 'Copy hashed input'),
        ...targetView,
        caption('Hash, hex:'),
        codeBlock(hexUint(hash), 'Copy hash'),
        caption('Proof of Work:'),
        ['p', { role: 'status', [powResultMarker]: '', [resultMarker]: succeeded ? 'ok' : 'error' },
            ['svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
                ['path', { d: succeeded ? 'm5 12 4 4L19 6' : 'm6 6 12 12M18 6 6 18' }],
            ],
            ['span', succeeded ? 'Hash meets target (hash ≤ target)' : 'Hash does not meet target (hash > target)'],
        ],
        ...searchSummary(state, nonce, succeeded),
    ]
}

/** @type {Demo<DemoState, DemoEvent>} */
export const demo = {
    init: { text: 'Hello, FunctionalScript!', nonce: '42', nBits: '0x200fffff', search: null },
    nextEvent: state => state.search?.running ? { kind: 'click', name: 'auto-next' } : null,
    update: state => event => {
        if (event.kind === 'input') {
            const reset = { ...state, search: null }
            return pureOk(event.name === 'text' ? { ...reset, text: event.value }
                : event.name === 'nonce' ? { ...reset, nonce: event.value }
                    : event.name === 'nBits' ? { ...reset, nBits: event.value }
                        : state)
        }
        if (event.kind !== 'click') { return pureOk(state) }
        if (event.name === 'auto-run') {
            if (state.search?.running) { return pureOk({ ...state, search: { ...state.search, running: false } }) }
            const nonce = parseNonce(state.nonce)
            const target = targetOf(state)
            if (nonce === null || target === null || target === 0n) { return pureOk(state) }
            const current = tried(state, nonce, target, nonce, 1n)
            return pureOk(current.search.running ? current : tried(state, nonce + 1n, target, nonce + 1n, 1n))
        }
        if (event.name === 'auto-next') {
            const search = state.search
            return pureOk(search === null || !search.running ? state
                : tried(state, search.nonce + 1n, search.target, search.start, search.attempts + 1n))
        }
        const nonce = parseNonce(state.nonce)
        return pureOk(event.name === 'next-nonce' && nonce !== null
            ? { ...state, nonce: String(nonce + 1n), search: null }
            : state)
    },
    view: state => ['div',
        ['p', 'The nonce is appended to the UTF-8 input and hashed with SHA-256. The proof succeeds when the resulting hash is at most the target.'],
        textField({ name: 'text', label: 'Input' }, state.text),
        inputField({ name: 'nonce', label: 'Nonce' }, state.nonce),
        ['p',
            ['button', { type: 'button', name: 'next-nonce' }, 'Try next nonce'],
            ' ',
            ['button', { type: 'button', name: 'auto-run' }, state.search?.running ? 'Stop' : 'Auto-run nonce'],
        ],
        inputField({ name: 'nBits', label: 'nBits' }, state.nBits),
        ['details', { 'data-pow-effort': '' },
            ['summary', 'Expected search effort'],
            ['table', { 'data-pow-search-effort': '', 'aria-label': 'Expected search effort' },
                ['thead', ['tr', ['th', { scope: 'col' }, 'nBits'], ['th', { scope: 'col' }, 'Average attempts']]],
                ['tbody',
                    ['tr', ['td', ['code', '0x200fffff'], ['span', { 'data-pow-effort-label': '' }, 'Default']], ['td', '≈16']],
                    ['tr', ['td', ['code', '0x1f0fffff']], ['td', '≈4,096']],
                    ['tr', ['td', ['code', '0x1f00ffff']], ['td', '≈65,537']],
                    ['tr', ['td', ['code', '0x1d00ffff'], ['span', { 'data-pow-effort-label': '' }, 'Bitcoin genesis']], ['td', '≈4.3 billion']],
                ],
            ],
            ['p', { 'data-pow-effort-note': '' }, 'These are averages; a search may finish sooner or take longer. The Bitcoin genesis target is listed for comparison; searching it is impractical in this demo.'],
        ],
        ...output(state),
    ],
}
