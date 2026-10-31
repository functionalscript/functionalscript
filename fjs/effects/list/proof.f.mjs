/**
 * @import { EffectList, Next } from './types.ts'
 * @import { Effect, Func, NotImplemented } from '../types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Transducer } from '../../types/function/operator/types.ts'
 * @import { MemOperationMap } from '../mock/types.ts'
 */

import { do_, pureError, pureOk, runPure, step } from '../module.f.mjs'
import { run as mockRun } from '../mock/module.f.mjs'
import { empty, fromList, nonEmpty, run, transduce } from './module.f.mjs'
import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { doneStep, fromStateFold, nextStep } from '../../types/function/operator/module.f.js'
import { error, ok } from '../../types/result/module.f.js'

/** @type {Func<readonly ['read', (value: number) => Result<number, string>]>} */
const read = do_('read')

/** @type {Func<readonly ['emit', (chunk: readonly number[]) => Result<void, string>]>} */
const emit = do_('emit')

/** @type {MemOperationMap<readonly ['read', (value: number) => Result<number, string>] | readonly ['emit', (chunk: readonly number[]) => Result<void, string>], readonly string[]>} */
const operations = {
    read: value => log => [[...log, `read:${value}`], ok(value)],
    emit: chunk => log => [[...log, `emit:${chunk.join(',')}`], ok(undefined)],
}

const runtime = mockRun(operations)

/** @type {Transducer<number, number, number, number>} */
const echo = {
    init: nextStep(0, [10]),
    update: (state, input) => nextStep(state + input, [input]),
    end: state => doneStep(state, [-1]),
}

/** @type {<T, E>(effect: Effect<never, T, E>) => Result<T, E>} */
const settled = effect => {
    const observed = runPure(effect)
    assert(observed.length === 1)
    const [result] = observed
    return result
}

/** @type {Transducer<number, number, never, number>} */
const one = {
    init: nextStep(0),
    update: (_, input) => doneStep(input),
    end: state => doneStep(state),
}

