#!/usr/bin/env node

import node from './module.ts'
import { compile } from '../djs/module.f.ts'

await node(compile)
