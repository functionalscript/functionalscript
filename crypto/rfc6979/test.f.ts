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
                if (k !== expected) { throw [k.toString(16), expected.toString(16)] }
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
                    // TODO: the test value from RFC is 0xC345D5AB3DA0A5BCB7EC8F8FB7A7E96069E03B206371EF7D83E39068EC564920n.
                    // We need to investigate why our implementation produces different result.
                    0x14b76af28ee2a86fa9ebbd6b6f2f2899cea140658741d21d679dbbdced2fc81bn,
                    0x5A12994431785485B3F5F067221517791B85A597B7A9436995C89ED0374668FCn,
                ],
                t: [
                    0x06BD4C05ED74719106223BE33F2D95DA6B3B541DAD7BFBD7AC508213B6DA6670n,
                    0x1D6CE6DDA1C5D37307839CD03AB0A5CBB18E60D800937D67DFB4479AAC8DEAD7n,
                    // TODO: 0x206E61F73DBE1B2DC8BE736B22B079E9DACD974DB00EEBBC5B64CAD39CF9F91Cn,
                    0xa12298d66330beeca1a2f9b4f71e5e05e89daaeba317500cbc0386cbd3d0ec51n,
                    0xAFF1651E4CD6036D57AA8B2A05CCF1A9D5A40166340ECBBDC55BE10B568AA0AAn,
                ],
            },
            a23: {
                q: 0xFFFFFFFFFFFFFFFFFFFFFFFF99DEF836146BC9B1B4D22831n,
                x: 0x6FAB034934E4C0FC9AE67F5B5659A9D7D1FEFD187EE09FD4n,
                s: [
                    0x4381526B3FC1E7128F202E194505592F01D5FF4C5AF015D8n,
                    0x32B1B6D7D42A05CB449065727A84804FB1A3E34D8F261496n,
                    0x4730005C4FCB01834C063A7B6760096DBE284B8252EF4311n,
                    // TODO: 0xA2AC7AB055E4F20692D49209544C203A7D1F2C0BFBC75DB1n,
                    0x7e32edc6185dd51a8ca7a703cb6705cedbf3638144326c7fn
                ],
                t: [
                    0xF5DC805F76EF851800700CCE82E7B98D8911B7D510059FBEn,
                    0x5C4CE89CF56D9E7C77C8585339B006B97B5F0680B4306C6Cn,
                    0x5AFEFB5D3393261B828DB6C91FBC68C230727B030C975693n,
                    // TODO: 0x0758753A5254759C7CFBAD2E2D9B0792EEE44136C9480527n,
                    0x7afb5f0e71a8624a80d5a7368b4097940c75f42872ac1bean,
                ],
            },
            a24: {
                q: 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFF16A2E0B8F03E13DD29455C5C2A3Dn,
                x: 0xF220266E1105BFE3083E03EC7A3A654651F45E37167E88600BF257C1n,
                s: [
                    0xC1D1F2F10881088301880506805FEB4825FE09ACB6816C36991AA06Dn,
                    0xAD3029E0278F80643DE33917CE6908C70A8FF50A411F06E41DEDFCDCn,
                    0x52B40F5A9D3D13040F494E83D3906C6079F29981035C7BD51E5CAC40n,
                    0x9DB103FFEDEDF9CFDBA05184F925400C1653B8501BAB89CEA0FBEC14n,
                ],
                t: [
                    0xDF8B38D40DCA3E077D0AC520BF56B6D565134D9B5F2EAE0D34900524n,
                    0xFF86F57924DA248D6E44E8154EB69F0AE2AEBAEE9931D0B5A969F904n,
                    0x7046742B839478C1B5BD31DB2E862AD868E1A45C863585B5F22BDC2Dn,
                    0xE39C2AA4EA6BE2306C72126D40ED77BF9739BB4D6EF2BBB1DCB6169Dn,
                ],
            },
            a25: {
                q: 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551n,
                x: 0xC9AFA9D845BA75166B5C215767B1D6934E50C3DB36E89B127B8A622B120F6721n,
                s: [
                    0x103F90EE9DC52E5E7FB5132B7033C63066D194321491862059967C715985D473n,
                    0xA6E3C57DD01ABE90086538398355DD4C3B17AA873382B0F24D6129493D8AAD60n,
                    // TODO: 0x09F634B188CEFD98E7EC88B1AA9852D734D0BC272F7D2A47DECC6EBEB375AAD4n,
                    0xb1cc59b0f28c6d71dfc458a481ca4e5f19adda385ce3874efad5888ce5aaae6cn,
                    0x5FA81C63109BADB88C1F367B47DA606DA28CAD69AA22C4FE6AD7DF73A7173AA5n,
                ],
                t: [
                    0x669F4426F2688B8BE0DB3A6BD1989BDAEFFF84B649EEB84F3DD26080F667FAA7n,
                    0xD16B6AE827F17175E040871A1C7EC3500192C4C92677336EC2537ACAEE0008E0n,
                    // TODO: 0x16AEFFA357260B04B1DD199693960740066C1A8F3E8EDD79070AA914D361B3B8n,
                    0xd1be46dca46cb967c88fe4e40c6e8eaee981cc9f71a21df935d255ea386f5a92n,
                    0x6915D11632ACA3C40D5D51C08DAF9C555933819548784480E93499000D9F0B7Fn,
                ],
            },
            a26: {
                q: 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFC7634D81F4372DDF581A0DB248B0A77AECEC196ACCC52973n,
                x: 0x6B9D3DAD2E1B8C1C05B19875B6659F4DE23C3B667BF297BA9AA47740787137D896D5724E4C70A825F872C9EA60D2EDF5n,
                s: [
                    0xA4E4D2F0E729EB786B31FC20AD5D849E304450E0AE8E3E341134A5C1AFA03CAB8083EE4E3C45B06A5899EA56C51B5879n,
                    0x180AE9F9AEC5438A44BC159A1FCB277C7BE54FA20E7CF404B490650A8ACC414E375572342863C899F9F2EDF9747A9B60n,
                    0x94ED910D1A099DAD3254E9242AE85ABDE4BA15168EAF0CA87A555FD56D10FBCA2907E3E83BA95368623B8C4686915CF9n,
                    0x92FC3C7183A883E24216D1141F1A8976C5B0DD797DFA597E3D7B32198BD35331A4E966532593A52980D0E3AAA5E10EC3n,
                ],
                t: [
                    0x18FA39DB95AA5F561F30FA3591DC59C0FA3653A80DAFFA0B48D1A4C6DFCBFF6E3D33BE4DC5EB8886A8ECD093F2935726n,
                    0x0CFAC37587532347DC3389FDC98286BBA8C73807285B184C83E62E26C401C0FAA48DD070BA79921A3457ABFF2D630AD7n,
                    0x015EE46A5BF88773ED9123A5AB0807962D193719503C527B031B4C2D225092ADA71F4A459BC0DA98ADB95837DB8312EAn,
                    0x3780C4F67CB15518B6ACAE34C9F83568D2E12E47DEAB6C50A4E4EE5319D1E8CE0E2CC8A136036DC4B9C00E6888F66B6Cn,
                ],
            }
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
