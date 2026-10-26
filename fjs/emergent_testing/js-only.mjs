/** Explicit native-runner entry: opt-in host JavaScript/TypeScript proofs only. */
import { isHostProof } from '../dev/module.f.mjs'
import { runEffect } from '../effects/node/module.mjs'
import { register } from './module.f.mjs'

await runEffect(options => register(options, isHostProof))
