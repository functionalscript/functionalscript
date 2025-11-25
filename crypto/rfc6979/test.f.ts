import { utf8 } from "../../text/module.f.ts"
import type { Array4 } from "../../types/array/module.f.ts"
import { empty, msb, repeat, vec, vec8, type Vec } from "../../types/bit_vec/module.f.ts"
import { hmac } from "../hmac/module.f.ts"
import { computeSync, sha224, sha256, sha384, sha512, type Sha2 } from "../sha2/module.f.ts"
import { all, concat, computeK } from "./module.f.ts"

const sample = utf8("sample")
const test = utf8("test")

const x00 = vec8(0x00n)
const x01 = vec8(0x01n)

const v168 = vec(168n)
const v256 = vec(256n)
const v600 = vec(600n)
const r32 = repeat(32n)
const hmac256 = hmac(sha256)

export default {
    bits2int: () => {
        if (all(7n).bits2int(vec(5n)(0b10100n)) !== 0b101n) { throw new Error("fail") }
        if (all(17n).bits2int(vec(3n)(0b101n)) !== 0b101n) { throw new Error("fail") }
    },
    int2octets: () => {
        // 3 bit prime
        if (all(5n).int2octets(0b101n) !== vec(8n)(0b0000_0101n)) { throw new Error("fail") }
        // 5 bit prime
        if (all(17n).int2octets(0b10100n) !== vec(8n)(0b0001_0100n)) { throw new Error("fail") }
        // 15 bit prime
        if (all(16387n).int2octets(0x13n) !== vec(16n)(0x13n)) { throw new Error("fail") }
    },
    bit2octets: () => {
        if (all(11n).bits2octets(vec(4n)(0b1101n)) !== vec(8n)(0b0000_0010n)) { throw new Error("fail") }
    },
    k: () => {
        //
        const q = 0x4000000000000000000020108A2E0CC0D99F8A5EFn
        const { qlen, int2octets, bits2octets, bits2int } = all(q)
        if (qlen !== 163n) { throw qlen }
        const x = 0x09A4D6792295A7F730FC3F2B49CBC0F62E862272Fn
        const h1 = computeSync(sha256)([sample])
        if (h1 !== v256(0xAF2BDBE1AA9B6EC1E2ADE1D694F41FC71A831D0268E9891562113D8A62ADD1BFn)) { throw h1 }
        const xi2o = int2octets(x)
        if (xi2o !== v168(0x009A4D6792295A7F730FC3F2B49CBC0F62E862272Fn)) { throw xi2o }
        const h1b2o = bits2octets(h1)
        if (h1b2o !== v168(0x01795EDF0D54DB760F156D0DAC04C0322B3A204224n)) { throw h1b2o }
        let v = r32(x01)
        if (v !== v256(0x0101010101010101010101010101010101010101010101010101010101010101n)) { throw v }
        let k = r32(x00)
        if (k !== v256(0x0000000000000000000000000000000000000000000000000000000000000000n)) { throw k }
        // d.
        // 256 + 8 + 168 + 168 = 600
        const vv = concat(v, x00, xi2o, h1b2o)
        const vvu =
            0x0101010101010101010101010101010101010101010101010101010101010101_00_009A4D6792295A7F730FC3F2B49CBC0F62E862272F_01795EDF0D54DB760F156D0DAC04C0322B3A204224n
        if (vv !== v600(vvu)) { throw [(vv as any).toString(16), vvu.toString(16)] }
        k = hmac256(k)(vv)
        if (k !== v256(0x09999A9BFEF972D3346911883FAD7951D23F2C8B47F420222D1171EEEEAC5AB8n)) { throw k }
        // e.
        v = hmac256(k)(v)
        if (v !== v256(0xD5F4030F755EE86AA10BBA8C09DF114FF6B6111C238500D13C7343A8C01BECF7n)) { throw v }
        // f. K = HMAC_K(V || 0x01 || int2octets(x) || bits2octets(h1))
        k = hmac256(k)(concat(v, x01, xi2o, h1b2o))
        if (k !== v256(0x0CF2FE96D5619C9EF53CB7417D49D37EA68A4FFED0D7E623E38689289911BD57n)) { throw k }
        // g.
        v = hmac256(k)(v)
        if (v !== v256(0x783457C1CF3148A8F2A9AE73ED472FA98ED9CD925D8E964CE0764DEF3F842B9An)) { throw v }
        // h.
        v = hmac256(k)(v)
        let t = msb.concat(empty)(v)
        if (t !== v256(0x9305A46DE7FF8EB107194DEBD3FD48AA20D5E7656CBE0EA69D2A8D4E7C67314An)) { throw t }
        // 3.
        let kk = bits2int(t)
        if (kk !== 0x4982D236F3FFC758838CA6F5E9FEA455106AF3B2Bn) { throw kk }
        // 3. second try
        k = hmac256(k)(concat(v, x00))
        if (k !== v256(0x75CB5C05B2A78C3D81DF12D74D7BE0A0E94AB19815781D4D8E2902A79D0A6699n)) { throw k }
        v = hmac256(k)(v)
        if (v !== v256(0xDCB9CA126107A9C27CE77BA58EA871C8C912D835EADDC305F2445D88F66C4C43n)) { throw v }
        v = hmac256(k)(v)
        t = msb.concat(empty)(v)
        if (t !== v256(0xC70C78608A3B5BE9289BE90EF6E81A9E2C1516D5751D2F75F50033E45F73BDEBn)) { throw t }
        kk = bits2int(t)
        if (kk !== 0x63863C30451DADF4944DF4877B740D4F160A8B6ABn) { throw kk }
        // 3. third try
        k = hmac256(k)(concat(v, x00))
        if (k !== v256(0x0A5A64B99C059520103686CB6F36BCFCA788EB3BCF69BA66A5BB080B0593BA53n)) { throw k }
        v = hmac256(k)(v)
        if (v !== v256(0x0B3B196811B19F6C6F729C43F35BCF0DFD725F17CA3430E8721453E55550A18Fn)) { throw v }
        v = hmac256(k)(v)
        t = msb.concat(empty)(v)
        if (t !== v256(0x475E80E992140567FCC3A50DAB90FE84BCD7BB03638E9C4656A06F37F6508A7Cn)) { throw t }
        kk = bits2int(t)
        if (kk !== 0x23AF4074C90A02B3FE61D286D5C87F425E6BDD81Bn) { throw kk }
    },
    computeK: () => {
        const q = 0x4000000000000000000020108A2E0CC0D99F8A5EFn
        const a = all(q)
        if (a.qlen !== 163n) { throw a.qlen }
        const x = 0x09A4D6792295A7F730FC3F2B49CBC0F62E862272Fn
        const k = computeK(a)(sha256)(x)(sample)
        if (k !== 0x23AF4074C90A02B3FE61D286D5C87F425E6BDD81Bn) { throw k }
    },
    a: () =>{
        type H = Array4<bigint>
        type P = {
            readonly q: bigint
            readonly x: bigint
            readonly s: H
            readonly t: H
        }
        type S = { readonly [key: string]: P }
        const check = ({ q, x, s, t }: P) => {
            const a = all(q)
            const check = (s: Sha2, expected: bigint, m: Vec) => {
                const k = computeK(a)(s)(x)(m)
                if (k !== expected) { throw [k, expected] }
            }
            const check4 = (m: Vec, h: H) => {
                check(sha224, h[0], m)
                check(sha256, h[1], m)
                check(sha384, h[2], m)
                check(sha512, h[3], m)
            }
            check4(sample, s)
            check4(test, t)
        }
        const testVectors: S = {
            a21: {
                q: 0x996F967F6C8E388D9E28D01E205FBA957A5698B1n,
                x: 0x411602CB19A6CCC34494D79D98EF1E7ED5AF25F7n,
                s: [
                    0x562097C06782D60C3037BA7BE104774344687649n,
                    0x519BA0546D0C39202A7D34D7DFA5E760B318BCFBn,
                    0x95897CD7BBB944AA932DBC579C1C09EB6FCFC595n,
                    0x09ECE7CA27D0F5A4DD4E556C9DF1D21D28104F8Bn
                ],
                t: [
                    0x4598B8EFC1A53BC8AECD58D1ABBB0C0C71E67297n,
                    0x5A67592E8128E03A417B0484410FB72C0B630E1An,
                    0x220156B761F6CA5E6C9F1B9CF9C24BE25F98CD89n,
                    0x65D2C2EEB175E370F28C75BFCDC028D22C7DBE9Cn
                ]
            },
            a22: {
                q: 0xF2C3119374CE76C9356990B465374A17F23F9ED35089BD969F61C6DDE9998C1Fn,
                x: 0x69C7548C21D0DFEA6B9A51C9EAD4E27C33D3B3F180316E5BCAB92C933F0E4DBCn,
                s: [
                    0xBC372967702082E1AA4FCE892209F71AE4AD25A6DFD869334E6F153BD0C4D806n,
                    0x8926A27C40484216F052F4427CFD5647338B7B3939BC6573AF4333569D597C52n,
                    0xC345D5AB3DA0A5BCB7EC8F8FB7A7E96069E03B206371EF7D83E39068EC564920n,
                    0x5A12994431785485B3F5F067221517791B85A597B7A9436995C89ED0374668FCn,
                ],
                t: [
                    0x06BD4C05ED74719106223BE33F2D95DA6B3B541DAD7BFBD7AC508213B6DA6670n,
                    0x1D6CE6DDA1C5D37307839CD03AB0A5CBB18E60D800937D67DFB4479AAC8DEAD7n,
                    0x206E61F73DBE1B2DC8BE736B22B079E9DACD974DB00EEBBC5B64CAD39CF9F91Cn,
                    0xAFF1651E4CD6036D57AA8B2A05CCF1A9D5A40166340ECBBDC55BE10B568AA0AAn,
                ],
            },
        }
        for (const v of Object.values(testVectors)) {
            check(v)
        }
    }
    /*
    kk: () => {
        const a = fromCurve(curve(secp192r1))
        const x = 0x6FAB034934E4C0FC9AE67F5B5659A9D7D1FEFD187EE09FD4n
        const m = utf8("sample")
        const kk = k(a)(sha224)(x)(m)
        if (kk !== 0x4381526B3FC1E7128F202E194505592F01D5FF4C5AF015D8n) { throw kk }
    }
    */
}
