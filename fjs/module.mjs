#!/usr/bin/env node

import { main } from './module.f.mjs'
import { run } from './effects/node/module.mjs'

await run(main)
