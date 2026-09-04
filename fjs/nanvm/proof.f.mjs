/**
 * The JavaScript reference for `nanvm-lib`'s operators.
 *
 * Every case in [`module.f.mjs`](./module.f.mjs) is lowered to the EDAG
 * expression it denotes and evaluated here, so the shared data is proven to
 * describe JavaScript before `nanvm-lib/tests/test/generated.rs` holds
 * `nanvm-lib` to it. This module contains no test cases of its own beyond the
 * `jsOnly` section at the end — adding a case means editing the data.
 *
 * The operand-count assertions are not here but in
 * [`types.ts`](./types.ts): a `@typedef` inside a function body is never
 * checked, so the claim has to be a module-scope alias in a `.ts` file to be
 * one at all.
 *
 * Every lowered case runs through [`amnesia`](../edag/amnesia/module.f.mjs),
 * the repository's one real EDAG evaluator, rather than a second hand-written
 * walker — so an operator's behaviour here is proven by actually executing
 * the EDAG node, the same way [`../proof.f.mjs`](../proof.f.mjs) proves the
 * schema against it. `eq`'s cases are the one exception: they exist to check
 * EDAG node **identity** (`arrayByItself` and friends), which amnesia
 * deliberately does not preserve — see "It forgets" in
 * [amnesia's README](../edag/amnesia/README.md) — so `evaluate` below stays a
 * small dedicated memoizing walker for that section alone. When a
 * memoizing (identity-preserving) EDAG interpreter
 * ([interpret-edag](../djs/todo/interpret-edag.md)) lands, it can absorb
 * `evaluate` too and this module reduces to lowering plus assertions.
 *
 * @import { Exp, Op2, Properties } from '../edag/types.ts'
 * @import { Context } from '../edag/amnesia/types.ts'
 * @import { Case, EqCase, Expectation, Group, OpId, Operand, SharedNode } from './types.ts'
 */

import { assert, assertEq } from '../asserts/module.f.mjs'
import { exp } from '../edag/module.f.mjs'
import { vm } from '../edag/amnesia/module.f.mjs'
import { validate } from '../rtti/validate/module.f.mjs'
import {
    arityOf,
    caseExp,
    casesOf,
    data,
    isFunctionValue,
    isThrows,
    lowerEq,
    opId,
    orders,
    ref,
    valueExp,
} from './module.f.mjs'

const { fromEntries, is } = Object

/**
 * The JavaScript each unary operation the corpus uses denotes, keyed by the
 * canonical EDAG id — plus `unaryPlus`, the one operation with no such id.
 *
 * Only lowered cases used to reach these; now that they run through
 * `amnesia`'s `vm` instead (see `run` below), an entry is needed only for an
 * id `run`'s escape branch can still reach: a `NonEdagGroup` (`unaryPlus`,
 * `typeof`), which always escapes, or an ordinary group with at least one
 * `functionValue`-operand case. An id neither covers would be a line no case
 * runs, and `lookup` refuses an id it does not hold rather than answering for
 * it — `String`, for one, has no such case and so no entry here.
 *
 * The `any` parameters are the point of the exercise: these operators are
 * being applied to operand types TypeScript rejects (`-[]`, `{} * 1`), which
 * is exactly the coercion behaviour under test.
 *
 * @type {{ readonly [k in OpId]?: (a: any) => unknown }}
 */
const op1Js = {
    neg: a => -a,
    unaryPlus: a => +a,
    '!': a => !a,
    '~': a => ~a,
    typeof: a => typeof a,
}

/**
 * The same, for the binary operations — plus `'==='`, which `evaluate` below
 * reaches directly and which has no group of its own to escape from (`eq`'s
 * cases build it by hand in `lowerEq`, never through `run`). `'+'` has no
 * `functionValue`-operand case, so — unlike every other arithmetic
 * operator here — it has no entry either.
 *
 * @type {{ readonly [k in OpId]?: (a: any, b: any) => unknown }}
 */
const op2Js = {
    '*': (a, b) => a * b,
    '/': (a, b) => a / b,
    '**': (a, b) => a ** b,
    '-': (a, b) => a - b,
    '%': (a, b) => a % b,
    '&': (a, b) => a & b,
    '|': (a, b) => a | b,
    '^': (a, b) => a ^ b,
    '<<': (a, b) => a << b,
    '>>': (a, b) => a >> b,
    '>>>': (a, b) => a >>> b,
    // `own` only reaches this table through the `functionValue`-operand
    // escape (`run`'s `caseExp(g)(args)[0] === 'escape'` branch), never
    // through a lowered case — every `own` case that actually claims a
    // throw (`nullReceiverThrows`, `nonStringKeyThrows`, …) lowers to
    // `['own', a, b]` and is proven by `amnesia`'s `own` instead, which
    // carries the nullish/non-string-key invariants this used to
    // duplicate. No escaped case pairs `functionValue` with a nullish
    // receiver or a non-string key — one operand already being a function
    // is what makes it escape — so this stays the plain read.
    own: (a, b) => Object.getOwnPropertyDescriptor(a, b)?.value,
    '<': (a, b) => a < b,
    '<=': (a, b) => a <= b,
    '>': (a, b) => a > b,
    '>=': (a, b) => a >= b,
    '===': (a, b) => a === b,
    '&&': (a, b) => a && b,
    '||': (a, b) => a || b,
    '??': (a, b) => a ?? b,
}

