import { pure } from '../effects/module.f.ts'
import { type NodeOp } from '../effects/node/module.f.ts'
import { emptyState, virtual } from '../effects/node/virtual/module.f.ts'
import { dispatch, type Commands } from './module.f.ts'

const echoCommands: Commands = [
    {
        names: ['echo', 'e'],
        description: 'Print the first argument',
        handler: ([arg = '']) => pure(arg.length),
    },
]

const run = (commands: Commands) => (args: readonly string[]) =>
    virtual(emptyState)(dispatch(commands)(args))

export const proof = {
    knownCommand: () => {
        const [, code] = run(echoCommands)(['echo', 'hello'])
        if (code !== 5) { throw ['expected length 5', code] }
    },
    alias: () => {
        const [, code] = run(echoCommands)(['e', 'hi'])
        if (code !== 2) { throw ['expected length 2', code] }
    },
    noArgs: () => {
        const [state, code] = run(echoCommands)([])
        if (code !== 1) { throw ['expected exit 1', code] }
        if (state.stderr.length === 0) { throw 'expected error in stderr' }
    },
    unknownCommand: () => {
        const [state, code] = run(echoCommands)(['bogus'])
        if (code !== 1) { throw ['expected exit 1', code] }
        if (state.stderr.length === 0) { throw 'expected error in stderr' }
    },
    help: () => {
        const [state, code] = run(echoCommands)(['help'])
        if (code !== 0) { throw ['expected exit 0', code] }
        if (!state.stdout.includes('echo')) { throw 'expected command name in stdout' }
        if (!state.stdout.includes('help')) { throw 'expected help entry in stdout' }
    },
    errorIncludesAvailable: () => {
        const [state] = run(echoCommands)(['bogus'])
        if (!state.stderr.includes('echo')) { throw 'expected available commands in error' }
    },
    handlerReceivesRemainingArgs: () => {
        const captured: string[] = []
        const commands: Commands = [{
            names: ['grab'],
            description: 'Capture args',
            handler: (args): import('../effects/module.f.ts').Effect<NodeOp, number> => {
                captured.push(...args)
                return pure(0)
            },
        }]
        run(commands)(['grab', 'a', 'b', 'c'])
        if (captured.join(',') !== 'a,b,c') { throw ['unexpected args', captured] }
    },
}
