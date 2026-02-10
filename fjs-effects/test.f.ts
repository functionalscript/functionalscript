/**
 * Tests for fjs-effects module
 */

import * as F from './module.f.ts'
import * as E from '../effects/module.f.ts'
import * as N from '../effects/node/module.f.ts'

// Test parseArgs
const testParseArgsEmpty = (): boolean => {
    const cmd = F.parseArgs(['node', 'fjs'])
    return cmd.type === 'help'
}

const testParseArgsHelp = (): boolean => {
    const cmd1 = F.parseArgs(['node', 'fjs', '--help'])
    const cmd2 = F.parseArgs(['node', 'fjs', '-h'])
    return cmd1.type === 'help' && cmd2.type === 'help'
}

const testParseArgsVersion = (): boolean => {
    const cmd1 = F.parseArgs(['node', 'fjs', '--version'])
    const cmd2 = F.parseArgs(['node', 'fjs', '-v'])
    return cmd1.type === 'version' && cmd2.type === 'version'
}

const testParseArgsUnknownOption = (): boolean => {
    const cmd = F.parseArgs(['node', 'fjs', '--unknown'])
    return cmd.type === 'error' && cmd.message === 'Unknown option: --unknown'
}

const testParseArgsFile = (): boolean => {
    const cmd = F.parseArgs(['node', 'fjs', 'test.f.ts'])
    return cmd.type === 'run' && cmd.file === 'test.f.ts'
}

// Test showHelp
const testShowHelp = (): boolean => {
    const effect = F.showHelp()
    return effect[0] === E.logTag && effect[1] === F.helpText
}

// Test showVersion
const testShowVersion = (): boolean => {
    const effect = F.showVersion()
    return effect[0] === E.logTag && effect[1].includes(F.version)
}

// Test showError
const testShowError = (): boolean => {
    const effect = F.showError('test error')
    const state = N.emptyMockState()
    const [newState, _] = N.interpret(state, effect as E.AnyEffect<void>)
    return newState.stderr[0] === 'Error: test error' && newState.exitCode === 1
}

// Test runFile - file exists
const testRunFileExists = (): boolean => {
    const effect = F.runFile('/test.f.ts')
    const state = N.emptyMockState([], {}, { '/test.f.ts': 'const x = 1' })
    const [newState, _] = N.interpret(state, effect as E.AnyEffect<void>)
    return newState.stdout.length === 2 
        && newState.stdout[0] === 'Running: /test.f.ts'
        && newState.stdout[1] === 'Content length: 11 bytes'
}

// Test runFile - file not found
const testRunFileNotFound = (): boolean => {
    const effect = F.runFile('/missing.f.ts')
    const state = N.emptyMockState()
    const [newState, _] = N.interpret(state, effect as E.AnyEffect<void>)
    return newState.stderr[0] === 'Error: File not found: /missing.f.ts'
        && newState.exitCode === 1
}

// Test runCommand - help
const testRunCommandHelp = (): boolean => {
    const effect = F.runCommand({ type: 'help' })
    const state = N.emptyMockState()
    const [newState, _] = N.interpret(state, effect as E.AnyEffect<void>)
    return newState.stdout[0] === F.helpText
}

// Test runCommand - version
const testRunCommandVersion = (): boolean => {
    const effect = F.runCommand({ type: 'version' })
    const state = N.emptyMockState()
    const [newState, _] = N.interpret(state, effect as E.AnyEffect<void>)
    return newState.stdout[0].includes(F.version)
}

// Test runCommand - error
const testRunCommandError = (): boolean => {
    const effect = F.runCommand({ type: 'error', message: 'bad' })
    const state = N.emptyMockState()
    const [newState, _] = N.interpret(state, effect as E.AnyEffect<void>)
    return newState.stderr[0] === 'Error: bad' && newState.exitCode === 1
}

// Test runCommand - run
const testRunCommandRun = (): boolean => {
    const effect = F.runCommand({ type: 'run', file: '/f.ts' })
    const state = N.emptyMockState([], {}, { '/f.ts': 'hi' })
    const [newState, _] = N.interpret(state, effect as E.AnyEffect<void>)
    return newState.stdout[0] === 'Running: /f.ts'
}

// Test main - with help
const testMainHelp = (): boolean => {
    const state = N.emptyMockState(['node', 'fjs', '--help'])
    const [newState, _] = N.interpret(state, F.main as E.AnyEffect<void>)
    return newState.stdout[0] === F.helpText
}

// Test main - with version
const testMainVersion = (): boolean => {
    const state = N.emptyMockState(['node', 'fjs', '-v'])
    const [newState, _] = N.interpret(state, F.main as E.AnyEffect<void>)
    return newState.stdout[0].includes(F.version)
}

// Test main - with file
const testMainFile = (): boolean => {
    const state = N.emptyMockState(
        ['node', 'fjs', '/script.f.ts'],
        {},
        { '/script.f.ts': 'content' }
    )
    const [newState, _] = N.interpret(state, F.main as E.AnyEffect<void>)
    return newState.stdout[0] === 'Running: /script.f.ts'
}

// Test main - file not found
const testMainFileNotFound = (): boolean => {
    const state = N.emptyMockState(['node', 'fjs', '/missing.f.ts'])
    const [newState, _] = N.interpret(state, F.main as E.AnyEffect<void>)
    return newState.exitCode === 1
}

// Test main - unknown option
const testMainUnknownOption = (): boolean => {
    const state = N.emptyMockState(['node', 'fjs', '--bad'])
    const [newState, _] = N.interpret(state, F.main as E.AnyEffect<void>)
    return newState.exitCode === 1 && newState.stderr[0].includes('--bad')
}

// Test helpText content
const testHelpTextContent = (): boolean => {
    return F.helpText.includes('fjs')
        && F.helpText.includes('--help')
        && F.helpText.includes('--version')
        && F.helpText.includes('<file>')
}

// Test version constant
const testVersionConstant = (): boolean => {
    return typeof F.version === 'string' && F.version.length > 0
}

// Run all tests
export const runTests = (): readonly [string, boolean][] => [
    ['parseArgs empty', testParseArgsEmpty()],
    ['parseArgs help', testParseArgsHelp()],
    ['parseArgs version', testParseArgsVersion()],
    ['parseArgs unknown option', testParseArgsUnknownOption()],
    ['parseArgs file', testParseArgsFile()],
    ['showHelp', testShowHelp()],
    ['showVersion', testShowVersion()],
    ['showError', testShowError()],
    ['runFile exists', testRunFileExists()],
    ['runFile not found', testRunFileNotFound()],
    ['runCommand help', testRunCommandHelp()],
    ['runCommand version', testRunCommandVersion()],
    ['runCommand error', testRunCommandError()],
    ['runCommand run', testRunCommandRun()],
    ['main help', testMainHelp()],
    ['main version', testMainVersion()],
    ['main file', testMainFile()],
    ['main file not found', testMainFileNotFound()],
    ['main unknown option', testMainUnknownOption()],
    ['helpText content', testHelpTextContent()],
    ['version constant', testVersionConstant()],
]

// Export test results
export default runTests()
