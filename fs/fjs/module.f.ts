/**
 * FunctionalScript compiler entry points and command handlers.
 *
 * @module
 */
import { fromIo, runProgram, type Io } from '../io/module.f.ts'
import { compile } from '../djs/module.f.ts'
import { main as testMain } from '../dev/tf/module.f.ts'
import { main as casMain } from '../cas/module.f.ts'
import { import_, type NodeProgram } from '../types/effects/node/module.f.ts'

export const main = async(io: Io): Promise<number> => {
    const { error } = io.console
    const { process } = io
    const [command, ...rest] = process.argv.slice(2)
    const eRun = fromIo(io)
    switch (command) {
        case 'test':
        case 't':
            return testMain(io)
        case 'compile':
        case 'c':
            return eRun(compile(rest))
        case 'cas':
        case 's':
            return eRun(casMain(rest))
        case 'run':
        case 'r':
            const [file, ...args] = rest
            return runProgram(io)(args)(o => import_(file).step(([s, v]) => {
                if (s === 'error') { throw v }
                return (v.default as NodeProgram)(o)
            }))
        case undefined:
            error('Error: command is required')
            return Promise.resolve(1)
        default:
            error(`Error: Unknown command "${command}"`)
            return Promise.resolve(1)
    }
}
