/**
 * The single source of truth for `nanvm-lib` operator behaviour.
 *
 * Every operator case is named once here, with the arguments and the expected
 * result written as ordinary JavaScript values. Two consumers read it, so a
 * new case is written once and checked twice:
 *
 * - [`proof.f.mjs`](./proof.f.mjs) evaluates each case through represented
 *   EDAG interpretation and cross-checks independent native JavaScript
 *   operations, excluding canonical function text only from that cross-check.
 * - [`rust/module.f.mjs`](./rust/module.f.mjs) prints each case as Rust,
 *   producing `nanvm-lib/tests/test/gen.corpus/`, which runs the same case
 *   against `nanvm-lib`.
 *
 * Beside the data are the format's **constructors** (`functionValue`,
 * `callback`, `returns`, `ref`, `throws`, `unreached`, written in
 * [`constructors/module.f.js`](./constructors/module.f.js) and re-exported
 * here), its **eliminators** (`isThrows`, `hasUnreached`,
 * `orders`, `groupKey`, `casesOf`, `arityOf`), and the **lowering** that
 * turns a case into the EDAG expression it denotes (`lambdaExp`,
 * `unreachedExp`, `sharedExp`, `valuesExp`, `valueExp`, `caseExp`). All
 * three exist so that neither consumer has to re-implement a rule of the
 * corpus format: a rule written twice is a rule that drifts.
 *
 * Operation identity comes from [`fjs/edag`](../edag/README.md) and is not
 * restated here — a group's `op` is an `Op1Id`, an `Op2Id`, an `Op12Id`, or
 * an `Op3Id`, and which vocabulary it is in is what fixes the case's operand
 * count — except for an `Op12Id`, legal at both of the first two counts,
 * where the group's own `arity` does.
 *
 * The operator groups are written here; the member-function groups are in
 * [`member/module.f.mjs`](./member/module.f.mjs), so that no one file
 * outgrows the repository's file reader.
 *
 * Cases `nanvm-lib` does not implement yet carry a `rust` reason and are
 * emitted as commented-out `TODO`s instead of being silently dropped — the
 * gaps between the two implementations are part of the data.
 *
 * @module
 *
 * @import { Exp, Op1, Op1Id, Op12, Op12Id, Op2, Op2Id, Op3, Op3Id } from '../edag/types.ts'
 * @import { AnyCase, CallbackName, Case, Data, Expectation, Group, OperatorGroup, SharedNode, Struct, Throws, Value } from './types.ts'
 *
 * @example
 *
 * ```js
 * import { data } from './module.f.mjs'
 *
 * data.groups.length // 73
 * ```
 */

import { fromValue, op1Id, op3Id } from '../edag/module.f.mjs'
import { validate } from '../rtti/validate/module.f.mjs'
import { callback, functionText, functionValue, ref, returns, throws, unreached } from './constructors/module.f.js'
import { groups as memberGroups } from './member/module.f.mjs'

export { callback, functionValue, ref, returns, throws, unreached } from './constructors/module.f.js'

const { entries } = Object

/** Membership in the unary vocabulary, from the schema rather than a copy. */
const isOp1Id = validate(op1Id)

/** The same, for the ternary vocabulary. */
const isOp3Id = validate(op3Id)

// Eliminators — the constructors read back, so each rule has one owner.

/**
 * `true` when a case's `expected` is `throws` rather than a value.
 *
 * @param {Expectation} v
 * @returns {v is Throws}
 */
export const isThrows = v => typeof v === 'function' && v()[0] === 'throw'

/**
 * `true` when a value is, or holds, an `unreached` — the one value that has
 * none to hand a JavaScript operator, since establishing it is the thing the
 * case claims does not happen; and a container holding one is established
 * with it, so it has none either. Walks arrays and objects as the lowering
 * does, since `Value` admits a thunk at any depth.
 *
 * @type {(v: Value) => boolean}
 */
export const hasUnreached = v => {
    if (typeof v === 'function') { return v()[0] === 'unreached' }
    if (Array.isArray(v)) { return v.some(hasUnreached) }
    return typeof v === 'object' && v !== null && Object.values(v).some(hasUnreached)
}

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
 * @type {(g: Group) => (c: AnyCase) => readonly (readonly[string, readonly Value[]])[]}
 */
export const orders = g => c => isCommutative(g)
    ? [[c.name, c.args], [`${c.name}Swapped`, c.args.toReversed()]]
    : [[c.name, c.args]]

/**
 * The name both consumers file a group under: the proof's test key, and the
 * key of the printer's Rust-name table.
 *
 * For a method group it is the method name after a `.`, `'.at'`, which no
 * operation tag is, so a method never files under an operator's key. For
 * every operator group but an `Op12` one it is the operation tag. Two `Op12`
 * groups share a tag and differ in arity — `-` at one operand is negation, at
 * two subtraction — so theirs carries the arity too: `'-/1'`, `'-/2'`. One
 * owner for the spelling, as `orders` is for the `Swapped` suffix: spelled
 * separately in the two consumers, the JavaScript and Rust names for one
 * group would silently diverge.
 *
 * @type {(g: Group) => string}
 */
export const groupKey = g =>
    'method' in g ? `.${g.method}`
    : 'arity' in g ? `${g.op}/${g.arity}`
    : g.op

/**
 * A group's cases, read without first deciding which kind of group it is.
 *
 * The operand count is the point of the three group types, and it is fixed
 * before a consumer gets here; walking the cases does not need it back.
 *
 * @type {(g: Group) => readonly AnyCase[]}
 */
export const casesOf = g => g.cases

/**
 * How many operands a group's operation takes.
 *
 * Which vocabulary the id belongs to is what fixes the count — the same rule
 * the group types carry — so this asks the schema rather than a second copy
 * of the vocabulary. An `Op12` group is the exception: its id is legal at
 * both arities, so the group carries the count itself and is read first. It
 * is the runtime half of what `Group1`/`Group2`/`Group12`/`Group3` say
 * statically, for the consumers that walk `data.groups` and so hold a
 * `Group` whose arm is no longer known.
 *
 * A method group has no such count — a call takes any number of arguments
 * — so it is not asked.
 *
 * @type {(g: OperatorGroup) => 1 | 2 | 3}
 */
export const arityOf = g => {
    if ('arity' in g) { return g.arity }
    if (isOp1Id(g.op)[0] === 'ok') { return 1 }
    return isOp3Id(g.op)[0] === 'ok' ? 3 : 2
}

// Lowering — a case as the EDAG expression it denotes.

/**
 * The expression a `functionValue` denotes: `() => undefined`, the smallest
 * closure — an empty frame and a body that is the `undefined` node.
 *
 * A fresh node on every call, like every other lowered value, so two
 * function operands are two closures and never one node reached twice.
 * Both consumers know this shape: `amnesia` establishes it as any `=>`,
 * and the Rust printer renders exactly this node as the harness's one
 * function value, `function_any()`, as it does a compiled `() => undefined`,
 * the same node; its text is the writer's, `()=>undefined`.
 *
 * @type {() => Exp}
 */
export const lambdaExp = () => ['=>', 0, [], ['undefined']]

/** `a[i]`, over the invocation's rest array: how a callback reads its arguments. @type {(i: number) => Exp} */
const restAt = i => ['.', ['rest'], i]

/**
 * The corpus's callbacks by name, each the body of a function of one rest
 * parameter, `(...a) => body`, with its JavaScript spelling:
 *
 * - `args`, `(...a) => a`: what the callback was given, so a `map(args)`
 *   case pins the element, the index, the array and how many there are —
 *   `reduce`'s four included.
 * - `first`, `(...a) => a[0]`: the element itself, a predicate by its
 *   truthiness.
 * - `prop`, `(...a) => a[0].x`: truthy on `{ x: 1 }`, falsy on `{}`, and a
 *   throw on `null`, so a case can prove an element was never visited.
 * - `double`, `(...a) => a[0] * 2`.
 * - `add`, `(...a) => a[0] + a[1]`: a fold whose order shows with strings.
 * - `pair`, `(...a) => [a[0], [a[0]]]`: one level of an array, and one below.
 * - `ascending`, `(...a) => a[0] - a[1]`, and `descending`,
 *   `(...a) => a[1] - a[0]`: comparators.
 * - `zero`, `() => 0`: a comparator calling every pair equal, which only a
 *   stable sort answers with the elements in their order.
 *
 * @type {{ readonly [k in CallbackName]: () => Exp }}
 */
export const callbacks = {
    args: () => ['rest'],
    first: () => restAt(0),
    prop: () => ['.', restAt(0), 'x'],
    double: () => ['*', restAt(0), 2],
    add: () => ['+', restAt(0), restAt(1)],
    pair: () => ['[]', [restAt(0), ['[]', [restAt(0)]]]],
    ascending: () => ['-', restAt(0), restAt(1)],
    descending: () => ['-', restAt(1), restAt(0)],
    zero: () => 0,
}

