/**
 * FunctionalScript compiler entry points and command handlers.
 *
 * @module
 *
 * @import { NodeOp, NodeProgram } from './effects/node/types.ts'
 * @import { Commands } from './cli/types.ts'
 */

import { assert } from './asserts/module.f.mjs'
import { compile } from './djs/module.f.mjs'
import { main as testMain } from './emergent_testing/module.f.mjs'
import { commands as casCommands } from './cas/cli/module.f.mjs'
import { main as ciMain } from './ci/module.f.mjs'
import { exitStep, import_ } from './effects/node/module.f.mjs'
import { dispatch } from './cli/module.f.mjs'
import { casMcpServer } from './mcp/module.f.mjs'
import { pure, step } from './effects/module.f.mjs'
import { unwrap } from './types/result/module.f.mjs'

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
        // `exitStep`, not `step(…, () => pure(0))`: the server's bootstrap can
        // fail now, and a `() => pure(0)` continuation would report a server
        // that never started as a clean exit.
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
        handler: options => {
            const [file, ...args] = options.args
            return step(
                import_(file),
                x => {
                    const { main } = unwrap(x)
                    // A module named on the command line may export anything;
                    // fail here with the value rather than as `main is not a
                    // function` from inside the effect runner.
                    assert(typeof main === 'function', ['not a NodeProgram', file])
                    return /** @type {NodeProgram} */ (main)({ ...options, args })
                })
        },
    },
]

/** @type {NodeProgram} */
export const main = dispatch(commands)
