/**
 * HMAC as you type: choose SHA-1 or any SHA-2 variant, enter a key and message,
 * and see the hex authentication code of their UTF-8 bytes. Leading zeros
 * remain part of the code. A matching OpenSSL command quotes both inputs as
 * literal shell arguments, and both outputs use shared copyable code blocks.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Hash } from '../sha2/types.ts'
 */

import { hmac } from './module.f.mjs'
import { sha1 } from '../sha1/module.f.mjs'
import { algorithms as sha2Algorithms, algorithmOption } from '../sha2/demo.f.mjs'
import { uint } from '../../types/bit_vec/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { codeBlock, shellQuote } from '../../website/demo/module.f.mjs'

/**
 * @template S
 * @param {Hash<S>} hash
 * @returns {(key: string, text: string) => string}
 */
const digestOf = hash => (key, text) =>
    uint(hmac(hash)(utf8(key))(utf8(text))).toString(16).padStart(Number(hash.hashLength / 4n), '0')

const algorithms = [
    { name: 'SHA-1', openssl: 'sha1', digest: digestOf(sha1) },
    ...sha2Algorithms.map(({ name, hash, openssl }) => ({ name, openssl, digest: digestOf(hash) })),
]

/** @type {(name: string) => typeof algorithms[number]} */
const algorithmOf = name => {
    const found = algorithms.find(a => a.name === name)
    if (found === undefined) { throw 'hmac demo: no algorithm has this name' }
    return found
}

/** The selected HMAC of a key and message encoded as UTF-8.
 * @type {(algorithm: string, key: string, text: string) => string}
 */
export const digest = (algorithm, key, text) => algorithmOf(algorithm).digest(key, text)

/** @type {Demo<{ readonly algorithm: string, readonly key: string, readonly text: string }, DemoEvent>} */
export const demo = {
    init: { algorithm: 'SHA-256', key: '', text: '' },
    update: state => event => pureOk(
        event.kind !== 'input' ? state
            : event.name === 'algorithm' ? { ...state, algorithm: event.value }
                : event.name === 'key' ? { ...state, key: event.value }
                    : event.name === 'text' ? { ...state, text: event.value }
                        : state),
    view: state => {
        const algorithm = algorithmOf(state.algorithm)
        return ['div',
            ['p',
                ['label', { for: 'algorithm' }, 'Algorithm '],
                ['select', { id: 'algorithm', name: 'algorithm' },
                    ...algorithms.map(a => algorithmOption(a, algorithm))],
            ],
            ['p',
                ['label', { for: 'key' }, 'Key (UTF-8) '],
                ['input', { type: 'text', id: 'key', name: 'key', value: state.key }],
            ],
            ['p',
                ['label', { for: 'text' }, 'Message (UTF-8) '],
                ['input', { type: 'text', id: 'text', name: 'text', value: state.text }],
            ],
            ['p', `HMAC-${algorithm.name}, hex:`],
            codeBlock(algorithm.digest(state.key, state.text), 'Copy HMAC'),
            ['p', 'Verify independently with OpenSSL:'],
            codeBlock(`printf '%s' ${shellQuote(state.text)} | openssl dgst -${algorithm.openssl} -hmac ${shellQuote(state.key)}`, 'Copy OpenSSL command'),
        ]
    },
}
