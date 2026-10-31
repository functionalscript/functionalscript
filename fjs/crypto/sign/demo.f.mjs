/**
 * Alice signs, Eve intercepts, and Bob verifies with Alice's trusted public
 * key. Signing updates while typing; Send and Forward deliberately commit
 * public snapshots. Eve's substituted key cannot replace Bob's trusted key.
 *
 * Opens on RFC 6979 A.2.5, P-256/SHA-256 over `sample`. The nonce is an
 * advanced local signing detail, never part of a packet. All verdicts use
 * real ECDSA verification; no private key is sent to Eve or Bob.
 *
 * @module
 *
 * @import { RequiredMap } from '../../types/object/types.ts'
 * @import { Sharing } from '../../website/demo/sharing/types.ts'
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Element, Node } from '../../media/html/types.ts'
 * @import { Curve, Point2D } from '../secp/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { DemoCurve, DemoSigned, DemoState, DemoDraft, DemoPacket, DemoIntercepted, DemoAttack, DemoReceived, DemoNonceReuse } from './types.ts'
 */

import { secp192r1, secp256k1, secp256r1, secp384r1, secp521r1 } from '../secp/module.f.js'
import { computeK, fromCurve, sign, verify } from './module.f.mjs'
import { algorithmOf, algorithmOption, opensslVerification, sha2Algorithms } from '../../website/demo/hash/module.f.mjs'
import { button, selectField, caption, inputField, refusal, textField } from '../../website/demo/module.f.mjs'
import { codeBlock } from '../../website/demo/code/module.f.js'
import {
    resultMarker,
    signCardMarker,
    signExplanationMarker,
    signFlowMarker,
    signPacketMarker,
    signRoleMarker,
    signSchemeMarker,
    signStageMarker,
    signStageHeaderMarker,
    signTrustMarker,
    signTrustKeyMarker,
    signTrustPathMarker,
    signVerifierMarker,
} from '../../website/style/module.f.js'
import { codePoints, hexDigitsValue } from '../../text/ascii/module.f.js'
import { tryUtf8 } from '../../text/module.f.mjs'
import { encode, encodeRaw, constructedSequence, integer, objectIdentifier } from '../../asn.1/module.f.mjs'
import { encode as base64 } from '../../basen/base64/module.f.mjs'
import { msb, vec, vec8 } from '../../types/bit_vec/module.f.mjs'
import { reuse } from './nonce_reuse/module.f.mjs'
import { sha256 } from '../sha2/module.f.mjs'
import { maxLengthBytes } from '../../types/bit_vec/module.f.mjs'
import { error, ok } from '../../types/result/module.f.js'
import { pureOk } from '../../effects/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.js'
import { encodeScalar } from '../../basen/base16/module.f.mjs'

const { listToVec } = msb

/** A named curve, bound once.
 * @type {(name: string, curve: Curve, oid: readonly bigint[]) => DemoCurve}
 */
const namedCurve = (name, curve, oid) => ({
    oid,
    name,
    curve,
    sign: sign(curve),
    verify: verify(curve),
    computeK: computeK(fromCurve(curve).rfc6979),
    q: curve.nf.p,
    scalarDigits: (curve.nf.p - 1n).toString(16).length,
    coordinateDigits: (curve.pf.p - 1n).toString(16).length,
})

/** @type {readonly DemoCurve[]} */
const curves = [
    namedCurve('P-192 (secp192r1)', secp192r1, [1n, 2n, 840n, 10045n, 3n, 1n, 1n]),
    namedCurve('P-256 (secp256r1)', secp256r1, [1n, 2n, 840n, 10045n, 3n, 1n, 7n]),
    namedCurve('P-384 (secp384r1)', secp384r1, [1n, 3n, 132n, 0n, 34n]),
    namedCurve('P-521 (secp521r1)', secp521r1, [1n, 3n, 132n, 0n, 35n]),
    namedCurve('secp256k1', secp256k1, [1n, 3n, 132n, 0n, 10n]),
]
const curveOf = algorithmOf(curves)
const hashOf = algorithmOf(sha2Algorithms)

