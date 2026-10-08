/**
 * The shared operator corpus runs through represented EDAG interpretation and
 * an independent JavaScript reference. Amnesia evaluates lowered expressions
 * as Result<EdagValue, EdagValue>; the reference applies native operators to
 * ordinary values decoded directly from the corpus's fixture descriptions.
 * No host-valued EDAG evaluator or callable runtime compilation is needed.
 *
 * All corpus cases run through Amnesia, including canonical function text.
 * Existing host-allocation failures remain explicit host-throw assertions;
 * language failures are Result assertions.
 * Only the native reference skips host-marked function-text cases. Named
 * shared fixtures seed Amnesia's caller-owned memo and the independent native
 * fixture environment, preserving identity within each implementation.
 *
 * @import { Exp } from '../edag/types.ts'
 * @import { EdagValue, Array as ValueArray } from '../edag/value/types.ts'
 * @import { ValueResult } from '../edag/value/control/types.ts'
 * @import { Context } from '../edag/amnesia/types.ts'
 * @import { AnyCase, CallbackName, Group, SharedNode, Value } from './types.ts'
 */

import { assert, assertEq, assertError, assertNotNullish, assertOk, assertStructurallySame } from '../asserts/module.f.mjs'
import { structurallySame } from '../types/object/structurally_same/module.f.mjs'
import { exp } from '../edag/module.f.mjs'
import { vm, invoke } from '../edag/amnesia/module.f.mjs'
import { call } from '../edag/value/call/module.f.mjs'
import { toData } from '../edag/value/to_unknown/module.f.mjs'
import { ok } from '../types/result/module.f.mjs'
import { validate } from '../rtti/validate/module.f.mjs'
import {
    callback,
    callbackExp,
    caseExp,
    casesOf,
    data,
    functionExp,
    functionValue,
    groupKey,
    hasUnreached,
    isThrows,
    lambdaExp,
    orders,
    ref,
    returns,
    sharedExp,
    unreached,
    unreachedExp,
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
 * These are the independent native checks; every case also runs through
 * `amnesia`'s `vm` (see `run` below). An absent entry means that group is not cross-checked at
 * all, which `referenceCoverage` below makes a deliberate list of exactly
 * one rather than an oversight: `own`, whose plain
 * `Object.getOwnPropertyDescriptor` read is not a copy of `amnesia`'s
 * stricter receiver/key invariants — `nonStringKeyThrows` (`[{1: 42}, 1]`) is
 * real JS and does *not* throw through the descriptor read, only through
 * `amnesia`'s FJS-specific string-key check — so the two are expected to
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
    'instanceof Array': a => a instanceof Array,
    throw: a => { throw a },
    is: (a, b) => Object.is(a, b),
    String: a => String(a),
    Number: a => Number(a),
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
    '!==': (a, b) => a !== b,
    '?:': (a, b, c) => a ? b : c,
}

/**
 * The JavaScript a method group denotes: the host's own built-in, called on
 * the receiver with the rest as its arguments — `(r, ...a) => r.at(...a)`.
 * One entry for every method rather than one per name in {@link js}: the
 * method is the host's, so there is nothing per name to write, and
 * the represented method dispatcher reached through the chain node is
 * exactly what this checks against.
 *
 * @type {(method: string) => (...args: readonly any[]) => unknown}
 */
const methodReference = method => (r, ...a) => r[method](...a)

/**
 * A group's reference: {@link js}'s entry for an operator, possibly absent,
 * and {@link methodReference} for a method, never absent.
 *
 * @type {(g: Group) => ((...args: readonly any[]) => unknown) | undefined}
 */
const referenceOf = g => 'method' in g ? methodReference(g.method) : js[groupKey(g)]

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
const context = { frame: [], args: [] }

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
 * @type {(shared: readonly SharedNode[]) => readonly (readonly[Exp, EdagValue])[]}
 */
const sharedMemo = shared => shared.reduce(
    (/** @type {readonly (readonly[Exp, EdagValue])[]} */ memo, [, node]) =>
        [...memo, /** @type {readonly[Exp, EdagValue]} */
            ([node, assertOk(vm({ ...context, memo })(node))])],
    [])

/**
 * `amnesia`, with the given shared nodes established.
 *
 * @type {(shared: readonly SharedNode[]) => (e: Exp) => ValueResult}
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
 * @type {() => (e: Exp) => ValueResult}
 */
const corpus = () => shared(nodes)

