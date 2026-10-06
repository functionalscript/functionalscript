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
 */

import { sha256 } from './module.f.mjs'
import { textField, fieldUpdate } from '../../website/demo/module.f.mjs'
import { digestOf, hashOutput, sha2Algorithms, algorithmOf, algorithmOption } from '../../website/demo/hash/module.f.mjs'

const algorithms = sha2Algorithms.map(a => ({ name: a.name, output: hashOutput(a) }))
const selectedAlgorithm = algorithmOf(algorithms)

/**
 * The SHA-256 hex digest of a string's UTF-8 bytes. Kept as the exported
 * reader used by this module's proof.
 *
 * @type {(text: string) => string}
 */
export const digest = digestOf(sha256)

/** @type {Demo<{ readonly algorithm: string, readonly text: string }, DemoEvent>} */
export const demo = {
    init: { algorithm: 'SHA-256', text: '' },
    update: fieldUpdate,
    view: state => {
        const algorithm = selectedAlgorithm(state.algorithm)
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
