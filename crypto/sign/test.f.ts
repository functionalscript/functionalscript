import { msbUtf8 } from "../../text/module.f.ts"
import { secp256r1 } from "../secp/module.f.ts"
import { computeSync, sha256 } from "../sha2/module.f.ts"
import { nonce, sign } from "./module.f.ts"

export default {
    nonce: () => {
        // 163 bits:
        //          0                1                2
        //          0123456789abcdef_0123456789abcdef_012345678
        const q = 0x09A4D6792295A7F7_30FC3F2B49CBC0F6_2E862272Fn
        //             0                1                2                3
        //             0123456789abcdef_0123456789abcdef_0123456789abcdef_0123456789abcdef
        const hash = 0xAF2BDBE1AA9B6EC1_E2ADE1D694F41FC7_1A831D0268E98915_62113D8A62ADD1BFn
        const n = nonce(sha256)(q)(hash)
        //console.log(n.toString(16))
    },
    /*
    // NIST P-256
    // https://www.rfc-editor.org/rfc/rfc6979#appendix-A.2.5
    p256r1: () =>{
        //                   0                   1                   2                   3
        //                   0123_4567_89ab_cdef_0123_4567_89ab_cdef_0123_4567_89ab_cdef_0123_4567_89ab_cdef
        const privateKey = 0xC9AF_A9D8_45BA_7516_6B5C_2157_67B1_D693_4E50_C3DB_36E8_9B12_7B8A_622B_120F_6721n
        const msg = msbUtf8("sample")
        const hash = computeSync(sha256)([msg])
        const signature = sign(sha256)(secp256r1)(privateKey)(hash)
        // k = A6E3C57DD01ABE90086538398355DD4C3B17AA873382B0F24D6129493D8AAD60
        // r = EFD48B2AACB6A8FD1140DD9CD45E81D69D2C877B56AAF991C34D0EA84EAF3716
        // s = F7CB1C942D657C41D436C7A1B6E29F65F3E900DBB9AFF4064DC4AB2F843ACDA8
        console.log(signature[0].toString(16))
        console.log(signature[1].toString(16))
    }
        */
}
