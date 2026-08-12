/**
 * ASN.1 BER/DER encoding and decoding over bit vectors. Includes tag/class
 * helpers, length-prefixed payloads, and OID conversion via Base-128.
 *
 * @module
 *
 * @import { Unpacked, Vec } from '../types/bit_vec/types.ts'
 * @import { ObjectIdentifier, Raw, Record, Sequence, SupportedRecord, _Tag } from './types.ts'
 */

import { bitLength, divUp8 } from '../types/bigint/module.f.mjs'
import {
    empty,
    isVec,
    length,
    msb,
    uint,
    unpack,
    vec,
    vec8,
} from '../types/bit_vec/module.f.mjs'
import { identity } from '../types/function/module.f.mjs'
import { max } from '../types/function/compare/module.f.mjs'
import { encode as b128encode, decode as b128decode } from '../basen/base128/module.f.mjs'

//

const { popFront: pop, listToVec } = msb

const pop8 = pop(8n)

// tag

/**
 * @typedef {|
 *  0b000_00000n |
 *  0b001_00000n |
 *  0b010_00000n |
 *  0b011_00000n |
 *  0b100_00000n |
 *  0b101_00000n |
 *  0b110_00000n |
 *  0b111_00000n
 * } _ClassPc
 */

const classPcMask = 0b111_00000n

const tagNumberMask = 0b000_11111n

/**
 * Note: the tag number (the second parameter) can be arbitrarily large,
 *       so we can't just use a single byte to represent it.
 * @typedef {readonly[_ClassPc, bigint]} _ParsedTag
 */

/** @type {([classPc, number]: _ParsedTag) => Vec} */
const parsedTagEncode = ([classPc, number]) => {
    const [firstByteNumber, rest] = number < tagNumberMask
        ? [number, empty]
        : [tagNumberMask, b128encode(number)]
    return listToVec([vec8(classPc | firstByteNumber), rest])
}

/** @type {(v: Vec) => readonly[_ParsedTag, Vec]} */
const parsedTagDecode = v => {
    const [firstByte, rest] = pop8(v)
    const classPc = /** @type {_ClassPc} */(firstByte & classPcMask)
    const firstByteNumber = firstByte & tagNumberMask
    const [number, rest1] = firstByteNumber < tagNumberMask
        ? [firstByteNumber, rest]
        : b128decode(rest)
    return [[classPc, number], rest1]
}

/** @type {(tag: _Tag) => Vec} */
const tagEncode = tag =>
    vec(max(divUp8(bitLength(tag)))(1n) << 3n)(tag)