/**
 * A function with a body: `(...a) => body`, no captures, a fresh node on
 * every call like {@link lambdaExp}. What a `callback` and a `returns`
 * both lower to; they differ only in the body.
 *
 * @type {(body: Exp) => Exp}
 */
export const functionExp = body => ['=>', 0, [], body]

/**
 * The expression a callback denotes: the {@link functionExp} of its body.
 *
 * @type {(name: CallbackName) => Exp}
 */
export const callbackExp = name => functionExp(callbacks[name]())

/**
 * The expression an `unreached` denotes: `1n / 0n`, which throws when
 * established — a `RangeError` in JavaScript, an `Err` in `nanvm-lib`, the
 * corpus's own `bigTenDividedByZero` on both. An operation rather than a
 * throw node, because the schema has no throw node and needs none for this:
 * what a lazy operand must not do is be established, and any established
 * operation that throws observes that. Both consumers read it as the
 * ordinary node it is: `amnesia` establishes it only where the operator is
 * eager, and the Rust printer prints it as the thunk a lazy position takes,
 * `|| bigint_any(1) / bigint_any(0)`, the operation's own `Result` being
 * the closure's answer.
 *
 * A fresh node on every call, like {@link lambdaExp}.
 *
 * @type {() => Exp}
 */
export const unreachedExp = () => ['/', 1n, 0n]

/**
 * Lowers a value to the EDAG expression that denotes it.
 *
 * `resolve` supplies the node a `ref` names — the *same* node for every
 * reference, which is what makes `ref` mean EDAG sharing (one node reached
 * from several places) rather than an equal copy. Every other operand gets a
 * fresh node, so a multiply-referenced node in a derived expression is always
 * a `ref` and never an accident of the walk.
 *
 * A {@link Value} admits five thunks, and this walk has a case for each: a
 * `ref` resolves, a `functionValue` is {@link lambdaExp}, a `callback` is
 * {@link callbackExp}, a `returns` is the {@link functionExp} of its value,
 * and an `unreached` is {@link unreachedExp}. `throws` is an {@link Expectation}, not spellable
 * here, so it is not rejected here either.
 *
 * @type {(resolve: (name: string) => Exp) => (v: Value) => Exp}
 */
const constExp = resolve => fromValue(v => {
    const info = v()
    return info[0] === 'ref' ? resolve(info[1])
        : info[0] === 'function' ? lambdaExp()
        : info[0] === 'callback' ? callbackExp(info[1])
        : info[0] === 'returns' ? functionExp(valueExp(info[1]))
        : unreachedExp()
})

/**
 * The expression a value denotes, where nothing is shared. Every `expected`
 * is such a value: an expectation describes an outcome, and an outcome is
 * never one of the corpus's shared objects.
 *
 * @type {(v: Value) => Exp}
 */
export const valueExp = constExp(name => { throw ['no shared value here', name] })

/**
 * The expression a case denotes: the group's operation applied to its lowered
 * operands, so `mulCases[0]` is `['*', null, null]`.
 *
 * The shared nodes come first because an operand may be a `ref` to one, and
 * two `ref`s to a name must lower to one node rather than two equal ones —
 * which is the whole of what the `'==='` group's `byItself` cases assert.
 * Both consumers hand over the corpus's nodes for every group alike. A
 * group with no `ref` among its operands reaches none of them, which is what
 * makes that uniform rather than wasteful.
 *
 * @type {(shared: readonly SharedNode[]) => (g: Group) => (args: readonly Value[]) => Exp}
 */
export const caseExp = shared => g => args => {
    if ('method' in g) { return methodExp(valuesExp(shared))(g.method)(args) }
    // The operand count comes from the group, not from the operands. A
    // `Case<N>` cannot carry the wrong number, but this function is exported
    // and its `args` are a plain array, so a caller can hand over a count the
    // operation does not take — refused here rather than answered with a node
    // that fails the `exp` schema.
    const n = arityOf(g)
    if (args.length !== n) { throw ['wrong operand count for', g.op, args] }
    const [a, b, c] = args.map(valuesExp(shared))
    // `n` decides which vocabularies the tag can be in, and the check above
    // makes that agree with the operands. The casts are that step and nothing
    // more: an `Op12Id` is legal at either of the first two counts, so it is
    // in both.
    /** @type {Op1 | Op2 | Op12 | Op3} */
    const e = n === 1
        ? [/** @type {Op1Id | Op12Id} */ (g.op), a]
        : n === 2
            ? [/** @type {Op2Id | Op12Id} */ (g.op), a, b]
            : [/** @type {Op3Id} */ (g.op), a, b, c]
    return e
}

/**
 * The expression a method case denotes: the call `receiver.method(...rest)`
 * as the chain node a compiled one is — the `.` read owning its `|()` call
 * step, the arguments its item list
 * ([Chains](../edag/README.md#chains)). So `[1, 2].at(0)` is
 * `['.', ['[]', [1, 2]], 'at', ['|()', [0]]]`.
 *
 * A case holds its receiver, so `args` is never empty; the refusal is for a
 * caller of the exported `caseExp`, whose `args` are a plain array.
 *
 * @type {(f: (v: Value) => Exp) => (method: string) => (args: readonly Value[]) => Exp}
 */
const methodExp = f => method => args => {
    if (args.length === 0) { throw ['a method case has no receiver', method] }
    const [receiver, ...rest] = args.map(f)
    return ['.', receiver, method, ['|()', rest]]
}

/**
 * The node a shared name is bound to, among the ones bound before it.
 *
 * @type {(done: readonly SharedNode[]) => (name: string) => Exp}
 */
const resolve = done => name => {
    const found = done.find(([k]) => k === name)
    if (found === undefined) { throw ['unknown shared value', name] }
    return found[1]
}

/**
 * A corpus's shared values as nodes, in order.
 *
 * Each is lowered against the ones already lowered, so a `ref` inside one
 * reaches the node an earlier entry bound and sharing nests. A name is in
 * scope only after its own entry, which is what makes a forward reference —
 * and with it a cycle, which no EDAG may have — unspellable rather than
 * something to detect.
 *
 * A shared value holding an `unreached` is refused: a shared value is
 * established before any case, on both sides — the proof's `memo`, the
 * printer's `let` binding — so it can be nothing a case must not
 * establish, and a `ref` to it from a lazy position would claim exactly
 * that. `Struct` admits the thunk because an object *operand* may hold one;
 * the refusal is what keeps `shared` from meaning two things.
 *
 * @type {(shared: Struct) => readonly SharedNode[]}
 */
export const sharedExp = shared => entries(shared).reduce(
    (/** @type {readonly SharedNode[]} */ done, [k, v]) => {
        if (hasUnreached(v)) { throw ['a shared value is established before any case, so it cannot be unreached', k] }
        return [...done, /** @type {SharedNode} */ ([k, constExp(resolve(done))(v)])]
    },
    [])

/**
 * The expression a value denotes, with `ref` resolving against the given
 * shared nodes. Every operand of a case is such a value.
 *
 * @type {(shared: readonly SharedNode[]) => (v: Value) => Exp}
 */
export const valuesExp = shared => constExp(resolve(shared))

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
        // `OrdinaryToPrimitive` with the `number` hint: `valueOf` first,
        // then `toString`, each an own method if the object has one.
        { name: 'objectOwnValueOf', args: [{ valueOf: functionValue }], expected: NaN },
        { name: 'objectOwnValueOfNumber', args: [{ valueOf: returns(2.3) }], expected: result(2.3) },
        { name: 'objectOwnToString', args: [{ toString: returns('2.3') }], expected: result(2.3) },
        { name: 'objectOwnBoth', args: [{ valueOf: returns(1), toString: returns('2') }], expected: result(1) },
        // A method that is no function is skipped.
        { name: 'objectOwnValueOfNotAFunction', args: [{ valueOf: 'x' }], expected: NaN },
        // A result that is no primitive moves on to the next method.
        { name: 'objectOwnValueOfNotPrimitive', args: [{ valueOf: returns({}), toString: returns('2') }], expected: result(2) },
        { name: 'objectOwnNoPrimitive', args: [{ toString: returns([]) }], expected: throws },
        { name: 'objectOwnValueOfThrows', args: [{ valueOf: returns(unreached), toString: returns('2') }], expected: throws },
        { name: 'function', args: [functionValue], expected: NaN },
    ]
}

/**
 * The left operands every `ToNumeric` binary group opens with, each with its
 * name and the number `ToNumeric` makes of it. `n` is the number the string
 * and array rows spell, named `word`.
 *
 * @type {(n: number, word: string) => readonly (readonly [string, Value, number])[]}
 */
