/**
 * FunctionalScript compiler entry points and command handlers.
 *
 * @module
 */
import { compile } from '../djs/module.f.ts'
import { main as testMain } from '../dev/tf/module.f.ts'
import { main as casMain } from '../cas/module.f.ts'
import { import_, error, type NodeProgram } from '../types/effects/node/module.f.ts'
import { pure } from '../types/effects/module.f.ts'

export const main: NodeProgram = options => {
    const [command, ...rest] = options.args
    switch (command) {
        case 'test':
        case 't':
            return testMain({ ...options, args: rest })
        case 'compile':
        case 'c':
            return compile(rest)
        case 'cas':
        case 's':
            return casMain(rest)
        case 'run':
        case 'r': {
            const [file, ...args] = rest
            return import_(file).step(([s, v]) => {
                if (s === 'error') { throw v }
                return (v.default as NodeProgram)({ ...options, args })
            })
        }
        case undefined:
            return error('Error: command is required').step(() => pure(1))
        default:
            return error(`Error: Unknown command "${command}"`).step(() => pure(1))
    }
}
