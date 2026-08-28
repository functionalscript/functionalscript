/**
 * Type-level API for the shared operator test data.
 *
 * The data described here is the single source of truth for operator
 * behaviour: [`proof.f.mjs`](./proof.f.mjs) runs it against a standard
 * JavaScript engine, and [`rust/module.f.mjs`](./rust/module.f.mjs) prints it
 * as the Rust tests in [`test/generated.rs`](./test/generated.rs).
 */

/**
 * A value under test, written as itself.
 *
 * The shape follows `fjs/rtti`, where a constant is its own schema and a
 * thunk describes anything that needs a tag: `2.3`, `'a'`, `12n`, `[1, 2]`,
 * and `{ a: 1 }` mean exactly what they look like, and the only tagged forms
 * are the ones a literal cannot express — see {@link Special}.
 *
 * Writing operands as plain JavaScript is what makes the corpus readable
 * (`args: [[2.3]], expected: 2.3` rather than a tree of constructor calls) and
 * costs nothing: both consumers already have to walk the value, and `typeof`
 * plus `Array.isArray` recovers everything a tag would have carried.
 */
export type Value = Const | Special

/** A value that is its own description. */
export type Const =
    | null
    | undefined
    | boolean
    | number
    | string
    | bigint
    | readonly Value[]
    | Struct

/** An object value. Property order is the order the Rust printer emits. */
export type Struct = { readonly [k in string]?: Value }

/**
 * Something no literal can express, described by a thunk.
 *
 * A function in the data is therefore always a *description*, never a value
 * that happens to be a function — `functionValue` is how the data says "a
 * function".
 */
export type Special = () => Info

/**
 * What a {@link Special} describes.
 *
 * - `function` — a function value. Every operator here coerces one through
 *   `ToPrimitive`, which never inspects it, so there is nothing to carry.
 * - `ref` — one of the {@link Eq} `shared` values, so the *same* object
 *   reaches both sides of a comparison.
 * - `throw` — not a value at all: the case must throw. Valid only as a
 *   {@link Case}'s `expected`.
 */
export type Info =
    | readonly ['function']
    | readonly ['ref', string]
    | readonly ['throw']

/** The operators covered by the shared data. */
export type Op = 'unaryPlus' | 'unaryMinus' | 'mul' | 'stringCoercion'

/**
 * One operator test case.
 *
 * `expected` is compared with `Object.is`, so `NaN` matches `NaN` and `0` does
 * not match `-0`; `throws` there means the operation must throw, and the
 * exception value — being engine-specific — is not part of the data.
 *
 * `rust` marks a case `nanvm-lib` does not implement yet: the value is the
 * reason, the generated Rust keeps the case as a commented-out `TODO`, and
 * the JavaScript proof still runs it. Removing the property is what turns the
 * case on for Rust — the gap list is data, not prose in a README.
 */
export type Case = {
    readonly name: string
    readonly args: readonly Value[]
    readonly expected: Value
    readonly rust?: string
}

/**
 * The cases of one operator.
 *
 * `commutative` additionally checks every case with its arguments swapped,
 * which is what the hand-written tests did for `*`.
 */
export type Group = {
    readonly op: Op
    readonly commutative?: boolean
    readonly cases: readonly Case[]
}

/** One strict-equality (`===`) case; `eq` is the expected result. */
export type EqCase = {
    readonly name: string
    readonly name2?: string
    readonly a: Value
    readonly b: Value
    readonly eq: boolean
    readonly rust?: string
}

/**
 * Strict-equality cases plus the values they share.
 *
 * Equality of arrays and objects is reference equality in both JavaScript and
 * `nanvm-lib`, so a case can only express "the same object" by naming a value
 * in `shared` and reaching it with a `ref`.
 */
export type Eq = {
    readonly shared: Struct
    readonly cases: readonly EqCase[]
}

/** The whole shared test corpus. */
export type Data = {
    readonly eq: Eq
    readonly groups: readonly Group[]
}