/** @type {(v: Vec) => readonly[_Tag, Vec]} */
const tagDecode = v => {
    const [parsedTag, rest] = parsedTagDecode(v)
    return [uint(parsedTagEncode(parsedTag)), rest]
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

/**
 * @typedef {{
 *  readonly byteLen: bigint
 *  readonly v: Vec
 * }} _Round8
 */

/** @type {(_: Unpacked) => _Round8} */
const round8 = ({ length, uint }) => {
    const byteLen = divUp8(length)
    return { byteLen, v: vec(byteLen << 3n)(uint) }
}

/** @type {(uint: bigint) => Vec} */
const lenEncode = uint => {
    if (uint < 0x80n) {
        return vec8(uint)
    }
    const { byteLen, v } = round8({ length: bitLength(uint), uint })
    return listToVec([vec8(0x80n | byteLen), v])
}

/**
 * Decodes the length field of an ASN.1 TLV and returns the length in bits and the remaining input.
 *
 * @param {Vec} v - The input bit vector starting with the length field.
 * @returns {readonly[bigint, Vec]} A tuple containing the length in bits and the remaining input after the length field.
 */
const lenDecode = v => {
    const firstAndRest = pop8(v)
    const [first, rest1] = firstAndRest
    const [byteLen, rest2] = first < 0x80n ? firstAndRest : pop((first & 0x7Fn) << 3n)(rest1)
    return [byteLen << 3n, rest2]
}

// raw

/**
 * Encodes a raw ASN.1 TLV tuple into a bit vector.
 *
 * @type {(_: Raw) => Vec}
 */
export const encodeRaw = ([tag, value]) => {
    const tagVec = tagEncode(tag)
    const { byteLen, v } = round8(unpack(value))
    return listToVec([tagVec, lenEncode(byteLen), v])
}

/**
 * Decodes a raw ASN.1 TLV tuple and returns the remaining input.
 *
 * @type {(v: Vec) => readonly[Raw, Vec]}
 */
export const decodeRaw = v => {
    const [tag, v1] = tagDecode(v)
    const [len, v2] = lenDecode(v1)
    const [result, next] = pop(len)(v2)
    return [[tag, vec(len)(result)], next]
}

// boolean

/**
 * Encodes a JavaScript boolean as an ASN.1 BOOLEAN value.
 *
 * @type {(b: boolean) => Vec}
 */
export const encodeBoolean = b => vec8(b ? 0xFFn : 0x00n)

/**
 * Decodes an ASN.1 BOOLEAN value.
 *
 * @type {(v: Vec) => boolean}
 */
export const decodeBoolean = v => uint(v) !== 0n

// integer (two's compliment)

/**
 * Encodes a signed bigint using ASN.1 INTEGER two's complement representation.
 *
 * @type {(uint: bigint) => Vec}
 */
export const encodeInteger = uint => {
    const offset = uint < 0n ? 1n : 0n
    return round8({ length: bitLength(uint + offset) + 1n, uint }).v
}

/**
 * Decodes an ASN.1 INTEGER encoded in two's complement.
 *
 * @type {(v: Vec) => bigint}
 */
export const decodeInteger = v => {
    const { length, uint } = unpack(v)
    const sign = uint >> (length - 1n)
    return sign === 0n ? uint : uint - (1n << length)
}

// octet string

/**
 * Encodes an OCTET STRING value.
 *
 * @type {(v: Vec) => Vec}
 */
export const encodeOctetString = v => v

/**
 * Decodes an OCTET STRING value.
 *
 * @type {(v: Vec) => Vec}
 */
export const decodeOctetString = v => v

// object identifier

/**
 * Encodes an OBJECT IDENTIFIER value.
 *
 * @type {(oid: ObjectIdentifier) => Vec}
 */
export const encodeObjectIdentifier = oid => {
    const [first, second, ...rest] = oid
    const firstByte = first * 40n + second
    return listToVec([vec8(firstByte), ...rest.map(b128encode)])
}

/**
 * Drains a bit vector by repeatedly applying a step until the vector is empty,
 * collecting every decoded item into an array.
 *
 * @template T
 * @param {(v: Vec) => readonly [T, Vec]} step
 * @return {(v: Vec) => readonly T[]}
 */
const decodeAll = step => v => {
    /** @type {readonly T[]} */
    let result = []
    while (length(v) !== 0n) {
        const [item, rest] = step(v)
        result = [...result, item]
        v = rest
    }
    return result
}

/**
 * Decodes an OBJECT IDENTIFIER value.
 *
 * @type {(v: Vec) => ObjectIdentifier}
 */
export const decodeObjectIdentifier = v => {
    const [firstByte, rest] = pop8(v)
    return [firstByte / 40n, firstByte % 40n, ...decodeAll(b128decode)(rest)]
}

// sequence

/**
 * @param {(vec: readonly Vec[]) => readonly Vec[]} map
 * @return {(...records: Sequence) => Vec}
 */
const genericEncodeSequence = map => (...records) =>
    listToVec(map(records.map(encode)))

/**
 * Encodes a SEQUENCE payload from ordered records.
 *
 * @type {(...records: Sequence) => Vec}
 */
export const encodeSequence =
    genericEncodeSequence(identity)

/**
 * Decodes a SEQUENCE payload into records.
 *
 * @type {(v: Vec) => Sequence}
 */
export const decodeSequence = v => decodeAll(decode)(v)

// set

/**
 * Encodes a SET payload with canonical byte ordering.
 *
 * @type {(...records: Sequence) => Vec}
 */
export const encodeSet =
    genericEncodeSequence(v => v.toSorted((a, b) => msb.cmp(a)(b)))

/**
 * Decodes a SET payload.
 *
 * @type {(v: Vec) => Sequence}
 */
export const decodeSet = decodeSequence

// encode

/** @type {(_: SupportedRecord) => Vec} */
const recordToRaw = ([tag, value]) => {
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
 * Encodes a supported ASN.1 record as TLV.
 *
 * @type {(record: Record) => Vec}
 */
export const encode = record =>
    isVec(record) ? record : encodeRaw([record[0], recordToRaw(record)])

// decode

/** @type {(raw: Raw) => Record} */
const rawToRecord = raw => {
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

/**
 * Decodes one supported ASN.1 record and returns the remaining input.
 *
 * @type {(v: Vec) => readonly[Record, Vec]}
 */
export const decode = v => {
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