/** A case's expression, with the corpus's shared nodes resolved. @type {(g: Group) => (args: readonly Value[]) => Exp} */
const exprOf = caseExp(nodes)

/**
 * Fixed JavaScript callback fixtures, each construction returning a fresh
 * function. They decode corpus descriptions; they do not execute EDAG.
 * @type {Readonly<Record<CallbackName, () => (...args: readonly any[]) => unknown>>}
 */
const callbacks = {
    args: () => (...a) => a,
    first: () => (...a) => a[0],
    prop: () => (...a) => a[0].x,
    double: () => (...a) => a[0] * 2,
    add: () => (...a) => a[0] + a[1],
    pair: () => (...a) => [a[0], [a[0]]],
    ascending: () => (...a) => a[0] - a[1],
    descending: () => (...a) => a[1] - a[0],
    zero: () => () => 0,
}

/**
 * Ordinary JavaScript values built directly from corpus fixtures. Named
 * references retain identity; every other container and function is fresh.
 * A returns fixture builds its result on each call, exactly as its literal
 * JavaScript spelling does. This decoder has no operator or EDAG dispatch.
 * @type {(shared: readonly (readonly [string, unknown])[], v: Value) => unknown}
 */
const fixture = (shared, v) => {
    if (typeof v === 'function') {
        const info = v()
        switch (info[0]) {
            case 'ref': { return assertNotNullish(shared.find(([name]) => name === info[1]))[1] }
            case 'function': { return () => undefined }
            case 'callback': { return callbacks[info[1]]() }
            case 'returns': { return () => fixture([], info[1]) }
            default: { return 1n / 0n }
        }
    }
    if (v instanceof Array) { return v.map(item => fixture(shared, item)) }
    return typeof v === 'object' && v !== null
        ? fromEntries(Object.entries(v).map(([name, item]) => [name, fixture(shared, item)]))
        : v
}

/** A fresh reference fixture environment for each cross-check. @type {() => readonly (readonly [string, unknown])[]} */
const fixtureShared = () => Object.entries(data.shared).reduce(
    (/** @type {readonly (readonly [string, unknown])[]} */ shared, [name, v]) =>
        [...shared, /** @type {const} */ ([name, fixture(shared, v)])], [])

/** Evaluated corpus values stay represented until a proof requests data. @type {(v: Value) => EdagValue} */
const value = v => assertOk(corpus()(valuesExp(nodes)(v)))

/** Only function-free results cross this existing data conversion boundary. @type {(result: ValueResult) => unknown} */
const runtime = result => assertOk(toData(assertOk(result)))

/**
 * The value one argument order produces: the case's expression evaluated
 * through `amnesia`'s `vm`.
 *
 * @type {(g: Group) => (args: readonly Value[]) => ValueResult}
 */
const run = g => args => corpus()(exprOf(g)(args))

/**
 * The host-reference tree preserves structural throwing leaves and excludes
 * only function-text-dependent cases. Represented interpretation below runs
 * those cases too, because it owns the canonical EDAG-derived text.
 * @type {(g: Group) => (leaves: (c: AnyCase) => readonly (readonly[string, () => void])[]) => object}
 */
const tree = g => leaves => {
    const cases = casesOf(g).filter(c => c.host === undefined)
    const good = cases.filter(c => !isThrows(c.expected)).flatMap(leaves)
    const bad = cases.filter(c => isThrows(c.expected)).flatMap(leaves)
    return bad.length === 0
        ? fromEntries(good)
        : { ...fromEntries(good), throw: fromEntries(bad) }
}

/**
 * Every case runs through represented interpretation, including canonical
 * function text. Language failures inspect Result; existing allocation-limit
 * cases still assert their host exceptions until resource handling lands.
 * The framework reserves the exact name `throw`, so Result leaves with that
 * corpus name use `throwResult` instead.
 * @type {(g: Group) => object}
 */
const group = g => {
    const cases = casesOf(g)
    const results = fromEntries(cases.filter(c => c.allocation === undefined).flatMap(c => orders(g)(c).map(([name, args]) => [name === 'throw' ? 'throwResult' : name, () => {
        const result = run(g)(args)
        if (isThrows(c.expected)) { assertError(result); return }
        const actual = assertOk(result)
        const expected = assertOk(vm(context)(valueExp(c.expected)))
        assert(structurallySame(actual, expected), [actual, 'is not', expected])
    }])))
    const allocation = cases.filter(c => c.allocation !== undefined).flatMap(c => orders(g)(c).map(([name, args]) => [name, () => { run(g)(args) }]))
    return allocation.length === 0 ? results : { ...results, throw: { allocation: fromEntries(allocation) } }
}

