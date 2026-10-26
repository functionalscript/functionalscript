/** Explicit native-runner entry: authored FunctionalScript proofs only. */
import { isAuthored } from '../dev/module.f.mjs'
import { runEffect } from '../effects/node/module.mjs'
import { register } from './module.f.mjs'

await runEffect(options => register(options, isAuthored))
