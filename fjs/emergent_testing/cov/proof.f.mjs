/**
 * @import { IoResult } from '../../effects/types.ts'
 * @import { Child, ExitStatus, NodeOp, NodeProgramOptions } from '../../effects/node/types.ts'
 * @import { PartialMemOperationMap, RunInstance } from '../../effects/mock/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { _CoverageFile } from './types.ts'
 */

import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../../asserts/module.f.js'
import { ioError } from '../../effects/module.f.mjs'
import { partialRun } from '../../effects/mock/module.f.mjs'
import { exitCode, nodeCommands } from '../../effects/node/module.f.mjs'
import { defaultNodeProgramOptions } from '../../effects/node/virtual/module.f.mjs'
import { join, normalize } from '../../path/module.f.mjs'
import { utf8ToString } from '../../text/utf8/module.f.mjs'
import { asNominal } from '../../types/nominal/module.f.js'
import { error, ok } from '../../types/result/module.f.js'
import { _commandLine, _coverageFailures, _modules, _nodeArgs, isCoverageTarget, main } from './module.f.mjs'

/** @type {IoResult<ExitStatus>} */
const passed = ok(['exited', 0])
/** @type {IoResult<ExitStatus>} */
const failed = ok(['exited', 1])
/** @type {IoResult<ExitStatus>} */
const signaled = ok(['signaled', 'SIGTERM'])
/** @type {IoResult<ExitStatus>} */
const unavailable = error(ioError({ message: 'child unavailable' }))

const reporterUrl = /** @type {const} */ ('file:///package%20root/fjs/emergent_testing/cov/reporter.mjs')

/** A filesystem with ignored dependencies and differently named measured files. */
const tree = /** @type {const} */ ({
    '.': [['z', true], ['a', true], ['node_modules', true], ['README.md', false]],
    a: [['module.f.mjs', false], ['demo.f.mjs', false], ['proof.f.mjs', false]],
    z: [['module.f.js', false]],
})

/**
 * Mock the actual filesystem and subprocess boundaries; no source imports are
 * implemented, so discovery cannot accidentally execute proofs in the parent.
 *
 * @param {readonly IoResult<ExitStatus>[]} outcomes
 * @param {Partial<NodeProgramOptions>} [options]
 * @param {Readonly<Record<string, readonly (readonly [string, boolean])[]>>} [directories]
 * @param {boolean} [spawnFails]
 * @param {boolean} [writeFails]
 * @param {string | null} [reporter]
 */
const execute = (outcomes, options = {}, directories = tree, spawnFails = false, writeFails = false, reporter = reporterUrl) => {
    /** @typedef {{ readonly commands: readonly (readonly [string, readonly string[], string | undefined])[], readonly output: readonly (readonly [string, string])[] }} State */
    /** @type {RunInstance<NodeOp, State>} */
    let run
    /** @type {PartialMemOperationMap<NodeOp, State>} */
    const operations = {
        resolveFileModule: (name, parent) => state => {
            assertEq(parent, null)
            assertEq(name, normalize(join(options.packageRoot ?? '/package root', 'fjs/emergent_testing/cov/reporter.mjs')))
            return [state, reporter === null ? error(ioError({ message: 'reporter unavailable' })) : ok({ id: reporter, path: name })]
        },
        readdir: path => state => {
            const entries = directories[normalize(path) === '' ? '.' : normalize(path)]
            return [state, entries === undefined ? error(ioError({ message: 'directory unavailable' })) : ok(
                entries.map(([name, isDirectory]) => ({ name, parentPath: path, isDirectory, isFile: !isDirectory })))]
        },
        all: (...effects) => state => {
            const [next, results] = effects.reduce(([state, results], effect) => {
                const [next, result] = run(state)(effect)
                return [next, [...results, result]]
            }, /** @type {readonly [State, readonly Result<unknown, unknown>[]]} */ ([state, []]))
            return [next, ok(results)]
        },
        spawn: (command, args, options) => state => {
            assertEq(options.stdio, 'inherit')
            /** @type {Child} */
            const child = asNominal('child')
            return [{ ...state, commands: [...state.commands, [command, args, options.cwd]] },
                spawnFails ? error(ioError({ message: 'spawn unavailable' })) : ok(child)]
        },
        childWait: () => state => [state, assertNotNullish(outcomes[state.commands.length - 1])],
        write: (stream, bytes) => state => [
            { ...state, output: [...state.output, [stream, utf8ToString(bytes)]] },
            writeFails ? error(['notImplemented', 'write']) : ok(undefined),
        ],
    }
    run = partialRun(nodeCommands)(operations)
    return run({ commands: [], output: [] })(main({
        ...defaultNodeProgramOptions, args: ['node'], packageRoot: '/package root', ...options,
    }))
}

/** @type {(path: string) => _CoverageFile} */
const full = path => ({
    path, totalLineCount: 2, coveredLineCount: 2,
    totalBranchCount: 1, coveredBranchCount: 1,
    totalFunctionCount: 1, coveredFunctionCount: 1,
})

