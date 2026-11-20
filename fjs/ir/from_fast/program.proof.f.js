/**
 * The proofs of slice 11a's programs: the IR that the lowering makes of an
 * untyped program over a stand-in for L1, its refusals, [`link`](./module.f.js),
 * and the originals of [`programs.f.js`](./programs.f.js), which the
 * [host proof](./proof.mjs) runs against what the lowering makes of them.
 * They stand apart from [`proof.f.js`](./proof.f.js), which is near the
 * size that a file of the website may have.
 *
 * @module
 *
 * @import { Module, Param, Signature, Term, Type } from '../types.ts'
 */

import { assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { any, l0 } from '../l0/module.f.js'
import { lifetime } from '../lifetime/module.f.js'
import {
    add, block, bool, br, call, call_ref, codeOf, constant, f64, f64c, false_, field, fn, get, let_, lit, loop as repeat, make, match,
    signature, trap, true_, trunc_sat, u,
} from '../module.f.js'
import { native } from '../native/module.f.js'
import { print } from '../print/module.f.js'
import { link, lower } from './module.f.js'
import {
    apply as applyP, both as bothP, differ as differP, either as eitherP, first as firstP, kind as kindP, maybe as maybeP, method as methodP, mixed as mixedP, nested as nestedP, not as notP, opposite as oppositeP, order as orderP, otherwise as otherwiseP, pair as pairP, record as recordP, sign as signP, size as sizeP, sum3 as sum3P, twice as twiceP,
} from './programs.f.js'
import { runtime, sourceOf } from './testlib.f.js'

/** The signatures of a module of one function, `f`. @type {(params: readonly Param[], result: Type) => Readonly<Record<string, Signature>>} */
const only = (params, result) => ({ f: signature(params, result) })

/** What the lowering makes of a module's text, with its imports, over the runtime `r`. @type {(signatures: Readonly<Record<string, Signature>>, text: string, r?: Parameters<typeof lower>[1]) => ReturnType<ReturnType<typeof lower>>} */
const over = (signatures, text, r = runtime) => {
    const { fast, imports } = assertOk(sourceOf(text))
    return lower(signatures, r)(fast, imports)
}

// programs

const anyOne = /** @type {const} */ ([['v', any]])
const anyTwo = /** @type {const} */ ([['a', any], ['b', any]])

/**
 * A stand-in for L1, which a program links: each function that the
 * lowering of a program calls, of the signature that L1's has, with a body
 * that only shows what links, and a function and a constant that nothing
 * calls or reads until a function does.
 *
 * @type {Module}
 */
const standIn = {
    imports: [...l0, ['Native', native]],
    constants: [['#c0', { type: any, value: constant('Any', 'undefined') }]],
    functions: [
        ...['add', 'subtract', 'multiply', 'divide', 'get'].map(k => /** @type {const} */ ([k, fn(anyTwo, any, get('a'))])),
        ['negate', fn(anyOne, any, get('v'))],
        ['typeOf', fn(anyOne, any, constant('self', '#c0'))],
        ...['lessThan', 'lessThanOrEqual', 'greaterThan', 'greaterThanOrEqual', 'strictEquals'].map(k => /** @type {const} */ ([k, fn(anyTwo, bool, false_)])),
        ['toBoolean', fn(anyOne, bool, call('self', 'strictEquals', [get('v'), get('v')]))],
        ['call', fn([['f', any], ['args', any]], any, get('f'))],
        ['unused', fn([], any, constant('Any', 'null'))],
    ],
    exports: [],
}

/** The runtime of a program, which links the stand-in for L1. */
const programRuntime = { ...runtime, l1: standIn }

/** The IR of a program's text, which no table types, printed without the interfaces that it imports. @type {(text: string) => string} */
const program = text => print({ ...assertOk(over({}, text, programRuntime)), imports: [] })

/** Why the lifetime pass, which types a program's plain stage as the checker does, refuses it. @type {(text: string) => string} */
const refusedProgram = text => assertError(lifetime(assertOk(over({}, text, programRuntime))))

/**
 * A term of every kind, which calls, reads and names a function `name`
 * gives the name of: `add` as L1 has it, `l1.add` as a program links it.
 *
 * @type {(name: (k: string) => string) => Term}
 */
const everyKind = name => block('B', f64, let_('x', trunc_sat(u(8), lit(f64c, 1)), let_('y', add(get('x'), lit(f64c, 2)),
    let_('c', codeOf(name('add')), let_('r', call_ref(get('c'), [call('self', name('add'), [call('Any', 'from_f64', [get('y')])])]), let_('m', make([['k', get('r')]]),
        match(true_, [
            [['true'], null, br('B', field(get('m'), 'k'))],
            [null, null, repeat('L', [['i', f64, constant('Any', 'undefined')]], trap('t'))],
        ])))))))


export const proof = {
    // Slice 11a: an untyped program, each export of `any` alone, whose
    // operators of `any` call L1, which links into the same module.
    programs: () => {
        assertEq(program('export const f = (a, b) => a + b * 2'), [
            'fn f(p0: any, p1: any) -> any =',
            '    l1.add(p0, l1.multiply(p1, Any.from_f64(2.0)))',
            '',
            'fn l1.add(a: any, b: any) -> any =',
            '    a',
            '',
            'fn l1.multiply(a: any, b: any) -> any =',
            '    a',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const g = a => -a\nexport const f = (a, b) => g(a) / (b - 1) + g(2)'), [
            'fn f(p0: any, p1: any) -> any =',
            '    l1.add(l1.divide(g(p0), l1.subtract(p1, Any.from_f64(1.0))), g(Any.from_f64(2.0)))',
            '',
            'fn g(p0: any) -> any =',
            '    l1.negate(p0)',
            '',
            'fn l1.add(a: any, b: any) -> any =',
            '    a',
            '',
            'fn l1.subtract(a: any, b: any) -> any =',
            '    a',
            '',
            'fn l1.divide(a: any, b: any) -> any =',
            '    a',
            '',
            'fn l1.negate(v: any) -> any =',
            '    v',
            '',
            'export f, g',
            '',
        ].join('\n'))
        assertEq(program('export const f = (a, b) => a < b ? a <= b : a > b === a >= b'), [
            'fn f(p0: any, p1: any) -> any =',
            '    Any.from_bool(if l1.lessThan(p0, p1) then l1.lessThanOrEqual(p0, p1) else if l1.greaterThan(p0, p1) then l1.greaterThanOrEqual(p0, p1) else if l1.greaterThanOrEqual(p0, p1) then false else true)',
            '',
            'fn l1.lessThan(a: any, b: any) -> bool =',
            '    false',
            '',
            'fn l1.lessThanOrEqual(a: any, b: any) -> bool =',
            '    false',
            '',
            'fn l1.greaterThan(a: any, b: any) -> bool =',
            '    false',
            '',
            'fn l1.greaterThanOrEqual(a: any, b: any) -> bool =',
            '    false',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = (a, b) => a !== b || !a'), [
            'fn f(p0: any, p1: any) -> any =',
            '    let #0 = if l1.strictEquals(p0, p1) then false else true',
            '    Any.from_bool(if #0 then #0 else if l1.toBoolean(p0) then false else true)',
            '',
            'fn l1.strictEquals(a: any, b: any) -> bool =',
            '    false',
            '',
            'fn l1.toBoolean(v: any) -> bool =',
            '    l1.strictEquals(v, v)',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = a => typeof a === typeof true'), [
            'const l1.#c0: any =',
            '    Any.undefined',
            '',
            'fn f(p0: any) -> any =',
            '    Any.from_bool(l1.strictEquals(l1.typeOf(p0), l1.typeOf(Any.from_bool(true))))',
            '',
            'fn l1.typeOf(v: any) -> any =',
            '    self.l1.#c0',
            '',
            'fn l1.strictEquals(a: any, b: any) -> bool =',
            '    false',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = a => {\n    if (a) { return 1 }\n    return true\n}'), [
            'fn f(p0: any) -> any =',
            '    if l1.toBoolean(p0) then Any.from_f64(1.0) else Any.from_bool(true)',
            '',
            'fn l1.strictEquals(a: any, b: any) -> bool =',
            '    false',
            '',
            'fn l1.toBoolean(v: any) -> bool =',
            '    l1.strictEquals(v, v)',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = o => o?.a.b'), [
            'fn f(p0: any) -> any =',
            '    match p0',
            '      undefined | null =>',
            '        Any.undefined',
            '      boolean | number | string | bigint | array | object | function as p0.value =>',
            '        l1.get(l1.get(p0.value, "a"), "b")',
            '',
            'fn l1.get(a: any, b: any) -> any =',
            '    a',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = o => o?.[0]'), [
            'fn f(p0: any) -> any =',
            '    match p0',
            '      undefined | null =>',
            '        Any.undefined',
            '      boolean | number | string | bigint | array | object | function as p0.value =>',
            '        l1.get(p0.value, Any.from_f64(0.0))',
            '',
            'fn l1.get(a: any, b: any) -> any =',
            '    a',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = o => \'x\'?.length'), [
            'fn f(p0: any) -> any =',
            '    l1.get("x", "length")',
            '',
            'fn l1.get(a: any, b: any) -> any =',
            '    a',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = o => undefined?.length'), [
            'fn f(p0: any) -> any =',
            '    Any.undefined',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = o => o.f(1).g'), [
            'fn f(p0: any) -> any =',
            '    l1.get(',
            '        let #0 = l1.get(p0, "f")',
            '        l1.call(',
            '            #0,',
            '            match Containers.seal(Containers.push(Containers.begin_array(1), Any.from_f64(1.0)))',
            '              array as args =>',
            '                args',
            '              else =>',
            '                trap(\'not array\')',
            '        ),',
            '        "g"',
            '    )',
            '',
            'fn l1.get(a: any, b: any) -> any =',
            '    a',
            '',
            'fn l1.call(f: any, args: any) -> any =',
            '    f',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = (o, x) => o(x)'), [
            'fn f(p0: any, p1: any) -> any =',
            '    l1.call(',
            '        p0,',
            '        match Containers.seal(Containers.push(Containers.begin_array(1), p1))',
            '          array as args =>',
            '            args',
            '          else =>',
            '            trap(\'not array\')',
            '    )',
            '',
            'fn l1.call(f: any, args: any) -> any =',
            '    f',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('import { asFunction } from \'../l0/module.f.js\'\nexport const f = g => asFunction(g)(1)'), [
            'fn f(p0: any) -> any =',
            '    match p0',
            '      function as p0.function =>',
            '        Functions.call(',
            '            p0.function,',
            '            match Containers.seal(Containers.push(Containers.begin_array(1), Any.from_f64(1.0)))',
            '              array as args =>',
            '                args',
            '              else =>',
            '                trap(\'not array\')',
            '        )',
            '      else =>',
            '        trap(\'not function\')',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = () => 1 < 2'), [
            'fn f() -> any =',
            '    Any.from_bool(lt(1.0, 2.0))',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = () => 1n'), [
            'fn f() -> any =',
            '    1',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(refusedProgram('export const f = () => 1n'), 'f: the body is int(1, 1), not any')
        assertEq(program('export const f = a => ({ a: 1 }).b'), [
            'fn f(p0: any) -> any =',
            '    { a: 1.0 }.b',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(refusedProgram('export const f = a => ({ a: 1 }).b'), 'f: { a: f64c } has no field b')
        assertEq(program('export const f = a => ({ a: 1 }).b ? a : 1'), [
            'fn f(p0: any) -> any =',
            '    if { a: 1.0 }.b then p0 else Any.from_f64(1.0)',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(refusedProgram('export const f = a => ({ a: 1 }).b ? a : 1'), 'f: { a: f64c } has no field b')
        assertEq(program('export const g = a => a\nexport const f = a => g(({ a: 1 }).b)'), [
            'fn f(p0: any) -> any =',
            '    g({ a: 1.0 }.b)',
            '',
            'fn g(p0: any) -> any =',
            '    p0',
            '',
            'export f, g',
            '',
        ].join('\n'))
        assertEq(refusedProgram('export const g = a => a\nexport const f = a => g(({ a: 1 }).b)'), 'f: { a: f64c } has no field b')
        assertEq(program('export const g = a => a\nexport const f = a => g(1n)'), [
            'fn f(p0: any) -> any =',
            '    g(1)',
            '',
            'fn g(p0: any) -> any =',
            '    p0',
            '',
            'export f, g',
            '',
        ].join('\n'))
        assertEq(refusedProgram('export const g = a => a\nexport const f = a => g(1n)'), 'f: g\'s p0 is any, not int(1, 1)')
        assertEq(program('export const g = a => a\nexport const f = a => g(a, 1)'), [
            'fn f(p0: any) -> any =',
            '    g(p0, 1.0)',
            '',
            'fn g(p0: any) -> any =',
            '    p0',
            '',
            'export f, g',
            '',
        ].join('\n'))
        assertEq(refusedProgram('export const g = a => a\nexport const f = a => g(a, 1)'), 'f: g takes one argument, not 2')
        assertEq(assertError(over({}, 'export const f = a => typeof 1n', programRuntime)), 'f: typeof of int(1, 1) is not in this slice')
        assertEq(assertError(over({}, 'export const f = a => 1n + a', programRuntime)), 'f: add of int(1, 1) and any is not in this slice')
        assertEq(assertError(over({}, 'export const f = a => ({ a: 1 }).b + a', programRuntime)), 'f: { a: f64c } has no field b')
        assertEq(assertError(over({}, 'export const f = a => (1n + a) - a', programRuntime)), 'f: add of int(1, 1) and any is not in this slice')
        assertEq(assertError(over({}, 'export const f = o => (1n)?.length', programRuntime)), 'f: ?. of int(1, 1) is not in this slice')
        assertEq(assertError(over({}, 'export const f = o => o?.f?.(1)', programRuntime)), 'f: a guarded or asserted step after ?. is not in this slice')
        assertEq(assertError(over({}, 'export const f = o => o?.f(1n)', programRuntime)), 'f: an argument of a call is a value of any, and argument 0 is int(1, 1)')
        assertEq(assertError(over({}, 'export const f = o => ({ a: 1 }).b?.c', programRuntime)), 'f: { a: f64c } has no field b')
        assertEq(assertError(over({}, 'export const f = o => (1n + o)?.c', programRuntime)), 'f: add of int(1, 1) and any is not in this slice')
        assertEq(assertError(over({}, 'export const f = o => (1n + o)(1)', programRuntime)), 'f: add of int(1, 1) and any is not in this slice')
        assertEq(assertError(over({}, 'export const f = o => o?.f(...o)', programRuntime)), 'f: a spread argument in a program is not in this slice')
        assertEq(assertError(over({}, 'export const f = o => o.f?.(1)', programRuntime)), 'f: a member read with a further step, such as a call of the member, is not in this slice')
        assertEq(assertError(over({}, 'export const k = 1', programRuntime)), 'k: an export that is not a function is not in this slice')
        assertEq(program('export const f = o => o?.a.b(1)'), [
            'fn f(p0: any) -> any =',
            '    match p0',
            '      undefined | null =>',
            '        Any.undefined',
            '      boolean | number | string | bigint | array | object | function as p0.value =>',
            '        let #0 = l1.get(l1.get(p0.value, "a"), "b")',
            '        l1.call(',
            '            #0,',
            '            match Containers.seal(Containers.push(Containers.begin_array(1), Any.from_f64(1.0)))',
            '              array as args =>',
            '                args',
            '              else =>',
            '                trap(\'not array\')',
            '        )',
            '',
            'fn l1.get(a: any, b: any) -> any =',
            '    a',
            '',
            'fn l1.call(f: any, args: any) -> any =',
            '    f',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(assertError(over({}, 'export const f = o => (1n).f(1)', programRuntime)), 'f: .f of int(1, 1) is not in this slice')
        assertEq(program('export const f = o => (1)?.length'), [
            'fn f(p0: any) -> any =',
            '    l1.get(Any.from_f64(1.0), "length")',
            '',
            'fn l1.get(a: any, b: any) -> any =',
            '    a',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = a => (true).length + (1)[0]'), [
            'fn f(p0: any) -> any =',
            '    l1.add(l1.get(Any.from_bool(true), "length"), l1.get(Any.from_f64(1.0), Any.from_f64(0.0)))',
            '',
            'fn l1.add(a: any, b: any) -> any =',
            '    a',
            '',
            'fn l1.get(a: any, b: any) -> any =',
            '    a',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = a => true + 1 > !2 ? -true : 1 === true'), [
            'fn f(p0: any) -> any =',
            '    if l1.greaterThan(l1.add(Any.from_bool(true), Any.from_f64(1.0)), Any.from_bool(if l1.toBoolean(Any.from_f64(2.0)) then false else true)) then l1.negate(Any.from_bool(true)) else Any.from_bool(l1.strictEquals(Any.from_f64(1.0), Any.from_bool(true)))',
            '',
            'fn l1.add(a: any, b: any) -> any =',
            '    a',
            '',
            'fn l1.negate(v: any) -> any =',
            '    v',
            '',
            'fn l1.greaterThan(a: any, b: any) -> bool =',
            '    false',
            '',
            'fn l1.strictEquals(a: any, b: any) -> bool =',
            '    false',
            '',
            'fn l1.toBoolean(v: any) -> bool =',
            '    l1.strictEquals(v, v)',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = a => 1 ? a : 2'), [
            'fn f(p0: any) -> any =',
            '    if l1.toBoolean(Any.from_f64(1.0)) then p0 else Any.from_f64(2.0)',
            '',
            'fn l1.strictEquals(a: any, b: any) -> bool =',
            '    false',
            '',
            'fn l1.toBoolean(v: any) -> bool =',
            '    l1.strictEquals(v, v)',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(assertError(over({}, 'export const f = o => !1n', programRuntime)), 'f: toBoolean of int(1, 1) is not in this slice')
        assertEq(assertError(over({}, 'export const f = o => (1n)[0]', programRuntime)), 'f: a read of int(1, 1) at a number is not in this slice: only an array\'s is')
        assertEq(assertError(over({}, 'export const f = o => (1n).k', programRuntime)), 'f: .k of int(1, 1) is not in this slice')
        assertEq(program('export const f = o => (true)?.k'), [
            'fn f(p0: any) -> any =',
            '    l1.get(Any.from_bool(true), "k")',
            '',
            'fn l1.get(a: any, b: any) -> any =',
            '    a',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = (a, b) => (a ? 1 : 2) > (b ? 3 : 4)'), [
            'fn f(p0: any, p1: any) -> any =',
            '    Any.from_bool(',
            '        let #0 = if l1.toBoolean(p0) then 1.0 else 2.0',
            '        lt(if l1.toBoolean(p1) then 3.0 else 4.0, #0)',
            '    )',
            '',
            'fn l1.strictEquals(a: any, b: any) -> bool =',
            '    false',
            '',
            'fn l1.toBoolean(v: any) -> bool =',
            '    l1.strictEquals(v, v)',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = a => 1 >= (a ? 3 : 4)'), [
            'fn f(p0: any) -> any =',
            '    Any.from_bool(le(if l1.toBoolean(p0) then 3.0 else 4.0, 1.0))',
            '',
            'fn l1.strictEquals(a: any, b: any) -> bool =',
            '    false',
            '',
            'fn l1.toBoolean(v: any) -> bool =',
            '    l1.strictEquals(v, v)',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = (a, b) => -(a ? 1 : 2) === 4 && !(1 < 2) !== true'), [
            'fn f(p0: any, p1: any) -> any =',
            '    let #0 = eq(neg(if l1.toBoolean(p0) then 1.0 else 2.0), 4.0)',
            '    Any.from_bool(',
            '        if #0',
            '        then',
            '            if if lt(1.0, 2.0) then false else true',
            '            then',
            '                if true then false else true',
            '            else',
            '                true',
            '        else',
            '            #0',
            '    )',
            '',
            'fn l1.strictEquals(a: any, b: any) -> bool =',
            '    false',
            '',
            'fn l1.toBoolean(v: any) -> bool =',
            '    l1.strictEquals(v, v)',
            '',
            'export f',
            '',
        ].join('\n'))
        // Outside a program, a float is no receiver of L1's `get`, which L1 itself exports.
        const getAndF = { get: signature(anyTwo, any), f: signature([['a', f64]], any) }
        assertEq(assertError(over(getAndF, 'export const get = (a, b) => a\nexport const f = a => a.k')), 'f: .k of f64 is not in this slice')
        assertEq(assertError(over(getAndF, 'export const get = (a, b) => a\nexport const f = a => a[0]')), "f: a read of f64 at a number is not in this slice: only an array's is")
        // Without L1, `typeof` and `?.` have nothing to call.
        assertEq(assertError(over(only([['v', any]], any), 'export const f = v => typeof v')), 'f: typeof is not in this slice')
        assertEq(assertError(over(only([['v', any]], any), 'export const f = v => v?.a')), 'f: ?. is not in this slice')
    },
    // The originals of slice 11a, which the host proof runs against what the lowering makes of them.
    programOriginals: () => {
        assertEq(sum3P(1, 2, 3), 6)
        assertEq(sum3P('a', 1, 2), 'a12')
        assertEq(mixedP(5, 1), 3)
        assertEq(twiceP(3), 12)
        assertEq(notP(''), true)
        assertEq(oppositeP('2'), -2)
        assertEq(kindP(null), 'object')
        assertEq(differP(1, '1'), true)
        assertEq(orderP(1, 2), -1)
        assertEq(orderP(2, 1), 1)
        assertEq(orderP(1, 1), 0)
        assertEq(Number.isNaN(orderP(NaN, 1)), true)
        assertEq(signP(-3), -1)
        assertEq(signP(0), 0)
        assertEq(signP(3), 1)
        assertEq(eitherP(0, 'b'), 'b')
        assertEq(eitherP('a', 'b'), 'a')
        assertEq(bothP(0, 'b'), 0)
        assertEq(bothP('a', 'b'), 'b')
        assertEq(otherwiseP(null, 'b'), 'b')
        assertEq(otherwiseP(0, 'b'), 0)
        assertEq(sizeP('abc'), 'long')
        assertEq(sizeP([1]), 'short')
        assertEq(firstP(['x']), 'x')
        assertEq(nestedP({ a: { b: 7 } }), 7)
        assertEq(maybeP(undefined), undefined)
        assertEq(maybeP('ab'), 2)
        assertEq(applyP((/** @type {number} */ a, /** @type {number} */ b) => a * b, 3), 6)
        assertEq(methodP({ f: (/** @type {number} */ x) => x + 1 }), 2)
        assertStructurallySame(pairP(1), [1, 2])
        assertStructurallySame(recordP(1, 'b'), { a: 1, b: 'b' })
    },
    // `link` names what it links `l1.`, and keeps what the program reaches.
    link: () => {
        assertEq(assertError(link(standIn)({ imports: [], functions: [], exports: [] })), 'L1 imports Any String BigInt Containers Functions Native, and the program ')
        /** @type {Module} */
        const l1 = { imports: [], functions: [['all', fn([], f64, everyKind(k => k))], ['add', fn([], f64, lit(f64c, 0))], ['other', fn([], f64, lit(f64c, 1))]], exports: [] }
        /** @type {Module['constants']} */
        const own = [['#c0', { type: f64, value: call('self', 'l1.other', []) }]]
        const fns = /** @type {const} */ ([['f', fn([], f64, call('self', 'l1.all', []))], ['g', fn([], f64, call('self', 'f', []))]])
        // L1 without constants, and a program without them, link as with none.
        assertStructurallySame(assertOk(link(l1)({ imports: [], functions: fns, exports: ['f', 'g'] })), {
            imports: [],
            constants: [],
            functions: [...fns, ['l1.all', fn([], f64, everyKind(k => `l1.${k}`))], ['l1.add', fn([], f64, lit(f64c, 0))]],
            exports: ['f', 'g'],
        })
        // What a constant of the program calls links too, and a constant of L1 that nothing reads stays out.
        assertStructurallySame(assertOk(link({ ...l1, constants: [['#c0', { type: f64, value: lit(f64c, 2) }]] })({ imports: [], constants: own, functions: fns, exports: ['f'] })), {
            imports: [],
            constants: own,
            functions: [...fns, ['l1.all', fn([], f64, everyKind(k => `l1.${k}`))], ['l1.add', fn([], f64, lit(f64c, 0))], ['l1.other', fn([], f64, lit(f64c, 1))]],
            exports: ['f'],
        })
    },
}