/**
 * A hexadecimal field's value, or the message refusing it. The length is
 * checked first: parsing a long paste into a bigint is itself slow.
 *
 * @type {(name: string, digits: number) => (text: string) => Result<bigint, string>}
 */
export const parseHexField = (name, digits) => text => {
    if (text.length > digits) { return error(`Enter ${name} as at most ${digits} hexadecimal digits.`) }
    const n = hexDigitsValue(codePoints(text))
    return n === null ? error(`Enter ${name} as hexadecimal digits.`) : ok(n)
}

/**
 * What Sign derives from a state: the public key, the nonce and the
 * signature, or the message refusing the key or the message.
 *
 * @type {(state: DemoDraft) => Result<DemoSigned, string>}
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
    const u = assertNotNullish(c.curve.mul(x)(c.curve.g), 'xG === null')
    const [r, s] = c.sign(hf)(x)(m)
    return ok({ u, m, k: c.computeK(hf)(x)(m), r, s })
}

/** Start an attack from the intercepted packet, never from previous edits.
 * @type {(original: DemoPacket, attack: DemoAttack) => DemoIntercepted}
 */
const intercepted = (original, attack) => {
    const scalar = encodeScalar(curveOf(original.curve).scalarDigits)
    return { original, attack, message: original.message, r: scalar(original.r), s: scalar(original.s), key: '2' }
}

/** Eve's outgoing public packet, or a refusal for unfinished inputs.
 * Zero/out-of-range signature scalars remain transmissible: Bob's real
 * verifier rejects them and explains their range. Malformed hex is refused.
 * @type {(eve: DemoIntercepted) => Result<DemoPacket, string>}
 */
export const outgoing = eve => {
    const { original, attack, message, key } = eve
    if (attack === 'Replace public key') {
        const result = signed({ curve: original.curve, hash: original.hash, message, key })
        if (result[0] === 'error') { return result }
        const { u, r, s } = result[1]
        return ok({ ...original, message, u, r, s })
    }
    if (attack === 'Modify message') {
        if (tryUtf8(message) === null) { return error(`The message is too long: more than ${maxLengthBytes} UTF-8 bytes.`) }
        return ok({ ...original, message })
    }
    const c = curveOf(original.curve)
    const r = parseHexField('r', c.scalarDigits)(eve.r)
    if (r[0] === 'error') { return r }
    const s = parseHexField('s', c.scalarDigits)(eve.s)
    if (s[0] === 'error') { return s }
    return ok({ ...original, r: r[1], s: s[1] })
}

/** Verify exactly the delivered public snapshot, with the intercepted
 * exchange's original trusted key. The packet's UTF-8 must have passed
 * `outgoing`; its scalars need not be valid signatures.
 * @type {(packet: DemoPacket, eve: DemoIntercepted) => DemoReceived}
 */
export const received = (packet, eve) => {
    const c = curveOf(packet.curve)
    const m = assertNotNullish(tryUtf8(packet.message), 'delivered message is too long')
    const verifyMessage = c.verify(hashOf(packet.hash).hash)
    return {
        packet,
        trusted: eve.original.u,
        attack: eve.attack,
        valid: verifyMessage(eve.original.u)(m)([packet.r, packet.s]),
        receivedValid: eve.attack === 'Replace public key' ? verifyMessage(packet.u)(m)([packet.r, packet.s]) : null,
    }
}

/** @type {readonly { readonly name: DemoAttack }[]} */
const attacks = [
    { name: 'Modify message' },
    { name: 'Modify signature' },
    { name: 'Replace public key' },
]

/** Only Alice's named controls can change her private draft.
 * @type {(state: DemoState, name: string, value: string) => DemoState}
 */
const aliceInput = (state, name, value) =>
    name === 'curve' ? { ...state, curve: value }
        : name === 'hash' ? { ...state, hash: value }
            : name === 'key' ? { ...state, key: value }
                : name === 'message' ? { ...state, message: value } : state

/** Immutable events: only Send touches Eve's original and only Forward Bob.
 * @type {Demo<DemoState, DemoEvent>['update']}
 */
