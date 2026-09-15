/**
 * SHA-256 as you type: a text field, and the digest of its UTF-8 bytes.
 *
 * **The digest is shown in hex, and said to be**, because a reader can check
 * it: `printf '%s' hello | sha256sum` prints the same 64 characters, and so
 * does the literal in this module's own proof. An encoding of this
 * repository's own — cBase32, the one the content-addressable store names
 * things by — would have made the demo partly about `basen` and left its
 * output impossible to verify from outside.
 *
 * **It needs no operations.** Hashing is a pure function of the input, so
 * `update` declares `never` and returns its next state through `pureOk`. That
 * is the whole vocabulary a demo needs until one wants a clock or a fetch.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 */

import { computeSync, sha256 } from './module.f.mjs'
import { uint } from '../../types/bit_vec/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'

/** A SHA-256 digest is 256 bits, which is 64 hex digits however small it is. */
const digits = 64

/**
 * The hex digest of a string's UTF-8 bytes.
 *
 * Padded, because the number is what carries the digest and a number has no
 * leading zeros. One digest in sixteen begins with a zero *digit* — four bits,
 * not eight — and would be shown 63 characters long, which still looks like a
 * digest. Each further zero digit costs another character.
 *
 * @type {(text: string) => string}
 */
export const digest = text =>
    uint(computeSync(sha256)([utf8(text)])).toString(16).padStart(digits, '0')

/**
 * The state is the text itself, not the digest: the digest is a function of
 * it, and storing a value the state can already compute is how the two drift
 * apart.
 *
 * @type {Demo<string, DemoEvent>}
 */
export const demo = {
    init: '',
    update: state => event => pureOk(event.kind === 'input' ? event.value : state),
    view: text => ['div',
        ['p',
            ['label', { for: 'text' }, 'Text '],
            ['input', { type: 'text', id: 'text', name: 'text', value: text }],
        ],
        ['p', 'SHA-256, hex:'],
        ['pre', digest(text)],
    ],
}
