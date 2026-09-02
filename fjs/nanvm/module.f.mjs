/**
 * The single source of truth for `nanvm-lib` operator behaviour.
 *
 * Every operator case is named once here, with the arguments and the expected
 * result written as ordinary JavaScript values. Two consumers read it, so a
 * new case is written once and checked twice:
 *
 * - [`proof.f.mjs`](./proof.f.mjs) evaluates each case against a standard
 *   JavaScript engine, proving that the expectations describe JavaScript.
 * - [`rust/module.f.mjs`](./rust/module.f.mjs) prints each case as Rust,
 *   producing `nanvm-lib/tests/test/generated.rs`, which runs the same case
 *   against `nanvm-lib`.
 *
 * Beside the data are the format's **constructors** (`functionValue`, `ref`,
 * `throws`), its **eliminators** (`isThrows`, `isFunctionValue`, `orders`,
 * `opId`, `casesOf`, `arityOf`), and the **lowering** that turns a case into
 * the EDAG expression it denotes (`valueExp`, `caseExp`, `lowerEq`). All
 * three exist so that neither consumer has to re-implement a rule of the
 * corpus format: a rule written twice is a rule that drifts.
 *
 * Operation identity comes from [`fjs/edag`](../edag/README.md) and is not
 * restated here — a group's `op` is an `Op1Id` or an `Op2Id`, and which of
 * the two vocabularies it is in is what fixes the case's operand count.
 *
 * Cases `nanvm-lib` does not implement yet carry a `rust` reason and are
 * emitted as commented-out `TODO`s instead of being silently dropped — the
 * gaps between the two implementations are part of the data.
 *
 * @module
 *
 * @import { Exp, Op1, Op1Id, Op2, Op2Id, Property } from '../edag/types.ts'
 * @import { Case, Data, Eq, Expectation, FunctionValue, Group, Lowered, LoweredEq, OpId, Operand, Ref, SharedNode, Throws, Value } from './types.ts'
 *
 * @example
 *
 * ```js
 * import { data } from './module.f.mjs'
 *
 * data.groups.length // 7
 * ```
 */

import { op1Id } from '../edag/module.f.mjs'
import { validate } from '../rtti/validate/module.f.mjs'

const { entries } = Object

/** Membership in the unary vocabulary, from the schema rather than a copy. */
const isOp1Id = validate(op1Id)

// Constructors — the three things a literal cannot express.

/**
 * A function value.
 *
 * Every operator here coerces a function through `ToPrimitive`, which never
 * inspects it, so which function it is does not matter.
 *
 * @type {FunctionValue}
 */
export const functionValue = () => ['function']

/**
 * The case must throw. Valid only as a case's `expected`.
 *
 * @type {Throws}
 */
export const throws = () => ['throw']

/**
 * One of the `eq` `shared` values, so the same node — and hence the same
 * object — reaches both sides of a comparison.
 *
 * @type {(name: string) => Ref}
 */
export const ref = name => () => ['ref', name]

// Eliminators — the constructors read back, so each rule has one owner.

/**
 * `true` when a case's `expected` is `throws` rather than a value.
 *
 * @param {Expectation} v
 * @returns {v is Throws}
 */
export const isThrows = v => typeof v === 'function' && v()[0] === 'throw'

/**
 * `true` when an operand is `functionValue`, the one operand the corpus
 * declines to lower.
 *
 * A constant function *is* spellable — `['=>', ['[]', []], body]`, since `=>`
 * is an `Op2Id` — but establishing it would drag closure construction into
 * both consumers for cases that never inspect the function. So such a case
 * escapes to the direct-value path instead — see {@link caseExp}.
 *
 * @param {Operand} v
 * @returns {v is FunctionValue}
 */
export const isFunctionValue = v => typeof v === 'function' && v()[0] === 'function'

/**
 * `true` when a group's cases are also checked with their arguments swapped.
 *
 * Only a binary group can carry the flag; the parameter type is what lets any
 * group be asked without narrowing first.
 *
 * @type {(g: { readonly cases: unknown, readonly commutative?: boolean }) => boolean}
 */
const isCommutative = g => g.commutative === true

/**
 * Every argument order a case is checked in: one, or both for a commutative
 * operator.
 *
 * The `Swapped` suffix is a test-*name* convention, so it has exactly one
 * owner — spelled differently in the two consumers, the JavaScript and Rust
 * names for one case would silently diverge.
 *
 * @type {(g: Group) => (c: Case<1> | Case<2>) => readonly (readonly[string, readonly Operand[]])[]}
 */