const update = state => event => {
    if (event.kind === 'input') {
        if (event.name === 'reuse-key') { return pureOk({ ...state, reuse: { ...state.reuse, key: event.value } }) }
        if (event.name === 'reuse-nonce') { return pureOk({ ...state, reuse: { ...state.reuse, nonce: event.value } }) }
        if (event.name === 'reuse-message1') { return pureOk({ ...state, reuse: { ...state.reuse, message1: event.value } }) }
        if (event.name === 'reuse-message2') { return pureOk({ ...state, reuse: { ...state.reuse, message2: event.value } }) }
        const eve = state.eve
        if (eve !== null) {
            if (event.name === 'attack') {
                const attack = attacks.find(a => a.name === event.value)
                return pureOk(attack === undefined ? state : { ...state, eve: intercepted(eve.original, attack.name) })
            }
            if (event.name === 'eve-message') { return pureOk({ ...state, eve: { ...eve, message: event.value } }) }
            if (event.name === 'eve-r') { return pureOk({ ...state, eve: { ...eve, r: event.value } }) }
            if (event.name === 'eve-s') { return pureOk({ ...state, eve: { ...eve, s: event.value } }) }
            if (event.name === 'eve-key') { return pureOk({ ...state, eve: { ...eve, key: event.value } }) }
        }
        return pureOk(aliceInput(state, event.name, event.value))
    }
    if (event.kind !== 'click') { return pureOk(state) }
    if (event.name === 'send') {
        const result = signed(state)
        if (result[0] === 'error') { return pureOk(state) }
        const { u, r, s } = result[1]
        const original = { curve: state.curve, hash: state.hash, message: state.message, u, r, s }
        return pureOk({ ...state, eve: intercepted(original, 'Modify message') })
    }
    const eve = state.eve
    if (eve === null) { return pureOk(state) }
    if (event.name === 'reset-eve') { return pureOk({ ...state, eve: intercepted(eve.original, 'Modify message') }) }
    if (event.name === 'example') {
        return pureOk({ ...state, eve: eve.attack === 'Modify signature'
            ? { ...eve, r: '0' }
            : { ...eve, message: `${eve.original.message}\nEve changed this message.` } })
    }
    if (event.name === 'forward') {
        const packet = outgoing(eve)
        return pureOk(packet[0] === 'error' ? state : { ...state, bob: received(packet[1], eve) })
    }
    return pureOk(state)
}

/** @type {(name: string, label: string, options: readonly { readonly name: string }[], picked: string) => Element} */
const select = (name, label, options, picked) =>
    selectField({ name, label }, options.map(o => algorithmOption(o, { name: picked })))

/** @type {(text: string) => Element} */
const paragraph = text => ['p', text]

/** @type {(valid: boolean, text: string) => Element} */
const verdict = (valid, text) => ['p', { role: 'status', [resultMarker]: valid ? 'ok' : 'error' }, text]

/** @type {(c: DemoCurve, u: Point2D, label: string) => readonly Node[]} */
const publicKeyView = (c, [ux, uy], label) => {
    const coordinate = encodeScalar(c.coordinateDigits)
    return [
        caption(`${label}, hex:`),
        codeBlock(`Ux = ${coordinate(ux)}\nUy = ${coordinate(uy)}`, `Copy ${label}`),
    ]
}

/** @type {(c: DemoCurve, r: bigint, s: bigint) => readonly Node[]} */
const signatureView = (c, r, s) => {
    const scalar = encodeScalar(c.scalarDigits)
    return [
        caption('Signature r, hex:'), codeBlock(scalar(r), 'Copy r'),
        caption('Signature s, hex:'), codeBlock(scalar(s), 'Copy s'),
    ]
}

/** Copyable public outputs; keep the local nonce in secondary details.
 * @type {(c: DemoCurve, result: Result<DemoSigned, string>) => readonly Node[]}
 */
