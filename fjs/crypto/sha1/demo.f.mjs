/**
 * SHA-1 as you type: the padded hex digest of multiline UTF-8 text.
 * The shared hash output includes a literal OpenSSL command when possible.
 * @module
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 */

import { digestOf, hashOutput, sha1Algorithm } from '../../website/demo/hash/module.f.mjs'
import { textDemo } from '../../website/demo/module.f.mjs'

export const digest = digestOf(sha1Algorithm.hash)

const output = hashOutput(sha1Algorithm)

const text = textDemo({ name: 'text', label: 'Text', init: '' })(output)

/** @type {Demo<string, DemoEvent>} */
export const demo = {
    ...text,
    view: state => ['div',
        ['p', 'SHA-1 hashes UTF-8 text and shows the digest in hexadecimal. SHA-1 collision resistance is broken; do not use it to verify authenticity or protect against tampering.'],
        text.view(state),
    ],
}