export const orders = g => c => isCommutative(g)
    ? [[c.name, c.args], [`${c.name}Swapped`, c.args.toReversed()]]
    : [[c.name, c.args]]

/**
 * The operation tag both consumers dispatch on: the group's canonical EDAG
 * id, or the NaNVM-only name of a group that has none.
 *
 * @type {(g: Group) => OpId}
 */
export const opId = g => 'op' in g ? g.op : g.nanvmOp

/**
 * A group's cases, read without first deciding which kind of group it is.
 *
 * The operand count is the point of the three group types, and it is fixed
 * before a consumer gets here; walking the cases does not need it back.
 *
 * @type {(g: Group) => readonly (Case<1> | Case<2>)[]}
 */
export const casesOf = g => g.cases

/**
 * How many operands a group's operation takes.
 *
 * Which vocabulary the id belongs to is what fixes the count — the same rule
 * the group types carry — so this asks the schema rather than a second copy
 * of the vocabulary, and a group with no canonical id is unary because its
 * one inhabitant is. It is the runtime half of what `Group1`/`Group2` say
 * statically, for the consumers that walk `data.groups` and so hold a
 * `Group` whose arm is no longer known.
 *
 * @type {(g: Group) => 1 | 2}
 */
export const arityOf = g => !('op' in g) || isOp1Id(g.op)[0] === 'ok' ? 1 : 2

// Lowering — a case as the EDAG expression it denotes.

/**
 * Lowers a value to the EDAG expression that denotes it.
 *
 * `resolve` supplies the node a `ref` names — the *same* node for every
 * reference, which is what makes `ref` mean EDAG sharing (one node reached
 * from several places) rather than an equal copy. Every other operand gets a
 * fresh node, so a multiply-referenced node in a derived expression is always
 * a `ref` and never an accident of the walk.
 *
 * A `ref` is the only thunk a {@link Value} admits, which is why this walk has
 * no case for the other two: `functionValue` is a whole {@link Operand} that
 * {@link caseExp} escapes before lowering, and `throws` is an
 * {@link Expectation}. Neither is spellable here, so neither is rejected here.
 *
 * @type {(resolve: (name: string) => Exp) => (v: Value) => Exp}
 */
const constExp = resolve => {
    /** @type {(v: Value) => Exp} */
    const f = v => {
        if (typeof v === 'function') { return resolve(v()[1]) }
        if (v === undefined) { return ['undefined'] }
        if (Array.isArray(v)) { return ['[]', v.map(f)] }
        if (typeof v === 'object' && v !== null) {
            return ['{}', entries(v).map(
                ([k, p]) => /** @type {Property} */ ([':', k, f(p)]))]
        }
        return v
    }
    return f
}

/**
 * The expression a value denotes, where nothing is shared. Every operand
 * outside the `eq` section, and every `expected`, is such a value.
 *
 * @type {(v: Value) => Exp}
 */
export const valueExp = constExp(name => { throw ['no shared value here', name] })

/**
 * The expression a case denotes: the group's operation applied to its lowered
 * operands, so `mulCases[0]` is `['*', null, null]`.
 *
 * @type {(g: Group) => (args: readonly Operand[]) => Lowered}
 */
export const caseExp = g => args => {
    // The operand count comes from the group, not from the operands. A
    // `Case<N>` cannot carry the wrong number, but this function is exported
    // and its `args` are a plain array, so a caller can hand over a count the
    // operation does not take — refused here rather than answered with a node
    // that looks like a `Lowered` and fails the `exp` schema.
    const n = arityOf(g)
    if (args.length !== n) { throw ['wrong operand count for', opId(g), args] }
    if (!('op' in g) || args.some(isFunctionValue)) { return ['escape'] }
    // `some` established that no operand is a `FunctionValue`; narrowing an
    // array by a predicate over its elements is not something TypeScript does.
    const [a, b] = /** @type {readonly Value[]} */ (args).map(valueExp)
    // `n` decides which vocabulary the tag is in, and the check above makes
    // that agree with the operands. The casts are that step and nothing more.
    /** @type {Op1 | Op2} */
    const e = n === 1
        ? [/** @type {Op1Id} */ (g.op), a]
        : [/** @type {Op2Id} */ (g.op), a, b]
    return ['exp', e]
}

