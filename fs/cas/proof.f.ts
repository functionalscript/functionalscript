import { commands, fileCas, type FileCasOperation } from './module.f.ts'
import { computeSync, sha256 } from '../crypto/sha2/module.f.ts'
import { length, msb, vec8 } from '../types/bit_vec/module.f.ts'
import type { Vec } from '../types/bit_vec/module.f.ts'
import { listEffectCons, listEffectEnd, pure, type Effect, type ListEffect } from '../effects/module.f.ts'
import { ok } from '../types/result/module.f.ts'
import { defaultNodeProgramOptions, emptyState, virtual } from '../effects/node/virtual/module.f.ts'
import type { IoResult, NodeProgramOptions } from '../effects/node/module.f.ts'
import { dispatch } from '../cli/module.f.ts'

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
    casWriteRead: () => {
        // Round-trip a single-chunk payload through the real streaming CAS: `write` returns
        // the content hash, and `read` streams the same bytes back as `ok` chunk items.
        const content = vec8(0x2An)
        const c = fileCas(sha256)('.')
        const payload: ListEffect<FileCasOperation, IoResult<Vec>> =
            listEffectCons(ok(content), listEffectEnd())
        const [state1, writeResult] = virtual(emptyState)(c.write(payload))
        if (writeResult[0] !== 'ok') { throw ['expected write ok', writeResult] }
        const hash = writeResult[1]
        if (length(hash) !== 256n) { throw ['expected 256-bit hash', length(hash)] }
        if (msb.cmp(hash)(computeSync(sha256)([content])) !== 0) { throw 'write hash mismatch' }
        const drain = (acc: readonly Vec[]) =>
            (stream: ListEffect<FileCasOperation, IoResult<Vec>>): Effect<FileCasOperation, IoResult<readonly Vec[]>> =>
                stream.step((node): Effect<FileCasOperation, IoResult<readonly Vec[]>> => {
                    if (node === undefined) { return pure(ok(acc)) }
                    const [item, rest] = node
                    if (item[0] === 'error') { return pure(item) }
                    return drain([...acc, item[1]])(rest)
                })
        const [, readResult] = virtual(state1)(drain([])(c.read(hash)))
        if (readResult[0] !== 'ok') { throw ['expected read ok', readResult] }
        if (msb.cmp(msb.listToVec(readResult[1]))(content) !== 0) { throw 'read content mismatch' }
    },
    casReadMissingShard: () => {
        // A missing shard surfaces as an explicit error *item*, never as end-of-stream.
        const c = fileCas(sha256)('.')
        const hash = computeSync(sha256)([vec8(0x2An)])
        const [, node] = virtual(emptyState)(c.read(hash))
        if (node === undefined) { throw 'missing shard must not be EOF' }
        if (node[0][0] !== 'error') { throw ['expected error item', node[0]] }
    },
}
