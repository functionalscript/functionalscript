/**
 * @import { CoverageCache, Command } from './types.ts'
 * @import { Unknown } from '../../../media/json/types.ts'
 * @import { PartialMemOperationMap, RunInstance } from '../../../effects/mock/types.ts'
 * @import { NodeOp } from '../../../effects/node/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { mapStep } from '../../../effects/module.f.mjs'
import { partialRun } from '../../../effects/mock/module.f.mjs'
import { access, ioError, nodeCommands, readdir } from '../../../effects/node/module.f.mjs'
import { parse } from '../../../media/json/module.f.mjs'
import { utf8ToString } from '../../../text/utf8/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.js'
import { runCached } from './module.f.mjs'

/** @type {Command} */
const command = { directory: '/repo/unit', files: ['module.f.js', 'demo.f.mjs'], args: ['--test'] }
const first = /** @type {const} */ ({ file: 'module.f.js', hash: 'first' })
const second = /** @type {const} */ ({ file: 'demo.f.mjs', hash: 'second' })

/**
 * The cache is a collection of effects whose requests the memory runner records.
 * Only those boundaries are mocked; runCached makes every lifecycle decision.
 *
 * @param {{
 *   readonly before?: readonly Unknown[],
 *   readonly after?: readonly Unknown[],
 *   readonly prepareErrors?: readonly number[],
 *   readonly lookupErrors?: readonly number[],
 *   readonly hits?: readonly boolean[],
 *   readonly saveErrors?: readonly number[],
 *   readonly syncErrors?: readonly number[],
 *   readonly passed?: boolean,
 *   readonly runError?: boolean,
 *   readonly disabled?: boolean,
 * }} [options]
 */
const execute = (options = {}) => {
    /** @typedef {{ readonly calls: readonly string[], readonly output: readonly (readonly [string, string])[] }} State */
    /** @type {PartialMemOperationMap<NodeOp, State>} */
    const operations = {
        readdir: path => state => {
            const next = { ...state, calls: [...state.calls, path] }
            if (path === 'prepare') {
                const call = state.calls.filter(call => call === 'prepare').length + 1
                if (options.prepareErrors?.includes(call)) { return [next, error(ioError({ message: 'preparation unavailable' }))] }
                const manifests = call === 1 ? options.before ?? [first, second] : options.after ?? options.before ?? [first, second]
                return [next, ok(manifests.map(manifest => ({ name: JSON.stringify(manifest), parentPath: '', isDirectory: false, isFile: true })))]
            }
            const call = state.calls.filter(call => call.startsWith('has ')).length + 1
            if (options.lookupErrors?.includes(call)) { return [next, error(ioError({ message: 'lookup unavailable' }))] }
            return [next, ok(options.hits?.[call - 1] ? [{ name: 'hit', parentPath: '', isDirectory: false, isFile: true }] : [])]
        },
        access: path => state => {
            const next = { ...state, calls: [...state.calls, path] }
            if (path === 'run' && options.runError) { return [next, error(ioError({ message: 'run unavailable' }))] }
            const save = state.calls.filter(call => call.startsWith('save ')).length + 1
            if (path.startsWith('save ') && options.saveErrors?.includes(save)) { return [next, error(ioError({ message: 'save unavailable' }))] }
            const sync = state.calls.filter(call => call === 'sync').length + 1
            return [next, path === 'sync' && options.syncErrors?.includes(sync)
                ? error(ioError({ message: 'sync unavailable' })) : ok(undefined)]
        },
        write: (stream, bytes) => state => [{ ...state, output: [...state.output, [stream, utf8ToString(bytes)]] }, ok(undefined)],
    }
    /** @type {CoverageCache} */
    const cache = {
        prepare: selected => {
            assertStructurallySame(selected, command)
            return mapStep(readdir('prepare', {}), entries => entries.map(({ name }) => assertOk(parse(name))))
        },
        has: manifest => mapStep(readdir(`has ${JSON.stringify(manifest)}`, {}), entries => entries.length !== 0),
        save: manifest => access(`save ${JSON.stringify(manifest)}`),
        sync: () => access('sync'),
    }
    /** @type {RunInstance<NodeOp, State>} */
    const run = partialRun(nodeCommands)(operations)
    return run({ calls: [], output: [] })(runCached(command,
        () => mapStep(access('run'), () => options.passed ?? true), options.disabled ? null : cache))
}