/**
 * Lowers the `eq` section: its `shared` values as nodes, and every case
 * beside the `'==='` expression it denotes over them.
 *
 * `eq` is the case's `expected` and so is no part of the expression; what is
 * left is an ordinary binary operation, which is why the `eq` cases validate
 * and evaluate through exactly the same path as a group's.
 *
 * @type {(eq: Eq) => LoweredEq}
 */
export const lowerEq = eq => {
    /** @type {(done: readonly SharedNode[]) => (name: string) => Exp} */
    const resolve = done => name => {
        const found = done.find(([k]) => k === name)
        if (found === undefined) { throw ['unknown shared value', name] }
        return found[1]
    }
    // Each shared value is lowered against the ones already lowered, so a
    // `ref` inside one reaches the node an earlier entry bound and sharing
    // nests. A name is in scope only after its own entry, which is what makes
    // a forward reference — and with it a cycle, which no EDAG may have —
    // unspellable rather than something to detect.
    /** @type {readonly SharedNode[]} */
    const shared = entries(eq.shared).reduce(
        (/** @type {readonly SharedNode[]} */ done, [k, v]) =>
            [...done, /** @type {SharedNode} */ ([k, constExp(resolve(done))(v)])],
        [])
    const operand = constExp(resolve(shared))
    return {
        shared,
        cases: eq.cases.map(c => [c, ['===', operand(c.a), operand(c.b)]]),
    }
}

/**
 * `+n` and `-n` share their whole argument space: both coerce with `ToNumber`
 * and differ only in the sign of the result. Listing the arguments once keeps
 * the two groups from drifting apart.
 *
 * @type {(negate: boolean) => readonly Case<1>[]}
 */
const numberCoercionCases = negate => {
    /** @type {(v: number) => number} */
    const result = v => negate ? -v : v
    return [
        { name: 'null', args: [null], expected: result(0) },
        { name: 'undefined', args: [undefined], expected: NaN },
        { name: 'booleanFalse', args: [false], expected: result(0) },
        { name: 'booleanTrue', args: [true], expected: result(1) },
        { name: 'numberZero', args: [0], expected: result(0) },
        { name: 'numberPositive', args: [2.3], expected: result(2.3) },
        { name: 'numberNegative', args: [-2.3], expected: result(-2.3) },
        { name: 'numberLarge', args: [-239], expected: result(-239) },
        { name: 'numberInfinity', args: [Infinity], expected: result(Infinity) },
        { name: 'numberNegativeInfinity', args: [-Infinity], expected: result(-Infinity) },
        { name: 'numberNan', args: [NaN], expected: NaN },
        { name: 'stringEmpty', args: [''], expected: result(0) },
        { name: 'stringZero', args: ['0'], expected: result(0) },
        { name: 'stringNumber', args: ['2.3'], expected: result(2.3) },
        { name: 'stringExponent', args: ['2.3e2'], expected: result(230) },
        { name: 'stringNotANumber', args: ['a'], expected: NaN },
        { name: 'arrayEmpty', args: [[]], expected: result(0) },
        { name: 'arrayNumber', args: [[2.3]], expected: result(2.3) },
        { name: 'arrayNegativeNumber', args: [[-0.3]], expected: result(-0.3) },
        { name: 'arrayString', args: [['-2.3']], expected: result(-2.3) },
        { name: 'arrayPositiveString', args: [['0.3']], expected: result(0.3) },
        { name: 'arrayNull', args: [[null]], expected: result(0) },
        { name: 'arrayPair', args: [[null, null]], expected: NaN },
        { name: 'objectEmpty', args: [{}], expected: NaN },
        { name: 'function', args: [functionValue], expected: NaN },
    ]
}

/**
 * `*` between a number and a bigint throws, so the pairs below never mix the
 * two except in the case that proves it. Every pair is checked in both orders
 * — see `commutative`.
 *
 * @type {readonly Case<2>[]}
 */
