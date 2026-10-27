/**
 * Tail status belongs to the terminal evaluation after value placement.
 * Definitions and bound result reads retain their ordinary evaluation owner.
 *
 * @module
 * @import { BindingId, Block, LoopTarget, Value } from '../../../js/ast/types.ts'
 * @import { Task } from '../../../js/ast/task/types.ts'
 * @import { _Result } from './private.ts'
 */

import { bind, call, done, run } from '../../../js/ast/task/module.f.mjs'
import { isSpread } from '../../../js/ast/module.f.mjs'
import { _restTransition } from '../../../js/ast/invocation/module.f.mjs'

/**
 * Convert only reached terminal blocks and conditional arms. Other expressions
 * remain complete base results, including references to established calls.
 * Calls transition the fixed invocation signature. Missing values become
 * undefined; spreads and extra arguments finish evaluation before transfer.
 * @type {(source: Block, parameters: readonly BindingId[], self: BindingId, target: LoopTarget, rest?: BindingId | null) => Block | null}
 */
export const _tailCalls = (source, parameters, self, target, rest = null) => {
    /** @type {(value: Value) => Task<_Result>} */
    const valueTask = value => call(() => {
        if (value instanceof Array) {
            if (value[0] === 'block') { return blockTask(value[1]) }
            if (value[0] === 'if') {
                return bind(blockTask(value[2]), then => bind(blockTask(value[3]), otherwise => done({
                    block: {
                        statements: [['if', [], value[1], then.block, otherwise.block]],
                        // Both arms transfer; an empty unreachable yield emits
                        // no physical suffix after the terminal conditional.
                        exit: ['yield', []],
                    },
                    changed: then.changed || otherwise.changed,
                })))
            }
            if (value[0] === '()' && value[1] instanceof Array && value[1][0] === 'ref' && value[1][1] === self) {
                const args = value[2]
                if (rest !== null) { return done({ block: _restTransition(parameters.length, args, target), changed: true }) }
                if (args.length > parameters.length || args.some(isSpread)) {
                    // Materialize the invocation before reading its fixed
                    // prefix. Every extra value and lazy demand stays reached.
                    // This private vector's identity is never exposed.
                    const binding = { index: self.index + 1 }
                    return done({ block: {
                        statements: [['define', binding, ['array', args], 'required']],
                        exit: ['continue', target, parameters.map((_, index) => ['.', ['ref', binding], index])],
                    }, changed: true })
                }
                const fixed = /** @type {readonly Value[]} */ (args)
                return done({ block: { statements: [], exit: ['continue', target, parameters.map((_, index) => index < fixed.length ? fixed[index] : undefined)] }, changed: true })
            }
        }
        return done({ block: { statements: [], exit: ['break', target, [value]] }, changed: false })
    })
    /** @type {(block: Block) => Task<_Result>} */
    const blockTask = block => call(() => {
        if (block.exit[0] === 'throw') { return done(/** @type {_Result} */ ({ block, changed: false })) }
        return bind(valueTask(/** @type {Extract<Block['exit'], readonly ['yield', readonly Value[]]>} */ (block.exit)[1][0]), result => done({
            block: { statements: [...block.statements, ...result.block.statements], exit: result.block.exit }, changed: result.changed,
        }))
    })
    const result = run(blockTask(source))
    return result.changed ? result.block : null
}