/** @type {(calls: readonly string[]) => readonly string[]} */
const writes = calls => calls.filter(call => call.startsWith('save ') || call === 'sync')

export const proof = {
    nullCache: () => {
        for (const passed of [false, true]) {
            const [state, result] = execute({ disabled: true, passed })
            assertEq(assertOk(result), passed ? 'passed' : 'failed')
            assertStructurallySame(state.calls, ['run'])
            assertEq(state.output.length, 0)
        }
    },
    exactHitsSkipChild: () => {
        const [state, result] = execute({ hits: [true, true] })
        assertEq(assertOk(result), 'cached')
        assertStructurallySame(state.calls, ['prepare', `has ${JSON.stringify(first)}`, `has ${JSON.stringify(second)}`, 'sync'])
        assertStructurallySame(state.output, [['stdout', 'CACHED /repo/unit\n']])
        const [warned, cached] = execute({ hits: [true, true], syncErrors: [1] })
        assertEq(assertOk(cached), 'cached')
        assert(warned.output.some(([stream, text]) => stream === 'stderr' && text.includes('sync unavailable')))
    },
    coldRecordsEachTargetBeforeNext: () => {
        for (const hits of [[false, true], [true, false]]) {
            const [state, result] = execute({ hits })
            assertEq(assertOk(result), 'passed')
            assertStructurallySame(state.calls, [
                'prepare', `has ${JSON.stringify(first)}`, `has ${JSON.stringify(second)}`, 'run', 'prepare',
                `save ${JSON.stringify(first)}`, 'sync', `save ${JSON.stringify(second)}`, 'sync',
            ])
            assertEq(state.output.length, 0)
        }
    },
    failedChildRecordsNothing: () => {
        const [state, result] = execute({ passed: false })
        assertEq(assertOk(result), 'failed')
        assertEq(state.calls.filter(call => call === 'prepare').length, 1)
        assertStructurallySame(writes(state.calls), [])
    },
    changedInputsRecordNothing: () => {
        const [state, result] = execute({ after: [first, { ...second, hash: 'changed' }] })
        assertEq(assertOk(result), 'passed')
        assertStructurallySame(writes(state.calls), [])
        assertStructurallySame(state.output, [['stderr', 'UNCACHED /repo/unit: coverage inputs changed during the run\n']])
    },
    canonicalObjects: () => {
        const [state, result] = execute({ before: [{ a: 1, b: 2 }], after: [{ b: 2, a: 1 }] })
        assertEq(assertOk(result), 'passed')
        assertStructurallySame(writes(state.calls), ['save {"b":2,"a":1}', 'sync'])
    },
    cacheReadFailuresRunWithoutRecording: () => {
        for (const options of [{ prepareErrors: [1] }, { lookupErrors: [1] }, { lookupErrors: [2] }]) {
            const [state, result] = execute(options)
            assertEq(assertOk(result), 'passed')
            assert(state.calls.includes('run'))
            assertEq(state.calls.filter(call => call === 'prepare').length, 1)
            assertStructurallySame(writes(state.calls), [])
            assert(state.output.some(([stream, text]) => stream === 'stderr' && text.startsWith('UNCACHED /repo/unit:')))
        }
    },
    postRunPreparationFailure: () => {
        const [state, result] = execute({ prepareErrors: [2] })
        assertEq(assertOk(result), 'passed')
        assertStructurallySame(writes(state.calls), [])
        assert(state.output.some(([stream, text]) => stream === 'stderr' && text.includes('preparation unavailable')))
    },
    cacheWriteFailuresRemainVisibleAndContinue: () => {
        const [state, result] = execute({ saveErrors: [1], syncErrors: [1, 2] })
        assertEq(assertOk(result), 'passed')
        assertStructurallySame(writes(state.calls), [
            `save ${JSON.stringify(first)}`, 'sync', `save ${JSON.stringify(second)}`, 'sync',
        ])
        assertEq(state.output.filter(([stream]) => stream === 'stderr').length, 3)
        assert(state.output.some(([, text]) => text.includes('save unavailable')))
        assert(state.output.some(([, text]) => text.includes('sync unavailable')))
    },
    runErrorsPropagate: () => {
        for (const disabled of [false, true]) {
            const [state, result] = execute({ runError: true, disabled })
            assertError(result)
            assertStructurallySame(writes(state.calls), [])
        }
    },
}
