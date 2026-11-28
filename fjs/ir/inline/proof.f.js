/**
 * @import { Module } from '../types.ts'
 */

import { assertEq, assertError, assertOk } from '../../asserts/module.f.js'
import { any, l0 } from '../l0/module.f.js'
import {
    add, block, br, call, call_ref, code, codeOf, constant, f64, f64c, field, float, fn, get, hint, if_, int, let_, lit, loop, lt,
    make, match, n, next, own, return_, trunc_sat, u, unit, variant, bool,
} from '../module.f.js'
import { check } from '../check/module.f.js'
import { lifetime } from '../lifetime/module.f.js'
import { print } from '../print/module.f.js'
import { module as anyModule } from '../runtime/any/module.f.js'
import { inline } from './module.f.js'

const one = lit(f64c, 1)

/** `x + 1`, which every module here inlines. */
const add1 = hint('always', fn([['x', f64]], f64, x => add(x, one)))

/**
 * A module through the pass, as text, once the lifetime pass and the
 * checker take what it answers.
 *
 * @type {(m: Module) => string}
 */
const passed = m => {
    const written = assertOk(inline(m))
    assertOk(check(assertOk(lifetime(written))))
    return print(written)
}

export const proof = {
    // A local of the parameter's type is passed in place; a call is bound, inside the copy's block.
    basics: () => assertEq(passed({
        imports: [],
        functions: [['add1', add1], ['f', fn([['a', f64]], f64, a => call('self', 'add1', [call('self', 'add1', [a])]))]],
        exports: ['f'],
    }), [
        'fn f(a: f64) -> f64 =',
        '    let #i1.x = add(a, 1.0)',
        '    add(#i1.x, 1.0)',
        '',
        'export f',
        '',
    ].join('\n')),
    // A copy holds the copies of its calls; a function that the module exports stays, inlined into others too.
    nested: () => assertEq(passed({
        imports: [],
        functions: [
            ['add1', add1],
            ['add2', hint('always', fn([['y', f64]], f64, y => call('self', 'add1', [call('self', 'add1', [y])])))],
            ['g', fn([['a', f64]], f64, a => call('self', 'add2', [a]))],
        ],
        exports: ['g', 'add1'],
    }), [
        'inline always fn add1(x: f64) -> f64 =',
        '    add(x, 1.0)',
        '',
        'fn g(a: f64) -> f64 =',
        '    let #i2.x = add(a, 1.0)',
        '    add(#i2.x, 1.0)',
        '',
        'export g, add1',
        '',
    ].join('\n')),
    // Every local and label of a copy takes its prefix, a `br return` leaves its block, and an owned parameter is bound.
    shapes: () => {
                const body = fn([['x', f64], ['c', code([['borrow', f64]], f64)]], f64, (x, c) =>
            let_('p', make([['x', x], ['n', trunc_sat(u(8), x)]]), p =>
                match(variant(bool, 'true', make([])), [
                    [['false'], null, return_(one)],
                    [['true'], null, loop('again', [['k', f64, lit(f64, 0)]], k =>
                        if_(lt(k, float(field(p, 'n'))), next('again', [['k', add(k, one)]]),
                            block('out', f64, br('out', call_ref(c, [field(p, 'x')])))))],
                ])))
        assertEq(passed({
            imports: [],
            constants: [['c', { type: f64, value: call('self', 'h', [lit(f64, 2)]) }]],
            functions: [
                ['shape', hint('always', body)],
                ['h', fn([['x', f64]], f64, x => x)],
                ['f', fn([], f64, () => call('self', 'shape', [constant('self', 'c'), codeOf('h')]))],
            ],
            exports: ['f'],
        }), [
            'const c: f64 =',
            '    h(2.0 as f64)',
            '',
            'fn h(x: f64) -> f64 =',
            '    x',
            '',
            'fn f() -> f64 =',
            '    block #i0.return: f64',
            '        let #i0.p = { x: self.c, n: trunc_sat(u(8), self.c) }',
            '        match true',
            '          false =>',
            '            br #i0.return 1.0',
            '          true =>',
            '            loop #i0.again (#i0.k: f64 = 0.0 as f64)',
            '                if lt(#i0.k, float(#i0.p.n))',
            '                then',
            '                    br #i0.again { #i0.k: add(#i0.k, 1.0) }',
            '                else',
            '                    block #i0.out: f64',
            '                        br #i0.out call_ref(code(h), #i0.p.x)',
            '',
            'export f',
            '',
        ].join('\n'))
    },
    // An argument narrower than its parameter is widened to it, so the copy reads it as the body was checked.
    widen: () => assertEq(passed({
        imports: l0,
        functions: [
            ['kind', hint('always', fn([['v', any]], int(0n, 8n), v => call('Any', 'kind', [v])))],
            ['take', hint('always', fn([own('v', any)], any, v => v))],
            ['f', fn([['v', any]], int(0n, 8n), v => match(v, [
                [['number'], 'x', call('self', 'kind', [get('x')])],
                [null, null, call('self', 'kind', [call('self', 'take', [v])])],
            ]))],
        ],
        exports: ['f'],
    }), [
        ...print({ imports: l0, functions: [], exports: [] }).split('\n').slice(0, -1),
        '',
        'fn f(v: any) -> int(0, 8) =',
        '    match v',
        '      number as x =>',
        '        let #i0.v =',
        '            block #i0.: any',
        '                x',
        '        Any.kind(#i0.v)',
        '      else =>',
        '        let #i2.v =',
        '            let #i1.v = v',
        '            #i1.v',
        '        Any.kind(#i2.v)',
        '',
        'export f',
        '',
    ].join('\n')),
    // A field of a made value is passed in place; a `br` to a block names its product's fields as they are, though a loop elsewhere has the block's label.
    labels: () => {
        const pair = /** @type {const} */ (['product', [['x', f64]]])
        const body = fn([['a', f64]], f64, a => add(
            field(block('l', pair, br('l', make([['x', a]]))), 'x'),
            loop('l', [['x', f64, a]], x => if_(lt(x, one), next('l', [['x', add(x, one)]]), x)),
        ))
        assertEq(passed({
            imports: [],
            functions: [['g', hint('always', body)], ['f', fn([['a', f64]], f64, a => let_('p', make([['x', a]]), p => call('self', 'g', [field(p, 'x')])))]],
            exports: ['f'],
        }), [
            'fn f(a: f64) -> f64 =',
            '    let p = { x: a }',
            '    add(',
            '        (',
            '            block #i0.l: { x: f64 }',
            '                br #i0.l { x: p.x }',
            '        ).x,',
            '        loop #i0.l (#i0.x: f64 = p.x)',
            '            if lt(#i0.x, 1.0) then br #i0.l { #i0.x: add(#i0.x, 1.0) } else #i0.x',
            '    )',
            '',
            'export f',
            '',
        ].join('\n'))
    },
    // A field or a literal given to an integer that the body compares is bound, and the copy's comparison narrows the
    // `let` as the body's narrowed the parameter; a local stays in place, and the comparison narrows it.
    narrowed: () => {
        const low = hint('always', fn([['w', u(64)]], u(32), w => if_(lt(w, n(0x1_0000_0000n)), w, n(0n))))
        assertEq(passed({
            imports: [],
            functions: [
                ['low', low],
                ['f', fn([['a', u(64)]], u(32), a => let_('p', make([['w', a]]), p => call('self', 'low', [field(p, 'w')])))],
                ['g', fn([], u(32), () => call('self', 'low', [lit(u(64), 5n)]))],
                ['h', fn([['a', u(64)]], u(32), a => call('self', 'low', [a]))],
            ],
            exports: ['f', 'g', 'h'],
        }), [
            'fn f(a: u(64)) -> u(32) =',
            '    let p = { w: a }',
            '    let #i0.w = p.w',
            '    if lt(#i0.w, 4294967296) then #i0.w else 0',
            '',
            'fn g() -> u(32) =',
            '    let #i0.w = 5 as u(64)',
            '    if lt(#i0.w, 4294967296) then #i0.w else 0',
            '',
            'fn h(a: u(64)) -> u(32) =',
            '    if lt(a, 4294967296) then a else 0',
            '',
            'export f, g, h',
            '',
        ].join('\n'))
    },
    // Two compared parameters given one local are bound by a `let` each, so the copy's `lt` narrows each as the
    // body's narrowed its parameters, and the result still checks; a parameter that the body does not compare,
    // given the same local, stays in place.
    aliased: () => {
        const pick = hint('always', fn([['a', u(8)], ['b', u(8)], ['c', u(8)]], int(0n, 254n), (a, b, c) =>
            if_(lt(a, b), a, if_(lt(c, n(1n)), c, n(0n)))))
        assertEq(passed({
            imports: [],
            functions: [
                ['pick', pick],
                ['f', fn([['x', u(8)]], int(0n, 254n), x => call('self', 'pick', [x, x, x]))],
                ['g', fn([['x', u(8)], ['y', u(8)]], int(0n, 254n), (x, y) => call('self', 'pick', [x, y, y]))],
            ],
            exports: ['f', 'g'],
        }), [
            'fn f(x: u(8)) -> int(0, 254) =',
            '    let #i0.a = x',
            '    let #i0.b = x',
            '    let #i0.c = x',
            '    if lt(#i0.a, #i0.b) then #i0.a else if lt(#i0.c, 1) then #i0.c else 0',
            '',
            'fn g(x: u(8), y: u(8)) -> int(0, 254) =',
            '    let #i0.b = y',
            '    let #i0.c = y',
            '    if lt(x, #i0.b) then x else if lt(#i0.c, 1) then #i0.c else 0',
            '',
            'export f, g',
            '',
        ].join('\n'))
    },
    // A prefix that a name of the function starts with is skipped.
    fresh: () => assertEq(passed({
        imports: [],
        functions: [['add1', add1], ['f', fn([['#i0.a', f64]], f64, a => loop('l', [['#i1.k', f64, a]], k => call('self', 'add1', [k])))]],
        exports: ['f'],
    }), [
        'fn f(#i0.a: f64) -> f64 =',
        '    loop l (#i1.k: f64 = #i0.a)',
        '        add(#i1.k, 1.0)',
        '',
        'export f',
        '',
    ].join('\n')),
    // Any's hooks hold copies of isRef, and the module still checks.
    any: () => {
        const hinted = { ...anyModule, functions: anyModule.functions.map(([k, f]) => /** @type {const} */ ([k, k === 'isRef' ? hint('always', f) : f])) }
        const text = passed(hinted)
        assertEq(text.includes('self.isRef('), false)
        assertEq(text.includes('inline always fn isRef'), true)
    },
    // A linear value narrower than its parameter is refused, since the copy would own it; one of the parameter's type is lent in place.
    linear: () => {
        const l = /** @type {const} */ (['sealed', 'L', 'l', null])
        /** @type {Module} */
        const m = {
            imports: [['L', { abi: 'test', types: [['l', { variants: ['a', 'b'], kind: 'k', carrier: 'i32' }]], functions: [['k', { params: [['x', l]], result: int(0n, 1n) }], ['close', { params: [own('x', l)], result: unit }]] }]],
            functions: [
                ['g', hint('always', fn([['x', l]], int(0n, 1n), x => call('L', 'k', [x])))],
                ['f', fn([['x', l]], int(0n, 1n), x => match(x, [[['a'], 'y', call('self', 'g', [get('y')])], [['b'], null, call('self', 'g', [x])]]))],
            ],
            exports: ['f'],
        }
        assertEq(assertError(inline(m)), 'g is inline always, and a call lends its x a linear value narrower than its parameter, which a copy would own')
        assertEq(passed({ ...m, functions: [m.functions[0], ['f', fn([['x', l]], int(0n, 1n), x => call('self', 'g', [x]))]] }).split('\n').slice(-5).join('\n'), [
            'fn f(x: l) -> u(1) =',
            '    L.k(x)',
            '',
            'export f',
            '',
        ].join('\n'))
        // A call in a function that goes, inlined everywhere, is never copied.
        assertOk(inline({ ...m, functions: [...m.functions.map(([k, f]) => /** @type {const} */ ([k, k === 'f' ? hint('always', f) : f])), ['e', fn([['x', l]], int(0n, 1n), x => call('L', 'k', [x]))]], exports: ['e'] }))
        // A linear value that the function owns moves into a copy with no block, and a copy in a block is refused.
        const close = hint('always', fn([own('x', l)], unit, x => call('L', 'close', [x])))
        const closing = /** @type {(c: ReturnType<typeof fn>) => Module} */ (c => ({ ...m, functions: [['c', c], ['f', fn([own('x', l)], unit, x => call('self', 'c', [x]))]] }))
        assertEq(passed(closing(close)).split('\n').slice(-6).join('\n'), [
            'fn f(own x: l) -> unit =',
            '    let #i0.x = x',
            '    L.close(#i0.x)',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(assertError(inline(closing(hint('always', fn([own('x', l)], unit, x => return_(call('L', 'close', [x]))))))), 'c is inline always and owns its linear x, which a copy in a block could not take over')
    },
    // A module that the checker refuses is refused.
    refused: () => assertEq(assertError(inline({ imports: [], functions: [['f', hint('always', fn([], f64, () => call('self', 'f', [])))]], exports: [] })),
        'f is inline always and calls itself through functions inline always, so its copies would never end'),
    // A call of a function with no hint, or hinted never, stays.
    kept: () => assertEq(passed({
        imports: [],
        functions: [['a', fn([['x', bool]], bool, x => x)], ['b', hint('never', fn([['x', bool]], bool, x => x))], ['f', fn([['x', bool]], bool, x => call('self', 'a', [call('self', 'b', [x])]))]],
        exports: ['f'],
    }).split('\n').slice(-5).join('\n'), [
        'fn f(x: bool) -> bool =',
        '    a(b(x))',
        '',
        'export f',
        '',
    ].join('\n')),
}
