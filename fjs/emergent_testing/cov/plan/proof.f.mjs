/**
 * @import { CoverageCache, Command, Planned, RunResult } from './types.ts'
 * @import { Entry } from '../cache/types.ts'
 * @import { StringMap } from '../../../types/object/types.ts'
 * @import { PartialMemOperationMap, RunInstance } from '../../../effects/mock/types.ts'
 * @import { NodeOp } from '../../../effects/node/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { foldStep, mapStep, pureOk, step } from '../../../effects/module.f.mjs'
import { partialRun } from '../../../effects/mock/module.f.mjs'
import { access, ioError, nodeCommands, readdir } from '../../../effects/node/module.f.mjs'
import { utf8ToString } from '../../../text/utf8/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.js'
import { createPlan, runPlanned } from './module.f.mjs'

/** @type {(key: string) => Entry} */
const entry = key => ({ manifest: { target: key }, key, path: `.cas/${key}`, payload: key, byteLength: key.length })
const first = entry('first')
const second = entry('second')
const third = entry('third')
/** @type {readonly Command[]} */
const commands = [
    { directory: '/repo/a', files: ['module.f.js', 'demo.f.mjs'], args: ['--test'] },
    { directory: '/repo/b', files: ['module.f.js'], args: ['--test'] },
]
/** @type {StringMap<readonly Entry[]>} */
const defaults = { '/repo/a': [first, second], '/repo/b': [third] }
const lookupCall = 'lookup first,second,third'

/**
 * Record only effect boundaries. Planning and execution choose the lifecycle;
 * the mock supplies admission, one aligned batch response and changing inputs.
 *
 * @param {{
 *   readonly commands?: readonly Command[],
 *   readonly entries?: StringMap<readonly Entry[]>,
 *   readonly prepareErrors?: readonly string[],
 *   readonly lookupError?: boolean,
 *   readonly hits?: readonly boolean[],
 *   readonly valid?: readonly boolean[],
 *   readonly validationErrors?: readonly number[],
 *   readonly passed?: boolean,
 *   readonly runError?: boolean,
 *   readonly disabled?: boolean,
 *   readonly onlyPlan?: boolean,
 * }} [options]
 */
const execute = (options = {}) => {
    /** @typedef {{ readonly calls: readonly string[], readonly output: readonly (readonly [string, string])[] }} State */
    /** @type {PartialMemOperationMap<NodeOp, State>} */
    const operations = {
        access: path => state => {
            const next = { ...state, calls: [...state.calls, path] }
            const failed = path.startsWith('prepare ') && options.prepareErrors?.includes(path.slice('prepare '.length))
                || path.startsWith('lookup ') && options.lookupError
                || path.startsWith('run ') && options.runError
            return [next, failed ? error(ioError({ message: `${path.split(' ')[0]} unavailable` })) : ok(undefined)]
        },
        readdir: path => state => {
            const next = { ...state, calls: [...state.calls, path] }
            const call = state.calls.filter(call => call.startsWith('validate ')).length + 1
            return [next, options.validationErrors?.includes(call)
                ? error(ioError({ message: 'validation unavailable' }))
                : ok((options.valid?.[call - 1] ?? true) ? [{ name: 'valid', parentPath: '', isDirectory: false, isFile: true }] : [])]
        },
        write: (stream, bytes) => state => [{ ...state, output: [...state.output, [stream, utf8ToString(bytes)]] }, ok(undefined)],
    }
    /** @type {CoverageCache} */
    const cache = {
        prepare: selected => mapStep(access(`prepare ${selected.directory}`), () =>
            (options.entries ?? defaults)[selected.directory] ?? []),
        lookup: entries => mapStep(access(`lookup ${entries.map(entry => entry.key).join(',')}`), () =>
            options.hits ?? entries.map(() => false)),
        validate: selected => mapStep(readdir(`validate ${selected.directory}`, {}), entries => entries.length !== 0),
        saveMany: entries => access(`save ${entries.map(entry => entry.key).join(',')}`),
        sync: () => access('sync'),
    }
    const selected = options.disabled ? null : cache
    const planned = createPlan(options.commands ?? commands, selected)
    const program = step(planned, planned => {
        const results = options.onlyPlan ? pureOk(/** @type {readonly RunResult[]} */ ([]))
            : foldStep(pureOk(planned), /** @type {readonly RunResult[]} */ ([]), item => results =>
                mapStep(runPlanned(item, () => mapStep(access(`run ${item.command.directory}`), () => options.passed ?? true), selected),
                    result => [...results, result]))
        return mapStep(results, results => ({ planned, results }))
    })
    /** @type {RunInstance<NodeOp, State>} */
    const run = partialRun(nodeCommands)(operations)
    return run({ calls: [], output: [] })(program)
}

