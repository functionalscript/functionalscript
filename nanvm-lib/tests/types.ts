/**
 * Type-level API for the shared operator test data.
 *
 * The data described here is the single source of truth for operator
 * behaviour: [`proof.f.mjs`](./proof.f.mjs) runs it against a standard
 * JavaScript engine, and [`rust/module.f.mjs`](./rust/module.f.mjs) prints it
 * as the Rust tests in [`test/generated.rs`](./test/generated.rs).
 *
 * @module
 */

/**
 * A JavaScript value both a JS engine and `nanvm-lib` can construct.
 *
 * It is a tagged tree rather than a plain JavaScript value because the two
 * consumers need different things from it: the JS side builds the value, the
 * Rust printer needs the tag to pick a `nanvm-lib` constructor. A plain value
 * would also lose the distinction the printer depends on — `undefined` versus
 * a missing property, and `function` versus anything else.
 */
export type Value =
    | readonly ['null']
    | readonly ['undefined']
    | readonly ['boolean', boolean]
    | readonly ['number', number]
    | readonly ['string', string]
    | readonly ['bigint', bigint]
    | readonly ['array', readonly Value[]]
    | readonly ['object', readonly Entry[]]
    | readonly ['function']

/** A property of an `['object', ...]` value, or a named shared value. */
export type Entry = readonly [string, Value]

/**
 * What applying an operator to a case's arguments should produce.
 *
 * `['value', v]` compares with `Object.is` semantics, so `NaN` matches `NaN`
 * and `0` does not match `-0`. `['throw']` only requires *that* the operation
 * throws: the exception value is engine-specific, so it is not part of the
 * shared data.
 */
export type Expected =
    | readonly ['value', Value]
    | readonly ['throw']

/** The operators covered by the shared data. */
export type Op = 'unaryPlus' | 'unaryMinus' | 'mul' | 'stringCoercion'

/**
 * One operator test case.
 *
 * `rust` marks a case `nanvm-lib` does not implement yet: the value is the
 * reason, the generated Rust keeps the case as a commented-out `TODO`, and
 * the JavaScript proof still runs it. Removing the property is what turns the
 * case on for Rust — the gap list is data, not prose in a README.
 */
export type Case = {
    readonly name: string
    readonly args: readonly Value[]
    readonly expected: Expected
    readonly rust?: string
}

/**
 * The cases of one operator.
 *
 * `commutative` additionally checks every binary case with its arguments
 * swapped, which is what the hand-written tests did for `*`.
 */
export type Group = {
    readonly op: Op
    readonly commutative?: boolean
    readonly cases: readonly Case[]
}

/**
 * An operand of a strict-equality case: either a value constructed for this
 * case alone, or `['ref', name]` — one of the `shared` values, so the same
 * object reaches both sides of the comparison.
 */
export type Operand = Value | readonly ['ref', string]

/** One strict-equality (`===`) case; `eq` is the expected result. */
export type EqCase = {
    readonly name: string
    readonly a: Operand
    readonly b: Operand
    readonly eq: boolean
    readonly rust?: string
}

/**
 * Strict-equality cases plus the values they share.
 *
 * Equality of arrays and objects is reference equality in both JavaScript and
 * `nanvm-lib`, so a case can only express "the same object" by naming a value
 * in `shared` and referring to it from both operands.
 */
export type Eq = {
    readonly shared: readonly Entry[]
    readonly cases: readonly EqCase[]
}

/** The whole shared test corpus. */
export type Data = {
    readonly eq: Eq
    readonly groups: readonly Group[]
}
