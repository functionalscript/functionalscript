/**
 * Trusted Timestamp module implementing RFC 3161.
 *
 * Provides encoding of `TimeStampReq` and decoding of `TimeStampResp`
 * messages as specified in https://www.rfc-editor.org/rfc/rfc3161
 *
 * @module
 */
import {
    constructedSequence,
    decode,
    decodeRaw,
    encode,
    integer,
    boolean,
    octetString,
    objectIdentifier,
    type ObjectIdentifier,
    type Record,
    type Sequence,
} from '../../types/asn.1/module.f.ts'
import { isVec, type Vec } from '../../types/bit_vec/module.f.ts'
import { utf8ToString } from '../../text/module.f.ts'
import { ok, error, type Result } from '../../types/result/module.f.ts'

// SHA-2 OIDs per RFC 5758

/** SHA-256 algorithm OID: 2.16.840.1.101.3.4.2.1 */
export const sha256Oid: ObjectIdentifier = [2n, 16n, 840n, 1n, 101n, 3n, 4n, 2n, 1n]

/** SHA-384 algorithm OID: 2.16.840.1.101.3.4.2.2 */
export const sha384Oid: ObjectIdentifier = [2n, 16n, 840n, 1n, 101n, 3n, 4n, 2n, 2n]

/** SHA-512 algorithm OID: 2.16.840.1.101.3.4.2.3 */
export const sha512Oid: ObjectIdentifier = [2n, 16n, 840n, 1n, 101n, 3n, 4n, 2n, 3n]

/**
 * PKI status values per RFC 3161 section 2.4.2.
 */
export type PkiStatus =
    | 'granted'
    | 'grantedWithMods'
    | 'rejection'
    | 'waiting'
    | 'revocationWarning'
    | 'revocationNotification'

/**
 * Core fields extracted from a TSTInfo structure.
 *
 * @see https://www.rfc-editor.org/rfc/rfc3161#section-2.4.2
 */
export type TstInfo = {
    readonly version: bigint
    readonly policy: ObjectIdentifier
    readonly messageImprint: {
        readonly hashAlgorithm: ObjectIdentifier
        readonly hashedMessage: Vec
    }
    readonly serialNumber: bigint
    /** GeneralizedTime in the format YYYYMMDDHHMMSSZ */
    readonly genTime: string
    readonly nonce?: bigint
}

/**
 * Decoded TimeStampResp fields.
 *
 * @see https://www.rfc-editor.org/rfc/rfc3161#section-2.4.2
 */
export type TimeStampResp = {
    readonly status: PkiStatus
    readonly tstInfo?: TstInfo
}

type R<T> = Result<T, unknown>

// Type-safe accessors for supported ASN.1 records

const asSequence = (r: Record): R<Sequence> => {
    if (!isVec(r) && r[0] === constructedSequence) { return ok(r[1]) }
    return error(['expected SEQUENCE', r])
}

const asInteger = (r: Record): R<bigint> => {
    if (!isVec(r) && r[0] === integer) { return ok(r[1]) }
    return error(['expected INTEGER', r])
}

const asOid = (r: Record): R<ObjectIdentifier> => {
    if (!isVec(r) && r[0] === objectIdentifier) { return ok(r[1]) }
    return error(['expected OID', r])
}

const asOctetString = (r: Record): R<Vec> => {
    if (!isVec(r) && r[0] === octetString) { return ok(r[1]) }
    return error(['expected OCTET STRING', r])
}

/**
 * Strips an EXPLICIT context tag from an UnsupportedRecord, returning the inner
 * content bytes (the full TLV of the wrapped type).
 */
const stripContextTag = (r: Record): R<Vec> => {
    if (!isVec(r)) { return error(['expected context tag (UnsupportedRecord)', r]) }
    const [[, value]] = decodeRaw(r)
    return ok(value)
}

/**
 * Decodes a GeneralizedTime (tag 0x18) UnsupportedRecord to a string.
 * The format is YYYYMMDDHHMMSSZ (ASCII).
 */
const decodeGeneralizedTime = (r: Record): R<string> => {
    if (!isVec(r)) { return error(['expected GeneralizedTime', r]) }
    const [[, value]] = decodeRaw(r)
    return ok(utf8ToString(value))
}

