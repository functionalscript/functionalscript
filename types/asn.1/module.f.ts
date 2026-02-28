import { bitLength } from "../bigint/module.f.ts"
import { isVec, length, listToVec, msb, msbCmp, uint, unpack, vec, vec8, type Unpacked, type Vec } from "../bit_vec/module.f.ts"
import { identity } from "../function/module.f.ts"
import { encode as b128encode, decode as b128decode } from "../base128/module.f.ts"

const pop = msb.popFront

const pop8 = pop(8n)

// tag

type Class = 0n | 1n | 2n | 3n

type Pc = 0n | 1n

/** ASN.1 tag number. */
export type Tag = bigint

type ParsedTag = {
    class: Class
    pc: Pc
    number: bigint
}

const isLowTag = (tag: Tag): boolean => (tag & 0x1Fn) !== 0x1Fn

const highTag = (n: bigint): Tag => ((n - 0x1Fn) << 8n) | 0x1Fn

const highTagNumber = (tag: Tag): bigint => (tag >> 8n) + 0x1Fn

const tag = ({class: c, pc, number: n }: ParsedTag) =>
    (c << 6n) |
    (pc << 5n) |
    (n < 0x20n ? n : highTag(n))

const parseTag = (tag: bigint): ParsedTag => ({
    class: ((tag >> 6n) & 0x3n) as Class,
    pc: ((tag >> 5n) & 0x1n) as Pc,
    number: isLowTag(tag) ? tag & 0x1Fn : highTagNumber(tag)
})

const tagEncode = (tag: Tag): Vec => {
    const first = vec8(tag)
    return isLowTag(tag) ? first : concat([first, b128encode(highTagNumber(tag))])
}

const tagDecode = (v: Vec): readonly[Tag, Vec] => {
    const [first, rest] = pop8(v)
    if (isLowTag(first)) {
        return [first, rest]
    }
    const [n, next] = b128decode(rest)
    return [highTag(n) | (first & 0xE0n), next]
}

//

const eoc = 0x00n
/** ASN.1 universal BOOLEAN tag. */
export const boolean = 0x01n
/** ASN.1 universal INTEGER tag. */
export const integer = 0x02n
const bitString = 0x03n
/** ASN.1 universal OCTET STRING tag. */
export const octetString = 0x04n
const null_ = 0x05
/** ASN.1 universal OBJECT IDENTIFIER tag. */
export const objectIdentifier = 0x06n
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

export const constructedSequence = 0x30n // constructed | sequence
export const constructedSet = 0x31n      // constructed | set

//

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

const lenDecode = (v: Vec): readonly[bigint, Vec] => {
    const first1 = pop8(v)
    const [first, v1] = first1
    const [byteLen, v2] = first < 0x80n ? first1 : pop((first & 0x7Fn) << 3n)(v1)
    return [byteLen << 3n, v2]
}

// raw

/** Raw ASN.1 TLV tuple. */
export type Raw = readonly [Tag, Vec]

/** Encodes a raw ASN.1 TLV tuple into a bit vector. */
export const encodeRaw = ([tag, value]: Raw): Vec => {
    const tagVec = tagEncode(tag)
    const { byteLen, v } = round8(unpack(value))
    return concat([tagVec, lenEncode(byteLen), v])
}

// TODO: Parse multibyte tags:
//       Check if `tag & 0x1F === 0x1F` and use base128 encoding for the tag number.
/** Decodes a raw ASN.1 TLV tuple and returns the remaining input. */
export const decodeRaw = (v: Vec): readonly[Raw, Vec] => {
    const [tag, v1] = tagDecode(v)
    const [len, v2] = lenDecode(v1)
    const [result, next] = pop(len)(v2)
    return [[tag, vec(len)(result)], next]
}

// boolean

/** Encodes a JavaScript boolean as an ASN.1 BOOLEAN value. */
export const encodeBoolean = (b: boolean): Vec => vec8(b ? 0xFFn : 0x00n)

/** Decodes an ASN.1 BOOLEAN value. */
export const decodeBoolean = (v: Vec): boolean => uint(v) !== 0n

// integer (two's compliment)

/** Encodes a signed bigint using ASN.1 INTEGER two's complement representation. */
export const encodeInteger = (uint: bigint): Vec => {
    const offset = uint < 0n ? 1n : 0n
    return round8({ length: bitLength(uint + offset) + 1n, uint }).v
}

/** Decodes an ASN.1 INTEGER encoded in two's complement. */
export const decodeInteger = (v: Vec): bigint => {
    const { length, uint } = unpack(v)
    const sign = uint >> (length - 1n)
    return sign === 0n ? uint : uint - (1n << length)
}

