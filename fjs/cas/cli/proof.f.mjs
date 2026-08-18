/**
 * @import { NodeProgramOptions } from '../../effects/node/types.ts'
 */

import { exitCode } from '../../effects/node/module.f.mjs'
import { commands } from './module.f.mjs'
import { computeSync, sha256 } from '../../crypto/sha2/module.f.mjs'
import { maxLength, vec, vec8 } from '../../types/bit_vec/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { dispatch } from '../../cli/module.f.mjs'
import { vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

/** @type {(args: readonly string[]) => NodeProgramOptions} */
const makeOptions = args =>
    ({ ...defaultNodeProgramOptions, args })

const main = dispatch(commands)

export const proof = {
    mainAdd: () => {
        const content = vec8(0x2An)
        const state = { ...emptyState, root: { myfile: [content] } }
        const [finalState, code] = virtual(state)(main(makeOptions(['add', 'myfile'])))
        assertEq(exitCode(code), 0, ['expected exit 0', code])
        assert(finalState.stdout.length !== 0, 'expected hash in stdout')
    },
    mainAddGetBig: () => {
        const chunk = vec(maxLength)(1n)
        const content = [chunk, chunk]
        const state = { ...emptyState, root: { myfile: content } }
        //
        const [finalState, code] = virtual(state)(main(makeOptions(['add', 'myfile'])))
        assertEq(exitCode(code), 0)
        const stdout = finalState.stdout
        assert(stdout.length !== 0)
        //
        const h = computeSync(sha256)(content)
        const hs = vecToCBase32(h)
        assertEq(stdout, `${hs}\n`)
        //
        const [finalState2, exitCode2] = virtual(finalState)(main(makeOptions(['get', hs, 'myfile2'])))
        // console.log(finalState2.stderr)
        assertEq(exitCode(exitCode2), 0, 'e2')
        const { myfile2 } = finalState2.root
        assert(myfile2 instanceof Array)
        const h2 = computeSync(sha256)(myfile2)
        assertEq(h, h2, 'h')
    },
    mainAddWrongArgs: () => {
        const [finalState, code] = virtual(emptyState)(main(makeOptions(['add'])))
        assertEq(exitCode(code), 1)
        assert(finalState.stderr.length !== 0)
    },
    mainAddMissingFile: () => {
        // The source path doesn't exist, so `streamFile`'s first read comes back as a
        // stream failure; `write` fails closed with that error and the handler exits 1
        // without ever calling `log` — covers `exitStep`'s error branch.
        const [finalState, code] = virtual(emptyState)(main(makeOptions(['add', 'missing'])))
        assertEq(exitCode(code), 1)
        assertEq(finalState.stderr, 'no such file or directory\n', finalState.stderr)
    },
    mainGetFound: () => {
        const content = vec8(0x2An)
        const state = { ...emptyState, root: { myfile: [content] } }
        const [state1, exitCode1] = virtual(state)(main(makeOptions(['add', 'myfile'])))
        assertEq(exitCode(exitCode1), 0, ['expected add exit 0', exitCode1])
        const hashStr = state1.stdout.trim()
        const [, exitCode2] = virtual(state1)(main(makeOptions(['get', hashStr, 'output'])))
        assertEq(exitCode(exitCode2), 0, ['expected get exit 0', exitCode2])
    },
    mainGetNotFound: () => {
        // valid cBase32 hash that has not been stored
        const content = vec8(0x2An)
        const state = { ...emptyState, root: { myfile: [content] } }
        const [state1] = virtual(state)(main(makeOptions(['add', 'myfile'])))
        const hashStr = state1.stdout.trim()
        // use an empty store so the hash is not found
        const [finalState, code] = virtual(emptyState)(main(makeOptions(['get', hashStr, 'output'])))
        assertEq(exitCode(code), 1, ['expected exit 1', code])
        // The *message*, not just a non-empty line: the failure reaches the user
        // as the host's own words. Asserting only that something was written is
        // what let a stringified error tuple (`ioError,[object Object]`) pass.
        assertEq(finalState.stderr, 'no such file or directory\n', finalState.stderr)
    },
    mainGetWrongArgs: () => {
        const [finalState, code] = virtual(emptyState)(main(makeOptions(['get'])))
        assertEq(exitCode(code), 1, ['expected exit 1', code])
        assert(finalState.stderr.length !== 0, 'expected error in stderr')
    },
    mainGetInvalidHash: () => {
        const [finalState, code] = virtual(emptyState)(main(makeOptions(['get', 'not-a-valid-hash', 'output'])))
        assertEq(exitCode(code), 1, ['expected exit 1', code])
        assert(finalState.stderr.length !== 0, 'expected error in stderr')
    },
    mainList: () => {
        const content = vec8(0x2An)
        const state = { ...emptyState, root: { myfile: [content] } }
        const [state1] = virtual(state)(main(makeOptions(['add', 'myfile'])))
        const [, code] = virtual(state1)(main(makeOptions(['list'])))
        assertEq(exitCode(code), 0, ['expected exit 0', code])
    },
    mainListEmptyStore: () => {
        // A fresh directory has no `.cas` yet; listing must succeed (empty),
        // not crash unwrapping a readdir ENOENT.
        const [finalState, code] = virtual(emptyState)(main(makeOptions(['list'])))
        assertEq(exitCode(code), 0, ['expected exit 0', code])
        assertEq(finalState.stdout, '', ['expected empty stdout', finalState.stdout])
    },
    mainNoCmd: () => {
        const [finalState, code] = virtual(emptyState)(main(makeOptions([])))
        assertEq(exitCode(code), 1, ['expected exit 1', code])
        assert(finalState.stderr.length !== 0, 'expected error in stderr')
    },
    mainUnknownCmd: () => {
        const [finalState, code] = virtual(emptyState)(main(makeOptions(['bogus'])))
        assertEq(exitCode(code), 1, ['expected exit 1', code])
        assert(finalState.stderr.length !== 0, 'expected error in stderr')
    },
    // `.cas` exists but is a file, not a directory: a real storage error that
    // must surface, not be masked as an empty list. It is no longer a panic
    // either — `list` answers with the error and the CLI reports it on stderr
    // and exits 1, which is why this is an ordinary proof rather than a
    // `throw` one.
    mainListCorruptStore: () => {
        const [state, code] = virtual({ ...emptyState, root: { '.cas': [vec8(0x2An)] } })(main(makeOptions(['list'])))
        assertEq(exitCode(code), 1)
        assert(state.stderr !== '', ['expected the storage error reported on stderr', state.stderr])
        assertEq(state.stdout, '')
    },
}
