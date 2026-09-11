/**
 * SHA-256 as you type: a text field, and the digest of its UTF-8 bytes.
 *
 * The encoding is cBase32, which is what the content-addressable store uses,
 * so what this shows is the name a CAS would give the text rather than a
 * generic hex dump.
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
import { vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'

/**
 * The cBase32 digest of a string's UTF-8 bytes.
 *
 * @type {(text: string) => string}
 */
export const digest = text => vecToCBase32(computeSync(sha256)([utf8(text)]))

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
        ['p', 'SHA-256, cBase32:'],
        ['pre', digest(text)],
    ],
}
