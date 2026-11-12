// @ts-nocheck
// The samples of doc/sasha-gil/ir/definition.md: the interfaces of the
// runtime modules that the samples use, written over the `fjs:l0` ABI, and
// one IR module lowered by hand from normalized FAST.
//
// `typeOf`, `stringEquals` and `toBoolean` are the bodies of
// fjs/wasm/runtime/l1/module.f.js, as `node definition.fast.mjs` prints
// their FAST. `chain`, `repeat` and `adder` are small programs: an optional
// chain, a loop that owns its state, and a closure. It accompanies
// definition.check.mjs, which runs them.

import {
    add, block, bool, br, call, cast, code, codeOf, constant, eq, exact, f64, f64c, float, fn, get, iface, if_, int, let_, lit,
    loop, lt, make, match, n, ne, never, only, own, return_, sealed, sig, trap, u, unit,
} from './definition.ir.mjs'

// ── The interfaces ───────────────────────────────────────────────────────

const any = sealed('Any', 'any')
const kinds = (...names) => only(any, ...names)
const boolean = kinds('boolean')
const number = kinds('number')
const string = kinds('string')
const bigint = kinds('bigint')
const array = kinds('array')
const func = kinds('function')
const builder = sealed('Containers', 'builder')
/** A length or an index: L0's `i32` that is never negative. */
const index = u(31)

/**
 * Any seals `any`. Its public variants are the nine kinds in the order of
 * their tags, `kind` reads the tag, and `dup` and `drop` make it counted,
 * except where a value is known to have a kind that needs neither.
 */
export const Any = iface('Any', {
    abi: 'fjs:l0',
    types: {
        any: {
            carrier: 'i64',
            variants: ['undefined', 'null', 'boolean', 'number', 'string', 'bigint', 'array', 'object', 'function'],
            kind: 'kind', dup: 'dup', drop: 'drop',
            // on this host a value of these kinds holds nothing to release
            copy: ['undefined', 'null', 'boolean'],
            // a string literal is made by String, from its units in the program's memory
            literal: { string: { module: 'String', name: 'make_string' } },
        },
    },
    constants: { undefined: kinds('undefined'), null: kinds('null'), true: boolean, false: boolean },
    functions: {
        kind: sig({ v: any }, int(0n, 8n)),
        to_f64: sig({ v: number }, f64c),
        from_f64: sig({ x: f64 }, number),
        to_bool: sig({ v: boolean }, bool),
        from_bool: sig({ b: bool }, boolean),
        dup: sig({ v: any }, any),
        drop: sig({ v: own(any) }, unit),
    },
})

export const String = iface('String', {
    abi: 'fjs:l0',
    functions: {
        length: sig({ s: string }, index),
        at: sig({ s: string, i: index }, u(16), { fails: true, abi: 'unit' }),
    },
})

export const BigInt = iface('BigInt', { abi: 'fjs:l0', functions: { length: sig({ b: bigint }, index) } })

/**
 * A builder is linear: the ABI names no `dup` and no `drop` for it. `push`
 * consumes it and gives it back, and only `seal` ends it.
 */
export const Containers = iface('Containers', {
    abi: 'fjs:l0',
    types: { builder: { carrier: 'i32' } },
    functions: {
        begin_array: sig({ n: index }, builder),
        push: sig({ b: own(builder), v: own(any) }, builder, { fails: true, returns: 0 }),
        seal: sig({ b: own(builder) }, array, { fails: true }),
        length: sig({ a: array }, index),
        item: sig({ a: array, i: index }, any, { fails: true }),
    },
})

export const Functions = iface('Functions', {
    abi: 'fjs:l0',
    functions: {
        make_function: sig({
            c: code([['borrow', func], ['borrow', array]], any),
            frame: own(array), length: index, text: own(kinds('string', 'undefined')),
        }, func),
        call: sig({ f: func, args: array }, any, { fails: true }),
        frame: sig({ self: func, i: index }, any, { fails: true }),
        throw: sig({ v: any }, never, { fails: true }),
    },
})

/** One native row of L1. */
export const L1 = iface('L1', { abi: 'fjs:l1', functions: { add: sig({ a: any, b: any }, any, { fails: true }) } })