const decodePkiStatus = (n: bigint): R<PkiStatus> => {
    switch (n) {
        case 0n: return ok('granted' as PkiStatus)
        case 1n: return ok('grantedWithMods' as PkiStatus)
        case 2n: return ok('rejection' as PkiStatus)
        case 3n: return ok('waiting' as PkiStatus)
        case 4n: return ok('revocationWarning' as PkiStatus)
        case 5n: return ok('revocationNotification' as PkiStatus)
        default: return error(`unknown PKIStatus: ${n}`)
    }
}

const parseTstInfo = (seq: Sequence): R<TstInfo> => {
    const versionR = asInteger(seq[0])
    if (versionR[0] === 'error') { return versionR }
    const version = versionR[1]

    const policyR = asOid(seq[1])
    if (policyR[0] === 'error') { return policyR }
    const policy = policyR[1]

    const msgImprintR = asSequence(seq[2])
    if (msgImprintR[0] === 'error') { return msgImprintR }
    const msgImprint = msgImprintR[1]

    const hashAlgoSeqR = asSequence(msgImprint[0])
    if (hashAlgoSeqR[0] === 'error') { return hashAlgoSeqR }
    const hashAlgoSeq = hashAlgoSeqR[1]

    const hashAlgorithmR = asOid(hashAlgoSeq[0])
    if (hashAlgorithmR[0] === 'error') { return hashAlgorithmR }
    const hashAlgorithm = hashAlgorithmR[1]

    const hashedMessageR = asOctetString(msgImprint[1])
    if (hashedMessageR[0] === 'error') { return hashedMessageR }
    const hashedMessage = hashedMessageR[1]

    const serialNumberR = asInteger(seq[3])
    if (serialNumberR[0] === 'error') { return serialNumberR }
    const serialNumber = serialNumberR[1]

    const genTimeR = decodeGeneralizedTime(seq[4])
    if (genTimeR[0] === 'error') { return genTimeR }
    const genTime = genTimeR[1]

    let nonce: bigint | undefined
    for (let i = 5; i < seq.length; i++) {
        const r = seq[i]
        if (!isVec(r) && r[0] === integer) {
            nonce = r[1]
            break
        }
    }

    return ok({
        version,
        policy,
        messageImprint: { hashAlgorithm, hashedMessage },
        serialNumber,
        genTime,
        ...(nonce !== undefined ? { nonce } : {}),
    })
}

/**
 * Encodes a `TimeStampReq` message per RFC 3161.
 *
 * ```
 * TimeStampReq ::= SEQUENCE {
 *     version        INTEGER { v1(1) },
 *     messageImprint MessageImprint,
 *     reqPolicy      TSAPolicyId OPTIONAL,
 *     nonce          INTEGER OPTIONAL,
 *     certReq        BOOLEAN DEFAULT FALSE,
 *     extensions     [0] IMPLICIT Extensions OPTIONAL
 * }
 * MessageImprint ::= SEQUENCE {
 *     hashAlgorithm  AlgorithmIdentifier,
 *     hashedMessage  OCTET STRING
 * }
 * AlgorithmIdentifier ::= SEQUENCE {
 *     algorithm  OBJECT IDENTIFIER
 * }
 * ```
 *
 * @param hashAlgorithm - OID of the hash algorithm used (e.g. `sha256Oid`).
 * @param hashedMessage - The hash of the data to be timestamped.
 * @param options - Optional request parameters.
 * @returns DER-encoded `TimeStampReq`.
 */
export const encodeRequest = (
    hashAlgorithm: ObjectIdentifier,
    hashedMessage: Vec,
    options?: {
        readonly reqPolicy?: ObjectIdentifier
        readonly nonce?: bigint
        /** Include TSA certificate in response when true. */
        readonly certReq?: boolean
    }
): Vec => {
    const algorithmId: Record = [constructedSequence, [
        [objectIdentifier, hashAlgorithm],
    ]]
    const msgImprint: Record = [constructedSequence, [
        algorithmId,
        [octetString, hashedMessage],
    ]]
    const records: Record[] = [
        [integer, 1n],
        msgImprint,
    ]
    if (options?.reqPolicy !== undefined) {
        records.push([objectIdentifier, options.reqPolicy])
    }
    if (options?.nonce !== undefined) {
        records.push([integer, options.nonce])
    }
    if (options?.certReq === true) {
        records.push([boolean, true])
    }
    return encode([constructedSequence, records])
}

