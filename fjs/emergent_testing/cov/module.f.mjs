/**
 * Runs each module directory's own proofs under native Node coverage.
 * Children run quietly and sequentially without a shell. Progress uses the
 * emergent-testing reporter, with each directory's measured files as its name.
 * The complete plan is prepared before any child runs. Stable successful entries
 * are committed and synchronized after executing the plan.
 *
 * @module
 *
 * @import { Effect, IoChannel } from '../../effects/types.ts'
 * @import { NodeOp, NodeProgram, NodeProgramOptions, Write } from '../../effects/node/types.ts'
 * @import { _Module } from './types.ts'
 * @import { CoverageCache, Command, Outcome, Planned } from './plan/types.ts'
 * @import { Entry } from './cache/types.ts'
 */

import { allFiles, sourceRoot } from '../../dev/module.f.mjs'
import { catchStep, foldStep, forEachStep, history, historyStep, mapStep, pureError, pureOk, refuse, resultMapStep, resultStep, step } from '../../effects/module.f.mjs'
import { childWait, now, error, errorExit, errorMessage, log, resolveFileModule, spawn } from '../../effects/node/module.f.mjs'
import { basename, join, normalize, parent, under } from '../../path/module.f.js'
import { ok } from '../../types/result/module.f.js'
import { cmp } from '../../types/string/module.f.js'
import { shellQuote } from '../../text/shell/module.f.js'
import { defaultReporter } from '../module.f.mjs'
import { createPlan, runPlanned } from './plan/module.f.mjs'
import { openCoverageCache } from './context/module.f.mjs'
import { isCoverageTarget as coverageTarget, _coverageFailures as coverageFailures } from './check/module.f.mjs'

/** Target selection shared with the lightweight native reporter. */
export const isCoverageTarget = coverageTarget
/** Exact-count admission shared with the lightweight native reporter. */
export const _coverageFailures = coverageFailures

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

/** Display target paths relative to the tested repository when known. @type {(command: _Module, root: string) => readonly string[]} */
export const _modulePaths = ({ directory, files }, root) => {
    const base = normalize(root)
    const prefix = base.endsWith('/') ? base : `${base}/`
    const path = normalize(directory)
    const relative = path === base ? '' : path.startsWith(prefix) ? path.slice(prefix.length) : path
    return files.map(file => under(relative, file))
}

/** Run one quiet child with shared test progress; independent directories continue after failure.
 * @type {(options: NodeProgramOptions, command: Command, root: string) => Effect<NodeOp, boolean, IoChannel>}
 */
const runModule = (options, command, root) => {
    const { directory, args } = command
    const reporter = defaultReporter(options)
    const id = /** @type {const} */ ({ module: directory, path: '', name: _modulePaths(command, root).join(', ') })
    const announced = reporter.start(id)
    const timed = step(announced, () => now())
    const started = spawn('node', args, { stdio: 'ignore', cwd: directory })
    const ended = step(started, childWait)
    const checked = resultMapStep(ended, ([tag, value]) => {
        if (tag === 'error') { return ok({ passed: false, detail: errorMessage(value) }) }
        const [status, code] = value
        return ok({ passed: status === 'exited' && code === 0, detail: `${status} ${code}` })
    })
    const outcome = historyStep(history(timed), () => checked)
    const stopped = historyStep(outcome, () => now())
    const measured = mapStep(stopped, ([end, result, start]) => ({ ...result, duration: end - start }))
    const reported = historyStep(history(measured), ({ passed, duration }) =>
        reporter.result({ ...id, duration, status: passed ? 'passed' : 'failed' },
            { duration, result: ok(undefined) }, false))
    const diagnostics = historyStep(reported, (_, { passed, detail }) => passed
        ? pureOk(undefined) : log(`${_commandLine(directory, args)}\n${detail}`))
    return mapStep(diagnostics, ([, , { passed }]) => passed)
}

/** Commit and publish once after execution; cache errors cannot hide coverage results. @type {(cache: CoverageCache | null, entries: readonly Entry[]) => Effect<NodeOp, void, IoChannel>} */
export const _saveBatch = (cache, entries) => {
    if (cache === null) { return pureOk(undefined) }
    const saved = catchStep(cache.saveMany(entries), problem => error(`CACHE: saving manifests: ${errorMessage(problem)}`))
    return step(saved, () => catchStep(cache.sync(), problem => error(`CACHE: synchronizing manifests: ${errorMessage(problem)}`)))
}

/** Cached targets need no native child or test log. @type {(command: _Module, root: string, outcome: Outcome) => Effect<Write, void, IoChannel>} */
export const _showCached = (command, root, outcome) => outcome === 'cached'
    ? forEachStep(pureOk(_modulePaths(command, root)), name => log(`${name}...Cached`)) : pureOk(undefined)

/** Prepare shared inputs once; a cache failure costs coverage work, never a skipped check. @type {(options: NodeProgramOptions, synchronize: boolean, commands: readonly Command[]) => Effect<NodeOp, CoverageCache | null, IoChannel>} */
const coverageCache = (options, synchronize, commands) => resultStep(openCoverageCache(options, synchronize, commands),
    /** @returns {Effect<NodeOp, CoverageCache | null, IoChannel>} */
    ([tag, value]) => tag === 'ok' ? pureOk(value)
        : mapStep(error(`UNCACHED: ${errorMessage(value)}`), () => null))

/** Successful cached checks still contribute to the total passed count. @type {Record<Outcome, { readonly failed: number, readonly cached: number }>} */
const increments = { passed: { failed: 0, cached: 0 }, failed: { failed: 1, cached: 0 }, cached: { failed: 0, cached: 1 } }

/** Execute only the prepared misses and retain stable successes for one commit.
 * @type {(options: NodeProgramOptions, plan: readonly Planned[], root: string, cache: CoverageCache | null) => Effect<NodeOp, { readonly failed: number, readonly cached: number, readonly total: number, readonly entries: readonly Entry[] }, IoChannel>}
 */
const runPlan = (options, plan, root, cache) => foldStep(pureOk(plan), {
    failed: 0, cached: 0, total: 0, entries: /** @type {readonly Entry[]} */ ([]),
}, item => totals => {
    const checked = runPlanned(item, () => runModule(options, item.command, root), cache)
    const shown = historyStep(history(checked), ({ outcome }) => _showCached(item.command, root, outcome))
    return mapStep(shown, ([, { outcome, entries }]) => {
        const change = increments[outcome]
        return {
            failed: totals.failed + change.failed, cached: totals.cached + change.cached,
            total: totals.total + 1, entries: [...totals.entries, ...entries],
        }
    })
})

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
    const context = historyStep(history(commands), commands => coverageCache(options, args.length === 2, commands))
    const planned = historyStep(context, (cache, commands) => createPlan(commands, cache))
    const executed = historyStep(planned, (plan, cache) => runPlan(options, plan, cache?.root ?? packageRoot, cache))
    const committed = historyStep(executed, (results, _plan, cache) => _saveBatch(cache, results.entries))
    const results = mapStep(committed, ([, totals]) => totals)
    const reported = historyStep(history(results), ({ failed, cached, total }) =>
        log(`Coverage: ${total - failed} passed, ${failed} failed, ${total} total (${cached} cached)`))
    return resultStep(reported, ([tag, value]) => {
        if (tag === 'error') { return errorExit(errorMessage(value)) }
        const [, { failed }] = value
        return failed === 0 ? pureOk(0) : pureError(1)
    })
}
