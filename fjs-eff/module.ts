#!/usr/bin/env node

/**
 * Impure entry point for FJS executor
 * 
 * This file runs the effect-based FJS program.
 */

import { runEffect } from '../effects/node/module.ts'
import { main } from './module.f.ts'

// Run the main program
runEffect(main)
    .then((exitCode) => {
        process.exit(exitCode)
    })
    .catch((error) => {
        console.error('Fatal error:', error)
        process.exit(1)
    })
