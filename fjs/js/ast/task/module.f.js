/**
 * Evaluate deferred work with an explicit continuation stack. Recursive
 * constructors suspend through `call`; `bind` sequences their results without
 * putting syntax depth on the host stack.
 *
 * @module
 * @import { Task } from './types.ts'
 * @import { _Frame } from './private.ts'
 */

/** Complete a task with its result. @type {<T>(value: T) => Task<T>} */
export const done = value => ({ kind: 'done', value })

/** Suspend construction until the evaluator reaches this task. @type {<T>(run: () => Task<T>) => Task<T>} */
export const call = run => ({ kind: 'call', run })

/**
 * Continue with a completed task's result.
 * @template T, U
 * @param {Task<T>} first
 * @param {(value: T) => Task<U>} next
 * @returns {Task<U>}
 */
export const bind = (first, next) => ({ kind: 'bind', first, next: value => next(/** @type {T} */ (value)) })

/**
 * Evaluate suspended calls and continuations in order.
 * @template T
 * @param {Task<T>} input
 * @returns {T}
 */
export const run = input => {
    /** @type {Task<unknown>} */
    let task = input
    /** @type {_Frame | null} */
    let frames = null
    while (true) {
        if (task.kind === 'call') { task = task.run(); continue }
        if (task.kind === 'bind') { frames = { next: task.next, tail: frames }; task = task.first; continue }
        if (frames === null) { return /** @type {T} */ (task.value) }
        const frame = /** @type {_Frame} */ (frames)
        frames = frame.tail
        task = frame.next(task.value)
    }
}
