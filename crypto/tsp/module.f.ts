/**
 * RFC 3161 Time-Stamp Protocol (TSP) – Trusted Timestamps.
 *
 * Encodes `TimeStampReq` and decodes `TimeStampResp` using DER, and provides
 * an effect-based `request` that calls a Timestamp Authority (TSA).
 *
 * ```
 * TimeStampReq ::= SEQUENCE {
 *     version        INTEGER { v1(1) },
 *     messageImprint MessageImprint,
 *     reqPolicy      TSAPolicyId              OPTIONAL,
 *     nonce          INTEGER                  OPTIONAL,
 *     certReq        BOOLEAN                  DEFAULT FALSE,
 *     extensions [0] IMPLICIT Extensions      OPTIONAL
 * }
 *
 * MessageImprint ::= SEQUENCE {
 *     hashAlgorithm  AlgorithmIdentifier,
 *     hashedMessage  OCTET STRING
 * }
 *
 * TimeStampResp ::= SEQUENCE {
 *     status         PKIStatusInfo,
 *     timeStampToken TimeStampToken OPTIONAL
 * }
 *
 * PKIStatusInfo ::= SEQUENCE {
 *     status         PKIStatus,
 *     statusString   PKIFreeText     OPTIONAL,
 *     failInfo       PKIFailureInfo  OPTIONAL
 * }
 *
 * PKIStatus ::= INTEGER {
 *     granted                (0),
 *     grantedWithMods        (1),
 *     rejection              (2),
 *     waiting                (3),
 *     revocationWarning      (4),
 *     revocationNotification (5)
 * }
 * ```
 *
 * See https://www.rfc-editor.org/rfc/rfc3161
 *
 * @module
 */
import {
    boolean,
    constructedSequence,
    decode,
    encode,
    integer,
    objectIdentifier,
    octetString,
    type ObjectIdentifier,
    type Sequence,
} from '../../types/asn.1/module.f.ts'
import { isVec, listToVec, msb, vec8, type Vec } from '../../types/bit_vec/module.f.ts'
import { fetch as fetch_, type Fetch, type IoResult } from '../../types/effect/node/module.f.ts'
import type { Effect } from '../../types/effect/module.f.ts'
import { ok } from '../../types/result/module.f.ts'

const cat = listToVec(msb)

// DER encoding of ASN.1 NULL (tag 0x05, length 0x00)
const asn1Null: Vec = cat([vec8(0x05n), vec8(0x00n)])

// Algorithm OIDs

/** SHA-1 OID: 1.3.14.3.2.26 */
export const sha1Oid: ObjectIdentifier = [1n, 3n, 14n, 3n, 2n, 26n]

/** SHA-256 OID: 2.16.840.1.101.3.4.2.1 */
export const sha256Oid: ObjectIdentifier = [2n, 16n, 840n, 1n, 101n, 3n, 4n, 2n, 1n]

/** SHA-384 OID: 2.16.840.1.101.3.4.2.2 */
export const sha384Oid: ObjectIdentifier = [2n, 16n, 840n, 1n, 101n, 3n, 4n, 2n, 2n]

/** SHA-512 OID: 2.16.840.1.101.3.4.2.3 */
export const sha512Oid: ObjectIdentifier = [2n, 16n, 840n, 1n, 101n, 3n, 4n, 2n, 3n]

/** SHA-224 OID: 2.16.840.1.101.3.4.2.4 */
export const sha224Oid: ObjectIdentifier = [2n, 16n, 840n, 1n, 101n, 3n, 4n, 2n, 4n]

/**
 * Encodes an `AlgorithmIdentifier` SEQUENCE for a given OID.
 *
 * `AlgorithmIdentifier ::= SEQUENCE { algorithm OID, parameters NULL }`
 */
export const algorithmIdentifier = (oid: ObjectIdentifier): Vec =>
    encode([constructedSequence, [
        [objectIdentifier, oid],
        asn1Null,
    ]])

/** Pre-encoded `AlgorithmIdentifier` for SHA-256. */
export const sha256AlgorithmIdentifier: Vec = algorithmIdentifier(sha256Oid)

/** Pre-encoded `AlgorithmIdentifier` for SHA-384. */
export const sha384AlgorithmIdentifier: Vec = algorithmIdentifier(sha384Oid)

/** Pre-encoded `AlgorithmIdentifier` for SHA-512. */
export const sha512AlgorithmIdentifier: Vec = algorithmIdentifier(sha512Oid)

/** Pre-encoded `AlgorithmIdentifier` for SHA-224. */
export const sha224AlgorithmIdentifier: Vec = algorithmIdentifier(sha224Oid)