/** The same, for the one ternary operation. @type {{ readonly [k in OpId]?: (a: any, b: any, c: any) => unknown }} */
const op3Js = {
    ternary: (a, b, c) => a ? b : c,
}

/**
 * The operation an id names. An id with no entry is a gap in this module, not
 * a case to answer for with a plausible wrong value.
 *
 * @type {<T>(table: { readonly [k in OpId]?: T }) => (id: OpId) => T}
 */
const lookup = table => id => {
    const f = table[id]
    if (f === undefined) { throw ['no JavaScript for', id] }
    return f
}

const op1 = lookup(op1Js)

const op2 = lookup(op2Js)

const op3 = lookup(op3Js)

/**
 * The evaluation context every lowered case runs `amnesia`'s `vm` under. No
 * lowered case ever contains a `frame` or `args` node — the corpus only
 * derives constant expressions — so both fields exist only to satisfy
 * {@link Context}, never to be read.
 *
 * @type {Context}
 */
const context = { frame: undefined, args: [] }

/**
 * Evaluates a constant EDAG expression **with identity preserved** across a
 * shared node — what `amnesia`'s `vm` deliberately does not do (see "It
 * forgets" in [its README](../edag/amnesia/README.md)), and the one thing
 * `eq`'s cases are for: `memo` holds the nodes already evaluated for this
 * case, so a node reached from several places is one value, which is the
 * whole reason `arrayByItself` is `true` where `arrayByEqualArray` is
 * `false`. It is a list and not a `Map` because the corpus's shared nodes are
 * the three `eq` ones and nothing else: the lowering gives every other
 * operand a node of its own, so a node reached twice is always a `ref`.
 *
 * `amnesia`'s recursion is not pluggable — its handlers call its own `vm`
 * directly — so it cannot be handed this memo to consult mid-walk; this stays
 * a separate, smaller walker for exactly that reason, rather than the general
 * evaluator `run` and `escapedValue` use below.
 *
 * Sees two kinds of node: a `Value`'s lowering (`eq.shared`'s nodes, and the
 * operands `eqProof` reads out of `e` below — plus, from
 * `jsOnly.throw.objectSpread`, a hand-built one of the same shape), which is
 * always a constant or a `ref` and so always `'undefined'`/`'[]'`/`'{}'` or a
 * primitive, never an operator application; and `lowerEq`'s own `['===', a,
 * b]`, the one binary node this file ever builds by hand. Nothing here is
 * ever a *unary* operator node, which is why there is no `op1` dispatch —
 * only `op2`, and only ever for `'==='`.
 *
 * @type {(memo: readonly (readonly[Exp, unknown])[]) => (e: Exp) => unknown}
 */
const evaluate = memo => {
    /** @type {(e: Exp) => unknown} */
    const f = e => {
        if (!(e instanceof Array)) { return e }
        const shared = memo.find(([n]) => n === e)
        if (shared !== undefined) { return shared[1] }
        const [id, a, b] = /** @type {readonly any[]} */ (e)
        if (id === 'undefined') { return undefined }
        if (id === '[]') { return a.map(f) }
        if (id === '{}') {
            // `Properties` is `Property | Spread`. A spread read as a property
            // would take its operand as the key and its absent third element
            // as the value, giving a silently wrong object rather than an
            // error — the same defect the printer refuses.
            return fromEntries(a.map((/** @type {Properties} */ p) => {
                if (p[0] !== ':') { throw ['not a property', p] }
                return [f(p[1]), f(p[2])]
            }))
        }
        return op2(id)(f(a), f(b))
    }
    return f
}

/**
 * The shared nodes, evaluated to one value each.
 *
 * Each is evaluated against the ones already evaluated, so a `ref` inside a
 * shared value reaches that value rather than an equal copy — the same
 * ordering the lowering used to resolve it.
 *
 * Rebuilt per case: the model's memo is per invocation and a case is one
 * invocation, so nothing here depends on two cases seeing the same object.
 *
 * @type {(shared: readonly SharedNode[]) => readonly (readonly[Exp, unknown])[]}
 */
