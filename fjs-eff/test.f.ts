import * as FJS from './module.f.ts'
import * as Effect from '../effects/module.f.ts'
import * as Path from '../path/module.f.ts'

/**
 * Test utilities
 */
const assertEqual = <T>(actual: T, expected: T, message: string): void => {
    const actualStr = JSON.stringify(actual)
    const expectedStr = JSON.stringify(expected)
    if (actualStr !== expectedStr) {
        throw new Error(`${message}\nExpected: ${expectedStr}\nActual: ${actualStr}`)
    }
}

/**
 * Test parseArgs with no arguments
 */
export const testParseArgsEmpty = (): void => {
    const result = FJS.parseArgs([])
    assertEqual(result, { file: null, runTests: false }, 'parseArgs should handle empty args')
}

/**
 * Test parseArgs with file only
 */
export const testParseArgsFile = (): void => {
    const result = FJS.parseArgs(['script.f.ts'])
    assertEqual(result, { file: 'script.f.ts', runTests: false }, 'parseArgs should extract file')
}

/**
 * Test parseArgs with test flag
 */
export const testParseArgsTest = (): void => {
    const result = FJS.parseArgs(['script.f.ts', '--test'])
    assertEqual(result, { file: 'script.f.ts', runTests: true }, 'parseArgs should handle --test flag')
}

/**
 * Test parseArgs with short test flag
 */
export const testParseArgsTestShort = (): void => {
    const result = FJS.parseArgs(['script.f.ts', '-t'])
    assertEqual(result, { file: 'script.f.ts', runTests: true }, 'parseArgs should handle -t flag')
}

/**
 * Test parseArgs with help flag
 */
export const testParseArgsHelp = (): void => {
    const result = FJS.parseArgs(['--help'])
    assertEqual(result, { file: null, runTests: false }, 'parseArgs should handle --help flag')
}

/**
 * Test parseArgs with multiple flags
 */
export const testParseArgsMultipleFlags = (): void => {
    const result = FJS.parseArgs(['script.f.ts', '--test', '--verbose'])
    assertEqual(result.file, 'script.f.ts', 'parseArgs should extract file with multiple flags')
    assertEqual(result.runTests, true, 'parseArgs should detect test flag with multiple flags')
}

/**
 * Test getTestFile
 */
export const testGetTestFile = (): void => {
    const result = FJS.getTestFile('src/module.f.ts')
    assertEqual(result, 'src/test.f.ts', 'getTestFile should replace filename with test.f.ts')
}

/**
 * Test getTestFile with nested path
 */
export const testGetTestFileNested = (): void => {
    const result = FJS.getTestFile('src/utils/helper.f.ts')
    assertEqual(result, 'src/utils/test.f.ts', 'getTestFile should work with nested paths')
}

/**
 * Test getTestFile with current directory
 */
export const testGetTestFileCurrent = (): void => {
    const result = FJS.getTestFile('module.f.ts')
    assertEqual(result, './test.f.ts', 'getTestFile should handle current directory')
}

/**
 * Test validateSyntax with clean code
 */
export const testValidateSyntaxClean = (): void => {
    const content = `
export const add = (a: number) => (b: number): number => a + b
export const multiply = (a: number) => (b: number): number => a * b
    `
    const errors = FJS.validateSyntax(content)
    assertEqual(errors, [], 'validateSyntax should return no errors for clean code')
}

/**
 * Test validateSyntax with async
 */
export const testValidateSyntaxAsync = (): void => {
    const content = `
export const fetchData = async () => {
    return await fetch('url')
}
    `
    const errors = FJS.validateSyntax(content)
    assertEqual(errors.length > 0, true, 'validateSyntax should detect async/await')
}

/**
 * Test validateSyntax with Promise
 */
export const testValidateSyntaxPromise = (): void => {
    const content = `
export const getData = (): Promise<string> => {
    return new Promise(resolve => resolve('data'))
}
    `
    const errors = FJS.validateSyntax(content)
    assertEqual(errors.length > 0, true, 'validateSyntax should detect Promise')
}

/**
 * Test validateSyntax with console.log
 */
export const testValidateSyntaxConsoleLog = (): void => {
    const content = `
export const debug = (x: number) => {
    console.log(x)
    return x
}
    `
    const errors = FJS.validateSyntax(content)
    assertEqual(errors.length > 0, true, 'validateSyntax should detect console.log')
}

/**
 * Test validateSyntax with multiple violations
 */
export const testValidateSyntaxMultiple = (): void => {
    const content = `
export const badCode = async () => {
    console.log('hello')
    await Promise.resolve()
    process.exit(0)
}
    `
    const errors = FJS.validateSyntax(content)
    assertEqual(errors.length >= 3, true, 'validateSyntax should detect multiple violations')
}

/**
 * Test hasSyntaxErrors with clean code
 */
export const testHasSyntaxErrorsClean = (): void => {
    const content = `export const pure = (x: number) => x * 2`
    const result = FJS.hasSyntaxErrors(content)
    assertEqual(result, false, 'hasSyntaxErrors should return false for clean code')
}

/**
 * Test hasSyntaxErrors with errors
 */
export const testHasSyntaxErrorsWithErrors = (): void => {
    const content = `export const impure = async () => await fetch('url')`
    const result = FJS.hasSyntaxErrors(content)
    assertEqual(result, true, 'hasSyntaxErrors should return true for code with errors')
}

/**
 * Test formatSyntaxErrors
 */