const mulCases = [
    { name: 'nullByNull', args: [null, null], expected: 0 },
    { name: 'nullByZero', args: [null, 0], expected: 0 },
    { name: 'undefinedByZero', args: [undefined, 0], expected: NaN },
    { name: 'trueByZero', args: [true, 0], expected: 0 },
    { name: 'trueByOne', args: [true, 1], expected: 1 },
    { name: 'trueByTen', args: [true, 10], expected: 10 },
    { name: 'falseByZero', args: [false, 0], expected: 0 },
    { name: 'falseByOne', args: [false, 1], expected: 0 },
    { name: 'falseByTen', args: [false, 10], expected: 0 },
    { name: 'zeroByZero', args: [0, 0], expected: 0 },
    { name: 'zeroByOne', args: [0, 1], expected: 0 },
    { name: 'oneByOne', args: [1, 1], expected: 1 },
    { name: 'oneByMinusOne', args: [1, -1], expected: -1 },
    { name: 'oneByTen', args: [1, 10], expected: 10 },
    { name: 'minusOneByTen', args: [-1, 10], expected: -10 },
    { name: 'tenByTen', args: [10, 10], expected: 100 },
    { name: 'minusTenByTen', args: [-10, 10], expected: -100 },
    { name: 'bigZeroByZero', args: [0n, 0n], expected: 0n },
    { name: 'bigZeroByOne', args: [0n, 1n], expected: 0n },
    { name: 'bigOneByOne', args: [1n, 1n], expected: 1n },
    { name: 'bigOneByMinusOne', args: [1n, -1n], expected: -1n },
    { name: 'bigOneByTen', args: [1n, 10n], expected: 10n },
    { name: 'bigMinusOneByTen', args: [-1n, 10n], expected: -10n },
    { name: 'bigTenByTen', args: [10n, 10n], expected: 100n },
    { name: 'bigMinusTenByTen', args: [-10n, 10n], expected: -100n },
    { name: 'emptyStringByOne', args: ['', 1], expected: 0 },
    { name: 'stringTenByOne', args: ['10', 1], expected: 10 },
    { name: 'stringLetterByOne', args: ['a', 1], expected: NaN },
    { name: 'stringBigintByOne', args: ['1n', 1], expected: NaN },
    { name: 'emptyArrayByOne', args: [[], 1], expected: 0 },
    { name: 'arrayTenByOne', args: [[10], 1], expected: 10 },
    { name: 'arrayStringTenByOne', args: [['10'], 1], expected: 10 },
    { name: 'arrayPairByOne', args: [[0, 0], 1], expected: NaN },
    { name: 'emptyObjectByOne', args: [{}, 1], expected: NaN },
    // The one binary case that escapes: `functionValue` has no expression, so
    // both consumers take the direct path with two operands rather than one.
    { name: 'functionByOne', args: [functionValue, 1], expected: NaN },
    { name: 'numberByBigint', args: [1, 1n], expected: throws },
]

/**
 * Subtraction has the same numeric coercion and mixed-number-kind rejection
 * as multiplication, but its operand order is observable.
 *
 * @type {readonly Case<2>[]}
 */
const subCases = [
    { name: 'nullMinusNull', args: [null, null], expected: 0 },
    { name: 'nullMinusZero', args: [null, 0], expected: 0 },
    { name: 'negativeZeroMinusZero', args: [-0, 0], expected: -0 },
    { name: 'zeroMinusNegativeZero', args: [0, -0], expected: 0 },
    { name: 'undefinedMinusZero', args: [undefined, 0], expected: NaN },
    { name: 'trueMinusOne', args: [true, 1], expected: 0 },
    { name: 'falseMinusOne', args: [false, 1], expected: -1 },
    { name: 'zeroMinusOne', args: [0, 1], expected: -1 },
    { name: 'oneMinusNegativeOne', args: [1, -1], expected: 2 },
    { name: 'negativeTenMinusTen', args: [-10, 10], expected: -20 },
    { name: 'bigZeroMinusZero', args: [0n, 0n], expected: 0n },
    { name: 'bigOneMinusOne', args: [1n, 1n], expected: 0n },
    { name: 'bigOneMinusNegativeOne', args: [1n, -1n], expected: 2n },
    { name: 'bigNegativeOneMinusOne', args: [-1n, 1n], expected: -2n },
    { name: 'emptyStringMinusOne', args: ['', 1], expected: -1 },
    { name: 'stringTenMinusOne', args: ['10', 1], expected: 9 },
    { name: 'stringLetterMinusOne', args: ['a', 1], expected: NaN },
    { name: 'emptyArrayMinusOne', args: [[], 1], expected: -1 },
    { name: 'arrayTenMinusOne', args: [[10], 1], expected: 9 },
    { name: 'arrayPairMinusOne', args: [[0, 0], 1], expected: NaN },
    { name: 'emptyObjectMinusOne', args: [{}, 1], expected: NaN },
    { name: 'functionMinusOne', args: [functionValue, 1], expected: NaN },
    { name: 'numberMinusBigint', args: [1, 1n], expected: throws },
    { name: 'bigintMinusNumber', args: [1n, 1], expected: throws },
]