const sharedMemo = shared => shared.reduce(
    (/** @type {readonly (readonly[Exp, unknown])[]} */ memo, [, node]) =>
        [...memo, /** @type {readonly[Exp, unknown]} */ ([node, evaluate(memo)(node)])],
    [])

/**
 * An operand of an escaped case, built directly.
 *
 * `functionValue` is why the case escaped; every other operand still goes
 * through the lowering and `amnesia`'s `vm`, so there is one walk from a
 * corpus value to a JavaScript one rather than two that can disagree. No
 * escaped operand is ever a shared node — sharing exists only in `eq` and
 * `eq` never escapes — so `amnesia`'s non-preservation of identity is not in
 * play here.
 *
 * @type {(v: Operand) => unknown}
 */
const escapedValue = v => isFunctionValue(v) ? () => 5 : vm(context)(valueExp(v))

/**
 * The value one argument order produces: the case's expression evaluated
 * through `amnesia`'s `vm`, or — for a case the corpus does not lower — the
 * operation applied to built values.
 *
 * The escape dispatches on the group's arity, so a binary group's escaped
 * case reaches `op2` rather than being refused by the unary table, and the
 * one ternary group (`?:`) reaches `op3`.
 *
 * @type {(g: Group) => (args: readonly Operand[]) => unknown}
 */
const run = g => args => {
    const lowered = caseExp(g)(args)
    if (lowered[0] === 'exp') { return vm(context)(lowered[1]) }
    const [a, b, c] = args.map(escapedValue)
    const id = opId(g)
    const arity = arityOf(g)
    return arity === 1 ? op1(id)(a) : arity === 2 ? op2(id)(a, b) : op3(id)(a, b, c)
}

/**
 * The leaf tests of one group, keyed by case name.
 *
 * Throwing cases go under a nested `throw` key — the framework's structural
 * way of declaring that a test is expected to throw. A throwing leaf stops at
 * its first exception, which is why each argument order is its own leaf.
 *
 * @type {(g: Group) => object}
 */
const group = g => {
    /** @type {(c: Case<1> | Case<2> | Case<3>) => readonly (readonly[string, () => void])[]} */
    const leaves = c => {
        const { expected } = c
        /** @type {(args: readonly Operand[]) => () => void} */
        const fn = isThrows(expected)
            ? args => () => { run(g)(args) }
            : args => () => {
                // `Object.is` rather than `===`, so `NaN` matches `NaN` and
                // `0` does not match `-0`; the Rust side compares the same way.
                const result = run(g)(args)
                // `expected` describes the outcome, not the program, so it is
                // built as a value and never joined to the case's expression.
                const e = vm(context)(valueExp(expected))
                assert(is(result, e), [result, 'is not', e])
            }
        return orders(g)(c).map(([name, args]) => [name, fn(args)])
    }
    const cases = casesOf(g)
    const ok = cases.filter(c => !isThrows(c.expected)).flatMap(leaves)
    const bad = cases.filter(c => isThrows(c.expected)).flatMap(leaves)
    return bad.length === 0
        ? fromEntries(ok)
        : { ...fromEntries(ok), throw: fromEntries(bad) }
}

const eqProof = (() => {
    const { shared, cases } = lowerEq(data.eq)
    /** @type {(ce: readonly[EqCase, Op2]) => readonly[string, () => void]} */
    const leaf = ([c, e]) => [c.name, () => {
        // One memo for the case, so two `ref`s to a name really are one
        // object; the operands in the failure message come from the same
        // memo and so name the values the comparison actually saw.
        const ev = evaluate(sharedMemo(shared))
        const [, a, b] = e
        assertEq(ev(e), c.eq, [ev(a), c.eq ? '===' : '!==', ev(b)])
        assertEq(ev(['===', b, a]), c.eq)
    }]
    return fromEntries(cases.map(leaf))
})()

/**
 * A `ref` inside a `shared` value reaches the node the earlier entry bound.
 *
 * `Value` admits a `Ref` wherever it appears, nesting included, so this is
 * writable corpus data; before it resolved, lowering the `shared` map threw.
 * Identity is the whole claim — an equal copy would leave `arrayByItself`'s
 * guarantee meaningless one level in — so every assertion here is `===` and
 * not a structural comparison.
 *
 * The evaluated half is the half that matters, and asserting only on the
 * lowered nodes is what let both consumers discard the identity while this
 * passed: the lowering shared the node, and each consumer then built the
 * shared value from scratch. So the memo is checked too, and
 * `rust/proof.f.mjs` checks the printed `let` bindings.
 */
