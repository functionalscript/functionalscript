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

import { hmac } from './module.f.mjs'
import { hexOf, hashAlgorithms, algorithmOf, algorithmOption, opensslVerification } from '../../website/demo/hash/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { textField, inputField, fieldUpdate } from '../../website/demo/module.f.mjs'
import { codeBlock } from '../../website/demo/code/module.f.mjs'

/** Bind the hash and its formatter once for each HMAC choice.
 * @type {<S>(a: HashDemoAlgorithm<S>) => { readonly name: string, readonly openssl: string, readonly digest: (key: string, text: string) => string }}
 */
const hmacAlgorithm = ({ name, hash, openssl }) => {
    const keyed = hmac(hash)
    const hex = hexOf(hash)
    return { name, openssl, digest: (key, text) => hex(keyed(utf8(key))(utf8(text))) }
}

const algorithms = hashAlgorithms(hmacAlgorithm)
const selectedAlgorithm = algorithmOf(algorithms)

/** The selected HMAC of a key and message encoded as UTF-8.
 * @type {(algorithm: string, key: string, text: string) => string}
 */
export const digest = (algorithm, key, text) => selectedAlgorithm(algorithm).digest(key, text)

/** @type {Demo<{ readonly algorithm: string, readonly key: string, readonly text: string }, DemoEvent>} */
export const demo = {
    init: { algorithm: 'SHA-256', key: '', text: '' },
    update: fieldUpdate,
    view: state => {
        const algorithm = selectedAlgorithm(state.algorithm)
        return ['div', { class: 'hmac-demo' },
            ['p',
                ['label', { for: 'algorithm' }, 'Algorithm '],
                ['select', { id: 'algorithm', name: 'algorithm' },
                    ...algorithms.map(a => algorithmOption(a, algorithm))],
            ],
            inputField({ name: 'key', label: 'Key (UTF-8)' }, state.key),
            textField({ name: 'text', label: 'Message (UTF-8)' }, state.text),
            ['p', `HMAC-${algorithm.name}, hex:`],
            codeBlock(algorithm.digest(state.key, state.text), 'Copy HMAC'),
            ...opensslVerification([state.text, state.key], ([text, key]) =>
                `printf '%s' ${text} | openssl dgst -${algorithm.openssl} -hmac ${key}`),
        ]
    },
}
