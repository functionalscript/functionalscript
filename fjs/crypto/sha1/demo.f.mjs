/**
 * SHA-1 as you type: the padded hex digest of multiline UTF-8 text.
 * The shared hash output includes a literal OpenSSL command when possible.
 * @module
 */

import { sha1 } from './module.f.mjs'
import { digestOf, hashOutput } from '../hash_demo/module.f.mjs'
import { textDemo } from '../../website/demo/module.f.mjs'

export const digest = digestOf(sha1)

const output = hashOutput({ name: 'SHA-1', hash: sha1, openssl: 'sha1' })

export const demo = textDemo({ name: 'text', label: 'Text', init: '' })(text => [
    ['p', 'SHA-1 collision resistance is broken. Do not use it to verify authenticity or protect against tampering.'],
    ...output(text),
])
