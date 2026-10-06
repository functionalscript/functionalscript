/**
 * SHA-1 as you type: the hex digest of the text's UTF-8 bytes, with a matching
 * OpenSSL command. The digest keeps all 40 hex digits, including leading zeros.
 * Copy controls use the same code blocks and feedback as the SHA-2 demo.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 */

import { sha1 } from './module.f.mjs'
import { computeSync } from '../sha2/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { uint } from '../../types/bit_vec/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { codeBlock, shellQuote } from '../../website/demo/module.f.mjs'

/** @type {(text: string) => string} */
export const digest = text =>
    uint(computeSync(sha1)([utf8(text)])).toString(16).padStart(Number(sha1.hashLength / 4n), '0')

/** @type {Demo<string, DemoEvent>} */
export const demo = {
    init: '',
    update: state => event => pureOk(
        event.kind === 'input' && event.name === 'text' ? event.value : state),
    view: text => ['div',
        ['p',
            ['label', { for: 'text' }, 'Text '],
            ['input', { type: 'text', id: 'text', name: 'text', value: text }],
        ],
        ['p', 'SHA-1, hex:'],
        codeBlock(digest(text), 'Copy digest'),
        ['p', 'Verify independently with OpenSSL:'],
        codeBlock(`printf '%s' ${shellQuote(text)} | openssl dgst -sha1`, 'Copy OpenSSL command'),
    ],
}