const kind = call('Any', 'kind')
const toF64 = call('Any', 'to_f64')
const toBool = call('Any', 'to_bool')
const fromBool = call('Any', 'from_bool')
const undefined_ = constant('Any', 'undefined')
const lengthOf = call('String', 'length')
const at = call('String', 'at')
const items = call('Containers', 'length')
const item = call('Containers', 'item')
/** An array of known length, through a builder that each `push` consumes and gives back. */
const arrayOf = (values, at = 0) => at === 0
    ? let_('b0', call('Containers', 'begin_array')(n(globalThis.BigInt(values.length))), () => arrayOf(values, 1))
    : at > values.length ? call('Containers', 'seal')(get(`b${values.length}`))
    : let_(`b${at}`, call('Containers', 'push')(get(`b${at - 1}`), values[at - 1]), () => arrayOf(values, at + 1))

// ── The module ───────────────────────────────────────────────────────────

const typeNames = constant('self', 'typeNames')
const first = call('self', 'first')
/** One link of an optional chain over arrays: the first item, or the chain's block left with `undefined`. */
const link = (e, name) => match(e, [
    [['array'], name, first(get(name))],
    [['undefined', 'null'], null, br('B', undefined_)],
    [null, null, trap('not array')],
])

export const sample = {
    name: 'sample',
    imports: { Any, String, BigInt, Containers, Functions, L1 },
    constants: {
        // FAST binding 79: an array of nine string literals, built once by `init`
        typeNames: [array, arrayOf(['undefined', 'object', 'boolean', 'number', 'string', 'bigint', 'object', 'object', 'function'].map(s => lit(string, s)))],
    },
    functions: {
        // FAST function 86: `typeNames[Number(kind(v))]`
        typeOf: fn({ v: any }, any, ({ v }) =>
            let_('k', kind(v), k =>
            if_(lt(k, items(typeNames)), item(typeNames, k), undefined_))),

        // FAST function 150 with its loop, function 145, inlined. `asString(a)` is a cast, and the rest of
        // the block reads `a` as the string `sa`. The counter is an integer: the branch on `lt(i, n)` is
        // what lets `add(i, 1)` fit. A difference returns from inside the loop.
        stringEquals: fn({ a: any, b: any }, any, ({ a, b }) =>
            cast(string, a, 'sa', sa =>
            let_('n', lengthOf(sa), length =>
            cast(string, b, 'sb', sb =>
            if_(ne(length, lengthOf(sb)),
                constant('Any', 'false'),
                loop('L', { i: [index, n(0n)] }, ({ i }) =>
                    if_(lt(i, length),
                        if_(eq(at(sa, i), at(sb, i)), br('L', make({ i: add(i, n(1n)) })), return_(constant('Any', 'false'))),
                        constant('Any', 'true')))))))),

        // the same function in FAST's own shape: the loop is a function that the body calls once, with its
        // captures as its first parameters, the counter is a JavaScript number, and the condition is a block
        stringEqualsF: fn({ a: any, b: any }, any, ({ a, b }) =>
            cast(string, a, 'sa', sa =>
            let_('n', lengthOf(sa), length =>
            cast(string, b, 'sb', sb =>
            if_(ne(length, lengthOf(sb)),
                constant('Any', 'false'),
                fromBool(eq(call('self', 'stringEqualsF.loop')(length, sa, sb, lit(f64c, 0)), float(length)))))))),
        'stringEqualsF.loop': fn({ n: index, a: string, b: string, start: f64 }, f64, ({ n: length, a, b, start }) =>
            loop('L', { i: [f64, start] }, ({ i }) =>
                // FAST's `&&`: binding 133 holds the first test, and the second is read only where it holds
                if_(let_('c', lt(i, float(length)), c => if_(c, eq(at(a, exact(index, i)), at(b, exact(index, i))), c)),
                    br('L', make({ i: add(i, lit(f64c, 1)) })),
                    i))),

        // FAST function 120, with a `bool` result, as a private function keeps it
        toBoolean: fn({ v: any }, bool, ({ v }) =>
            let_('k', kind(v), k =>
            if_(eq(k, n(2n)),
                cast(boolean, v, 'vb', toBool),
                if_(eq(k, n(3n)),
                    cast(number, v, 'vn', vn =>
                    let_('x', toF64(vn), x =>
                    let_('c', eq(x, x), c =>
                    if_(c, ne(x, lit(f64c, 0)), c)))),
                    if_(let_('c2', eq(k, n(4n)), c2 => if_(c2, c2, eq(k, n(5n)))),
                        // the view's `length` of a value of two kinds: a branch, and each module's own `length`
                        ne(match(v, [
                            [['string'], 's', lengthOf(get('s'))],
                            [['bigint'], 'g', call('BigInt', 'length')(get('g'))],
                            [null, null, trap('no length')],
                        ]), n(0n)),
                        let_('c3', eq(k, n(6n)), c3 =>
                        let_('c4', if_(c3, c3, eq(k, n(7n))), c4 =>
                        if_(c4, c4, eq(k, n(8n)))))))))),

        // a?.[0]?.[0] over arrays: an optional chain is a block, and a link that finds no receiver leaves it.
        // The second link leaves while the block owns `x`.
        first: fn({ a: array }, any, ({ a }) => if_(lt(n(0n), items(a)), item(a, n(0n)), undefined_)),
        chain: fn({ a: any }, any, ({ a }) => block('B', any, let_('x', link(a, 'a1'), x => link(x, 'a2')))),

        // a loop whose state is a value that it owns: each round lends `acc`, and the transfer drops it
        repeat: fn({ s: any, count: index }, any, ({ s, count }) =>
            loop('L', { acc: [any, lit(string, '')], i: [index, n(0n)] }, ({ acc, i }) =>
                if_(lt(i, count), br('L', make({ acc: call('L1', 'add')(acc, s), i: add(i, n(1n)) })), acc))),

        // a program: const adder = a => b => a + b
        'adder.inner': fn({ a: any, b: any }, any, ({ a, b }) => call('L1', 'add')(a, b)),
        // the code of the inner function's value: its capture from the frame, its argument from the list
        'adder.inner.code': fn({ self: func, args: array }, any, ({ self, args }) =>
            call('self', 'adder.inner')(
                call('Functions', 'frame')(self, n(0n)),
                if_(lt(n(0n), items(args)), item(args, n(0n)), undefined_))),
        adder: fn({ a: any }, any, ({ a }) =>
            call('Functions', 'make_function')(codeOf('adder.inner.code'), arrayOf([a]), n(1n), undefined_)),
    },
}