const toNumericOperands = (n, word) => [
    ['null', null, 0],
    ['undefined', undefined, NaN],
    ['true', true, 1],
    ['false', false, 0],
    [`string${word}`, `${n}`, n],
    ['stringLetter', 'a', NaN],
    ['emptyArray', [], 0],
    [`array${word}`, [n], n],
    [`arrayString${word}`, [`${n}`], n],
    ['arrayPair', [0, 0], NaN],
    ['emptyObject', {}, NaN],
    ['function', functionValue, NaN],
]

/**
 * Each left operand against one fixed right operand, named
 * `<operand><op><right>`, expecting the group's `f` applied to the
 * operand's number and the right one. `f` is the operator on two numbers,
 * so a row checks the coercion and the operator is checked by the group's
 * own rows.
 *
 * @type {(left: readonly (readonly [string, Value, number])[]) => (op: string, right: number, rightWord: string) => (f: (a: number, b: number) => number) => readonly Case<2>[]}
 */
const againstRight = left => (op, right, rightWord) => f => left.map(([name, v, n]) => ({
    name: `${name}${op}${rightWord}`,
    args: [v, right],
    expected: f(n, right),
}))

/**
 * The rows every `ToNumeric` binary group shares, over the number ten.
 *
 * Keeping them in one table is the move {@link numberCoercionCases} makes for
 * `+n` and `-n`: an operand added to the coercion space lands in every group
 * at once, here and in the generated Rust tests alike.
 */
const coercionCases = againstRight(toNumericOperands(10, 'Ten'))

/**
 * The rows `&`, `|`, `^`, `<<`, `>>` and `>>>` share: {@link coercionCases},
 * then the `Number`s `ToInt32` (or `ToUint32`) changes before the operator
 * sees them — a fraction truncates toward zero, a non-finite value is `+0`.
 *
 * @type {(op: string, right: number, rightWord: string) => (f: (a: number, b: number) => number) => readonly Case<2>[]}
 */
const int32Cases = (op, right, rightWord) => f => [
    ...coercionCases(op, right, rightWord)(f),
    { name: 'truncatesTowardZero', args: [3.9, right], expected: f(3.9, right) },
    { name: 'negativeTruncatesTowardZero', args: [-3.9, right], expected: f(-3.9, right) },
    ...againstRight([
        ['nan', NaN, NaN],
        ['infinity', Infinity, Infinity],
        ['negativeInfinity', -Infinity, -Infinity],
    ])(op, right, rightWord)(f),
]

/**
 * A number and a bigint never mix: every arithmetic operator throws on them.
 * A `commutative` group takes this one order, which it checks swapped too.
 *
 * @type {(op: string) => Case<2>}
 */
const numberBigintCase = op => ({ name: `number${op}Bigint`, args: [1, 1n], expected: throws })

/**
 * Both orders of {@link numberBigintCase}, for a group that is not
 * `commutative`.
 *
 * @type {(op: string) => readonly Case<2>[]}
 */
const mixedCases = op => [
    numberBigintCase(op),
    { name: `bigint${op}Number`, args: [1n, 1], expected: throws },
]

/**
 * `*` between a number and a bigint throws, so the pairs below never mix the
 * two except in the case that proves it. Every pair is checked in both orders
 * — see `commutative`.
 *
 * @type {readonly Case<2>[]}
 */
const mulCases = [
    ...coercionCases('By', 1, 'One')((a, b) => a * b),
    { name: 'nullByNull', args: [null, null], expected: 0 },
    { name: 'nullByZero', args: [null, 0], expected: 0 },
    { name: 'undefinedByZero', args: [undefined, 0], expected: NaN },
    { name: 'trueByZero', args: [true, 0], expected: 0 },
    { name: 'trueByTen', args: [true, 10], expected: 10 },
    { name: 'falseByZero', args: [false, 0], expected: 0 },
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
    { name: 'stringBigintByOne', args: ['1n', 1], expected: NaN },
    numberBigintCase('By'),
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
    ...coercionCases('DividedBy', 4, 'Four')((a, b) => a / b),
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
    ...mixedCases('DividedBy'),
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
    // Over three, not ten: the rows spell `stringThree`, and a name is a Rust test's.
    ...againstRight(toNumericOperands(3, 'Three'))('ToThePowerOf', 2, 'Two')((a, b) => a ** b),
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
    ...mixedCases('ToThePowerOf'),
]

/**
 * Subtraction has the same numeric coercion and mixed-number-kind rejection
 * as multiplication, but its operand order is observable.
 *
 * @type {readonly Case<2>[]}
 */
const subCases = [
    ...coercionCases('Minus', 1, 'One')((a, b) => a - b),
    { name: 'nullMinusNull', args: [null, null], expected: 0 },
    { name: 'nullMinusZero', args: [null, 0], expected: 0 },
    { name: 'negativeZeroMinusZero', args: [-0, 0], expected: -0 },
    { name: 'zeroMinusNegativeZero', args: [0, -0], expected: 0 },
    { name: 'undefinedMinusZero', args: [undefined, 0], expected: NaN },
    { name: 'zeroMinusOne', args: [0, 1], expected: -1 },
    { name: 'oneMinusNegativeOne', args: [1, -1], expected: 2 },
    { name: 'negativeTenMinusTen', args: [-10, 10], expected: -20 },
    { name: 'bigZeroMinusZero', args: [0n, 0n], expected: 0n },
    { name: 'bigOneMinusOne', args: [1n, 1n], expected: 0n },
    { name: 'bigOneMinusNegativeOne', args: [1n, -1n], expected: 2n },
    { name: 'bigNegativeOneMinusOne', args: [-1n, 1n], expected: -2n },
    { name: 'emptyStringMinusOne', args: ['', 1], expected: -1 },
    ...mixedCases('Minus'),
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
    ...coercionCases('Mod', 3, 'Three')((a, b) => a % b),
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
    ...mixedCases('Mod'),
]

/**
 * Addition concatenates after `ToPrimitive` when either primitive is a
 * string; otherwise it follows the same numeric rules as subtraction.
 *
 * @type {readonly Case<2>[]}
 */
const addCases = [
    { name: 'wideBigintPlusOne', args: [2n ** 64n - 1n, 1n], expected: 2n ** 64n },
    // An eager position establishes its operand: the throw is the case's.
    { name: 'unreachedPlusOne', args: [unreached, 1], expected: throws },
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
    // No hint: an object's own `valueOf` first, as for `number`.
    { name: 'ownValueOfPlusOne', args: [{ valueOf: returns(1) }, 1], expected: 2 },
    { name: 'ownBothPlusString', args: [{ valueOf: returns(1), toString: returns('t') }, '!'], expected: '1!' },
    { name: 'stringPlusOwnToString', args: ['a', { toString: returns('b') }], expected: 'ab' },
    { name: 'stringOnePlusBigTwo', args: ['1', 2n], expected: '12' },
    { name: 'emptyArrayPlusOne', args: [[], 1], expected: '1' },
    { name: 'arrayOnePlusTwo', args: [[1], 2], expected: '12' },
    { name: 'emptyObjectPlusOne', args: [{}, 1], expected: '[object Object]1' },
    { name: 'numberPlusBigint', args: [1, 1n], expected: throws },
    { name: 'bigintPlusNumber', args: [1n, 1], expected: throws },
    // A function's text, the writer's: the Rust side's alone (`host`).
    { name: 'functionPlusString', args: [functionValue, '!'], expected: '()=>undefined!', host: functionText },
    { name: 'onePlusFunction', args: [1, functionValue], expected: '1()=>undefined', host: functionText },
]

/**
 * The argument space `<`, `<=`, `>` and `>=` share, and each relation's
 * answer to every row.
 *
 * The four are pinned to one another by invariants no code states: `>` is the
 * reversed `<` and `>=` the reversed `<=`, and each loose relation differs
 * from its strict one only at equality. Spelled out as four lists, those
 * invariants could drift apart unseen, and an argument pair added to one list
 * and missed in another narrowed the generated Rust suite too, since the
 * printer walks the same cases. Here a row's four answers sit side by side,
 * so a deliberate asymmetry is legible and an accidental one is hard to
 * write.
 *
 * `left` and `right` are the halves of a case's name, which each relation's
 * own word goes between: `null` + `LessThan` + `Five`. This is the move
 * {@link numberCoercionCases} already makes for `+n` and `-n` and no
 * cleverer than it: the four answers stay four independent booleans rather
 * than one derived ordering, because a relation that does *not* follow the
 * rule is exactly what these cases exist to catch.
 *
 * @type {readonly {
 *     readonly left: string,
 *     readonly right: string,
 *     readonly args: Case<2>['args'],
 *     readonly lt: boolean,
 *     readonly le: boolean,
 *     readonly gt: boolean,
 *     readonly ge: boolean,
 * }[]}
 */