/**
 * Independently execute each operation on ordinary JavaScript fixture values.
 * Named references share within each side; graph values and host values never
 * need to be the same objects. Non-throwing data results agree structurally.
 *
 * `own` has its documented string-key restriction and no host counterpart.
 * Unreached operands cannot become eager reference values, so their lazy cases
 * are interpreter-only. Function-text cases are skipped only here: JavaScript
 * gives these literal callbacks their host text, not canonical EDAG text.
 * @type {(g: Group) => object}
 */
const crossCheck = g => {
    const key = groupKey(g)
    const f = referenceOf(g)
    if (f === undefined) { return {} }
    /** @type {(c: AnyCase) => readonly (readonly[string, () => void])[]} */
    const leaves = c => c.args.some(hasUnreached) ? [] : orders(g)(c).map(([name, args]) => {
        const refValue = () => {
            const shared = fixtureShared()
            return f(...args.map(v => fixture(shared, v)))
        }
        const fn = isThrows(c.expected)
            ? () => { refValue() }
            : () => {
                const actual = runtime(run(g)(args))
                const expected = refValue()
                assert(structurallySame(actual, expected), [actual, 'is not', expected, 'for', key])
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
        assert(key === 'own' || referenceOf(g) !== undefined, ['no JavaScript reference for', key])
    }
    assert(!('own' in js), ['own is excluded deliberately; see the js table'])
}

/**
 * A `functionValue` lowers to the smallest closure, anywhere it appears.
 *
 * The node is what both consumers agree on — `amnesia` establishes it, the
 * printer recognises exactly it — so its shape is pinned here as data, and
 * its evaluation as a represented function. Nested, it is the same node inside the
 * container's, which is what lets a function sit in an array or object
 * operand without either consumer needing a second walk.
 */
const lambda = () => {
    assertStructurallySame(valueExp(functionValue), ['=>', 0, [], ['undefined']])
    assertStructurallySame(valueExp(functionValue), lambdaExp())
    assertStructurallySame(valueExp([functionValue]), ['[]', [lambdaExp()]])
    assertStructurallySame(valueExp({ f: functionValue }), ['{}', [[':', 'f', lambdaExp()]]])
    assertEq(/** @type {readonly unknown[]} */ (value(functionValue))[0], '=>')
    assertStructurallySame(assertOk(call(ok(value(functionValue)), [], invoke)), ['undefined'])
    // A `returns` is the function a callback is, its value the body.
    assertStructurallySame(valueExp(returns([1])), ['=>', 0, [], ['[]', [1]]])
    assertStructurallySame(valueExp(returns(unreached)), functionExp(unreachedExp()))
    // Two function operands are two closures, not one node reached twice.
    const [, [f, g]] = /** @type {ValueArray} */ (value([functionValue, functionValue]))
    assert(f !== g, ['one closure reached twice'])
    // A function is shareable like any other value: two are two closures, one
    // reached through `ref` is one, and a nested one is the same node inside
    // its container's, so all three establish as one.
    const own = sharedExp({ fn: functionValue, holder: [ref('fn')] })
    const operand = valuesExp(own)
    const ev = shared(own)
    /** @type {(a: Value, b: Value) => unknown} */
    const same = (a, b) => assertOk(ev(['===', operand(a), operand(b)]))
    assertEq(same(functionValue, functionValue), false)
    assertEq(same(ref('fn'), ref('fn')), true)
    assertEq(same(ref('holder'), [ref('fn')]), false)
    const [[, fn], [, holder]] = sharedMemo(own)
    assert(/** @type {ValueArray} */ (holder)[1][0] === fn, ['nested function is a copy'])
}

/**
 * Each callback does what its JavaScript spelling says, called through
 * `amnesia` as a member function calls it, and lowers to a function with a
 * body wherever it appears.
 */
const callbacksProof = () => {
    /** @type {(name: CallbackName, args: readonly Value[]) => unknown} */
    const call = (name, args) => runtime(corpus()(['()', callbackExp(name), args.map(valueExp)]))
    assertStructurallySame(call('args', [1, 'a']), [1, 'a'])
    assertEq(call('first', [3, 4]), 3)
    assertEq(call('prop', [{ x: 5 }]), 5)
    assertEq(call('double', [3]), 6)
    assertEq(call('add', ['a', 'b']), 'ab')
    assertStructurallySame(call('pair', [1]), [1, [1]])
    assertEq(call('ascending', [1, 3]), -2)
    assertEq(call('descending', [1, 3]), 2)
    assertEq(call('zero', [1, 3]), 0)
    assertStructurallySame(valueExp(callback('double')), callbackExp('double'))
    assertStructurallySame(valueExp([callback('args')]), ['[]', [['=>', 0, [], ['rest']]]])
    assertEq(/** @type {readonly unknown[]} */ (value(callback('args')))[0], '=>')
}

/**
 * A method case lowers to the chain node a compiled call is, the receiver
 * first and the arguments one array operand, and files under a key no
 * operator's can be.
 */
const method = () => {
    const g = { method: /** @type {const} */ ('at'), cases: [] }
    assertStructurallySame(
        exprOf(g)([[1, 2], 0]),
        ['.', ['[]', [1, 2]], 'at', ['|()', [0]]])
    assertStructurallySame(exprOf(g)([[]]), ['.', ['[]', []], 'at', ['|()', []]])
    assertEq(groupKey(g), '.at')
    assertEq(assertOk(corpus()(exprOf(g)([[1, 2], -1]))), 2)
}

/**
 * An `unreached` lowers to an operation that throws when established, and
 * `amnesia` returns an error on it — which makes a lazy-position case
 * holding one a proof: the case answers a value only because the operand was
 * never established. The Rust side's counterpart is `rust/proof.f.mjs`'s
 * printed thunk, and `nanvm-lib`'s own `bigTenDividedByZero`.
 */
const unreachedOperand = {
    shape: () => {
        assertStructurallySame(valueExp(unreached), unreachedExp())
        assertStructurallySame(valueExp([unreached]), ['[]', [unreachedExp()]])
        // Held at any depth, as the lowering reaches it.
        assert(hasUnreached(unreached))
        assert(hasUnreached([1, [unreached]]))
        assert(hasUnreached({ a: { b: unreached } }))
        assert(!hasUnreached(functionValue))
        assert(!hasUnreached([functionValue, { a: 1 }]))
        assert(!hasUnreached(null))
        assert(!hasUnreached(1))
    },
    /** In a lazy position the case answers, a container holding it too; in an eager one it returns an error. */
    lazy: () => {
        assertEq(assertOk(corpus()(['&&', false, valueExp(unreached)])), false)
        assertEq(assertOk(corpus()(['&&', false, valueExp([unreached])])), false)
        assertEq(assertOk(corpus()(['?:', true, 1, valueExp(unreached)])), 1)
    },
    failures: () => {
        assertError(corpus()(valueExp(unreached)))
        assertError(corpus()(['*', 1, valueExp(unreached)]))
        assertError(corpus()(['?:', false, 1, valueExp(unreached)]))
    },
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
        /** @type {ValueArray} */ (wrapperValue)[1][0] === baseValue,
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
    throw: {
        /**
         * A function's body is lowered where nothing is shared: the
         * lowering shares no node across a function boundary.
         */
        refInReturns: () => valuesExp(sharedExp({ a: [] }))(returns(ref('a'))),
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
        /**
         * A shared value is established before any case, on both sides, so
         * one that must not be established is a contradiction — refused at
         * lowering, at any depth, rather than bound eagerly by the printer
         * as a `let` whose initializer no `Any<A>` can hold.
         */
        unreachedShared: () => sharedExp({ boom: unreached }),
        nestedUnreachedShared: () => sharedExp({ holder: [1, { boom: unreached }] }),
        /** An operation the corpus does not exercise has no JavaScript here. */
        unusedOperation: () => reference('Date'),
        /**
         * A count the operation does not take. `Case<N>` cannot carry one,
         * but `caseExp` is exported and its `args` are a plain array, so the
         * mismatch is refused rather than lowered to a node that fails the
         * `exp` schema.
         */
        wrongOperandCount: () => exprOf({ op: '*', cases: [] })([1]),
        /** A method case's first operand is its receiver, so it has one. */
        noReceiver: () => exprOf({ method: 'at', cases: [] })([]),
    },
}

export const proof = {
    lambda,
    callbacks: callbacksProof,
    method,
    referenceCoverage,
    ...fromEntries(data.groups.map(g => [groupKey(g) === 'throw' ? 'throwOperation' : groupKey(g), group(g)])),
    crossCheck: fromEntries(data.groups.map(g => [groupKey(g), crossCheck(g)])),
    edagShape,
    nestedSharing,
    unreachedOperand,
    jsOnly,
}
