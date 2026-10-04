/**
 * SHA-2 as you type: pick an algorithm, type text, and see the digest of its
 * UTF-8 bytes.
 *
 * **The digest is shown in hex so a reader can check it outside this
 * repository.** For every variant the page gives the matching OpenSSL
 * command with the current input quoted as a shell argument, so quotes and
 * shell syntax in the text stay part of the text being hashed.
 *
 * **It needs no operations.** Hashing is a pure function of the input, so
 * `update` declares `never` and returns its next state through `pureOk`.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Sha2 } from './types.ts'
 * @import { Element } from '../../media/html/types.ts'
 */

import { computeSync, sha224, sha256, sha384, sha512, sha512x224, sha512x256 } from './module.f.mjs'
import { uint } from '../../types/bit_vec/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'

/**
 * @type {readonly { readonly name: string, readonly hash: Sha2, readonly openssl: string }[]}
 */
const algorithms = [
    { name: 'SHA-224', hash: sha224, openssl: 'sha224' },
    { name: 'SHA-256', hash: sha256, openssl: 'sha256' },
    { name: 'SHA-384', hash: sha384, openssl: 'sha384' },
    { name: 'SHA-512', hash: sha512, openssl: 'sha512' },
    { name: 'SHA-512/224', hash: sha512x224, openssl: 'sha512-224' },
    { name: 'SHA-512/256', hash: sha512x256, openssl: 'sha512-256' },
]

/** @type {(name: string) => typeof algorithms[number]} */
const algorithmOf = name => {
    const found = algorithms.find(a => a.name === name)
    if (found === undefined) { throw 'sha2 demo: no algorithm has this name' }
    return found
}

/** @type {(hash: Sha2) => (text: string) => string} */
const digestOf = hash => text =>
    uint(computeSync(hash)([utf8(text)])).toString(16).padStart(Number(hash.hashLength / 4n), '0')

/**
 * The SHA-256 hex digest of a string's UTF-8 bytes. Kept as the exported
 * reader used by this module's proof.
 *
 * @type {(text: string) => string}
 */
export const digest = digestOf(sha256)

/** @type {(a: typeof algorithms[number], picked: typeof algorithms[number]) => import('../../media/html/types.ts').Element} */
const algorithmOption = (a, picked) =>
    ['option', a === picked ? { value: a.name, selected: '' } : { value: a.name }, a.name]

/** @type {(text: string, label: string) => Element} */
const codeBlock = (text, label) => ['div', { 'data-code': '', 'data-code-block': '' },
    ['pre', text],
    ['button', { type: 'button', 'data-copy': text, 'aria-label': label, 'aria-live': 'polite' }, 'Copy'],
]

/** @type {Demo<{ readonly algorithm: string, readonly text: string }, DemoEvent>} */
export const demo = {
    init: { algorithm: 'SHA-256', text: '' },
    update: state => event => pureOk(
        event.kind !== 'input'
            ? state
            : event.name === 'algorithm'
                ? { ...state, algorithm: event.value }
                : event.name === 'text'
                    ? { ...state, text: event.value }
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
                ['label', { for: 'text' }, 'Text '],
                ['input', { type: 'text', id: 'text', name: 'text', value: state.text }],
            ],
            ['p', `${algorithm.name}, hex:`],
            codeBlock(digestOf(algorithm.hash)(state.text), 'Copy digest'),
            ['p', 'Verify independently with OpenSSL:'],
            codeBlock(`printf '%s' '${state.text.replaceAll("'", "'\\''")}' | openssl dgst -${algorithm.openssl}`, 'Copy OpenSSL command'),
        ]
    },
}
