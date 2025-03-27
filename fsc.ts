#!/usr/bin/env node

import io from './io/node-io.ts'
import { run } from './io/module.f.ts'
import { compile } from './djs/module.f.ts'

await run(io)(compile)
