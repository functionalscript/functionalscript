/**
 * The JavaScript reference for `nanvm-lib`'s operators.
 *
 * Every case in [`module.f.mjs`](./module.f.mjs) is run through the native
 * JavaScript operators here, so the shared data is proven to describe
 * JavaScript before `nanvm-lib/tests/test/generated.rs` holds `nanvm-lib` to
 * it. This module contains no test cases of its own beyond the `jsOnly`
 * section at the end — adding a case means editing the data.
 *
 * @module
 *
 * @import { Case, EqCase, Op, Struct, Value } from './types.ts'
 */

import { assert, assertEq } from '../asserts/module.f.mjs'
import { data } from './module.f.mjs'

const { entries, fromEntries, hasOwn, is } = Object

/**
 * Builds the JavaScript value a `Value` describes.
 *
 * `resolve` supplies the *already built* object a `ref` names — rebuilding it
 * per reference would hand each side of a comparison its own object, which is
 * exactly what a `ref` exists to avoid.
 *
 * @type {(resolve: (name: string) => unknown) => (v: Value) => unknown}
 */
const build = resolve => v => {
    if (v === null) { return null }
    if (typeof v === 'function') {
        const info = v()
        switch (info[0]) {
            case 'function': { return () => 5 }
            case 'ref': { return resolve(info[1]) }
            case 'throw': { throw ['`throws` is not a value', info] }
        }
    }
    if (Array.isArray(v)) { return v.map(build(resolve)) }
    if (typeof v === 'object') {
        return fromEntries(entries(v).map(([k, p]) => [k, build(resolve)(p)]))
    }
    return v
}

/** Cases outside the `eq` group share nothing, so a `ref` is a mistake there. */
const value = build(name => { throw ['unknown shared value', name] })

/**
 * Applies an operator to already-built arguments.
 *
 * The `any` casts are the point of the exercise: these operators are being
 * applied to operand types TypeScript rejects (`{} * 1`, `-[]`), which is
 * exactly the coercion behaviour under test.
 *
 * @type {(op: Op) => (args: readonly unknown[]) => unknown}
 */
const apply = op => args => {
    const [a, b] = /** @type {readonly any[]} */(args)
    switch (op) {
        case 'unaryPlus': { return +a }
        case 'unaryMinus': { return -a }
        case 'mul': { return a * b }
        case 'stringCoercion': { return String(a) }
    }
}

/** `true` when a case's `expected` is `throws` rather than a value. */
const isThrows = (/** @type {Value} */ expected) =>
    typeof expected === 'function' && expected()[0] === 'throw'

/**
 * Every argument order a case is checked in: one, or both for a commutative
 * operator. The Rust printer applies the same rule.
 *
 * @type {(commutative: boolean) => (c: Case) => readonly (readonly[string, readonly Value[]])[]}
 */
const orders = commutative => c => commutative
    ? [[c.name, c.args], [`${c.name}Swapped`, c.args.toReversed()]]
    : [[c.name, c.args]]

/**
 * The leaf tests of one group, keyed by case name.
 *
 * Throwing cases go under a nested `throw` key — the framework's structural
 * way of declaring that a test is expected to throw. A throwing leaf stops at
 * its first exception, which is why each argument order is its own leaf.
 *
 * @type {(op: Op) => (commutative: boolean) => (cases: readonly Case[]) => object}
 */
const group = op => commutative => cases => {
    /** @type {(c: Case) => readonly (readonly[string, () => void])[]} */
    const leaves = c => {
        const { expected } = c
        /** @type {(args: readonly Value[]) => () => void} */
        const fn = isThrows(expected)
            ? args => () => { apply(op)(args.map(value)) }
            : args => () => {
                // `Object.is` rather than `===`, so `NaN` matches `NaN` and
                // `0` does not match `-0`; the Rust side compares the same way.
                const result = apply(op)(args.map(value))
                const e = value(expected)
                assert(is(result, e), [result, 'is not', e])
            }
        return orders(commutative)(c).map(([name, args]) => [name, fn(args)])
    }
    const ok = cases.filter(c => !isThrows(c.expected)).flatMap(leaves)
    const bad = cases.filter(c => isThrows(c.expected)).flatMap(leaves)
    return bad.length === 0
        ? fromEntries(ok)
        : { ...fromEntries(ok), throw: fromEntries(bad) }
}

const eqProof = (() => {
    const { shared, cases } = data.eq
    // Built once, so two `ref`s to the same name really are the same object.
    const built = fromEntries(entries(shared).map(([k, v]) => [k, value(v)]))
    const operand = build(name => {
        assert(hasOwn(built, name), ['unknown shared value', name])
        return built[name]
    })
    /** @type {(c: EqCase) => readonly[string, () => void]} */
    const leaf = c => [c.name, () => {
        const a = operand(c.a)
        const b = operand(c.b)
        assertEq(a === b, c.eq, [a, c.eq ? '===' : '!==', b])
        assertEq(b === a, c.eq)
    }]
    return fromEntries(cases.map(leaf))
})()

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
        /** `throws` describes a case's outcome; it is not a value to build. */
        throwsIsNotAValue: () => value(() => ['throw']),
        unknownRef: () => value(() => ['ref', 'nope']),
    },
}

export const proof = {
    eq: eqProof,
    ...fromEntries(data.groups.map(
        g => [g.op, group(g.op)(g.commutative === true)(g.cases)])),
    jsOnly,
}
