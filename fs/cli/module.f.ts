import { errorExit, log, type NodeOp, type NodeProgramOptions, type Write } from '../effects/node/module.f.ts'
import { pure, type Effect } from '../effects/module.f.ts'

type Handler<O extends NodeOp> = (options: NodeProgramOptions) => Effect<O, number>

export type Command<O extends NodeOp> = {
    readonly names: readonly string[]
    readonly description: string
    readonly handler: Handler<O> | Commands<O>
}

export type Commands<O extends NodeOp> = readonly Command<O>[]

const helpMeta = { names: ['help', 'h', '?'], description: 'Print this help message' }

export const dispatch = <O extends NodeOp>(commands: Commands<O>) => (options: NodeProgramOptions): Effect<O | Write, number> => {
    const [cmd, ...rest] = options.args
    const rows = [...commands, helpMeta]
    const nameCol = rows.map(c => c.names.join(', '))
    const width = Math.max(...nameCol.map(s => s.length))
    const helpText = ['Available commands:', ...rows.map((c, i) => `  ${nameCol[i].padEnd(width)}  ${c.description}`)].join('\n')
    const helpCommand: Command<O | Write> = {
        ...helpMeta,
        handler: () => log(helpText).step(() => pure(0)),
    }
    const allCommands = [...commands, helpCommand]
    const map = Object.fromEntries(allCommands.flatMap(c => c.names.map(n => [n, c] as const)))
    if (cmd === undefined) {
        return errorExit(`Error: command is required.\n${helpText}`)
    }
    const found = map[cmd]
    if (found === undefined) {
        return errorExit(`Error: unknown command "${cmd}".\n${helpText}`)
    }
    const { handler } = found
    if (typeof handler === 'function') {
        return handler({ ...options, args: rest })
    }
    return dispatch(handler as Commands<O | Write>)({ ...options, args: rest })
}
