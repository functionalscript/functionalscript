#!/usr/bin/env node

import { main } from './module.f.ts'
import { legacyRun } from '../io/module.ts'

await legacyRun(main)
