#!/usr/bin/env node

import { main } from './module.f.mjs'
import { run } from './effects/node/module.ts'

await run(main)
