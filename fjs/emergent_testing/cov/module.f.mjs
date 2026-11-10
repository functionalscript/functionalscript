/**
 * Runs each module directory's own proofs under native Node coverage.
 * Children run quietly and sequentially without a shell. Progress uses the
 * emergent-testing reporter, with each directory's measured files as its name.
 *
 * @module
 *
 * @import { Catch, Sandbox } from '../../effects/common/types.ts'
 * @import { Effect, IoChannel } from '../../effects/types.ts'
 * @import { NodeProgram, Write, Subprocess, Now, NodeProgramOptions } from '../../effects/node/types.ts'
 * @import { _CoverageFile, _Module } from './types.ts'
 */

import { allFiles, sourceRoot } from '../../dev/module.f.mjs'
import { foldStep, history, historyStep, mapStep, pureError, pureOk, refuse, resultMapStep, resultStep, step } from '../../effects/module.f.mjs'
import { childWait, now, errorExit, errorMessage, log, resolveFileModule, spawn } from '../../effects/node/module.f.mjs'
import { basename, join, normalize, parent } from '../../path/module.f.js'
import { ok } from '../../types/result/module.f.js'
import { cmp } from '../../types/string/module.f.js'
import { defaultReporter } from '../module.f.mjs'

/** The existing measured source set, independently of proof discovery. @type {(path: string) => boolean} */
export const isCoverageTarget = path =>
    ['module.f.mjs', 'module.f.js', 'demo.f.mjs'].includes(basename(path))

/** Group discovered source files into deterministic directory jobs. @type {(files: readonly string[]) => readonly _Module[]} */
export const _modules = files =>
    [...new Set(files.map(parent))].toSorted((a, b) => cmp(a)(b)).map(directory => ({
        directory,
        files: files.filter(file => parent(file) === directory).map(basename).toSorted((a, b) => cmp(a)(b)),
    }))

/** Native includes are relative to the child cwd; the host supplies the reporter's file URL. @type {(packageRoot: string, files: readonly string[], reporter: string) => readonly string[]} */
export const _nodeArgs = (packageRoot, files, reporter) => [
    '--test',
    '--experimental-test-coverage',
    ...files.map(file => `--test-coverage-include=${file}`),
    '--test-coverage-lines=100',
    '--test-coverage-branches=100',
    '--test-coverage-functions=100',
    `--test-reporter=${reporter}`,
    normalize(join(packageRoot, 'fjs/emergent_testing/one.mjs')),
]

/** Quote display text as a literal shell word; execution still uses argv. @type {(value: string) => string} */
const quote = value => `'${value.replaceAll("'", "'\\''")}'`

/** The cwd and complete invocation, printed before starting its child. @type {(directory: string, args: readonly string[]) => string} */
export const _commandLine = (directory, args) =>
    `cwd: ${quote(directory)}\ncommand: ${['node', ...args].map(quote).join(' ')}`

/** A missing, invalid or rounded-away uncovered count cannot pass. @type {(covered: number, total: number) => boolean} */
const complete = (covered, total) =>
    Number.isInteger(total) && total >= 0 && Number.isInteger(covered) && covered === total

/** Validate the exact target set using raw native counts, before reporter filtering. @type {(expected: readonly string[], files: readonly _CoverageFile[]) => readonly string[]} */
export const _coverageFailures = (expected, files) => [
    ...expected.flatMap(path => {
        const file = files.find(file => normalize(file.path) === normalize(path))
        if (file === undefined) { return [`Missing coverage: ${path}`] }
        return complete(file.coveredLineCount, file.totalLineCount)
            && complete(file.coveredBranchCount, file.totalBranchCount)
            && complete(file.coveredFunctionCount, file.totalFunctionCount)
            ? [] : [`Incomplete coverage: ${path}`]
    }),
    ...files.filter(file => !expected.some(path => normalize(path) === normalize(file.path)))
        .map(file => `Unexpected coverage: ${file.path}`),
]

/** Finish one child while allowing independent directories to continue after failure.
 * @type {(options: NodeProgramOptions, command: { readonly directory: string, readonly files: readonly string[], readonly args: readonly string[] }) => Effect<Subprocess | Write | Now | Sandbox | Catch, boolean, IoChannel>}
 */
const runModule = (options, { directory, files, args }) => {
    const reporter = defaultReporter(options)
    const id = { module: directory, path: '', name: files.map(file => normalize(join(directory, file))).join(', ') }
    const announced = reporter.start(id)
    const timed = step(announced, () => now())
    const outcome = historyStep(history(timed), () => {
        const ended = step(spawn('node', args, { stdio: 'ignore', cwd: directory }), childWait)
        return resultMapStep(ended, ([tag, value]) => {
            if (tag === 'error') { return ok({ passed: false, detail: errorMessage(value) }) }
            const [status, code] = value
            return ok({ passed: status === 'exited' && code === 0, detail: `${status} ${code}` })
        })
    })
    return step(outcome, ([{ passed, detail }, start]) => step(now(), end => {
        const duration = end - start
        const reported = reporter.result({ ...id, duration, status: passed ? 'passed' : 'failed' },
            { duration, result: ok(undefined) }, false)
        return mapStep(step(reported, () => passed ? pureOk(undefined)
            : log(`${_commandLine(directory, args)}\n${detail}`)), () => passed)
    }))
}

/** Run the selected subtree under Node. No output or scheduling flags yet. @type {NodeProgram} */
export const main = options => {
    const { args, env, packageRoot } = options
    if (args.length !== 1 || args[0] !== 'node') { return errorExit('Usage: fjs cov node') }
    const discovered = allFiles(sourceRoot(env), isCoverageTarget)
    const grouped = mapStep(discovered, _modules)
    const modules = step(grouped, modules => modules.length === 0
        ? refuse('ERR_NO_COVERAGE_TARGETS')('No coverage targets found')
        : pureOk(modules))
    const reporter = historyStep(history(modules), () =>
        resolveFileModule(normalize(join(packageRoot, 'fjs/emergent_testing/cov/reporter.mjs')), null))
    const commands = mapStep(reporter, ([{ id }, modules]) => modules.map(({ directory, files }) => ({
        directory, files, args: _nodeArgs(packageRoot, files, id),
    })))
    const results = foldStep(commands, { failed: 0, total: 0 }, command => ({ failed, total }) => {
        const checked = runModule(options, command)
        return mapStep(checked, passed => ({ failed: failed + (passed ? 0 : 1), total: total + 1 }))
    })
    const reported = historyStep(history(results), ({ failed, total }) =>
        log(`Coverage: ${total - failed} passed, ${failed} failed, ${total} total`))
    return resultStep(reported, ([tag, value]) => {
        if (tag === 'error') { return errorExit(errorMessage(value)) }
        const [, { failed }] = value
        return failed === 0 ? pureOk(0) : pureError(1)
    })
}