/**
 * `%` is not implemented in `nanvm-lib` yet (see the operator table in
 * `nanvm-lib/README.md`), so every case below carries this as its `rust`
 * reason: the generated Rust keeps each as a commented-out `TODO`, while the
 * JavaScript proof still runs it. Removing the reason per case is what turns
 * it on for Rust once `%` lands there.
 *
 * @type {string}
 */
const remNotImplemented = '`%` is not implemented in nanvm-lib yet'

/**
 * `%` coerces both operands with `ToNumeric` like `*`, but is neither
 * commutative nor symmetric between mixed sign operands: the result's sign
 * follows the dividend (left operand), not the divisor. Number `%` never
 * throws: the result is `NaN` when the divisor is zero, when the dividend is
 * infinite, or when either operand is `NaN` — but a *finite* dividend by an
 * *infinite* divisor returns the dividend unchanged, e.g. `5 % Infinity` is
 * `5`. BigInt `%` throws instead of producing `NaN`, and only on a zero
 * divisor — mixed number/bigint operands throw too, the same as every other
 * arithmetic operator here.
 *
 * @type {readonly Case<2>[]}
 */
const remCases = [
    { name: 'nullModThree', args: [null, 3], expected: 0, rust: remNotImplemented },
    { name: 'undefinedModThree', args: [undefined, 3], expected: NaN, rust: remNotImplemented },
    { name: 'trueModThree', args: [true, 3], expected: 1, rust: remNotImplemented },
    { name: 'falseModThree', args: [false, 3], expected: 0, rust: remNotImplemented },
    { name: 'stringTenModThree', args: ['10', 3], expected: 1, rust: remNotImplemented },
    { name: 'stringLetterModThree', args: ['a', 3], expected: NaN, rust: remNotImplemented },
    { name: 'emptyArrayModThree', args: [[], 3], expected: 0, rust: remNotImplemented },
    { name: 'arrayTenModThree', args: [[10], 3], expected: 1, rust: remNotImplemented },
    { name: 'arrayStringTenModThree', args: [['10'], 3], expected: 1, rust: remNotImplemented },
    { name: 'arrayPairModThree', args: [[0, 0], 3], expected: NaN, rust: remNotImplemented },
    { name: 'emptyObjectModThree', args: [{}, 3], expected: NaN, rust: remNotImplemented },
    // The one binary case that escapes: `functionValue` has no expression, so
    // both consumers take the direct path with two operands rather than one.
    { name: 'functionModThree', args: [functionValue, 3], expected: NaN, rust: remNotImplemented },
    { name: 'zeroModOne', args: [0, 1], expected: 0, rust: remNotImplemented },
    { name: 'negativeZeroModOne', args: [-0, 1], expected: -0, rust: remNotImplemented },
    { name: 'oneModOne', args: [1, 1], expected: 0, rust: remNotImplemented },
    { name: 'tenModThree', args: [10, 3], expected: 1, rust: remNotImplemented },
    { name: 'negativeTenModThree', args: [-10, 3], expected: -1, rust: remNotImplemented },
    { name: 'tenModNegativeThree', args: [10, -3], expected: 1, rust: remNotImplemented },
    {
        name: 'negativeTenModNegativeThree',
        args: [-10, -3],
        expected: -1,
        rust: remNotImplemented,
    },
    { name: 'fiveModZero', args: [5, 0], expected: NaN, rust: remNotImplemented },
    { name: 'zeroModZero', args: [0, 0], expected: NaN, rust: remNotImplemented },
    { name: 'negativeZeroModZero', args: [-0, 0], expected: NaN, rust: remNotImplemented },
    { name: 'fiveModInfinity', args: [5, Infinity], expected: 5, rust: remNotImplemented },
    { name: 'negativeFiveModInfinity', args: [-5, Infinity], expected: -5, rust: remNotImplemented },
    { name: 'infinityModFive', args: [Infinity, 5], expected: NaN, rust: remNotImplemented },
    { name: 'infinityModInfinity', args: [Infinity, Infinity], expected: NaN, rust: remNotImplemented },
    { name: 'nanModOne', args: [NaN, 1], expected: NaN, rust: remNotImplemented },
    { name: 'oneModNan', args: [1, NaN], expected: NaN, rust: remNotImplemented },
    { name: 'fractionModTwo', args: [5.5, 2], expected: 1.5, rust: remNotImplemented },
    { name: 'negativeFractionModTwo', args: [-5.5, 2], expected: -1.5, rust: remNotImplemented },
    { name: 'bigTenModThree', args: [10n, 3n], expected: 1n, rust: remNotImplemented },
    { name: 'bigNegativeTenModThree', args: [-10n, 3n], expected: -1n, rust: remNotImplemented },
    { name: 'bigTenModNegativeThree', args: [10n, -3n], expected: 1n, rust: remNotImplemented },
    {
        name: 'bigNegativeTenModNegativeThree',
        args: [-10n, -3n],
        expected: -1n,
        rust: remNotImplemented,
    },
    { name: 'bigZeroModOne', args: [0n, 1n], expected: 0n, rust: remNotImplemented },
    { name: 'bigTenModZero', args: [10n, 0n], expected: throws, rust: remNotImplemented },
    { name: 'numberModBigint', args: [1, 1n], expected: throws, rust: remNotImplemented },
    { name: 'bigintModNumber', args: [1n, 1], expected: throws, rust: remNotImplemented },
]

