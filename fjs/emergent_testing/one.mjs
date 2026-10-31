/** Explicit native-runner entry: the actual working directory's FJS proofs. */

import process from 'node:process'

import { runEffect } from '../effects/node/module.mjs'
import { registerOne } from './module.f.mjs'

const code = await runEffect(registerOne)
if (code !== 0) process.exitCode = code