const signView = (c, result) => {
    if (result[0] === 'error') { return [refusal(result[1])] }
    const { u, k, r, s } = result[1]
    return [
        ...publicKeyView(c, u, 'Public key U = xG'),
        ...signatureView(c, r, s),
        ['details',
            ['summary', 'Signing details — RFC 6979'],
            ['p', 'Message → Hash → ECDSA Sign → (r, s). The page opens on RFC 6979 A.2.5: P-256, SHA-256 and the message sample. Compare these hexadecimal values with the published example.'],
            caption('Deterministic nonce k, hex (never transmitted):'),
            codeBlock(encodeScalar(c.scalarDigits)(k), 'Copy k'),
            ['p', 'Keep k secret: knowing it reveals the private key. RFC 6979 derives k from the private key and message.'],
            ['p', 'r is the x coordinate of kG modulo q; s = (h + r·x) / k mod q. Bob checks this relation with the public key alone.'],
        ],
    ]
}

/** @type {(eve: DemoIntercepted | null) => readonly Node[]} */
const eveView = eve => {
    if (eve === null) { return [['p', 'Waiting for Alice to send a message…'], button('forward', 'Forward to Bob', true)] }
    const c = curveOf(eve.original.curve)
    const packet = outgoing(eve)
    return [
        ['p', `Intercepted ${eve.original.curve} / ${eve.original.hash}. Alice's private key and nonce were never sent.`],
        ...publicKeyView(c, eve.original.u, 'Intercepted Alice public key'),
        select('attack', 'Attack', attacks, eve.attack),
        ...(eve.attack === 'Modify signature' ? [
            caption('Original intercepted message:'), codeBlock(eve.original.message, 'Copy intercepted message'),
            inputField({ name: 'eve-r', label: 'Intercepted signature r, hex' }, eve.r),
            inputField({ name: 'eve-s', label: 'Intercepted signature s, hex' }, eve.s),
        ] : [
            textField({ name: 'eve-message', label: 'Intercepted message (UTF-8)', rows: 3 }, eve.message),
            ...(eve.attack === 'Replace public key' ? [
                paragraph('Eve signs her message with an independent demo-only key and claims to be Alice. A valid signature under this received key does not establish Alice’s identity.'),
                inputField({ name: 'eve-key', label: 'Eve demo-only private key, hex' }, eve.key),
            ] : [paragraph('Alice’s original signature is retained. Forward unchanged to see a valid exchange, or modify the message to test tampering.')]),
        ]),
        ['p', button('example', eve.attack === 'Modify signature' ? 'Set r to zero' : 'Use Eve’s example message', false), ' ', button('reset-eve', 'Reset Eve', false)],
        ...(packet[0] === 'error' ? [refusal(packet[1])] : [
            ...(eve.attack === 'Replace public key' ? publicKeyView(c, packet[1].u, 'Outgoing Eve public key') : []),
            ...signatureView(c, packet[1].r, packet[1].s),
        ]),
        button('forward', 'Forward to Bob', packet[0] === 'error'),
    ]
}

const zeroUnusedBits = vec8(0n)
const uncompressedPointMarker = vec8(0x04n)

/** DER SubjectPublicKeyInfo, with an uncompressed SEC 1 point. Each
 * coordinate occupies the field width, including leading zero octets.
 * @type {(c: DemoCurve, key: Point2D) => string}
 */
const publicKeyPem = ({ coordinateDigits, oid }, [x, y]) => {
    const coordinate = vec(BigInt(Math.ceil(coordinateDigits / 2)) * 8n)
    // BIT STRING: zero unused bits, then the uncompressed-point marker.
    const point = encodeRaw([0x03n, listToVec([zeroUnusedBits, uncompressedPointMarker, coordinate(x), coordinate(y)])])
    const spki = encode([constructedSequence, [
        [constructedSequence, [
            [objectIdentifier, [1n, 2n, 840n, 10045n, 2n, 1n]],
            [objectIdentifier, oid],
        ]],
        point,
    ]])
    const text = assertNotNullish(base64(spki), 'SPKI is not whole bytes')
    let pem = '-----BEGIN PUBLIC KEY-----\n'
    for (let i = 0; i < text.length; i += 64) { pem += `${text.slice(i, i + 64)}\n` }
    return `${pem}-----END PUBLIC KEY-----\n`
}

/** A literal Bash command over Bob's delivered snapshot and trusted key.
 * @type {(bob: DemoReceived) => readonly Node[]}
 */
