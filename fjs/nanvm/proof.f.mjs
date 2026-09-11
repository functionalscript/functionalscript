/**
 * The JavaScript reference for `nanvm-lib`'s operators.
 *
 * Every case in [`module.f.mjs`](./module.f.mjs) is lowered to the EDAG
 * expression it denotes and evaluated here, so the shared data is proven to
 * describe JavaScript before `nanvm-lib/tests/test/generated.rs` holds
 * `nanvm-lib` to it. This module contains no test cases of its own beyond
 * `jsOnly` (below `edagShape`) and `crossCheck` (below `group`) — adding a
 * case means editing the data.
 *
 * The operand-count assertions are not here but in
 * [`types.ts`](./types.ts): a `@typedef` inside a function body is never
 * checked, so the claim has to be a module-scope alias in a `.ts` file to be
 * one at all.
 *
 * Every lowered case runs through [`amnesia`](../edag/amnesia/module.f.mjs),
 * the repository's one real EDAG evaluator, rather than a second hand-written
 * walker — so an operator's behaviour here is proven by actually executing
 * the EDAG node, the same way [`../edag/proof.f.mjs`](../edag/proof.f.mjs)
 * proves the schema against it. `eq`'s cases are the one exception: they
 * exist to check EDAG node **identity** (`arrayByItself` and friends), which
 * amnesia deliberately does not preserve — see "It forgets" in
 * [amnesia's README](../edag/amnesia/README.md) — so `evaluate` below stays a
 * small dedicated memoizing walker for that section alone. When a
 * memoizing (identity-preserving) EDAG interpreter
 * ([interpret-edag](../djs/todo/interpret-edag.md)) lands, it can absorb
 * `evaluate` too and this module reduces to lowering plus assertions.
 *
 * @import { Exp, Op2, Properties } from '../edag/types.ts'
 * @import { Context } from '../edag/amnesia/types.ts'
 * @import { Case, EqCase, Expectation, Group, SharedNode, Value } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import { exp } from '../edag/module.f.mjs'
import { vm } from '../edag/amnesia/module.f.mjs'
import { validate } from '../rtti/validate/module.f.mjs'
import {
    caseExp,
    casesOf,
    data,
    functionValue,
    groupKey,
    isThrows,
    lambdaExp,
    lowerEq,
    orders,
    ref,
    valueExp,
} from './module.f.mjs'

const { fromEntries, is } = Object

/**
 * The JavaScript each of the corpus's operations denotes: `crossCheck`'s
 * reference, the bare JS operator that `amnesia`'s handler for the same node
 * must agree with.
 *
 * Keyed by `groupKey`, one table for every arity — so `-` at one operand and
 * at two are two entries, as they are two groups, and a consumer needs no
 * arity dispatch to find the one it wants. `'==='` is the exception that is
 * not a group's key: `evaluate` below asks for it directly, since `eq`'s
 * cases build that node by hand in `lowerEq`.
 *
 * No case *runs* through these — every case runs through `amnesia`'s `vm`
 * (see `run` below) — so an entry is a claim about what an operation denotes
 * and nothing else. An absent entry means that group is not cross-checked at
 * all, which `referenceCoverage` below makes a deliberate list of exactly
 * one rather than an oversight: `own`, whose plain
 * `Object.getOwnPropertyDescriptor` read is not a copy of `amnesia`'s
 * stricter receiver/key invariants — `nonStringKeyThrows` (`[{1: 42}, 1]`) is
 * real JS and does *not* throw through the descriptor read, only through
 * `amnesia`'s FS-specific string-key check — so the two are expected to
 * disagree there, and every `own` case is proven by `amnesia` alone.
 *
 * The `any` parameters are the point of the exercise: these operators are
 * being applied to operand types TypeScript rejects (`-[]`, `{} * 1`), which
 * is exactly the coercion behaviour under test.
 *
 * @type {{ readonly [k in string]?: (...args: readonly any[]) => unknown }}
 */
const js = {
    '-/1': a => -a,
    '+/1': a => +a,
    '!': a => !a,
    '~': a => ~a,
    typeof: a => typeof a,
    String: a => String(a),
    '*': (a, b) => a * b,
    '/': (a, b) => a / b,
    '**': (a, b) => a ** b,
    '-/2': (a, b) => a - b,
    '+/2': (a, b) => a + b,
    '%': (a, b) => a % b,
    '&': (a, b) => a & b,
    '|': (a, b) => a | b,
    '^': (a, b) => a ^ b,
    '<<': (a, b) => a << b,
    '>>': (a, b) => a >> b,
    '>>>': (a, b) => a >>> b,
    '<': (a, b) => a < b,
    '<=': (a, b) => a <= b,
    '>': (a, b) => a > b,
    '>=': (a, b) => a >= b,
    '===': (a, b) => a === b,
    '&&': (a, b) => a && b,
    '||': (a, b) => a || b,
    '??': (a, b) => a ?? b,
    '?:': (a, b, c) => a ? b : c,
}

