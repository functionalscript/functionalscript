#!/usr/bin/env node

import node from './io/node.ts'
import { compile } from './djs/module.f.ts'

await node(compile)
