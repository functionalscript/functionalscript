/**
 * CLI command dispatch table.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { NodeOp, Program, Write } from '../effects/node/types.ts'
 * @import { RawEffect } from '../effects/types.ts'
 * @import { Commands } from './types.ts'
 */

import { errorExit, exitStep, log } from '../effects/node/module.f.mjs'
import { at, fromEntries } from '../types/object/module.f.mjs'

const helpMeta = { names: ['help', 'h', '?'], description: 'Print this help message' }

/** @type {<O extends NodeOp>(commands: Commands<O>) => Program<O | Write>} */
export const dispatch = commands => options => {
    const [cmd, ...rest] = options.args
    const rows = [...commands, helpMeta]
    const nameCol = rows.map(({names}) => names.join(', '))
    const width = Math.max(...nameCol.map(({length}) => length))
    const helpText = [
        'Available commands:',
        ...rows.map(({description}, i) => `  ${nameCol[i].padEnd(width)}  ${description}`)
    ].join('\n')
    const map = fromEntries(commands.flatMap(c => c.names.map(n => /** @type {const} */ ([n, c]))))
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
        return exitStep(log(helpText))
    }
    const found = at(cmd)(map)
    if (found === null) {
        return errorExit(`Error: unknown command "${cmd}".\n${helpText}`)
    }
    const { handler } = found
    return (typeof handler === 'function' ? handler : dispatch(handler))({ ...options, args: rest })
}
