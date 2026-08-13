import { runEffect } from '../effects/node/module.mjs'
import { register } from './module.f.mjs'

// Top-level `await`: every proof must be registered before the runner starts
// collecting tests.
await runEffect(register)
