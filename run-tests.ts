#!/usr/bin/env node

/**
 * Comprehensive Test Runner
 * 
 * Runs all tests for the FunctionalScript effects system
 */

import { spawn } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'

type TestSuite = {
    readonly name: string
    readonly path: string
}

const testSuites: readonly TestSuite[] = [
    { name: 'Core Effects', path: './effects/test.f.ts' },
    { name: 'Node.js Effects', path: './effects/node/test.f.ts' },
    { name: 'FJS Executable', path: './fjs-eff/test.f.ts' },
]

const runTest = (suite: TestSuite): Promise<{ success: boolean, output: string }> => {
    return new Promise((resolve) => {
        console.log(`\n${'='.repeat(60)}`)
        console.log(`Running: ${suite.name}`)
        console.log('='.repeat(60))

        const proc = spawn('tsx', [suite.path], {
            stdio: 'inherit',
            shell: true
        })

        proc.on('close', (code) => {
            resolve({
                success: code === 0,
                output: suite.name
            })
        })

        proc.on('error', (err) => {
            console.error(`Error running ${suite.name}:`, err)
            resolve({
                success: false,
                output: suite.name
            })
        })
    })
}

const main = async () => {
    console.log('FunctionalScript Effects - Test Suite Runner')
    console.log('='.repeat(60))

    const results = await Promise.all(testSuites.map(runTest))

    console.log('\n' + '='.repeat(60))
    console.log('Test Summary')
    console.log('='.repeat(60))

    const passed = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    for (const result of results) {
        const status = result.success ? '✓ PASS' : '✗ FAIL'
        console.log(`${status} - ${result.output}`)
    }

    console.log('\n' + '='.repeat(60))
    console.log(`Total: ${results.length} suites`)
    console.log(`Passed: ${passed.length}`)
    console.log(`Failed: ${failed.length}`)
    console.log('='.repeat(60))

    if (failed.length > 0) {
        console.error('\n❌ Some tests failed')
        process.exit(1)
    } else {
        console.log('\n✅ All tests passed!')
        process.exit(0)
    }
}

main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
})
