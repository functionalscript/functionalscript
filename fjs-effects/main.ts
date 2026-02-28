#!/usr/bin/env node
/**
 * FJS Effects Runner
 * 
 * This is the entry point for running the effects-based fjs.
 * It imports the pure main effect and runs it with the Node.js interpreter.
 */

import { main } from './module.f.ts'
import { run } from '../effects/node/module.ts'
import type { AnyEffect } from '../effects/module.f.ts'

// Run the main effect
run(main as AnyEffect<void>)
