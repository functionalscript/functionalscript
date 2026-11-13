/**
 * A driver for walking deep input over an explicit stack, so that depth is
 * bounded by memory and not by the host's call stack.
 *
 * The caller says what one node and one resumed frame come to; the driver
 * owns the loop, the stack of suspended frames, the short-circuit on an
 * error and the exit when a value reaches an empty stack.
 *
 * @module
 *
 * @example
 *
 * ```js
 * import { walk } from './module.f.js'
 * import { ok } from '../result/module.f.js'
 *
 * // The depth of a nested array: a frame per array, the deepest child kept.
 * const depth = walk({
 *     enter: node => node.length === 0 ? ok(1) : ['push', { node, index: 0, max: 0 }, node[0]],
 *     resume: ({ node, index, max }, value) => {
 *         const next = { node, index: index + 1, max: Math.max(max, value) }
 *         return next.index < node.length ? ['push', next, node[next.index]] : ok(next.max + 1)
 *     },
 * })
 * if (depth([[[]], []])[1] !== 3) { throw 'error' }
 * ```
 *
 * @import { Result } from '../result/types.ts'
 * @import { Stack, Step, Walk, WalkFold } from './types.ts'
 */

import { mapOk, ok } from '../result/module.f.js'

/**
 * The value `root` comes to, with the accumulator as the walk left it, or
 * the first error a visit returns.
 *
 * @template A, N, F, V, E
 * @param {WalkFold<A, N, F, V, E>} w
 * @returns {(init: A) => (root: N) => Result<readonly [A, V], E>}
 */
export const walkFold = ({ enter, resume }) => init => root => {
    let [acc, step] = enter(init, root)
    /** @type {Stack<F>} */
    let stack = null
    while (true) {
        if (step[0] === 'error') { return step }
        if (step[0] === 'push') {
            stack = { top: step[1], rest: stack }
            const entered = enter(acc, step[2])
            acc = entered[0]
            step = entered[1]
        } else if (stack === null) {
            return ok([acc, step[1]])
        } else {
            /** @type {NonNullable<Stack<F>>} */
            const { top, rest } = stack
            stack = rest
            const resumed = resume(acc, top, step[1])
            acc = resumed[0]
            step = resumed[1]
        }
    }
}

/**
 * The value `root` comes to, or the first error a visit returns.
 *
 * @type {<N, F, V, E>(w: Walk<N, F, V, E>) => (root: N) => Result<V, E>}
 */
export const walk = ({ enter, resume }) => {
    const run = walkFold({
        enter: (_, node) => [null, enter(node)],
        resume: (_, frame, value) => [null, resume(frame, value)],
    })(null)
    return root => mapOk(([, value]) => value)(run(root))
}

/**
 * `items` pushed onto `stack`, their order kept: `items[0]` ends on top, so
 * a walk that pops the stack meets them first to last. What a walker that
 * keeps its own stack of work pushes the children of a node with.
 *
 * @type {<F>(items: readonly F[], stack: Stack<F>) => Stack<F>}
 */
export const pushAll = (items, stack) => {
    let result = stack
    for (let i = items.length - 1; i >= 0; i -= 1) {
        result = { top: items[Number(i)], rest: result }
    }
    return result
}

/**
 * A step that visits the node `result` holds inside `frame`, or ends the
 * walk with its error: for a node that is itself checked before it is
 * visited.
 *
 * @type {<F>(frame: F) => <N, E>(result: Result<N, E>) => Step<N, F, never, E>}
 */
export const pushOk = frame => result => result[0] === 'ok' ? ['push', frame, result[1]] : result
