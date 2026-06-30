/**
 * ASN.1 BER/DER encoding and decoding over bit vectors. Includes tag/class
 * helpers, length-prefixed payloads, and OID conversion via Base-128.
 *
 * @module
 */
import { bitLength, divUp8 } from "../types/bigint/module.f.ts"
import {
    empty,
    isVec,
    length,
    msb,
    uint,
    unpack,
    vec,
    vec8,
    type Unpacked,
    type Vec
} from "../types/bit_vec/module.f.ts"
import { identity } from "../types/function/module.f.ts"
import { max } from "../types/function/compare/module.f.ts"
import { encode as b128encode, decode as b128decode } from "../base128/module.f.ts"
import { unwrap, type Nullable } from "../types/nullable/module.f.ts"

const { popFront: pop, listToVec } = msb

const pop8 = pop(8n)

// tag

type ClassPc =
    | 0b000_00000n
    | 0b001_00000n
    | 0b010_00000n
    | 0b011_00000n
    | 0b100_00000n
    | 0b101_00000n
    | 0b110_00000n
    | 0b111_00000n

const classPcMask = 0b111_00000n

const tagNumberMask = 0b000_11111n

// Note: the tag number (the second parameter) can be arbitrarily large,
//       so we can't just use a single byte to represent it.
type ParsedTag = readonly[ClassPc, bigint]

/** ASN.1 tag number. */
type Tag = bigint

// Builds from a caller-supplied tag number (b128-encoded), so its length is
// data-derived — it propagates the over-cap `null`.
const parsedTagEncode = ([classPc, number]: ParsedTag): Nullable<Vec> => {
    const [firstByteNumber, rest] = number < tagNumberMask
        ? [number, empty]
        : [tagNumberMask, b128encode(number)]
    return listToVec([vec8(classPc | firstByteNumber), rest])
}

const parsedTagDecode = (v: Vec): readonly[ParsedTag, Vec] => {
    const [firstByte, rest] = pop8(v)
    const classPc = (firstByte & classPcMask) as ClassPc
    const firstByteNumber = firstByte & tagNumberMask
    const [number, rest1] = firstByteNumber < tagNumberMask
        ? [firstByteNumber, rest]
        : b128decode(rest)
    return [[classPc, number], rest1]
}

const tagEncode = (tag: Tag): Vec =>
    vec(max(divUp8(bitLength(tag)))(1n) << 3n)(tag)

