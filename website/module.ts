import { run } from './module.f.ts'
import { nodeRun } from '../types/effect/node/module.ts'

await nodeRun(run)