const machines = /** @type {const} */ ({
    pureEmissionAndFlush: () => {
        assertStructurallySame(settled(transduce(echo)(() => pureOk(undefined))(fromList([2, 3]))), ['ok', 5])
        assertStructurallySame(settled(run(echo)(fromList([2, 3]))), ['ok', 5])
    },
    commandOrder: () => {
        const source = step(read(2), value => nonEmpty(value, empty()))
        assertStructurallySame(runtime([])(transduce(echo)(emit)(source)),
            [['emit:10', 'read:2', 'emit:2', 'emit:-1'], ['ok', 2]])
    },
    sourceCommandEof: () => {
        const source = step(read(0), () => empty())
        assertStructurallySame(runtime([])(transduce(echo)(emit)(source)),
            [['emit:10', 'read:0', 'emit:-1'], ['ok', 0]])
    },
    pureSourceAndEffectfulSink: () => {
        assertStructurallySame(runtime([])(transduce(echo)(emit)(fromList([4]))),
            [['emit:10', 'emit:4', 'emit:-1'], ['ok', 4]])
    },
    initialDoneDoesNotRead: () => {
        /** @type {Transducer<number, null, number, null>} */
        const finished = { init: doneStep(null, [7]), update: () => doneStep(null), end: () => doneStep(null) }
        assertStructurallySame(runtime([])(transduce(finished)(emit)(step(read(99), () => empty()))),
            [['emit:7'], ['ok', null]])
        assertStructurallySame(settled(run({ ...finished, init: doneStep(null) })(pureError('unread'))), ['ok', null])
    },
    earlyDoneDoesNotReadTail: () => {
        const source = nonEmpty(4, pureError('unread'))
        assertStructurallySame(settled(run(one)(source)), ['ok', 4])
        const commandSource = step(read(8), value => nonEmpty(value, pureError('unread')))
        assertStructurallySame(runtime([])(run(one)(commandSource)), [['read:8'], ['ok', 8]])
    },
    sourceFailureDoesNotFlush: () => {
        assertStructurallySame(runtime([])(transduce(echo)(emit)(pureError('source failed'))),
            [['emit:10'], ['error', 'source failed']])
    },
    sinkFailureDoesNotPull: () => {
        assertStructurallySame(settled(transduce(echo)(() => pureError('sink failed'))(pureError('unread'))),
            ['error', 'sink failed'])
    },
    commandFailureDoesNotPull: () => {
        /** @type {MemOperationMap<readonly ['emit', (chunk: readonly number[]) => Result<void, string>], readonly string[]>} */
        const handlers = { emit: chunk => log => [[...log, `emit:${chunk.length}`], error('sink failed')] }
        const failing = mockRun(handlers)
        assertStructurallySame(failing([])(transduce(echo)(emit)(pureError('unread'))),
            [['emit:1'], ['error', 'sink failed']])
    },
    sourceCommandFailureDoesNotFlush: () => {
        /** @type {typeof operations} */
        const handlers = {
            ...operations,
            read: value => log => [[...log, `read:${value}`], error('read failed')],
        }
        const source = step(read(2), value => nonEmpty(value, empty()))
        assertStructurallySame(mockRun(handlers)([])(transduce(echo)(emit)(source)),
            [['emit:10', 'read:2'], ['error', 'read failed']])
    },
    flushFailureDoesNotReturnSummary: () => {
        /** @type {typeof operations} */
        const handlers = {
            ...operations,
            emit: chunk => log => [[...log, `emit:${chunk.join(',')}`], chunk[0] === -1 ? error('flush failed') : ok(undefined)],
        }
        assertStructurallySame(mockRun(handlers)([])(transduce(echo)(emit)(empty())),
            [['emit:10', 'emit:-1'], ['error', 'flush failed']])
    },
    silentNullStateAndResult: () => {
        /** @type {Transducer<number, null, never, null>} */
        const machine = {
            init: nextStep(null),
            update: state => nextStep(state),
            end: state => doneStep(state),
        }
        assertStructurallySame(settled(transduce(machine)(() => pureError('empty chunks must not reach the sink'))(fromList([1, 2]))),
            ['ok', null])
    },
    longPureSpan: () => {
        const sum = fromStateFold({ init: 0, update: (/** @type {number} */ state, /** @type {number} */ input) => state + input, end: state => state })
        /** @type {(count: number) => import('../../types/list/types.ts').List<number>} */
        const values = count => count === 0 ? null : { first: 1, tail: () => values(count - 1) }
        assertStructurallySame(settled(run(sum)(fromList(values(50_000)))), ['ok', 50_000])
        assertStructurallySame(settled(run(sum)(empty())), ['ok', 0])
    },
})

/**
 * Pulls one cell. Both constructors are pure, so the cell is reached without a
 * runner.
 *
 * @type {(e: EffectList<never, number>) => Next<never, number, NotImplemented>}
 */
const pull = e => {
    const o = runPure(e)
    assert(o.length === 1, o)
    return assertOk(o[0])
}

export const proof = {
    machines,
    /** `empty` is the end of the stream. */
    empty: () => {
        assertEq(pull(empty()), undefined)
    },
    /** `nonEmpty` is a cell holding `first` and the `tail` it was given. */
    nonEmpty: () => {
        /** @type {EffectList<never, number>} */
        const tail = empty()
        const cell = pull(nonEmpty(1, tail))
        assert(cell !== undefined, cell)
        assertEq(cell.first, 1)
        assertEq(cell.tail, tail)
    },
    /** `fromList` streams a strict list cell by cell and ends where it ends. */
    fromList: () => {
        const c1 = pull(fromList([1, 2]))
        assert(c1 !== undefined, c1)
        assertEq(c1.first, 1)
        const c2 = pull(c1.tail)
        assert(c2 !== undefined, c2)
        assertEq(c2.first, 2)
        assertEq(pull(c2.tail), undefined)
        assertEq(pull(fromList(null)), undefined)
    },
}
