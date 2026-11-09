/**
 * Runs each module directory's own proofs under native Node coverage.
 * Children run sequentially without a shell and inherit stdout and stderr.
 * Each target's result follows its child's live output. Successful manifests are saved
 * and synchronized together after the selected directories finish.
 *
 * @module
 *
 * @import { Effect, IoChannel } from '../../effects/types.ts'
 * @import { NodeOp, NodeProgram, NodeProgramOptions, Write, Subprocess } from '../../effects/node/types.ts'
 * @import { _CoverageFile, _Module } from './types.ts'
 * @import { CoverageCache, Command, Outcome } from './cached/types.ts'
 * @import { Unknown } from '../../media/json/types.ts'
 */

import { allFiles, sourceRoot } from '../../dev/module.f.mjs'
import { catchStep, foldStep, forEachStep, history, historyStep, mapStep, pureError, pureOk, refuse, resultMapStep, resultStep, step } from '../../effects/module.f.mjs'
import { childWait, error, errorExit, errorMessage, log, resolveFileModule, spawn } from '../../effects/node/module.f.mjs'
import { basename, join, normalize, parent, under } from '../../path/module.f.js'
import { ok } from '../../types/result/module.f.js'
import { cmp } from '../../types/string/module.f.js'
import { shellQuote } from '../../text/shell/module.f.js'
import { runCached } from './cached/module.f.mjs'
import { openCoverageCache } from './context/module.f.mjs'

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

/** The cwd and complete invocation, shown on failure as shell words; execution still uses argv. @type {(directory: string, args: readonly string[]) => string} */
export const _commandLine = (directory, args) =>
    `cwd: ${shellQuote(directory)}\ncommand: ${['node', ...args].map(shellQuote).join(' ')}`

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

/** Display target paths relative to the tested repository when known. @type {(command: _Module, root: string) => readonly string[]} */
export const _modulePaths = ({ directory, files }, root) => {
    const base = normalize(root)
    const prefix = base.endsWith('/') ? base : `${base}/`
    const path = normalize(directory)
    const relative = path === base ? '' : path.startsWith(prefix) ? path.slice(prefix.length) : path
    return files.map(file => under(relative, file))
}

/** Run one child with live output while allowing independent directories to continue after failure. @type {(command: Command, root: string) => Effect<Subprocess | Write, boolean, IoChannel>} */
const runModule = (command, root) => {
    const { directory, args } = command
    const started = spawn('node', args, { stdio: 'inherit', cwd: directory })
    const ended = step(started, childWait)
    const outcome = resultMapStep(ended, ([tag, value]) => {
        if (tag === 'error') { return ok({ passed: false, detail: errorMessage(value) }) }
        const [status, code] = value
        return ok({ passed: status === 'exited' && code === 0, detail: `${status} ${code}` })
    })
    const targets = historyStep(history(outcome), ({ passed }) =>
        forEachStep(pureOk(_modulePaths(command, root)), name => log(`${name}...${passed ? 'Ok' : 'Failed'}`)))
    const diagnostics = historyStep(targets, (_, { passed, detail }) => passed
        ? pureOk(undefined) : error(`${_commandLine(directory, args)}\n${detail}`))
    return mapStep(diagnostics, ([, , { passed }]) => passed)
}

/** A failed cache operation cannot hide the coverage result. @type {(cache: CoverageCache | null, manifests: readonly Unknown[]) => Effect<NodeOp, void, IoChannel>} */
export const _saveBatch = (cache, manifests) => {
    if (cache === null) { return pureOk(undefined) }
    const saved = catchStep(cache.saveMany(manifests), problem => error(`CACHE: saving manifests: ${errorMessage(problem)}`))
    return step(saved, () => catchStep(cache.sync(), problem => error(`CACHE: synchronizing manifests: ${errorMessage(problem)}`)))
}

/** Cached targets need no native child or test log. @type {(command: _Module, root: string, outcome: Outcome) => Effect<Write, void, IoChannel>} */
export const _showCached = (command, root, outcome) => outcome === 'cached'
    ? forEachStep(pureOk(_modulePaths(command, root)), name => log(`${name}...Cached`)) : pureOk(undefined)

/** A cache failure costs coverage work, never a skipped check. @type {(options: NodeProgramOptions, synchronize: boolean) => Effect<NodeOp, CoverageCache | null, IoChannel>} */
const coverageCache = (options, synchronize) => resultStep(openCoverageCache(options, synchronize),
    /** @returns {Effect<NodeOp, CoverageCache | null, IoChannel>} */
    ([tag, value]) => tag === 'ok' ? pureOk(value)
        : mapStep(error(`UNCACHED: ${errorMessage(value)}`), () => null))

/** Successful cached checks still contribute to the total passed count. @type {Record<Outcome, { readonly failed: number, readonly cached: number }>} */
const increments = { passed: { failed: 0, cached: 0 }, failed: { failed: 1, cached: 0 }, cached: { failed: 0, cached: 1 } }

/** Run the selected subtree; --sync publishes its successful manifests at end. @type {NodeProgram} */
export const main = options => {
    const { args, env, packageRoot } = options
    if (args[0] !== 'node' || args.length > 2 || args.length === 2 && args[1] !== '--sync') {
        return errorExit('Usage: fjs cov node [--sync]')
    }
    const discovered = allFiles(sourceRoot(env), isCoverageTarget)
    const grouped = mapStep(discovered, _modules)
    const modules = step(grouped, modules => modules.length === 0
        ? refuse('ERR_NO_COVERAGE_TARGETS')('No coverage targets found')
        : pureOk(modules))
    const reporter = historyStep(history(modules), () =>
        resolveFileModule(normalize(join(packageRoot, 'fjs/emergent_testing/cov/reporter.mjs')), null))
    const commands = step(reporter, ([{ id }, modules]) => foldStep(pureOk(modules), /** @type {readonly Command[]} */ ([]), ({ directory, files }) => commands =>
        mapStep(resolveFileModule(directory, null), ({ path }) => [...commands, {
            directory: path, files, args: _nodeArgs(packageRoot, files, id),
        }])))
    const context = historyStep(history(commands), () => coverageCache(options, args.length === 2))
    const results = step(context, ([cache, commands]) => {
        const root = cache?.root ?? packageRoot
        const completed = foldStep(pureOk(commands), { failed: 0, cached: 0, total: 0, manifests: /** @type {readonly Unknown[]} */ ([]) }, command => totals => {
            const checked = runCached(command, () => runModule(command, root), cache)
            const shown = historyStep(history(checked), ({ outcome }) => _showCached(command, root, outcome))
            return mapStep(shown, ([, { outcome, manifests }]) => {
                const change = increments[outcome]
                return { failed: totals.failed + change.failed, cached: totals.cached + change.cached, total: totals.total + 1, manifests: [...totals.manifests, ...manifests] }
            })
        })
        const saved = historyStep(history(completed), ({ manifests }) => _saveBatch(cache, manifests))
        return mapStep(saved, ([, totals]) => totals)
    })
    const reported = historyStep(history(results), ({ failed, cached, total }) =>
        log(`Coverage: ${total - failed} passed, ${failed} failed, ${total} total (${cached} cached)`))
    return resultStep(reported, ([tag, value]) => {
        if (tag === 'error') { return errorExit(errorMessage(value)) }
        const [, { failed }] = value
        return failed === 0 ? pureOk(0) : pureError(1)
    })
}