/** @type {(calls: readonly string[]) => readonly string[]} */
const writes = calls => calls.filter(call => call.startsWith('save ') || call === 'sync')

export const proof = {
    allPreparedBeforeOneLookup: () => {
        const [state, result] = execute({ onlyPlan: true, hits: [true, true, false] })
        const planned = assertOk(result).planned
        assertStructurallySame(state.calls, ['prepare /repo/a', 'prepare /repo/b', lookupCall])
        assertStructurallySame(planned, [
            { command: commands[0], entries: defaults['/repo/a'], cached: true },
            { command: commands[1], entries: defaults['/repo/b'], cached: false },
        ])
        assertStructurallySame(state.output, [])
    },
    directoryRequiresEveryTarget: () => {
        for (const hits of [[false, true, true], [true, false, true]]) {
            const [state, result] = execute({ hits })
            const value = assertOk(result)
            assertStructurallySame(value.planned.map(item => item.cached), [false, true])
            assertStructurallySame(value.results, [
                { outcome: 'passed', entries: defaults['/repo/a'] },
                { outcome: 'cached', entries: [] },
            ])
            assertStructurallySame(state.calls, [
                'prepare /repo/a', 'prepare /repo/b', lookupCall,
                'validate /repo/a', 'run /repo/a', 'validate /repo/a', 'validate /repo/b',
            ])
        }
    },
    hitsValidateBeforeSkipping: () => {
        const [state, result] = execute({ hits: [true, true, true] })
        assertStructurallySame(assertOk(result).results, [
            { outcome: 'cached', entries: [] }, { outcome: 'cached', entries: [] },
        ])
        assertStructurallySame(state.calls, [
            'prepare /repo/a', 'prepare /repo/b', lookupCall, 'validate /repo/a', 'validate /repo/b',
        ])
    },
    originalEntriesSurviveExecution: () => {
        const [state, result] = execute()
        const value = assertOk(result)
        assertEq(value.results[0].entries, defaults['/repo/a'])
        assertEq(value.results[1].entries, defaults['/repo/b'])
        assertEq(value.planned[0].entries, value.results[0].entries)
        assertStructurallySame(writes(state.calls), [])
        assertEq(state.calls.filter(call => call.startsWith('prepare ')).length, commands.length)
        assertEq(state.calls.filter(call => call.startsWith('lookup ')).length, 1)
    },
    failedAdmissionDoesNotBlockOtherDirectories: () => {
        const [state, result] = execute({ prepareErrors: ['/repo/a'], hits: [true] })
        const value = assertOk(result)
        assertEq(value.planned[0].entries, null)
        assertEq(value.planned[0].cached, false)
        assertEq(value.planned[1].cached, true)
        assertStructurallySame(value.results, [
            { outcome: 'passed', entries: [] }, { outcome: 'cached', entries: [] },
        ])
        assertStructurallySame(state.calls, [
            'prepare /repo/a', 'prepare /repo/b', 'lookup third', 'run /repo/a', 'validate /repo/b',
        ])
        assertStructurallySame(state.output, [['stderr', 'UNCACHED /repo/a: prepare unavailable\n']])
    },
    unavailableLookupWithholdsAllRecords: () => {
        for (const options of [{ lookupError: true }, { hits: [] }, { hits: [true] }, { hits: [true, true, true, true] }]) {
            const [state, result] = execute(options)
            const value = assertOk(result)
            assert(value.planned.every(item => item.entries === null && !item.cached))
            assertStructurallySame(value.results, [
                { outcome: 'passed', entries: [] }, { outcome: 'passed', entries: [] },
            ])
            assertStructurallySame(state.calls, [
                'prepare /repo/a', 'prepare /repo/b', lookupCall, 'run /repo/a', 'run /repo/b',
            ])
            assertEq(state.output.length, 1)
            assert(state.output[0][1].startsWith('UNCACHED:'))
        }
    },
    emptyPlansAndCertificatesDoNotLookup: () => {
        const [empty, result] = execute({ commands: [] })
        assertStructurallySame(assertOk(result), { planned: [], results: [] })
        assertStructurallySame(empty.calls, [])
        const [state, admitted] = execute({ entries: {} })
        assert(assertOk(admitted).planned.every(item => item.entries?.length === 0 && !item.cached))
        assertStructurallySame(assertOk(admitted).results, [
            { outcome: 'passed', entries: [] }, { outcome: 'passed', entries: [] },
        ])
        assertStructurallySame(state.calls, ['prepare /repo/a', 'prepare /repo/b', 'run /repo/a', 'run /repo/b'])
        const [rejected, refused] = execute({ prepareErrors: ['/repo/a', '/repo/b'] })
        assert(assertOk(refused).planned.every(item => item.entries === null))
        assert(!rejected.calls.some(call => call.startsWith('lookup ')))
    },
    nullCacheRunsEverything: () => {
        for (const passed of [false, true]) {
            const [state, result] = execute({ disabled: true, passed })
            const value = assertOk(result)
            assert(value.planned.every(item => item.entries === null && !item.cached))
            assertStructurallySame(value.results, [
                { outcome: passed ? 'passed' : 'failed', entries: [] },
                { outcome: passed ? 'passed' : 'failed', entries: [] },
            ])
            assertStructurallySame(state.calls, ['run /repo/a', 'run /repo/b'])
            assertStructurallySame(state.output, [])
        }
    },
    stalePlannedHitsRerunWithoutRecording: () => {
        for (const options of [{ valid: [false, true] }, { validationErrors: [1] }]) {
            const [state, result] = execute({ ...options, hits: [true, true, true] })
            assertStructurallySame(assertOk(result).results, [
                { outcome: 'passed', entries: [] }, { outcome: 'cached', entries: [] },
            ])
            assertStructurallySame(state.calls, [
                'prepare /repo/a', 'prepare /repo/b', lookupCall, 'validate /repo/a', 'run /repo/a', 'validate /repo/b',
            ])
            assert(state.output.some(([stream, text]) => stream === 'stderr' && text.startsWith('UNCACHED /repo/a:')))
        }
    },
    changedDuringExecutionWithholdsOriginalEntries: () => {
        for (const options of [{ valid: [true, false] }, { validationErrors: [2] }]) {
            const [state, result] = execute({ ...options, commands: [commands[0]] })
            assertStructurallySame(assertOk(result).results, [{ outcome: 'passed', entries: [] }])
            assertStructurallySame(state.calls, [
                'prepare /repo/a', 'lookup first,second', 'validate /repo/a', 'run /repo/a', 'validate /repo/a',
            ])
            assertStructurallySame(writes(state.calls), [])
            assertEq(state.output.length, 1)
        }
    },
    failedChildrenNeverPostvalidateOrRecord: () => {
        const [state, result] = execute({ passed: false })
        assertStructurallySame(assertOk(result).results, [
            { outcome: 'failed', entries: [] }, { outcome: 'failed', entries: [] },
        ])
        assertStructurallySame(state.calls, [
            'prepare /repo/a', 'prepare /repo/b', lookupCall,
            'validate /repo/a', 'run /repo/a', 'validate /repo/b', 'run /repo/b',
        ])
        assertStructurallySame(writes(state.calls), [])
    },
    executionHasNoDiscoveryPhase: () => {
        const run = partialRun(nodeCommands)({})
        /** @type {CoverageCache} */
        const cache = {
            prepare: () => { throw 'prepare during execution'; },
            lookup: () => { throw 'lookup during execution'; },
            validate: () => pureOk(true),
            saveMany: () => { throw 'write during execution'; },
            sync: () => { throw 'sync during execution'; },
        }
        /** @type {Planned} */
        const item = { command: commands[0], entries: [first, second], cached: false }
        const [, result] = run(undefined)(runPlanned(item, () => pureOk(true), cache))
        assertEq(assertOk(result).entries, item.entries)
        // Disabling the backend after planning must still execute coverage.
        assertStructurallySame(assertOk(run(undefined)(runPlanned({ ...item, cached: true }, () => pureOk(true), null))[1]),
            { outcome: 'passed', entries: [] })
    },
    childErrorsPropagate: () => {
        for (const disabled of [false, true]) {
            const [state, result] = execute({ runError: true, disabled })
            assertError(result)
            assertStructurallySame(writes(state.calls), [])
        }
    },
}
