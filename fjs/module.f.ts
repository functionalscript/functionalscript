import type { Io } from '../io/module.f.ts'
import { compile } from '../djs/module.f.ts'
import { main as testMain } from '../dev/tf/module.f.ts'

export const main = (io: Io): Promise<number> => {
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
            io.console.error('cas command is not implemented yet')
            return Promise.resolve(1)
        case undefined:
            io.console.error('Error: command is required')
            return Promise.resolve(1)
        default:
            io.console.error(`Error: Unknown command "${command}"`)
            return Promise.resolve(1)
    }
}
