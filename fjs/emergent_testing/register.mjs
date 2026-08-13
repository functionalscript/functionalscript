/**
 * External-runner entry point: importing this module discovers every proof
 * module and registers each test case with the active test runner. Projects
 * using Node, Bun, or Deno test runners re-export it from their own entry
 * file with a bare side-effect import; see `README.md`.
 */

import { runEffect } from '../effects/node/module.mjs'
import { register } from './module.f.mjs'

// Top-level `await`: every proof must be registered before the runner starts
// collecting tests.
await runEffect(register)
