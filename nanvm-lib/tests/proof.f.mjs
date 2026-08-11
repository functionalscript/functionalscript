/**
 * The JavaScript reference for `nanvm-lib`'s operators.
 *
 * Every case in [`module.f.mjs`](./module.f.mjs) is run through the native
 * JavaScript operators here, so the shared data is proven to describe
 * JavaScript before [`test/generated.rs`](./test/generated.rs) holds
 * `nanvm-lib` to it. This module contains no test cases of its own beyond the
 * `jsOnly` section at the end — adding a case means editing the data.
 *
 * @module
 */

/** @import { Case, EqCase, Op, Operand, Value } from './types.ts' */
import { assert, assertEq } from '../../fjs/asserts/module.f.mjs'
import { data } from './module.f.mjs'

const { is } = Object
const { fromEntries } = Object

/**
 * Builds the JavaScript value a `Value` describes.
 *
 * @type {(v: Value) => unknown}
 */
const build = v => {
    switch (v[0]) {
        case 'null': { return null }
        case 'undefined': { return undefined }
        case 'boolean': { return v[1] }
        case 'number': { return v[1] }
        case 'string': { return v[1] }
        case 'bigint': { return v[1] }
        case 'array': { return v[1].map(build) }
        case 'object': { return fromEntries(v[1].map(([k, p]) => [k, build(p)])) }
        case 'function': { return () => 5 }
    }
}

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

/**
 * Runs one case and checks the result against its expectation.
 *
 * `Object.is` rather than `===`, so `NaN` matches `NaN` and `0` does not
 * match `-0`; the Rust side compares the same way.
 *
 * @type {(op: Op) => (args: readonly Value[]) => (expected: Value) => void}
 */
const check = op => args => expected => {
    const result = apply(op)(args.map(build))
    const e = build(expected)
    assert(is(result, e), [result, 'is not', e])
}

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
        const fn = expected[0] === 'throw'
            ? args => () => { apply(op)(args.map(build)) }
            : args => () => check(op)(args)(expected[1])
        return orders(commutative)(c).map(([name, args]) => [name, fn(args)])
    }
    const ok = cases.filter(c => c.expected[0] !== 'throw').flatMap(leaves)
    const bad = cases.filter(c => c.expected[0] === 'throw').flatMap(leaves)
    return bad.length === 0
        ? fromEntries(ok)
        : { ...fromEntries(ok), throw: fromEntries(bad) }
}

/** @type {(shared: { readonly[k in string]?: unknown }) => (o: Operand) => unknown} */
const operand = shared => o => {
    if (o[0] === 'ref') {
        const v = shared[o[1]]
        assert(v !== undefined, ['unknown shared value', o[1]])
        return v
    }
    return build(o)
}

const eqProof = (() => {
    const shared = fromEntries(data.eq.shared.map(([k, v]) => [k, build(v)]))
    /** @type {(c: EqCase) => readonly[string, () => void]} */
    const leaf = c => [c.name, () => {
        const a = /** @type {any} */(operand(shared)(c.a))
        const b = /** @type {any} */(operand(shared)(c.b))
        assertEq(a === b, c.eq, [a, c.eq ? '===' : '!==', b])
        assertEq(b === a, c.eq)
    }]
    return fromEntries(data.eq.cases.map(leaf))
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
        toStringNotAFunction: () => String(/** @type {any} */({ toString: 'hello' })),
        toStringNotPrimitive: () => String({ toString: () => [] }),
    },
}

export const proof = {
    eq: eqProof,
    ...fromEntries(data.groups.map(
        g => [g.op, group(g.op)(g.commutative === true)(g.cases)])),
    jsOnly,
}
