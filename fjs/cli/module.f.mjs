/**
 * CLI command dispatch table.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { NodeOp, Program, Write } from '../effects/node/types.ts'
 * @import { Commands, Main } from './types.ts'
 */

import { errorExit, exitStep, log } from '../effects/node/module.f.mjs'
import { at, fromEntries } from '../types/object/module.f.mjs'

const helpMeta = { names: ['help', 'h', '?'], description: 'Print this help message' }

/** @type {<O extends NodeOp>(commands: Commands<O>) => string} */
const renderHelp = commands => {
    const rows = [...commands, helpMeta]
    const nameCol = rows.map(({ names }) => names.join(', '))
    const width = Math.max(...nameCol.map(({ length }) => length))
    return [
        'Available commands:',
        ...rows.map(({ description }, i) => `  ${nameCol[i].padEnd(width)}  ${description}`)
    ].join('\n')
}

/**
 * Runs a `Main`: a `Program` as itself, a `Commands` table by routing its first
 * argument to the command it names.
 *
 * @type {<O extends NodeOp>(main: Main<O>) => Program<O | Write>}
 */
export const dispatch = main => typeof main === 'function' ? main : dispatchCommands(main)

/** @type {<O extends NodeOp>(commands: Commands<O>) => Program<O | Write>} */
const dispatchCommands = commands => options => {
    const [cmd, ...rest] = options.args
    const map = fromEntries(commands.flatMap(c => c.names.map(n => /** @type {const} */ ([n, c]))))
    if (cmd === undefined) {
        return errorExit(`Error: command is required.\n${renderHelp(commands)}`)
    }
    if (helpMeta.names.includes(cmd)) {
        const [target] = rest
        if (target !== undefined) {
            const targetCmd = at(target)(map)
            if (targetCmd !== null && typeof targetCmd.handler !== 'function') {
                return dispatchCommands(targetCmd.handler)({ ...options, args: ['help'] })
            }
        }
        return exitStep(log(renderHelp(commands)))
    }
    const found = at(cmd)(map)
    if (found === null) {
        return errorExit(`Error: unknown command "${cmd}".\n${renderHelp(commands)}`)
    }
    return dispatch(found.handler)({ ...options, args: rest })
}
