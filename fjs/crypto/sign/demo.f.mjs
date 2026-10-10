/**
 * RFC 6979 deterministic ECDSA as you type, in two halves. **Sign** takes a
 * named curve, a SHA-2 variant, a private key `x` in hexadecimal and a UTF-8
 * message, and shows the public key `U = xG`, the nonce `k` and the
 * signature `(r, s)`. **Verify** has `r` and `s` fields of its own, checked
 * by `verify` against that public key and message, so a reader can change a
 * digit, or the message, and watch the signature be rejected.
 *
 * **It opens on RFC 6979 A.2.5**, P-256 with SHA-256 over `sample`, with
 * that example's published signature in the Verify fields, so every value on
 * the page can be checked against the RFC. There is no OpenSSL command yet,
 * as the hash demos have: it needs the public key as PEM and the signature
 * as DER (`todo/demo.md`).
 *
 * **Signing and verifying run on every keystroke.** Measured in Node at
 * `a6d572ac`, both together take about 0.15 s on P-256 and 0.5 s on P-521:
 * short enough that a button would only slow the reader down.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Element, Node } from '../../media/html/types.ts'
 * @import { Curve, Point2D } from '../secp/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { DemoCurve, DemoSigned, DemoState } from './types.ts'
 */

import { secp192r1, secp256k1, secp256r1, secp384r1, secp521r1 } from '../secp/module.f.mjs'
import { computeK, fromCurve, sign, verify } from './module.f.mjs'
import { algorithmOf, algorithmOption, sha2Algorithms } from '../../website/demo/hash/module.f.mjs'
import { caption, fieldUpdate, inputField, refusal, textField } from '../../website/demo/module.f.mjs'
import { codeBlock } from '../../website/demo/code/module.f.mjs'
import { resultMarker } from '../../website/style/module.f.mjs'
import { hexDigitsValue } from '../../text/ascii/module.f.mjs'
import { tryUtf8 } from '../../text/module.f.mjs'
import { maxLengthBytes } from '../../types/bit_vec/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'

/** A named curve, bound once.
 * @type {(name: string, curve: Curve) => DemoCurve}
 */
const namedCurve = (name, curve) => ({
    name,
    curve,
    sign: sign(curve),
    verify: verify(curve),
    computeK: computeK(fromCurve(curve).rfc6979),
    q: curve.nf.p,
    scalarDigits: (curve.nf.p - 1n).toString(16).length,
    coordinateDigits: (curve.pf.p - 1n).toString(16).length,
})

const curves = [
    namedCurve('P-192 (secp192r1)', secp192r1),
    namedCurve('P-256 (secp256r1)', secp256r1),
    namedCurve('P-384 (secp384r1)', secp384r1),
    namedCurve('P-521 (secp521r1)', secp521r1),
    namedCurve('secp256k1', secp256k1),
]
const curveOf = algorithmOf(curves)
const hashOf = algorithmOf(sha2Algorithms)

/** `n` in hexadecimal, lower case, padded to `digits`.
 * @type {(digits: number) => (n: bigint) => string}
 */
const hexOf = digits => n => n.toString(16).padStart(digits, '0')

/**
 * A hexadecimal field's value, or the message refusing it. The length is
 * checked first: parsing a long paste into a bigint is itself slow.
 *
 * @type {(name: string, digits: number) => (text: string) => Result<bigint, string>}
 */
export const parseHexField = (name, digits) => text => {
    if (text.length > digits) { return error(`Enter ${name} as at most ${digits} hexadecimal digits.`) }
    const n = hexDigitsValue([...text].map(c => c.charCodeAt(0)))
    return n === null ? error(`Enter ${name} as hexadecimal digits.`) : ok(n)
}

/**
 * What Sign derives from a state: the public key, the nonce and the
 * signature, or the message refusing the key or the message.
 *
 * @type {(state: DemoState) => Result<DemoSigned, string>}
 */
export const signed = state => {
    const c = curveOf(state.curve)
    const hf = hashOf(state.hash).hash
    const key = parseHexField('the private key', c.scalarDigits)(state.key)
    if (key[0] === 'error') { return key }
    const x = key[1]
    if (x === 0n || x >= c.q) { return error('The private key must be at least 1 and less than the curve order q.') }
    const m = tryUtf8(state.message)
    if (m === null) { return error(`The message is too long: more than ${maxLengthBytes} UTF-8 bytes.`) }
    // `x` is in `[1, q-1]` and `G` has order `q`, so `xG` is never infinity.
    const u = /** @type {Point2D} */ (c.curve.mul(x)(c.curve.g))
    const [r, s] = c.sign(hf)(x)(m)
    return ok({ u, m, k: c.computeK(hf)(x)(m), r, s })
}

