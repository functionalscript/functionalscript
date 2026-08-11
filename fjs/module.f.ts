/**
 * FunctionalScript compiler entry points and command handlers.
 *
 * @module
 */
import { compile } from './djs/module.f.ts'
import { main as testMain } from './emergent_testing/module.f.ts'
import { commands as casCommands } from './cas/cli/module.f.ts'
import { main as ciMain } from './ci/module.f.ts'
import { import_ } from './effects/node/module.f.mjs'
import type { NodeOp, NodeProgram } from './effects/node/types.ts'
import { dispatch } from './cli/module.f.mjs'
import type { Commands } from './cli/types.ts'
import { casMcpServer } from './mcp/module.f.ts'
import { pure, step } from './effects/module.f.mjs'
import { unwrap } from './types/result/module.f.mjs'

const commands: Commands<NodeOp> = [
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
        handler: ({ home }) => step(
            casMcpServer(home),
            () => pure(0)),
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
                x => (unwrap(x).main as NodeProgram)({ ...options, args }))
        },
    },
]

export const main: NodeProgram = dispatch(commands)
