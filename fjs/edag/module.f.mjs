/**
 * @module
 *
 * @import { Assert } from '../asserts/types.ts'
 * @import {
 *  Check,
 *  Args,
 *  Array,
 *  Call,
 *  Exp,
 *  Primitive,
 *  Property,
 *  NumberCast,
 *  PropertyAccessor,
 *  Object,
 *  PropertyCall,
 * } from './types.ts'
 * @import { Phantom } from '../types/phantom/types.ts'
 */

import {
    bigint,
    boolean,
    number as number,
    or,
    string,
    array as rttiArray,
} from "../types/rtti/module.f.mjs";

/**
 * `args`, `propertyAccessor`, `call`, and `propertyCall` are rtti tuple
 * schemas, and tuple schemas are intentionally *open* — see "Structs and
 * tuples are open" in `../types/rtti/README.md`. `validate`/`parse` only
 * visit the positions a schema declares, so a value with a trailing extra —
 * `['args', 'ignored']`, `['.', 'a', 'b', 'extra']` — validates today:
 * `validate` accepts it and leaves it in place, `parse` drops it on the way
 * out. `array` and `object` are open the same way, on their element/entry
 * list rather than the tag.
 *
 * Exact arity for these fixed-shape nodes will matter once EDAG values are
 * content-addressed — two byte sequences for "the same" node must not both
 * validate — but that is future work behind the planned `close` schema form
 * (`../types/rtti/todo/close-type.md`), not implemented here yet.
 *
 * `parse(exp)` is not used here, and should not be, without reading
 * `../types/rtti/todo/identity-aware-parse.md` first: the generic `parse`
 * rebuilds a fresh container per schema position, with no notion that two
 * positions came from the same input reference. For most schemas that is
 * fine — but here, node identity between operand positions is part of the
 * value's meaning (`["[]", x, x]` vs. two separately-built copies are
 * different functions), so reading an `exp` value back from a serialized or
 * otherwise untrusted form needs an identity-preserving reader, which does
 * not exist yet.
 *
 * `validate(exp)` does not check for cycles, and a genuinely cyclic value
 * (an array that is its own ancestor) would recurse until `RangeError`
 * rather than returning a validation error. Deliberately not handled here:
 * FunctionalScript itself cannot construct a self-referential value — there
 * is no mutation, so nothing can make an array contain itself — and neither
 * can any realistic serialized form (JSON, or a future byte format) without
 * its own explicit back-reference encoding, which is exactly the missing
 * piece `identity-aware-parse.md` above tracks. So a cyclic value can only
 * reach `validate(exp)` from a caller already writing JS to construct one
 * directly, at which point they already have arbitrary code execution and a
 * `RangeError` here is not the interesting attack. If `edag` ever gains a
 * wire format with back-references, cycles become reachable through that
 * channel too, and this reasoning should be revisited then.
 */

// Exp

/**
 * @type {() => readonly['or',
 *  typeof primitive,
 *  typeof array,
 *  typeof object,
 *  typeof args,
 *  typeof numberCast,
 *  typeof propertyAccessor,
 *  typeof call,
 *  typeof propertyCall
 * ]}
 */
export const exp = () => (['or',
    primitive,
    array,
    object,
    args,
    numberCast,
    propertyAccessor,
    call,
    propertyCall,
])

/** @typedef {Assert<Check<Exp, typeof exp>>} _ExpAssert */

// Primitive

export const primitive = or(undefined, null, boolean, number, string, bigint)

/** @typedef {Assert<Check<Primitive, typeof primitive>>} _Primitive */

/**
 * `['[]', ...elements]` and `['{}', ...properties]` — the flat, variadic
 * spelling the EDAG spec uses — cannot be written as an rtti schema. A `Tuple`
 * (see `Const` in `../types/rtti/types.ts`) declares one schema per position,
 * so it can pin a fixed prefix like the `'[]'`/`'{}'` tag, but the `Type` ADT
 * has no variant for "then any number of further positions, all matching
 * this one schema" — `array`/`record` say exactly that, but only as their
 * *own* single schema position, not spread inline into a bigger tuple's
 * remaining slots. So `array` and `object` below nest the variadic part in
 * that second position instead: `['[]', [elem, elem, ...]]` and
 * `['{}', [prop, prop, ...]]` — one array/record position holding the whole
 * tail, rather than a tail of positions.
 */