/**
 * Decodes a `TimeStampResp` message per RFC 3161.
 *
 * Navigates through `PKIStatusInfo`, `ContentInfo`, `SignedData`,
 * `EncapsulatedContentInfo`, and the inner `TSTInfo` to extract
 * the timestamp fields.
 *
 * ```
 * TimeStampResp ::= SEQUENCE {
 *     status          PKIStatusInfo,
 *     timeStampToken  TimeStampToken OPTIONAL
 * }
 * ```
 *
 * @param v - DER-encoded `TimeStampResp`.
 * @returns Decoded status and optional `TstInfo`, or an error.
 */
export const decodeResponse = (v: Vec): Result<TimeStampResp, unknown> => {
    const [outerRec] = decode(v)
    const outerR = asSequence(outerRec)
    if (outerR[0] === 'error') { return outerR }
    const outer = outerR[1]

    // PKIStatusInfo ::= SEQUENCE { status PKIStatus, ... }
    const pkiStatusSeqR = asSequence(outer[0])
    if (pkiStatusSeqR[0] === 'error') { return pkiStatusSeqR }
    const pkiStatusSeq = pkiStatusSeqR[1]

    const nR = asInteger(pkiStatusSeq[0])
    if (nR[0] === 'error') { return nR }

    const statusR = decodePkiStatus(nR[1])
    if (statusR[0] === 'error') { return statusR }
    const status = statusR[1]

    if (outer.length < 2) { return ok({ status }) }

    // TimeStampToken ::= ContentInfo ::= SEQUENCE {
    //     contentType ContentType,
    //     content     [0] EXPLICIT SignedData
    // }
    const contentInfoR = asSequence(outer[1])
    if (contentInfoR[0] === 'error') { return contentInfoR }
    const contentInfo = contentInfoR[1]

    const signedDataTlvR = stripContextTag(contentInfo[1])
    if (signedDataTlvR[0] === 'error') { return signedDataTlvR }

    // SignedData ::= SEQUENCE {
    //     version          CMSVersion,
    //     digestAlgorithms SET OF ...,
    //     encapContentInfo EncapsulatedContentInfo,
    //     ...
    // }
    const [signedDataRec] = decode(signedDataTlvR[1])
    const signedDataR = asSequence(signedDataRec)
    if (signedDataR[0] === 'error') { return signedDataR }
    const signedData = signedDataR[1]

    // EncapsulatedContentInfo ::= SEQUENCE {
    //     eContentType ContentType,
    //     eContent     [0] EXPLICIT OCTET STRING OPTIONAL
    // }
    const encapContentInfoR = asSequence(signedData[2])
    if (encapContentInfoR[0] === 'error') { return encapContentInfoR }
    const encapContentInfo = encapContentInfoR[1]

    const octetStringTlvR = stripContextTag(encapContentInfo[1])
    if (octetStringTlvR[0] === 'error') { return octetStringTlvR }

    // The OCTET STRING contains the DER-encoded TSTInfo.
    const [osRec] = decode(octetStringTlvR[1])
    const tstInfoDerR = asOctetString(osRec)
    if (tstInfoDerR[0] === 'error') { return tstInfoDerR }

    // TSTInfo ::= SEQUENCE { version, policy, messageImprint, serialNumber, genTime, ... }
    const [tstInfoRec] = decode(tstInfoDerR[1])
    const tstInfoSeqR = asSequence(tstInfoRec)
    if (tstInfoSeqR[0] === 'error') { return tstInfoSeqR }

    const tstInfoR = parseTstInfo(tstInfoSeqR[1])
    if (tstInfoR[0] === 'error') { return tstInfoR }

    return ok({ status, tstInfo: tstInfoR[1] })
}
