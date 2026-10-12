/**
 * CLI command dispatch table.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { NodeOp, Program, Write } from '../effects/node/types.ts'
 * @import { Command, Commands, CommandReference, Main } from './types.ts'
 */

import { errorExit, exitStep, log } from '../effects/node/module.f.mjs'
import { at, fromEntries, isObject } from '../types/object/module.f.mjs'
import { isArray } from '../types/array/module.f.mjs'
import { max } from '../types/number/max/module.f.js'

/** Metadata for the help command implicit in every dispatch table. */
export const helpMeta = /** @type {const} */ { names: ['help', 'h', '?'], description: 'Print this help message' }

/** Reference for the help command implicit in a canonical command path.
 * @type {(parent: readonly string[]) => CommandReference}
 */
export const helpReference = parent => ({
    usage: parent.length === 0 ? 'fjs help [command]' : `fjs ${parent.join(' ')} help`,
    examples: parent.length === 0 ? ['fjs help', 'fjs help cas'] : [`fjs help ${parent.join(' ')}`],
    note: parent.length === 0
        ? 'A command table target lists its subcommands. For a program target, help lists the top-level commands; it does not describe positional parameters.'
        : 'Both invocations list the subcommands and their aliases.',
    docs: 'fjs/README.md',
})

/** @type {<O extends NodeOp>(commands: Commands<O>) => string} */
const renderHelp = commands => {
    const rows = [...commands, helpMeta]
    const nameCol = rows.map(({ names }) => names.join(', '))
    const width = nameCol.reduce((m, { length }) => max(m, length), -Infinity)
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

/**
 * Whether a value from outside the type system — a module's `main`, say — is a
 * `Main`: a function, or a table whose every command has string `names`, a
 * string `description` and a `Main` for its `handler`. A function is taken to
 * be a `Program`; nothing can check that before calling it.
 *
 * @param {unknown} value
 * @returns {value is Main<NodeOp>}
 */
export const isMain = value => typeof value === 'function' || (isArray(value) && value.every(isCommand))

/**
 * @param {unknown} value
 * @returns {value is Command<NodeOp>}
 */
const isCommand = value => {
    if (!isObject(value)) { return false }
    const { names, description, handler } = value
    return isArray(names) && names.every(n => typeof n === 'string')
        && typeof description === 'string'
        && isMain(handler)
}

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
