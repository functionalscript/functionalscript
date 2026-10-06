/**
 * Hash demo output: a padded UTF-8 digest and its literal OpenSSL command.
 * SHA-1 and SHA-2 share the rendering and refuse a shell command for NUL.
 * @module
 * @import { HashDemoAlgorithm } from './types.ts'
 * @import { Hash } from '../sha2/types.ts'
 * @import { Node } from '../../media/html/types.ts'
 */

import { computeSync } from '../sha2/module.f.mjs'
import { uint } from '../../types/bit_vec/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { codeBlock, tryShellQuote } from '../../website/demo/code/module.f.mjs'

/** The hex digest of UTF-8 text, including every leading zero.
 * @type {<S>(hash: Hash<S>) => (text: string) => string}
 */
export const digestOf = hash => {
    const compute = computeSync(hash)
    const digits = Number(hash.hashLength / 4n)
    return text => uint(compute([utf8(text)])).toString(16).padStart(digits, '0')
}

/** Shared output below the hash demos' text field.
 * @type {<S>(a: HashDemoAlgorithm<S>) => (text: string) => readonly Node[]}
 */
export const hashOutput = ({ name, hash, openssl }) => {
    const digest = digestOf(hash)
    return text => {
        const quoted = tryShellQuote(text)
        /** @type {readonly Node[]} */
        const verification = quoted === null
            ? [['p', 'OpenSSL command unavailable: POSIX shell arguments cannot contain NUL (U+0000).']]
            : [
                ['p', 'Verify independently with OpenSSL:'],
                codeBlock(`printf '%s' ${quoted} | openssl dgst -${openssl}`, 'Copy OpenSSL command'),
            ]
        return [
            ['p', `${name}, hex:`],
            codeBlock(digest(text), 'Copy digest'),
            ...verification,
        ]
    }
}
