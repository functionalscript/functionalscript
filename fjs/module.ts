#!/usr/bin/env node

import { main } from './module.f.ts'
import { legacyRun } from '../fs/io/module.ts'

legacyRun(main)
