/**
 * Type-level API for the shared operator test data.
 *
 * The data described here is the single source of truth for operator
 * behaviour: [`proof.f.mjs`](./proof.f.mjs) runs it against a standard
 * JavaScript engine, and [`rust/module.f.mjs`](./rust/module.f.mjs) prints it
 * as the Rust tests in `nanvm-lib/tests/test/gen.corpus/`.
 *
 * Operation identity and operand contract are **not** defined here: they come
 * from [`fjs/edag`](../edag/README.md), the data model of record, through
 * {@link Op1Id}, {@link Op2Id}, {@link Op12Id} and {@link Op3Id} — one
 * vocabulary per operand count, and one for the two tags legal at both of the
 * first two. Everything else — case names, inputs, expectations, and the
 * test-only markers — is the corpus's own.
 *
 * @module
 */

import type { Assert } from '../asserts/types.ts'
import type { Exp, Op12Id, Op1Id, Op2, Op2Id, Op3Id } from '../edag/types.ts'
import type { AllowedCall } from '../js/prototype/types.ts'
import type { FixedArray } from '../types/array/types.ts'
import type { Equal } from '../types/ts/types.ts'

/**
 * A value under test, written as itself — anywhere, nesting included.
 *
 * `throws` is deliberately **not** here: it is legal in exactly one position,
 * and {@link Expectation} is that position. Admitting it everywhere is what
 * would let a corpus case be written that no consumer can lower and be a
 * type error nowhere. `functionValue` *is* here — it lowers to a closure like
 * any other value lowers to its node, so it may sit anywhere a value may,
 * an array or object operand included.
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
export type Value = Const | Ref | FunctionValue | Callback | Unreached

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
 * What a {@link Special} describes. Each of the five is its own type below,
 * so where it may appear is a type and not a comment.
 */
export type Info =
    | readonly ['function']
    | readonly ['callback', CallbackName]
    | readonly ['ref', string]
    | readonly ['throw']
    | readonly ['unreached']

/**
 * A function value. Every operator here coerces one through `ToPrimitive`,
 * which never inspects it, so there is nothing to carry: it lowers to
 * `() => undefined`, the smallest closure, which `amnesia` establishes and
 * the Rust printer renders as the harness's one function value. Legal
 * anywhere a {@link Value} is.
 *
 * One thing about a function is *not* shared data: its string form. JS
 * gives a closure's source text, engine-specific, and `nanvm-lib`'s
 * `fn_to_string` gives the placeholder `"function"`, so a case whose result
 * depends on it — `String` of a function, `+` with one, or either applied to
 * an array or object holding one, since their `ToPrimitive` stringifies the
 * elements — would test two different values. Such a case is not written
 * here: the `String` and binary `+` groups have no function case, and the
 * JS-only half lives in `proof.f.mjs`'s `jsOnly.functionToString`. Every
 * other coercion of a function, nested or not, agrees on both sides
 * (`NaN`, `false`, `'function'`, the function itself), which is what the
 * function cases in the other groups exercise.
 */
export type FunctionValue = Special<readonly ['function']>

/**
 * The names of the corpus's callbacks, each a small function a member
 * function such as `map` is handed — its body in `fjs/nanvm/module.f.mjs`'s
 * `callbacks`, with its JavaScript spelling.
 */
export type CallbackName = 'args' | 'first' | 'prop' | 'double' | 'add' | 'pair' | 'ascending' | 'descending'

/**
 * A callback by name: a real function with a body, where a
 * {@link FunctionValue} is only ever the smallest one. Both consumers
 * establish it as the `=>` node it lowers to — `amnesia` as a host
 * function, the Rust printer as a `static_function` — so a case can hand
 * one to `map` and see what it answers. Legal anywhere a {@link Value} is.
 */
export type Callback = Special<readonly ['callback', CallbackName]>

/**
 * One of {@link Data}'s `shared` values, so the *same* node — and hence the
 * same object — reaches every `ref` to that name. Legal anywhere a
 * {@link Value} is, nesting included: the lowering resolves it in place.
 */
export type Ref = Special<readonly ['ref', string]>

