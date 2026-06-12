import { assert, assertEq } from '../asserts/module.f.ts'
import { pure } from '../effects/module.f.ts'
import type { NodeProgram, NodeProgramOptions } from '../effects/node/module.f.ts'
import { emptyState, virtual, type Dir } from '../effects/node/virtual/module.f.ts'
import { main } from './module.f.ts'

const makeOptions = (args: readonly string[]): NodeProgramOptions => ({
    args,
    env: {},
    std: { stdout: { isTTY: false }, stderr: { isTTY: false } },
    testContext: { test: async () => {} },
    bunTestContext: { test: async () => {} },
    playwrightTestContext: { test: async () => {} },
    engine: 'node' as const,
})

const run = (root: Dir) => (args: readonly string[]) =>
    virtual({ ...emptyState, root })(main(makeOptions(args)))

const appMain: NodeProgram = ({ args }) => pure(args.length)

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
        const root: Dir = { 'app.f.ts': () => ({ main: appMain }) }
        const [, code] = run(root)(['run', 'app.f.ts', 'x', 'y'])
        // `run` strips the command and file name, so `main` sees two arguments
        assertEq(code, 2)
    },
    throw: {
        runImportError: () => {
            run({})(['run', 'missing.f.ts'])
        },
    },
}
