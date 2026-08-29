/**
 * The JavaScript reference for `nanvm-lib`'s operators.
 *
 * Every case in [`module.f.mjs`](./module.f.mjs) is lowered to the EDAG
 * expression it denotes and evaluated here, so the shared data is proven to
 * describe JavaScript before `nanvm-lib/tests/test/generated.rs` holds
 * `nanvm-lib` to it. This module contains no test cases of its own beyond the
 * `jsOnly` section at the end — adding a case means editing the data.
 *
 * The evaluator below is an inline one for the constant subset the corpus
 * uses. When the EDAG interpreter
 * ([interpret-edag](../djs/todo/interpret-edag.md)) lands it replaces this
 * one, and the corpus becomes part of that interpreter's test suite for free:
 * the memoization contract these cases rely on is the one it already owes.
 *
 * @import { Exp, Op2 } from '../edag/types.ts'
 * @import { Case, EqCase, Group, Group1, Group2, OpId, SharedNode, Value } from './types.ts'
 * @import { Assert } from '../asserts/types.ts'
 * @import { Equal } from '../types/ts/types.ts'
 */

import { assert, assertEq } from '../asserts/module.f.mjs'
import { exp } from '../edag/module.f.mjs'
import { validate } from '../rtti/validate/module.f.mjs'
import {
    caseExp,
    casesOf,
    data,
    isFunctionValue,
    isThrows,
    lowerEq,
    opId,
    orders,
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
            return fromEntries(a.map(
                (/** @type {readonly any[]} */ p) => [f(p[1]), f(p[2])]))
        }
        return e.length === 2 ? op1(id)(f(a)) : op2(id)(f(a), f(b))
    }
    return f
}

/**
 * The shared nodes, evaluated to one value each.
 *
 * Rebuilt per case: the model's memo is per invocation and a case is one
 * invocation, so nothing here depends on two cases seeing the same object.
 *
 * @type {(shared: readonly SharedNode[]) => readonly (readonly[Exp, unknown])[]}
 */
const sharedMemo = shared => shared.map(
    ([, node]) => /** @type {readonly[Exp, unknown]} */ ([node, evaluate([])(node)]))

/**
 * An operand of an escaped case, built directly.
 *
 * `functionValue` is why the case escaped; every other operand still goes
 * through the lowering, so there is one walk from a corpus value to a
 * JavaScript one rather than two that can disagree.
 *
 * @type {(v: Value) => unknown}
 */
const escapedValue = v => isFunctionValue(v) ? () => 5 : evaluate([])(valueExp(v))

/**
 * The value one argument order produces: the case's expression evaluated, or
 * — for a case no EDAG node spells — the operation applied to built values.
 *
 * The escape path is unary. The escapes are `unaryPlus`, whose group is
 * unary, and a `functionValue` operand, which only the unary coercion groups
 * carry; a binary escape would need a second line here, and until it is
 * written `op1` refuses the binary id instead of answering for it.
 *
 * @type {(g: Group) => (args: readonly Value[]) => unknown}
 */
const run = g => args => {
    const lowered = caseExp(g)(args)
    return lowered[0] === 'exp'
        ? evaluate([])(lowered[1])
        : op1(opId(g))(escapedValue(args[0]))
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
        /** @type {(args: readonly Value[]) => () => void} */
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
 * Every expression the corpus derives is a well-formed EDAG.
 *
 * This is the runtime half of the coupling to [`fjs/edag`](../edag/README.md).
 * The static half is free — the data spells the ids as literals, so removing
 * or respelling one in `fjs/edag/types.ts` fails `npx tsc` here — and this is
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
 * An operand count is a type error rather than a case that runs: a group's
 * count is which EDAG vocabulary its id is in, and `Case<N>` carries it.
 */
const arity = () => {
    /** @typedef {Assert<Equal<Case<1>['args'], readonly[Value]>>} _Unary */
    /** @typedef {Assert<Equal<Case<2>['args'], readonly[Value, Value]>>} _Binary */
    /** @typedef {Assert<Equal<Case<2> extends Case<1> ? true : false, false>>} _NotWidened */
    /** @typedef {Assert<Equal<Case<1> extends Case<2> ? true : false, false>>} _NotNarrowed */
    /** @typedef {Assert<Equal<Group1['cases'], readonly Case<1>[]>>} _Op1Groups */
    /** @typedef {Assert<Equal<Group2['cases'], readonly Case<2>[]>>} _Op2Groups */
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
        /** `throws` describes a case's outcome; it is not a value to lower. */
        throwsIsNotAnExp: () => valueExp(() => ['throw']),
        /** Nor is a function value — that is what an escaped case is for. */
        functionValueIsNotAnExp: () => valueExp(() => ['function']),
        /** Only the `eq` section shares, so a `ref` anywhere else is a mistake. */
        refOutsideEq: () => valueExp(() => ['ref', 'emptyArray']),
        /** And inside it, a name no `shared` value carries. */
        unknownRef: () => lowerEq({
            shared: {},
            cases: [{ name: 'nope', a: () => ['ref', 'nope'], b: null, eq: false }],
        }),
        /** An id the corpus does not exercise has no JavaScript here. */
        unusedOperation: () => op1('!'),
    },
}

export const proof = {
    eq: eqProof,
    ...fromEntries(data.groups.map(g => [opId(g), group(g)])),
    edagShape,
    arity,
    jsOnly,
}
