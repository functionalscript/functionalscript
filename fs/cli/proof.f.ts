import { pure } from '../effects/module.f.ts'
import type { NodeOp, NodeProgramOptions } from '../effects/node/module.f.ts'
import { defaultNodeProgramOptions, emptyState, virtual } from '../effects/node/virtual/module.f.ts'
import { dispatch, type Commands } from './module.f.ts'

const makeOptions = (args: readonly string[]): NodeProgramOptions =>
    ({ ...defaultNodeProgramOptions, args })

const echoCommands: Commands<NodeOp> = [
    {
        names: ['echo', 'e'],
        description: 'Print the first argument',
        handler: ({ args: [arg = ''] }) => pure(arg.length),
    },
]

const run = (commands: Commands<NodeOp>) => (args: readonly string[]) =>
    virtual(emptyState)(dispatch(commands)(makeOptions(args)))

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
        const commands: Commands<NodeOp> = [{
            names: ['grab'],
            description: 'Capture args',
            handler: ({ args }): import('../effects/module.f.ts').Effect<NodeOp, number> => {
                captured.push(...args)
                return pure(0)
            },
        }]
        run(commands)(['grab', 'a', 'b', 'c'])
        if (captured.join(',') !== 'a,b,c') { throw ['unexpected args', captured] }
    },
    nestedCommands: () => {
        const inner: Commands<NodeOp> = [{
            names: ['ping'],
            description: 'Inner ping',
            handler: () => pure(42),
        }]
        const outer: Commands<NodeOp> = [{
            names: ['sub'],
            description: 'Subcommand group',
            handler: inner,
        }]
        const [, code] = run(outer)(['sub', 'ping'])
        if (code !== 42) { throw ['expected 42', code] }
    },
    nestedHelp: () => {
        const inner: Commands<NodeOp> = [{
            names: ['ping'],
            description: 'Inner ping',
            handler: () => pure(0),
        }]
        const outer: Commands<NodeOp> = [{
            names: ['sub'],
            description: 'Subcommand group',
            handler: inner,
        }]
        const [state, code] = run(outer)(['sub', 'help'])
        if (code !== 0) { throw ['expected exit 0', code] }
        if (!state.stdout.includes('ping')) { throw 'expected inner command in help' }
    },
    prototypeNameIsUnknownCommand: () => {
        const [state, code] = run(echoCommands)(['toString'])
        if (code !== 1) { throw ['expected exit 1 for prototype-name command', code] }
        if (!state.stderr.includes('unknown command')) { throw 'expected unknown-command error in stderr' }
    },
    helpPrototypeSafe: () => {
        const [state, code] = run(echoCommands)(['help', 'toString'])
        if (code !== 0) { throw ['expected exit 0, not a throw', code] }
        if (!state.stdout.includes('echo')) { throw 'expected top-level help for unknown target' }
    },
    helpWithTarget: () => {
        const inner: Commands<NodeOp> = [{
            names: ['ping'],
            description: 'Inner ping',
            handler: () => pure(0),
        }]
        const outer: Commands<NodeOp> = [{
            names: ['sub'],
            description: 'Subcommand group',
            handler: inner,
        }]
        const [state, code] = run(outer)(['help', 'sub'])
        if (code !== 0) { throw ['expected exit 0', code] }
        if (!state.stdout.includes('ping')) { throw 'expected inner command in help' }
        if (state.stdout.includes('Subcommand group')) { throw 'expected inner help, not outer' }
    },
}
