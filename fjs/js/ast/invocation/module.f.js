/**
 * Fresh rest-invocation transitions and their exact inverse recipe. The private
 * argument vector is established before any simultaneous invocation update.
 *
 * @module
 * @import { BindingId, Block, Item, LoopTarget, Value } from '../types.ts'
 */

/** @type {(value: Value, binding: BindingId) => boolean} */
const names = (value, binding) => value instanceof Array && value[0] === 'ref' && value[1] === binding

/** Immutable lexical aliases can name the same function owner. @type {(value: Value, aliases: readonly BindingId[]) => boolean} */
export const _isSelf = (value, aliases) => value instanceof Array && value[0] === 'ref' && aliases.includes(value[1])

/**
 * The fixed projections of the rest array: `[0]` to `[length - 1]` of
 * the binding, in order.
 *
 * @type {(binding: BindingId, length: number) => readonly Value[]}
 */
const projections = (binding, length) => length === 0
    ? []
    : [...projections(binding, length - 1), /** @type {Value} */ (['.', ['ref', binding], length - 1])]

/** @param {readonly Item<Value>[]} args @returns {args is readonly Value[]} */
const fixedArguments = args => args.every(item => !(item instanceof Array) || item[0] !== '...')

/** @type {(args: readonly Value[], length: number) => readonly Value[]} */
const fixedValues = (args, length) => length === 0 ? []
    : [...fixedValues(args, length - 1), length - 1 < args.length ? args[Number(length - 1)] : undefined]

/**
 * Finish every call argument before simultaneously rebinding the invocation.
 * Missing fixed arguments are undefined. Extra arguments and spreads retain
 * their required evaluation even when no fixed parameter receives their value.
 * A rest invocation establishes a fresh rest array on every transition.
 * @type {(length: number, args: readonly Item<Value>[], target: LoopTarget, rest?: boolean) => Block}
 */
export const _invocationTransition = (length, args, target, rest = false) => {
    if (!rest && args.length <= length && fixedArguments(args)) {
        return { statements: [], exit: ['continue', target, fixedValues(args, length)] }
    }
    /** @type {BindingId} */
    const binding = { index: target.index }
    const fixed = projections(binding, length)
    /** @type {readonly Value[]} */
    const values = rest ? [...fixed, ['()', ['slice'], [['ref', binding], length]]] : fixed
    return {
        statements: [['define', binding, ['array', args], 'required']],
        exit: ['continue', target, values],
    }
}

/** @type {(length: number, args: readonly Item<Value>[], target: LoopTarget) => Block} */
export const _restTransition = (length, args, target) => _invocationTransition(length, args, target, true)

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
