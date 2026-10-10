/**
 * @import { FixedArray } from '../../types/array/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Curve, Point } from '../secp/types.ts'
 * @import { Sha2 } from '../sha2/types.ts'
 * @import { DemoSigned } from './types.ts'
 */

import { utf8 } from '../../text/module.f.mjs'
import { empty, msb, repeat, vec, vec8 } from '../../types/bit_vec/module.f.mjs'
import { hmac } from '../hmac/module.f.mjs'
import { sqrt } from '../../types/prime_field/module.f.mjs'
import { curve, secp192r1, secp256k1, secp256r1, secp384r1, secp521r1 } from '../secp/module.f.mjs'
import { computeSync, sha224, sha256, sha384, sha512 } from '../sha2/module.f.mjs'
import { all, computeK, fromCurve, sign, verify } from './module.f.mjs'
import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.mjs'
import { demo, parseHexField, signed } from './demo.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { maxLengthBytes } from '../../types/bit_vec/module.f.mjs'

const sample = utf8("sample")
const test = utf8("test")

// Toy curves of order 5 over a field of 7, where `R.x` can reach `q` and
// beyond: the cases a 256-bit curve hits with probability about 2^-128.
// `y^2 = x^3 + x + 4`, whose points have `x` of 4 or 6.
const toy4 = curve({ p: 7n, c: [4n, 1n], g: [4n, 3n], n: 5n })
// `y^2 = x^3 + x + 1`, with a point at `x = 0`.
const toy1 = curve({ p: 7n, c: [1n, 1n], g: [0n, 1n], n: 5n })

const { concat, listToVec } = msb

const x00 = vec8(0x00n)
const x01 = vec8(0x01n)

const v168 = vec(168n)
const v256 = vec(256n)
const v600 = vec(600n)
const r32 = repeat(32n)
const hmac256 = hmac(sha256)

/**
 * Walks one RFC 6979 A.2 test vector: the messages `sample` and `test`, each
 * under the four SHA-2 variants, in the order the RFC lists them. `check`
 * asserts one `(sha, expected, message)` case.
 *
 * @type {<E>(check: (sha: Sha2, expected: E, m: Vec) => void, msg0: FixedArray<4, E>, msg1: FixedArray<4, E>) => void}
 */
const forEachVector = (check, msg0, msg1) => {
    /** @type {(m: Vec, h: typeof msg0) => void} */
    const check4 = (m, h) => {
        check(sha224, h[0], m)
        check(sha256, h[1], m)
        check(sha384, h[2], m)
        check(sha512, h[3], m)
    }
    check4(sample, msg0)
    check4(test, msg1)
}

