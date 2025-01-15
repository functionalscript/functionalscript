import { msbUtf8 } from '../../text/module.f.ts'
import { sha256 } from '../sha2/module.f.ts'
import { hmac } from './module.f.ts'

export default {
    sha256: () => {
        const r = hmac(sha256)(msbUtf8('key'))(msbUtf8('The quick brown fox jumps over the lazy dog'))
        if (r !== 0x1f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8n) { throw r }
    }
}
