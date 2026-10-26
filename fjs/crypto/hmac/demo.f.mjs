/**
 * HMAC as you type: choose SHA-1 or any SHA-2 variant, enter a key and message,
 * and see the hex authentication code of their UTF-8 bytes. Leading zeros
 * remain part of the code. A matching OpenSSL command quotes both inputs as
 * literal shell arguments, and both outputs use shared copyable code blocks.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { HashDemoAlgorithm } from '../../website/demo/hash/types.ts'
 */

import { maxLengthBytes } from '../../types/bit_vec/module.f.mjs'
import { hmac } from './module.f.mjs'
import { hexOf, hashAlgorithms, algorithmOf, algorithmOption, opensslVerification } from '../../website/demo/hash/module.f.mjs'
import { tryUtf8 } from '../../text/module.f.mjs'
import { textField, inputField, fieldUpdate, caption, refusal } from '../../website/demo/module.f.mjs'
import { codeBlock } from '../../website/demo/code/module.f.js'

/** Bind the hash and its formatter once for each HMAC choice.
 * @type {<S>(a: HashDemoAlgorithm<S>) => { readonly name: string, readonly openssl: string, readonly digest: (key: string, text: string) => string | null }}
 */
const hmacAlgorithm = ({ name, hash, openssl }) => {
    const keyed = hmac(hash)
    const hex = hexOf(hash)
    return { name, openssl, digest: (key, text) => {
        const keyBytes = tryUtf8(key)
        const textBytes = tryUtf8(text)
        return keyBytes === null || textBytes === null ? null : hex(keyed(keyBytes)(textBytes))
    } }
}

const algorithms = hashAlgorithms(hmacAlgorithm)
const selectedAlgorithm = algorithmOf(algorithms)

/** The selected HMAC of UTF-8 key and message, or null if either is too long.
 * @type {(algorithm: string, key: string, text: string) => string | null}
 */
export const digest = (algorithm, key, text) => selectedAlgorithm(algorithm).digest(key, text)

/** @type {Demo<{ readonly algorithm: string, readonly key: string, readonly text: string }, DemoEvent>} */
export const demo = {
    init: { algorithm: 'SHA-256', key: '', text: '' },
    update: fieldUpdate,
    view: state => {
        const algorithm = selectedAlgorithm(state.algorithm)
        const value = algorithm.digest(state.key, state.text)
        return ['div',
            ['p', 'HMAC uses a key to compute an authentication code for a message. Both inputs are encoded as UTF-8; the result is shown in hexadecimal.'],
            ['p',
                ['label', { for: 'algorithm' }, 'Algorithm '],
                ['select', { id: 'algorithm', name: 'algorithm' },
                    ...algorithms.map(a => algorithmOption(a, algorithm))],
            ],
            inputField({ name: 'key', label: 'Key (UTF-8)' }, state.key),
            textField({ name: 'text', label: 'Message (UTF-8)' }, state.text),
            ...(value === null
                ? [refusal(`Key or message too long: more than ${maxLengthBytes} UTF-8 bytes.`)]
                : [
                    caption(`HMAC-${algorithm.name}, hex:`),
                    codeBlock(value, 'Copy HMAC'),
                    ...opensslVerification([state.text, state.key], ([text, key]) =>
                        `printf '%s' ${text} | openssl dgst -${algorithm.openssl} -hmac ${key}`),
                ]),
        ]
    },
}
