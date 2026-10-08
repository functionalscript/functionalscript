/**
 * Hash demo output: a padded UTF-8 digest and its literal OpenSSL command.
 * SHA-1, SHA-2 and HMAC share formatting, algorithms and shell verification.
 * @module
 * @import { HashDemoAlgorithm } from './types.ts'
 * @import { Hash } from '../../../crypto/sha2/types.ts'
 * @import { Vec } from '../../../types/bit_vec/types.ts'
 * @import { Node, Element } from '../../../media/html/types.ts'
 */

import { computeSync, sha224, sha256, sha384, sha512, sha512x224, sha512x256 } from '../../../crypto/sha2/module.f.mjs'
import { sha1 } from '../../../crypto/sha1/module.f.mjs'
import { uint } from '../../../types/bit_vec/module.f.mjs'
import { utf8 } from '../../../text/module.f.mjs'
import { codeBlock, tryShellQuote } from '../code/module.f.mjs'
import { caption } from '../module.f.mjs'

/** Format a hash's bits as hex, preserving its complete width.
 * @type {(hash: { readonly hashLength: bigint }) => (bits: Vec) => string}
 */
export const hexOf = hash => {
    const digits = Number(hash.hashLength / 4n)
    return bits => uint(bits).toString(16).padStart(digits, '0')
}

/** The hex digest of UTF-8 text, including every leading zero.
 * @type {<S>(hash: Hash<S>) => (text: string) => string}
 */
export const digestOf = hash => {
    const compute = computeSync(hash)
    const hex = hexOf(hash)
    return text => hex(compute([utf8(text)]))
}

/** Shared shell verification; refuse the command if any argument contains NUL.
 * The builder receives the arguments in order, each quoted literally.
 * @type {(args: readonly string[], command: (quoted: readonly string[]) => string) => readonly Node[]}
 */
export const opensslVerification = (args, command) => {
    const quoted = args.flatMap(arg => {
        const q = tryShellQuote(arg)
        return q === null ? [] : [q]
    })
    return quoted.length !== args.length
        ? [['p', 'OpenSSL command unavailable: POSIX shell arguments cannot contain NUL (U+0000).']]
        : [
            caption('Verify independently with OpenSSL:'),
            codeBlock(command(quoted), 'Copy OpenSSL command'),
        ]
}

/** Shared output below the hash demos' text field.
 * @type {<S>(a: HashDemoAlgorithm<S>) => (text: string) => readonly Node[]}
 */
export const hashOutput = ({ name, hash, openssl }) => {
    const digest = digestOf(hash)
    return text => [
        caption(`${name}, hex:`),
        codeBlock(digest(text), 'Copy digest'),
        ...opensslVerification([text], ([quoted]) => `printf '%s' ${quoted} | openssl dgst -${openssl}`),
    ]
}

export const sha1Algorithm = { name: 'SHA-1', hash: sha1, openssl: 'sha1' }

export const sha2Algorithms = [
    { name: 'SHA-224', hash: sha224, openssl: 'sha224' },
    { name: 'SHA-256', hash: sha256, openssl: 'sha256' },
    { name: 'SHA-384', hash: sha384, openssl: 'sha384' },
    { name: 'SHA-512', hash: sha512, openssl: 'sha512' },
    { name: 'SHA-512/224', hash: sha512x224, openssl: 'sha512-224' },
    { name: 'SHA-512/256', hash: sha512x256, openssl: 'sha512-256' },
]

/** Build all seven choices without conflating SHA-1 and SHA-2's state types.
 * @type {<T>(build: <S>(a: HashDemoAlgorithm<S>) => T) => readonly T[]}
 */
export const hashAlgorithms = build => [build(sha1Algorithm), ...sha2Algorithms.map(build)]

/** Look up a choice by name, refusing an unknown selection.
 * @type {<T extends { readonly name: string }>(list: readonly T[]) => (name: string) => T}
 */
export const algorithmOf = list => name => {
    const found = list.find(a => a.name === name)
    if (found === undefined) { throw 'hash demo: no algorithm has this name' }
    return found
}

/** Render a selector option, with the current choice selected.
 * @type {(a: { readonly name: string }, picked: { readonly name: string }) => Element}
 */
export const algorithmOption = (a, picked) =>
    ['option', a.name === picked.name ? { value: a.name, selected: '' } : { value: a.name }, a.name]
