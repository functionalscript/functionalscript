/**
 * @import { CoverageCache, Command } from './types.ts'
 * @import { Unknown } from '../../../media/json/types.ts'
 * @import { PartialMemOperationMap, RunInstance } from '../../../effects/mock/types.ts'
 * @import { NodeOp } from '../../../effects/node/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { mapStep, pureOk } from '../../../effects/module.f.mjs'
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
 *   readonly prepareErrors?: readonly number[],
 *   readonly valid?: readonly boolean[],
 *   readonly validationErrors?: readonly number[],
 *   readonly lookupErrors?: readonly number[],
 *   readonly hits?: readonly boolean[],
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
                const manifests = options.before ?? [first, second]
                return [next, ok(manifests.map(manifest => ({ name: JSON.stringify(manifest), parentPath: '', isDirectory: false, isFile: true })))]
            }
            if (path === 'validate') {
                const call = state.calls.filter(call => call === 'validate').length + 1
                if (options.validationErrors?.includes(call)) { return [next, error(ioError({ message: 'validation unavailable' }))] }
                return [next, ok((options.valid?.[call - 1] ?? true) ? [{ name: 'valid', parentPath: '', isDirectory: false, isFile: true }] : [])]
            }
            const call = state.calls.filter(call => call.startsWith('has ')).length + 1
            if (options.lookupErrors?.includes(call)) { return [next, error(ioError({ message: 'lookup unavailable' }))] }
            return [next, ok(options.hits?.[call - 1] ? [{ name: 'hit', parentPath: '', isDirectory: false, isFile: true }] : [])]
        },
        access: path => state => {
            const next = { ...state, calls: [...state.calls, path] }
            if (path === 'run' && options.runError) { return [next, error(ioError({ message: 'run unavailable' }))] }
            return [next, ok(undefined)]
        },
        write: (stream, bytes) => state => [{ ...state, output: [...state.output, [stream, utf8ToString(bytes)]] }, ok(undefined)],
    }
    /** @type {CoverageCache} */
    const cache = {
        prepare: selected => {
            assertStructurallySame(selected, command)
            return mapStep(readdir('prepare', {}), entries => entries.map(({ name }) => assertOk(parse(name))))
        },
        validate: selected => {
            assertStructurallySame(selected, command)
            return mapStep(readdir('validate', {}), entries => entries.length !== 0)
        },
        has: manifest => mapStep(readdir(`has ${JSON.stringify(manifest)}`, {}), entries => entries.length !== 0),
        saveMany: manifests => access(`save ${JSON.stringify(manifests)}`),
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
            assertStructurallySame(assertOk(result), { outcome: passed ? 'passed' : 'failed', manifests: [] })
            assertStructurallySame(state.calls, ['run'])
            assertEq(state.output.length, 0)
        }
    },
    exactHitsSkipChild: () => {
        const [state, result] = execute({ hits: [true, true] })
        assertStructurallySame(assertOk(result), { outcome: 'cached', manifests: [] })
        assertStructurallySame(state.calls, ['prepare', 'validate', `has ${JSON.stringify(first)}`, `has ${JSON.stringify(second)}`])
        assertStructurallySame(state.output, [])
    },
    coldReturnsSuccessesWithoutWriting: () => {
        for (const hits of [[false, true], [true, false]]) {
            const [state, result] = execute({ hits })
            assertStructurallySame(assertOk(result), { outcome: 'passed', manifests: [first, second] })
            assertStructurallySame(state.calls, [
                'prepare', 'validate', `has ${JSON.stringify(first)}`, `has ${JSON.stringify(second)}`, 'run', 'validate',
            ])
            assertEq(state.output.length, 0)
        }
    },
    originalManifestsReturned: () => {
        const manifests = [first, second]
        /** @type {CoverageCache} */
        const cache = {
            prepare: () => pureOk(manifests),
            validate: () => pureOk(true),
            has: () => pureOk(false),
            saveMany: () => pureOk(undefined),
            sync: () => pureOk(undefined),
        }
        const run = partialRun(nodeCommands)({})
        const [, result] = run(undefined)(runCached(command, () => pureOk(true), cache))
        assertEq(assertOk(result).manifests, manifests)
    },
    failedChildRecordsNothing: () => {
        const [state, result] = execute({ passed: false })
        assertStructurallySame(assertOk(result), { outcome: 'failed', manifests: [] })
        assertEq(state.calls.filter(call => call === 'prepare').length, 1)
        assertEq(state.calls.filter(call => call === 'validate').length, 1)
        assertStructurallySame(writes(state.calls), [])
    },
    staleSnapshotCannotSkipChild: () => {
        const [state, result] = execute({ valid: [false], hits: [true, true] })
        assertStructurallySame(assertOk(result), { outcome: 'passed', manifests: [] })
        assertStructurallySame(state.calls, ['prepare', 'validate', 'run'])
        assertStructurallySame(state.output, [['stderr', 'UNCACHED /repo/unit: coverage inputs changed since the cache snapshot\n']])
    },
    changedDuringExecutionRecordsNothing: () => {
        const [state, result] = execute({ valid: [true, false] })
        assertStructurallySame(assertOk(result), { outcome: 'passed', manifests: [] })
        assertStructurallySame(state.calls, [
            'prepare', 'validate', `has ${JSON.stringify(first)}`, `has ${JSON.stringify(second)}`, 'run', 'validate',
        ])
        assertStructurallySame(writes(state.calls), [])
        assertStructurallySame(state.output, [['stderr', 'UNCACHED /repo/unit: coverage inputs changed since the cache snapshot\n']])
    },
    cacheReadFailuresRunWithoutRecording: () => {
        for (const options of [{ prepareErrors: [1] }, { validationErrors: [1] }, { lookupErrors: [1] }, { lookupErrors: [2] }]) {
            const [state, result] = execute(options)
            assertStructurallySame(assertOk(result), { outcome: 'passed', manifests: [] })
            assert(state.calls.includes('run'))
            assertEq(state.calls.filter(call => call === 'prepare').length, 1)
            assertStructurallySame(writes(state.calls), [])
            assert(state.output.some(([stream, text]) => stream === 'stderr' && text.startsWith('UNCACHED /repo/unit:')))
        }
    },
    failedValidationCannotSkipChild: () => {
        const [state, result] = execute({ validationErrors: [1], hits: [true, true] })
        assertStructurallySame(assertOk(result), { outcome: 'passed', manifests: [] })
        assertStructurallySame(state.calls, ['prepare', 'validate', 'run'])
        assertStructurallySame(state.output, [['stderr', 'UNCACHED /repo/unit: validation unavailable\n']])
    },
    postRunValidationFailure: () => {
        const [state, result] = execute({ validationErrors: [2] })
        assertStructurallySame(assertOk(result), { outcome: 'passed', manifests: [] })
        assertEq(state.calls.filter(call => call === 'prepare').length, 1)
        assertEq(state.calls.filter(call => call === 'validate').length, 2)
        assertStructurallySame(writes(state.calls), [])
        assertStructurallySame(state.output, [['stderr', 'UNCACHED /repo/unit: validation unavailable\n']])
    },
    runErrorsPropagate: () => {
        for (const disabled of [false, true]) {
            const [state, result] = execute({ runError: true, disabled })
            assertError(result)
            assertStructurallySame(writes(state.calls), [])
        }
    },
}
