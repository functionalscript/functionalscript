/**
 * FunctionalScript compiler entry points and command handlers.
 *
 * @module
 */
import { fromIo, type Io } from '../io/module.f.ts'
import { compile } from '../djs/module.f.ts'
import { main as testMain } from '../dev/tf/module.f.ts'
import { main as casMain } from '../cas/module.f.ts'
import type { NodeProgram } from '../types/effect/node/module.f.ts'

export const main = async(io: Io): Promise<number> => {
    const { error } = io.console
    const [command, ...rest] = io.process.argv.slice(2)
    const eRun = fromIo(io)
    switch (command) {
        case 'test':
        case 't':
            return testMain(io)
        case 'compile':
        case 'c':
            return compile(io)(rest)
        case 'cas':
        case 's':
            return eRun(casMain(rest))
        case 'run':
        case 'r':
            const [file, ...args] = rest
            const m = await io.asyncImport(file)
            return eRun((m.default as NodeProgram)(args))
        case undefined:
            error('Error: command is required')
            return Promise.resolve(1)
        default:
            error(`Error: Unknown command "${command}"`)
            return Promise.resolve(1)
    }
}
