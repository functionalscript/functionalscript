import { commands, type Cas } from './module.f.ts'
import { computeSync, sha256 } from '../crypto/sha2/module.f.ts'
import { empty, length, vec8 } from '../types/bit_vec/module.f.ts'
import type { Vec } from '../types/bit_vec/module.f.ts'
import { pure } from '../effects/module.f.ts'
import { run } from '../effects/mock/module.f.ts'
import { defaultNodeProgramOptions, emptyState, virtual } from '../effects/node/virtual/module.f.ts'
import type { NodeProgramOptions } from '../effects/node/module.f.ts'
import { dispatch } from '../cli/module.f.ts'
import { assert } from '../asserts/module.f.ts'

const makeOptions = (args: readonly string[]): NodeProgramOptions =>
    ({ ...defaultNodeProgramOptions, args })

const main = dispatch(commands)

export const proof = {
    mainAdd: () => {
        const content = vec8(0x2An)
        const state = { ...emptyState, root: { myfile: [content] } }
        const [finalState, exitCode] = virtual(state)(main(makeOptions(['add', 'myfile'])))
        if (exitCode !== 0) { throw ['expected exit 0', exitCode] }
        if (finalState.stdout.length === 0) { throw 'expected hash in stdout' }
    },
    mainAddWrongArgs: () => {
        const [finalState, exitCode] = virtual(emptyState)(main(makeOptions(['add'])))
        if (exitCode !== 1) { throw ['expected exit 1', exitCode] }
        if (finalState.stderr.length === 0) { throw 'expected error in stderr' }
    },
    mainGetFound: () => {
        const content = vec8(0x2An)
        const state = { ...emptyState, root: { myfile: [content] } }
        const [state1, exitCode1] = virtual(state)(main(makeOptions(['add', 'myfile'])))
        if (exitCode1 !== 0) { throw ['expected add exit 0', exitCode1] }
        const hashStr = state1.stdout.trim()
        const [, exitCode2] = virtual(state1)(main(makeOptions(['get', hashStr, 'output'])))
        if (exitCode2 !== 0) { throw ['expected get exit 0', exitCode2] }
    },
    mainGetNotFound: () => {
        // valid cBase32 hash that has not been stored
        const content = vec8(0x2An)
        const state = { ...emptyState, root: { myfile: [content] } }
        const [state1] = virtual(state)(main(makeOptions(['add', 'myfile'])))
        const hashStr = state1.stdout.trim()
        // use an empty store so the hash is not found
        const [finalState, exitCode] = virtual(emptyState)(main(makeOptions(['get', hashStr, 'output'])))
        if (exitCode !== 1) { throw ['expected exit 1', exitCode] }
        if (finalState.stderr.length === 0) { throw 'expected error in stderr' }
    },
    mainGetWrongArgs: () => {
        const [finalState, exitCode] = virtual(emptyState)(main(makeOptions(['get'])))
        if (exitCode !== 1) { throw ['expected exit 1', exitCode] }
        if (finalState.stderr.length === 0) { throw 'expected error in stderr' }
    },
    mainGetInvalidHash: () => {
        const [finalState, exitCode] = virtual(emptyState)(main(makeOptions(['get', 'not-a-valid-hash', 'output'])))
        if (exitCode !== 1) { throw ['expected exit 1', exitCode] }
        if (finalState.stderr.length === 0) { throw 'expected error in stderr' }
    },
    mainList: () => {
        const content = vec8(0x2An)
        const state = { ...emptyState, root: { myfile: [content] } }
        const [state1] = virtual(state)(main(makeOptions(['add', 'myfile'])))
        const [, exitCode] = virtual(state1)(main(makeOptions(['list'])))
        if (exitCode !== 0) { throw ['expected exit 0', exitCode] }
    },
    mainListEmptyStore: () => {
        // A fresh directory has no `.cas` yet; listing must succeed (empty),
        // not crash unwrapping a readdir ENOENT.
        const [finalState, exitCode] = virtual(emptyState)(main(makeOptions(['list'])))
        if (exitCode !== 0) { throw ['expected exit 0', exitCode] }
        if (finalState.stdout !== '') { throw ['expected empty stdout', finalState.stdout] }
    },
    mainListCorruptStore: () => {
        // `.cas` exists but is a file, not a directory: a real storage error
        // that must surface, not be masked as an empty list.
        const state = { ...emptyState, root: { '.cas': [vec8(0x2An)] } }
        let threw = false
        try { virtual(state)(main(makeOptions(['list']))) } catch { threw = true }
        if (!threw) { throw 'expected list to surface the storage error' }
    },
    mainNoCmd: () => {
        const [finalState, exitCode] = virtual(emptyState)(main(makeOptions([])))
        if (exitCode !== 1) { throw ['expected exit 1', exitCode] }
        if (finalState.stderr.length === 0) { throw 'expected error in stderr' }
    },
    mainUnknownCmd: () => {
        const [finalState, exitCode] = virtual(emptyState)(main(makeOptions(['bogus'])))
        if (exitCode !== 1) { throw ['expected exit 1', exitCode] }
        if (finalState.stderr.length === 0) { throw 'expected error in stderr' }
    },
    casWrite: () => {
        const c: Cas<never> = {
            read: (_key: Vec) => pure(undefined as Vec | undefined),
            write: (value: Vec) => pure(computeSync(sha256)([value])),
            list: () => pure([] as readonly Vec[]),
        }
        const [, hash] = run({})(undefined)(c.write(empty))
        // sha256 of empty input produces a 256-bit hash
        assert(hash !== undefined)
        if (length(hash) !== 256n) { throw ['expected 256-bit hash', length(hash)] }
    },
    casReadPassthrough: () => {
        const stored = empty
        const c = {
            read: (_key: Vec) => pure(stored as Vec | undefined),
            write: (value: Vec) => pure(computeSync(sha256)([value])),
            list: () => pure([stored] as readonly Vec[]),
        }
        const [, readResult] = run<never, undefined>({})(undefined)(c.read(empty))
        if (readResult !== stored) { throw ['read should pass through', readResult] }
        const [, listResult] = run<never, undefined>({})(undefined)(c.list())
        if (listResult.length !== 1) { throw ['list should pass through', listResult] }
    },
}
