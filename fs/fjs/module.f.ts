/**
 * FunctionalScript compiler entry points and command handlers.
 *
 * @module
 */
import { compile } from '../djs/module.f.ts'
import { main as testMain } from '../emergent_testing/module.f.ts'
import { commands as casCommands } from '../cas/module.f.ts'
import { main as ciMain } from '../ci/module.f.ts'
import { import_, type NodeOp, type NodeProgram } from '../effects/node/module.f.ts'
import { dispatch, type Commands } from '../cli/module.f.ts'
import { casMcpServer } from '../cas/mcp/module.f.ts'
import { cas, fileKvStore, toPath } from '../cas/module.f.ts'
import { sha256 } from '../crypto/sha2/module.f.ts'
import { join } from '../path/module.f.ts'
import { pure } from '../effects/module.f.ts'

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
        description: 'Run an MCP server over stdio exposing the CAS as tools',
        handler: ({ home }) => {
            const c = cas(sha256)(fileKvStore(home))
            return casMcpServer(c, hash => join(home, toPath(hash))).step(() => pure(0))
        },
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
            return import_(file).step(([s, v]) => {
                if (s === 'error') { throw v }
                return (v.main as NodeProgram)({ ...options, args })
            })
        },
    },
]

export const main: NodeProgram = dispatch(commands)