// octet string

/** Encodes an OCTET STRING value. */
export const encodeOctetString = (v: Vec): Vec => v

/** Decodes an OCTET STRING value. */
export const decodeOctetString = (v: Vec): Vec => v

// object identifier

/** ASN.1 OBJECT IDENTIFIER components. */
export type ObjectIdentifier = readonly bigint[]

/** Encodes an OBJECT IDENTIFIER value. */
export const encodeObjectIdentifier = (oid: ObjectIdentifier): Vec => {
    const [first, second, ...rest] = oid
    const firstByte = first * 40n + second
    return concat([vec8(firstByte), ...rest.map(b128encode)])
}

/** Decodes an OBJECT IDENTIFIER value. */
export const decodeObjectIdentifier = (v: Vec): ObjectIdentifier => {
    const [firstByte, rest] = pop8(v)
    const first = firstByte / 40n
    const second = firstByte % 40n
    let result: ObjectIdentifier = [first, second]
    let tail = rest
    while (length(tail) > 0n) {
        const [value, next] = b128decode(tail)
        result = [...result, value]
        tail = next
    }
    return result
}

// sequence

/** ASN.1 ordered collection of records. */
export type Sequence = readonly Record[]

const genericEncodeSequence = (map: (vec: readonly Vec[]) => readonly Vec[]) => (...records: Sequence): Vec =>
    concat(map(records.map(encode)))

/** Encodes a SEQUENCE payload from ordered records. */
export const encodeSequence: (...records: Sequence) => Vec =
    genericEncodeSequence(identity)

/** Decodes a SEQUENCE payload into records. */
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

/** ASN.1 SET represented as a sequence of records. */
export type Set = Sequence

/** Encodes a SET payload with canonical byte ordering. */
export const encodeSet: (...records: Sequence) => Vec =
    genericEncodeSequence(v => v.toSorted((a, b) => msbCmp(a)(b)))

/** Decodes a SET payload. */
export const decodeSet: (v: Vec) => Sequence = decodeSequence

// Record

/** Supported ASN.1 record variants. */
export type SupportedRecord =
    | readonly[typeof boolean, boolean]
    | readonly[typeof integer, bigint]
    | readonly[typeof octetString, Vec]
    | readonly[typeof objectIdentifier, ObjectIdentifier]
    | readonly[typeof constructedSequence, Sequence]
    | readonly[typeof constructedSet, Set]

// Alternative:
//
// export type SupportedRecord =
//     | boolean
//     | bigint                                                    // integer
//     | { tag: typeof octetString, value: Vec }
//     | { tag: typeof objectIdentifier, value: ObjectIdentifier }
//     | readonly Record[]                                         // sequence
//     | { tag: typeof constructedSet, value: readonly Record[] }
//
// export type UnsupportedRecord =
//     | { tag: null, value: Vec }

/**
 * For unsupported tags, we just store the raw value including the tag and length,
 * so that it can be re-encoded without loss of information.
 */
export type UnsupportedRecord = Vec

export type Record = SupportedRecord | UnsupportedRecord

// encode

const recordToRaw = ([tag, value]: SupportedRecord): Vec => {
    switch (tag) {
        case boolean: return encodeBoolean(value)
        case integer: return encodeInteger(value)
        case octetString: return encodeOctetString(value)
        case objectIdentifier: return encodeObjectIdentifier(value)
        case constructedSequence: return encodeSequence(...value)
        case constructedSet: return encodeSet(...value)
    }
}

/** Encodes a supported ASN.1 record as TLV. */
export const encode = (record: Record): Vec =>
    isVec(record) ? record : encodeRaw([record[0], recordToRaw(record)])

// decode

const rawToRecord = (raw: Raw): Record => {
    const [tag, value] = raw
    switch (tag) {
        case boolean: return [boolean, decodeBoolean(value)]
        case integer: return [integer, decodeInteger(value)]
        case octetString: return [octetString, decodeOctetString(value)]
        case objectIdentifier: return [objectIdentifier, decodeObjectIdentifier(value)]
        case constructedSequence: return [constructedSequence, decodeSequence(value)]
        case constructedSet: return [constructedSet, decodeSet(value)]
        default: return encodeRaw(raw)
    }
}

/** Decodes one supported ASN.1 record and returns the remaining input. */
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
    digestAlgorithms SET OF DigestAlgorithmIdentifier,            // [X]
    encapContentInfo EncapsulatedContentInfo,
    certificates     [0] IMPLICIT CertificateSet OPTIONAL,
    crls             [1] IMPLICIT RevocationInfoChoices OPTIONAL,
    signerInfos      SET OF SignerInfo                            // [X]
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
