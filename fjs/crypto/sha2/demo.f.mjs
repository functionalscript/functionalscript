/**
 * SHA-2 as you type: pick an algorithm, type text, and see the digest of its
 * UTF-8 bytes.
 *
 * **The digest is shown in hex so a reader can check it outside this
 * repository.** For every variant the page gives the matching OpenSSL
 * command with the current input quoted as a shell argument, so quotes and
 * shell syntax in the text stay part of the text being hashed.
 * Hex is padded to the selected algorithm's hash length: converting a digest
 * to a number drops leading zeros, but they are still part of the digest.
 *
 * **It needs no operations.** Hashing is a pure function of the input, so
 * `update` declares `never` and returns its next state through `pureOk`.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 */

import { sha224, sha256, sha384, sha512, sha512x224, sha512x256 } from './module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { textField } from '../../website/demo/module.f.mjs'
import { digestOf, hashOutput } from '../hash_demo/module.f.mjs'

/** Algorithms and their output renderers, built once. */
const algorithms = [
    { name: 'SHA-224', hash: sha224, openssl: 'sha224' },
    { name: 'SHA-256', hash: sha256, openssl: 'sha256' },
    { name: 'SHA-384', hash: sha384, openssl: 'sha384' },
    { name: 'SHA-512', hash: sha512, openssl: 'sha512' },
    { name: 'SHA-512/224', hash: sha512x224, openssl: 'sha512-224' },
    { name: 'SHA-512/256', hash: sha512x256, openssl: 'sha512-256' },
].map(a => ({ ...a, output: hashOutput(a) }))

/** @type {(name: string) => typeof algorithms[number]} */
const algorithmOf = name => {
    const found = algorithms.find(a => a.name === name)
    if (found === undefined) { throw 'sha2 demo: no algorithm has this name' }
    return found
}

/**
 * The SHA-256 hex digest of a string's UTF-8 bytes. Kept as the exported
 * reader used by this module's proof.
 *
 * @type {(text: string) => string}
 */
export const digest = digestOf(sha256)

/** @type {(a: typeof algorithms[number], picked: typeof algorithms[number]) => Element} */
const algorithmOption = (a, picked) =>
    ['option', a === picked ? { value: a.name, selected: '' } : { value: a.name }, a.name]

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
            textField({ name: 'text', label: 'Text' }, state.text),
            ...algorithm.output(state.text),
        ]
    },
}
