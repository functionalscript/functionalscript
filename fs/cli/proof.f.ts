import { pure } from '../effects/module.f.ts'
import type { NodeOp, NodeProgramOptions } from '../effects/node/module.f.ts'
import { defaultNodeProgramOptions, emptyState, virtual } from '../effects/node/virtual/module.f.ts'
import { dispatch, type Commands } from './module.f.ts'
import { assert, assertEq } from '../asserts/module.f.ts'

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
        assertEq(code, 5, ['expected length 5', code])
    },
    alias: () => {
        const [, code] = run(echoCommands)(['e', 'hi'])
        assertEq(code, 2, ['expected length 2', code])
    },
    noArgs: () => {
        const [state, code] = run(echoCommands)([])
        assertEq(code, 1, ['expected exit 1', code])
        assert(state.stderr.length !== 0, 'expected error in stderr')
    },
    unknownCommand: () => {
        const [state, code] = run(echoCommands)(['bogus'])
        assertEq(code, 1, ['expected exit 1', code])
        assert(state.stderr.length !== 0, 'expected error in stderr')
    },
    help: () => {
        const [state, code] = run(echoCommands)(['help'])
        assertEq(code, 0, ['expected exit 0', code])
        assert(state.stdout.includes('echo'), 'expected command name in stdout')
        assert(state.stdout.includes('help'), 'expected help entry in stdout')
    },
    errorIncludesAvailable: () => {
        const [state] = run(echoCommands)(['bogus'])
        assert(state.stderr.includes('echo'), 'expected available commands in error')
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
        assertEq(captured.join(','), 'a,b,c', ['unexpected args', captured])
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
        assertEq(code, 42, ['expected 42', code])
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
        assertEq(code, 0, ['expected exit 0', code])
        assert(state.stdout.includes('ping'), 'expected inner command in help')
    },
    prototypeNameIsUnknownCommand: () => {
        const [state, code] = run(echoCommands)(['toString'])
        assertEq(code, 1, ['expected exit 1 for prototype-name command', code])
        assert(state.stderr.includes('unknown command'), 'expected unknown-command error in stderr')
    },
    helpPrototypeSafe: () => {
        const [state, code] = run(echoCommands)(['help', 'toString'])
        assertEq(code, 0, ['expected exit 0, not a throw', code])
        assert(state.stdout.includes('echo'), 'expected top-level help for unknown target')
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
        assertEq(code, 0, ['expected exit 0', code])
        assert(state.stdout.includes('ping'), 'expected inner command in help')
        assert(!(state.stdout.includes('Subcommand group')), 'expected inner help, not outer')
    },
}
