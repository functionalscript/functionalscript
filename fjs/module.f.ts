import { fromIo, type Io } from '../io/module.f.ts'
import { compile } from '../djs/module.f.ts'
import { main as testMain } from '../dev/tf/module.f.ts'
import { main as casMain } from '../cas/module.f.ts'
import { error } from '../types/effect/node/module.f.ts'

export const main = (io: Io): Promise<number> => {
    const run = fromIo(io)
    const [command, ...rest] = io.process.argv.slice(2)
    switch (command) {
        case 'test':
        case 't':
            return testMain(io)
        case 'compile':
        case 'c':
            return run(compile(io.fs)(rest))
        case 'cas':
        case 's':
            return run(casMain(rest))
        case undefined:
            return run(error('Error: command is required').map(() => 1))
        default:
            return run(error(`Error: Unknown command "${command}"`).map(() => 1))
    }
}
