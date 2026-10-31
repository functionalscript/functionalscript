/**
 * Runs each module directory's own proofs under native Node coverage.
 * Commands are printed before launch and children run sequentially without
 * a shell, so their coverage and working directories remain independent.
 *
 * @module
 *
 * @import { Effect, IoChannel } from '../../effects/types.ts'
 * @import { NodeOp, NodeProgram, Write, Subprocess } from '../../effects/node/types.ts'
 * @import { _CoverageFile, _Module } from './types.ts'
 */

import { allFiles, sourceRoot } from '../../dev/module.f.mjs'
import { foldStep, mapStep, pureError, pureOk, refuse, resultStep, step } from '../../effects/module.f.mjs'
import { childWait, error, errorExit, errorMessage, log, spawn } from '../../effects/node/module.f.mjs'
import { basename, join, normalize, parent } from '../../path/module.f.mjs'
import { cmp } from '../../types/string/module.f.mjs'

/** The existing measured source set, independently of proof discovery. @type {(path: string) => boolean} */
export const isCoverageTarget = path =>
    ['module.f.mjs', 'module.f.js', 'demo.f.mjs'].includes(basename(path))

/** Group discovered source files into deterministic directory jobs. @type {(files: readonly string[]) => readonly _Module[]} */
export const _modules = files =>
    [...new Set(files.map(parent))].toSorted((a, b) => cmp(a)(b)).map(directory => ({
        directory,
        files: files.filter(file => parent(file) === directory).map(basename).toSorted((a, b) => cmp(a)(b)),
    }))

/** Native includes are relative to the child cwd and match its direct files only. @type {(packageRoot: string, files: readonly string[]) => readonly string[]} */
export const _nodeArgs = (packageRoot, files) => [
    '--test',
    '--experimental-test-coverage',
    ...files.map(file => `--test-coverage-include=${file}`),
    '--test-coverage-lines=100',
    '--test-coverage-branches=100',
    '--test-coverage-functions=100',
    `--test-reporter=${normalize(join(packageRoot, 'fjs/emergent_testing/cov/reporter.mjs'))}`,
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

/** Finish one child while allowing independent directories to continue after failure. @type {(packageRoot: string, module: _Module) => Effect<Subprocess | Write, boolean, IoChannel>} */
const runModule = (packageRoot, { directory, files }) => {
    const args = _nodeArgs(packageRoot, files)
    const started = step(log(_commandLine(directory, args)), () =>
        spawn('node', args, { stdio: 'inherit', cwd: directory }))
    return resultStep(step(started, childWait), result => {
        const passed = result[0] === 'ok' && result[1][0] === 'exited' && result[1][1] === 0
        const detail = result[0] === 'error' ? errorMessage(result[1]) : `${result[1][0]} ${result[1][1]}`
        const reported = passed ? log(`PASS ${directory}`) : error(`FAIL ${directory}: ${detail}`)
        return mapStep(reported, () => passed)
    })
}

/** Run the selected subtree under Node. No output or scheduling flags yet. @type {NodeProgram} */
export const main = ({ args, env, packageRoot }) => {
    if (args.length !== 1 || args[0] !== 'node') { return errorExit('Usage: fjs cov node') }
    const modules = mapStep(allFiles(sourceRoot(env), isCoverageTarget), _modules)
    /** @type {Effect<NodeOp, number, IoChannel>} */
    const checked = step(modules, modules => {
        if (modules.length === 0) { return refuse('ERR_NO_COVERAGE_TARGETS')('No coverage targets found') }
        const failed = foldStep(pureOk(modules), 0, module => failed =>
            mapStep(runModule(packageRoot, module), passed => failed + (passed ? 0 : 1)))
        return step(failed, failed => mapStep(
            log(`Coverage: ${modules.length - failed} passed, ${failed} failed, ${modules.length} total`),
            () => failed))
    })
    return resultStep(checked, result => result[0] === 'error'
        ? errorExit(errorMessage(result[1]))
        : result[1] === 0 ? pureOk(0) : pureError(1))
}