const comparisonCases = [
    { left: 'null', right: 'Five', args: [null, 5], lt: true, le: true, gt: false, ge: false },
    { left: 'undefined', right: 'Five', args: [undefined, 5], lt: false, le: false, gt: false, ge: false },
    { left: 'true', right: 'Five', args: [true, 5], lt: true, le: true, gt: false, ge: false },
    { left: 'false', right: 'Five', args: [false, 5], lt: true, le: true, gt: false, ge: false },
    { left: 'stringThree', right: 'Five', args: ['3', 5], lt: true, le: true, gt: false, ge: false },
    { left: 'stringLetter', right: 'Five', args: ['a', 5], lt: false, le: false, gt: false, ge: false },
    { left: 'emptyArray', right: 'Five', args: [[], 5], lt: true, le: true, gt: false, ge: false },
    { left: 'arrayThree', right: 'Five', args: [[3], 5], lt: true, le: true, gt: false, ge: false },
    { left: 'arrayStringThree', right: 'Five', args: [['3'], 5], lt: true, le: true, gt: false, ge: false },
    { left: 'arrayPair', right: 'Five', args: [[0, 0], 5], lt: false, le: false, gt: false, ge: false },
    { left: 'emptyObject', right: 'Five', args: [{}, 5], lt: false, le: false, gt: false, ge: false },
    { left: 'function', right: 'Five', args: [functionValue, 5], lt: false, le: false, gt: false, ge: false },
    { left: 'three', right: 'Five', args: [3, 5], lt: true, le: true, gt: false, ge: false },
    { left: 'five', right: 'Three', args: [5, 3], lt: false, le: false, gt: true, ge: true },
    // Equal operands: `false` in the strict columns, `true` in the loose
    // ones. The next two say the same of `0` and `-0`.
    { left: 'five', right: 'Five', args: [5, 5], lt: false, le: true, gt: false, ge: true },
    { left: 'zero', right: 'NegativeZero', args: [0, -0], lt: false, le: true, gt: false, ge: true },
    { left: 'negativeZero', right: 'Zero', args: [-0, 0], lt: false, le: true, gt: false, ge: true },
    // `NaN` anywhere is `false` in all four columns — the rows a negated
    // reverse would get wrong, and why `le` is not `!gt`.
    { left: 'nan', right: 'One', args: [NaN, 1], lt: false, le: false, gt: false, ge: false },
    { left: 'one', right: 'Nan', args: [1, NaN], lt: false, le: false, gt: false, ge: false },
    { left: 'nan', right: 'Nan', args: [NaN, NaN], lt: false, le: false, gt: false, ge: false },
    { left: 'infinity', right: 'One', args: [Infinity, 1], lt: false, le: false, gt: true, ge: true },
    { left: 'one', right: 'Infinity', args: [1, Infinity], lt: true, le: true, gt: false, ge: false },
    { left: 'negativeInfinity', right: 'Infinity', args: [-Infinity, Infinity], lt: true, le: true, gt: false, ge: false },
    // Equal infinities, loose-only again.
    { left: 'infinity', right: 'Infinity', args: [Infinity, Infinity], lt: false, le: true, gt: false, ge: true },
    { left: 'stringTen', right: 'StringNine', args: ['10', '9'], lt: true, le: true, gt: false, ge: false },
    { left: 'stringNine', right: 'StringTen', args: ['9', '10'], lt: false, le: false, gt: true, ge: true },
    { left: 'stringA', right: 'StringB', args: ['a', 'b'], lt: true, le: true, gt: false, ge: false },
    { left: 'emptyString', right: 'StringA', args: ['', 'a'], lt: true, le: true, gt: false, ge: false },
    { left: 'stringAb', right: 'StringAbc', args: ['ab', 'abc'], lt: true, le: true, gt: false, ge: false },
    { left: 'stringAbc', right: 'StringAb', args: ['abc', 'ab'], lt: false, le: false, gt: true, ge: true },
    { left: 'stringUppercaseB', right: 'StringA', args: ['B', 'a'], lt: true, le: true, gt: false, ge: false },
    { left: 'stringTen', right: 'Nine', args: ['10', 9], lt: false, le: false, gt: true, ge: true },
    { left: 'nine', right: 'StringTen', args: [9, '10'], lt: true, le: true, gt: false, ge: false },
    { left: 'stringAbc', right: 'Five', args: ['abc', 5], lt: false, le: false, gt: false, ge: false },
    { left: 'five', right: 'StringAbc', args: [5, 'abc'], lt: false, le: false, gt: false, ge: false },
    { left: 'negativeFiveBig', right: 'ThreeBig', args: [-5n, 3n], lt: true, le: true, gt: false, ge: false },
    // Equal bigints, loose-only again.
    { left: 'threeBig', right: 'ThreeBig', args: [3n, 3n], lt: false, le: true, gt: false, ge: true },
    { left: 'threeBig', right: 'NegativeFiveBig', args: [3n, -5n], lt: false, le: false, gt: true, ge: true },
    // The relations compare a `Number` and a `BigInt` directly rather than
    // throwing — the opposite of `numberByBigint` in every arithmetic group
    // above.
    { left: 'fiveBig', right: 'FiveHalf', args: [5n, 5.5], lt: true, le: true, gt: false, ge: false },
    // An equal-valued mixed number/bigint pair: loose-only, as for `5 <= 5`.
    { left: 'fiveBig', right: 'Five', args: [5n, 5], lt: false, le: true, gt: false, ge: true },
    { left: 'five', right: 'FiveBig', args: [5, 5n], lt: false, le: true, gt: false, ge: true },
    { left: 'fiveBig', right: 'Nan', args: [5n, NaN], lt: false, le: false, gt: false, ge: false },
    { left: 'nan', right: 'FiveBig', args: [NaN, 5n], lt: false, le: false, gt: false, ge: false },
    { left: 'fiveBig', right: 'Infinity', args: [5n, Infinity], lt: true, le: true, gt: false, ge: false },
    { left: 'negativeInfinity', right: 'FiveBig', args: [-Infinity, 5n], lt: true, le: true, gt: false, ge: false },
    { left: 'infinity', right: 'FiveBig', args: [Infinity, 5n], lt: false, le: false, gt: true, ge: true },
    { left: 'stringTen', right: 'TwentyBig', args: ['10', 20n], lt: true, le: true, gt: false, ge: false },
    { left: 'twentyBig', right: 'StringThirty', args: [20n, '30'], lt: true, le: true, gt: false, ge: false },
    { left: 'stringAbc', right: 'TwentyBig', args: ['abc', 20n], lt: false, le: false, gt: false, ge: false },
    { left: 'twentyBig', right: 'StringAbc', args: [20n, 'abc'], lt: false, le: false, gt: false, ge: false },
]

/**
 * One relation's cases: every row above, named with the relation's word
 * between the two halves and answered from its own column.
 *
 * @type {(infix: string) => (relation: 'lt' | 'le' | 'gt' | 'ge') => readonly Case<2>[]}
 */
const relationCases = infix => relation => comparisonCases.map(r => ({
    name: `${r.left}${infix}${r.right}`,
    args: r.args,
    expected: r[relation],
}))

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
 */
const lessThanCases = relationCases('LessThan')('lt')

/**
 * `<=` shares `<`'s coercion (`ToPrimitive`, then lexicographic string
 * comparison or per-side `ToNumeric`) and never throws either. It is defined
 * as the negation of the reversed `<` (`x <= y` is `!(y < x)`), *except* that
 * `NaN` involved anywhere still gives `false`, not the `true` a plain
 * negation of `<`'s `false` would: `y < x` being `false` because one side is
 * `NaN` does not make `x <= y` `true`. That is why `1 <= NaN`, `NaN <= 1`,
 * and `5n <= NaN` are all `false` in the table, alongside the rows that *do*
 * flip from `<` — equal operands, equal-valued mixed number/bigint pairs, and
 * `Infinity <= Infinity` — which are exactly where `<` was `false` for a
 * reason other than `NaN`.
 */
const lessOrEqualCases = relationCases('LessOrEqual')('le')

/**
 * `>` never throws, the same as `<`, and is defined as the reversed `<`:
 * `x > y` is `y < x`. So a row's `gt` is its `lt` read with the operands the
 * other way round. One argument order serves all four relations, which is
 * what keeps the coercion rows comparable: the operand under test stays on
 * the left and `5` on the right, so `x > 5` asks about the same coercion
 * `x < 5` did. The *NaN* rule carries over unchanged — `NaN` anywhere is
 * `false` in both directions, so reversing never turns an `lt` `false` into a
 * `gt` `true` the way it does for an ordinary (non-`NaN`) unequal pair.
 */
