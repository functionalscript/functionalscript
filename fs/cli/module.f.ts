import { errorExit, log, type NodeOp } from '../effects/node/module.f.ts'
import { pure, type Effect } from '../effects/module.f.ts'

export type Command = {
    readonly names: readonly string[]
    readonly description: string
    readonly handler: (args: readonly string[]) => Effect<NodeOp, number>
}

export type Commands = readonly Command[]

const helpMeta = { names: ['help'], description: 'Print this help message' }

export const dispatch = (commands: Commands) => (args: readonly string[]): Effect<NodeOp, number> => {
    const [cmd, ...rest] = args
    const rows = [...commands, helpMeta]
    const nameCol = rows.map(c => c.names.join(', '))
    const width = Math.max(...nameCol.map(s => s.length))
    const helpText = ['Available commands:', ...rows.map((c, i) => `  ${nameCol[i].padEnd(width)}  ${c.description}`)].join('\n')
    const helpCommand: Command = {
        ...helpMeta,
        handler: () => log(helpText).step(() => pure(0))
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
    return found.handler(rest)
}