const tagDecode = (v: Vec): readonly[Tag, Vec] => {
    const [parsedTag, rest] = parsedTagDecode(v)
    // Re-encoding a tag parsed from already-bounded input (`v` is itself a
    // `Vec`, so ≤ `maxLength`); the over-cap `null` branch is dead.
    return [uint(unwrap(parsedTagEncode(parsedTag))), rest]
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

type Round8 = {
    readonly byteLen: bigint
    readonly v: Vec
}

const round8 = ({ length, uint }: Unpacked): Round8 => {
    const byteLen = divUp8(length)
    return { byteLen, v: vec(byteLen << 3n)(uint) }
}

const lenEncode = (uint: bigint): Nullable<Vec> => {
    if (uint < 0x80n) {
        return vec8(uint)
    }
    const { byteLen, v } = round8({ length: bitLength(uint), uint })
    return listToVec([vec8(0x80n | byteLen), v])
}

/**
 * Decodes the length field of an ASN.1 TLV and returns the length in bits and the remaining input.
 *
 * @param v - The input bit vector starting with the length field.
 * @returns A tuple containing the length in bits and the remaining input after the length field.
 */
const lenDecode = (v: Vec): readonly[bigint, Vec] => {
    const firstAndRest = pop8(v)
    const [first, rest1] = firstAndRest
    const [byteLen, rest2] = first < 0x80n ? firstAndRest : pop((first & 0x7Fn) << 3n)(rest1)
    return [byteLen << 3n, rest2]
}

// raw

/** Raw ASN.1 TLV tuple. */
export type Raw = readonly [Tag, Vec]

/**
 * Encodes a raw ASN.1 TLV tuple into a bit vector. Wraps a caller-supplied
 * `value` whose length is data-derived, so it propagates the over-cap `null`.
 */
export const encodeRaw = ([tag, value]: Raw): Nullable<Vec> => {
    const tagVec = tagEncode(tag)
    const { byteLen, v } = round8(unpack(value))
    const len = lenEncode(byteLen)
    return len === null ? null : listToVec([tagVec, len, v])
}

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

/** Encodes an OBJECT IDENTIFIER value. Propagates the over-cap `null`. */
export const encodeObjectIdentifier = (oid: ObjectIdentifier): Nullable<Vec> => {
    const [first, second, ...rest] = oid
    const firstByte = first * 40n + second
    return listToVec([vec8(firstByte), ...rest.map(b128encode)])
}

/**
 * Drains a bit vector by repeatedly applying a step until the vector is empty,
 * collecting every decoded item into an array.
 */
const decodeAll = <T>(step: (v: Vec) => readonly [T, Vec]) => (v: Vec): readonly T[] => {
    let result: readonly T[] = []
    while (length(v) !== 0n) {
        const [item, rest] = step(v)
        result = [...result, item]
        v = rest
    }
    return result
}

/** Decodes an OBJECT IDENTIFIER value. */
export const decodeObjectIdentifier = (v: Vec): ObjectIdentifier => {
    const [firstByte, rest] = pop8(v)
    return [firstByte / 40n, firstByte % 40n, ...decodeAll(b128decode)(rest)]
}

// sequence

/** ASN.1 ordered collection of records. */
export type Sequence = readonly Record[]

/** Sequences an array of `Nullable<Vec>`, returning `null` if any element is `null`. */
const allOrNull = (xs: readonly Nullable<Vec>[]): Nullable<readonly Vec[]> => {
    let r: readonly Vec[] = []
    for (const x of xs) {
        if (x === null) { return null }
        r = [...r, x]
    }
    return r
}

const genericEncodeSequence = (map: (vec: readonly Vec[]) => readonly Vec[]) => (...records: Sequence): Nullable<Vec> => {
    const encoded = allOrNull(records.map(encode))
    return encoded === null ? null : listToVec(map(encoded))
}

/** Encodes a SEQUENCE payload from ordered records. Propagates the over-cap `null`. */
export const encodeSequence: (...records: Sequence) => Nullable<Vec> =
    genericEncodeSequence(identity)

/** Decodes a SEQUENCE payload into records. */
export const decodeSequence = (v: Vec): Sequence => decodeAll(decode)(v)

// set

/** ASN.1 SET represented as a sequence of records. */
export type Set = Sequence

/** Encodes a SET payload with canonical byte ordering. Propagates the over-cap `null`. */
export const encodeSet: (...records: Sequence) => Nullable<Vec> =
    genericEncodeSequence(v => v.toSorted((a, b) => msb.cmp(a)(b)))

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

const recordToRaw = ([tag, value]: SupportedRecord): Nullable<Vec> => {
    switch (tag) {
        case boolean: return encodeBoolean(value)
        case integer: return encodeInteger(value)
        case octetString: return encodeOctetString(value)
        case objectIdentifier: return encodeObjectIdentifier(value)
        case constructedSequence: return encodeSequence(...value)
        case constructedSet: return encodeSet(...value)
    }
}

/**
 * Encodes a supported ASN.1 record as TLV. Records wrap caller-supplied
 * payloads (an `OCTET STRING` or `SEQUENCE` can be near `maxLength`), so this
 * propagates the over-cap `null` through the recursive encode.
 */
export const encode = (record: Record): Nullable<Vec> => {
    if (isVec(record)) { return record }
    const raw = recordToRaw(record)
    return raw === null ? null : encodeRaw([record[0], raw])
}

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
        // Re-encoding a raw TLV decoded from already-bounded input; the over-cap
        // `null` branch is dead.
        default: return unwrap(encodeRaw(raw))
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
