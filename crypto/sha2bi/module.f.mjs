import * as bigInt from '../../types/bigint/module.f.mjs'

/** @type {readonly[bigint, bigint, bigint, bigint]} */
const k4x16 = [0n, 0n, 0n, 0n]

/**
 * @typedef {(d: bigint) => (n: bigint) => bigint} Binary
 */

/** @typedef {readonly[bigint, bigint, bigint]} SigmaInit */

/**
 * @typedef {{
 *  readonly size: bigint
 *  readonly k: readonly bigint[]
 *  readonly bigSigma0: SigmaInit
 *  readonly bigSigma1: SigmaInit
 *  readonly smallSigma0: SigmaInit
 *  readonly smallSigma1: SigmaInit
 * }} AlgorithmInit
 */

/** @type {(algorithm: AlgorithmInit) => (init8: bigint) => (w16: bigint) => bigint} */
export const compress = ({ size, k, bigSigma0, bigSigma1, smallSigma0, smallSigma1 }) => {
    /** @type {Binary} */
    const rotr = d => {
        const r = size - d
        const mask = (1n << d) - 1n
        return n => n >> d | (n & mask) << r
    }
    /** @type {(i: SigmaInit) => (x: bigint) => bigint} */
    const bigSigma = ([a, b, c]) => {
        const ra = rotr(a)
        const rb = rotr(b)
        const rc = rotr(c)
        return x => ra(x) ^ rb(x) ^ rc(x)
    }
    /** @type {(i: SigmaInit) => (x: bigint) => bigint} */
    const smallSigma = ([a, b, c]) => {
        const ra = rotr(a)
        const rb = rotr(b)
        return x => ra(x) ^ rb(x) ^ (x >> c)
    }
    /** @type {(v: bigint) => readonly bigint[]} */
    const toArray = v => {
        let n = 8
        /** @type {readonly bigint[]} */
        let result = []
        while (true) {
            result = [...result, v & mask]
            if (n === 0) { return result }
            v >>= size
            --n
        }
    }
    const mask = (1n << size) - 1n
    const bS0 = bigSigma(bigSigma0)
    const bS1 = bigSigma(bigSigma1)
    const sS0 = smallSigma(smallSigma0)
    const sS1 = smallSigma(smallSigma1)
    /** @type {(i: bigint) => bigint} */
    const norm = a => a & mask
    /** @type {(i: bigint) => (v: bigint) => bigint} */
    const at = i => {
        const offset = size * i
        return v => norm(v >> offset)
    }
    const at0 = at(0n)
    const at8 = at(8n)
    const at13 = at(13n)
    const size15 = size * 15n
    //
    return init8 => w16 => {
        const i8 = toArray(init8)
        let [a, b, c, d, e, f, g, h] = i8
        let i = 0
        while (true) {
            const ki = k.at(i)
            if (ki === undefined) { break }
            let wi = at0(w16)
            w16 >>= size
            if (i < 16) {
                const a0 = at13(w16)
                const a1 = at8(w16)
                const a2 = at0(w16)
                wi = norm(sS1(a0) + a1 + sS0(a2) + wi)
            }
            const t1 = h + ki + wi + bS1(e) + ((e & f) ^ (~e & g))
            const t2 = bS0(a) + ((a & b) ^ (a & c) ^ (b & c))
            h = g
            g = f
            f = e
            e = norm(d + t1)
            d = c
            c = b
            b = a
            a = norm(t2 + t1)
            //
            w16 |= wi << size15
            ++i
        }
        return [a, b, c, d, e, f, g, h].reduce(
            (acc, v, i) => acc | (norm(v + i8[i]) << (size * BigInt(i))),
            0n,
        )
    }
}

const compress32 = compress({
    size: 32n,
    k: [
        0x428a2f98n, 0x71374491n, 0xb5c0fbcfn, 0xe9b5dba5n, 0x3956c25bn, 0x59f111f1n, 0x923f82a4n, 0xab1c5ed5n,
        0xd807aa98n, 0x12835b01n, 0x243185ben, 0x550c7dc3n, 0x72be5d74n, 0x80deb1fen, 0x9bdc06a7n, 0xc19bf174n,
        0xe49b69c1n, 0xefbe4786n, 0x0fc19dc6n, 0x240ca1ccn, 0x2de92c6fn, 0x4a7484aan, 0x5cb0a9dcn, 0x76f988dan,
        0x983e5152n, 0xa831c66dn, 0xb00327c8n, 0xbf597fc7n, 0xc6e00bf3n, 0xd5a79147n, 0x06ca6351n, 0x14292967n,
        0x27b70a85n, 0x2e1b2138n, 0x4d2c6dfcn, 0x53380d13n, 0x650a7354n, 0x766a0abbn, 0x81c2c92en, 0x92722c85n,
        0xa2bfe8a1n, 0xa81a664bn, 0xc24b8b70n, 0xc76c51a3n, 0xd192e819n, 0xd6990624n, 0xf40e3585n, 0x106aa070n,
        0x19a4c116n, 0x1e376c08n, 0x2748774cn, 0x34b0bcb5n, 0x391c0cb3n, 0x4ed8aa4an, 0x5b9cca4fn, 0x682e6ff3n,
        0x748f82een, 0x78a5636fn, 0x84c87814n, 0x8cc70208n, 0x90befffan, 0xa4506cebn, 0xbef9a3f7n, 0xc67178f2n,
    ],
    bigSigma0: [2n, 13n, 22n],
    bigSigma1: [6n, 11n, 25n],
    smallSigma0: [7n, 18n, 3n],
    smallSigma1: [17n, 19n, 10n],
})

const compress64 = compress({
    size: 64n,
    k: [],
    bigSigma0: [28n, 34n, 39n],
    bigSigma1: [14n, 18n, 41n],
    smallSigma0: [1n, 8n, 7n],
    smallSigma1: [19n, 61n, 6n],
})
