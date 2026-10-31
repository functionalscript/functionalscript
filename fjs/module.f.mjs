/**
 * FunctionalScript compiler entry points and command handlers.
 *
 * @module
 *
 * @import { NodeOp, NodeProgram } from './effects/node/types.ts'
 * @import { DocumentedCommands } from './cli/types.ts'
 */

import { compile } from './compiler/module.f.mjs'
import { main as testMain } from './emergent_testing/module.f.mjs'
import { main as coverageMain } from './emergent_testing/cov/module.f.mjs'
import { commands as casCommands } from './cas/cli/module.f.mjs'
import { main as ciMain } from './ci/module.f.mjs'
import { commands as ciCacheCommands } from './ci/cache/module.f.mjs'
import { errorExit, errorMessage, exitStep, import_ } from './effects/node/module.f.mjs'
import { dispatch, isMain } from './cli/module.f.mjs'
import { casMcpServer } from './mcp/module.f.mjs'
import { main as webMain } from './web/module.f.mjs'
import { resultStep } from './effects/module.f.mjs'

/** @type {DocumentedCommands<NodeOp>} */
export const commands = [
    {
        names: ['test', 't'],
        description: 'Run the FunctionalScript test suite',
        usage: 'fjs test',
        examples: ['fjs test'],
        note: 'Run from the directory whose proofs you want to test.',
        docs: 'fjs/emergent_testing/README.md',
        handler: testMain,
    },
    {
        names: ['cov'],
        description: 'Check each module\'s own proof coverage with Node',
        usage: 'fjs cov node',
        examples: ['fjs cov node', 'npm start cov node'],
        note: 'Run from the directory whose modules you want to check. Each module directory runs separately and requires 100% line, branch and function coverage.',
        docs: 'fjs/emergent_testing/README.md',
        handler: coverageMain,
    },
    {
        names: ['compile', 'c'],
        description: 'Compile a FunctionalScript module to JavaScript, or check every .f.js with no arguments',
        usage: 'fjs compile\nfjs compile <input> <output>',
        examples: ['fjs compile', "printf 'export default 42;\\n' > example.f.js\nfjs compile ./example.f.js ./example.json"],
        note: 'With no arguments, check every .f.js under the current directory. The POSIX shell example writes example.f.js and example.json in the current directory. The output extension selects its format.',
        docs: 'fjs/compiler/README.md',
        handler: compile,
    },
    {
        names: ['cas', 's'],
        description: 'Content-addressable storage operations',
        usage: 'fjs cas <command> [args]',
        examples: ['fjs help cas'],
        note: 'Choose add, get or list below for the store under ~/.cas/, or git for the same three over a Git branch.',
        docs: 'fjs/cas/README.md',
        handler: casCommands,
    },
    {
        names: ['mcp', 'm'],
        description: 'Run an MCP server over stdio exposing the CAS and Evo (subjects/heads) as tools',
        usage: 'fjs mcp',
        examples: ['npx functionalscript mcp'],
        note: 'Start the stdio server from an MCP client. It waits for protocol input rather than printing an interactive prompt.',
        docs: 'fjs/mcp/README.md',
        // `exitStep`, not `resultStep(…, () => pureOk(0))`: the server's
        // bootstrap can fail, and a continuation that ignores its result would
        // report a server that never started as a clean exit.
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
        description: 'Generate CI workflows or cache successful checks',
        usage: 'fjs ci\nfjs ci init\nfjs ci report <check>\nfjs ci publish',
        examples: ['fjs ci', 'npm start ci init'],
        note: 'Run in the project whose GitHub Actions workflows you want to generate. This writes .github/workflows/gen.ci.yml and gen.npm-publish.yml.',
        docs: 'fjs/ci/README.md',
        handler: options => options.args.length === 0 ? ciMain() : dispatch(ciCacheCommands)(options),
    },
    {
        names: ['web', 'w'],
        description: 'Serve a directory over HTTP',
        usage: 'fjs web [root] [port]',
        examples: ['fjs web', 'fjs web . 3000'],
        note: 'Defaults to the current directory and port 8080 on loopback. Both arguments are positional.',
        docs: 'fjs/web/README.md',
        handler: webMain,
    },
    {
        names: ['run', 'r'],
        description: 'Run the `main` program or command table a FunctionalScript module exports',
        usage: 'fjs run <module> [args...]',
        examples: ['fjs run ./fjs/website/module.f.mjs'],
        note: 'The module must export main as a program or command table. This repository-checkout example generates the website locally.',
        docs: 'fjs/README.md',
        // Both ways this can fail are the command line, not a defect: the
        // named file may not import, and a module that does import may export
        // no `main`. Neither deserves a stack trace, so both are reported on
        // `stderr` and exit `1` — the same answer an unknown command gets a
        // few lines up, and the same one every other command now gives.
        handler: options => {
            const [file, ...args] = options.args
            return resultStep(
                import_(file),
                r => {
                    if (r[0] === 'error') {
                        return errorExit(`${file}: ${errorMessage(r[1])}`)
                    }
                    const { main } = r[1]
                    if (!isMain(main)) {
                        return errorExit(`${file}: not a program — no exported \`main\` function or command table`)
                    }
                    return dispatch(main)({ ...options, args })
                })
        },
    },
]

/** @type {NodeProgram} */
export const main = dispatch(commands)
