import { cas } from './module.f.ts'
import { sha256 } from '../crypto/sha2/module.f.ts'
import { empty, length } from '../types/bit_vec/module.f.ts'
import type { Vec } from '../types/bit_vec/module.f.ts'
import { pure } from '../types/effects/module.f.ts'
import { run } from '../types/effects/mock/module.f.ts'

export const proof = {
    casWrite: () => {
        const store = {
            read: (_key: Vec) => pure(undefined as Vec | undefined),
            write: (_key: Vec, _value: Vec) => pure(undefined as void),
            list: () => pure([] as readonly Vec[]),
        }
        const c = cas(sha256)(store)
        const [, hash] = run<never, undefined>({})(undefined)(c.write(empty))
        // sha256 of empty input produces a 256-bit hash
        if (length(hash) !== 256n) { throw ['expected 256-bit hash', length(hash)] }
    },
    casReadPassthrough: () => {
        const stored = empty
        const store = {
            read: (_key: Vec) => pure(stored as Vec | undefined),
            write: (_key: Vec, _value: Vec) => pure(undefined as void),
            list: () => pure([stored] as readonly Vec[]),
        }
        const c = cas(sha256)(store)
        const [, readResult] = run<never, undefined>({})(undefined)(c.read(empty))
        if (readResult !== stored) { throw ['read should pass through', readResult] }
        const [, listResult] = run<never, undefined>({})(undefined)(c.list())
        if (listResult.length !== 1) { throw ['list should pass through', listResult] }
    },
}