/**
 * Not a value at all: the case must throw. Legal only as a {@link Case}'s
 * `expected` — see {@link Expectation}.
 */
export type Throws = Special<readonly ['throw']>

/**
 * An operand the operation must not establish: `false && unreached` is
 * `false` only if `&&` leaves its right operand alone. It lowers to an
 * operation that throws when established — `1n / 0n`, a `RangeError` in
 * JavaScript and an `Err` in `nanvm-lib` — so on both sides the case's own
 * value is the proof: a lazy operand established by mistake throws, and the
 * case fails where it expected a value. Legal anywhere a {@link Value} is,
 * since it is one; in an eager position it is established, and the case
 * throws, which is only ever an `expected: throws` case written the long
 * way. Its use is the lazy positions — `&&`/`||`/`??`'s right operand and
 * either arm of `?:` — where the Rust printer prints it inside the thunk
 * `nanvm-lib` establishes at most once (`fjs/edag/rust/module.f.mjs`,
 * `lazy`). Not in {@link Data}'s `shared`, at any depth: a shared value is
 * established before any case on both sides, so `sharedExp` refuses one
 * holding this — the type admits it there only because {@link Struct} is
 * also an object operand's shape.
 */
export type Unreached = Special<readonly ['unreached']>

/**
 * What a case expects: a value, or `throws`.
 *
 * Compared structurally (`fjs/types/object/structurally_same`): `Object.is`
 * at every leaf, so `NaN` matches `NaN` and `0` does not match `-0`, and
 * arrays and objects by their elements and properties, since a result such
 * as `map`'s is a fresh array no expectation can be the same object as.
 * Identity is a case's own claim, made with `ref` and `===`.
 *
 * Not a function: a function is compared by identity, and a closure built
 * by the lowering is never the same object as one built by the case, so
 * such an expectation could not be met. Nesting is not policed the same
 * way, so only the whole-value position is excluded.
 */
export type Expectation = Const | Ref | Throws

/** The operation a group applies: a canonical EDAG id, and nothing else. */
export type OpId = Op1Id | Op2Id | Op12Id | Op3Id

/**
 * One operator test case, over `N` operands.
 *
 * The operand count is not annotated here — it is fixed by the group the case
 * belongs to, and a group's operand count is which EDAG vocabulary its `op`
 * is in (or, for an `Op12Id`, the group's own `arity` — see
 * {@link Group12}). So a unary operation given two arguments is a type error
 * rather than a case that runs.
 *
 * `expected` is compared structurally, `Object.is` at the leaves, so `NaN`
 * matches `NaN` and `0` does not match `-0` (see {@link Expectation});
 * `throws` there means the operation must throw, and the
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
    readonly args: FixedArray<N, Value>
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
 * The cases of one operation whose id is legal at both arities — `+` or `-`,
 * the EDAG's `Op12Id` vocabulary.
 *
 * `arity` is an annotation here and nowhere else. For every other group the
 * operand count is which vocabulary the id is in, and an `Op12Id` is in the
 * one vocabulary that fixes nothing — `-` at one operand is negation, at two
 * subtraction — so the group says. Each arm still carries the matching
 * `Case<N>`, so a case with the wrong count is a type error rather than a
 * case that runs, exactly as for {@link Group1} and {@link Group2}.
 */
export type Group12 =
    | { readonly op: Op12Id; readonly arity: 1; readonly cases: readonly Case<1>[] }
    | { readonly op: Op12Id; readonly arity: 2; readonly cases: readonly Case<2>[] }

/** The cases of one ternary EDAG operation — `?:`, the only one there is. */
export type Group3 = {
    readonly op: Op3Id
    readonly cases: readonly Case<3>[]
}

/**
 * One method-call test case: `args[0]` is the receiver and the rest are the
 * call's arguments, so `{ args: [[1, 2], 0] }` in the `at` group is
 * `[1, 2].at(0)`. The argument count is the case's own, as a call's is, and
 * is observable — `lastIndexOf(x)` and `lastIndexOf(x, undefined)` differ —
 * so nothing pads or trims it.
 */
export type MethodCase = {
    readonly name: string
    readonly args: readonly [Value, ...(readonly Value[])]
    readonly expected: Expectation
    readonly rust?: string
}

