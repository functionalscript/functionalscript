#!/usr/bin/env node

import { main } from './module.f.ts'
import { run } from './effects/node/module.ts'

await run(main)
