/**
 * SHA-1 as you type: the padded hex digest of multiline UTF-8 text.
 * The shared hash output includes a literal OpenSSL command when possible.
 * @module
 */

import { digestOf, hashOutput, sha1Algorithm } from '../../website/demo/hash/module.f.mjs'
import { textDemo } from '../../website/demo/module.f.mjs'

export const digest = digestOf(sha1Algorithm.hash)

const output = hashOutput(sha1Algorithm)

export const demo = textDemo({ name: 'text', label: 'Text', init: '' })(text => [
    ['p', 'SHA-1 collision resistance is broken. Do not use it to verify authenticity or protect against tampering.'],
    ...output(text),
])