// Array

export const array = /** @type {const} */(['[]', rttiArray(exp)])

// Property

/**
 * The key stays `exp`, not narrowed to a string constant. `{ ["sss" + 3]: x }`
 * is valid JS — the key is a computed expression, coerced via
 * `ToPropertyKey` at runtime, no different in kind from `array[5]` needing
 * `index` (below) to accept more than a bare string. A key position that
 * only admitted string constants would describe less than the value model
 * actually is.
 *
 * This deliberately does not follow `edag-stage1-discussion.md` subjects 4
 * and 5, which state "current validation nevertheless accepts only
 * string-constant keys" as a decided rule — that text is being revised to
 * match this schema instead, not the other way around. Today's DJS compiler
 * only ever emits a trivial computed-key form anyway (`{ ["sss"]: x }`, not
 * `{ ["sss" + 3]: x }`), but the schema describes the value model, not the
 * compiler's current output, and per subject 1: "the `Function` constructor
 * accepts an `Any` from anywhere, so 'the FJS compiler would never emit
 * that' is never an admissible argument" for narrowing a schema.
 */
export const property = /** @type {const} */([':', exp, exp])

/** @typedef {Assert<Check<Property, typeof property>>} _Property */

// Object — same nesting as `array` above, one position further in

export const object = /** @type {const} */(['{}', rttiArray(property)])

/** @typedef {Assert<Check<Object, typeof object>>} _Object */

// Args

export const args = /** @type {const} */(['args'])

/** @typedef {Assert<Check<Args, typeof args>>} _Args */

// Number

const _numberCast = /** @type {const} */(['Number', exp])

/** @type {Phantom<typeof _numberCast, NumberCast>} */
export const numberCast = _numberCast

/**
 * @typedef {Assert<Check<NumberCast, typeof _numberCast>>} _NumberCast0
 * @typedef {Assert<Check<NumberCast, typeof numberCast>>} _NumberCast1
 */

// Index

/**
 * A property/index operand: a plain `string` or `number` key, or a `Number`
 * cast around a computed `exp` (`arr[i]`, where `i` is itself an expression).
 *
 * This schema only restricts *shape* — a `string` here can still be
 * `'constructor'`, `'__proto__'`, or any other name that is unsafe to use as
 * a real property accessor. rtti's `Type` ADT has no negation — no way to
 * say "any string except these" — so this can't be stated as part of the
 * schema today; see `../types/rtti/todo/excluded-string-values.md`. It does
 * not describe everything a consumer needs: validating an untrusted EDAG
 * before evaluating it requires an additional denylist check on top of this
 * schema (not implemented here yet), not a change to it.
 */
export const index = or(numberCast, string, number)

// Property Accessor

const _propertyAccessor = /** @type {const} */(['.', exp, index])

/**
 * ```js
 * exp0[exp1]
 * exp0.exp1
 * ```
 *
 * @type {Phantom<typeof _propertyAccessor, PropertyAccessor>}
 */
export const propertyAccessor = _propertyAccessor

/**
 * @typedef {Assert<Check<PropertyAccessor, typeof _propertyAccessor>>} _PropertyAccessor0
 * @typedef {Assert<Check<PropertyAccessor, typeof propertyAccessor>>} _PropertyAccessor1
 */

// Call

const _call = /** @type {const} */(['()', exp, exp])

/**
 * ```js
 * exp0(exp1)
 * ```
 *
 * @type {Phantom<typeof _call, Call>}
 */
export const call = _call

/**
 * @typedef {Assert<Check<Call, typeof _call>>} _Call0
 * @typedef {Assert<Check<Call, typeof call>>} _Call1
 */

// Property Call

const _propertyCall = /** @type {const} */(['.()', exp, index, exp])

/**
 * ```js
 * exp0[exp1](exp2)
 * ```
 *
 * @type {Phantom<typeof _propertyCall, PropertyCall>}
 */
export const propertyCall = _propertyCall

/**
 * @typedef {Assert<Check<PropertyCall, typeof _propertyCall>>} _PropertyCall0
 * @typedef {Assert<Check<PropertyCall, typeof propertyCall>>} _PropertyCall1
 */