const greaterThanCases = relationCases('GreaterThan')('gt')

/**
 * `>=` is the reversed `<=`: `x >= y` is `y <= x`, the same relationship `>`
 * has to `<`. So `ge` flips from `gt` on exactly the rows `le` flips from
 * `lt` — equal operands, equal-valued mixed number/bigint pairs, equal
 * infinities — and stays `false` throughout wherever `NaN` is involved.
 */
const greaterOrEqualCases = relationCases('GreaterOrEqual')('ge')

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
 * outside a `ref` aliases two nodes), so a case whose
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
 * The `unreached` cases prove the other half of these operators, the one
 * that is their defining behaviour: the discarded operand is not
 * established at all. `unreached` lowers to an operation that throws when
 * established (see {@link unreachedExp}), so `false && unreached` answers
 * `false` on either side only because neither side touched the right
 * operand — `amnesia`'s `&&` is lazy, and `nanvm-lib`'s takes the operand as
 * a thunk it never calls. A case that did establish it would throw where it
 * expected a value, which is the failure the corpus's own `check` reports.
 * Every other case here has a constant on the discarded side, and proves
 * *which* operand comes back.
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
    // A falsy left decides, so the right is never established: for every
    // kind of falsy value, since each is its own `ToBoolean` branch.
    { name: 'falseAndUnreached', args: [false, unreached], expected: false },
    { name: 'nullAndUnreached', args: [null, unreached], expected: null },
    { name: 'undefinedAndUnreached', args: [undefined, unreached], expected: undefined },
    { name: 'zeroAndUnreached', args: [0, unreached], expected: 0 },
    { name: 'nanAndUnreached', args: [NaN, unreached], expected: NaN },
    { name: 'emptyStringAndUnreached', args: ['', unreached], expected: '' },
    { name: 'bigZeroAndUnreached', args: [0n, unreached], expected: 0n },
    // A container holding one is established with it, so it is unreached
    // wherever it sits: `false && [1n / 0n]`.
    { name: 'falseAndNestedUnreached', args: [false, [unreached]], expected: false },
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
    // A truthy left decides, so the right is never established.
    { name: 'trueOrUnreached', args: [true, unreached], expected: true },
    { name: 'oneOrUnreached', args: [1, unreached], expected: 1 },
    { name: 'nonEmptyStringOrUnreached', args: ['a', unreached], expected: 'a' },
    { name: 'bigOneOrUnreached', args: [1n, unreached], expected: 1n },
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
    // A non-nullish left decides, so the right is never established — the
    // falsy-but-not-nullish values included, where `||` would establish it.
    { name: 'oneCoalesceUnreached', args: [1, unreached], expected: 1 },
    { name: 'zeroCoalesceUnreached', args: [0, unreached], expected: 0 },
    { name: 'falseCoalesceUnreached', args: [false, unreached], expected: false },
    { name: 'emptyStringCoalesceUnreached', args: ['', unreached], expected: '' },
]

/**
 * `throw` establishes its operand and fails with it, whatever the value:
 * the language's `throw` statement, which the VM answers as its `Err`. An
 * `unreached` operand throws first, as any eager operand does.
 *
 * @type {readonly Case<1>[]}
 */
const throwCases = [
    { name: 'number', args: [1], expected: throws },
    { name: 'string', args: ['a'], expected: throws },
    { name: 'null', args: [null], expected: throws },
    { name: 'unreachedOperand', args: [unreached], expected: throws },
]

/**
 * `?:`, the corpus's one ternary group:
 * `args` is `[condition, consequent, alternate]`, and `expected` is whichever
 * branch `ToBoolean(condition)` selects — the same coercion `!`/`&&`/`||`
 * use. Like those, this selects an operand rather than coercing it, so a
 * reference-typed value only ever appears as the *condition*, the one
 * position that is always discarded (see the `&&`/`||`/`??` group comment
 * above for why that matters). The `unreached` cases prove the unselected
 * arm is not established, the same way that group's do.
 *
 * @type {readonly Case<3>[]}
 */
const ternaryCases = [
    // The condition is the one eager position: established, it throws.
    { name: 'unreachedCondition', args: [unreached, 1, 2], expected: throws },
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
    // Exactly one arm is established: the selected one, whichever it is.
    { name: 'trueSkipsAlternate', args: [true, 1, unreached], expected: 1 },
    { name: 'falseSkipsConsequent', args: [false, unreached, 2], expected: 2 },
    { name: 'nullSkipsConsequent', args: [null, unreached, 2], expected: 2 },
    { name: 'emptyArraySkipsAlternate', args: [[], 1, unreached], expected: 1 },
]

/**
 * `typeof` returns a tag naming the operand's own kind, so unlike
 * `!`/`&&`/`||`/`??`/`?:` there is no identity concern here: the result is
 * always a fresh string, never the operand itself.
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
    // Past `i64` the literal is its sign and `u64` words.
    { name: 'wideBigint', args: [123456789012345678901234567890n], expected: '123456789012345678901234567890' },
    { name: 'wideNegativeBigint', args: [-(2n ** 64n)], expected: '-18446744073709551616' },
    { name: 'emptyArray', args: [[]], expected: '' },
    { name: 'singletonArray', args: [[1]], expected: '1' },
    { name: 'array', args: [[1, 2, 3]], expected: '1,2,3' },
    { name: 'nestedArray', args: [[1, [2, 3], 4]], expected: '1,2,3,4' },
    { name: 'arrayWithNullish', args: [[null, undefined, 1]], expected: ',,1' },
    { name: 'arrayWithOwnToString', args: [[{ toString: returns('x') }, 1]], expected: 'x,1' },
    { name: 'emptyObject', args: [{}], expected: '[object Object]' },
    { name: 'object', args: [{ a: 1 }], expected: '[object Object]' },
    // `OrdinaryToPrimitive` with the `string` hint: `toString` first, then
    // `valueOf`, each an own method if the object has one.
    { name: 'objectOwnToString', args: [{ toString: functionValue }], expected: 'undefined' },
    { name: 'objectOwnToStringMethod', args: [{ toString: returns('custom string') }], expected: 'custom string' },
    { name: 'objectOwnValueOf', args: [{ valueOf: returns(1) }], expected: '[object Object]' },
    { name: 'objectOwnBoth', args: [{ valueOf: returns(1), toString: returns('t') }], expected: 't' },
    // A method that is no function is skipped: after `toString`, the stock
    // `valueOf` answers the object, so the conversion throws.
    { name: 'objectOwnToStringNotAFunction', args: [{ toString: 'h' }], expected: throws },
    { name: 'objectOwnValueOfNotAFunction', args: [{ valueOf: 'x' }], expected: '[object Object]' },
    // A result that is no primitive moves on to the next method.
    { name: 'objectOwnToStringNotPrimitive', args: [{ toString: returns({}), valueOf: returns(1) }], expected: '1' },
    { name: 'objectOwnNoPrimitive', args: [{ toString: returns([]) }], expected: throws },
    { name: 'objectOwnToStringThrows', args: [{ toString: returns(unreached) }], expected: throws },
    // A function's text, the writer's: the Rust side's alone (`host`).
    { name: 'function', args: [functionValue], expected: '()=>undefined', host: functionText },
    { name: 'callback', args: [callback('double')], expected: '(...a)=>a[0]*2', host: functionText },
    { name: 'arrayOfFunction', args: [[functionValue, 1]], expected: '()=>undefined,1', host: functionText },
]

/**
 * `&`/`|`/`^` all coerce both operands with `ToNumeric` like `*`, then — for
 * two `Number`s — apply `ToInt32` to each side before the bitwise op, so a
 * fraction truncates toward zero, a non-finite value becomes `+0`, and a
 * magnitude beyond 32 bits wraps. Two `BigInt`s use the operator's exact
 * infinite-precision two's-complement meaning instead, and mixed
 * number/bigint operands throw, the same as every other arithmetic operator
 * above.
 *
 * @type {readonly Case<2>[]}
 */
