/**
 * Test Runner for Effects System
 * 
 * Runs all tests and reports results.
 */

import effectsTests from './effects/test.f.ts'
import nodeTests from './effects/node/test.f.ts'
import fjsTests from './fjs-effects/test.f.ts'

type TestResult = readonly [string, boolean]
type TestSuite = readonly TestResult[]

const runSuite = (name: string, tests: TestSuite): boolean => {
    console.log(`\n=== ${name} ===`)
    let passed = 0
    let failed = 0
    
    for (const [testName, result] of tests) {
        if (result) {
            console.log(`  ✓ ${testName}`)
            passed++
        } else {
            console.log(`  ✗ ${testName}`)
            failed++
        }
    }
    
    console.log(`  ${passed}/${passed + failed} passed`)
    return failed === 0
}

const allPassed = [
    runSuite('Effects Module', effectsTests),
    runSuite('Node Effects Module', nodeTests),
    runSuite('FJS Effects Module', fjsTests),
].every(x => x)

console.log(`\n=== Summary ===`)
if (allPassed) {
    console.log('All tests passed!')
    process.exit(0)
} else {
    console.log('Some tests failed!')
    process.exit(1)
}
