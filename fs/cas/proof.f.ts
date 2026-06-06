import { cas, main } from './module.f.ts'
import { sha256 } from '../crypto/sha2/module.f.ts'
import { empty, length, vec8 } from '../types/bit_vec/module.f.ts'
import type { Vec } from '../types/bit_vec/module.f.ts'
import { pure } from '../effects/module.f.ts'
import { run } from '../effects/mock/module.f.ts'
import { emptyState, virtual } from '../effects/node/virtual/module.f.ts'

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
    mainGetFound: () => {
        const content = vec8(0x2An)
        const state = { ...emptyState, root: { myfile: content } }
        const [state1, exitCode1] = virtual(state)(main(['add', 'myfile']))
        if (exitCode1 !== 0) { throw ['expected add exit 0', exitCode1] }
        const hashStr = state1.stdout.trim()
        const [, exitCode2] = virtual(state1)(main(['get', hashStr, 'output']))
        if (exitCode2 !== 0) { throw ['expected get exit 0', exitCode2] }
    },
    mainGetNotFound: () => {
        // valid cBase32 hash that has not been stored
        const content = vec8(0x2An)
        const state = { ...emptyState, root: { myfile: content } }
        const [state1] = virtual(state)(main(['add', 'myfile']))
        const hashStr = state1.stdout.trim()
        // use an empty store so the hash is not found
        const [finalState, exitCode] = virtual(emptyState)(main(['get', hashStr, 'output']))
        if (exitCode !== 1) { throw ['expected exit 1', exitCode] }
        if (finalState.stderr.length === 0) { throw 'expected error in stderr' }
    },
    mainGetWrongArgs: () => {
        const [finalState, exitCode] = virtual(emptyState)(main(['get']))
        if (exitCode !== 1) { throw ['expected exit 1', exitCode] }
        if (finalState.stderr.length === 0) { throw 'expected error in stderr' }
    },
    mainGetInvalidHash: () => {
        const [finalState, exitCode] = virtual(emptyState)(main(['get', 'not-a-valid-hash', 'output']))
        if (exitCode !== 1) { throw ['expected exit 1', exitCode] }
        if (finalState.stderr.length === 0) { throw 'expected error in stderr' }
    },
    mainList: () => {
        const content = vec8(0x2An)
        const state = { ...emptyState, root: { myfile: content } }
        const [state1] = virtual(state)(main(['add', 'myfile']))
        const [, exitCode] = virtual(state1)(main(['list']))
        if (exitCode !== 0) { throw ['expected exit 0', exitCode] }
    },
    mainNoCmd: () => {
        const [finalState, exitCode] = virtual(emptyState)(main([]))
        if (exitCode !== 1) { throw ['expected exit 1', exitCode] }
        if (finalState.stderr.length === 0) { throw 'expected error in stderr' }
    },
    mainUnknownCmd: () => {
        const [finalState, exitCode] = virtual(emptyState)(main(['bogus']))
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
