import { cas, main } from './module.f.ts'
import { sha256 } from '../crypto/sha2/module.f.ts'
import { empty, length, vec8 } from '../types/bit_vec/module.f.ts'
import type { Vec } from '../types/bit_vec/module.f.ts'
import { pure } from '../types/effects/module.f.ts'
import { run } from '../types/effects/mock/module.f.ts'
import { emptyState, virtual } from '../types/effects/node/virtual/module.f.ts'

export const proof = {
    mainAdd: () => {
        const content = vec8(0x2An)
        const state = { ...emptyState, root: { myfile: content } }
        const [finalState, exitCode] = virtual(state)(main(['add', 'myfile']))
        if (exitCode !== 0) { throw ['expected exit 0', exitCode] }
        if (finalState.stdout.length === 0) { throw 'expected hash in stdout' }
    },
    mainAddWrongArgs: () => {
        const [finalState, exitCode] = virtual(emptyState)(main(['add']))
        if (exitCode !== 1) { throw ['expected exit 1', exitCode] }
        if (finalState.stderr.length === 0) { throw 'expected error in stderr' }
    },
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