const bitAndCases = [
    ...int32Cases('BitAnd', 6, 'Six')((a, b) => a & b),
    { name: 'wrapsAt32Bits', args: [2 ** 32 + 5, 6], expected: 4 },
    { name: 'negativeOneBitAndSix', args: [-1, 6], expected: 6 },
    { name: 'bigTwelveBitAndTen', args: [12n, 10n], expected: 8n },
    { name: 'bigNegativeOneBitAndNegativeOne', args: [-1n, -1n], expected: -1n },
    { name: 'bigNegativeTwoBitAndNegativeThree', args: [-2n, -3n], expected: -4n },
    { name: 'bigFiveBitAndNegativeOne', args: [5n, -1n], expected: 5n },
    { name: 'bigZeroBitAndZero', args: [0n, 0n], expected: 0n },
    { name: 'bigPositiveBitAndZero', args: [12345n, 0n], expected: 0n },
    { name: 'bigNegativeBitAndZero', args: [-12345n, 0n], expected: 0n },
    // A magnitude near `i64::MAX`,
    // where `-1`'s all-ones pattern makes AND an identity.
    { name: 'bigLargeMagnitude', args: [-(2n ** 62n), -1n], expected: -(2n ** 62n) },
    numberBigintCase('BitAnd'),
]

/** @type {readonly Case<2>[]} */
const bitOrCases = [
    ...int32Cases('BitOr', 6, 'Six')((a, b) => a | b),
    { name: 'wrapsAt32Bits', args: [2 ** 32 + 5, 6], expected: 7 },
    { name: 'negativeOneBitOrSix', args: [-1, 6], expected: -1 },
    { name: 'bigTwelveBitOrTen', args: [12n, 10n], expected: 14n },
    { name: 'bigNegativeTwoBitOrNegativeThree', args: [-2n, -3n], expected: -1n },
    { name: 'bigFiveBitOrNegativeOne', args: [5n, -1n], expected: -1n },
    { name: 'bigZeroBitOrZero', args: [0n, 0n], expected: 0n },
    { name: 'bigPositiveBitOrZero', args: [12345n, 0n], expected: 12345n },
    { name: 'bigNegativeBitOrZero', args: [-12345n, 0n], expected: -12345n },
    // A magnitude near `i64::MAX`:
    // `-1`'s all-ones two's-complement pattern absorbs anything it meets, so
    // the result is `-1` regardless of the other operand's magnitude.
    { name: 'bigLargeMagnitude', args: [-(2n ** 62n), -1n], expected: -1n },
    numberBigintCase('BitOr'),
]

/** @type {readonly Case<2>[]} */
const bitXorCases = [
    ...int32Cases('BitXor', 6, 'Six')((a, b) => a ^ b),
    { name: 'wrapsAt32Bits', args: [2 ** 32 + 5, 6], expected: 3 },
    { name: 'negativeOneBitXorSix', args: [-1, 6], expected: -7 },
    { name: 'bigTwelveBitXorTen', args: [12n, 10n], expected: 6n },
    { name: 'bigNegativeOneBitXorNegativeOne', args: [-1n, -1n], expected: 0n },
    { name: 'bigNegativeTwoBitXorNegativeThree', args: [-2n, -3n], expected: 3n },
    { name: 'bigFiveBitXorNegativeOne', args: [5n, -1n], expected: -6n },
    { name: 'bigZeroBitXorZero', args: [0n, 0n], expected: 0n },
    { name: 'bigPositiveBitXorZero', args: [12345n, 0n], expected: 12345n },
    { name: 'bigNegativeBitXorZero', args: [-12345n, 0n], expected: -12345n },
    // A magnitude near `i64::MAX`:
    // `x ^ -1` is `~x`, the identity `bitwiseNotCases` below checks
    // directly, exercised here at a large magnitude instead of a small one.
    { name: 'bigLargeMagnitude', args: [-(2n ** 62n), -1n], expected: 2n ** 62n - 1n },
    numberBigintCase('BitXor'),
]

/**
 * `~` coerces its operand with `ToNumeric` like the unary `+`/`-` groups
 * above, then — for a `Number` — applies `ToInt32` before negating the bits.
 * For a `BigInt`, `~x` is exactly `-x - 1` (`BigInt::unaryMinus` composed
 * with `BigInt::subtract`), not a bitwise algorithm of its own.
 *
 * @type {readonly Case<1>[]}
 */
const bitwiseNotCases = [
    { name: 'null', args: [null], expected: -1 },
    { name: 'undefined', args: [undefined], expected: -1 },
    { name: 'booleanFalse', args: [false], expected: -1 },
    { name: 'booleanTrue', args: [true], expected: -2 },
    { name: 'stringTen', args: ['10'], expected: -11 },
    { name: 'stringLetter', args: ['a'], expected: -1 },
    { name: 'emptyArray', args: [[]], expected: -1 },
    { name: 'arrayTen', args: [[10]], expected: -11 },
    { name: 'arrayStringTen', args: [['10']], expected: -11 },
    { name: 'arrayPair', args: [[0, 0]], expected: -1 },
    { name: 'emptyObject', args: [{}], expected: -1 },
    { name: 'function', args: [functionValue], expected: -1 },
    { name: 'truncatesTowardZero', args: [3.9], expected: -4 },
    { name: 'negativeTruncatesTowardZero', args: [-3.9], expected: 2 },
    { name: 'nan', args: [NaN], expected: -1 },
    { name: 'infinity', args: [Infinity], expected: -1 },
    { name: 'negativeInfinity', args: [-Infinity], expected: -1 },
    { name: 'wrapsAt32Bits', args: [2 ** 32 + 5], expected: -6 },
    { name: 'negativeOne', args: [-1], expected: 0 },
    { name: 'bigZero', args: [0n], expected: -1n },
    { name: 'bigPositive', args: [5n], expected: -6n },
    { name: 'bigNegative', args: [-5n], expected: 4n },
    { name: 'bigOne', args: [1n], expected: -2n },
    { name: 'bigNegativeOne', args: [-1n], expected: 0n },
]

/**
 * `<<` coerces both operands with `ToNumeric` like `&`/`|`/`^`. For two
 * `Number`s, the left side is `ToInt32`'d and the right side `ToUint32`'d
 * then masked to `& 0x1F` (so the shift count wraps modulo 32 and a
 * negative or huge right operand is never a Rust-panicking shift amount)
 * before the native shift, so the result can wrap in *two* independent
 * ways — the value through `ToInt32`, the count through the mask. Two
 * `BigInt`s use the operator's exact infinite-precision meaning: `x * 2^y`
 * for a non-negative `y`, or a right shift by `-y` when `y` is negative —
 * and, since a `BigInt` shift is not bounded to 32 bits, an excessive
 * shift count throws a `RangeError` (`nanvm-lib`'s own word-count limit)
 * rather than silently wrapping. Mixed number/bigint operands throw too,
 * the same as every other arithmetic operator above. Not `commutative`:
 * unlike `&`/`|`/`^`, swapping a shift's operands is not the same
 * operation.
 *
 * @type {readonly Case<2>[]}
 */
const shiftLeftCases = [
    ...int32Cases('Shl', 3, 'Three')((a, b) => a << b),
    { name: 'shiftCountWrapsAt32', args: [1, 33], expected: 2 },
    // The shift count is `ToUint32`'d then masked, so a negative right
    // operand becomes a large one first: `ToUint32(-1) & 0x1F` is `31`.
    { name: 'shiftCountNegative', args: [1, -1], expected: -2147483648 },
    { name: 'valueWrapsAt32Bits', args: [2 ** 32 + 5, 1], expected: 10 },
    { name: 'resultOverflowsIntoSignBit', args: [0x40000000, 1], expected: -2147483648 },
    { name: 'bigFiveShlThree', args: [5n, 3n], expected: 40n },
    { name: 'bigNegativeFiveShlThree', args: [-5n, 3n], expected: -40n },
    { name: 'bigFiveShlZero', args: [5n, 0n], expected: 5n },
    { name: 'bigZeroShlHuge', args: [0n, 100n], expected: 0n },
    // A negative shift count is a right shift by its magnitude.
    { name: 'bigFiveShlNegativeThree', args: [5n, -3n], expected: 0n },
    { name: 'bigNegativeFiveShlNegativeThree', args: [-5n, -3n], expected: -1n },
    { name: 'bigShiftTooLarge', args: [1n, 100000000000000000n], expected: throws, allocation: 'the host cannot allocate a BigInt with 100000000000000001 bits' },
    ...mixedCases('Shl'),
]

/**
 * `>>` shares `<<`'s coercion (`ToNumeric`, then `ToInt32`/`ToUint32`-and-
 * mask for two `Number`s), but shifts arithmetically — sign-extending, so a
 * negative `Number` stays negative. Two `BigInt`s use
 * `BigInt::signedRightShift`: floor division by `2^y` for a non-negative
 * `y` (which rounds toward `-infinity`, not toward zero, so a nonzero bit
 * shifted off a negative value rounds the result *away* from zero — `-1n`
 * stays `-1n` no matter how far right it shifts), or a left shift by `-y`
 * when `y` is negative, throwing the same `RangeError` `<<` does if that
 * left shift needs too many words. Mixed number/bigint operands throw too.
 * Not `commutative`, the same as `<<`. Sign extension shows in the shared
 * `negativeTruncatesTowardZero` row: `-3.9 >> 3` is `floor(-3 / 8)`, `-1`,
 * not `0`.
 *
 * @type {readonly Case<2>[]}
 */
