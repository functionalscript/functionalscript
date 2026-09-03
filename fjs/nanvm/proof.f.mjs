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
 * The evaluator below is an inline one for the constant subset the corpus
 * uses. When the EDAG interpreter
 * ([interpret-edag](../djs/todo/interpret-edag.md)) lands it replaces this
 * one, and the corpus becomes part of that interpreter's test suite for free:
 * the memoization contract these cases rely on is the one it already owes.
 *
 * @import { Exp, Op2, Properties } from '../edag/types.ts'
 * @import { Case, EqCase, Expectation, Group, OpId, Operand, SharedNode } from './types.ts'
 */

import { assert, assertEq } from '../asserts/module.f.mjs'
import { exp } from '../edag/module.f.mjs'
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
 * Only the operations the corpus exercises are here: an entry for an id no
 * case names would be a line no proof runs, and `lookup` refuses an id it
 * does not hold rather than answering for it.
 *
 * The `any` parameters are the point of the exercise: these operators are
 * being applied to operand types TypeScript rejects (`-[]`, `{} * 1`), which
 * is exactly the coercion behaviour under test.
 *
 * @type {{ readonly [k in OpId]?: (a: any) => unknown }}
 */
const op1Js = {
    String: a => String(a),
    neg: a => -a,
    unaryPlus: a => +a,
}

/** The same, for the binary operations. @type {{ readonly [k in OpId]?: (a: any, b: any) => unknown }} */
const op2Js = {
    '*': (a, b) => a * b,
    '/': (a, b) => a / b,
    '**': (a, b) => a ** b,
    '-': (a, b) => a - b,
    '+': (a, b) => a + b,
    '%': (a, b) => a % b,
    '<': (a, b) => a < b,
    '<=': (a, b) => a <= b,
    '>': (a, b) => a > b,
    '>=': (a, b) => a >= b,
    '===': (a, b) => a === b,
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

/**
 * Evaluates a constant EDAG expression.
 *
 * `memo` holds the nodes already evaluated for this case, which is what makes
 * a node reached from several places one value — the model's rule that a
 * shared node evaluates once, and the whole reason `arrayByItself` is `true`
 * where `arrayByEqualArray` is `false`. It is a list and not a `Map` because
 * the corpus's shared nodes are the three `eq` ones and nothing else: the
 * lowering gives every other operand a node of its own, so a node reached
 * twice is always a `ref`.
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
        return e.length === 2 ? op1(id)(f(a)) : op2(id)(f(a), f(b))
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
 * through the lowering, so there is one walk from a corpus value to a
 * JavaScript one rather than two that can disagree.
 *
 * @type {(v: Operand) => unknown}
 */
const escapedValue = v => isFunctionValue(v) ? () => 5 : evaluate([])(valueExp(v))

/**
 * The value one argument order produces: the case's expression evaluated, or
 * — for a case the corpus does not lower — the operation applied to built
 * values.
 *
 * The escape dispatches on the group's arity, so a binary group's escaped
 * case reaches `op2` rather than being refused by the unary table.
 *
 * @type {(g: Group) => (args: readonly Operand[]) => unknown}
 */
const run = g => args => {
    const lowered = caseExp(g)(args)
    if (lowered[0] === 'exp') { return evaluate([])(lowered[1]) }
    const [a, b] = args.map(escapedValue)
    return arityOf(g) === 1 ? op1(opId(g))(a) : op2(opId(g))(a, b)
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
    /** @type {(c: Case<1> | Case<2>) => readonly (readonly[string, () => void])[]} */
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
                const e = evaluate([])(valueExp(expected))
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
        unusedOperation: () => op1('!'),
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
