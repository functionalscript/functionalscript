/**
 * Type-level API for the shared operator test data.
 *
 * The data described here is the single source of truth for operator
 * behaviour: [`proof.f.mjs`](./proof.f.mjs) runs it against a standard
 * JavaScript engine, and [`rust/module.f.mjs`](./rust/module.f.mjs) prints it
 * as the Rust tests in [`test/generated.rs`](./test/generated.rs).
 *
 * Operation identity and operand contract are **not** defined here: they come
 * from [`fjs/edag`](../edag/README.md), the data model of record, through
 * {@link Op1Id} and {@link Op2Id}. Everything else — case names, inputs,
 * expectations, and the test-only markers — is the corpus's own.
 *
 * @module
 */

import type { Assert } from '../asserts/types.ts'
import type { Exp, Op1Id, Op2, Op2Id } from '../edag/types.ts'
import type { Tuple } from '../types/array/types.ts'
import type { Equal } from '../types/ts/types.ts'

/**
 * A value under test, written as itself — anywhere, nesting included.
 *
 * `functionValue` is deliberately **not** here and `throws` is not either:
 * each is legal in exactly one position, and {@link Operand} and
 * {@link Expectation} are those positions. Admitting them everywhere is what
 * would let a corpus case be written that no consumer can lower — a
 * `functionValue` inside an array operand, or as an `eq` side — and be a type
 * error nowhere.
 *
 * The shape follows `fjs/rtti`, where a constant is its own schema and a
 * thunk describes anything that needs a tag: `2.3`, `'a'`, `12n`, `[1, 2]`,
 * and `{ a: 1 }` mean exactly what they look like, and the only tagged forms
 * are the ones a literal cannot express — see {@link Special}.
 *
 * Writing operands as plain JavaScript is what makes the corpus readable
 * (`args: [2.3], expected: 2.3` rather than a tree of constructor calls) and
 * costs nothing: `fjs/nanvm/module.f.mjs` lowers a value to the EDAG
 * expression that denotes it, so `typeof` plus `Array.isArray` recovers
 * everything a tag would have carried.
 */
export type Value = Const | Ref

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
export type Special<I extends Info> = () => I

/**
 * What a {@link Special} describes. Each of the three is its own type below,
 * so where it may appear is a type and not a comment.
 */
export type Info =
    | readonly ['function']
    | readonly ['ref', string]
    | readonly ['throw']

/**
 * A function value. Every operator here coerces one through `ToPrimitive`,
 * which never inspects it, so there is nothing to carry.
 *
 * Legal only as a whole {@link Operand}: it is the one operand the corpus
 * declines to lower, and the escape that handles it reads the operand, not a
 * value inside it.
 */
export type FunctionValue = Special<readonly ['function']>

/**
 * One of the {@link Eq} `shared` values, so the *same* node — and hence the
 * same object — reaches both sides of a comparison. Legal anywhere a
 * {@link Value} is, nesting included: the lowering resolves it in place.
 */
export type Ref = Special<readonly ['ref', string]>

/**
 * Not a value at all: the case must throw. Legal only as a {@link Case}'s
 * `expected` — see {@link Expectation}.
 */
export type Throws = Special<readonly ['throw']>

/**
 * What a case applies its operation to: a value, or the function escape.
 *
 * The escape is whole-operand by construction. A `functionValue` nested in an
 * array or an object would have to be built by a second, recursive
 * value-to-JavaScript and value-to-Rust walk in each consumer — the very
 * duplication deriving one expression removes — so the type does not admit
 * one.
 */
export type Operand = Value | FunctionValue

/** What a case expects: a value, or `throws`. */
export type Expectation = Value | Throws

/**
 * The operation a group applies, as both consumers name it: a canonical EDAG
 * id, or the NaNVM-only name of a group that has none.
 */
export type OpId = Op1Id | Op2Id | NonEdagGroup['nanvmOp']

/**
 * One operator test case, over `N` operands.
 *
 * The operand count is not annotated here — it is fixed by the group the case
 * belongs to, and a group's operand count is which EDAG vocabulary its `op`
 * is in. So a unary operation given two arguments is a type error rather than
 * a case that runs.
 *
 * `expected` is compared with `Object.is`, so `NaN` matches `NaN` and `0` does
 * not match `-0`; `throws` there means the operation must throw, and the
 * exception value — being engine-specific — is not part of the data. It
 * describes the test's outcome, not the program under test, so it is never
 * part of the case's derived expression.
 *
 * `rust` marks a case `nanvm-lib` does not implement yet: the value is the
 * reason, the generated Rust keeps the case as a commented-out `TODO`, and
 * the JavaScript proof still runs it. Removing the property is what turns the
 * case on for Rust — the gap list is data, not prose in a README.
 */
export type Case<N extends number> = {
    readonly name: string
    readonly args: Tuple<N, Operand>
    readonly expected: Expectation
    readonly rust?: string
}