const signedRightShiftCases = [
    ...int32Cases('Shr', 3, 'Three')((a, b) => a >> b),
    { name: 'shiftCountWrapsAt32', args: [16, 34], expected: 4 },
    { name: 'shiftCountNegative', args: [-16, -1], expected: -1 },
    { name: 'valueWrapsAt32Bits', args: [2 ** 32 + 5, 1], expected: 2 },
    // `ToInt32(2^31)` is `i32::MIN`; arithmetic-shifting that right sign-
    // extends rather than producing a small negative number.
    { name: 'wrapsAt32BitsThenNegative', args: [2 ** 31, 1], expected: -1073741824 },
    { name: 'bigFortyShrThree', args: [40n, 3n], expected: 5n },
    { name: 'bigNegativeFortyShrThree', args: [-40n, 3n], expected: -5n },
    { name: 'bigFiveShrThree', args: [5n, 3n], expected: 0n },
    // Floor rounds away from zero: floor(-5 / 8) is -1, not 0.
    { name: 'bigNegativeFiveShrThree', args: [-5n, 3n], expected: -1n },
    { name: 'bigFiveShrZero', args: [5n, 0n], expected: 5n },
    // A negative shift count is a left shift by its magnitude.
    { name: 'bigFiveShrNegativeThree', args: [5n, -3n], expected: 40n },
    { name: 'bigNegativeFiveShrNegativeThree', args: [-5n, -3n], expected: -40n },
    { name: 'bigShiftTooLarge', args: [1n, -100000000000000000n], expected: throws, allocation: 'the negative right-shift count requests a BigInt with 100000000000000001 bits' },
    ...mixedCases('Shr'),
]

/**
 * `>>>` is the one shift — and the one binary operator anywhere in this
 * corpus — that rejects `BigInt` outright: it `ToUint32`s *both* operands
 * (unlike `<<`/`>>`, which `ToInt32` the left one), so there is no sign to
 * preserve and nothing for an arbitrary-precision integer to be shifted
 * within. A `BigInt` on either side throws — the mixed-type check runs
 * before the `BigInt`-specific one, so `1 >>> 1n` and `1n >>> 1` throw the
 * generic mixing error, while `1n >>> 1n` reaches the shift-specific one —
 * but every combination throws regardless of which message fires. Not
 * `commutative`, the same as `<<`/`>>`. `ToUint32` never reinterprets a sign
 * bit, so in the shared `negativeTruncatesTowardZero` row a negative value
 * becomes a large positive one first: `-3.9 >>> 3` is `536870911`, where
 * `>>` sign-extends to `-1`.
 *
 * @type {readonly Case<2>[]}
 */
const unsignedRightShiftCases = [
    ...int32Cases('Ushr', 3, 'Three')((a, b) => a >>> b),
    { name: 'shiftCountWrapsAt32', args: [16, 34], expected: 4 },
    { name: 'shiftCountNegative', args: [16, -1], expected: 0 },
    { name: 'valueWrapsAt32Bits', args: [2 ** 32 + 5, 1], expected: 2 },
    // The idiomatic `x >>> 0` use: turns a negative `Number` into its
    // unsigned 32-bit reading, with no shifting at all.
    { name: 'negativeBecomesLargePositive', args: [-1, 0], expected: 4294967295 },
    { name: 'bigintUnsignedRightShift', args: [5n, 1n], expected: throws },
    ...mixedCases('Ushr'),
]

/**
 * `own` — exactly `Object.getOwnPropertyDescriptor(object, key)?.value`:
 * no getter invocation, and no prototype chain to walk, since `nanvm-lib`
 * objects have none — `{}` "inheriting" `toString`/`constructor` in real
 * JS is exactly the prototype-chain reach `own` exists to bypass, so those
 * names are absent from an object that never set them itself, the same as
 * any other missing key. The key operand must *evaluate* to a string: `own`
 * refuses a non-`String` key rather than `ToPropertyKey`-coercing it the
 * way every other operator here coerces its operands. A non-object,
 * non-nullish receiver (`Number`, `String`, `Boolean`, `BigInt`, `Array`,
 * a function) is never an own-property owner and always answers
 * `undefined`, never throwing; a nullish one throws instead, matching
 * `ToObject`'s own rejection of `null`/`undefined`. Not `commutative`: the
 * receiver and the key are not interchangeable.
 *
 * @type {readonly Case<2>[]}
 */
const ownCases = [
    { name: 'presentProperty', args: [{ a: 7 }, 'a'], expected: 7 },
    { name: 'missingProperty', args: [{ a: 7 }, 'b'], expected: undefined },
    { name: 'emptyObject', args: [{}, 'a'], expected: undefined },
    // `own` bypasses the prototype chain entirely — the whole reason it
    // exists apart from plain property access — so a name every object
    // "inherits" in real JS is still absent unless the object carries it
    // as an own property.
    { name: 'inheritedNameIsAbsent', args: [{}, 'toString'], expected: undefined },
    { name: 'valuePreservesBooleanType', args: [{ a: true }, 'a'], expected: true },
    { name: 'valuePreservesBigintType', args: [{ a: 5n }, 'a'], expected: 5n },
    { name: 'valuePreservesStringType', args: [{ a: 'x' }, 'a'], expected: 'x' },
    { name: 'valuePreservesNullType', args: [{ a: null }, 'a'], expected: null },
    { name: 'multiplePropertiesDistinguished', args: [{ a: 1, b: 2 }, 'b'], expected: 2 },
    { name: 'numericStringKey', args: [{ 1: 42 }, '1'], expected: 42 },
    // A key no UTF-8 literal can spell: it reaches Rust as code units, both
    // in the object literal and as the operand.
    { name: 'loneSurrogateKey', args: [{ '\uD800': 42 }, '\uD800'], expected: 42 },
    { name: 'nonObjectNumberReceiver', args: [5, 'a'], expected: undefined },
    // `'length'` would be the wrong probe here: real JS strings and arrays
    // carry real own properties for `.length` (and, for arrays, numeric
    // indices), so `Object.getOwnPropertyDescriptor` answers those with a
    // real descriptor instead of `undefined` — a key genuinely absent from
    // both is what actually exercises "never an own-property owner".
    { name: 'nonObjectStringReceiver', args: ['hi', 'a'], expected: undefined },
    { name: 'nonObjectBooleanReceiver', args: [true, 'a'], expected: undefined },
    { name: 'nonObjectBigintReceiver', args: [5n, 'a'], expected: undefined },
    { name: 'nonObjectArrayReceiver', args: [[1, 2], 'a'], expected: undefined },
    { name: 'nonObjectFunctionReceiver', args: [functionValue, 'a'], expected: undefined },
    { name: 'nullReceiverThrows', args: [null, 'a'], expected: throws },
    { name: 'undefinedReceiverThrows', args: [undefined, 'a'], expected: throws },
    { name: 'nonStringKeyThrows', args: [{ 1: 42 }, 1], expected: throws },
]

/**
 * The values the corpus shares: each is one node, so two `ref`s to a name are
 * one node reached twice and the object that node establishes is one object.
 * Reference equality is what the `'==='` group's `byItself` cases are about,
 * and this is the only way to write it.
 *
 * @type {Struct}
 */
const sharedValues = {
    emptyArray: [],
    stringArray: ['0'],
    object: { '0': '0' },
    first: callback('first'),
}

/**
 * Strict equality's cases, the ones whose operands reach {@link Data.shared}:
 * `===` asserts each as written and `!==` asserts each negated, so the two
 * operators are proven against one table and cannot drift apart.
 *
 * @type {readonly Case<2>[]}
 */
