import { vec8, type Vec, msb, empty } from '../bit_vec/module.f.ts'

const { concat, popFront } = msb

const pop8 = popFront(8n)

/**
 * Encodes a bigint into an MSB Base128 vector.
 * 
 * @param uint The bigint to encode.
 * @returns The encoded MSB Base128 vector.
 */
export const encode = (uint: bigint): Vec => {
    let result: Vec = empty
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
 * @param v The MSB Base128 vector to decode.
 * @returns A tuple containing the decoded bigint and the remaining vector.
 */
export const decode = (v: Vec): readonly[bigint, Vec] => {
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
