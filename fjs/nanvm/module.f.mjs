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
 * data.groups.length // 19
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
 * @type {(g: Group) => (c: Case<1> | Case<2> | Case<3>) => readonly (readonly[string, readonly Operand[]])[]}
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
 * @type {(g: Group) => readonly (Case<1> | Case<2> | Case<3>)[]}
 */
export const casesOf = g => g.cases

/**
 * How many operands a group's operation takes.
 *
 * Which vocabulary the id belongs to is what fixes the count — the same rule
 * the group types carry — so this asks the schema rather than a second copy
 * of the vocabulary. A group with no canonical id is unary unless it names
 * `ternary`, the corpus's one three-operand group — the EDAG has no
 * conditional-expression node to be unary or binary *in*, so nothing there
 * fixes its count the way it fixes every other group's. It is the runtime
 * half of what `Group1`/`Group2`/`NonEdagGroup` say statically, for the
 * consumers that walk `data.groups` and so hold a `Group` whose arm is no
 * longer known.
 *
 * @type {(g: Group) => 1 | 2 | 3}
 */
export const arityOf = g => {
    if (!('op' in g)) { return g.nanvmOp === 'ternary' ? 3 : 1 }
    return isOp1Id(g.op)[0] === 'ok' ? 1 : 2
}

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
 * `/` coerces both operands with `ToNumeric` like `*`, and like `%` is
 * neither commutative nor symmetric between mixed sign operands. Number `/`
 * never throws: dividing by `0` or `-0` produces a signed `Infinity` (unless
 * the dividend is also zero, giving `NaN`), and dividing by an infinite
 * divisor produces a signed zero for a finite dividend. BigInt `/` truncates
 * toward zero and throws — instead of producing `Infinity` — on a zero
 * divisor; mixed number/bigint operands throw too, the same as every other
 * arithmetic operator here.
 *
 * @type {readonly Case<2>[]}
 */
const divCases = [
    { name: 'nullDividedByFour', args: [null, 4], expected: 0 },
    { name: 'undefinedDividedByFour', args: [undefined, 4], expected: NaN },
    { name: 'trueDividedByFour', args: [true, 4], expected: 0.25 },
    { name: 'falseDividedByFour', args: [false, 4], expected: 0 },
    { name: 'stringTenDividedByFour', args: ['10', 4], expected: 2.5 },
    { name: 'stringLetterDividedByFour', args: ['a', 4], expected: NaN },
    { name: 'emptyArrayDividedByFour', args: [[], 4], expected: 0 },
    { name: 'arrayTenDividedByFour', args: [[10], 4], expected: 2.5 },
    { name: 'arrayStringTenDividedByFour', args: [['10'], 4], expected: 2.5 },
    { name: 'arrayPairDividedByFour', args: [[0, 0], 4], expected: NaN },
    { name: 'emptyObjectDividedByFour', args: [{}, 4], expected: NaN },
    // The one binary case that escapes: `functionValue` has no expression, so
    // both consumers take the direct path with two operands rather than one.
    { name: 'functionDividedByFour', args: [functionValue, 4], expected: NaN },
    { name: 'zeroDividedByOne', args: [0, 1], expected: 0 },
    { name: 'negativeZeroDividedByOne', args: [-0, 1], expected: -0 },
    { name: 'tenDividedByFour', args: [10, 4], expected: 2.5 },
    { name: 'negativeTenDividedByFour', args: [-10, 4], expected: -2.5 },
    { name: 'tenDividedByNegativeFour', args: [10, -4], expected: -2.5 },
    { name: 'negativeTenDividedByNegativeFour', args: [-10, -4], expected: 2.5 },
    { name: 'fiveDividedByZero', args: [5, 0], expected: Infinity },
    { name: 'negativeFiveDividedByZero', args: [-5, 0], expected: -Infinity },
    { name: 'fiveDividedByNegativeZero', args: [5, -0], expected: -Infinity },
    { name: 'negativeFiveDividedByNegativeZero', args: [-5, -0], expected: Infinity },
    { name: 'zeroDividedByZero', args: [0, 0], expected: NaN },
    { name: 'negativeZeroDividedByZero', args: [-0, 0], expected: NaN },
    { name: 'zeroDividedByNegativeZero', args: [0, -0], expected: NaN },
    { name: 'negativeZeroDividedByNegativeZero', args: [-0, -0], expected: NaN },
    { name: 'infinityDividedByFive', args: [Infinity, 5], expected: Infinity },
    { name: 'infinityDividedByNegativeFive', args: [Infinity, -5], expected: -Infinity },
    { name: 'negativeInfinityDividedByFive', args: [-Infinity, 5], expected: -Infinity },
    { name: 'fiveDividedByInfinity', args: [5, Infinity], expected: 0 },
    { name: 'negativeFiveDividedByInfinity', args: [-5, Infinity], expected: -0 },
    { name: 'fiveDividedByNegativeInfinity', args: [5, -Infinity], expected: -0 },
    { name: 'infinityDividedByInfinity', args: [Infinity, Infinity], expected: NaN },
    { name: 'infinityDividedByNegativeInfinity', args: [Infinity, -Infinity], expected: NaN },
    { name: 'nanDividedByOne', args: [NaN, 1], expected: NaN },
    { name: 'oneDividedByNan', args: [1, NaN], expected: NaN },
    { name: 'sevenDividedByTwo', args: [7, 2], expected: 3.5 },
    { name: 'oneDividedByThree', args: [1, 3], expected: 1 / 3 },
    { name: 'bigTenDividedByThree', args: [10n, 3n], expected: 3n },
    { name: 'bigNegativeTenDividedByThree', args: [-10n, 3n], expected: -3n },
    { name: 'bigTenDividedByNegativeThree', args: [10n, -3n], expected: -3n },
    { name: 'bigNegativeTenDividedByNegativeThree', args: [-10n, -3n], expected: 3n },
    { name: 'bigSevenDividedByTwo', args: [7n, 2n], expected: 3n },
    { name: 'bigNegativeSevenDividedByTwo', args: [-7n, 2n], expected: -3n },
    { name: 'bigZeroDividedByFive', args: [0n, 5n], expected: 0n },
    { name: 'bigTenDividedByZero', args: [10n, 0n], expected: throws },
    { name: 'numberDividedByBigint', args: [1, 1n], expected: throws },
    { name: 'bigintDividedByNumber', args: [1n, 1], expected: throws },
]

