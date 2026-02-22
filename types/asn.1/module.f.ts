import { todo } from "../../dev/module.f.ts"
import { abs, bitLength } from "../bigint/module.f.ts"
import { length, listToVec, msb, unpack, vec, vec8, type Unpacked, type Vec } from "../bit_vec/module.f.ts"
import type { Nullable } from "../nullable/module.f.ts"

const eoc = 0x00
const boolean = 0x01
export const integer = 0x02
const bitString = 0x03
const octetString = 0x04
const null_ = 0x05
const objectIdentifier = 0x06
const objectDescriptor = 0x07
const external = 0x08
const real = 0x09
const enumerated = 0x0A
const embeddedPdv = 0x0B
const utf8string = 0x0C
const relativeOid = 0x0D
const time = 0x0E
const sequence = 0x10
const set = 0x11
const numericString = 0x12
const printableString = 0x13
const t61String = 0x14
const videotexString = 0x15
const ia5String = 0x16
const utcTime = 0x17
const generalizedTime = 0x18
const graphicString = 0x19
const visibleString = 0x1A
const generalString = 0x1B
const universalString = 0x1C
const characterString = 0x1D
const bmpString = 0x1E
const date = 0x1F
const timeOfDay = 0x20
const dateTime = 0x21
const duration = 0x22
const oidIri = 0x23
const relativeOidIri = 0x24

const constructed = 0x20

export const constructedSequence = 0x30 // constructed | sequence

export type Tag = number

const concat = listToVec(msb)

type Round8 = {
    readonly byteLen: bigint
    readonly v: Vec
}

const round8 = ({ length, uint }: Unpacked): Round8 => {
    const byteLen = (length + 7n) >> 3n
    return { byteLen, v: vec(byteLen << 3n)(uint) }
}

const lenEncode = (uint: bigint): Vec => {
    if (uint < 0x80n) {
        return vec8(uint)
    }
    const { byteLen, v } = round8({ length: bitLength(uint), uint })
    return concat([vec8(0x80n | byteLen), v])
}

const pop = msb.popFront

const pop8 = pop(8n)

const lenDecode = (v: Vec): readonly[bigint, Vec] => {
    const [first, v1] = pop8(v)
    const [byteLen, v2] = first < 0x80n ? [first, v1] : pop((first & 0x7Fn) << 3n)(v1)
    return [byteLen << 3n, v2]
}

export type Raw = readonly [Tag, Vec]

export const encodeRaw = ([tag, value]: Raw): Vec => {
    const tag0 = vec8(BigInt(tag))
    const { byteLen, v } = round8(unpack(value))
    return concat([tag0, lenEncode(byteLen), v])
}

export const decodeRaw = (v: Vec): readonly[Raw, Vec] => {
    const [tag, v1] = pop8(v)
    const [len, v2] = lenDecode(v1)
    const [result, next] = pop(len)(v2)
    return [[Number(tag), vec(len)(result)], next]
}

// two's compliment
export const encodeInteger = (uint: bigint): Vec => {
    const offset = uint < 0n ? 1n : 0n
    return round8({ length: bitLength(uint + offset) + 1n, uint }).v
}

export const decodeInteger = (v: Vec): bigint => {
    const { length, uint } = unpack(v)
    const sign = uint >> (length - 1n)
    return sign === 0n ? uint : uint - (1n << length)
}

export const encodeSequence = (...records: readonly Record[]): Vec =>
    encodeRaw([constructedSequence, concat(records.map(encode))])

export const decodeSequence = (v: Vec): readonly Record[] => {
    let result: readonly Record[] = []
    while (true) {
        const len = length(v)
        if (len === 0n) { return result }
        const [record, rest] = decode(v)
        result = [...result, record]
        v = rest
    }
}

export type Record =
    | readonly[typeof integer, bigint]
    | readonly[typeof constructedSequence, readonly Record[]]

const recordToRaw = ([tag, value]: Record): Raw => {
    switch (tag) {
        case integer: return [integer, encodeInteger(value)]
        case constructedSequence: return [constructedSequence, concat(value.map(encode))]
        // default: throw `Unsupported tag: ${tag}`
    }
}

export const encode = (record: Record): Vec =>
    encodeRaw(recordToRaw(record))

const rawToRecord = ([tag, value]: Raw): Record => {
    switch (tag) {
        case integer: return [integer, decodeInteger(value)]
        case constructedSequence: return [constructedSequence, decodeSequence(value)]
        default: throw `Unsupported tag: ${tag}`
    }
}

export const decode = (v: Vec): readonly[Record, Vec] => {
    const [raw, rest] = decodeRaw(v)
    return [rawToRecord(raw), rest]
}

/*
TimeStampReq ::= SEQUENCE {
    version        INTEGER { v1(1) },
    messageImprint MessageImprint,
    reqPolicy      TSAPolicyId OPTIONAL,
    nonce          INTEGER OPTIONAL,
    certReq        BOOLEAN DEFAULT FALSE,
    extensions     [0] IMPLICIT Extensions OPTIONAL
}

MessageImprint ::= SEQUENCE {
    hashAlgorithm  AlgorithmIdentifier,
    hashedMessage  OCTET STRING
}

TSAPolicyId ::= OBJECT IDENTIFIER
*/

/*
TimeStampResp ::= SEQUENCE {
    status          PKIStatusInfo,
    timeStampToken  TimeStampToken OPTIONAL
}

PKIStatusInfo ::= SEQUENCE {
    status        PKIStatus,
    statusString  PKIFreeText OPTIONAL,
    failInfo      PKIFailureInfo OPTIONAL
}

PKIStatus ::= INTEGER {
    granted                (0),
    grantedWithMods        (1),
    rejection              (2),
    waiting                (3),
    revocationWarning      (4),
    revocationNotification (5)
}

TimeStampToken ::= ContentInfo

ContentInfo ::= SEQUENCE {
    contentType ContentType,
    content     [0] EXPLICIT ANY DEFINED BY contentType
}

ContentType ::= OBJECT IDENTIFIER

SignedData ::= SEQUENCE {
    version CMSVersion,
    digestAlgorithms SET OF DigestAlgorithmIdentifier,
    encapContentInfo EncapsulatedContentInfo,
    certificates     [0] IMPLICIT CertificateSet OPTIONAL,
    crls             [1] IMPLICIT RevocationInfoChoices OPTIONAL,
    signerInfos      SET OF SignerInfo
}

EncapsulatedContentInfo ::= SEQUENCE {
    eContentType ContentType,
    eContent     [0] EXPLICIT OCTET STRING OPTIONAL
}

TSTInfo ::= SEQUENCE  {
    version        INTEGER  { v1(1) },
    policy         TSAPolicyId,
    messageImprint MessageImprint,
    serialNumber   INTEGER,
    genTime        GeneralizedTime,
    accuracy       Accuracy OPTIONAL,
    ordering       BOOLEAN DEFAULT FALSE,
    nonce          INTEGER OPTIONAL,
    tsa            [0] GeneralName OPTIONAL,
    extensions     [1] IMPLICIT Extensions OPTIONAL
}

Bits:  8 7   | 6    | 5 4 3 2 1
       Class | P/C  | Tag number
*/
