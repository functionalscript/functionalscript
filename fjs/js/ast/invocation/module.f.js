/**
 * Fresh rest-invocation transitions and their exact inverse recipe. The private
 * argument vector is established before any simultaneous invocation update.
 *
 * @module
 * @import { BindingId, Block, Item, LoopTarget, Value } from '../types.ts'
 */

/** @type {(value: Value, binding: BindingId) => boolean} */
const names = (value, binding) => value instanceof Array && value[0] === 'ref' && value[1] === binding

/**
 * The fixed projections of the rest array: `[0]` to `[length - 1]` of
 * the binding, in order.
 *
 * @type {(binding: BindingId, length: number) => readonly Value[]}
 */
const projections = (binding, length) => length === 0
    ? []
    : [...projections(binding, length - 1), /** @type {Value} */ (['.', ['ref', binding], length - 1])]

/** @type {(length: number, args: readonly Item<Value>[], target: LoopTarget) => Block} */
export const _restTransition = (length, args, target) => {
    const binding = /** @type {BindingId} */ ({ index: target.index })
    return {
        statements: [['define', binding, ['array', args], 'required']],
        exit: ['continue', target, [
            ...projections(binding, length),
            ['()', ['slice'], [['ref', binding], length]],
        ]],
    }
}

/**
 * Only the final required array and its fixed projections/fresh slice form an
 * invocation recipe. Its identity has no other reached use, so reconstruction
 * can remove the array and recover the original arguments without wrapper growth.
 *
 * @type {(block: Block, length: number, target: LoopTarget) => readonly Item<Value>[] | null}
 */
export const _restArguments = (block, length, target) => {
    const exit = block.exit
    const last = block.statements.at(-1)
    if (exit[0] !== 'continue' || exit[1] !== target || exit[2].length !== length + 1
        || last === undefined || last[0] !== 'define' || last[3] !== 'required'
        || !(last[2] instanceof Array) || last[2][0] !== 'array') { return null }
    const binding = last[1]
    if (!exit[2].slice(0, length).every((value, index) => value instanceof Array && value[0] === '.' && value.length === 3
        && names(value[1], binding) && value[2] === index)) { return null }
    const rest = exit[2][Number(length)]
    return rest instanceof Array && rest[0] === '()' && rest[1] instanceof Array && rest[1][0] === 'slice'
        && rest[2].length === 2 && names(/** @type {Value} */ (rest[2][0]), binding) && rest[2][1] === length
        ? last[2][1] : null
}
