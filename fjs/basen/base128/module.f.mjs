/**
 * Base-128 encoding and decoding utilities over bit vectors.
 *
 * @module
 */

import { vec8, msb, empty } from '../../types/bit_vec/module.f.mjs'
/** @import { Vec } from '../../types/bit_vec/types.ts' */

const { concat, popFront } = msb

const pop8 = popFront(8n)

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
        const item = uint & 0x7Fn
        const flag = result === empty ? 0n : 0x80n
        result = concat(vec8(flag | item))(result)
        uint >>= 7n
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
        result = (result << 7n) | (byte & 0x7Fn)
        if (byte < 0x80n) {
            return [result, rest]
        }
        v = rest
    }
}
