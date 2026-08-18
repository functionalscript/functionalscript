/**
 * FunctionalScript compiler entry points and command handlers.
 *
 * @module
 *
 * @import { NodeOp, NodeProgram } from './effects/node/types.ts'
 * @import { Commands } from './cli/types.ts'
 */

import { compile } from './djs/module.f.mjs'
import { main as testMain } from './emergent_testing/module.f.mjs'
import { commands as casCommands } from './cas/cli/module.f.mjs'
import { main as ciMain } from './ci/module.f.mjs'
import { errorExit, errorMessage, exitStep, import_ } from './effects/node/module.f.mjs'
import { dispatch } from './cli/module.f.mjs'
import { casMcpServer } from './mcp/module.f.mjs'
import { step } from './effects/module.f.mjs'

/** @type {Commands<NodeOp>} */
const commands = [
    {
        names: ['test', 't'],
        description: 'Run the FunctionalScript test suite',
        handler: testMain,
    },
    {
        names: ['compile', 'c'],
        description: 'Compile a FunctionalScript module to JavaScript',
        handler: ({ args }) => compile(args),
    },
    {
        names: ['cas', 's'],
        description: 'Content-addressable storage operations',
        handler: casCommands,
    },
    {
        names: ['mcp', 'm'],
        description: 'Run an MCP server over stdio exposing the CAS and Evo (subjects/heads) as tools',
        // `exitStep`, not `step(…, () => pureOk(0))`: the server's bootstrap can
        // fail, and a continuation that ignores its result would report a
        // server that never started as a clean exit.
        //
        // The types do *not* rule that out. `Program`'s exit code being a
        // `Result` catches the old spelling — `() => pure(0)` hands back a bare
        // number, which no longer fits — but `() => pureOk(0)` still compiles,
        // because discarding a result you were handed is exactly what a
        // continuation is allowed to do. This comment guards a mistake that is
        // still available.
        handler: ({ home }) => exitStep(casMcpServer(home)),
    },
    {
        names: ['ci', 'i'],
        description: 'Generate the GitHub Actions CI workflow',
        handler: ciMain,
    },
    {
        names: ['run', 'r'],
        description: 'Run a FunctionalScript module as a NodeProgram',
        // Both ways this can fail are the command line, not a defect: the
        // named file may not import, and a module that does import may export
        // no `main`. Neither deserves a stack trace, so both are reported on
        // `stderr` and exit `1` — the same answer an unknown command gets a
        // few lines up, and the same one every other command now gives.
        handler: options => {
            const [file, ...args] = options.args
            return step(
                import_(file),
                r => {
                    if (r[0] === 'error') {
                        return errorExit(`${file}: ${errorMessage(r[1])}`)
                    }
                    const { main } = r[1]
                    if (typeof main !== 'function') {
                        return errorExit(`${file}: not a NodeProgram — no exported \`main\` function`)
                    }
                    return /** @type {NodeProgram} */ (main)({ ...options, args })
                })
        },
    },
]

/** @type {NodeProgram} */
export const main = dispatch(commands)