const opensslCheck = ({ packet, trusted }) => {
    const { curve, hash, message, r, s } = packet
    const signature = encode([constructedSequence, [[integer, r], [integer, s]]])
    return [
        paragraph('Run in Bash with OpenSSL. This checks the received packet against Alice’s saved trusted public key. Expect Verified OK or a verification failure matching Bob’s verdict.'),
        ...opensslVerification([
            message,
            publicKeyPem(curveOf(curve), trusted),
            assertNotNullish(base64(signature), 'signature is not whole bytes'),
        ], ([m, key, sig]) => `printf '%s' ${m} | openssl dgst -${hashOf(hash).openssl} -verify <(printf '%s' ${key}) -signature <(printf '%s' ${sig} | openssl base64 -d -A)`),
    ]
}

/** Bob renders only his last delivered snapshot and its stored verdicts.
 * @type {(bob: DemoReceived | null) => readonly Node[]}
 */
const bobView = bob => {
    if (bob === null) { return [['p', 'Waiting for a message…']] }
    const { packet, trusted, valid, receivedValid } = bob
    const c = curveOf(packet.curve)
    return [
        ['p', `Last received message — ${packet.curve} / ${packet.hash}. Verification ran on delivery.`],
        caption('Received message:'), codeBlock(packet.message, 'Copy received message'),
        ...signatureView(c, packet.r, packet.s),
        ...publicKeyView(c, packet.u, 'Received public key'),
        ...publicKeyView(c, trusted, 'Alice’s trusted public key'),
        verdict(valid, valid
            ? 'Valid — authenticated as Alice under her trusted public key.'
            : 'Invalid — this packet does not authenticate as Alice under her trusted public key.'),
        ...(packet.r === 0n || packet.s === 0n || packet.r >= c.q || packet.s >= c.q
            ? [refusal('Signature r and s must be at least 1 and less than the curve order q.')] : []),
        ...opensslCheck(bob),
        ...(receivedValid === null ? [] : [
            verdict(receivedValid, receivedValid
                ? 'Valid under the received key — mathematical validity alone does not authenticate the sender.'
                : 'Invalid under the received key.'),
            ...(!valid && receivedValid ? [paragraph('Identity mismatch: Eve’s substituted key verifies her signature, but Alice’s trusted key rejects it.')] : []),
        ]),
    ]
}

/** Decorative, theme-aware line icons; the diagram's text supplies meaning.
 * @type {(path: string) => Element}
 */