/**
 * The cases of one built-in member function, `receiver.method(...args)`,
 * lowered to the chain node a compiled call is:
 * `['.', receiver, method, ['|()', ['[]', args]]]` (`fjs/edag/README.md`,
 * Chains). `method` is a name a module may call
 * (`fjs/js/prototype`'s `allowedCalls`), so a misspelt or refused name is a
 * type error rather than a case that tests a `TypeError`.
 */
export type MethodGroup = {
    readonly method: AllowedCall
    readonly cases: readonly MethodCase[]
}

/** A group whose `op` is an EDAG operation, as against a {@link MethodGroup}. */
export type OperatorGroup = Group1 | Group2 | Group12 | Group3

export type Group = OperatorGroup | MethodGroup

/** A case of any group, as a consumer walking `data.groups` holds one. */
export type AnyCase = Case<1> | Case<2> | Case<3> | MethodCase

// An operand count is a type error rather than a case that runs: a group's
// count is which EDAG vocabulary its id is in, and `Case<N>` carries it.
//
// These are here and not in `proof.f.mjs` because a `@typedef` there is
// checked only where a statement follows it in the same block: a JSDoc
// comment binds to the next statement, and one with nothing after it is
// never bound at all. Written as the tail of a proof entry, the same six
// assertions passed with any claim. A module-scope alias in a `.ts` file is
// resolved either way; `../types/array/types.ts` is the precedent and
// `../AGENTS.md` §1.4 states the rule.

type _Unary = Assert<Equal<Case<1>['args'], readonly [Value]>>
type _Binary = Assert<Equal<Case<2>['args'], readonly [Value, Value]>>
type _Ternary = Assert<Equal<Case<3>['args'], readonly [Value, Value, Value]>>
type _NotWidened = Assert<Equal<Case<2> extends Case<1> ? true : false, false>>
type _NotNarrowed = Assert<Equal<Case<1> extends Case<2> ? true : false, false>>
type _Op1Groups = Assert<Equal<Group1['cases'], readonly Case<1>[]>>
type _Op2Groups = Assert<Equal<Group2['cases'], readonly Case<2>[]>>
type _Op3Groups = Assert<Equal<Group3['cases'], readonly Case<3>[]>>
// An `Op12` group's arm, not its id, fixes the count — and each arm does.
type _Op12Unary = Assert<Equal<Extract<Group12, { arity: 1 }>['cases'], readonly Case<1>[]>>
type _Op12Binary = Assert<Equal<Extract<Group12, { arity: 2 }>['cases'], readonly Case<2>[]>>

// Where each thunk may appear, as a type rather than as a sentence: a
// `functionValue` and an `unreached` are values like any other, `throws` is
// an expectation or nothing, and neither a function nor an `unreached` is an
// expectation.
type _FunctionIsValue = Assert<Equal<FunctionValue extends Value ? true : false, true>>
type _CallbackIsValue = Assert<Equal<Callback extends Value ? true : false, true>>
type _NoCallbackExpected = Assert<Equal<Callback extends Expectation ? true : false, false>>
type _UnreachedIsValue = Assert<Equal<Unreached extends Value ? true : false, true>>
type _NoThrowsValue = Assert<Equal<Throws extends Value ? true : false, false>>
type _NoFunctionExpected = Assert<Equal<FunctionValue extends Expectation ? true : false, false>>
type _NoUnreachedExpected = Assert<Equal<Unreached extends Expectation ? true : false, false>>

/** A value the corpus shares, and the name it is bound to. */
export type SharedNode = readonly [string, Exp]

/** The whole shared test corpus. */
export type Data = {
    /**
     * The values two operands may both reach, by name through a `ref`.
     *
     * Equality of arrays and objects is reference equality in both JavaScript
     * and `nanvm-lib`, so a case can only express "the same object" this way.
     * That is EDAG sharing exactly: one node referenced from several places,
     * which is why a `ref` lowers to the same node and not to a copy. Only
     * the `'==='` group has an operand that reaches one.
     */
    readonly shared: Struct
    readonly groups: readonly Group[]
}
