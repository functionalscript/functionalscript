import { msbUtf8 } from '../../text/module.f.ts'
import { vec } from '../../types/bit_vec/module.f.ts'
import { computeSync, sha256 } from '../sha2/module.f.ts'
import { secp256k1 } from '../secp/module.f.ts'
import { sign } from './module.f.ts'

const privateKey = vec(256n)(1n)

const hash = (s: string) => computeSync(sha256)([msbUtf8(s)])

export default {
    secp256k1: {
        sample: () => {
            const [r, s] = sign(sha256)(secp256k1)(privateKey)(hash('sample'))
            if (r !== 0x4bd0aea1c6090f5c44895a7c47297e5b9894b23af120d86186b401f32be23552n || s !== 0xf14082765d880b1d828d2d415e766fbb51eeda88dd0237e2110e01d4aa7a1fdcn) {
                throw [r, s]
            }
        },
        test: () => {
            const [r, s] = sign(sha256)(secp256k1)(privateKey)(hash('test'))
            if (r !== 0x5503a3d8ad6503c44bf1264a04af57bf6f3d6346fdf6bcba1a1e3906514090bn || s !== 0xd458687ff1faf0ff3717456429769d51fc64fa24773bd53e8a9f51f530a9b12bn) {
                throw [r, s]
            }
        }
    }
}