const strictEqualityCases = [
    { name: 'wideBigintByItself', args: [2n ** 64n, 2n ** 64n], expected: true },
    { name: 'wideBigintByNext', args: [2n ** 64n, 2n ** 64n + 1n], expected: false },
    { name: 'nullByNull', args: [null, null], expected: true },
    { name: 'undefinedByUndefined', args: [undefined, undefined], expected: true },
    { name: 'nullByUndefined', args: [null, undefined], expected: false },
    { name: 'trueByTrue', args: [true, true], expected: true },
    { name: 'falseByFalse', args: [false, false], expected: true },
    { name: 'trueByFalse', args: [true, false], expected: false },
    { name: 'falseByUndefined', args: [false, undefined], expected: false },
    { name: 'falseByNull', args: [false, null], expected: false },
    { name: 'numberBySameNumber', args: [2.3, 2.3], expected: true },
    { name: 'numberByOtherNumber', args: [2.3, -5.4], expected: false },
    { name: 'nanByNan', args: [NaN, NaN], expected: false },
    { name: 'zeroByNegativeZero', args: [0, -0], expected: true },
    { name: 'infinityByInfinity', args: [Infinity, Infinity], expected: true },
    {
        name: 'negativeInfinityByNegativeInfinity',
        args: [-Infinity, -Infinity],
        expected: true,
    },
    { name: 'infinityByNegativeInfinity', args: [Infinity, -Infinity], expected: false },
    { name: 'undefinedByNan', args: [undefined, NaN], expected: false },
    { name: 'undefinedByZero', args: [undefined, 0], expected: false },
    { name: 'stringBySameString', args: ['hello', 'hello'], expected: true },
    { name: 'stringByOtherString', args: ['hello', 'world'], expected: false },
    { name: 'zeroByStringZero', args: [0, '0'], expected: false },
    { name: 'bigintBySameBigint', args: [12n, 12n], expected: true },
    { name: 'bigintByNegatedBigint', args: [12n, -12n], expected: false },
    { name: 'bigintByOtherBigint', args: [12n, 13n], expected: false },
    { name: 'twelveByStringTwelve', args: [12n, '12'], expected: false },
    { name: 'arrayByItself', args: [ref('emptyArray'), ref('emptyArray')], expected: true },
    { name: 'arrayByEqualArray', args: [[], []], expected: false },
    { name: 'stringArrayByItself', args: [ref('stringArray'), ref('stringArray')], expected: true },
    { name: 'objectByItself', args: [ref('object'), ref('object')], expected: true },
    { name: 'objectByEqualObject', args: [ref('object'), { '0': '0' }], expected: false },
    // A function's text is no part of its identity: two functions with one
    // text are two values.
    { name: 'functionByItself', args: [ref('first'), ref('first')], expected: true },
    { name: 'functionBySameText', args: [callback('first'), callback('first')], expected: false },
]

/** @type {readonly Case<2>[]} */
const isCases = [
    { name: 'nanByNan', args: [NaN, NaN], expected: true },
    { name: 'zeroByNegativeZero', args: [0, -0], expected: false },
    { name: 'zeroByZero', args: [0, 0], expected: true },
    { name: 'negativeZeroByNegativeZero', args: [-0, -0], expected: true },
    { name: 'nanByZero', args: [NaN, 0], expected: false },
    { name: 'numberBySameNumber', args: [2.3, 2.3], expected: true },
    { name: 'numberByOtherNumber', args: [2.3, -5.4], expected: false },
    { name: 'infinityByInfinity', args: [Infinity, Infinity], expected: true },
    { name: 'infinityByNegativeInfinity', args: [Infinity, -Infinity], expected: false },
    { name: 'nullByNull', args: [null, null], expected: true },
    { name: 'nullByUndefined', args: [null, undefined], expected: false },
    { name: 'undefinedByUndefined', args: [undefined, undefined], expected: true },
    { name: 'trueByTrue', args: [true, true], expected: true },
    { name: 'trueByFalse', args: [true, false], expected: false },
    { name: 'stringByEqualString', args: ['a', 'a'], expected: true },
    { name: 'stringByOtherString', args: ['a', 'b'], expected: false },
    { name: 'bigintByEqualBigint', args: [1n, 1n], expected: true },
    { name: 'bigintByNumber', args: [1n, 1], expected: false },
    { name: 'zeroBigintByNegativeZeroBigint', args: [0n, -0n], expected: true },
    { name: 'numberByString', args: [1, '1'], expected: false },
    { name: 'arrayByItself', args: [ref('emptyArray'), ref('emptyArray')], expected: true },
    { name: 'arrayByEqualArray', args: [[], []], expected: false },
    { name: 'objectByItself', args: [ref('object'), ref('object')], expected: true },
    { name: 'objectByEqualObject', args: [ref('object'), { '0': '0' }], expected: false },
    { name: 'functionByItself', args: [ref('first'), ref('first')], expected: true },
    { name: 'functionBySameText', args: [callback('first'), callback('first')], expected: false },
]

/** @type {Data} */
export const data = {
    shared: sharedValues,
    groups: [
        {
            // Strict equality, the two groups whose operands reach
            // {@link Data.shared}. `commutative` checks each case both ways
            // round, which is what the Rust harness's `check_eq` used to do
            // inside one assertion.
            op: '===',
            commutative: true,
            cases: strictEqualityCases,
        },
        {
            op: '!==',
            commutative: true,
            cases: strictEqualityCases.map(c => ({ ...c, expected: !c.expected })),
        },
        {
            // JS unary plus, not the `Number` cast: the two differ on a
            // bigint, which `+` refuses and `Number` converts.
            op: '+',
            arity: 1,
            cases: [
                ...numberCoercionCases(false),
                { name: 'bigint', args: [0n], expected: throws },
            ],
        },
        {
            op: '-',
            arity: 1,
            cases: [
                ...numberCoercionCases(true),
                { name: 'bigintPositive', args: [1n], expected: -1n },
                { name: 'bigintNegative', args: [-1n], expected: 1n },
            ],
        },
        { op: '~', cases: bitwiseNotCases },
        { op: '*', commutative: true, cases: mulCases },
        { op: '/', cases: divCases },
        { op: '**', cases: expCases },
        { op: '-', arity: 2, cases: subCases },
        { op: '+', arity: 2, cases: addCases },
        { op: '%', cases: remCases },
        { op: '&', commutative: true, cases: bitAndCases },
        { op: '|', commutative: true, cases: bitOrCases },
        { op: '^', commutative: true, cases: bitXorCases },
        { op: '<<', cases: shiftLeftCases },
        { op: '>>', cases: signedRightShiftCases },
        { op: '>>>', cases: unsignedRightShiftCases },
        { op: '<', cases: lessThanCases },
        { op: '<=', cases: lessOrEqualCases },
        { op: '>', cases: greaterThanCases },
        { op: '>=', cases: greaterOrEqualCases },
        { op: '!', cases: notCases },
        { op: '&&', cases: andCases },
        { op: '||', cases: orCases },
        { op: '??', cases: nullishCases },
        { op: '?:', cases: ternaryCases },
        { op: 'typeof', cases: typeofCases },
        { op: 'throw', cases: throwCases },
        { op: 'String', cases: stringCoercionCases },
        {
            // The `Number` cast, which is unary plus except that it converts
            // a bigint where `+` refuses one.
            op: 'Number',
            cases: [
                ...numberCoercionCases(false),
                { name: 'bigintZero', args: [0n], expected: 0 },
                { name: 'bigintPositive', args: [1n], expected: 1 },
                { name: 'bigintNegative', args: [-1n], expected: -1 },
                // A bigint past `2^53` rounds to the nearest number, a tie to
                // the even one. Wider literals use `bigint_any_words` in Rust.
                { name: 'bigintTieDown', args: [2n ** 53n + 1n], expected: 2 ** 53 },
                { name: 'bigintTieUp', args: [2n ** 53n + 3n], expected: 2 ** 53 + 4 },
                { name: 'bigintWideTieDown', args: [2n ** 64n + 2n ** 11n], expected: 2 ** 64 },
                { name: 'bigintWideTieUp', args: [2n ** 64n + 3n * 2n ** 11n], expected: 2 ** 64 + 2 ** 13 },
                { name: 'bigintWideSticky', args: [2n ** 64n + 2n ** 11n + 1n], expected: 2 ** 64 + 2 ** 12 },
                { name: 'bigintSeveralWords', args: [123456789012345678901234567890n], expected: 123456789012345678901234567890 },
                { name: 'bigintLargestFinite', args: [(2n ** 53n - 1n) * 2n ** 971n], expected: Number.MAX_VALUE },
                // The halfway point to 2^1024 overflows; one integer below
                // still rounds to the largest finite number.
                { name: 'bigintBelowOverflowTie', args: [2n ** 1024n - 2n ** 970n - 1n], expected: Number.MAX_VALUE },
                { name: 'bigintOverflowTie', args: [2n ** 1024n - 2n ** 970n], expected: Infinity },
                { name: 'bigintNegativeOverflowTie', args: [-(2n ** 1024n - 2n ** 970n)], expected: -Infinity },
                { name: 'bigintBeyondRange', args: [2n ** 1024n], expected: Infinity },
                { name: 'bigintNegativeBeyondRange', args: [-(2n ** 1024n)], expected: -Infinity },
                { name: 'bigintObject', args: [{ valueOf: returns(7n) }], expected: 7 },
            ],
        },
        {
            // `Object.is`, `===` but for `NaN` and the signed zeros.
            op: 'is',
            commutative: true,
            cases: isCases,
        },
        { op: 'own', cases: ownCases },
        ...memberGroups,
    ],
}