export const proof = {
    bits2int: () => {
        assertEq(all(7n).bits2int(vec(5n)(0b10100n)), 0b101n, new Error("fail"))
        assertEq(all(17n).bits2int(vec(3n)(0b101n)), 0b101n, new Error("fail"))
    },
    int2octets: () => {
        // 3 bit prime
        assertEq(all(5n).int2octets(0b101n), vec(8n)(0b0000_0101n), new Error("fail"))
        // 5 bit prime
        assertEq(all(17n).int2octets(0b10100n), vec(8n)(0b0001_0100n), new Error("fail"))
        // 15 bit prime
        assertEq(all(16_387n).int2octets(0x13n), vec(16n)(0x13n), new Error("fail"))
    },
    bits2intModQ: () => {
        // 0b1101 = 13 reduces to 13 - 11 = 2
        assertEq(all(11n).bits2intModQ(vec(4n)(0b1101n)), 2n)
        assertEq(all(17n).bits2intModQ(vec(3n)(0b101n)), 0b101n)
    },
    bit2octets: () => {
        assertEq(all(11n).bits2octets(vec(4n)(0b1101n)), vec(8n)(0b0000_0010n), new Error("fail"))
    },
    fromCurve: () => {
        const { rfc6979, nf, mul, g } = fromCurve(secp192r1)
        assertEq(rfc6979.q, secp192r1.nf.p)
        assertEq(nf, secp192r1.nf)
        assertEq(mul, secp192r1.mul)
        assertEq(g, secp192r1.g)
    },
    k: () => {
        //
        const q = 0x4_0000_0000_0000_0000_0002_0108_A2E0_CC0D_99F8_A5EFn
        const { qlen, int2octets, bits2octets, bits2int } = all(q)
        assertEq(qlen, 163n)
        const x = 0x0_9A4D_6792_295A_7F73_0FC3_F2B4_9CBC_0F62_E862_272Fn
        const h1 = computeSync(sha256)([sample])
        assertEq(h1, v256(0xAF2B_DBE1_AA9B_6EC1_E2AD_E1D6_94F4_1FC7_1A83_1D02_68E9_8915_6211_3D8A_62AD_D1BFn))
        const xi2o = int2octets(x)
        assertEq(xi2o, v168(0x00_9A4D_6792_295A_7F73_0FC3_F2B4_9CBC_0F62_E862_272Fn))
        const h1b2o = bits2octets(h1)
        assertEq(h1b2o, v168(0x01_795E_DF0D_54DB_760F_156D_0DAC_04C0_322B_3A20_4224n))
        let v = r32(x01)
        assertEq(v, v256(0x0101_0101_0101_0101_0101_0101_0101_0101_0101_0101_0101_0101_0101_0101_0101_0101n))
        let k = r32(x00)
        assertEq(k, v256(0x0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n))
        // d.
        // 256 + 8 + 168 + 168 = 600
        const vv = listToVec([v, x00, xi2o, h1b2o])
        const vvu =
            0x01_0101_0101_0101_0101_0101_0101_0101_0101_0101_0101_0101_0101_0101_0101_0101_0100_009A_4D67_9229_5A7F_730F_C3F2_B49C_BC0F_62E8_6227_2F01_795E_DF0D_54DB_760F_156D_0DAC_04C0_322B_3A20_4224n
        assertEq(vv, v600(vvu), [(/** @type {any} */ (vv)).toString(16), vvu.toString(16)])
        k = hmac256(k)(vv)
        assertEq(k, v256(0x0999_9A9B_FEF9_72D3_3469_1188_3FAD_7951_D23F_2C8B_47F4_2022_2D11_71EE_EEAC_5AB8n))
        // e.
        v = hmac256(k)(v)
        assertEq(v, v256(0xD5F4_030F_755E_E86A_A10B_BA8C_09DF_114F_F6B6_111C_2385_00D1_3C73_43A8_C01B_ECF7n))
        // f. K = HMAC_K(V || 0x01 || int2octets(x) || bits2octets(h1))
        k = hmac256(k)(listToVec([v, x01, xi2o, h1b2o]))
        assertEq(k, v256(0x0CF2_FE96_D561_9C9E_F53C_B741_7D49_D37E_A68A_4FFE_D0D7_E623_E386_8928_9911_BD57n))
        // g.
        v = hmac256(k)(v)
        assertEq(v, v256(0x7834_57C1_CF31_48A8_F2A9_AE73_ED47_2FA9_8ED9_CD92_5D8E_964C_E076_4DEF_3F84_2B9An))
        // h.
        v = hmac256(k)(v)
        let t = concat(empty)(v)
        assertEq(t, v256(0x9305_A46D_E7FF_8EB1_0719_4DEB_D3FD_48AA_20D5_E765_6CBE_0EA6_9D2A_8D4E_7C67_314An))
        // 3.
        let kk = bits2int(t)
        assertEq(kk, 0x4_982D_236F_3FFC_7588_38CA_6F5E_9FEA_4551_06AF_3B2Bn)
        // 3. second try
        k = hmac256(k)(concat(v)(x00))
        assertEq(k, v256(0x75CB_5C05_B2A7_8C3D_81DF_12D7_4D7B_E0A0_E94A_B198_1578_1D4D_8E29_02A7_9D0A_6699n))
        v = hmac256(k)(v)
        assertEq(v, v256(0xDCB9_CA12_6107_A9C2_7CE7_7BA5_8EA8_71C8_C912_D835_EADD_C305_F244_5D88_F66C_4C43n))
        v = hmac256(k)(v)
        t = concat(empty)(v)
        assertEq(t, v256(0xC70C_7860_8A3B_5BE9_289B_E90E_F6E8_1A9E_2C15_16D5_751D_2F75_F500_33E4_5F73_BDEBn))
        kk = bits2int(t)
        assertEq(kk, 0x6_3863_C304_51DA_DF49_44DF_4877_B740_D4F1_60A8_B6ABn)
        // 3. third try
        k = hmac256(k)(concat(v)(x00))
        assertEq(k, v256(0x0A5A_64B9_9C05_9520_1036_86CB_6F36_BCFC_A788_EB3B_CF69_BA66_A5BB_080B_0593_BA53n))
        v = hmac256(k)(v)
        assertEq(v, v256(0x0B3B_1968_11B1_9F6C_6F72_9C43_F35B_CF0D_FD72_5F17_CA34_30E8_7214_53E5_5550_A18Fn))
        v = hmac256(k)(v)
        t = concat(empty)(v)
        assertEq(t, v256(0x475E_80E9_9214_0567_FCC3_A50D_AB90_FE84_BCD7_BB03_638E_9C46_56A0_6F37_F650_8A7Cn))
        kk = bits2int(t)
        assertEq(kk, 0x2_3AF4_074C_90A0_2B3F_E61D_286D_5C87_F425_E6BD_D81Bn)
    },
    computeK: () => {
        const q = 0x4_0000_0000_0000_0000_0002_0108_A2E0_CC0D_99F8_A5EFn
        const a = all(q)
        assertEq(a.qlen, 163n)
        const x = 0x0_9A4D_6792_295A_7F73_0FC3_F2B4_9CBC_0F62_E862_272Fn
        const k = computeK(a)(sha256)(x)(sample)
        assertEq(k, 0x2_3AF4_074C_90A0_2B3F_E61D_286D_5C87_F425_E6BD_D81Bn)
    },
    investigate: () => {
        const q = 0xF2C3_1193_74CE_76C9_3569_90B4_6537_4A17_F23F_9ED3_5089_BD96_9F61_C6DD_E999_8C1Fn
        const x = 0x69C7_548C_21D0_DFEA_6B9A_51C9_EAD4_E27C_33D3_B3F1_8031_6E5B_CAB9_2C93_3F0E_4DBCn
        const a = all(q)
        const k = computeK(a)(sha384)(x)(sample)
        assertEq(k, 0xC345_D5AB_3DA0_A5BC_B7EC_8F8F_B7A7_E960_69E0_3B20_6371_EF7D_83E3_9068_EC56_4920n)
    },
    kk: () => {
        const a = fromCurve(secp192r1).rfc6979
        const x = 0x6FAB_0349_34E4_C0FC_9AE6_7F5B_5659_A9D7_D1FE_FD18_7EE0_9FD4n
        const m = utf8("sample")
        const kk = computeK(a)(sha224)(x)(m)
        assertEq(kk, 0x4381_526B_3FC1_E712_8F20_2E19_4505_592F_01D5_FF4C_5AF0_15D8n)
    },
    a2: () =>{
        /** @typedef {FixedArray<4, bigint>} _H */
        /**
         * @typedef {object} _P
         * @property {bigint} q
         * @property {bigint} x
         * @property {_H} msg0
         * @property {_H} msg1
         */
        /** @type {(p: _P) => void} */
        const check = ({ q, x, msg0, msg1 }) => {
            const a = all(q)
            forEachVector((sha, expected, m) => {
                const k = computeK(a)(sha)(x)(m)
                assertEq(k, expected, [k.toString(16), expected.toString(16)])
            }, msg0, msg1)
        }
        /** @type {{ readonly [key: string]: _P }} */
        const testVectors = {
            x1: {
                q: 0x996F_967F_6C8E_388D_9E28_D01E_205F_BA95_7A56_98B1n,
                x: 0x4116_02CB_19A6_CCC3_4494_D79D_98EF_1E7E_D5AF_25F7n,
                msg0: [
                    0x5620_97C0_6782_D60C_3037_BA7B_E104_7743_4468_7649n,
                    0x519B_A054_6D0C_3920_2A7D_34D7_DFA5_E760_B318_BCFBn,
                    0x9589_7CD7_BBB9_44AA_932D_BC57_9C1C_09EB_6FCF_C595n,
                    0x09EC_E7CA_27D0_F5A4_DD4E_556C_9DF1_D21D_2810_4F8Bn
                ],
                msg1: [
                    0x4598_B8EF_C1A5_3BC8_AECD_58D1_ABBB_0C0C_71E6_7297n,
                    0x5A67_592E_8128_E03A_417B_0484_410F_B72C_0B63_0E1An,
                    0x2201_56B7_61F6_CA5E_6C9F_1B9C_F9C2_4BE2_5F98_CD89n,
                    0x65D2_C2EE_B175_E370_F28C_75BF_CDC0_28D2_2C7D_BE9Cn
                ]
            },
            x3: {
                q: 0xFFFF_FFFF_FFFF_FFFF_FFFF_FFFF_99DE_F836_146B_C9B1_B4D2_2831n,
                x: 0x6FAB_0349_34E4_C0FC_9AE6_7F5B_5659_A9D7_D1FE_FD18_7EE0_9FD4n,
                msg0: [
                    0x4381_526B_3FC1_E712_8F20_2E19_4505_592F_01D5_FF4C_5AF0_15D8n,
                    0x32B1_B6D7_D42A_05CB_4490_6572_7A84_804F_B1A3_E34D_8F26_1496n,
                    0x4730_005C_4FCB_0183_4C06_3A7B_6760_096D_BE28_4B82_52EF_4311n,
                    0xA2AC_7AB0_55E4_F206_92D4_9209_544C_203A_7D1F_2C0B_FBC7_5DB1n
                ],
                msg1: [
                    0xF5DC_805F_76EF_8518_0070_0CCE_82E7_B98D_8911_B7D5_1005_9FBEn,
                    0x5C4C_E89C_F56D_9E7C_77C8_5853_39B0_06B9_7B5F_0680_B430_6C6Cn,
                    0x5AFE_FB5D_3393_261B_828D_B6C9_1FBC_68C2_3072_7B03_0C97_5693n,
                    0x0758_753A_5254_759C_7CFB_AD2E_2D9B_0792_EEE4_4136_C948_0527n,
                ],
            },
            x4: {
                q: 0xFFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_16A2_E0B8_F03E_13DD_2945_5C5C_2A3Dn,
                x: 0xF220_266E_1105_BFE3_083E_03EC_7A3A_6546_51F4_5E37_167E_8860_0BF2_57C1n,
                msg0: [
                    0xC1D1_F2F1_0881_0883_0188_0506_805F_EB48_25FE_09AC_B681_6C36_991A_A06Dn,
                    0xAD30_29E0_278F_8064_3DE3_3917_CE69_08C7_0A8F_F50A_411F_06E4_1DED_FCDCn,
                    0x52B4_0F5A_9D3D_1304_0F49_4E83_D390_6C60_79F2_9981_035C_7BD5_1E5C_AC40n,
                    0x9DB1_03FF_EDED_F9CF_DBA0_5184_F925_400C_1653_B850_1BAB_89CE_A0FB_EC14n,
                ],
                msg1: [
                    0xDF8B_38D4_0DCA_3E07_7D0A_C520_BF56_B6D5_6513_4D9B_5F2E_AE0D_3490_0524n,
                    0xFF86_F579_24DA_248D_6E44_E815_4EB6_9F0A_E2AE_BAEE_9931_D0B5_A969_F904n,
                    0x7046_742B_8394_78C1_B5BD_31DB_2E86_2AD8_68E1_A45C_8635_85B5_F22B_DC2Dn,
                    0xE39C_2AA4_EA6B_E230_6C72_126D_40ED_77BF_9739_BB4D_6EF2_BBB1_DCB6_169Dn,
                ],
            },
            x8: {
                q: 0x4_0000_0000_0000_0000_0002_0108_A2E0_CC0D_99F8_A5EFn,
                x: 0x0_9A4D_6792_295A_7F73_0FC3_F2B4_9CBC_0F62_E862_272Fn,
                msg0: [
                    0x3_23E7_B28B_FD64_E608_2F5B_1211_0AA8_7BC0_D6A6_E159n,
                    0x2_3AF4_074C_90A0_2B3F_E61D_286D_5C87_F425_E6BD_D81Bn,
                    0x2_132A_BE0E_D518_487D_3E4F_A7FD_24F8_BED1_F29C_CFCEn,
                    0x0_0BBC_C2F3_9939_388F_DFE8_4189_2537_EC7B_1FF3_3AA3n,
                ],
                msg1: [
                    0x0_91DD_986F_38EB_936B_E053_DD6A_CE34_19D2_642A_DE8Dn,
                    0x1_9364_9CE5_1F0C_FF07_84CF_C476_28F4_FA85_4A93_F7A2n,
                    0x3_7C73_C6F8_B404_EC83_DA17_A6EB_CA72_4B3F_F1F7_EEBAn,
                    0x3_31AD_98D3_186F_7396_7B1E_0B12_0C80_B1E2_2EFC_2988n,
                ],
            },
            x9: {
                q: 0x80_0000_0000_0000_0000_0000_0000_0006_9D5B_B915_BCD4_6EFB_1AD5_F173_ABDFn,
                x: 0x10_3B21_42BD_C2A3_C3B5_5080_D09D_F180_8F79_336D_A239_9F5C_A717_1D1B_E9B0n,
                msg0: [
                    0x71_626A_309D_9CD8_0AD0_B975_D757_FE6B_F4B8_4E49_F8F3_4C78_0070_D774_6F19n,
                    0x73_552F_9CAC_5774_F74F_485F_A253_871F_2109_A0C8_6040_552E_AA67_DBA9_2DC9n,
                    0x17_D726_A675_39C6_09BD_99E2_9AA3_737E_F247_724B_7145_5C3B_6310_0340_38C8n,
                    0x0E_535C_3287_74CD_E546_BE3A_F5D7_FCD2_6387_2F10_7E80_7435_105B_A2FD_C166n,
                ],
                msg1: [
                    0x67_634D_0ABA_2C9B_F7AE_5484_6F26_DCD1_66E7_1006_54BC_E6FD_C966_6763_1AA2n,
                    0x2C_E5AE_DC15_5ACC_0DDC_5E67_9EBA_CFD2_1308_362E_5EFC_05C5_E99B_2557_A8D7n,
                    0x1B_4BD3_903E_74FD_0B31_E23F_956C_7006_2014_DFEF_EE21_8320_32EA_5352_A055n,
                    0x17_75ED_919C_A491_B5B0_14C5_D5E8_6AF5_3578_B5A7_9763_78F1_92AF_665C_B705n,
                ],
            },
            x10: {
                q: 0x1FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_E9AE_2ED0_7577_265D_FF7F_9445_1E06_1E16_3C61n,
                x: 0x06A_0777_356E_87B8_9BA1_ED3A_3D84_5357_BE33_2173_C8F7_A65B_DC7D_B4FA_B3C4_CC79_ACC8_194En,
                msg0: [
                    0x1B4_C4E3_B2F6_B08B_5991_BD2B_DDE2_77A7_016D_A527_AD0A_AE5B_C61B_64C5_A0EE_63E8_B502_EF61n,
                    0x1CE_B9E8_E0DF_F53C_E687_DEB8_1339_ACA3_C98E_7A65_7D5A_9499_EF77_9F88_7A93_4408_ECBE_5A38n,
                    0x146_0A5C_4174_5A57_63A9_D548_AE62_F2C3_630B_BED7_1B6A_A549_D7F8_29C2_2442_A728_C5D9_65DAn,
                    0x00F_3B59_FCB5_C1A0_1A1A_2A00_19E9_8C24_4DFF_6150_2D6E_6B9C_4E95_7EDD_CEB2_58EF_4DBE_F04An,
                ],
                msg1: [
                    0x045_E13E_A645_CE01_D9B2_5EA3_8C8A_8A17_0E04_C83B_B7F2_31EE_3152_209F_E10E_C8B2_E565_536Cn,
                    0x0B5_85A7_A68F_5108_9691_D6ED_E2B4_3FC4_451F_66C1_0E65_F134_B963_D4CB_D4EB_844B_0E14_69A6n,
                    0x1E8_8738_E144_82A0_9EE1_6A73_D490_A7FE_8739_DF50_0039_538D_5C4B_6C8D_6D7F_208D_6CA5_6760n,
                    0x00E_5F24_A223_BD45_9653_F682_763C_3BB3_22D4_EE75_DD89_C63D_4DC6_1518_D543_E765_8507_6BBAn,
                ],
            },
            x11: {
                q: 0x7F_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FE5F_83B2_D4EA_2040_0EC4_557D_5ED3_E3E7_CA5B_4B5C_83B8_E01E_5FCFn,
                x: 0x29_C167_68F0_1D1B_8A89_FDA8_5E2E_FD73_A095_58B9_2A17_8A29_31F3_59E4_D70A_D853_E569_CDAF_16DA_A569_758F_B4E7_3089_E452_5D8B_BFCFn,
                msg0: [
                    0x51_2340_DB68_2C7B_8EBE_407B_F1AA_5419_4DFE_85D4_9025_FE0F_632C_9B8A_06A9_96F2_FCD0_D73C_752F_B09D_23DB_8FBE_5060_5DC2_5DF0_745Cn,
                    0x78_2385_F18B_AF5A_36A5_8863_7A76_DFAB_0573_9A14_163B_F723_A441_7B74_BD14_69D3_7AC9_E8CC_E6AE_C8FF_63F3_7B81_5AAF_14A8_76EE_D962n,
                    0x4D_A637_CB2E_5C90_E486_744E_45A7_3935_DD69_8D45_97E7_36DA_332A_06ED_A8B2_6D5A_BC61_53EC_2ECE_1498_1CF3_E5E0_23F3_6FFA_55EE_A6D7n,
                    0x57_055B_293E_CFDF_E983_CEF7_1616_6091_E573_275C_5390_6A39_EADC_25C8_9C5E_C8D7_A7E5_629F_CFDF_AD51_4E13_4816_1C9A_34EA_1C42_D58Cn,
                ],
                msg1: [
                    0x3C_5352_929D_4EBE_3CCE_87A2_DCE3_80F0_D2B3_3C90_1E61_ABC5_30DA_F350_6544_AB09_30AB_9BFD_553E_51FC_DA44_F06C_D2F4_9E17_E07D_B519n,
                    0x25_1E32_DEE1_0ED5_EA4A_D737_0DF3_EFF0_91E4_67D5_531C_A59D_E3AA_7917_6371_5E11_69AB_5E18_C2A1_1CD4_73B0_044F_B453_08E8_542F_2EB0n,
                    0x11_C540_EA46_C503_8FE2_8BB6_6E2E_9E9A_04C9_FE95_67AD_F33D_5674_5953_D44C_1DC8_B5B9_2922_F53A_174E_431C_0ED8_267D_9193_29F1_9014n,
                    0x59_527C_E953_BC09_DF5E_8515_5CAE_7BB1_D7F3_4226_5F41_6355_45B0_6044_F844_ECB4_FA64_76E7_D474_20AD_C804_1E75_460E_C0A4_EC76_0E95n,
                ],
            },
            x12: {
                q: 0x200_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_1318_50E1_F19A_63E4_B391_A8DB_917F_4138_B630_D84B_E5D6_3938_1E91_DEB4_5CFE_778F_637C_1001n,
                x: 0x0C1_6F58_550D_824E_D7B9_5569_D444_5375_D3A4_90BC_7E01_94C4_1A39_DEB7_32C2_9396_CDF1_D66D_E02D_D146_0A81_6606_F3BE_C0F3_2202_C7BD_18A3_2D87_5064_66AA_9203_2F13_14ED_7B19_762B_0D22n,
                msg0: [
                    0x0B5_99D0_68A1_A004_98EE_0B9A_D6F3_8852_1F59_4BD3_F234_E47F_7A1D_B649_0D7B_57D6_0B01_01B3_6F39_CC22_885F_7864_1C69_4112_7970_6F09_89E6_991E_5D5B_5361_9E43_EFB3_97E2_5E08_14EF_02BCn,
                    0x0F7_9D53_E63D_89FB_87F4_D9E6_DC59_49F5_D938_8BCF_E9EB_CB4C_2F7C_E497_814C_F40E_8457_05F8_F18D_BF0F_860D_E0B1_CC4A_433E_F74A_5741_F320_2E95_8C08_2E0B_76E1_6ECD_5866_AA0F_5F3D_F300n,
                    0x030_8253_C022_D25F_8A9E_BCD2_4459_DD65_9659_0BDE_C789_5618_EEE8_A262_3A98_D2A2_B2E7_594E_E6B7_AD3A_39D7_0D68_CB4E_D01C_B28E_2129_F8E2_CC0C_C8DC_7780_657E_28BC_D655_F0BE_9B7D_35A2n,
                    0x0C5_EE70_70AF_55F8_4EBC_43A0_D481_458C_EDE1_DCEB_B577_20A3_C92F_59B4_941A_044F_ECFF_4F70_3940_F312_1773_595E_8803_3377_2ACF_822F_2449_E17C_64DA_286B_CD65_711D_D5DA_44D7_155B_F004n,
                ],
                msg1: [
                    0x1DA_8750_65B9_D94D_BE75_C618_48D6_9578_BCC2_6793_5792_624F_9887_B53C_9AF9_E43C_ABFC_42E4_C3F9_A456_BA89_E717_D24F_1412_F33C_FD29_7A7A_4D40_3B18_B543_8654_C74D_592D_5022_125E_0C6Bn,
                    0x04D_DD07_07E8_1BB5_6EA2_D1D4_5D7F_AFDB_DD56_912C_AE22_4086_802F_EA10_18DB_306C_4FB8_D933_38DB_F684_1CE6_C6AB_1506_E9A8_48D2_C046_3E08_8926_8843_DEE4_ACB5_52CF_FCB8_5878_4ED1_16B2n,
                    0x014_1B53_DC6E_569D_8C0C_0718_A58A_5714_2045_02FD_A146_E7E2_133E_56D1_9E90_5B79_4134_5743_7095_DE13_CF68_B5CF_5C54_A1F2_E198_A55D_974F_C3E5_07AF_C0AC_F95E_D391_C93C_C79E_3B3F_E37Cn,
                    0x148_42F9_7F26_3587_A164_B215_DD0F_912C_588A_88DC_4AB6_AF4C_530A_DC12_26F1_6E08_6D62_C144_35E6_BFAB_56F0_1988_6C88_922D_2321_914E_E41A_8F74_6AAA_2B96_4822_E4AC_6F40_EE24_92B6_6824n,
                ],
            },
            x13: {
                q: 0x4_0000_0000_0000_0000_0002_92FE_77E7_0C12_A423_4C33n,
                x: 0x3_5318_FC44_7D48_D7E6_BC93_B486_17DD_DEDF_26AA_658Fn,
                msg0: [
                    0x3_B24C_5E2C_2D93_5314_EABF_57A6_4842_89B2_91AD_FE3Fn,
                    0x3_D708_6A59_E698_1064_A9CD_B684_653F_3A81_B6EC_0F0Bn,
                    0x3_B1E4_4434_4348_6C72_51A6_8EF1_84A9_36F0_5F8B_17C7n,
                    0x2_EDF5_CFCA_C755_3C17_421F_DF54_AD1D_2EF9_28A8_79D2n,
                ],
                msg1: [
                    0x3_4F46_DE59_606D_56C7_5406_BFB4_5953_7A7C_C280_AA62n,
                    0x3_8145_E3FF_CA94_E4DD_ACC2_0AD6_E099_7BD0_E3B6_69D2n,
                    0x3_7581_3210_ECE9_C4D7_AB42_DDC3_C55F_8918_9CF6_DFFDn,
                    0x2_5AD8_B393_BC1E_9363_600F_DA1A_2AB6_DF40_0791_79A3n,
                ]
            },
            x14: {
                q: 0x100_0000_0000_0000_0000_0000_0000_0013_E974_E72F_8A69_2203_1D26_03CF_E0D7n,
                x: 0x07A_DC13_DD5B_F34D_1DDE_EB50_B2CE_23B5_F5E6_D180_6730_6D60_C5F6_FF11_E5D3n,
                msg0: [
                    0x0F2_B1C1_E80B_EB58_283A_AA79_857F_7B83_BDF7_2412_0D09_1360_6FD0_7F7F_FB2Cn,
                    0x034_A538_97B0_BBDB_4843_02E1_9BF3_F9B3_4A2A_BFED_639D_109A_388D_C520_06B5n,
                    0x04D_4670_B289_90BC_92EE_B498_40B4_82A1_FA03_FE02_8D09_F3D2_1F89_C67E_CA85n,
                    0x0DE_108A_AADA_760A_14F4_2C05_7EF8_1C0A_31AF_6B82_E8FB_CA8D_C86E_443A_B549n,
                ],
                msg1: [
                    0x07B_DB6A_7FD0_80D9_EC2F_C84B_FF9E_3E15_7507_89DC_0429_0C84_FED0_0E10_9BBDn,
                    0x003_7688_6E89_013F_7FF4_B521_4D56_A30D_49C9_9F53_F211_A3AF_E01A_A2BD_E12Dn,
                    0x037_2687_0DE7_5613_C5E5_29E4_53F4_D926_31C0_3D08_A7F6_3813_E497_D4CB_3877n,
                    0x09C_E581_0F1A_C688_10B0_DFFB_B6BE_EF2E_0053_BB93_7969_AE78_86F9_D064_A8C4n,
                ],
            },
            x15: {
                q: 0x3FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_EF90_3996_60FC_938A_9016_5B04_2A7C_EFAD_B307n,
                x: 0x145_10D4_BC44_F2D2_6F45_5394_2C98_073C_1BD3_5545_CEAB_B5CC_1388_53C5_158D_2729_EA40_8836n,
                msg0: [
                    0x14C_C8FC_FEEC_D6B9_99B4_DC60_84EB_B06F_DED0_B44D_5C50_7802_CC7A_5E9E_CF36_E69D_A6AE_23C6n,
                    0x38C_9D66_2188_9829_43E0_80B7_94A4_CFB0_732D_BA37_C6F4_0D5B_8CFA_DED6_FF31_C545_2BA3_F877n,
                    0x21B_7265_DEBF_90E6_F988_CFFD_B62B_121A_0210_5226_C652_807C_C324_ED6F_B119_A287_A726_80ABn,
                    0x205_8325_9DC1_79D9_DA8E_5387_E89B_FF2A_3090_788C_F149_6BCA_BFE7_D45B_B120_B0C8_11EB_8980n,
                ],
                msg1: [
                    0x2E5_C1F0_0677_A0E0_15EC_3F79_9FA9_E9A0_0430_9DBD_7846_40EA_AF5E_1CE6_4D30_45B9_FE9C_1FA1n,
                    0x018_A7D4_4F2B_4341_FEFE_68F6_BD88_9496_0F97_E081_24AA_B92C_1FFB_BE90_450F_CC93_56C9_AAA5n,
                    0x3C7_5397_BA4C_F1B9_3187_7076_AF29_F2E2_F423_1B11_7AB4_B8E0_39F7_F970_4DE1_BD35_22F1_50B6n,
                    0x14E_66B1_8441_FA54_C21E_3492_D061_1D2B_48E1_9DE3_108D_915F_D5CA_08E7_8632_7A26_75F1_1074n,
                ],
            },
            x16: {
                q: 0x100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_01E2_AAD6_A612_F333_07BE_5FA4_7C3C_9E05_2F83_8164_CD37_D9A2_1173n,
                x: 0x049_4994_CC32_5B08_E7B4_CE03_8BD9_436F_90B5_E59A_2C13_C314_0CD3_AE07_C04A_01FC_489F_572C_E056_9A6D_B7B8_0603_93DE_7633_0C62_4177n,
                msg0: [
                    0x0C9_33F1_DC4C_7083_8C2A_D165_6471_5ACA_F545_BCDD_8DC2_03D2_5AF3_EC63_949C_65CB_2E68_AC1F_60CA_7EAC_A2A8_23F4_E240_927A_A82C_EEC5n,
                    0x08E_C42D_13A3_909A_20C4_1BEB_D2DF_ED8C_ACCE_56C7_A7D1_251D_F43F_3E9E_289D_AE00_E239_F696_0924_AC45_1E12_5B78_4CB6_87C7_F232_83FDn,
                    0x0DA_881B_CE3B_A851_4858_79EF_8AC5_85A6_3F15_40B9_198E_CB8A_1096_D70C_B25A_104E_2F8A_96B1_08AE_76CB_49CF_3449_1ABC_70E9_D2AA_D450n,
                    0x075_0926_FFAD_7FF5_DE85_DF79_60B3_A4F9_E3D3_8CF5_A049_BFC8_9739_C48D_42B3_4FBE_E03D_2C04_7025_134C_C314_5B60_AFD2_2A68_DF0A_7FB2n,
                ],
                msg1: [
                    0x01A_DEB9_4C19_951B_460A_146B_8275_D816_38C0_7735_B38A_525D_7602_3AAF_26AA_8A05_8590_E1D5_B1E7_8AB3_C916_08BD_A67C_FFBE_6FC8_A6CCn,
                    0x06E_BA3D_58D0_E0DF_C406_D67F_C72E_F0C9_4362_4CF4_0019_D1E4_8C3B_54CC_AB05_94AF_D5DE_E30A_EBAA_22E6_93DB_CFEC_AD1A_85D7_7431_3DADn,
                    0x0A4_5B78_7DB4_4C06_DEAB_8465_11EE_DBF7_BFCF_D3BD_2C11_D965_C92F_C195_F673_28F3_6A2D_C83C_0352_885D_AB96_B55B_02FC_F49D_CCB0_E2DAn,
                    0x0B9_0F8A_0E75_7E81_D4EA_6891_7667_29C9_6A6D_01F9_AEDC_0D33_4932_D1F8_1CC4_E197_3A4F_01C3_3555_FF08_530A_5098_CADB_6EDA_E268_ABB5n,
                ],
            },
            x17: {
                q: 0x3FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_E661_CE18_FF55_9873_0805_9B18_6823_851E_C7DD_9CA1_161D_E93D_5174_D66E_8382_E9BB_2FE8_4E47n,
                x: 0x028_A048_57F2_4C1C_082D_F0D9_09C0_E72F_453F_2E23_40CC_B071_F0E3_89BC_A257_5DA1_9124_198C_5717_4929_AD26_E348_CF63_F78D_2802_1EF5_A9BF_2D5C_BEAF_6B7C_CB6C_4DA8_24DD_5C82_CFB2_4E11n,
                msg0: [
                    0x2EA_FAD4_AC86_44DE_B290_95BB_AA88_D19F_3131_6434_F176_6AD4_423E_0B54_DD2F_E0C0_5E30_7758_581B_0DAE_D290_2683_BBC7_C47B_00E6_3E3E_429B_A54E_A6BA_3AEC_33A9_4C9A_24A6_EF8E_27B7_677An,
                    0x15C_2C6B_7D1A_0702_7448_4774_E558_B69F_DFA1_93BD_B7A2_3F27_C2CD_2429_8CE1_B22A_6CC9_B7FB_8CAB_FD6C_F7C6_B1CF_3251_E5A1_CDDD_16FB_FED2_8DE7_9935_BB2C_631B_8B8E_A9CC_4BCC_937E_669En,
                    0x0FE_F0B6_8CB4_9453_A4C6_ECBF_1708_DBEE_FC88_5C57_FDAF_B884_17AA_EFA5_B1C3_5017_B4B4_9850_7937_ADCE_2F1D_9EFF_A5FE_8F5A_EB11_6B80_4FD1_82A6_CF15_18FD_B62D_53F6_0A0F_F6EB_707D_856Bn,
                    0x3FF_3738_33A0_6C79_1D7A_D586_AFA3_990F_6EF7_6999_C352_46C4_AD0D_519B_FF18_0CA1_880E_11F2_FB38_B764_854A_0AE3_BECD_DB50_F05A_C4FC_EE54_2F20_7C0A_6229_E2E1_9652_F0E6_47B9_C488_2193n,
                ],
                msg1: [
                    0x333_C711_F8C6_2F20_5F92_6593_2202_33B0_6228_2852_61D3_4026_232F_6F72_9620_C6DE_1222_0F28_2F42_06D2_2322_6705_6086_88B2_0B8B_A86D_8DFE_54F0_7A37_EC48_F253_283A_C33C_3F51_02C8_CC3En,
                    0x328_E02C_F07C_7B5B_6D37_49D8_302F_1AE5_BFAA_8F23_9398_459A_F4A2_C859_C772_7A81_23A7_FE9B_E8B2_2841_3FC8_DC0E_9DE1_6AF3_F8F4_3005_107F_9989_A5D9_7A5C_4455_DA89_5E81_3367_10A3_FB2Cn,
                    0x2A7_7E29_EAD9_E811_A9FD_A028_4C14_CDFA_1D9F_8FA7_12DA_59D5_30A0_6CDE_5418_7E25_0AD1_D4FB_5788_1619_38B8_DE04_9616_399C_5A56_B073_7C95_64C9_D4D8_45A4_C6A7_CDFC_BFF0_F01A_82BE_672En,
                    0x21C_E6EE_4A2C_72C9_F93B_DB3B_552F_4A63_3B8C_20C2_00F8_94F0_0864_3240_184B_E57B_B282_A164_5E47_FBBE_131E_899B_4C61_244E_FC24_86D8_8CDB_D1DD_4A65_EBDD_8370_19D0_2628_D0DC_D6ED_8FB5n,
                ],
            }
        }
        for (const v of Object.values(testVectors)) {
            check(v)
        }
    },
    a2s: () => {
        /**
         * @typedef {object} _Result
         * @property {bigint} k
         * @property {bigint} r
         * @property {bigint} s
         */
        /** @typedef {FixedArray<4, _Result>} _H */
        /**
         * @typedef {object} _P
         * @property {Curve} q
         * @property {bigint} x
         * @property {_H} msg0
         * @property {_H} msg1
         */
        /** @type {(p: _P) => void} */
        const check = ({ q, x, msg0, msg1 }) => {
            const a = fromCurve(q).rfc6979
            const u = q.mul(x)(q.g)
            forEachVector((sha, { k, r, s }, m) => {
                const k0 = computeK(a)(sha)(x)(m)
                assertEq(k0, k, [k0.toString(16), k.toString(16)])
                const [r0, s0] = sign(q)(sha)(x)(m)
                assertEq(r0, r, [r0, r])
                assertEq(s0, s, [s0, s])
                assertEq(verify(q)(sha)(u)(m)([r, s]), true)
            }, msg0, msg1)
        }
        /** @type {{ readonly [key: string]: _P }} */
        const testVectors = {
            x3: {
                q: secp192r1,
                x: 0x6FAB_0349_34E4_C0FC_9AE6_7F5B_5659_A9D7_D1FE_FD18_7EE0_9FD4n,
                msg0: [
                    {
                        k: 0x4381_526B_3FC1_E712_8F20_2E19_4505_592F_01D5_FF4C_5AF0_15D8n,
                        r: 0xA1F0_0DAD_97AE_EC91_C955_85F3_6200_C65F_3C01_812A_A603_78F5n,
                        s: 0xE07E_C130_4C7C_6C9D_EBBE_980B_9692_668F_81D4_DE79_22A0_F97An,
                    },
                    {
                        k: 0x32B1_B6D7_D42A_05CB_4490_6572_7A84_804F_B1A3_E34D_8F26_1496n,
                        r: 0x4B0B_8CE9_8A92_866A_2820_E20A_A6B7_5B56_382E_0F9B_FD5E_CB55n,
                        s: 0xCCDB_0069_26EA_9565_CBAD_C840_829D_8C38_4E06_DE1F_1E38_1B85n,
                    },
                    {
                        k: 0x4730_005C_4FCB_0183_4C06_3A7B_6760_096D_BE28_4B82_52EF_4311n,
                        r: 0xDA63_BF0B_9ABC_F948_FBB1_E916_7F13_6145_F7A2_0426_DCC2_87D5n,
                        s: 0xC3AA_2C96_0972_BD7A_2003_A57E_1C4C_77F0_578F_8AE9_5E31_EC5En,
                    },
                    {
                        k: 0xA2AC_7AB0_55E4_F206_92D4_9209_544C_203A_7D1F_2C0B_FBC7_5DB1n,
                        r: 0x4D60_C5AB_1996_BD84_8343_B31C_0085_0205_E2EA_6922_DAC2_E4B8n,
                        s: 0x3F6E_8374_48F0_27A1_BF4B_34E7_96E3_2A81_1CBB_4050_908D_8F67n,
                    }
                ],
                msg1: [
                    {
                        k: 0xF5DC_805F_76EF_8518_0070_0CCE_82E7_B98D_8911_B7D5_1005_9FBEn,
                        r: 0x6945_A1C1_D1B2_206B_8145_548F_633B_B61C_EF04_891B_AF26_ED34n,
                        s: 0xB7FB_7FDF_C339_C0B9_BD61_A9F5_A8EA_F9BE_58FC_5CBA_2CB1_5293n,
                    },
                    {
                        k: 0x5C4C_E89C_F56D_9E7C_77C8_5853_39B0_06B9_7B5F_0680_B430_6C6Cn,
                        r: 0x3A71_8BD8_B492_6C3B_52EE_6BBE_67EF_79B1_8CB6_EB62_B1AD_97AEn,
                        s: 0x5662_E684_8A4A_19B1_F1AE_2F72_ACD4_B8BB_E50F_1EAC_65D9_124Fn,
                    },
                    {
                        k: 0x5AFE_FB5D_3393_261B_828D_B6C9_1FBC_68C2_3072_7B03_0C97_5693n,
                        r: 0xB234_B60B_4DB7_5A73_3E19_280A_7A60_34BD_6B1E_E88A_F533_2367n,
                        s: 0x7994_090B_2D59_BB78_2BE5_7E74_A44C_9A1C_7004_13F8_ABEF_E77An,
                    },
                    {
                        k: 0x0758_753A_5254_759C_7CFB_AD2E_2D9B_0792_EEE4_4136_C948_0527n,
                        r: 0xFE4F_4AE8_6A58_B650_7946_7159_34FE_2D8F_F9D9_5B6B_098F_E739n,
                        s: 0x74CF_5605_C98F_BA0E_1EF3_4D4B_5A15_77A7_DCF5_9457_CAE5_2290n,
                    }
                ],
            },
            x5: {
                q: secp256r1,
                x: 0xC9AF_A9D8_45BA_7516_6B5C_2157_67B1_D693_4E50_C3DB_36E8_9B12_7B8A_622B_120F_6721n,
                msg0: [
                    {
                        k: 0x103F_90EE_9DC5_2E5E_7FB5_132B_7033_C630_66D1_9432_1491_8620_5996_7C71_5985_D473n,
                        r: 0x53B2_FFF5_D175_2B2C_689D_F257_C04C_40A5_87FA_BABB_3F6F_C270_2F13_43AF_7CA9_AA3Fn,
                        s: 0xB9AF_B64F_DC03_DC1A_131C_7D23_86D1_1E34_9F07_0AA4_32A4_ACC9_18BE_A988_BF75_C74Cn,
                    },
                    {
                        k: 0xA6E3_C57D_D01A_BE90_0865_3839_8355_DD4C_3B17_AA87_3382_B0F2_4D61_2949_3D8A_AD60n,
                        r: 0xEFD4_8B2A_ACB6_A8FD_1140_DD9C_D45E_81D6_9D2C_877B_56AA_F991_C34D_0EA8_4EAF_3716n,
                        s: 0xF7CB_1C94_2D65_7C41_D436_C7A1_B6E2_9F65_F3E9_00DB_B9AF_F406_4DC4_AB2F_843A_CDA8n,
                    },
                    {
                        k: 0x09F6_34B1_88CE_FD98_E7EC_88B1_AA98_52D7_34D0_BC27_2F7D_2A47_DECC_6EBE_B375_AAD4n,
                        r: 0x0EAF_EA03_9B20_E9B4_2309_FB1D_89E2_1305_7CBF_973D_C0CF_C8F1_29ED_DDC8_00EF_7719n,
                        s: 0x4861_F049_1E69_98B9_4551_93E3_4E7B_0D28_4DDD_7149_A74B_95B9_261F_13AB_DE94_0954n,
                    },
                    {
                        k: 0x5FA8_1C63_109B_ADB8_8C1F_367B_47DA_606D_A28C_AD69_AA22_C4FE_6AD7_DF73_A717_3AA5n,
                        r: 0x8496_A60B_5E9B_47C8_2548_8827_E049_5B0E_3FA1_09EC_4568_FD3F_8D10_9767_8EB9_7F00n,
                        s: 0x2362_AB1A_DBE2_B8AD_F9CB_9EDA_B740_EA60_49C0_2811_4F24_60F9_6554_F61F_AE33_02FEn,
                    }
                ],
                msg1: [
                    {
                        k: 0x669F_4426_F268_8B8B_E0DB_3A6B_D198_9BDA_EFFF_84B6_49EE_B84F_3DD2_6080_F667_FAA7n,
                        r: 0xC37E_DB6F_0AE7_9D47_C3C2_7E96_2FA2_69BB_4F44_1770_357E_114E_E511_F662_EC34_A692n,
                        s: 0xC820_053A_0579_1E52_1FCA_AD60_42D4_0AEA_1D6B_1A54_0138_558F_47D0_7198_00E1_8F2Dn,
                    },
                    {
                        k: 0xD16B_6AE8_27F1_7175_E040_871A_1C7E_C350_0192_C4C9_2677_336E_C253_7ACA_EE00_08E0n,
                        r: 0xF1AB_B023_5183_51CD_71D8_8156_7B1E_A663_ED3E_FCF6_C513_2B35_4F28_D3B0_B7D3_8367n,
                        s: 0x019F_4113_742A_2B14_BD25_926B_49C6_4915_5F26_7E60_D381_4B4C_0CC8_4250_E46F_0083n,
                    },
                    {
                        k: 0x16AE_FFA3_5726_0B04_B1DD_1996_9396_0740_066C_1A8F_3E8E_DD79_070A_A914_D361_B3B8n,
                        r: 0x8391_0E8B_48BB_0C74_244E_BDF7_F07A_1C54_13D6_1472_BD94_1EF3_920E_623F_BCCE_BEB6n,
                        s: 0x8DDB_EC54_CF8C_D587_4883_841D_7121_42A5_6A8D_0F21_8F50_03CB_0296_B6B5_0961_9F2Cn,
                    },
                    {
                        k: 0x6915_D116_32AC_A3C4_0D5D_51C0_8DAF_9C55_5933_8195_4878_4480_E934_9900_0D9F_0B7Fn,
                        r: 0x461D_93F3_1B65_4089_4788_FD20_6C07_CFA0_CC35_F46F_A3C9_1816_FFF1_040A_D158_1A04n,
                        s: 0x39AF_9F15_DE0D_B8D9_7E72_719C_7482_0D30_4CE5_226E_32DE_DAE6_7519_E840_D119_4E55n,
                    },
                ],
            },
            x6: {
                q: secp384r1,
                x: 0x6B9D_3DAD_2E1B_8C1C_05B1_9875_B665_9F4D_E23C_3B66_7BF2_97BA_9AA4_7740_7871_37D8_96D5_724E_4C70_A825_F872_C9EA_60D2_EDF5n,
                msg0: [
                    {
                        k: 0xA4E4_D2F0_E729_EB78_6B31_FC20_AD5D_849E_3044_50E0_AE8E_3E34_1134_A5C1_AFA0_3CAB_8083_EE4E_3C45_B06A_5899_EA56_C51B_5879n,
                        r: 0x4235_6E76_B55A_6D9B_4631_C865_445D_BE54_E056_D3B3_4317_66D0_5092_4479_3C3F_9366_450F_76EE_3DE4_3F5A_1253_33A6_BE06_0122n,
                        s: 0x9DA0_C817_8706_4021_E78D_F658_F2FB_B0B0_42BF_3046_65DB_721F_077A_4298_B095_E483_4C08_2C03_D830_28EF_BF93_A3C2_3940_CA8Dn,
                    },
                    {
                        k: 0x180A_E9F9_AEC5_438A_44BC_159A_1FCB_277C_7BE5_4FA2_0E7C_F404_B490_650A_8ACC_414E_3755_7234_2863_C899_F9F2_EDF9_747A_9B60n,
                        r: 0x21B1_3D1E_013C_7FA1_392D_03C5_F99A_F8B3_0C57_0C6F_98D4_EA8E_354B_63A2_1D3D_AA33_BDE1_E888_E633_55D9_2FA2_B3C3_6D8F_B2CDn,
                        s: 0xF3AA_443F_B107_745B_F4BD_77CB_3891_6746_3206_8A10_CA67_E3D4_5DB2_266F_A7D1_FEEB_EFDC_63EC_CD1A_C42E_C0CB_8668_A4FA_0AB0n,
                    },
                    {
                        k: 0x94ED_910D_1A09_9DAD_3254_E924_2AE8_5ABD_E4BA_1516_8EAF_0CA8_7A55_5FD5_6D10_FBCA_2907_E3E8_3BA9_5368_623B_8C46_8691_5CF9n,
                        r: 0x94ED_BB92_A5EC_B8AA_D473_6E56_C691_916B_3F88_1406_66CE_9FA7_3D64_C4EA_95AD_133C_81A6_4815_2E44_ACF9_6E36_DD1E_80FA_BE46n,
                        s: 0x99EF_4AEB_15F1_78CE_A1FE_40DB_2603_138F_130E_740A_1962_4526_203B_6351_D0A3_A94F_A329_C145_786E_679E_7B82_C71A_3862_8AC8n,
                    },
                    {
                        k: 0x92FC_3C71_83A8_83E2_4216_D114_1F1A_8976_C5B0_DD79_7DFA_597E_3D7B_3219_8BD3_5331_A4E9_6653_2593_A529_80D0_E3AA_A5E1_0EC3n,
                        r: 0xED09_59D5_880A_B2D8_69AE_7F6C_2915_C6D6_0F96_507F_9CB3_E047_C004_6861_DA4A_799C_FE30_F35C_C900_056D_7C99_CD78_8243_3709n,
                        s: 0x512C_8CCE_EE38_90A8_4058_CE1E_22DB_C219_8F42_323C_E8AC_A913_5329_F03C_068E_5112_DC7C_C3EF_3446_DEFC_EB01_A45C_2667_FDD5n,
                    }
                ],
                msg1: [
                    {
                        k: 0x18FA_39DB_95AA_5F56_1F30_FA35_91DC_59C0_FA36_53A8_0DAF_FA0B_48D1_A4C6_DFCB_FF6E_3D33_BE4D_C5EB_8886_A8EC_D093_F293_5726n,
                        r: 0xE8C9_D0B6_EA72_A0E7_837F_EA1D_14A1_A955_7F29_FAA4_5D3E_7EE8_88FC_5BF9_54B5_E624_64A9_A817_C47F_F78B_8C11_066B_2408_0E72n,
                        s: 0x0704_1D4A_7A03_79AC_7232_FF72_E6F7_7B6D_DB8F_09B1_6CCE_0EC3_286B_2BD4_3FA8_C614_1C53_EA5A_BEF0_D823_1077_A045_40A9_6B66n,
                    },
                    {
                        k: 0x0CFA_C375_8753_2347_DC33_89FD_C982_86BB_A8C7_3807_285B_184C_83E6_2E26_C401_C0FA_A48D_D070_BA79_921A_3457_ABFF_2D63_0AD7n,
                        r: 0x6D6D_EFAC_9AB6_4DAB_AFE3_6C6B_F510_352A_4CC2_7001_2636_38E5_B16D_9BB5_1D45_1559_F918_EEDA_F229_3BE5_B475_CC8F_0188_636Bn,
                        s: 0x2D46_F3BE_CBCC_523D_5F1A_1256_BF0C_9B02_4D87_9BA9_E838_144C_8BA6_BAEB_4B53_B47D_51AB_373F_9845_C051_4EEF_B140_2478_7265n,
                    },
                    {
                        k: 0x015E_E46A_5BF8_8773_ED91_23A5_AB08_0796_2D19_3719_503C_527B_031B_4C2D_2250_92AD_A71F_4A45_9BC0_DA98_ADB9_5837_DB83_12EAn,
                        r: 0x8203_B63D_3C85_3E8D_7722_7FB3_77BC_F7B7_B772_E978_92A8_0F36_AB77_5D50_9D7A_5FEB_0542_A7F0_8129_98DA_8F1D_D3CA_3CF0_23DBn,
                        s: 0xDDD0_7604_48D4_2D8A_43AF_45AF_836F_CE4D_E8BE_06B4_85E9_B61B_827C_2F13_1739_23E0_6A73_9F04_0649_A667_BF3B_8282_46BA_A5A5n,
                    },
                    {
                        k: 0x3780_C4F6_7CB1_5518_B6AC_AE34_C9F8_3568_D2E1_2E47_DEAB_6C50_A4E4_EE53_19D1_E8CE_0E2C_C8A1_3603_6DC4_B9C0_0E68_88F6_6B6Cn,
                        r: 0xA0D5_D090_C998_0FAF_3C2C_E57B_7AE9_51D3_1977_DD11_C775_D314_AF55_F76C_6764_47D0_6FB6_495C_D21B_4B6E_340F_C236_584F_B277n,
                        s: 0x9769_84E5_9B4C_77B0_E8E4_460D_CA3D_9F20_E07B_9BB1_F63B_EEFA_F576_F6B2_E8B2_2463_4A20_92CD_3792_E015_9AD9_CEE3_7659_C736n,
                    }
                ],
            },
            x7: {
                q: secp521r1,
                x: 0x0FA_D06D_AA62_BA3B_25D2_FB40_133D_A757_205D_E67F_5BB0_018F_EE8C_86E1_B68C_7E75_CAA8_96EB_32F1_F47C_7085_5836_A6D1_6FCC_1466_F6D8_FBEC_67DB_89EC_0C08_B0E9_96B8_3538n,
                msg0: [
                    {
                        k: 0x121_415E_C2CD_7726_330A_61F7_F3FA_5DE1_4BE9_4360_19C4_DB8C_B404_1F3B_54CF_31BE_0493_EE3F_427F_B906_393D_895A_19C9_523F_3A1D_54BB_8702_BD4A_A9C9_9DAB_2597_B921_13F3n,
                        r: 0x177_6331_CFCD_F927_D666_E032_E00C_F776_187B_C9FD_D8E6_9D0D_ABB4_109F_FE1B_5E2A_3071_5F4C_C923_A4A5_E94D_2503_E9AC_FED9_2857_B7F3_1D71_52E0_F8C0_0C15_FF3D_87E2_ED2En,
                        s: 0x050_CB52_6541_7FE2_320B_BB5A_122B_8E1A_32BD_6990_8985_1128_E360_E620_A30C_7E17_BA41_A666_AF12_6CE1_00E5_799B_153B_6052_8D53_00D0_8489_CA91_78FB_610A_2006_C254_B41Fn,
                    },
                    {
                        k: 0x0ED_F38A_FCAA_ECAB_4383_358B_34D6_7C9F_2216_C838_2AAE_A44A_3DAD_5FDC_9C32_5757_6179_3FEF_24EB_0FC2_76DF_C4F6_E3EC_4767_52F0_43CF_0141_5387_470B_CBD8_678E_D2C7_E1A0n,
                        r: 0x151_1BB4_D675_114F_E266_FC43_72B8_7682_BAEC_C01D_3CC6_2CF2_303C_92B3_5260_1265_9D16_876E_25C7_C1E5_7648_F23B_7356_4D67_F61C_6F14_D527_D549_7281_0421_E7D8_7589_E1A7n,
                        s: 0x04A_1711_43A8_3163_D6DF_460A_AF61_5226_95F2_07A5_8B95_C064_4D87_E52A_A1A3_4791_6E4F_7A72_930B_1BC0_6DBE_22CE_3F58_264A_FD23_704C_BB63_B29B_931F_7DE6_C9D9_49A7_ECFCn,
                    },
                    {
                        k: 0x154_6A10_8BC2_3A15_D6F2_1872_F7DE_D661_FA84_31DD_BD92_2D0D_CDB7_7CC8_78C8_553F_FAD0_64C9_5A92_0A75_0AC9_137E_5273_90D2_D92F_153E_6619_6966_EA55_4D9A_DFCB_109C_4211n,
                        r: 0x1EA_842A_0E17_D2DE_4F92_C153_15C6_3DDF_7268_5C18_195C_2BB9_5E57_2B9C_5136_CA4B_4B57_6AD7_12A5_2BE9_7306_27D1_6054_BA40_CC0B_8D3F_F035_B12A_E751_6839_7F5D_50C6_7451n,
                        s: 0x1F2_1A3C_EE06_6E19_6102_5FB0_48BD_5FE2_B792_4D0C_D797_BABE_0A83_B66F_1E35_EEAF_5FDE_143F_A85D_C394_A7DE_E766_5233_9378_4484_BDF3_E001_14A1_C857_CDE1_AA20_3DB6_5D61n,
                    },
                    {
                        k: 0x1DA_E2EA_071F_8110_DC26_882D_4D5E_AE06_21A3_256F_C884_7FB9_022E_2B7D_28E6_F101_98B1_574F_DD03_A905_3C08_A185_4A16_8AA5_A574_70EC_97DD_5CE0_9012_4EF5_2A2F_7ECB_FFD3n,
                        r: 0x0C3_28FA_FCBD_79DD_7785_0370_C463_25D9_87CB_5255_69FB_63C5_D3BC_5395_0E6D_4C5F_174E_25A1_EE90_17B5_D450_606A_DD15_2B53_4931_D7D4_E845_5CC9_1F9B_15BF_05EC_36E3_77FAn,
                        s: 0x061_7CCE_7CF5_0648_06C4_67F6_78D3_B408_0D6F_1CC5_0AF2_6CA2_0941_7308_281B_68AF_2826_23EA_A63E_5B5C_0723_D8B8_C37F_F077_7B1A_20F8_CCB1_DCCC_4399_7F1E_E0E4_4DA4_A67An,
                    }
                ],
                msg1: [
                    {
                        k: 0x040_D09F_CF3C_8A5F_62CF_4FB2_23CB_BB2B_9937_F6B0_577C_2702_0A99_602C_25A0_1136_987E_4529_8878_1484_EDBB_CF1C_47E5_54E7_FC90_1BC3_085E_5206_D9F6_19CF_F07E_73D6_F706n,
                        r: 0x1C7_ED90_2E12_3E68_1554_6065_A2C4_AF97_7B22_AA8E_ADDB_68B2_C111_0E7E_A44D_4208_6BFE_4A34_B67D_DC0E_17E9_6536_E358_219B_23A7_06C6_A6E1_6BA7_7B65_E1C5_95D4_3CAE_17FBn,
                        s: 0x177_3366_7630_4FCB_343C_E028_B38E_7B4F_BA76_C1C1_B277_DA18_CAD2_A847_8B2A_9A9F_5BEC_0F3B_A04F_35DB_3E42_6356_9EC6_AADE_8C92_746E_4C82_F829_9AE1_B8F1_739F_8FD5_19A4n,
                    },
                    {
                        k: 0x01D_E749_55EF_AABC_4C4F_17F8_E84D_881D_1310_B539_2D77_0027_5F82_F145_C61E_8438_41AF_0903_5BF7_A621_0F5A_431A_6A9E_81C9_3233_54A9_E691_35D4_4EBD_2FCA_A773_1B90_9258n,
                        r: 0x00E_871C_4A14_F993_C6C7_3695_0190_0C4B_C1E9_C7B0_B4BA_44E0_4868_B30B_41D8_0710_42EB_28C4_C250_411D_0CE0_8CD1_97E4_188E_A487_6F27_9F90_B3D8_D74A_3C76_E6F1_E465_6AA8n,
                        s: 0x0CD_52DB_AA33_B063_C3A6_CD80_58A1_FB0A_46A4_754B_034F_CC64_4766_CA14_DA8C_A5CA_9FDE_00E8_8C1A_D60C_CBA7_5902_5299_079D_7A42_7EC3_CC5B_619B_FBC8_28E7_769B_CD69_4E86n,
                    },
                    {
                        k: 0x1F1_FC4A_349A_7DA9_A9E1_16BF_DD05_5DC0_8E78_252F_F8E2_3AC2_76AC_88B1_770A_E0B5_DCEB_1ED1_4A49_16B7_69A5_23CE_1E90_BA22_846A_F11D_F8B3_00C3_8818_F713_DADD_85DE_0C88n,
                        r: 0x14B_EE21_A18B_6D8B_3C93_FAB0_8D43_E739_7079_5324_4FDB_E924_FA92_6D76_669E_7AC8_C89D_F62E_D897_5C2D_8397_A65A_49DC_C09F_6B0A_C622_7274_1924_D479_354D_74FF_6075_578Cn,
                        s: 0x133_3308_65C0_67A0_EAF7_2362_A65E_2D7B_C4E4_61E8_C899_5C3B_6226_A21B_D1AA_78F0_ED94_FE53_6A0D_CA35_534F_0CD1_510C_4152_5D16_3FE9_D74D_1348_81E3_5141_ED5E_8E95_B979n,
                    },
                    {
                        k: 0x162_0081_3020_EC98_6863_BEDF_C1B1_21F6_05C1_2156_4501_8AEA_1A7B_215A_564D_E9EB_1B38_A67A_A112_8B80_CE39_1C4F_B711_8765_4AAA_3431_027B_FC7F_3957_66CA_988C_964D_C56Dn,
                        r: 0x13E_9902_0ABF_5CEE_7525_D16B_69B2_2965_2AB6_BDF2_AFFC_AEF3_8773_B4B7_D087_25F1_0CDB_9348_2FDC_C54E_DCEE_91EC_A416_6B2A_7C62_65EF_0CE2_BD70_51B7_CEF9_45BA_BD47_EE6Dn,
                        s: 0x1FB_D001_3C67_4AA7_9CB3_9849_5279_16CE_301C_66EA_7CE8_B806_8278_6AD6_0F98_F7E7_8A19_CA69_EFF5_C574_00E3_B3A0_AD66_CE09_7821_4D13_BAF4_E9AC_6075_2F7B_155E_2DE4_DCE3n,
                    },
                ]
            },
        }
        for (const v of Object.values(testVectors)) {
            check(v)
        }
    },
    verify: () => {
        const c = secp256k1
        const { nf: { p: q, neg }, g } = c
        const x = 0xC9AFA9D845BA75166B5C215767B1D6934E50C3DB36E89B127B8A622B120F6721n
        const u = c.mul(x)(g)
        const v = verify(c)(sha256)
        const sig = sign(c)(sha256)(x)(sample)
        const [r, s] = sig
        assertEq(v(u)(sample)(sig), true)
        // tampered message
        assertEq(v(u)(test)(sig), false)
        // tampered `r` or `s`
        assertEq(v(u)(sample)([r + 1n, s]), false)
        assertEq(v(u)(sample)([r, s + 1n]), false)
        // wrong public key
        assertEq(v(c.mul(x + 1n)(g))(sample)(sig), false)
        // `r` or `s` out of `[1, q-1]`
        assertEq(v(u)(sample)([0n, s]), false)
        assertEq(v(u)(sample)([q, s]), false)
        assertEq(v(u)(sample)([r, 0n]), false)
        assertEq(v(u)(sample)([r, q]), false)
        // the point at infinity as the public key: without the refusal,
        // `s = 1` and `r = x(hG) mod q` would verify any message.
        const h = all(q).bits2intModQ(computeSync(sha256)([sample]))
        const hg = assertNotNullish(c.mul(h)(g), 'hG === null')
        assertEq(v(null)(sample)([hg[0] % q, 1n]), false)
        // a key off the curve, built for one message: with `[r, s] = [1, 1]`,
        // `X = hG + u`, and `u = (2, y)` is chosen so that `X.x = 1`. The
        // addition formulas do not check the curve, so only refusing `u`
        // stops the forgery.
        const { pf } = c
        const [a, b] = hg
        const t = assertNotNullish(sqrt(pf)(pf.add(1n)(pf.add(a)(2n))), 'no t')
        /** @type {Point} */
        const forged = [2n, pf.sub(b)(pf.mul(t)(pf.sub(a)(2n)))]
        assertEq(assertNotNullish(c.add(hg)(forged), 'X === null')[0], 1n)
        assertEq(v(forged)(sample)([1n, 1n]), false)
        // a key on the curve with `n·u = O`, but outside the subgroup of `g`:
        // on `y^2 = x^3 + 6x` over 7 with `g = (0, 0)` and `n = 2`, `(1, 0)`
        // made `[1, 1]` verify message "8".
        const c2 = curve({ p: 7n, c: [0n, 6n], g: [0n, 0n], n: 2n })
        assertEq(verify(c2)(sha256)([1n, 0n])(utf8("8"))([1n, 1n]), false)
        // `(h/s)G + (r/s)U` is the point at infinity when `h + x*r = 0 mod q`:
        // with `r = 1`, the key `x = -h` gets there for any `s`.
        assertEq(v(c.mul(neg(h))(g))(sample)([1n, 1n]), false)
    },
    signModQ: () => {
        // `R = 2G = (6, 4)`, so `R.x = 6 >= q`: `r` is `6 mod 5 = 1`, and
        // `verify` accepts it.
        const sig = sign(toy4)(sha256)(1n)(utf8("2"))
        assertEq(sig[0], 1n)
        assertEq(sig[1], 1n)
        assertEq(verify(toy4)(sha256)(toy4.g)(utf8("2"))(sig), true)
    },
    throw: {
        // `R = G = (0, 1)`, so `r = 0`.
        signRZero: () => sign(toy1)(sha256)(1n)(utf8("0")),
        // `h + x*r = 0 mod q`, so `s = 0`.
        signSZero: () => sign(toy4)(sha256)(1n)(utf8("14")),
    },
    demo: {
        // RFC 6979 A.2.5, P-256 with SHA-256 over "sample": the demo opens on it.
        init: () => {
            const html = htmlToString(demo.view(demo.init))
            const rfc = [
                'a6e3c57dd01abe90086538398355dd4c3b17aa873382b0f24d6129493d8aad60',
                '60fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669622e60f29fb6',
                '7903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299',
                demo.init.r,
                demo.init.s,
            ]
            for (const v of rfc) { assert(html.includes(`<pre>${v}`) || html.includes(`Ux = ${v}`) || html.includes(`Uy = ${v}`), v) }
            assert(html.includes('✓ The signature verifies'), html)
        },
        // Each curve verifies its own signature, as Sign shows it.
        everyCurve: () => {
            for (const curve of ['P-192 (secp192r1)', 'P-256 (secp256r1)', 'P-384 (secp384r1)', 'P-521 (secp521r1)', 'secp256k1']) {
                const state = { ...demo.init, curve, hash: 'SHA-512', key: '1f' }
                const [, { r, s }] = /** @type {['ok', DemoSigned]} */ (signed(state))
                const html = htmlToString(demo.view({ ...state, r: r.toString(16), s: s.toString(16) }))
                assert(html.includes('✓ The signature verifies'), curve)
            }
        },
        rejected: () => {
            // a changed message, and a changed `r`, against the same signature
            assert(htmlToString(demo.view({ ...demo.init, message: 'samplE' })).includes('✗ The signature does not verify'), 'message')
            assert(htmlToString(demo.view({ ...demo.init, r: `f${demo.init.r.slice(1)}` })).includes('✗ The signature does not verify'), 'r')
        },
        update: () => {
            const next = unwrap(assertNotNullish(runPure(demo.update(demo.init)({ kind: 'input', name: 'message', value: 'test' }))[0]))
            assertEq(JSON.stringify(next), JSON.stringify({ ...demo.init, message: 'test' }))
        },
        parseHexField: () => {
            const field = parseHexField('x', 4)
            const value = field('0aF9')
            assertEq(value[0], 'ok')
            assertEq(value[1], 0xaf9n)
            assertEq(JSON.stringify(field('12345')), JSON.stringify(['error', 'Enter x as at most 4 hexadecimal digits.']))
            assertEq(JSON.stringify(field('')), JSON.stringify(['error', 'Enter x as hexadecimal digits.']))
            assertEq(JSON.stringify(field('0x1')), JSON.stringify(['error', 'Enter x as hexadecimal digits.']))
        },
        refused: () => {
            /** @type {(state: typeof demo.init, message: string) => void} */
            const refuses = (state, message) => {
                const html = htmlToString(demo.view(state))
                assert(html.includes(message), message)
                // Sign refused, so Verify has no public key and gives no verdict.
                assert(!html.includes('The signature'), html)
            }
            refuses({ ...demo.init, key: 'xyz' }, 'Enter the private key as hexadecimal digits.')
            refuses({ ...demo.init, key: '0' }, 'The private key must be at least 1 and less than the curve order q.')
            refuses({ ...demo.init, key: 'f'.repeat(64) }, 'The private key must be at least 1 and less than the curve order q.')
            refuses({ ...demo.init, key: '1'.repeat(65) }, 'Enter the private key as at most 64 hexadecimal digits.')
            refuses({ ...demo.init, message: 'a'.repeat(Number(maxLengthBytes) + 1) }, `The message is too long: more than ${maxLengthBytes} UTF-8 bytes.`)
            // Verify's own fields
            assert(htmlToString(demo.view({ ...demo.init, r: 'r' })).includes('Enter r as hexadecimal digits.'), 'r')
            assert(htmlToString(demo.view({ ...demo.init, s: '' })).includes('Enter s as hexadecimal digits.'), 's')
        },
    },
}