export const testFormatSyntaxErrors = (): void => {
    const errors = [
        'FunctionalScript does not allow async/await',
        'Impure operation detected: console.log'
    ]
    const result = FJS.formatSyntaxErrors(errors)
    
    assertEqual(result.includes('FunctionalScript Syntax Errors:'), true, 'formatSyntaxErrors should include header')
    assertEqual(result.includes('async/await'), true, 'formatSyntaxErrors should include first error')
    assertEqual(result.includes('console.log'), true, 'formatSyntaxErrors should include second error')
}

/**
 * Test program with help flag
 */
export const testProgramHelp = (): void => {
    const config: FJS.Config = {
        args: ['--help'],
        cwd: '/home/user'
    }
    const effect = FJS.program(config)
    
    // Should output help and exit
    assertEqual(effect[0], 'stdOut', 'program should output help')
}

/**
 * Test program with no arguments
 */
export const testProgramNoArgs = (): void => {
    const config: FJS.Config = {
        args: [],
        cwd: '/home/user'
    }
    const effect = FJS.program(config)
    
    // Should output help and exit
    assertEqual(effect[0], 'stdOut', 'program should output help when no args')
}

/**
 * Test program with valid file
 */
export const testProgramValidFile = (): void => {
    const config: FJS.Config = {
        args: ['script.f.ts'],
        cwd: '/home/user'
    }
    const effect = FJS.program(config)
    
    // Should check if file exists
    assertEqual(effect[0], 'fileExists', 'program should check file existence')
}

/**
 * Test program with test flag
 */
export const testProgramWithTestFlag = (): void => {
    const config: FJS.Config = {
        args: ['module.f.ts', '--test'],
        cwd: '/home/user'
    }
    const effect = FJS.program(config)
    
    // Should check for test file
    assertEqual(effect[0], 'fileExists', 'program should check test file existence')
}

/**
 * Test executeFile creates correct effect
 */
export const testExecuteFile = (): void => {
    const effect = FJS.executeFile('/path/to/script.f.ts')
    
    assertEqual(effect[0], 'readFile', 'executeFile should read file')
    assertEqual(effect[1], '/path/to/script.f.ts', 'executeFile should read correct path')
}

/**
 * Mock test for executeFile with valid content
 */
export const testExecuteFileValidContent = (): void => {
    const validContent = 'export const add = (a: number) => (b: number) => a + b'
    const effect = FJS.executeFile('/path/to/script.f.ts')
    
    // Simulate reading the file
    const afterRead = effect[2](validContent)
    
    // Should output success message
    assertEqual(afterRead[0], 'stdOut', 'executeFile should output message for valid content')
}

/**
 * Mock test for executeFile with invalid extension
 */
export const testExecuteFileInvalidExtension = (): void => {
    const content = 'some content'
    const effect = FJS.executeFile('/path/to/script.js')
    
    // Simulate reading the file
    const afterRead = effect[2](content)
    
    // Should output error
    assertEqual(afterRead[0], 'stdErr', 'executeFile should error on invalid extension')
}

/**
 * Mock test for executeFile with non-functional file
 */
export const testExecuteFileNonFunctional = (): void => {
    const content = 'some content'
    const effect = FJS.executeFile('/path/to/script.ts')
    
    // Simulate reading the file (script.ts doesn't have .f.)
    const afterRead = effect[2](content)
    
    // Should output error
    assertEqual(afterRead[0], 'stdErr', 'executeFile should error on non-functional file')
}

/**
 * Run all tests
 */
export const runTests = (): void => {
    const tests = [
        ['parseArgs empty', testParseArgsEmpty],
        ['parseArgs file', testParseArgsFile],
        ['parseArgs test', testParseArgsTest],
        ['parseArgs test short', testParseArgsTestShort],
        ['parseArgs help', testParseArgsHelp],
        ['parseArgs multiple flags', testParseArgsMultipleFlags],
        ['getTestFile', testGetTestFile],
        ['getTestFile nested', testGetTestFileNested],
        ['getTestFile current', testGetTestFileCurrent],
        ['validateSyntax clean', testValidateSyntaxClean],
        ['validateSyntax async', testValidateSyntaxAsync],
        ['validateSyntax Promise', testValidateSyntaxPromise],
        ['validateSyntax console.log', testValidateSyntaxConsoleLog],
        ['validateSyntax multiple', testValidateSyntaxMultiple],
        ['hasSyntaxErrors clean', testHasSyntaxErrorsClean],
        ['hasSyntaxErrors with errors', testHasSyntaxErrorsWithErrors],
        ['formatSyntaxErrors', testFormatSyntaxErrors],
        ['program help', testProgramHelp],
        ['program no args', testProgramNoArgs],
        ['program valid file', testProgramValidFile],
        ['program with test flag', testProgramWithTestFlag],
        ['executeFile', testExecuteFile],
        ['executeFile valid content', testExecuteFileValidContent],
        ['executeFile invalid extension', testExecuteFileInvalidExtension],
        ['executeFile non-functional', testExecuteFileNonFunctional],
    ] as const

    let passed = 0
    let failed = 0

    for (const [name, test] of tests) {
        try {
            test()
            passed++
            console.log(`✓ ${name}`)
        } catch (e) {
            failed++
            console.error(`✗ ${name}`)
            console.error(e)
        }
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed`)
    if (failed > 0) {
        throw new Error('Some tests failed')
    }
}

// Auto-run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    runTests()
}
