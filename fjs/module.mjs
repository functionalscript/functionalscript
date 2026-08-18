#!/usr/bin/env node

/**
 * The `fjs` CLI executable entry point.
 *
 * @module
 */

import { main } from './module.f.mjs'
import { run } from './effects/node/module.mjs'

await run(main)
