/** Explicit native-runner entry: the actual working directory's FJS proofs. */

import { runEffect } from '../effects/node/module.mjs'
import { registerOne } from './module.f.mjs'

const code = await runEffect(registerOne)
// Deno's test runner can reset process.exitCode after discovery. Fail the
// entry itself so every native runner observes a registration failure.
if (code !== 0) throw new Error('Could not register module proofs')