/**
 * `**` coerces both operands with `ToNumeric` like `*`, but Number
 * exponentiation (`Number::exponentiate`) is its own algorithm and not `pow`
 * applied naively: the exponent's sign and parity decide the result at every
 * infinity and zero, independently of the base's magnitude, and a few cases
 * override what the magnitude rule would otherwise give — `NaN ** 0` and
 * `x ** NaN` are governed by the exponent alone (`1`/`NaN`) regardless of the
 * base, and `1 ** Infinity` is `NaN` even though `1` is decisive nowhere
 * else. A finite negative base with a finite non-integer exponent has no
 * real result and is `NaN`, unlike `Math.pow`, which agrees here. BigInt `**`
 * throws — instead of coercing to a fraction — on a negative exponent, and
 * mixed number/bigint operands throw too, the same as every other arithmetic
 * operator here.
 *
 * @type {readonly Case<2>[]}
 */
const expCases = [
    { name: 'nullToThePowerOfTwo', args: [null, 2], expected: 0 },
    { name: 'undefinedToThePowerOfTwo', args: [undefined, 2], expected: NaN },
    { name: 'trueToThePowerOfTwo', args: [true, 2], expected: 1 },
    { name: 'falseToThePowerOfTwo', args: [false, 2], expected: 0 },
    { name: 'stringThreeToThePowerOfTwo', args: ['3', 2], expected: 9 },
    { name: 'stringLetterToThePowerOfTwo', args: ['a', 2], expected: NaN },
    { name: 'emptyArrayToThePowerOfTwo', args: [[], 2], expected: 0 },
    { name: 'arrayThreeToThePowerOfTwo', args: [[3], 2], expected: 9 },
    { name: 'arrayStringThreeToThePowerOfTwo', args: [['3'], 2], expected: 9 },
    { name: 'arrayPairToThePowerOfTwo', args: [[0, 0], 2], expected: NaN },
    { name: 'emptyObjectToThePowerOfTwo', args: [{}, 2], expected: NaN },
    // The one binary case that escapes: `functionValue` has no expression, so
    // both consumers take the direct path with two operands rather than one.
    { name: 'functionToThePowerOfTwo', args: [functionValue, 2], expected: NaN },
    { name: 'twoToThePowerOfTen', args: [2, 10], expected: 1024 },
    { name: 'twoToThePowerOfHalf', args: [2, 0.5], expected: 2 ** 0.5 },
    { name: 'twoToThePowerOfNegativeOne', args: [2, -1], expected: 0.5 },
    { name: 'negativeTwoToThePowerOfThree', args: [-2, 3], expected: -8 },
    { name: 'negativeTwoToThePowerOfTwo', args: [-2, 2], expected: 4 },
    { name: 'zeroToThePowerOfZero', args: [0, 0], expected: 1 },
    { name: 'negativeZeroToThePowerOfZero', args: [-0, 0], expected: 1 },
    { name: 'nanToThePowerOfZero', args: [NaN, 0], expected: 1 },
    { name: 'twoToThePowerOfNan', args: [2, NaN], expected: NaN },
    { name: 'nanToThePowerOfNan', args: [NaN, NaN], expected: NaN },
    { name: 'oneToThePowerOfInfinity', args: [1, Infinity], expected: NaN },
    { name: 'negativeOneToThePowerOfInfinity', args: [-1, Infinity], expected: NaN },
    { name: 'oneToThePowerOfNegativeInfinity', args: [1, -Infinity], expected: NaN },
    { name: 'twoToThePowerOfInfinity', args: [2, Infinity], expected: Infinity },
    { name: 'negativeTwoToThePowerOfInfinity', args: [-2, Infinity], expected: Infinity },
    { name: 'halfToThePowerOfInfinity', args: [0.5, Infinity], expected: 0 },
    { name: 'twoToThePowerOfNegativeInfinity', args: [2, -Infinity], expected: 0 },
    { name: 'halfToThePowerOfNegativeInfinity', args: [0.5, -Infinity], expected: Infinity },
    { name: 'infinityToThePowerOfTwo', args: [Infinity, 2], expected: Infinity },
    { name: 'infinityToThePowerOfNegativeTwo', args: [Infinity, -2], expected: 0 },
    { name: 'negativeInfinityToThePowerOfThree', args: [-Infinity, 3], expected: -Infinity },
    { name: 'negativeInfinityToThePowerOfTwo', args: [-Infinity, 2], expected: Infinity },
    { name: 'negativeInfinityToThePowerOfNegativeThree', args: [-Infinity, -3], expected: -0 },
    { name: 'negativeInfinityToThePowerOfNegativeTwo', args: [-Infinity, -2], expected: 0 },
    { name: 'zeroToThePowerOfTwo', args: [0, 2], expected: 0 },
    { name: 'zeroToThePowerOfNegativeTwo', args: [0, -2], expected: Infinity },
    { name: 'negativeZeroToThePowerOfThree', args: [-0, 3], expected: -0 },
    { name: 'negativeZeroToThePowerOfTwo', args: [-0, 2], expected: 0 },
    { name: 'negativeZeroToThePowerOfNegativeThree', args: [-0, -3], expected: -Infinity },
    { name: 'negativeZeroToThePowerOfNegativeTwo', args: [-0, -2], expected: Infinity },
    { name: 'negativeTwoToThePowerOfHalf', args: [-2, 0.5], expected: NaN },
    { name: 'bigTwoToThePowerOfTen', args: [2n, 10n], expected: 1024n },
    { name: 'bigZeroToThePowerOfZero', args: [0n, 0n], expected: 1n },
    { name: 'bigNegativeTwoToThePowerOfThree', args: [-2n, 3n], expected: -8n },
    { name: 'bigTwoToThePowerOfNegativeOne', args: [2n, -1n], expected: throws },
    { name: 'numberToThePowerOfBigint', args: [1, 1n], expected: throws },
    { name: 'bigintToThePowerOfNumber', args: [1n, 1], expected: throws },
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
    { name: 'nullModThree', args: [null, 3], expected: 0 },
    { name: 'undefinedModThree', args: [undefined, 3], expected: NaN },
    { name: 'trueModThree', args: [true, 3], expected: 1 },
    { name: 'falseModThree', args: [false, 3], expected: 0 },
    { name: 'stringTenModThree', args: ['10', 3], expected: 1 },
    { name: 'stringLetterModThree', args: ['a', 3], expected: NaN },
    { name: 'emptyArrayModThree', args: [[], 3], expected: 0 },
    { name: 'arrayTenModThree', args: [[10], 3], expected: 1 },
    { name: 'arrayStringTenModThree', args: [['10'], 3], expected: 1 },
    { name: 'arrayPairModThree', args: [[0, 0], 3], expected: NaN },
    { name: 'emptyObjectModThree', args: [{}, 3], expected: NaN },
    // The one binary case that escapes: `functionValue` has no expression, so
    // both consumers take the direct path with two operands rather than one.
    { name: 'functionModThree', args: [functionValue, 3], expected: NaN },
    { name: 'zeroModOne', args: [0, 1], expected: 0 },
    { name: 'negativeZeroModOne', args: [-0, 1], expected: -0 },
    { name: 'oneModOne', args: [1, 1], expected: 0 },
    { name: 'tenModThree', args: [10, 3], expected: 1 },
    { name: 'negativeTenModThree', args: [-10, 3], expected: -1 },
    { name: 'tenModNegativeThree', args: [10, -3], expected: 1 },
    { name: 'negativeTenModNegativeThree', args: [-10, -3], expected: -1 },
    { name: 'fiveModZero', args: [5, 0], expected: NaN },
    { name: 'zeroModZero', args: [0, 0], expected: NaN },
    { name: 'negativeZeroModZero', args: [-0, 0], expected: NaN },
    { name: 'fiveModInfinity', args: [5, Infinity], expected: 5 },
    { name: 'negativeFiveModInfinity', args: [-5, Infinity], expected: -5 },
    { name: 'infinityModFive', args: [Infinity, 5], expected: NaN },
    { name: 'infinityModInfinity', args: [Infinity, Infinity], expected: NaN },
    { name: 'nanModOne', args: [NaN, 1], expected: NaN },
    { name: 'oneModNan', args: [1, NaN], expected: NaN },
    { name: 'fractionModTwo', args: [5.5, 2], expected: 1.5 },
    { name: 'negativeFractionModTwo', args: [-5.5, 2], expected: -1.5 },
    { name: 'bigTenModThree', args: [10n, 3n], expected: 1n },
    { name: 'bigNegativeTenModThree', args: [-10n, 3n], expected: -1n },
    { name: 'bigTenModNegativeThree', args: [10n, -3n], expected: 1n },
    { name: 'bigNegativeTenModNegativeThree', args: [-10n, -3n], expected: -1n },
    { name: 'bigZeroModOne', args: [0n, 1n], expected: 0n },
    { name: 'bigTenModZero', args: [10n, 0n], expected: throws },
    { name: 'numberModBigint', args: [1, 1n], expected: throws },
    { name: 'bigintModNumber', args: [1n, 1], expected: throws },
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
 * `<` never throws, unlike the arithmetic operators: it `ToPrimitive`s both
 * operands (never `ToNumeric` directly), and if *both* results are strings
 * compares them lexicographically by UTF-16 code unit rather than
 * numerically — `'10' < '9'` is `true`. Otherwise each side is `ToNumeric`d
 * on its own, so a `Number` and a `BigInt` compare against each other
 * directly instead of throwing the `TypeError` `*`, `-`, `+`, `/`, `%` and
 * `**` all give mixed operands; a `String` compares against a `BigInt` the
 * same way, via `StringToBigInt`. Any comparison touching `NaN` — directly,
 * or a string that fails `StringToBigInt` against a `BigInt` — is `false` in
 * *both* directions, the one asymmetry the corpus's fixed left/right cases
 * exist to cover since `<` is not commutative the way `*` is.
 *
 * @type {readonly Case<2>[]}
 */
const lessThanCases = [
    { name: 'nullLessThanFive', args: [null, 5], expected: true },
    { name: 'undefinedLessThanFive', args: [undefined, 5], expected: false },
    { name: 'trueLessThanFive', args: [true, 5], expected: true },
    { name: 'falseLessThanFive', args: [false, 5], expected: true },
    { name: 'stringThreeLessThanFive', args: ['3', 5], expected: true },
    { name: 'stringLetterLessThanFive', args: ['a', 5], expected: false },
    { name: 'emptyArrayLessThanFive', args: [[], 5], expected: true },
    { name: 'arrayThreeLessThanFive', args: [[3], 5], expected: true },
    { name: 'arrayStringThreeLessThanFive', args: [['3'], 5], expected: true },
    { name: 'arrayPairLessThanFive', args: [[0, 0], 5], expected: false },
    { name: 'emptyObjectLessThanFive', args: [{}, 5], expected: false },
    // The one binary case that escapes: `functionValue` has no expression, so
    // both consumers take the direct path with two operands rather than one.
    { name: 'functionLessThanFive', args: [functionValue, 5], expected: false },
    { name: 'threeLessThanFive', args: [3, 5], expected: true },
    { name: 'fiveLessThanThree', args: [5, 3], expected: false },
    { name: 'fiveLessThanFive', args: [5, 5], expected: false },
    { name: 'zeroLessThanNegativeZero', args: [0, -0], expected: false },
    { name: 'negativeZeroLessThanZero', args: [-0, 0], expected: false },
    { name: 'nanLessThanOne', args: [NaN, 1], expected: false },
    { name: 'oneLessThanNan', args: [1, NaN], expected: false },
    { name: 'nanLessThanNan', args: [NaN, NaN], expected: false },
    { name: 'infinityLessThanOne', args: [Infinity, 1], expected: false },
    { name: 'oneLessThanInfinity', args: [1, Infinity], expected: true },
    { name: 'negativeInfinityLessThanInfinity', args: [-Infinity, Infinity], expected: true },
    { name: 'infinityLessThanInfinity', args: [Infinity, Infinity], expected: false },
    { name: 'stringTenLessThanStringNine', args: ['10', '9'], expected: true },
    { name: 'stringNineLessThanStringTen', args: ['9', '10'], expected: false },
    { name: 'stringALessThanStringB', args: ['a', 'b'], expected: true },
    { name: 'emptyStringLessThanStringA', args: ['', 'a'], expected: true },
    { name: 'stringAbLessThanStringAbc', args: ['ab', 'abc'], expected: true },
    { name: 'stringAbcLessThanStringAb', args: ['abc', 'ab'], expected: false },
    { name: 'stringUppercaseBLessThanStringA', args: ['B', 'a'], expected: true },
    { name: 'stringTenLessThanNine', args: ['10', 9], expected: false },
    { name: 'nineLessThanStringTen', args: [9, '10'], expected: true },
    { name: 'stringAbcLessThanFive', args: ['abc', 5], expected: false },
    { name: 'fiveLessThanStringAbc', args: [5, 'abc'], expected: false },
    { name: 'negativeFiveBigLessThanThreeBig', args: [-5n, 3n], expected: true },
    { name: 'threeBigLessThanThreeBig', args: [3n, 3n], expected: false },
    { name: 'threeBigLessThanNegativeFiveBig', args: [3n, -5n], expected: false },
    // `<` compares a `Number` and a `BigInt` directly rather than throwing —
    // the opposite of `numberByBigint` in every arithmetic group above.
    { name: 'fiveBigLessThanFiveHalf', args: [5n, 5.5], expected: true },
    { name: 'fiveBigLessThanFive', args: [5n, 5], expected: false },
    { name: 'fiveLessThanFiveBig', args: [5, 5n], expected: false },
    { name: 'fiveBigLessThanNan', args: [5n, NaN], expected: false },
    { name: 'nanLessThanFiveBig', args: [NaN, 5n], expected: false },
    { name: 'fiveBigLessThanInfinity', args: [5n, Infinity], expected: true },
    { name: 'negativeInfinityLessThanFiveBig', args: [-Infinity, 5n], expected: true },
    { name: 'infinityLessThanFiveBig', args: [Infinity, 5n], expected: false },
    { name: 'stringTenLessThanTwentyBig', args: ['10', 20n], expected: true },
    { name: 'twentyBigLessThanStringThirty', args: [20n, '30'], expected: true },
    { name: 'stringAbcLessThanTwentyBig', args: ['abc', 20n], expected: false },
    { name: 'twentyBigLessThanStringAbc', args: [20n, 'abc'], expected: false },
]

/**
 * `<=` shares `<`'s coercion (`ToPrimitive`, then lexicographic string
 * comparison or per-side `ToNumeric`) and never throws either. It is defined
 * as the negation of the reversed `<` (`x <= y` is `!(y < x)`), *except* that
 * `NaN` involved anywhere still gives `false`, not the `true` a plain
 * negation of `<`'s `false` would: `y < x` being `false` because one side is
 * `NaN` does not make `x <= y` `true`. That is why `1 <= NaN`, `NaN <= 1`,
 * and `5n <= NaN` are all `false` below, alongside the cases that *do* flip
 * from `<` — equal operands, equal-valued mixed number/bigint pairs, and
 * `Infinity <= Infinity` — which are exactly where `<` was `false` for a
 * reason other than `NaN`.
 *
 * @type {readonly Case<2>[]}
 */
const lessOrEqualCases = [
    { name: 'nullLessOrEqualFive', args: [null, 5], expected: true },
    { name: 'undefinedLessOrEqualFive', args: [undefined, 5], expected: false },
    { name: 'trueLessOrEqualFive', args: [true, 5], expected: true },
    { name: 'falseLessOrEqualFive', args: [false, 5], expected: true },
    { name: 'stringThreeLessOrEqualFive', args: ['3', 5], expected: true },
    { name: 'stringLetterLessOrEqualFive', args: ['a', 5], expected: false },
    { name: 'emptyArrayLessOrEqualFive', args: [[], 5], expected: true },
    { name: 'arrayThreeLessOrEqualFive', args: [[3], 5], expected: true },
    { name: 'arrayStringThreeLessOrEqualFive', args: [['3'], 5], expected: true },
    { name: 'arrayPairLessOrEqualFive', args: [[0, 0], 5], expected: false },
    { name: 'emptyObjectLessOrEqualFive', args: [{}, 5], expected: false },
    // The one binary case that escapes: `functionValue` has no expression, so
    // both consumers take the direct path with two operands rather than one.
    { name: 'functionLessOrEqualFive', args: [functionValue, 5], expected: false },
    { name: 'threeLessOrEqualFive', args: [3, 5], expected: true },
    { name: 'fiveLessOrEqualThree', args: [5, 3], expected: false },
    // Equal operands: where `<` was `false`, `<=` flips to `true`.
    { name: 'fiveLessOrEqualFive', args: [5, 5], expected: true },
    { name: 'zeroLessOrEqualNegativeZero', args: [0, -0], expected: true },
    { name: 'negativeZeroLessOrEqualZero', args: [-0, 0], expected: true },
    // `NaN` involved anywhere stays `false` — the one case negating `<`
    // would get wrong.
    { name: 'nanLessOrEqualOne', args: [NaN, 1], expected: false },
    { name: 'oneLessOrEqualNan', args: [1, NaN], expected: false },
    { name: 'nanLessOrEqualNan', args: [NaN, NaN], expected: false },
    { name: 'infinityLessOrEqualOne', args: [Infinity, 1], expected: false },
    { name: 'oneLessOrEqualInfinity', args: [1, Infinity], expected: true },
    { name: 'negativeInfinityLessOrEqualInfinity', args: [-Infinity, Infinity], expected: true },
    // Equal infinities: another `<`-`false` case that flips to `true`.
    { name: 'infinityLessOrEqualInfinity', args: [Infinity, Infinity], expected: true },
    { name: 'stringTenLessOrEqualStringNine', args: ['10', '9'], expected: true },
    { name: 'stringNineLessOrEqualStringTen', args: ['9', '10'], expected: false },
    { name: 'stringALessOrEqualStringB', args: ['a', 'b'], expected: true },
    { name: 'emptyStringLessOrEqualStringA', args: ['', 'a'], expected: true },
    { name: 'stringAbLessOrEqualStringAbc', args: ['ab', 'abc'], expected: true },
    { name: 'stringAbcLessOrEqualStringAb', args: ['abc', 'ab'], expected: false },
    { name: 'stringUppercaseBLessOrEqualStringA', args: ['B', 'a'], expected: true },
    { name: 'stringTenLessOrEqualNine', args: ['10', 9], expected: false },
    { name: 'nineLessOrEqualStringTen', args: [9, '10'], expected: true },
    { name: 'stringAbcLessOrEqualFive', args: ['abc', 5], expected: false },
    { name: 'fiveLessOrEqualStringAbc', args: [5, 'abc'], expected: false },
    { name: 'negativeFiveBigLessOrEqualThreeBig', args: [-5n, 3n], expected: true },
    // Equal bigints: a third `<`-`false` case that flips to `true`.
    { name: 'threeBigLessOrEqualThreeBig', args: [3n, 3n], expected: true },
    { name: 'threeBigLessOrEqualNegativeFiveBig', args: [3n, -5n], expected: false },
    // `<=` compares a `Number` and a `BigInt` directly rather than throwing —
    // the opposite of `numberByBigint` in every arithmetic group above.
    { name: 'fiveBigLessOrEqualFiveHalf', args: [5n, 5.5], expected: true },
    // Equal-valued mixed number/bigint pair: another flip from `<`'s `false`.
    { name: 'fiveBigLessOrEqualFive', args: [5n, 5], expected: true },
    { name: 'fiveLessOrEqualFiveBig', args: [5, 5n], expected: true },
    { name: 'fiveBigLessOrEqualNan', args: [5n, NaN], expected: false },
    { name: 'nanLessOrEqualFiveBig', args: [NaN, 5n], expected: false },
    { name: 'fiveBigLessOrEqualInfinity', args: [5n, Infinity], expected: true },
    { name: 'negativeInfinityLessOrEqualFiveBig', args: [-Infinity, 5n], expected: true },
    { name: 'infinityLessOrEqualFiveBig', args: [Infinity, 5n], expected: false },
    { name: 'stringTenLessOrEqualTwentyBig', args: ['10', 20n], expected: true },
    { name: 'twentyBigLessOrEqualStringThirty', args: [20n, '30'], expected: true },
    { name: 'stringAbcLessOrEqualTwentyBig', args: ['abc', 20n], expected: false },
    { name: 'twentyBigLessOrEqualStringAbc', args: [20n, 'abc'], expected: false },
]

/**
 * `>` never throws, the same as `<`, and is defined as the reversed `<`:
 * `x > y` is `y < x`. So every case here is a `<` case with its operands
 * swapped and its same boolean kept — including the coercion family, where
 * the left operand still carries the coercion under test and `5` moves to
 * the right so `x > 5` reads the same way `x < 5` did — and the *NaN* rule
 * carries over unchanged: `NaN` anywhere is `false` in both directions, so
 * reversing never turns a `<`-`false` into a `>`-`true` the way it does for
 * an ordinary (non-`NaN`) unequal pair.
 *
 * @type {readonly Case<2>[]}
 */
const greaterThanCases = [
    { name: 'nullGreaterThanFive', args: [null, 5], expected: false },
    { name: 'undefinedGreaterThanFive', args: [undefined, 5], expected: false },
    { name: 'trueGreaterThanFive', args: [true, 5], expected: false },
    { name: 'falseGreaterThanFive', args: [false, 5], expected: false },
    { name: 'stringThreeGreaterThanFive', args: ['3', 5], expected: false },
    { name: 'stringLetterGreaterThanFive', args: ['a', 5], expected: false },
    { name: 'emptyArrayGreaterThanFive', args: [[], 5], expected: false },
    { name: 'arrayThreeGreaterThanFive', args: [[3], 5], expected: false },
    { name: 'arrayStringThreeGreaterThanFive', args: [['3'], 5], expected: false },
    { name: 'arrayPairGreaterThanFive', args: [[0, 0], 5], expected: false },
    { name: 'emptyObjectGreaterThanFive', args: [{}, 5], expected: false },
    // The one binary case that escapes: `functionValue` has no expression, so
    // both consumers take the direct path with two operands rather than one.
    { name: 'functionGreaterThanFive', args: [functionValue, 5], expected: false },
    { name: 'threeGreaterThanFive', args: [3, 5], expected: false },
    { name: 'fiveGreaterThanThree', args: [5, 3], expected: true },
    { name: 'fiveGreaterThanFive', args: [5, 5], expected: false },
    { name: 'zeroGreaterThanNegativeZero', args: [0, -0], expected: false },
    { name: 'negativeZeroGreaterThanZero', args: [-0, 0], expected: false },
    { name: 'nanGreaterThanOne', args: [NaN, 1], expected: false },
    { name: 'oneGreaterThanNan', args: [1, NaN], expected: false },
    { name: 'nanGreaterThanNan', args: [NaN, NaN], expected: false },
    { name: 'infinityGreaterThanOne', args: [Infinity, 1], expected: true },
    { name: 'oneGreaterThanInfinity', args: [1, Infinity], expected: false },
    { name: 'negativeInfinityGreaterThanInfinity', args: [-Infinity, Infinity], expected: false },
    { name: 'infinityGreaterThanInfinity', args: [Infinity, Infinity], expected: false },
    { name: 'stringTenGreaterThanStringNine', args: ['10', '9'], expected: false },
    { name: 'stringNineGreaterThanStringTen', args: ['9', '10'], expected: true },
    { name: 'stringAGreaterThanStringB', args: ['a', 'b'], expected: false },
    { name: 'emptyStringGreaterThanStringA', args: ['', 'a'], expected: false },
    { name: 'stringAbGreaterThanStringAbc', args: ['ab', 'abc'], expected: false },
    { name: 'stringAbcGreaterThanStringAb', args: ['abc', 'ab'], expected: true },
    { name: 'stringUppercaseBGreaterThanStringA', args: ['B', 'a'], expected: false },
    { name: 'stringTenGreaterThanNine', args: ['10', 9], expected: true },
    { name: 'nineGreaterThanStringTen', args: [9, '10'], expected: false },
    { name: 'stringAbcGreaterThanFive', args: ['abc', 5], expected: false },
    { name: 'fiveGreaterThanStringAbc', args: [5, 'abc'], expected: false },
    { name: 'negativeFiveBigGreaterThanThreeBig', args: [-5n, 3n], expected: false },
    { name: 'threeBigGreaterThanThreeBig', args: [3n, 3n], expected: false },
    { name: 'threeBigGreaterThanNegativeFiveBig', args: [3n, -5n], expected: true },
    // `>` compares a `Number` and a `BigInt` directly rather than throwing —
    // the opposite of `numberByBigint` in every arithmetic group above.
    { name: 'fiveBigGreaterThanFiveHalf', args: [5n, 5.5], expected: false },
    { name: 'fiveBigGreaterThanFive', args: [5n, 5], expected: false },
    { name: 'fiveGreaterThanFiveBig', args: [5, 5n], expected: false },
    { name: 'fiveBigGreaterThanNan', args: [5n, NaN], expected: false },
    { name: 'nanGreaterThanFiveBig', args: [NaN, 5n], expected: false },
    { name: 'fiveBigGreaterThanInfinity', args: [5n, Infinity], expected: false },
    { name: 'negativeInfinityGreaterThanFiveBig', args: [-Infinity, 5n], expected: false },
    { name: 'infinityGreaterThanFiveBig', args: [Infinity, 5n], expected: true },
    { name: 'stringTenGreaterThanTwentyBig', args: ['10', 20n], expected: false },
    { name: 'twentyBigGreaterThanStringThirty', args: [20n, '30'], expected: false },
    { name: 'stringAbcGreaterThanTwentyBig', args: ['abc', 20n], expected: false },
    { name: 'twentyBigGreaterThanStringAbc', args: [20n, 'abc'], expected: false },
]

/**
 * `>=` is the reversed `<=`: `x >= y` is `y <= x`. So every case here is a
 * `<=` case with its operands swapped and its same boolean kept, the same
 * relationship `>` has to `<` — including which cases flip relative to `>`
 * (equal operands, equal-valued mixed number/bigint pairs, equal infinities,
 * now giving `true`) and which stay `false` throughout because `NaN` is
 * involved, exactly as for `<=`.
 *
 * @type {readonly Case<2>[]}
 */
const greaterOrEqualCases = [
    { name: 'nullGreaterOrEqualFive', args: [null, 5], expected: false },
    { name: 'undefinedGreaterOrEqualFive', args: [undefined, 5], expected: false },
    { name: 'trueGreaterOrEqualFive', args: [true, 5], expected: false },
    { name: 'falseGreaterOrEqualFive', args: [false, 5], expected: false },
    { name: 'stringThreeGreaterOrEqualFive', args: ['3', 5], expected: false },
    { name: 'stringLetterGreaterOrEqualFive', args: ['a', 5], expected: false },
    { name: 'emptyArrayGreaterOrEqualFive', args: [[], 5], expected: false },
    { name: 'arrayThreeGreaterOrEqualFive', args: [[3], 5], expected: false },
    { name: 'arrayStringThreeGreaterOrEqualFive', args: [['3'], 5], expected: false },
    { name: 'arrayPairGreaterOrEqualFive', args: [[0, 0], 5], expected: false },
    { name: 'emptyObjectGreaterOrEqualFive', args: [{}, 5], expected: false },
    // The one binary case that escapes: `functionValue` has no expression, so
    // both consumers take the direct path with two operands rather than one.
    { name: 'functionGreaterOrEqualFive', args: [functionValue, 5], expected: false },
    { name: 'threeGreaterOrEqualFive', args: [3, 5], expected: false },
    { name: 'fiveGreaterOrEqualThree', args: [5, 3], expected: true },
    // Equal operands: where `>` was `false`, `>=` flips to `true`.
    { name: 'fiveGreaterOrEqualFive', args: [5, 5], expected: true },
    { name: 'zeroGreaterOrEqualNegativeZero', args: [0, -0], expected: true },
    { name: 'negativeZeroGreaterOrEqualZero', args: [-0, 0], expected: true },
    // `NaN` involved anywhere stays `false` — the one case negating `>`
    // would get wrong.
    { name: 'nanGreaterOrEqualOne', args: [NaN, 1], expected: false },
    { name: 'oneGreaterOrEqualNan', args: [1, NaN], expected: false },
    { name: 'nanGreaterOrEqualNan', args: [NaN, NaN], expected: false },
    { name: 'infinityGreaterOrEqualOne', args: [Infinity, 1], expected: true },
    { name: 'oneGreaterOrEqualInfinity', args: [1, Infinity], expected: false },
    { name: 'negativeInfinityGreaterOrEqualInfinity', args: [-Infinity, Infinity], expected: false },
    // Equal infinities: another `>`-`false` case that flips to `true`.
    { name: 'infinityGreaterOrEqualInfinity', args: [Infinity, Infinity], expected: true },
    { name: 'stringTenGreaterOrEqualStringNine', args: ['10', '9'], expected: false },
    { name: 'stringNineGreaterOrEqualStringTen', args: ['9', '10'], expected: true },
    { name: 'stringAGreaterOrEqualStringB', args: ['a', 'b'], expected: false },
    { name: 'emptyStringGreaterOrEqualStringA', args: ['', 'a'], expected: false },
    { name: 'stringAbGreaterOrEqualStringAbc', args: ['ab', 'abc'], expected: false },
    { name: 'stringAbcGreaterOrEqualStringAb', args: ['abc', 'ab'], expected: true },
    { name: 'stringUppercaseBGreaterOrEqualStringA', args: ['B', 'a'], expected: false },
    { name: 'stringTenGreaterOrEqualNine', args: ['10', 9], expected: true },
    { name: 'nineGreaterOrEqualStringTen', args: [9, '10'], expected: false },
    { name: 'stringAbcGreaterOrEqualFive', args: ['abc', 5], expected: false },
    { name: 'fiveGreaterOrEqualStringAbc', args: [5, 'abc'], expected: false },
    { name: 'negativeFiveBigGreaterOrEqualThreeBig', args: [-5n, 3n], expected: false },
    // Equal bigints: a third `>`-`false` case that flips to `true`.
    { name: 'threeBigGreaterOrEqualThreeBig', args: [3n, 3n], expected: true },
    { name: 'threeBigGreaterOrEqualNegativeFiveBig', args: [3n, -5n], expected: true },
    // `>=` compares a `Number` and a `BigInt` directly rather than throwing —
    // the opposite of `numberByBigint` in every arithmetic group above.
    { name: 'fiveBigGreaterOrEqualFiveHalf', args: [5n, 5.5], expected: false },
    // Equal-valued mixed number/bigint pair: another flip from `>`'s `false`.
    { name: 'fiveBigGreaterOrEqualFive', args: [5n, 5], expected: true },
    { name: 'fiveGreaterOrEqualFiveBig', args: [5, 5n], expected: true },
    { name: 'fiveBigGreaterOrEqualNan', args: [5n, NaN], expected: false },
    { name: 'nanGreaterOrEqualFiveBig', args: [NaN, 5n], expected: false },
    { name: 'fiveBigGreaterOrEqualInfinity', args: [5n, Infinity], expected: false },
    { name: 'negativeInfinityGreaterOrEqualFiveBig', args: [-Infinity, 5n], expected: false },
    { name: 'infinityGreaterOrEqualFiveBig', args: [Infinity, 5n], expected: true },
    { name: 'stringTenGreaterOrEqualTwentyBig', args: ['10', 20n], expected: false },
    { name: 'twentyBigGreaterOrEqualStringThirty', args: [20n, '30'], expected: false },
    { name: 'stringAbcGreaterOrEqualTwentyBig', args: ['abc', 20n], expected: false },
    { name: 'twentyBigGreaterOrEqualStringAbc', args: [20n, 'abc'], expected: false },
]

/**
 * `!` coerces its operand with `ToBoolean` and negates — the value never
 * reaches `ToPrimitive`/`ToNumeric` the way the arithmetic and comparison
 * groups' operands do, so array and object operands go straight to `true`
 * (every object is truthy) rather than through a coercion chain that could
 * fail or produce something else first.
 *
 * @type {readonly Case<1>[]}
 */
const notCases = [
    { name: 'null', args: [null], expected: true },
    { name: 'undefined', args: [undefined], expected: true },
    { name: 'booleanFalse', args: [false], expected: true },
    { name: 'booleanTrue', args: [true], expected: false },
    { name: 'numberZero', args: [0], expected: true },
    { name: 'numberNegativeZero', args: [-0], expected: true },
    { name: 'numberNan', args: [NaN], expected: true },
    { name: 'numberPositive', args: [2.3], expected: false },
    { name: 'numberNegative', args: [-2.3], expected: false },
    { name: 'stringEmpty', args: [''], expected: true },
    { name: 'stringNonEmpty', args: ['a'], expected: false },
    { name: 'bigintZero', args: [0n], expected: true },
    { name: 'bigintPositive', args: [5n], expected: false },
    { name: 'bigintNegative', args: [-5n], expected: false },
    { name: 'emptyArray', args: [[]], expected: false },
    { name: 'emptyObject', args: [{}], expected: false },
    { name: 'function', args: [functionValue], expected: false },
]

/**
 * `&&`/`||`/`??` all *select* one operand rather than coercing either one, so
 * — unlike every group above — the value a case returns is the operand
 * itself, not a derived primitive. That is observable only for a reference
 * type (array, object, function): `Object.is`/`===` compare those by
 * identity, and the corpus lowers each operand to a node of its own (nothing
 * outside the `eq` section's `ref`s aliases two nodes), so a case whose
 * `expected` needs to be *the same* array, object, or function the operand
 * built would compare unequal to a freshly-lowered copy. Every case below is
 * chosen so a reference-typed operand is only ever on the *discarded* side —
 * proving these operators are truthy/nullish-aware for those types without
 * needing their identity preserved across the corpus's operand/expected
 * split.
 *
 * `&&`/`||` key off `ToBoolean` — the same coercion `!` uses above, so a
 * falsy-but-not-nullish value (`0`, `NaN`, `''`) behaves like `null` here,
 * unlike `??`, which keys off nullishness alone.
 *
 * What these cases do *not* prove: that the discarded operand's evaluation
 * is actually skipped. `&&`/`||`/`??`/`?:` are the one place in JavaScript
 * where that is these operators' defining behaviour — but every `Operand` in
 * this corpus is `Value | FunctionValue` (see `types.ts`), and `Value` admits
 * no expression whose evaluation is observable (no side effect, no throw:
 * `Throws` is legal only as an `expected`, never an operand). Both consumers
 * build every argument before dispatch — `run` in `proof.f.mjs`, `result` in
 * `rust/module.f.mjs` — so there is nothing an unevaluated operand could do
 * differently from an evaluated one for this corpus to catch. What these
 * cases prove is the other half: *which* operand comes back.
 *
 * @type {readonly Case<2>[]}
 */
const andCases = [
    { name: 'falseAndTrue', args: [false, true], expected: false },
    { name: 'trueAndFalse', args: [true, false], expected: false },
    { name: 'trueAndTrue', args: [true, true], expected: true },
    { name: 'nullAndOne', args: [null, 1], expected: null },
    { name: 'undefinedAndOne', args: [undefined, 1], expected: undefined },
    { name: 'zeroAndOne', args: [0, 1], expected: 0 },
    { name: 'nanAndOne', args: [NaN, 1], expected: NaN },
    { name: 'oneAndZero', args: [1, 0], expected: 0 },
    { name: 'oneAndTwo', args: [1, 2], expected: 2 },
    { name: 'emptyStringAndOne', args: ['', 1], expected: '' },
    { name: 'nonEmptyStringAndOne', args: ['a', 1], expected: 1 },
    { name: 'bigZeroAndOne', args: [0n, 1], expected: 0n },
    { name: 'bigOneAndTwo', args: [1n, 2], expected: 2 },
    // Every object is truthy, so an array/object/function on the left is
    // always discarded in favor of the right — never the operand `&&` has to
    // hand back, which is what keeps these identity-safe (see the group
    // comment above).
    { name: 'emptyArrayAndOne', args: [[], 1], expected: 1 },
    { name: 'emptyObjectAndOne', args: [{}, 1], expected: 1 },
    { name: 'functionAndOne', args: [functionValue, 1], expected: 1 },
]

/** @type {readonly Case<2>[]} */
const orCases = [
    { name: 'falseOrTrue', args: [false, true], expected: true },
    { name: 'trueOrFalse', args: [true, false], expected: true },
    { name: 'falseOrFalse', args: [false, false], expected: false },
    { name: 'nullOrOne', args: [null, 1], expected: 1 },
    { name: 'undefinedOrOne', args: [undefined, 1], expected: 1 },
    { name: 'zeroOrOne', args: [0, 1], expected: 1 },
    { name: 'nanOrOne', args: [NaN, 1], expected: 1 },
    { name: 'oneOrZero', args: [1, 0], expected: 1 },
    { name: 'oneOrTwo', args: [1, 2], expected: 1 },
    { name: 'emptyStringOrOne', args: ['', 1], expected: 1 },
    { name: 'nonEmptyStringOrOne', args: ['a', 1], expected: 'a' },
    { name: 'bigZeroOrOne', args: [0n, 1], expected: 1 },
    { name: 'bigOneOrTwo', args: [1n, 2], expected: 1n },
    // Every object is truthy, so an array/object/function is always picked
    // when it is the *left* operand — the identity-unsafe side for `||` —
    // so each is placed on the right instead, where a truthy left discards
    // it.
    { name: 'oneOrEmptyArray', args: [1, []], expected: 1 },
    { name: 'oneOrEmptyObject', args: [1, {}], expected: 1 },
    { name: 'oneOrFunction', args: [1, functionValue], expected: 1 },
]

/** @type {readonly Case<2>[]} */
const nullishCases = [
    { name: 'nullCoalesceOne', args: [null, 1], expected: 1 },
    { name: 'undefinedCoalesceOne', args: [undefined, 1], expected: 1 },
    // Falsy but not nullish: stays on the left, unlike `andCases`/`orCases`.
    { name: 'zeroCoalesceOne', args: [0, 1], expected: 0 },
    { name: 'falseCoalesceOne', args: [false, 1], expected: false },
    { name: 'nanCoalesceOne', args: [NaN, 1], expected: NaN },
    { name: 'emptyStringCoalesceOne', args: ['', 1], expected: '' },
    { name: 'bigZeroCoalesceOne', args: [0n, 1], expected: 0n },
    { name: 'oneCoalesceTwo', args: [1, 2], expected: 1 },
    { name: 'oneCoalesceNull', args: [1, null], expected: 1 },
    // No object is ever nullish, so each is placed on the right, where a
    // non-nullish left discards it — the identity-safe side.
    { name: 'oneCoalesceEmptyArray', args: [1, []], expected: 1 },
    { name: 'oneCoalesceEmptyObject', args: [1, {}], expected: 1 },
    { name: 'oneCoalesceFunction', args: [1, functionValue], expected: 1 },
]

/**
 * `?:`, the corpus's one ternary group (see `NonEdagGroup` in `types.ts`):
 * `args` is `[condition, consequent, alternate]`, and `expected` is whichever
 * branch `ToBoolean(condition)` selects — the same coercion `!`/`&&`/`||`
 * use. Like those, this selects an operand rather than coercing it, so a
 * reference-typed value only ever appears as the *condition*, the one
 * position that is always discarded (see the `&&`/`||`/`??` group comment
 * above for why that matters, and for why — the same as those three — these
 * cases cannot prove the *unselected* branch goes unevaluated).
 *
 * @type {readonly Case<3>[]}
 */
const ternaryCases = [
    { name: 'truePicksConsequent', args: [true, 1, 2], expected: 1 },
    { name: 'falsePicksAlternate', args: [false, 1, 2], expected: 2 },
    { name: 'nullPicksAlternate', args: [null, 1, 2], expected: 2 },
    { name: 'undefinedPicksAlternate', args: [undefined, 1, 2], expected: 2 },
    { name: 'zeroPicksAlternate', args: [0, 1, 2], expected: 2 },
    { name: 'nanPicksAlternate', args: [NaN, 1, 2], expected: 2 },
    { name: 'emptyStringPicksAlternate', args: ['', 1, 2], expected: 2 },
    { name: 'nonEmptyStringPicksConsequent', args: ['a', 1, 2], expected: 1 },
    { name: 'bigZeroPicksAlternate', args: [0n, 1, 2], expected: 2 },
    { name: 'bigNonZeroPicksConsequent', args: [5n, 1, 2], expected: 1 },
    { name: 'emptyArrayPicksConsequent', args: [[], 1, 2], expected: 1 },
    { name: 'emptyObjectPicksConsequent', args: [{}, 1, 2], expected: 1 },
    { name: 'functionPicksConsequent', args: [functionValue, 1, 2], expected: 1 },
    { name: 'truePicksStringConsequent', args: [true, 'yes', 'no'], expected: 'yes' },
    { name: 'falsePicksBigAlternate', args: [false, 1n, 2n], expected: 2n },
]

/**
 * `typeof`, the corpus's other group with no canonical EDAG id (see
 * `NonEdagGroup` in `types.ts`) — it returns a tag naming the operand's own
 * kind, so unlike `!`/`&&`/`||`/`??`/`?:` there is no identity concern here:
 * the result is always a fresh string, never the operand itself.
 *
 * @type {readonly Case<1>[]}
 */
const typeofCases = [
    { name: 'undefined', args: [undefined], expected: 'undefined' },
    { name: 'null', args: [null], expected: 'object' },
    { name: 'booleanTrue', args: [true], expected: 'boolean' },
    { name: 'booleanFalse', args: [false], expected: 'boolean' },
    { name: 'number', args: [2.3], expected: 'number' },
    { name: 'numberNan', args: [NaN], expected: 'number' },
    { name: 'string', args: ['a'], expected: 'string' },
    { name: 'stringEmpty', args: [''], expected: 'string' },
    { name: 'bigint', args: [5n], expected: 'bigint' },
    { name: 'bigintZero', args: [0n], expected: 'bigint' },
    { name: 'emptyArray', args: [[]], expected: 'object' },
    { name: 'array', args: [[1, 2]], expected: 'object' },
    { name: 'emptyObject', args: [{}], expected: 'object' },
    { name: 'object', args: [{ a: 1 }], expected: 'object' },
    { name: 'function', args: [functionValue], expected: 'function' },
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
        { op: '/', cases: divCases },
        { op: '**', cases: expCases },
        { op: '-', cases: subCases },
        { op: '+', cases: addCases },
        { op: '%', cases: remCases },
        { op: '<', cases: lessThanCases },
        { op: '<=', cases: lessOrEqualCases },
        { op: '>', cases: greaterThanCases },
        { op: '>=', cases: greaterOrEqualCases },
        { op: '!', cases: notCases },
        { op: '&&', cases: andCases },
        { op: '||', cases: orCases },
        { op: '??', cases: nullishCases },
        { nanvmOp: 'ternary', cases: ternaryCases },
        { nanvmOp: 'typeof', cases: typeofCases },
        { op: 'String', cases: stringCoercionCases },
    ],
}