const schemeIcon = path => ['svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, ['path', { d: path }]]

const schemeArrow = schemeIcon('M2 12h20m-7-7 7 7-7 7')
const schemeKey = schemeIcon('M14 3a7 7 0 1 1-5 12L2 22v-5l7-7a7 7 0 0 1 5-7Zm3 4h.01')

/** The packet route and prior trust are separate: neither forwards a secret
 * nor promises a successful verification. Send models establishing trust.
 * @type {Element}
 */
const exchangeScheme = ['figure', { [signSchemeMarker]: '', 'aria-label': 'ECDSA message exchange and trusted public key' },
    ['div', { [signFlowMarker]: '' },
        ['div', { [signCardMarker]: 'alice' },
            ['h4', 'Alice'], ['strong', 'Sign message'],
            schemeIcon('M14 2H4v20h16V8l-6-6Zm0 0v6h6M8 12h8M8 16h5'),
            ['small', 'Private key stays with Alice'],
        ],
        ['div', { [signPacketMarker]: '' }, ['small', 'Message + signature + public key'], schemeArrow],
        ['div', { [signCardMarker]: 'eve' },
            ['h4', 'Eve'], ['strong', 'Intercept or tamper'],
            schemeIcon('m16 3 5 5-12 12-7 2 2-7L16 3Zm-2 2 5 5M4 15l5 5'),
            ['small', 'Edit message / signature'], ['small', 'Swap public key'],
        ],
        ['div', { [signPacketMarker]: '' }, ['small', 'Outgoing packet'], schemeArrow],
        ['div', { [signVerifierMarker]: '' },
            ['div', { [signCardMarker]: 'bob' },
                ['h4', 'Bob'], ['strong', 'Verify signature'],
                schemeIcon('m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Zm0 5v6m0 4h.01'),
                ['small', 'Use Alice’s trusted public key'],
            ],
            ['p', { [signExplanationMarker]: '' }, 'Bob checks with Alice’s trusted key. A signature that passes only with a substituted key does not prove Alice sent it.'],
        ],
    ],
    ['div', { [signTrustMarker]: '' },
        ['div', { [signTrustKeyMarker]: '' }, schemeKey, ['strong', 'Alice’s public key']],
        ['div', { [signTrustPathMarker]: '' }, ['small', 'Already trusted by Bob'], schemeArrow],
        ['div', { [signTrustKeyMarker]: '' }, schemeKey, ['strong', 'Bob’s trusted Alice key']],
    ],
    ['figcaption', 'The separate key path represents trust in Alice’s public key, not a packet sent through Eve. This demo establishes that trusted key when Alice clicks Send.'],
]

/** @type {(title: string, role: string) => Element} */
const stageHeader = (title, role) => ['header', { [signStageHeaderMarker]: '' }, ['h3', title], ['span', { [signRoleMarker]: '' }, role]]

const reuseP256 = reuse(secp256r1)(sha256)
const nonceScalar = encodeScalar(64)
const parseDemoKey = parseHexField('the demo private key', 64)
const parseSharedNonce = parseHexField('the shared nonce', 64)

/** Validate the independent nonce experiment before signing.
 * @type {(draft: DemoNonceReuse) => ReturnType<typeof reuseP256>}
 */
export const nonceReuse = ({ key: keyText, nonce: nonceText, message1, message2 }) => {
    const [keyTag, key] = parseDemoKey(keyText)
    if (keyTag === 'error') { return error(key) }
    const [nonceTag, nonce] = parseSharedNonce(nonceText)
    if (nonceTag === 'error') { return error(nonce) }
    const first = tryUtf8(message1)
    const second = tryUtf8(message2)
    if (first === null || second === null) { return error(`Each message must be at most ${maxLengthBytes} UTF-8 bytes.`) }
    return reuseP256(key, nonce, [first, second])
}

/** Public signature scalars remain visible when equal hashes prevent recovery.
 * @type {(result: ReturnType<typeof nonceReuse>) => readonly Node[]}
 */
const nonceReuseOutput = result => {
    const [tag, value] = result
    if (tag === 'error') { return [refusal(value)] }
    const { q, key, signatures, recovered } = value
    const [recoveredTag, recoveredValue] = recovered
    return [
        caption('Curve order q, hex:'), codeBlock(nonceScalar(q), 'Copy nonce reuse curve order'),
        ...signatures.flatMap(({ h, r, s }, i) => [
            caption(`Message ${i + 1}: h = bits2int(SHA-256(message)) mod q. Values in hex:`),
            codeBlock(`h = ${nonceScalar(h)}\nr = ${nonceScalar(r)}\ns = ${nonceScalar(s)}`, `Copy message ${i + 1} signature`),
        ]),
        ...(recoveredTag === 'error' ? [refusal(recoveredValue)] : [
            caption('Recovered private key x, hex:'),
            codeBlock(nonceScalar(recoveredValue), 'Copy recovered private key'),
            paragraph(`Matches original demo private key: ${recoveredValue === key}.`),
        ]),
    ]
}

/** An interactive, deliberately broken signer, separate from Alice's exchange.
 * @type {(draft: DemoNonceReuse) => Element}
 */
const nonceReuseView = draft => {
    const { key, nonce, message1, message2 } = draft
    return ['section',
        ['h3', 'Why nonce reuse reveals the private key'],
        paragraph('Experiment with two messages signed using one shared nonce. P-256 / SHA-256 stays fixed in this section. Change any input to recalculate both signatures and recover the private key from their public scalars.'),
        inputField({ name: 'reuse-key', label: 'Demo-only private key x, hex' }, key),
        inputField({ name: 'reuse-nonce', label: 'Shared nonce k for both messages, hex' }, nonce),
        textField({ name: 'reuse-message1', label: 'Message 1 (UTF-8)', rows: 2 }, message1),
        textField({ name: 'reuse-message2', label: 'Message 2 (UTF-8)', rows: 2 }, message2),
        paragraph('The same k gives the same r. From s₁k = h₁ + rx and s₂k = h₂ + rx, eliminate k to recover x using only the two signatures and message hashes. All scalar arithmetic is modulo q.'),
        codeBlock('x = (s1·h2 − s2·h1) / (r·(s2 − s1)) mod q', 'Copy key recovery formula'),
        ...nonceReuseOutput(nonceReuse(draft)),
        paragraph('Recovery needs distinct hashes modulo q and a nonzero denominator. Try making both messages identical to see why repeating one signature does not provide two independent equations.'),
        paragraph('Keep k secret and never reuse it across different message hashes. Alice’s signer above uses RFC 6979 to derive k from the private key and message; signing the same message again deterministically is safe.'),
    ]
}

/** @type {DemoState} */
const initial = {
    curve: 'P-256 (secp256r1)',
    hash: 'SHA-256',
    key: 'c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721',
    message: 'sample',
    eve: null,
    bob: null,
    reuse: { key: '12345678', nonce: '7', message1: 'sample', message2: 'test' },
}

/** @type {Sharing<DemoState>} */
const sharing = {
    fields: {
        curve: { default: initial.curve, choices: curves.map(c => c.name) },
        hash: { default: initial.hash, choices: sha2Algorithms.map(a => a.name) },
        key: { default: initial.key }, message: { default: initial.message },
        'reuse-key': { default: initial.reuse.key }, 'reuse-nonce': { default: initial.reuse.nonce },
        'reuse-message1': { default: initial.reuse.message1 }, 'reuse-message2': { default: initial.reuse.message2 },
    },
    examples: [],
    read: state => ({ curve: state.curve, hash: state.hash, key: state.key, message: state.message,
        'reuse-key': state.reuse.key, 'reuse-nonce': state.reuse.nonce,
        'reuse-message1': state.reuse.message1, 'reuse-message2': state.reuse.message2 }),
    restore: inputs => {
        // The restore boundary receives these finite, validated fields.
        const values = /** @type {RequiredMap<'curve' | 'hash' | 'key' | 'message' | 'reuse-key' | 'reuse-nonce' | 'reuse-message1' | 'reuse-message2', string>} */ (inputs)
        return { ...initial, curve: values.curve, hash: values.hash, key: values.key, message: values.message,
            reuse: { key: values['reuse-key'], nonce: values['reuse-nonce'], message1: values['reuse-message1'], message2: values['reuse-message2'] } }
    },
}

/** @type {Demo<DemoState, DemoEvent>} */
export const demo = {
    init: initial,
    sharing,
    update,
    view: state => {
        const result = signed(state)
        return ['div',
            ['p', 'ECDSA signs a message with a private key and verifies it with a public key. Follow Alice → Eve → Bob to see why signature validity and sender identity are different. The initial signing values reproduce RFC 6979 A.2.5.'],
            ['p', 'Alice (sign) → Eve (intercept or tamper) → Bob (verify with Alice’s trusted public key)'],
            exchangeScheme,
            ['section', { [signStageMarker]: 'alice' },
                stageHeader('Alice — Sign', 'Signer'),
                ['p', 'Demo-only keys. Do not enter real private keys into this public website.'],
                select('curve', 'Curve', curves, state.curve),
                select('hash', 'Hash', sha2Algorithms, state.hash),
                inputField({ name: 'key', label: 'Alice demo-only private key x, hex' }, state.key),
                textField({ name: 'message', label: 'Message (UTF-8)', rows: 3 }, state.message),
                ...signView(curveOf(state.curve), result),
                button('send', 'Send message', result[0] === 'error'),
            ],
            ['section', { [signStageMarker]: 'eve' }, stageHeader('Eve — Intercept & Attack', 'Interceptor'), ...eveView(state.eve)],
            ['section', { [signStageMarker]: 'bob' }, stageHeader('Bob — Receive & Verify', 'Verifier'), ...bobView(state.bob)],
            nonceReuseView(state.reuse),
        ]
    },
}