/**
 * The operation a key names. A key with no entry is a gap in this module, not
 * a case to answer for with a plausible wrong value — so this is for the
 * callers that require one. `crossCheck` reads {@link js} directly instead,
 * because there an absent entry is the documented skip.
 *
 * @type {(key: string) => (...args: readonly any[]) => unknown}
 */
const reference = key => {
    const f = js[key]
    if (f === undefined) { throw ['no JavaScript for', key] }
    return f
}

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
 * evaluator `run` uses below.
 *
 * Sees two kinds of node: a `Value`'s lowering (`eq.shared`'s nodes, and the
 * operands `eqProof` reads out of `e` below — plus, from
 * `jsOnly.throw.objectSpread`, a hand-built one of the same shape), which is
 * always a constant or a `ref` and so always `'undefined'`/`'[]'`/`'{}'` or a
 * primitive, never an operator application; and `lowerEq`'s own `['===', a,
 * b]`, the one binary node this file ever builds by hand — plus a
 * `functionValue`'s lowering, the `=>` node, which is a value here and not
 * an operation: it establishes to a host closure, one per node, so two
 * function values are two closures and a shared one is one. Nothing here is
 * ever a unary or ternary operator node either, which is why the reference is
 * asked for `'==='` and for nothing else.
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
        if (id === '=>') { return () => undefined }
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
        return reference(id)(f(a), f(b))
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
 * A value as `crossCheck`'s reference sees it, built through the same
 * lowering and the same `vm` a case goes through, so there is one walk from
 * a corpus value to a JavaScript one rather than two that can disagree.
 * Never a shared node — sharing exists only in `eq` — so `amnesia`'s
 * non-preservation of identity is not in play here.
 *
 * @type {(v: Value) => unknown}
 */
const value = v => vm(context)(valueExp(v))

/**
 * The value one argument order produces: the case's expression evaluated
 * through `amnesia`'s `vm`.
 *
 * @type {(g: Group) => (args: readonly Value[]) => unknown}
 */
const run = g => args => vm(context)(caseExp(g)(args))

/**
 * One group's leaves as a proof object: the ordinary cases by name, and the
 * throwing ones under a nested `throw` key — the framework's structural way
 * of declaring that a test is expected to throw. A throwing leaf stops at its
 * first exception, which is why each argument order is its own leaf, and why
 * {@link group} and {@link crossCheck} are two trees rather than one: a leaf
 * that asserts a throw can assert one call, so the two implementations cannot
 * share it. Everything around that they can, which is what this is.
 *
 * @type {(g: Group) => (leaves: (c: Case<1> | Case<2> | Case<3>) => readonly (readonly[string, () => void])[]) => object}
 */
const tree = g => leaves => {
    const cases = casesOf(g)
    const ok = cases.filter(c => !isThrows(c.expected)).flatMap(leaves)
    const bad = cases.filter(c => isThrows(c.expected)).flatMap(leaves)
    return bad.length === 0
        ? fromEntries(ok)
        : { ...fromEntries(ok), throw: fromEntries(bad) }
}

/**
 * Each case run through `amnesia`, against the `expected` the corpus states.
 *
 * @type {(g: Group) => object}
 */
const group = g => {
    /** @type {(c: Case<1> | Case<2> | Case<3>) => readonly (readonly[string, () => void])[]} */
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
                const e = vm(context)(valueExp(expected))
                assert(is(result, e), [result, 'is not', e])
            }
        return orders(g)(c).map(([name, args]) => [name, fn(args)])
    }
    return tree(g)(leaves)
}

/**
 * Replays a group's cases a second time, through the bare JavaScript
 * operator ({@link js}) instead of `amnesia`, and checks the two agree.
 *
 * `amnesia`'s handler and the JS operator are two independent
 * implementations of the same operation, and nothing else keeps them in
 * step. That is exactly how `own`'s receiver-before-key check order drifted
 * between the two before anyone noticed by hand
 * ([nanvm-lib#1879](https://github.com/functionalscript/functionalscript/pull/1879),
 * fixed in `523b08a` for this file and `a6aabfc` for `amnesia`): a corpus
 * case with `expected: throws` can't tell two throwing orders apart, so
 * nothing here would have caught it either — but a wrong non-throwing
 * *value* is exactly what this catches, and would have caught it sooner had
 * one of the two reorderings landed first without the other.
 *
 * A group with no reference entry is skipped — `own`, for the reason at
 * {@link js}, and nothing else, which `referenceCoverage` pins. Every
 * operation that has one is a bare JavaScript operator on both sides, so
 * agreement is the only correct outcome, not a coincidence of scope. A
 * function operand is compared like any other: both sides see a closure, and
 * every operator here coerces one the same way.
 *
 * Throwing cases are checked structurally only — both sides must throw,
 * not throw the same thing — for the same reason `group` above can't
 * compare thrown values: see
 * `../emergent_testing/todo/throw-payload-assertions.md`.
 *
 * @type {(g: Group) => object}
 */
const crossCheck = g => {
    const key = groupKey(g)
    const f = js[key]
    if (f === undefined) { return {} }
    /** @type {(c: Case<1> | Case<2> | Case<3>) => readonly (readonly[string, () => void])[]} */
    const leaves = c => orders(g)(c).map(([name, args]) => {
        const e = caseExp(g)(args)
        const refValue = () => f(...args.map(value))
        const fn = isThrows(c.expected)
            ? () => { refValue() }
            : () => {
                const amnesiaValue = vm(context)(e)
                assert(is(amnesiaValue, refValue()), [amnesiaValue, 'is not', refValue(), 'for', key])
            }
        return [name, fn]
    })
    return tree(g)(leaves)
}

/**
 * Every group is cross-checked, save the one that deliberately is not.
 *
 * An absent {@link js} entry makes `crossCheck` return an empty tree, which
 * no test failure ever reports: a group added without a reference, or one
 * whose key is respelled, would simply stop being checked against JavaScript
 * and nothing would say so. This is what says so — and it pins the exclusion
 * in the other direction too, so `own` gaining an entry is also a failure
 * here rather than a silent change of what the corpus proves.
 */
const referenceCoverage = () => {
    for (const g of data.groups) {
        const key = groupKey(g)
        assert(key === 'own' || key in js, ['no JavaScript reference for', key])
    }
    assert(!('own' in js), ['own is excluded deliberately; see the js table'])
}

/**
 * A `functionValue` lowers to the smallest closure, anywhere it appears.
 *
 * The node is what both consumers agree on — `amnesia` establishes it, the
 * printer recognises exactly it — so its shape is pinned here as data, and
 * its evaluation as a host function. Nested, it is the same node inside the
 * container's, which is what lets a function sit in an array or object
 * operand without either consumer needing a second walk.
 */
const lambda = () => {
    assertStructurallySame(valueExp(functionValue), ['=>', ['[]', []], ['undefined']])
    assertStructurallySame(valueExp(functionValue), lambdaExp())
    assertStructurallySame(valueExp([functionValue]), ['[]', [lambdaExp()]])
    assertStructurallySame(valueExp({ f: functionValue }), ['{}', [[':', 'f', lambdaExp()]]])
    assertEq(typeof value(functionValue), 'function')
    // Two function operands are two closures, not one node reached twice.
    const [f, g] = /** @type {readonly unknown[]} */ (value([functionValue, functionValue]))
    assert(f !== g, ['one closure reached twice'])
    // In the `eq` section a function is a value like any other: two are two
    // closures, one reached through `ref` is one, and a nested one is the
    // same node inside its container's, so `evaluate` establishes all three.
    const { shared, cases } = lowerEq({
        shared: { fn: functionValue, holder: [ref('fn')] },
        cases: [
            { name: 'twoFunctions', a: functionValue, b: functionValue, eq: false },
            { name: 'oneFunction', a: ref('fn'), b: ref('fn'), eq: true },
            { name: 'nestedFunction', a: ref('holder'), b: [ref('fn')], eq: false },
        ],
    })
    const ev = evaluate(sharedMemo(shared))
    for (const [c, e] of cases) { assertEq(ev(e), c.eq, c.name) }
    const [[, fn], [, holder]] = sharedMemo(shared)
    assert(/** @type {readonly unknown[]} */ (holder)[0] === fn, ['nested function is a copy'])
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
            for (const [, args] of orders(g)(c)) { valid(caseExp(g)(args)) }
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
         * `throws` used to be refused here too. It is now unspellable where
         * it was being refused — only `Expectation` admits it — so the claim
         * is a type and its pin is in `types.ts`.
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
        /** An operation the corpus does not exercise has no JavaScript here. */
        unusedOperation: () => reference('Number'),
        /**
         * A count the operation does not take. `Case<N>` cannot carry one,
         * but `caseExp` is exported and its `args` are a plain array, so the
         * mismatch is refused rather than lowered to a node that fails the
         * `exp` schema.
         */
        wrongOperandCount: () => caseExp({ op: '*', cases: [] })([1]),
    },
}

export const proof = {
    eq: eqProof,
    lambda,
    referenceCoverage,
    ...fromEntries(data.groups.map(g => [groupKey(g), group(g)])),
    crossCheck: fromEntries(data.groups.map(g => [groupKey(g), crossCheck(g)])),
    edagShape,
    nestedSharing,
    jsOnly,
}
