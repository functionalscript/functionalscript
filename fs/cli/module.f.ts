import { errorExit, log, type NodeOp } from '../effects/node/module.f.ts'
import { pure, type Effect } from '../effects/module.f.ts'

export type Command = {
    readonly names: readonly string[]
    readonly description: string
    readonly handler: (args: readonly string[]) => Effect<NodeOp, number>
}

export type Commands = readonly Command[]

export const dispatch = (commands: Commands) => (args: readonly string[]): Effect<NodeOp, number> => {
    const map = Object.fromEntries(commands.flatMap(c => c.names.map(n => [n, c] as const)))
    const [cmd, ...rest] = args
    const rows = [...commands, { names: ['help'], description: 'Print this help message' }]
    const nameCol = rows.map(c => c.names.join(', '))
    const width = Math.max(...nameCol.map(s => s.length))
    const helpText = ['Available commands:', ...rows.map((c, i) => `  ${nameCol[i].padEnd(width)}  ${c.description}`)].join('\n')
    switch (cmd) {
        case undefined:
            return errorExit(`Error: command is required.\n${helpText}`)
        case 'help':
            return log(helpText).step(() => pure(0))
    }
    const found = map[cmd]
    if (found === undefined) {
        return errorExit(`Error: unknown command "${cmd}".\n${helpText}`)
    }
    return found.handler(rest)
}
