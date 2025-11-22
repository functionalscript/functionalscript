import { utf8 } from "../../text/module.f.ts"
import { empty, listToVec, msb, repeat, vec } from "../../types/bit_vec/module.f.ts"
import { hmac } from "../hmac/module.f.ts"
import { curve, secp192r1 } from "../secp/module.f.ts"
import { computeSync, sha224, sha256 } from "../sha2/module.f.ts"
import { all, fromCurve, k } from "./module.f.ts"

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
        const q = 0x4000000000000000000020108A2E0CC0D99F8A5EFn
        const { qlen, int2octets, bits2octets } = all(q)
        if (qlen !== 163n) { throw qlen }
        const x = 0x09A4D6792295A7F730FC3F2B49CBC0F62E862272Fn
        const m = utf8("sample")
        const h1 = computeSync(sha256)([m])
        if (h1 !== vec(256n)(0xAF2BDBE1AA9B6EC1E2ADE1D694F41FC71A831D0268E9891562113D8A62ADD1BFn)) { throw h1 }
        const xi2o = int2octets(x)
        if (xi2o !== vec(168n)(0x009A4D6792295A7F730FC3F2B49CBC0F62E862272Fn)) { throw xi2o }
        const h1b2o = bits2octets(h1)
        if (h1b2o !== vec(168n)(0x01795EDF0D54DB760F156D0DAC04C0322B3A204224n)) { throw h1b2o }
        let v = repeat(32n)(vec(8n)(0x01n))
        if (v !== vec(256n)(0x0101010101010101010101010101010101010101010101010101010101010101n)) { throw v }
        let k = repeat(32n)(vec(8n)(0x00n))
        if (k !== vec(256n)(0x0000000000000000000000000000000000000000000000000000000000000000n)) { throw k }
        // d.
        // 256 + 8 + 168 + 168 = 600
        const vv = listToVec(msb)([v, vec(8n)(0x00n), xi2o, h1b2o])
        const vvu =
            0x0101010101010101010101010101010101010101010101010101010101010101_00_009A4D6792295A7F730FC3F2B49CBC0F62E862272F_01795EDF0D54DB760F156D0DAC04C0322B3A204224n
        if (vv !== vec(600n)(vvu)) { throw [(vv as any).toString(16), vvu.toString(16)] }
        k = hmac(sha256)(k)(vv)
        if (k !== vec(256n)(0x09999A9BFEF972D3346911883FAD7951D23F2C8B47F420222D1171EEEEAC5AB8n)) { throw k}
        // e.
        v = hmac(sha256)(k)(v)
        if (v !== vec(256n)(0xD5F4030F755EE86AA10BBA8C09DF114FF6B6111C238500D13C7343A8C01BECF7n)) { throw v }
        // f. K = HMAC_K(V || 0x01 || int2octets(x) || bits2octets(h1))
        k = hmac(sha256)(k)(listToVec(msb)([v, vec(8n)(0x01n), xi2o, h1b2o]))
        if (k !== vec(256n)(0x0CF2FE96D5619C9EF53CB7417D49D37EA68A4FFED0D7E623E38689289911BD57n)) { throw k }
        // g.
        v = hmac(sha256)(k)(v)
        if (v !== vec(256n)(0x783457C1CF3148A8F2A9AE73ED472FA98ED9CD925D8E964CE0764DEF3F842B9An)) { throw v }
        // h.
        v = hmac(sha256)(k)(v)
        let t = msb.concat(empty)(v)
        if (t !== vec(256n)(0x9305A46DE7FF8EB107194DEBD3FD48AA20D5E7656CBE0EA69D2A8D4E7C67314An)) { throw t }
    },
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
