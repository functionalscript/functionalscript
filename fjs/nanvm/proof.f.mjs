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
 * Every case runs through [`amnesia`](../edag/amnesia/module.f.mjs), the
 * repository's one real EDAG evaluator, rather than a second hand-written
 * walker — so an operator's behaviour here is proven by actually executing
 * the EDAG node, the same way [`../edag/proof.f.mjs`](../edag/proof.f.mjs)
 * proves the schema against it. The `'==='` group used to be the exception:
 * its cases check EDAG node **identity** (`arrayByItself` and friends), which
 * amnesia deliberately does not preserve — see "It forgets" in
 * [amnesia's README](../edag/amnesia/README.md) — so this module carried a
 * second, memoizing walker and the corpus a second case shape for them. It
 * carries neither now: amnesia takes the nodes a caller has already
 * established (`Context`'s `memo`), so `sharedMemo` below hands it the
 * corpus's shared nodes and those cases are ordinary ones.
 *
 * @import { Exp } from '../edag/types.ts'
 * @import { Context } from '../edag/amnesia/types.ts'
 * @import { Case, Expectation, Group, SharedNode, Value } from './types.ts'
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
    orders,
    ref,
    sharedExp,
    valueExp,
    valuesExp,
} from './module.f.mjs'

const { fromEntries, is } = Object

/**
 * The JavaScript each of the corpus's operations denotes: `crossCheck`'s
 * reference, the bare JS operator that `amnesia`'s handler for the same node
 * must agree with.
 *
 * Keyed by `groupKey`, one table for every arity — so `-` at one operand and
 * at two are two entries, as they are two groups, and a consumer needs no
 * arity dispatch to find the one it wants.
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
    '&&': (a, b) => a && b,
    '||': (a, b) => a || b,
    '??': (a, b) => a ?? b,
    '===': (a, b) => a === b,
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
 * The shared nodes, established one value each, for `amnesia`'s `memo`.
 *
 * Each is evaluated against the ones already established, so a `ref` inside a
 * shared value reaches that value rather than an equal copy — the same
 * ordering the lowering used to resolve it, and the order `memo` requires.
 *
 * Rebuilt per case: the model's memo is per invocation and a case is one
 * invocation, so nothing here depends on two cases seeing the same object.
 *
 * This is the whole of what the `'==='` group needs that another group does
 * not. Identity across a shared node is what its `byItself` cases are for —
 * `arrayByItself` is `true` where `arrayByEqualArray` is `false` — and
 * `amnesia` forgets by design, so the nodes it must not recompute are handed
 * to it rather than walked by a second evaluator here.
 *
 * @type {(shared: readonly SharedNode[]) => readonly (readonly[Exp, unknown])[]}
 */
const sharedMemo = shared => shared.reduce(
    (/** @type {readonly (readonly[Exp, unknown])[]} */ memo, [, node]) =>
        [...memo, /** @type {readonly[Exp, unknown]} */
            ([node, vm({ ...context, memo })(node)])],
    [])

/**
 * `amnesia`, with the given shared nodes established.
 *
 * @type {(shared: readonly SharedNode[]) => (e: Exp) => unknown}
 */
const shared = s => vm({ ...context, memo: sharedMemo(s) })

/** The corpus's shared values as nodes, lowered once. */
const nodes = sharedExp(data.shared)

/**
 * An evaluator with the corpus's shared nodes established.
 *
 * Built per call, not once: the model's memo is per invocation and a case is
 * one invocation, so two cases never see the same object. Within one call
 * they do, which is what `arrayByItself` asserts.
 *
 * @type {() => (e: Exp) => unknown}
 */
const corpus = () => shared(nodes)

/** A case's expression, with the corpus's shared nodes resolved. @type {(g: Group) => (args: readonly Value[]) => Exp} */
const exprOf = caseExp(nodes)

/**
 * A value as `crossCheck`'s reference sees it, built through the same
 * lowering and the same `vm` a case goes through, so there is one walk from
 * a corpus value to a JavaScript one rather than two that can disagree.
 * Never a shared node — sharing exists only in `eq` — so `amnesia`'s
 * non-preservation of identity is not in play here.
 *
 * @type {(ev: (e: Exp) => unknown) => (v: Value) => unknown}
 */
const value = ev => v => ev(valuesExp(nodes)(v))

/**
 * The value one argument order produces: the case's expression evaluated
 * through `amnesia`'s `vm`.
 *
 * @type {(g: Group) => (args: readonly Value[]) => unknown}
 */
const run = g => args => corpus()(exprOf(g)(args))

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
        const e = exprOf(g)(args)
        // One evaluator per run: the case's expression and the reference's
        // operands must see the same object across a shared node, or
        // `arrayByItself` would compare two arrays here and one there.
        /** @type {(ev: (e: Exp) => unknown) => unknown} */
        const refValue = ev => f(...args.map(value(ev)))
        const fn = isThrows(c.expected)
            ? () => { refValue(corpus()) }
            : () => {
                const ev = corpus()
                const amnesiaValue = ev(e)
                const r = refValue(ev)
                assert(is(amnesiaValue, r), [amnesiaValue, 'is not', r, 'for', key])
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
    assertEq(typeof value(corpus())(functionValue), 'function')
    // Two function operands are two closures, not one node reached twice.
    const [f, g] = /** @type {readonly unknown[]} */ (
        value(corpus())([functionValue, functionValue]))
    assert(f !== g, ['one closure reached twice'])
    // A function is shareable like any other value: two are two closures, one
    // reached through `ref` is one, and a nested one is the same node inside
    // its container's, so all three establish as one.
    const own = sharedExp({ fn: functionValue, holder: [ref('fn')] })
    const operand = valuesExp(own)
    const ev = shared(own)
    /** @type {(a: Value, b: Value) => unknown} */
    const same = (a, b) => ev(['===', operand(a), operand(b)])
    assertEq(same(functionValue, functionValue), false)
    assertEq(same(ref('fn'), ref('fn')), true)
    assertEq(same(ref('holder'), [ref('fn')]), false)
    const [[, fn], [, holder]] = sharedMemo(own)
    assert(/** @type {readonly unknown[]} */ (holder)[0] === fn, ['nested function is a copy'])
}

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
    const own = sharedExp({ base: [], wrapper: [ref('base')] })
    const [[, base], [, wrapper]] = own
    const items = /** @type {readonly any[]} */ (wrapper)[1]
    assertEq(items.length, 1)
    assert(items[0] === base, ['wrapper holds a copy, not the shared node'])
    // And the values the nodes evaluate to share in the same place.
    const memo = sharedMemo(own)
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
    // The shared nodes are operands, so they are expressions too.
    for (const [, n] of nodes) { valid(n) }
    for (const g of data.groups) {
        for (const c of casesOf(g)) {
            for (const [, args] of orders(g)(c)) { valid(exprOf(g)(args)) }
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
         * `valueExp` resolves no names, so a `ref` in an `expected` — the one
         * position built with it — is a mistake.
         *
         * `throws` used to be refused here too. It is now unspellable where
         * it was being refused — only `Expectation` admits it — so the claim
         * is a type and its pin is in `types.ts`.
         */
        refOutsideShared: () => valueExp(() => ['ref', 'emptyArray']),
        /** And among the shared values, a name none of them carries. */
        unknownRef: () => valuesExp(sharedExp({}))(() => ['ref', 'nope']),
        /**
         * A `shared` value sees only the entries before it, so a forward
         * reference is refused — and a cycle, needing one, cannot be written.
         */
        forwardSharedRef: () => sharedExp({ a: [ref('b')], b: [] }),
        /** An operation the corpus does not exercise has no JavaScript here. */
        unusedOperation: () => reference('Number'),
        /**
         * A count the operation does not take. `Case<N>` cannot carry one,
         * but `caseExp` is exported and its `args` are a plain array, so the
         * mismatch is refused rather than lowered to a node that fails the
         * `exp` schema.
         */
        wrongOperandCount: () => exprOf({ op: '*', cases: [] })([1]),
    },
}

export const proof = {
    lambda,
    referenceCoverage,
    ...fromEntries(data.groups.map(g => [groupKey(g), group(g)])),
    crossCheck: fromEntries(data.groups.map(g => [groupKey(g), crossCheck(g)])),
    edagShape,
    nestedSharing,
    jsOnly,
}
