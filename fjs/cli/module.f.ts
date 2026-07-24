import { errorExit, log, type NodeOp, type NodeProgramOptions, type Write } from '../effects/node/module.f.ts'
import { pure, type Effect } from '../effects/module.f.ts'
import { eff } from '../effects/eff/module.f.ts'
import { at, fromEntries } from '../types/object/module.f.ts'

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
    const nameCol = rows.map(({names}) => names.join(', '))
    const width = Math.max(...nameCol.map(({length}) => length))
    const helpText = [
        'Available commands:',
        ...rows.map(({description}, i) => `  ${nameCol[i].padEnd(width)}  ${description}`)
    ].join('\n')
    const map = fromEntries(commands.flatMap(c => c.names.map(n => [n, c] as const)))
    if (cmd === undefined) {
        return errorExit(`Error: command is required.\n${helpText}`)
    }
    if (helpMeta.names.includes(cmd)) {
        const [target] = rest
        if (target !== undefined) {
            const targetCmd = at(target)(map)
            if (targetCmd !== null && typeof targetCmd.handler !== 'function') {
                return dispatch(targetCmd.handler)({ ...options, args: ['help'] })
            }
        }
        return eff(log(helpText)).step(() => pure(0)).value
    }
    const found = at(cmd)(map)
    if (found === null) {
        return errorExit(`Error: unknown command "${cmd}".\n${helpText}`)
    }
    const { handler } = found
    return (typeof handler === 'function' ? handler : dispatch(handler))({ ...options, args: rest })
}
