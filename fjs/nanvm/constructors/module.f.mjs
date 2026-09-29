/**
 * The corpus format's constructors — the things a literal cannot express.
 *
 * Each is a thunk returning a tagged tuple, so a case can hold one wherever a
 * value goes. [`../module.f.mjs`](../module.f.mjs) re-exports them beside the
 * eliminators that read them back; they live here, apart from the data, so
 * that the case modules can use them without importing the module that
 * imports those cases.
 *
 * @module
 *
 * @import { Callback, CallbackName, FunctionValue, Ref, Returns, Throws, Unreached, Value } from '../types.ts'
 *
 * @example
 *
 * ```js
 * import { callback, throws } from './module.f.mjs'
 *
 * throws()             // ['throw']
 * callback('first')()  // ['callback', 'first']
 * ```
 */

/**
 * A function value.
 *
 * Every operator here coerces a function through `ToPrimitive`, which never
 * inspects it, so which function it is does not matter — and so it lowers to
 * the smallest one, `lambdaExp`.
 *
 * @type {FunctionValue}
 */
export const functionValue = () => ['function']

/**
 * A callback by name, one of `callbacks`: a function with a body, for
 * the member functions that call one.
 *
 * @type {(name: CallbackName) => Callback}
 */
export const callback = name => () => ['callback', name]

/**
 * A function that answers `v` whatever it is given: `(...a) => v`. Where a
 * `callback` reads its arguments, this one ignores them, for the cases
 * whose function is called with none — a conversion calling an object's
 * own `toString` or `valueOf`. `returns(unreached)` throws when called.
 *
 * Its body is lowered where nothing is shared, so a `ref` in `v` is refused:
 * the lowering shares no node across a function boundary.
 *
 * @type {(v: Value) => Returns}
 */
export const returns = v => () => ['returns', v]

/**
 * The `host` reason of a case whose `expected` is a function's text:
 * `nanvm-lib` answers the FunctionalScript writer's, and the host evaluator
 * its own closure's source.
 */
export const functionText = 'the host renders its own function text'

/**
 * The case must throw. Valid only as a case's `expected`.
 *
 * @type {Throws}
 */
export const throws = () => ['throw']

/**
 * One of `data.shared`'s values, so the same node — and hence the same
 * object — reaches every `ref` to that name.
 *
 * @type {(name: string) => Ref}
 */
export const ref = name => () => ['ref', name]

/**
 * An operand the operation must not establish. Lowers to
 * `unreachedExp`, an operation that throws when established, so a
 * case's value proves the operand was left alone — `false && unreached` is
 * `false` on both sides only because neither establishes the right operand.
 *
 * @type {Unreached}
 */
export const unreached = () => ['unreached']