export const exported = ['typeOf', 'stringEquals', 'stringEqualsF', 'toBoolean', 'chain', 'repeat', 'adder']

// ── Mistakes that must be refused ────────────────────────────────────────

const withFunction = f => ({ ...sample, functions: { ...sample.functions, mistake: f } })
const beginArray = call('Containers', 'begin_array')
const push = call('Containers', 'push')
const seal = call('Containers', 'seal')

/** Each is `[what is wrong, the module, who refuses it]`. */
export const mistakes = [
    ['a string function on a value of unknown kind', withFunction(fn({ v: any }, index, ({ v }) => lengthOf(v))), 'checker'],
    ['a number read out of a value of unknown kind', withFunction(fn({ v: any }, f64, ({ v }) => toF64(v))), 'checker'],
    ['a counter that is incremented without a comparison', withFunction(fn({}, index, () =>
        loop('L', { i: [index, n(0n)] }, ({ i }) => br('L', make({ i: add(i, n(1n)) }))))), 'checker'],
    ['a float as an index', withFunction(fn({ s: string, x: f64 }, u(16), ({ s, x }) => at(s, x))), 'checker'],
    ['a float added to an integer', withFunction(fn({ x: f64 }, f64, ({ x }) => add(x, n(1n)))), 'checker'],
    ['a match that leaves kinds open', withFunction(fn({ v: any }, index, ({ v }) => match(v, [[['string'], 's', lengthOf(get('s'))]]))), 'checker'],
    ['an arm for a kind the operand cannot have', withFunction(fn({ s: string }, index, ({ s }) =>
        match(s, [[['number'], null, n(0n)], [null, null, n(1n)]]))), 'checker'],
    ['a transfer with a value of the wrong type', withFunction(fn({ v: any }, index, ({ v }) => br('return', v))), 'checker'],
    ['a kind tag compared with a float', withFunction(fn({ v: any }, bool, ({ v }) => eq(kind(v), lit(f64c, 3)))), 'checker'],
    ['a builder used after it was sealed', withFunction(fn({ v: any }, array, ({ v }) =>
        let_('b', beginArray(n(1n)), b => let_('first', seal(push(b, v)), () => seal(b))))), 'lifetime pass'],
    ['a builder that is never sealed', withFunction(fn({}, any, () => let_('b', beginArray(n(0n)), () => undefined_))), 'lifetime pass'],
]
