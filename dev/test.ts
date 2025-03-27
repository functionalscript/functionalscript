import { main } from './test/module.f.ts'
import { run } from '../io/module.f.ts'
import io from '../io/node-io.ts'

await run(io)(main)
