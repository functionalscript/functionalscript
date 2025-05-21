#!/usr/bin/env node

import { main } from '../dev/test/module.f.ts'
import node from './module.ts'

await node(main)