/** Sign's half: the public key, `k`, and `r` and `s`, each copyable.
 * @type {(c: DemoCurve, result: Result<DemoSigned, string>) => readonly Node[]}
 */
const signView = (c, result) => {
    if (result[0] === 'error') { return [refusal(result[1])] }
    const scalar = hexOf(c.scalarDigits)
    const coordinate = hexOf(c.coordinateDigits)
    const { u: [ux, uy], k, r, s } = result[1]
    return [
        caption('Public key U = xG, hex:'),
        codeBlock(`Ux = ${coordinate(ux)}\nUy = ${coordinate(uy)}`, 'Copy public key'),
        caption('Nonce k, derived from x and the message, hex:'),
        codeBlock(scalar(k), 'Copy k'),
        ['p', 'A one-time secret. Anyone who learns k, or sees one k used for two messages, can compute the private key x; RFC 6979 derives it from x and the message, so it never repeats and needs no random number generator.'],
        caption('Signature r, hex:'),
        codeBlock(scalar(r), 'Copy r'),
        ['p', 'The x coordinate of the point kG, modulo q: it binds the signature to k without revealing k.'],
        caption('Signature s, hex:'),
        codeBlock(scalar(s), 'Copy s'),
        ['p', 's = (h + r·x) / k mod q, where h is the hash of the message. Only the holder of x can make s fit r and this message; Verify checks that fit using U alone.'],
    ]
}

/** Verify's verdict on its own `r` and `s`, against Sign's key and message.
 * Nothing while Sign refuses: there is no public key to verify against.
 * @type {(c: DemoCurve, state: DemoState, result: Result<DemoSigned, string>) => readonly Node[]}
 */
const verdictView = (c, state, result) => {
    if (result[0] === 'error') { return [] }
    const r = parseHexField('r', c.scalarDigits)(state.r)
    if (r[0] === 'error') { return [refusal(r[1])] }
    const s = parseHexField('s', c.scalarDigits)(state.s)
    if (s[0] === 'error') { return [refusal(s[1])] }
    const { u, m } = result[1]
    return c.verify(hashOf(state.hash).hash)(u)(m)([r[1], s[1]])
        ? [['p', { role: 'status', [resultMarker]: 'ok' }, '✓ The signature verifies for this public key and message.']]
        : [['p', { role: 'status', [resultMarker]: 'error' }, '✗ The signature does not verify for this public key and message.']]
}

/** @type {(name: string, label: string, options: readonly { readonly name: string }[], picked: string) => Element} */
const select = (name, label, options, picked) => ['p',
    ['label', { for: name }, label],
    ' ',
    ['select', { id: name, name }, ...options.map(o => algorithmOption(o, { name: picked }))],
]

/** @type {Demo<DemoState, DemoEvent>} */
export const demo = {
    init: {
        curve: 'P-256 (secp256r1)',
        hash: 'SHA-256',
        key: 'c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721',
        message: 'sample',
        r: 'efd48b2aacb6a8fd1140dd9cd45e81d69d2c877b56aaf991c34d0ea84eaf3716',
        s: 'f7cb1c942d657c41d436c7a1b6e29f65f3e900dbb9aff4064dc4ab2f843acda8',
    },
    update: fieldUpdate,
    view: state => {
        const c = curveOf(state.curve)
        const result = signed(state)
        return ['div',
            ['p', 'ECDSA signs a message with a private key x; anyone with the public key U = xG can verify the signature (r, s). RFC 6979 derives the nonce k from x and the message, so the same inputs always give the same signature. The page opens on RFC 6979 A.2.5: compare k, r and s with the RFC, then change one character of the message or of r to see verification fail.'],
            select('curve', 'Curve', curves, state.curve),
            select('hash', 'Hash', sha2Algorithms, state.hash),
            inputField({ name: 'key', label: 'Private key x, hex' }, state.key),
            textField({ name: 'message', label: 'Message (UTF-8)', rows: 3 }, state.message),
            ['section',
                ['h3', 'Sign'],
                ...signView(c, result),
            ],
            ['section',
                ['h3', 'Verify'],
                inputField({ name: 'r', label: 'Signature r, hex' }, state.r),
                inputField({ name: 's', label: 'Signature s, hex' }, state.s),
                ...verdictView(c, state, result),
            ],
        ]
    },
}
