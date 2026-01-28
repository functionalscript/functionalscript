import type { Io } from '../io/module.f.ts'
import { compile } from '../djs/module.f.ts'
import { main as testMain } from '../dev/tf/module.f.ts'
import { main as casMain } from '../cas/module.f.ts'

export const main = (io: Io): Promise<number> => {
    const { error } = io.console
    const [command, ...rest] = io.process.argv.slice(2)
    switch (command) {
        case 'test':
        case 't':
            return testMain(io)
        case 'compile':
        case 'c':
            return compile(io)(rest)
        case 'cas':
        case 's':
            return casMain(io)(rest)
        case undefined:
            error('Error: command is required')
            return Promise.resolve(1)
        default:
            error(`Error: Unknown command "${command}"`)
            return Promise.resolve(1)
    }
}
