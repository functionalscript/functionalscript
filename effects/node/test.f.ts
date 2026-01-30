import * as NodeEffect from './module.f.ts'
import * as Effect from '../module.f.ts'

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
 * Test readFile creates correct effect structure
 */
export const testReadFile = (): void => {
    const effect = NodeEffect.readFile('/path/to/file.txt')
    
    assertEqual(effect[0], 'readFile', 'readFile should have correct tag')
    assertEqual(effect[1], '/path/to/file.txt', 'readFile should have correct path')
    
    // Test continuation returns pure effect
    const continued = effect[2]('file content')
    assertEqual(Effect.isPure(continued), true, 'readFile continuation should return pure effect')
    assertEqual(Effect.unsafeGetPure(continued), 'file content', 'readFile should preserve content')
}

/**
 * Test writeFile creates correct effect structure
 */
export const testWriteFile = (): void => {
    const effect = NodeEffect.writeFile('/path/to/file.txt')('content to write')
    
    assertEqual(effect[0], 'writeFile', 'writeFile should have correct tag')
    assertEqual(effect[1], { path: '/path/to/file.txt', content: 'content to write' }, 'writeFile should have correct payload')
    
    const continued = effect[2](undefined)
    assertEqual(Effect.isPure(continued), true, 'writeFile continuation should return pure effect')
}

/**
 * Test fileExists creates correct effect structure
 */
export const testFileExists = (): void => {
    const effect = NodeEffect.fileExists('/path/to/file.txt')
    
    assertEqual(effect[0], 'fileExists', 'fileExists should have correct tag')
    assertEqual(effect[1], '/path/to/file.txt', 'fileExists should have correct path')
    
    const continuedTrue = effect[2](true)
    assertEqual(Effect.unsafeGetPure(continuedTrue), true, 'fileExists should handle true')
    
    const continuedFalse = effect[2](false)
    assertEqual(Effect.unsafeGetPure(continuedFalse), false, 'fileExists should handle false')
}

/**
 * Test readDir creates correct effect structure
 */
export const testReadDir = (): void => {
    const effect = NodeEffect.readDir('/path/to/dir')
    
    assertEqual(effect[0], 'readDir', 'readDir should have correct tag')
    assertEqual(effect[1], '/path/to/dir', 'readDir should have correct path')
    
    const entries = ['file1.txt', 'file2.txt', 'subdir']
    const continued = effect[2](entries)
    assertEqual(Effect.unsafeGetPure(continued), entries, 'readDir should preserve entries')
}

/**
 * Test deleteFile creates correct effect structure
 */
export const testDeleteFile = (): void => {
    const effect = NodeEffect.deleteFile('/path/to/file.txt')
    
    assertEqual(effect[0], 'deleteFile', 'deleteFile should have correct tag')
    assertEqual(effect[1], '/path/to/file.txt', 'deleteFile should have correct path')
    
    const continued = effect[2](undefined)
    assertEqual(Effect.isPure(continued), true, 'deleteFile continuation should return pure effect')
}

/**
 * Test mkDir creates correct effect structure
 */
export const testMkDir = (): void => {
    const effect = NodeEffect.mkDir('/path/to/dir')(true)
    
    assertEqual(effect[0], 'mkDir', 'mkDir should have correct tag')
    assertEqual(effect[1], { path: '/path/to/dir', recursive: true }, 'mkDir should have correct payload')
    
    const continued = effect[2](undefined)
    assertEqual(Effect.isPure(continued), true, 'mkDir continuation should return pure effect')
}

/**
 * Test getArgs creates correct effect structure
 */
export const testGetArgs = (): void => {
    const effect = NodeEffect.getArgs
    
    assertEqual(effect[0], 'getArgs', 'getArgs should have correct tag')
    assertEqual(effect[1], null, 'getArgs should have null payload')
    
    const args = ['arg1', 'arg2', 'arg3']
    const continued = effect[2](args)
    assertEqual(Effect.unsafeGetPure(continued), args, 'getArgs should preserve arguments')
}

/**
 * Test getEnv creates correct effect structure
 */
export const testGetEnv = (): void => {
    const effect = NodeEffect.getEnv('HOME')
    
    assertEqual(effect[0], 'getEnv', 'getEnv should have correct tag')
    assertEqual(effect[1], 'HOME', 'getEnv should have correct variable name')
    
    const continuedDefined = effect[2]('/home/user')
    assertEqual(Effect.unsafeGetPure(continuedDefined), '/home/user', 'getEnv should handle defined value')
    
    const continuedUndefined = effect[2](undefined)
    assertEqual(Effect.unsafeGetPure(continuedUndefined), undefined, 'getEnv should handle undefined value')
}