/**
 * Encodes a DER `TimeStampReq`.
 *
 * `certReq` has DEFAULT FALSE per RFC 3161: it is omitted when `false` and
 * included as `BOOLEAN TRUE` when `true`.
 *
 * @param algId - Pre-encoded `AlgorithmIdentifier` (e.g. `sha256AlgorithmIdentifier`).
 * @param hashedMessage - The hash of the data to be timestamped.
 * @param certReq - Request TSA's signing certificate chain. Default: `true`.
 * @returns DER-encoded `TimeStampReq` as a `Vec`.
 */
export const encodeRequest =
    (algId: Vec) =>
    (hashedMessage: Vec) =>
    (certReq = true): Vec => {
        const base: Sequence = [
            [integer, 1n],
            [constructedSequence, [algId, [octetString, hashedMessage]]],
        ]
        return encode([constructedSequence, certReq ? [...base, [boolean, true]] : base])
    }

/** PKI status codes per RFC 3161 §2.4.2. */
export type PKIStatus =
    | 'granted'
    | 'grantedWithMods'
    | 'rejection'
    | 'waiting'
    | 'revocationWarning'
    | 'revocationNotification'
    | 'unknown'

const pkiStatusFromCode = (code: bigint): PKIStatus => {
    switch (code) {
        case 0n: return 'granted'
        case 1n: return 'grantedWithMods'
        case 2n: return 'rejection'
        case 3n: return 'waiting'
        case 4n: return 'revocationWarning'
        case 5n: return 'revocationNotification'
        default: return 'unknown'
    }
}

/** Decoded `TimeStampResp`. */
export type TimeStampResp = {
    /** The PKI status from `PKIStatusInfo`. */
    readonly status: PKIStatus
    /**
     * The raw DER-encoded `TimeStampToken` (`ContentInfo`), or `null` if the
     * TSA did not return one (e.g. on rejection).
     */
    readonly token: Vec | null
}

/**
 * Decodes a DER-encoded `TimeStampResp`.
 *
 * @param v - Full DER bytes of the `TimeStampResp` (including outer SEQUENCE tag).
 * @returns The decoded response with status and optional token.
 */
export const decodeResponse = (v: Vec): TimeStampResp => {
    const [outer] = decode(v)
    if (isVec(outer) || outer[0] !== constructedSequence) { throw 'expected SEQUENCE' }
    const records: Sequence = outer[1]

    // PKIStatusInfo: SEQUENCE { status INTEGER, ... }
    const statusInfo = records[0]
    if (isVec(statusInfo) || statusInfo[0] !== constructedSequence) { throw 'expected PKIStatusInfo' }
    const statusFields: Sequence = statusInfo[1]

    const statusRecord = statusFields[0]
    if (isVec(statusRecord) || statusRecord[0] !== integer) { throw 'expected status INTEGER' }
    const status = pkiStatusFromCode(statusRecord[1])

    // TimeStampToken is optional (second record in outer SEQUENCE)
    const token = records.length > 1 ? encode(records[1]) : null

    return { status, token }
}

const tspHeaders = {
    'Content-Type': 'application/timestamp-query',
    'Accept': 'application/timestamp-reply',
} as const

/**
 * Sends a `TimeStampReq` to a TSA and decodes the `TimeStampResp` as an effect.
 *
 * @param url - The TSA endpoint URL.
 * @param algId - Pre-encoded `AlgorithmIdentifier`.
 * @param hashedMessage - The hash of the data to timestamp.
 * @param certReq - Request TSA's certificate chain. Default: `true`.
 * @returns An effect that yields `IoResult<TimeStampResp>`.
 *
 * @example
 *
 * ```ts
 * import { computeSync, sha256 } from '../../crypto/sha2/module.f.ts'
 * import { utf8 } from '../../text/module.f.ts'
 *
 * const hash = computeSync(sha256)([utf8('hello')])
 * const effect = request('https://freetsa.org/tsr')(sha256AlgorithmIdentifier)(hash)()
 * // run with: fromIo(io)(effect)
 * ```
 */
export const request =
    (url: string) =>
    (algId: Vec) =>
    (hashedMessage: Vec) =>
    (certReq = true): Effect<Fetch, IoResult<TimeStampResp>> =>
        fetch_({
            url,
            method: 'POST',
            headers: tspHeaders,
            body: encodeRequest(algId)(hashedMessage)(certReq),
        }).map(result => {
            if (result[0] === 'error') { return result }
            return ok(decodeResponse(result[1].body))
        })
