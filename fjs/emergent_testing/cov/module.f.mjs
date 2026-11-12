/**
 * Runs each module directory's own proofs under native Node coverage.
 * Children run quietly in CPU-bounded parallel batches without a shell.
 * Progress shares emergent-testing's result formatter and prints complete
 * start and finish records for each measured file.
 * Test timing spans the first child's start through the last child's finish.
 * The complete plan is prepared before any child runs. Stable successful entries
 * are committed and synchronized after executing the plan.
 *
 * @module
 *
 * @import { Effect, IoChannel } from '../../effects/types.ts'
 * @import { NodeOp, NodeProgram, NodeProgramOptions } from '../../effects/node/types.ts'
 * @import { _Module } from './types.ts'
 * @import { ChildResult, CoverageCache, Command, Outcome, Planned, RunResult } from './plan/types.ts'
 * @import { Entry } from './cache/types.ts'
 */

import { allFiles, sourceRoot } from '../../dev/module.f.mjs'
import { catchStep, foldStep, forEachStep, history, historyStep, mapStep, pureError, pureOk, refuse, resultMapStep, resultStep, step } from '../../effects/module.f.mjs'
import { allOk, availableParallelism, capture, now, error, errorExit, errorMessage, log, resolveFileModule } from '../../effects/node/module.f.mjs'
import { basename, join, normalize, parent, under } from '../../path/module.f.js'
import { ok } from '../../types/result/module.f.js'
import { cmp } from '../../types/string/module.f.js'
import { shellQuote } from '../../text/shell/module.f.js'
import { fmtResult, formatDuration } from '../module.f.mjs'
import { csiWrite } from '../../text/sgr/module.f.mjs'
import { createPlan, runPlanned } from './plan/module.f.mjs'
import { openCoverageCache } from './context/module.f.mjs'
import { isCoverageTarget as coverageTarget, _coverageFailures as coverageFailures } from './check/module.f.js'

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
 * @type {(options: NodeProgramOptions, command: Command, root: string) => Effect<NodeOp, ChildResult, IoChannel>}
 */
const runModule = (options, command, root) => {
    const { directory, args } = command
    const paths = _modulePaths(command, root)
    const out = csiWrite(options.std)('stdout')
    const announced = forEachStep(pureOk(paths), name => log(`${name}: running`))
    const timed = step(announced, () => now())
    const captured = capture('node', args, { cwd: directory })
    const checked = resultMapStep(captured, ([tag, value]) => {
        if (tag === 'error') { return ok({ passed: false, detail: errorMessage(value), stdout: '', stderr: '' }) }
        const { status: [status, code], stdout, stderr } = value
        return ok({ passed: status === 'exited' && code === 0, detail: `${status} ${code}`, stdout, stderr })
    })
    const outcome = historyStep(history(timed), () => checked)
    const stopped = historyStep(outcome, () => now())
    const measured = mapStep(stopped, ([end, result, start]) => ({ ...result, start, duration: end - start }))
    // One write keeps a completed job's result and failure logs together.
    const reported = historyStep(history(measured), ({ passed, duration, detail, stdout, stderr }) => {
        const lines = paths.map(name => fmtResult({ module: directory, path: '', name, duration,
            status: passed ? 'passed' : 'failed' }, false))
        const diagnostics = passed ? [] : [_commandLine(directory, args), detail, stdout, stderr].filter(text => text !== '')
        return out([...lines, ...diagnostics].join('\n') + '\n')
    })
    return mapStep(reported, ([, { passed, start, duration }]) => ({ passed, start, duration }))
}

/** Commit and publish once after execution; cache errors cannot hide coverage results. @type {(cache: CoverageCache | null, entries: readonly Entry[]) => Effect<NodeOp, void, IoChannel>} */
export const _saveBatch = (cache, entries) => {
    if (cache === null) { return pureOk(undefined) }
    const saved = catchStep(cache.saveMany(entries), problem => error(`CACHE: saving manifests: ${errorMessage(problem)}`))
    return step(saved, () => catchStep(cache.sync(), problem => error(`CACHE: synchronizing manifests: ${errorMessage(problem)}`)))
}