const nestedSharing = () => {
    const { shared } = lowerEq({
        shared: { base: [], wrapper: [ref('base')] },
        cases: [],
    })
    const [[, base], [, wrapper]] = shared
    const items = /** @type {readonly any[]} */ (wrapper)[1]
    assertEq(items.length, 1)
    assert(items[0] === base, ['wrapper holds a copy, not the shared node'])
    // And the values the nodes evaluate to share in the same place.
    const memo = sharedMemo(shared)
    const [[, baseValue], [, wrapperValue]] = memo
    assert(
        /** @type {readonly unknown[]} */ (wrapperValue)[0] === baseValue,
        ['the evaluated wrapper holds a copy, not the shared value'])
}

/**
 * Every expression the corpus derives is a well-formed EDAG.
 *
 * This is the runtime half of the coupling to [`fjs/edag`](../edag/README.md).
 * The static half is free — the data spells the ids as literals, so removing
 * or respelling one in `fjs/edag/types.ts` fails `tsc` here — and this is
 * what an operand shape or a validation rule changing under the corpus fails
 * instead of going unnoticed.
 */
const edagShape = () => {
    /** @type {(e: Exp) => void} */
    const valid = e => { assertEq(validate(exp)(e)[0], 'ok', e) }
    for (const [, e] of lowerEq(data.eq).cases) { valid(e) }
    for (const g of data.groups) {
        for (const c of casesOf(g)) {
            for (const [, args] of orders(g)(c)) {
                const lowered = caseExp(g)(args)
                if (lowered[0] === 'exp') { valid(lowered[1]) }
            }
        }
    }
}

/**
 * Behaviour that is real JavaScript but has no `nanvm-lib` counterpart to
 * share data with, so it stays here instead of in `module.f.mjs`.
 */
const jsOnly = {
    /**
     * `Object.is` distinguishes `0` from `-0` where `===` does not; the whole
     * corpus relies on that, so it is checked directly.
     */
    negativeZero: () => {
        assert(is(-0, -0))
        assert(!is(0, -0))
        assert(is(NaN, NaN))
    },
    /** A function's string form is engine-specific — only its type is fixed. */
    functionToString: () => {
        assertEq(typeof String(() => 5), 'string')
    },
    /**
     * `ToPrimitive` consults a `toString` method. `nanvm-lib` has no object
     * methods yet, so these cases cannot be shared; see
     * `nanvm-lib/todo/mvp-roadmap.md`.
     */
    toStringMethod: () => {
        assertEq(String({ toString: () => 'custom string' }), 'custom string')
    },
    throw: {
        toStringThrows: () => String({ toString: () => { throw 'Custom error' } }),
        toStringNotAFunction: () => String({ toString: 'hello' }),
        toStringNotPrimitive: () => String({ toString: () => [] }),
        /**
         * An object spread reaching the evaluator. `Properties` is
         * `Property | Spread`, so this is a valid `Exp`; read as a property it
         * evaluated to `{ x: undefined }` instead of failing. The corpus
         * cannot produce one — it lowers JavaScript values — so this is the
         * only way the branch is walked.
         */
        objectSpread: () => evaluate([])(['{}', [['...', 'x']]]),
        /**
         * Only the `eq` section shares, so a `ref` anywhere else is a mistake.
         *
         * `throws` and `functionValue` used to be refused here too. They are
         * now unspellable where they were being refused — `Expectation` and
         * `Operand` admit each in one position only — so the claim is a type
         * and its pins are in `types.ts`.
         */
        refOutsideEq: () => valueExp(() => ['ref', 'emptyArray']),
        /** And inside it, a name no `shared` value carries. */
        unknownRef: () => lowerEq({
            shared: {},
            cases: [{ name: 'nope', a: () => ['ref', 'nope'], b: null, eq: false }],
        }),
        /**
         * A `shared` value sees only the entries before it, so a forward
         * reference is refused — and a cycle, needing one, cannot be written.
         */
        forwardSharedRef: () =>
            lowerEq({ shared: { a: [ref('b')], b: [] }, cases: [] }),
        /** An id the corpus does not exercise has no JavaScript here. */
        unusedOperation: () => op1('Number'),
        /**
         * A count the operation does not take. `Case<N>` cannot carry one,
         * but `caseExp` is exported and its `args` are a plain array, so the
         * mismatch is refused rather than lowered to a node that looks like a
         * `Lowered` and fails the `exp` schema.
         */
        wrongOperandCount: () => caseExp({ op: '*', cases: [] })([1]),
    },
}

export const proof = {
    eq: eqProof,
    ...fromEntries(data.groups.map(g => [opId(g), group(g)])),
    edagShape,
    nestedSharing,
    jsOnly,
}