/**
 * Test exit creates correct effect structure
 */
export const testExit = (): void => {
    const effect = NodeEffect.exit(0)
    
    assertEqual(effect[0], 'exit', 'exit should have correct tag')
    assertEqual(effect[1], 0, 'exit should have correct exit code')
}

/**
 * Test stdOut creates correct effect structure
 */
export const testStdOut = (): void => {
    const effect = NodeEffect.stdOut('Hello, World!\n')
    
    assertEqual(effect[0], 'stdOut', 'stdOut should have correct tag')
    assertEqual(effect[1], 'Hello, World!\n', 'stdOut should have correct message')
    
    const continued = effect[2](undefined)
    assertEqual(Effect.isPure(continued), true, 'stdOut continuation should return pure effect')
}

/**
 * Test stdErr creates correct effect structure
 */
export const testStdErr = (): void => {
    const effect = NodeEffect.stdErr('Error message\n')
    
    assertEqual(effect[0], 'stdErr', 'stdErr should have correct tag')
    assertEqual(effect[1], 'Error message\n', 'stdErr should have correct message')
    
    const continued = effect[2](undefined)
    assertEqual(Effect.isPure(continued), true, 'stdErr continuation should return pure effect')
}

/**
 * Test stdIn creates correct effect structure
 */
export const testStdIn = (): void => {
    const effect = NodeEffect.stdIn
    
    assertEqual(effect[0], 'stdIn', 'stdIn should have correct tag')
    assertEqual(effect[1], null, 'stdIn should have null payload')
    
    const continued = effect[2]('user input')
    assertEqual(Effect.unsafeGetPure(continued), 'user input', 'stdIn should preserve input')
}

/**
 * Test effect composition with flatMap
 */
export const testEffectComposition = (): void => {
    const program = Effect.flatMap((content: string) =>
        NodeEffect.stdOut(`File content: ${content}\n`)
    )(NodeEffect.readFile('/file.txt'))
    
    assertEqual(program[0], 'readFile', 'composed effect should start with readFile')
    
    const afterRead = program[2]('hello')
    assertEqual(afterRead[0], 'stdOut', 'composed effect should continue with stdOut')
    assertEqual(afterRead[1], 'File content: hello\n', 'composed effect should transform data')
}

/**
 * Test effect composition with multiple operations
 */
export const testMultipleEffectComposition = (): void => {
    const program = Effect.flatMap((exists: boolean) =>
        exists
            ? Effect.flatMap((content: string) =>
                NodeEffect.stdOut(content)
            )(NodeEffect.readFile('/file.txt'))
            : NodeEffect.stdErr('File not found\n')
    )(NodeEffect.fileExists('/file.txt'))
    
    assertEqual(program[0], 'fileExists', 'program should start with fileExists')
    
    // Test true branch
    const afterExistsTrue = program[2](true)
    assertEqual(afterExistsTrue[0], 'readFile', 'true branch should read file')
    
    // Test false branch
    const afterExistsFalse = program[2](false)
    assertEqual(afterExistsFalse[0], 'stdErr', 'false branch should write to stderr')
}

/**
 * Test sequence with multiple effects
 */
export const testSequenceEffects = (): void => {
    const files = ['/file1.txt', '/file2.txt', '/file3.txt']
    const readEffects = files.map(NodeEffect.readFile)
    const program = Effect.sequence(readEffects)
    
    assertEqual(program[0], 'readFile', 'sequenced effects should start with first effect')
}

/**
 * Test traverse with effects
 */
export const testTraverseEffects = (): void => {
    const files = ['/file1.txt', '/file2.txt']
    const program = Effect.traverse(NodeEffect.readFile)(files)
    
    assertEqual(program[0], 'readFile', 'traverse should create effect')
}

/**
 * Run all tests
 */
export const runTests = (): void => {
    const tests = [
        ['readFile', testReadFile],
        ['writeFile', testWriteFile],
        ['fileExists', testFileExists],
        ['readDir', testReadDir],
        ['deleteFile', testDeleteFile],
        ['mkDir', testMkDir],
        ['getArgs', testGetArgs],
        ['getEnv', testGetEnv],
        ['exit', testExit],
        ['stdOut', testStdOut],
        ['stdErr', testStdErr],
        ['stdIn', testStdIn],
        ['effect composition', testEffectComposition],
        ['multiple effect composition', testMultipleEffectComposition],
        ['sequence effects', testSequenceEffects],
        ['traverse effects', testTraverseEffects],
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
