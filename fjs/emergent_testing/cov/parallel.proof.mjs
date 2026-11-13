/**
 * Async host proof of CPU-bounded coverage batches. FunctionalScript's mock
 * interpreter may execute `all` sequentially, so deferred captures observe real
 * fan-out, batch barriers and the final publication boundary here.
 *
 * @import { CapturedProcess, NodeOp } from '../../effects/node/types.ts'
 * @import { IoResult, PartialAsyncOperationMap } from '../../effects/types.ts'
 * @import { Entry } from './cache/types.ts'
 * @import { CoverageCache, Planned } from './plan/types.ts'
 */

import { strict as assert } from 'node:assert'
import { setImmediate } from 'node:timers'

import { history, historyStep, mapStep, pureOk } from '../../effects/module.f.js'
import { asyncPartialRun } from '../../effects/module.mjs'
import { access, nodeCommands } from '../../effects/node/module.f.mjs'
import { defaultNodeProgramOptions } from '../../effects/node/virtual/module.f.mjs'
import { within } from '../../effects/node/testlib.mjs'
import { utf8ToString } from '../../text/utf8/module.f.js'
import { ok, unwrap } from '../../types/result/module.f.js'
import { _runPlan, _saveBatch } from './module.f.mjs'

/** @type {(name: string) => Entry} */
const entry = name => ({ manifest: { module: name }, key: name, path: `.cas/${name}`, payload: name, byteLength: name.length })

export const proof = /** @type {const} */ ({
    boundedBatchesDrainBeforePublication: async () => {
        /** @type {readonly string[]} */
        let started = []
        /** @type {readonly string[]} */
        let writes = []
        /** @type {readonly string[]} */
        let publication = []
        /** @type {ReadonlyMap<string, (result: IoResult<CapturedProcess>) => void>} */
        let pending = new Map()
        /** @type {ReadonlyMap<number, () => void>} */
        let reached = new Map()
        /** @type {readonly Entry[]} */
        let saved = []
        let active = 0
        let maximum = 0
        let clock = 100
        /** @type {(count: number) => Promise<void>} */
        const startedCount = count => started.length >= count ? Promise.resolve()
            : new Promise(resolve => { reached = new Map([...reached, [count, resolve]]) })
        /** @type {PartialAsyncOperationMap<NodeOp>} */
        const operations = {
            now: async () => ok(clock),
            capture: (_command, _args, options) => new Promise(resolve => {
                const directory = options?.cwd
                assert(directory)
                const name = directory.slice('/repo/'.length)
                active += 1
                maximum = Math.max(maximum, active)
                assert(active <= 2, `More than two captures active: ${started}`)
                started = [...started, name]
                /** @type {(result: IoResult<CapturedProcess>) => void} */
                const finishCapture = result => {
                    active -= 1
                    resolve(result)
                }
                pending = new Map([...pending, [name, finishCapture]])
                reached.get(started.length)?.()
            }),
            write: async (_stream, bytes) => {
                writes = [...writes, utf8ToString(bytes)]
                return ok(undefined)
            },
            access: async phase => {
                assert.equal(active, 0)
                assert.equal(started.length, 5)
                assert(writes.some(chunk => chunk.includes('e/module.f.js: ok,')), 'Publication started before the final result')
                publication = [...publication, phase]
                clock += phase === 'save' ? 7 : 11
                return ok(undefined)
            },
        }
        /** @type {CoverageCache} */
        const cache = {
            prepare: () => { throw Error('Discovery during execution') },
            lookup: () => { throw Error('Lookup during execution') },
            validate: () => pureOk(true),
            saveMany: entries => {
                saved = entries
                return access('save')
            },
            sync: () => access('sync'),
        }
        /** @type {readonly Planned[]} */
        const plan = ['a', 'b', 'c', 'd', 'e'].map(name => ({
            command: { directory: `/repo/${name}`, files: ['module.f.js'], args: ['--test'] },
            entries: [entry(name)], cached: false, admissionFailed: false,
        }))
        const executed = history(_runPlan(defaultNodeProgramOptions, plan, '/repo', cache, 2))
        const published = historyStep(executed, totals => _saveBatch(cache, totals.entries))
        const program = mapStep(published, ([, totals]) => totals)
        const run = asyncPartialRun(nodeCommands)(operations)
        const running = run(program)
        /** @type {(name: string, code?: number) => void} */
        const finish = (name, code = 0) => {
            const resolve = pending.get(name)
            assert(resolve, `Capture not started: ${name}`)
            pending = new Map([...pending].filter(([key]) => key !== name))
            resolve(ok({ status: ['exited', code], stdout: `stdout ${name}`, stderr: `stderr ${name}` }))
        }
        // A single event-loop turn drains all pending Promise continuations;
        // this does not impose an elapsed-time threshold on child execution.
        /** @type {() => Promise<void>} */
        const drain = () => new Promise(resolve => setImmediate(resolve))

        await within('first coverage batch starts concurrently', 10_000, startedCount(2))
        assert.deepEqual(started, ['a', 'b'])
        assert.equal(active, 2)
        clock = 110
        finish('a')
        await drain()
        assert.deepEqual(started, ['a', 'b'], 'The next batch started while a sibling was still active')
        assert.deepEqual(publication, [])

        clock = 120
        finish('b', 1)
        await within('second batch continues after failure', 10_000, startedCount(4))
        assert.deepEqual(started, ['a', 'b', 'c', 'd'])
        assert.equal(active, 2)
        clock = 125
        finish('d')
        await drain()
        assert.deepEqual(started, ['a', 'b', 'c', 'd'])
        assert.deepEqual(publication, [])

        clock = 135
        finish('c')
        await within('last partial batch starts', 10_000, startedCount(5))
        assert.equal(active, 1)
        assert.deepEqual(publication, [])
        clock = 145
        finish('e')
        const result = unwrap(await within('coverage publishes after all captures finish', 10_000, running))
        assert.equal(maximum, 2)
        assert.equal(result.total, 5)
        assert.equal(result.failed, 1)
        assert.equal(result.cached, 0)
        // Overlapping children consume 10 + 20 + 15 + 5 + 10 ms while
        // capture wall time is 45 ms; publication adds another 18 ms.
        assert.equal(result.duration, 60)
        assert.equal(result.realTime, 45)
        assert(result.duration > result.realTime)
        assert.equal(clock, 163)
        assert.deepEqual(saved.map(value => value.key), ['a', 'c', 'd', 'e'])
        assert.deepEqual(publication, ['save', 'sync'])
        const failure = writes.find(chunk => chunk.includes('b/module.f.js: error,'))
        assert(failure)
        assert(failure.includes('b/module.f.js: error, 20.0000 ms\n'))
        assert(failure.includes('stdout b') && failure.includes('stderr b'), 'Failure logs must share their completed result write')
        assert(!writes.some(chunk => chunk.includes('stdout a') || chunk.includes('stderr a')))
    },
})