export const proof = /** @type {const} */ ({
    targets: () => {
        for (const path of ['module.f.mjs', './a/module.f.js', '/b/demo.f.mjs']) assert(isCoverageTarget(path))
        for (const path of ['proof.f.mjs', 'module.mjs', 'example.f.mjs', 'demo.f.js']) assert(!isCoverageTarget(path))
    },
    grouping: () => {
        assertStructurallySame(_modules(['./z/module.f.js', './a/module.f.mjs', './a/demo.f.mjs']), [
            { directory: 'a', files: ['demo.f.mjs', 'module.f.mjs'] },
            { directory: 'z', files: ['module.f.js'] },
        ])
        assertStructurallySame(_modules([]), [])
    },
    nativeCommand: () => {
        const args = _nodeArgs('/package root', ['demo.f.mjs', 'module.f.js'], reporterUrl)
        assertStructurallySame(args, [
            '--test', '--experimental-test-coverage',
            '--test-coverage-include=demo.f.mjs', '--test-coverage-include=module.f.js',
            '--test-coverage-lines=100', '--test-coverage-branches=100', '--test-coverage-functions=100',
            '--test-reporter=file:///package%20root/fjs/emergent_testing/cov/reporter.mjs',
            '/package root/fjs/emergent_testing/one.mjs',
        ])
        assertEq(_commandLine("a'b $x", ['--test', "a'b"]),
            "cwd: 'a'\\''b $x'\ncommand: 'node' '--test' 'a'\\''b'")
    },
    windowsReporter: () => {
        const reporter = /** @type {const} */ ('file:///D:/a/package%20root/%23%25/fjs/emergent_testing/cov/reporter.mjs')
        const [state, result] = execute([passed, passed], { packageRoot: 'D:/a/package root/#%' }, tree, false, false, reporter)
        assertEq(exitCode(result), 0)
        assert(state.commands.every(([, args]) => args.includes(`--test-reporter=${reporter}`)))
        assertEq(state.commands[0]?.[1].at(-1), 'D:/a/package root/#%/fjs/emergent_testing/one.mjs')
    },
    sequential: () => {
        const [state, result] = execute([passed, passed])
        assertEq(exitCode(result), 0)
        assertStructurallySame(state.commands, [
            ['node', _nodeArgs('/package root', ['demo.f.mjs', 'module.f.mjs'], reporterUrl), 'a'],
            ['node', _nodeArgs('/package root', ['module.f.js'], reporterUrl), 'z'],
        ])
        const output = state.output.map(([, text]) => text).join('')
        assert(output.indexOf('cwd:') < output.indexOf('PASS a'))
        assert(output.includes('Coverage: 2 passed, 0 failed, 2 total'))
    },
    subtree: () => {
        const [state, result] = execute([passed], { env: { INIT_CWD: 'a' } })
        assertEq(exitCode(result), 0)
        assertEq(state.commands.length, 1)
        assertEq(state.commands[0]?.[2], 'a')
    },
    failuresContinue: () => {
        for (const outcome of [failed, signaled, unavailable]) {
            const [state, result] = execute([outcome, passed])
            assertEq(exitCode(result), 1)
            assertEq(state.commands.length, 2)
            assert(state.output.some(([stream, text]) => stream === 'stderr' && text.includes('FAIL a:')))
            assert(state.output.some(([, text]) => text.includes('PASS z')))
        }
        const [state, result] = execute([], {}, tree, true)
        assertEq(exitCode(result), 1)
        assertEq(state.commands.length, 2)
    },
    refused: () => {
        for (const args of [[], ['bun'], ['node', '--quiet']]) {
            const [state, result] = execute([], { args })
            assertEq(exitCode(result), 1)
            assertEq(state.commands.length, 0)
        }
        for (const directories of [{ '.': [] }, {}]) {
            const [state, result] = execute([], {}, directories)
            assertEq(exitCode(result), 1)
            assertEq(state.commands.length, 0)
        }
        const [, result] = execute([passed], {}, tree, false, true)
        assertEq(exitCode(result), 1)
        const [state, unavailableReporter] = execute([], {}, tree, false, false, null)
        assertEq(exitCode(unavailableReporter), 1)
        assertEq(state.commands.length, 0)
    },
    coverage: () => {
        assertStructurallySame(_coverageFailures(['/a/module.f.mjs'], [full('/a/module.f.mjs')]), [])
        assertStructurallySame(_coverageFailures(['C:/a/module.f.mjs'], [full('C:\\a\\module.f.mjs')]), [])
        assertStructurallySame(_coverageFailures(['/a/module.f.mjs'], [{
            ...full('/a/module.f.mjs'), totalBranchCount: 0, coveredBranchCount: 0,
            totalFunctionCount: 0, coveredFunctionCount: 0,
        }]), [])
        assertStructurallySame(_coverageFailures(['/a/module.f.mjs'], []), ['Missing coverage: /a/module.f.mjs'])
        assertStructurallySame(_coverageFailures([], [full('/extra/module.f.mjs')]), ['Unexpected coverage: /extra/module.f.mjs'])
        for (const file of [
            { ...full('/a/module.f.mjs'), coveredLineCount: 1 },
            { ...full('/a/module.f.mjs'), coveredBranchCount: 0 },
            { ...full('/a/module.f.mjs'), coveredFunctionCount: 0 },
            { ...full('/a/module.f.mjs'), totalLineCount: NaN },
            { ...full('/a/module.f.mjs'), totalLineCount: -1 },
            { ...full('/a/module.f.mjs'), coveredLineCount: 0.5 },
        ]) {
            assertStructurallySame(_coverageFailures(['/a/module.f.mjs'], [file]), ['Incomplete coverage: /a/module.f.mjs'])
        }
    },
})
