import type { Array16, Array3, Array4, Array8 } from '../../types/array/module.f.ts'

type V3 = Array3<bigint>

type V4 = Array4<bigint>

type V8 = Array8<bigint>

type V16 = Array16<bigint>

type Base = {
    readonly bitLength: bigint
    readonly k: readonly V16[]
    readonly bs0: V3
    readonly bs1: V3
    readonly ss0: V3
    readonly ss1: V3
}

const compress = ({ bitLength, k, bs0, bs1, ss0, ss1 }: Base) => {

    const rotr = (d: bigint) => {
        const r = bitLength - d
        return (n: bigint) => n >> d | n << r
    }

    const bigSigma = ([a, b, c]: V3) => {
        const ra = rotr(a)
        const rb = rotr(b)
        const rc = rotr(c)
        return (x: bigint) => ra(x) ^ rb(x) ^ rc(x)
    }

    const bigSigma0 = bigSigma(bs0)

    const bigSigma1 = bigSigma(bs1)

    const smallSigma = ([a, b, c]: V3) => {
        const ra = rotr(a)
        const rb = rotr(b)
        return (x: bigint) => ra(x) ^ rb(x) ^ (x >> c)
    }

    const smallSigma0 = smallSigma(ss0)

    const smallSigma1 = smallSigma(ss1)

    const ch = (x: bigint, y: bigint, z: bigint) => x & y ^ ~x & z

    const maj = (x: bigint, y: bigint, z: bigint) => x & y ^ x & z ^ y & z

    const mask = (1n << bitLength) - 1n

    const wi = ([a0, a1, a2, a3]: V4) =>
        (smallSigma1(a0) + a1 + smallSigma0(a2) + a3) & mask

    const nextW = ([w0, w1, w2, w3, w4, w5, w6, w7, w8, w9, wA, wB, wC, wD, wE, wF]: V16): V16 => {
        w0 = wi([wE, w9, w1, w0])
        w1 = wi([wF, wA, w2, w1])
        w2 = wi([w0, wB, w3, w2])
        w3 = wi([w1, wC, w4, w3])
        w4 = wi([w2, wD, w5, w4])
        w5 = wi([w3, wE, w6, w5])
        w6 = wi([w4, wF, w7, w6])
        w7 = wi([w5, w0, w8, w7])
        w8 = wi([w6, w1, w9, w8])
        w9 = wi([w7, w2, wA, w9])
        wA = wi([w8, w3, wB, wA])
        wB = wi([w9, w4, wC, wB])
        wC = wi([wA, w5, wD, wC])
        wD = wi([wB, w6, wE, wD])
        wE = wi([wC, w7, wF, wE])
        wF = wi([wD, w8, w0, wF])
        return [w0, w1, w2, w3, w4, w5, w6, w7, w8, w9, wA, wB, wC, wD, wE, wF]
    }

    const kLength = k.length

    return ([a0, b0, c0, d0, e0, f0, g0, h0]: V8) => (data: V16): V8 => {
        let w = data

        let a = a0
        let b = b0
        let c = c0
        let d = d0
        let e = e0
        let f = f0
        let g = g0
        let h = h0

        let i = 0
        while (true) {
            const ki = k[i]
            for (let j = 0; j < 16; ++j) {
                const t1 = h + bigSigma1(e) + ch(e, f, g) + ki[j] + w[j]
                const t2 = bigSigma0(a) + maj(a, b, c)
                h = g
                g = f
                f = e
                e = (d + t1) & mask
                d = c
                c = b
                b = a
                a = (t1 + t2) & mask
            }
            ++i
            if (i === kLength) { break }
            w = nextW(w)
        }

        return [
            (a0 + a) & mask,
            (b0 + b) & mask,
            (c0 + c) & mask,
            (d0 + d) & mask,
            (e0 + e) & mask,
            (f0 + f) & mask,
            (g0 + g) & mask,
            (h0 + h) & mask,
        ]
    }
}

const base32: Base = {
    bitLength: 32n,
    k: [
        [
            0x428a2f98n, 0x71374491n, 0xb5c0fbcfn, 0xe9b5dba5n, 0x3956c25bn, 0x59f111f1n, 0x923f82a4n, 0xab1c5ed5n,
            0xd807aa98n, 0x12835b01n, 0x243185ben, 0x550c7dc3n, 0x72be5d74n, 0x80deb1fen, 0x9bdc06a7n, 0xc19bf174n,
        ],
        [
            0xe49b69c1n, 0xefbe4786n, 0x0fc19dc6n, 0x240ca1ccn, 0x2de92c6fn, 0x4a7484aan, 0x5cb0a9dcn, 0x76f988dan,
            0x983e5152n, 0xa831c66dn, 0xb00327c8n, 0xbf597fc7n, 0xc6e00bf3n, 0xd5a79147n, 0x06ca6351n, 0x14292967n,
        ],
        [
            0x27b70a85n, 0x2e1b2138n, 0x4d2c6dfcn, 0x53380d13n, 0x650a7354n, 0x766a0abbn, 0x81c2c92en, 0x92722c85n,
            0xa2bfe8a1n, 0xa81a664bn, 0xc24b8b70n, 0xc76c51a3n, 0xd192e819n, 0xd6990624n, 0xf40e3585n, 0x106aa070n,
        ],
        [
            0x19a4c116n, 0x1e376c08n, 0x2748774cn, 0x34b0bcb5n, 0x391c0cb3n, 0x4ed8aa4an, 0x5b9cca4fn, 0x682e6ff3n,
            0x748f82een, 0x78a5636fn, 0x84c87814n, 0x8cc70208n, 0x90befffan, 0xa4506cebn, 0xbef9a3f7n, 0xc67178f2n,
        ],
    ],
    bs0: [2n, 13n, 22n],
    bs1: [6n, 11n, 25n],
    ss0: [7n, 18n, 3n],
    ss1: [17n, 19n, 10n],
}

const base64: Base = {
    bitLength: 64n,
    k: [
        [
            0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcn,
            0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
            0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
            0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf692694n,
        ],
        [
            0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n,
            0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
            0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n,
            0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
        ],
        [
            0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
            0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
            0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n,
            0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
        ],
        [
            0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n, 0x34b0bcb5e19b48a8n,
            0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
            0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
            0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
        ],
        [
            0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n,
            0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
            0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn,
            0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n,
        ],
    ],
    bs0: [28n, 34n, 39n],
    bs1: [14n, 18n, 41n],
    ss0: [1n, 8n, 7n],
    ss1: [19n, 61n, 6n],
}