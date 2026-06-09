import { create, read, write } from './module.f.ts'
import { run } from './module.ts'

export const proof = {
    nodeInterpreter: async () => {
        const result = await run(create(1).step(key =>
            write(key, 2).step(() =>
                read(key)
            )
        ))
        if (result !== 2) { throw result }
    },
}