/**
 * Addition concatenates after `ToPrimitive` when either primitive is a
 * string; otherwise it follows the same numeric rules as subtraction.
 *
 * @type {readonly Case<2>[]}
 */
const addCases = [
    { name: 'nullPlusOne', args: [null, 1], expected: 1 },
    { name: 'undefinedPlusOne', args: [undefined, 1], expected: NaN },
    { name: 'truePlusTrue', args: [true, true], expected: 2 },
    { name: 'onePlusNegativeOne', args: [1, -1], expected: 0 },
    { name: 'negativeZeroPlusZero', args: [-0, 0], expected: 0 },
    { name: 'zeroPlusNegativeZero', args: [0, -0], expected: 0 },
    { name: 'negativeZeroPlusNegativeZero', args: [-0, -0], expected: -0 },
    { name: 'emptyStringPlusOne', args: ['', 1], expected: '1' },
    { name: 'onePlusEmptyString', args: [1, ''], expected: '1' },
    { name: 'stringOnePlusTwo', args: ['1', 2], expected: '12' },
    { name: 'onePlusStringTwo', args: [1, '2'], expected: '12' },
    { name: 'bigOnePlusBigOne', args: [1n, 1n], expected: 2n },
    { name: 'bigOnePlusStringTwo', args: [1n, '2'], expected: '12' },
    { name: 'stringOnePlusBigTwo', args: ['1', 2n], expected: '12' },
    { name: 'emptyArrayPlusOne', args: [[], 1], expected: '1' },
    { name: 'arrayOnePlusTwo', args: [[1], 2], expected: '12' },
    { name: 'emptyObjectPlusOne', args: [{}, 1], expected: '[object Object]1' },
    { name: 'numberPlusBigint', args: [1, 1n], expected: throws },
    { name: 'bigintPlusNumber', args: [1n, 1], expected: throws },
]

/**
 * `String(x)`.
 *
 * A function's string form is its source text, which no two engines have to
 * agree on, so it is not shared data — [`proof.f.mjs`](./proof.f.mjs) checks
 * the JavaScript side separately.
 *
 * @type {readonly Case<1>[]}
 */