/** Prepare shared inputs once; a cache failure costs coverage work, never a skipped check. @type {(options: NodeProgramOptions, synchronize: boolean, commands: readonly Command[]) => Effect<NodeOp, CoverageCache | null, IoChannel>} */
const coverageCache = (options, synchronize, commands) => resultStep(openCoverageCache(options, synchronize, commands),
    /** @returns {Effect<NodeOp, CoverageCache | null, IoChannel>} */
    ([tag, value]) => tag === 'ok' ? pureOk(value)
        : mapStep(error(`UNCACHED: ${errorMessage(value)}`), () => null))

/** Successful cached checks still contribute to the total passed count. @type {Record<Outcome, { readonly failed: number, readonly cached: number }>} */
const increments = { passed: { failed: 0, cached: 0 }, failed: { failed: 1, cached: 0 }, cached: { failed: 0, cached: 1 } }

/** Match the shared terminal reporter's duration precision and units. */
const durationText = formatDuration(4)

/** Execute CPU-bounded batches and retain stable successes for one commit.
 * @type {(options: NodeProgramOptions, plan: readonly Planned[], root: string, cache: CoverageCache | null, concurrency: number) => Effect<NodeOp, { readonly failed: number, readonly cached: number, readonly total: number, readonly duration: number, readonly realTime: number, readonly entries: readonly Entry[] }, IoChannel>}
 */
export const _runPlan = (options, plan, root, cache, concurrency) => {
    const batches = Array.from({ length: Math.ceil(plan.length / concurrency) }, (_, index) =>
        plan.slice(index * concurrency, (index + 1) * concurrency))
    const completed = foldStep(pureOk(batches), /** @type {readonly RunResult[]} */ ([]), batch => previous => {
        const work = batch.map(item => runPlanned(item, () => runModule(options, item.command, root), cache))
        const concurrent = allOk(...work)
        return mapStep(concurrent, results => [...previous, ...results])
    })
    return mapStep(completed, results => {
        const totals = results.reduce((totals, { outcome, duration, entries }) => {
            const change = increments[outcome]
            return {
                failed: totals.failed + change.failed, cached: totals.cached + change.cached,
                total: totals.total + 1, duration: totals.duration + duration, entries: [...totals.entries, ...entries],
            }
        }, { failed: 0, cached: 0, total: 0, duration: 0, entries: /** @type {readonly Entry[]} */ ([]) })
        const runs = results.flatMap(({ start, duration }) => start === null ? [] : [{ start, end: start + duration }])
        const realTime = runs.length === 0 ? 0
            : Math.max(...runs.map(run => run.end)) - Math.min(...runs.map(run => run.start))
        return { ...totals, realTime }
    })
}

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
    const capacity = historyStep(planned, () => availableParallelism())
    const executed = historyStep(capacity, (concurrency, plan, cache) => _runPlan(options, plan, cache?.root ?? packageRoot, cache, concurrency))
    const committed = historyStep(executed, (results, _capacity, _plan, cache) => _saveBatch(cache, results.entries))
    const results = mapStep(committed, ([, totals, concurrency]) => ({
        ...totals, concurrency: Math.min(concurrency, totals.total),
    }))
    const reported = historyStep(history(results), ({ failed, cached, total, duration, realTime, concurrency }) =>
        log([
            `Coverage: ${total - failed} passed, ${failed} failed, ${total} total (${cached} cached)`,
            `Test real time: ${durationText(realTime)}`,
            `Processor time: ${durationText(duration)}`,
            `Concurrency: up to ${concurrency} child process${concurrency === 1 ? '' : 'es'}`,
        ].join('\n')))
    return resultStep(reported, ([tag, value]) => {
        if (tag === 'error') { return errorExit(errorMessage(value)) }
        const [, { failed }] = value
        return failed === 0 ? pureOk(0) : pureError(1)
    })
}
