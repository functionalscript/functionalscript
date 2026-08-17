/**
 * @import { NodeProgram, NodeProgramOptions } from './effects/node/types.ts'
 * @import { Dir } from './effects/node/virtual/types.ts'
 */

import { assert, assertEq } from './asserts/module.f.mjs'
import { pure } from './effects/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual } from './effects/node/virtual/module.f.mjs'
import { main } from './module.f.mjs'
import { vec8 } from './types/bit_vec/module.f.mjs'

/** @type {(args: readonly string[]) => NodeProgramOptions} */
const makeOptions = args => ({ ...defaultNodeProgramOptions, args })

const run = (/** @type {Dir} */ root) => (/** @type {readonly string[]} */ args) =>
    virtual({ ...emptyState, root })(main(makeOptions(args)))

/** @type {NodeProgram} */
const appMain = ({ args }) => pure(args.length)

export const proof = {
    help: () => {
        const [state, code] = run({})(['help'])
        assertEq(code, 0)
        assert(state.stdout.includes('compile'), 'expected command list in stdout')
    },
    compileRequiresArgs: () => {
        const [state, code] = run({})(['compile'])
        assertEq(code, 1)
        assert(state.stderr.length !== 0, 'expected error in stderr')
    },
    runModule: () => {
        /** @type {Dir} */
        const root = { 'app.f.ts': () => ({ main: appMain }) }
        const [, code] = run(root)(['run', 'app.f.ts', 'x', 'y'])
        // `run` strips the command and file name, so `main` sees two arguments
        assertEq(code, 2)
    },
    mcp: () => {
        // stdin is empty in the virtual environment, so the server sees EOF
        // immediately and shuts down cleanly, exercising the `mcp` handler.
        // The store is empty too, so `casMcpServer`'s Evo cache scan
        // (`initEvo`) also runs and finds nothing.
        const [, code] = run({})(['mcp'])
        assertEq(code, 0)
    },
    mcpCorruptStore: () => {
        // The headline new error path, end to end: `.cas` exists but is a
        // file, so `initEvo`'s scan cannot list it. The server never starts,
        // and the failure travels out of the bootstrap to the command's
        // `exitStep` — a message on stderr and exit 1, where it used to be a
        // panic from inside `buildCache`.
        const [state, code] = run({ '.cas': [vec8(0x2An)] })(['mcp'])
        assertEq(code, 1)
        assert(state.stderr !== '', ['expected the storage error on stderr', state.stderr])
    },
    // A file that will not import is the user's command line, not a defect:
    // it is reported with the name they typed and exits 1, where it used to
    // panic out of the effect runner.
    runImportError: () => {
        const [state, code] = run({})(['run', 'missing.f.ts'])
        assertEq(code, 1)
        assert(state.stderr.startsWith('missing.f.ts: '), state.stderr)
    },
    // The file imports but is not a program. Same answer, different reason —
    // and the reason is the half of it worth saying.
    runNotANodeProgram: () => {
        /** @type {Dir} */
        const root = { 'app.f.ts': () => ({ notMain: 1 }) }
        const [state, code] = run(root)(['run', 'app.f.ts'])
        assertEq(code, 1)
        assert(state.stderr.includes('not a NodeProgram'), state.stderr)
    },
}
