/**
 * Base-128 encoding and decoding utilities over bit vectors.
 *
 * @module
 *
 * @import { Vec } from '../../types/bit_vec/types.ts'
 */

import { mask } from '../../types/bigint/module.f.mjs'
import { vec8, msb, empty } from '../../types/bit_vec/module.f.mjs'

const { concat, popFront } = msb

const pop8 = popFront(8n)

/**
 * The varint layout both halves below agree on, stated once: each byte carries
 * seven payload bits in its low end, and its top bit is set on every byte
 * except the last.
 *
 * `encode` and `decode` are exact inverses, so the two must agree bit for bit.
 * The masks are derived from `payloadBits` rather than written as `0x7f` and
 * `0x80` so that agreement is structural rather than a pair of literals a
 * reader has to match up.
 */
const payloadBits = 7n
const payloadMask = mask(payloadBits)
const continuationFlag = 1n << payloadBits

/**
 * Encodes a bigint into an MSB Base128 vector.
 *
 * @param {bigint} uint The bigint to encode.
 * @returns {Vec} The encoded MSB Base128 vector.
 */
export const encode = uint => {
    /** @type {Vec} */
    let result = empty
    while (true) {
        const item = uint & payloadMask
        // The first byte built is the last one emitted, so it is the only one
        // without the continuation flag.
        const flag = result === empty ? 0n : continuationFlag
        result = concat(vec8(flag | item))(result)
        uint >>= payloadBits
        if (uint === 0n) {
            return result
        }
    }
}

/**
 * Decodes an MSB Base128 vector into a bigint.
 *
 * @param {Vec} v The MSB Base128 vector to decode.
 * @returns {readonly[bigint, Vec]} A tuple containing the decoded bigint and the remaining vector.
 */
export const decode = v => {
    let result = 0n
    while (true) {
        const [byte, rest] = pop8(v)
        result = (result << payloadBits) | (byte & payloadMask)
        if ((byte & continuationFlag) === 0n) {
            return [result, rest]
        }
        v = rest
    }
}
