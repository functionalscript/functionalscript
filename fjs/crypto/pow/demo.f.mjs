/**
 * Explore SHA-256 proof-of-work one nonce at a time. Hash UTF-8 input followed
 * by the decimal nonce, decode the compact nBits target, and compare the digest
 * as a big-endian integer. This illustrates the module's single-hash contract;
 * Bitcoin block headers use double SHA-256 and a different byte order.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 * @import { DemoState } from './private.ts'
 */

import { sha256Pow, targetFromNBits } from './module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { digitsValue, hexDigitValue } from '../../text/ascii/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { codeBlock, shellQuote, textField } from '../../website/demo/module.f.mjs'

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

/** @type {(name: string, label: string, value: string) => Element} */
const input = (name, label, value) => ['p',
    ['label', { for: name }, `${label} `],
    ['input', { type: 'text', id: name, name, value, style: 'box-sizing: border-box; width: 100%' }],
]

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
    return [
        ...targetView,
        ['p', 'Hashed input (UTF-8):'],
        codeBlock(text, 'Copy hashed input'),
        ['p', 'Hash, hex:'],
        codeBlock(hash.toString(16).padStart(64, '0'), 'Copy hash'),
        ['p', 'Hash as integer:'],
        codeBlock(hash.toString(), 'Copy hash integer'),
        ['p', 'Proof of Work:'],
        ['p', { role: 'status' }, hash <= target
            ? '✅ Hash meets target (hash ≤ target)'
            : '❌ Hash does not meet target (hash > target)'],
        ['p', 'Verify the hash independently with OpenSSL:'],
        codeBlock(`printf '%s' ${shellQuote(text)} | openssl dgst -sha256`, 'Copy OpenSSL command'),
    ]
}

/** @type {Demo<DemoState, DemoEvent>} */
export const demo = {
    init: { text: 'Hello, FunctionalScript!', nonce: '42', nBits: '0x200fffff' },
    update: state => event => {
        if (event.kind === 'input') {
            return pureOk(event.name === 'text' ? { ...state, text: event.value }
                : event.name === 'nonce' ? { ...state, nonce: event.value }
                    : event.name === 'nBits' ? { ...state, nBits: event.value }
                        : state)
        }
        const nonce = parseNonce(state.nonce)
        return pureOk(event.kind === 'click' && event.name === 'next-nonce' && nonce !== null
            ? { ...state, nonce: String(nonce + 1n) }
            : state)
    },
    view: state => ['div',
        ['p', 'Proof of Work'],
        ['p', 'Hash algorithm: SHA-256'],
        ['p', 'Hash the UTF-8 input followed by the nonce in decimal. A proof succeeds when the hash, read as a big-endian integer, is at most the target. Bitcoin uses this comparison with double SHA-256 of a block header.'],
        textField({ name: 'text', label: 'Input' }, state.text),
        input('nonce', 'Nonce', state.nonce),
        ['p', ['button', { type: 'button', name: 'next-nonce' }, 'Try next nonce']],
        input('nBits', 'nBits', state.nBits),
        ['p', 'The initial target is easy enough to explore by hand. Bitcoin’s genesis nBits is 0x1d00ffff.'],
        ...output(state),
    ],
}