const stringCoercionCases = [
    { name: 'number', args: [123], expected: '123' },
    { name: 'negativeNumber', args: [-456], expected: '-456' },
    { name: 'zero', args: [0], expected: '0' },
    { name: 'negativeZero', args: [-0], expected: '0' },
    { name: 'infinity', args: [Infinity], expected: 'Infinity' },
    { name: 'negativeInfinity', args: [-Infinity], expected: '-Infinity' },
    { name: 'nan', args: [NaN], expected: 'NaN' },
    { name: 'booleanTrue', args: [true], expected: 'true' },
    { name: 'booleanFalse', args: [false], expected: 'false' },
    { name: 'null', args: [null], expected: 'null' },
    { name: 'undefined', args: [undefined], expected: 'undefined' },
    { name: 'string', args: ['already'], expected: 'already' },
    { name: 'bigint', args: [123n], expected: '123' },
    { name: 'negativeBigint', args: [-456n], expected: '-456' },
    { name: 'emptyArray', args: [[]], expected: '' },
    { name: 'singletonArray', args: [[1]], expected: '1' },
    { name: 'array', args: [[1, 2, 3]], expected: '1,2,3' },
    { name: 'nestedArray', args: [[1, [2, 3], 4]], expected: '1,2,3,4' },
    { name: 'arrayWithNullish', args: [[null, undefined, 1]], expected: ',,1' },
    { name: 'emptyObject', args: [{}], expected: '[object Object]' },
    { name: 'object', args: [{ a: 1 }], expected: '[object Object]' },
]

/** @type {Data} */
export const data = {
    eq: {
        shared: {
            emptyArray: [],
            stringArray: ['0'],
            object: { '0': '0' },
        },
        cases: [
            { name: 'nullByNull', a: null, b: null, eq: true },
            { name: 'undefinedByUndefined', a: undefined, b: undefined, eq: true },
            { name: 'nullByUndefined', a: null, b: undefined, eq: false },
            { name: 'trueByTrue', a: true, b: true, eq: true },
            { name: 'falseByFalse', a: false, b: false, eq: true },
            { name: 'trueByFalse', a: true, b: false, eq: false },
            { name: 'falseByUndefined', a: false, b: undefined, eq: false },
            { name: 'falseByNull', a: false, b: null, eq: false },
            { name: 'numberBySameNumber', a: 2.3, b: 2.3, eq: true },
            { name: 'numberByOtherNumber', a: 2.3, b: -5.4, eq: false },
            { name: 'nanByNan', a: NaN, b: NaN, eq: false },
            { name: 'zeroByNegativeZero', a: 0, b: -0, eq: true },
            { name: 'infinityByInfinity', a: Infinity, b: Infinity, eq: true },
            {
                name: 'negativeInfinityByNegativeInfinity',
                a: -Infinity,
                b: -Infinity,
                eq: true,
            },
            { name: 'infinityByNegativeInfinity', a: Infinity, b: -Infinity, eq: false },
            { name: 'undefinedByNan', a: undefined, b: NaN, eq: false },
            { name: 'undefinedByZero', a: undefined, b: 0, eq: false },
            { name: 'stringBySameString', a: 'hello', b: 'hello', eq: true },
            { name: 'stringByOtherString', a: 'hello', b: 'world', eq: false },
            { name: 'zeroByStringZero', a: 0, b: '0', eq: false },
            { name: 'bigintBySameBigint', a: 12n, b: 12n, eq: true },
            { name: 'bigintByNegatedBigint', a: 12n, b: -12n, eq: false },
            { name: 'bigintByOtherBigint', a: 12n, b: 13n, eq: false },
            { name: 'twelveByStringTwelve', a: 12n, b: '12', eq: false },
            { name: 'arrayByItself', a: ref('emptyArray'), b: ref('emptyArray'), eq: true },
            { name: 'arrayByEqualArray', a: [], b: [], eq: false },
            { name: 'stringArrayByItself', a: ref('stringArray'), b: ref('stringArray'), eq: true },
            { name: 'objectByItself', a: ref('object'), b: ref('object'), eq: true },
            { name: 'objectByEqualObject', a: ref('object'), b: { '0': '0' }, eq: false },
        ],
    },
    groups: [
        {
            // No canonical EDAG id: the EDAG has no unary `+`. Becomes the
            // `Number` cast — a semantic change, not a rename — through
            // `nanvm-lib/todo/replace-unary-plus-with-number.md`.
            nanvmOp: 'unaryPlus',
            cases: [
                ...numberCoercionCases(false),
                { name: 'bigint', args: [0n], expected: throws },
            ],
        },
        {
            op: 'neg',
            cases: [
                ...numberCoercionCases(true),
                { name: 'bigintPositive', args: [1n], expected: -1n },
                { name: 'bigintNegative', args: [-1n], expected: 1n },
            ],
        },
        { op: '*', commutative: true, cases: mulCases },
        { op: '-', cases: subCases },
        { op: '+', cases: addCases },
        { op: '%', cases: remCases },
        { op: 'String', cases: stringCoercionCases },
    ],
}
