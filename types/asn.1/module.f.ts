import { todo } from "../../dev/module.f.ts"
import { abs, bitLength, mask } from "../bigint/module.f.ts"
import { length, listToVec, msb, msbCmp, uint, unpack, vec, vec8, type Unpacked, type Vec } from "../bit_vec/module.f.ts"

const eoc = 0x00
export const boolean = 0x01
export const integer = 0x02
const bitString = 0x03
export const octetString = 0x04
const null_ = 0x05
export const objectIdentifier = 0x06
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
export const constructedSet = 0x31      // constructed | set

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

// raw

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

// boolean

export const encodeBoolean = (b: boolean): Vec => vec8(b ? 0xFFn : 0x00n)

export const decodeBoolean = (v: Vec): boolean => uint(v) !== 0n

// integer

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

// octet string

export const encodeOctetString = (v: Vec): Vec => v

export const decodeOctetString = (v: Vec): Vec => v

// object identifier

const base128Encode = (uint: bigint): Vec => {
    const len = bitLength(uint)
    if (len <= 7n) {
        return vec8(uint)
    }
    const shift = (len / 7n) * 7n
    const head = uint >> shift
    const tail = uint & mask(shift)
    // TODO: optimize by using a loop instead of recursion
    return concat([vec8(0x80n | head), base128Encode(tail)])
}

const base128Decode = (uint: Vec): readonly[bigint, Vec] => {
    const [first, rest] = pop8(uint)
    const result = first & 0x7Fn
    if (first < 0x80n) {
        return [result, rest]
    }
    // TODO: optimize by using a loop instead of recursion
    const [tail, next] = base128Decode(rest)
    return [(result << 7n) | tail, next]
}

export const encodeObjectIdentifier = (oid: ObjectIdentifier): Vec => {
    const [first, second, ...rest] = oid
    const firstByte = first * 40n + second
    return concat([vec8(firstByte), ...rest.map(base128Encode)])
}

export const decodeObjectIdentifier = (v: Vec): ObjectIdentifier => {
    const [firstByte, rest] = pop8(v)
    const first = firstByte / 40n
    const second = firstByte % 40n
    let result: ObjectIdentifier = [first, second]
    let tail = rest
    while (length(tail) > 0n) {
        const [value, next] = base128Decode(tail)
        result = [...result, value]
        tail = next
    }
    return result
}

// sequence

export const encodeSequence = (...records: Sequence): Vec =>
    concat(records.map(encode))

export const decodeSequence = (v: Vec): Sequence => {
    let result: readonly Record[] = []
    while (length(v) !== 0n) {
        const [record, rest] = decode(v)
        result = [...result, record]
        v = rest
    }
    return result
}

// set

export type Set = Sequence

export const encodeSet = (...records: Sequence): Vec =>
    concat(records.map(encode).toSorted((a, b) => msbCmp(a)(b)))

export const decodeSet: (v: Vec) => Sequence = decodeSequence

// Record

export type ObjectIdentifier = readonly bigint[]

export type Sequence = readonly Record[]

export type Record =
    | readonly[typeof boolean, boolean]
    | readonly[typeof integer, bigint]
    | readonly[typeof octetString, Vec]
    | readonly[typeof objectIdentifier, ObjectIdentifier]
    | readonly[typeof constructedSequence, Sequence]
    | readonly[typeof constructedSet, Set]

// encode

const recordToRaw = ([tag, value]: Record): Vec => {
    switch (tag) {
        case boolean: return encodeBoolean(value)
        case integer: return encodeInteger(value)
        case octetString: return encodeOctetString(value)
        case objectIdentifier: return encodeObjectIdentifier(value)
        case constructedSequence: return encodeSequence(...value)
        case constructedSet: return encodeSet(...value)
        // default: throw `Unsupported tag: ${tag}`
    }
}

export const encode = (record: Record): Vec =>
    encodeRaw([record[0], recordToRaw(record)])

// decode

const rawToRecord = ([tag, value]: Raw): Record => {
    switch (tag) {
        case boolean: return [boolean, decodeBoolean(value)]
        case integer: return [integer, decodeInteger(value)]
        case octetString: return [octetString, decodeOctetString(value)]
        case objectIdentifier: return [objectIdentifier, decodeObjectIdentifier(value)]
        case constructedSequence: return [constructedSequence, decodeSequence(value)]
        case constructedSet: return [constructedSet, decodeSet(value)]
        default: throw `Unsupported tag: ${tag}`
    }
}

export const decode = (v: Vec): readonly[Record, Vec] => {
    const [raw, rest] = decodeRaw(v)
    return [rawToRecord(raw), rest]
}

/*
TimeStampReq ::= SEQUENCE {
    version        INTEGER { v1(1) },               // [x]
    messageImprint MessageImprint,
    reqPolicy      TSAPolicyId OPTIONAL,
    nonce          INTEGER OPTIONAL,                // [X]
    certReq        BOOLEAN DEFAULT FALSE,           // [X]
    extensions     [0] IMPLICIT Extensions OPTIONAL // [X]
}

MessageImprint ::= SEQUENCE {
    hashAlgorithm  AlgorithmIdentifier,
    hashedMessage  OCTET STRING         // [X]
}

TSAPolicyId ::= OBJECT IDENTIFIER // [X]
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

PKIStatus ::= INTEGER {         // [X]
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
    version          CMSVersion,
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