/** The cases of one unary EDAG operation. */
export type Group1 = {
    readonly op: Op1Id
    readonly cases: readonly Case<1>[]
}

/**
 * The cases of one binary EDAG operation.
 *
 * `commutative` additionally checks every case with its arguments swapped,
 * which is what the hand-written tests did for `*`. It lives here and not on
 * {@link Group1}, so it is binary-only by construction.
 */
export type Group2 = {
    readonly op: Op2Id
    readonly commutative?: boolean
    readonly cases: readonly Case<2>[]
}

/**
 * The visible exception: an operation with no canonical EDAG id yet.
 *
 * The field is deliberately not `op`, so a NaNVM-only name can never mix into
 * the canonical id unions.
 *
 * - `unaryPlus` — the EDAG has no unary `+` — and this arm is deleted when
 *   [replace-unary-plus-with-number](../../nanvm-lib/todo/replace-unary-plus-with-number.md)
 *   moves that group to `Number`; the type itself stays, since the other
 *   arms have no such migration.
 * - `ternary` (`?:`) — the EDAG has no conditional-expression node at all
 *   yet, so this is the corpus's one ternary group; every other `Group`
 *   variant is unary or binary because the EDAG vocabulary it draws from is.
 * - `typeof` — the EDAG has no `typeof` node either.
 */
export type NonEdagGroup =
    | { readonly nanvmOp: 'unaryPlus'; readonly cases: readonly Case<1>[] }
    | { readonly nanvmOp: 'ternary'; readonly cases: readonly Case<3>[] }
    | { readonly nanvmOp: 'typeof'; readonly cases: readonly Case<1>[] }

export type Group = Group1 | Group2 | NonEdagGroup

// An operand count is a type error rather than a case that runs: a group's
// count is which EDAG vocabulary its id is in, and `Case<N>` carries it.
//
// These are here and not in `proof.f.mjs` because a `@typedef` inside a
// function body is never checked — TypeScript does not evaluate the
// constraint of a declaration nothing references, so the same six assertions
// written there passed with any claim at all. A module-scope alias in a
// `.ts` file is checked; `../types/array/types.ts` is the precedent.

type _Unary = Assert<Equal<Case<1>['args'], readonly [Operand]>>
type _Binary = Assert<Equal<Case<2>['args'], readonly [Operand, Operand]>>
type _Ternary = Assert<Equal<Case<3>['args'], readonly [Operand, Operand, Operand]>>
type _NotWidened = Assert<Equal<Case<2> extends Case<1> ? true : false, false>>
type _NotNarrowed = Assert<Equal<Case<1> extends Case<2> ? true : false, false>>
type _Op1Groups = Assert<Equal<Group1['cases'], readonly Case<1>[]>>
type _Op2Groups = Assert<Equal<Group2['cases'], readonly Case<2>[]>>

// Where each thunk may appear, as a type rather than as a sentence: a
// `functionValue` is a whole operand or nothing, and `throws` is an
// expectation or nothing.
type _NoNestedFunction = Assert<Equal<FunctionValue extends Value ? true : false, false>>
type _NoThrowsOperand = Assert<Equal<Throws extends Operand ? true : false, false>>
type _NoFunctionExpected = Assert<Equal<FunctionValue extends Expectation ? true : false, false>>

/**
 * What a case denotes, as the consumers receive it.
 *
 * `exp` is the EDAG expression the case is: the group's operation applied to
 * its lowered operands. `escape` marks the cases the corpus does not lower — a
 * `functionValue` operand, which `['=>', ['[]', []], body]` would spell at the
 * cost of establishing a closure in both consumers, or a
 * {@link NonEdagGroup}, which has no id to apply — so a consumer takes the
 * direct-value path knowingly rather than by falling through.
 */
export type Lowered =
    | readonly ['exp', Exp]
    | readonly ['escape']

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
 * in `shared` and reaching it with a `ref`. That is EDAG sharing exactly: one
 * node referenced from several places, which is why a `ref` lowers to the
 * same node and not to a copy.
 */
export type Eq = {
    readonly shared: Struct
    readonly cases: readonly EqCase[]
}

/** A node the `eq` section shares, and the name it is bound to. */
export type SharedNode = readonly [string, Exp]

/**
 * The `eq` section lowered: its shared values as nodes, and every case beside
 * the expression it denotes.
 *
 * The two come back together because they are one lowering — a `ref` resolves
 * to the very node bound in `shared`, so `a: ref('x'), b: ref('x')` is one
 * node reached twice and not two equal ones. A consumer that took them from
 * separate calls would have neither.
 */
export type LoweredEq = {
    readonly shared: readonly SharedNode[]
    readonly cases: readonly (readonly [EqCase, Op2])[]
}

/** The whole shared test corpus. */
export type Data = {
    readonly eq: Eq
    readonly groups: readonly Group[]
}
