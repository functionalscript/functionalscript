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

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { any, array, container, l0 } from '../l0/module.f.js'
import { lifetime } from '../lifetime/module.f.js'
import {
    add, block, bool, br, call, call_ref, cast, codeOf, constant, definedBy, f64, f64c, false_, field, fn, get, let_, lit, loop as repeat, make, match,
    signature, trap, true_, trunc_sat, u,
} from '../module.f.js'
import { native } from '../native/module.f.js'
import { print } from '../print/module.f.js'
import { link } from './link/module.f.js'
import { lower } from './module.f.js'
import {
    apply as applyP, both as bothP, called as calledP, differ as differP, either as eitherP, first as firstP, kind as kindP, maybe as maybeP, method as methodP, mixed as mixedP, nested as nestedP, not as notP, opposite as oppositeP, order as orderP, otherwise as otherwiseP, pair as pairP, record as recordP, sign as signP, size as sizeP, sum3 as sum3P, twice as twiceP,
} from './programs.f.js'
import { runtime, sourceOf } from './testlib.f.js'
import {
    adder as adderC, applied as appliedC, callTwice as callTwiceC, viaCallback as viaCallbackC, given as givenC, constant as constantC, pair as pairC, methods as methodsC, nested as nestedC, usesModule as usesModuleC, local as localC, returned as returnedC, compose as composeC, doubler as doublerC, sameModule as sameModuleC, sameLocal as sameLocalC, listed as listedC,
} from './closures.f.js'
import {
    prepend as prependS, around as aroundS, chars as charsS, spreadCall as spreadCallS, spreadMixed as spreadMixedS, merged as mergedS, copied as copiedS, nestedSpread as nestedSpreadS, restLifted as restLiftedS, restInlined as restInlinedS, restEmpty as restEmptyS, restModule as restModuleS, forwarded as forwardedS, restCaptured as restCapturedS,
} from './spreads.f.js'
import {
    pair as pairR, counted as countedR, both as bothR, nested as nestedR, whole as wholeR, missing as missingR, twice as twiceR, given as givenR, chosen as chosenR, reordered as reorderedR, kept as keptR,
} from './records.f.js'

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
        ...['add', 'subtract', 'multiply', 'divide', 'remainder', 'shiftRight', 'bitwiseAnd', 'get'].map(k => /** @type {const} */ ([k, fn(anyTwo, any, get('a'))])),
        ['negate', fn(anyOne, any, get('v'))],
        ['typeOf', fn(anyOne, any, constant('self', '#c0'))],
        ['number', fn(anyOne, f64, lit(f64c, 0))],
        ['toString', fn(anyOne, any, get('v'))],
        ...['lessThan', 'lessThanOrEqual', 'greaterThan', 'greaterThanOrEqual', 'strictEquals'].map(k => /** @type {const} */ ([k, fn(anyTwo, bool, false_)])),
        ['toBoolean', fn(anyOne, bool, call('self', 'strictEquals', [get('v'), get('v')]))],
        ['call', fn([['f', any], ['args', any]], any, get('f'))],
        ['toIterable', fn(anyOne, array, cast(array, get('v'), 'v.array', x => x))],
        ['objectSpread', fn(anyOne, container, cast(container, get('v'), 'v.container', x => x))],
        ...['charCodeAt', 'at', 'every', 'filter'].map(k => /** @type {const} */ ([k, fn(anyTwo, any, get('a'))])),
        ['requireObjectCoercible', fn(anyOne, any, get('v'))],
        ['unused', fn([], any, constant('Any', 'null'))],
    ],
    exports: [],
}

/** The runtime of a program, which links the stand-in for L1. */
const programRuntime = { ...runtime, l1: standIn }

/**
 * A linked program as the program goldens read it: without Any's defines
 * and `any.*` / `string.*` bodies, and with each linked `any.X` /
 * `string.length` / `string.unit` written as `Any.X` / `String.*` again so
 * the golden still shows the import form. Short-path linking is proved in
 * [`link/proof.f.js`](./link/proof.f.js) and the string IR proofs.
 *
 * @type {(m: Module) => Module}
 */
const withoutLinkedAny = m => {
    /** @type {(name: string) => readonly [string, string] | null} */
    const linked = name => name.startsWith('any.') ? /** @type {const} */ (['Any', name.slice(4)])
        : name.startsWith('string.') ? /** @type {const} */ (['String', name.slice(7)])
        : null
    /** @type {(t: Term) => Term} */
    const rewrite = t => {
        switch (t[0]) {
            case 'let': { return ['let', t[1], rewrite(t[2]), rewrite(t[3])] }
            case 'op': { return t[3] === undefined ? ['op', t[1], t[2].map(rewrite)] : ['op', t[1], t[2].map(rewrite), t[3]] }
            case 'call': {
                const hit = t[1] === 'self' ? linked(t[2]) : null
                return ['call', hit !== null ? hit[0] : t[1], hit !== null ? hit[1] : t[2], t[3].map(rewrite)]
            }
            case 'call_ref': { return ['call_ref', rewrite(t[1]), t[2].map(rewrite)] }
            case 'make': { return ['make', t[1].map(([k, x]) => /** @type {const} */ ([k, rewrite(x)]))] }
            case 'field': { return ['field', rewrite(t[1]), t[2]] }
            case 'variant': { return ['variant', t[1], t[2], rewrite(t[3])] }
            case 'match': { return ['match', rewrite(t[1]), t[2].map(([vs, b, x]) => /** @type {const} */ ([vs, b, rewrite(x)]))] }
            case 'block': { return ['block', t[1], t[2], rewrite(t[3])] }
            case 'loop': { return ['loop', t[1], t[2].map(([k, type, x]) => /** @type {const} */ ([k, type, rewrite(x)])), rewrite(t[3])] }
            case 'br': { return ['br', t[1], rewrite(t[2])] }
            case 'constant': {
                const hit = t[1] === 'self' ? linked(t[2]) : null
                return hit !== null ? ['constant', hit[0], hit[1]] : t
            }
            default: { return t }
        }
    }
    return {
        imports: [],
        constants: (m.constants ?? [])
            .filter(([k]) => linked(k) === null)
            .map(([k, c]) => /** @type {const} */ ([k, { type: c.type, value: rewrite(c.value) }])),
        functions: m.functions
            .filter(([k]) => linked(k) === null)
            .map(([k, f]) => /** @type {const} */ ([k, { ...f, body: rewrite(f.body) }])),
        exports: m.exports,
    }
}

/** The IR of a program's text over an L1 without `get`, where the program exports its own, printed without the interfaces that it imports. @type {(text: string) => string} */
const ownGet = text => print(withoutLinkedAny(assertOk(over({}, text, { ...programRuntime, l1: { ...standIn, functions: standIn.functions.filter(([k]) => k !== 'get') } }))))

/** The IR of a program's text, which no table types, printed without the interfaces that it imports. @type {(text: string) => string} */
const program = text => print(withoutLinkedAny(assertOk(over({}, text, programRuntime))))

/**
 * Why a program is refused: by the inline pass at the end of the lowering,
 * or by the lifetime pass, each of which types the plain stage as the
 * checker does.
 *
 * @type {(text: string) => string}
 */
const refusedProgram = text => {
    const m = over({}, text, programRuntime)
    return m[0] === 'error' ? m[1] : assertError(lifetime(m[1]))
}

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
        // linkAny defines Any, drops its import, and keeps Ref for the hooks;
        // linkString keeps String and adds string.length/unit when reached.
        {
            const m = assertOk(over({}, 'export const f = (a, b) => a + b * 2', programRuntime))
            assertEq(m.imports.map(([k]) => k).join(' '), 'Ref String BigInt Containers Functions Native')
            assert(definedBy(m) === 'Any')
            assert(m.functions.find(([k]) => k === 'any.dup') !== undefined)
            // Any's isRef and its scalar functions are hinted always, so the inline pass writes them where they are called and leaves them out.
            for (const k of ['isRef', 'to_f64', 'from_f64', 'to_bool', 'from_bool', 'same']) { assert(m.functions.find(([j]) => j === `any.${k}`) === undefined) }
            const withLen = assertOk(over({}, 'export const f = a => a.length', programRuntime))
            assert(withLen.functions.find(([k]) => k === 'string.length') !== undefined)
        }
        assertEq(program('export const f = (a, b) => a + b * 2'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            2.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any, p1: any) -> any =',
            '    let #2 =',
            '        match p1',
            '          number as #0 =>',
            '            let #1 = canon(from_bits(unseal(#0)))',
            '            let #i1.x = mul(#1, 2.0)',
            '            seal(any.only(number), to_bits(canon(#i1.x)))',
            '          else =>',
            '            l1.multiply(p1, self.#n0)',
            '    match p0',
            '      number as #3 =>',
            '        let #4 = canon(from_bits(unseal(#3)))',
            '        match #2',
            '          number as #5 =>',
            '            let #6 = canon(from_bits(unseal(#5)))',
            '            let #i4.x = add(#4, #6)',
            '            seal(any.only(number), to_bits(canon(#i4.x)))',
            '          else =>',
            '            l1.add(p0, #2)',
            '      else =>',
            '        l1.add(p0, #2)',
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
        // `Number` and `String` of `any` call L1's `number` and `toString`; of a float and of a string, they are it.
        assertEq(program('export const f = () => Number(2n)'), [
            'fn f() -> any =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            float(2)',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'export f',
            '',
        ].join('\n'))
        // `String` and a template literal of a bigint literal are L1's `toString` of its value.
        assertEq(program('export const f = () => String(1n)'), 'fn f() -> any =\n    l1.toString(Native.stringToBigInt("1"))\n\nfn l1.toString(v: any) -> any =\n    v\n\nexport f\n')
        // A bigint wider than ±2^53 is L1's to convert, which rounds it.
        assertEq(program('export const f = () => Number(9007199254740993n)'), [
            'fn f() -> any =',
            '    let #i0.x = l1.number(Native.stringToBigInt("9007199254740993"))',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn l1.number(v: any) -> f64 =',
            '    0.0',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = (a, b) => [Number(a), Number(1), `x${b}`, String("y")]'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            1.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any, p1: any) -> any =',
            '    let #0 = l1.number(p0)',
            '    let #1 = l1.add(l1.add("x", l1.toString(p1)), "")',
            '    match Containers.seal(Containers.push(Containers.push(Containers.push(Containers.push(Containers.begin_array(4), seal(any.only(number), to_bits(canon(#0)))), self.#n0), #1), "y"))',
            '      array as array =>',
            '        array',
            '      else =>',
            "        trap('not array')",
            '',
            'fn l1.add(a: any, b: any) -> any =',
            '    a',
            '',
            'fn l1.number(v: any) -> f64 =',
            '    0.0',
            '',
            'fn l1.toString(v: any) -> any =',
            '    v',
            '',
            'export f',
            '',
        ].join('\n'))
        // The text of a function that the program makes is refused, since it has none yet, in a template literal and in `String`.
        assertEq(assertError(over({}, 'export const f = () => `${() => 1}`', programRuntime)), 'f: the text of a function that a program makes is not in this slice')
        assertEq(assertError(over({}, 'export const f = () => String(() => 1)', programRuntime)), 'f: the text of a function that a program makes is not in this slice')
        // `a[Number(i)]` of `any` reads an array's item in place, and calls L1's `get` for the other kinds.
        assertEq(program('export const f = (a, i) => a[Number(i)]'), [
            'fn f(p0: any, p1: any) -> any =',
            '    let #0 = l1.number(p1)',
            '    match p0',
            '      array as p0.array =>',
            '        let p0.index = trunc_sat(u(31), #0)',
            '        if eq(float(p0.index), #0)',
            '        then',
            '            if lt(p0.index, Containers.length(p0.array)) then Containers.item(p0.array, p0.index) else Any.undefined',
            '        else',
            '            Any.undefined',
            '      else as p0.other =>',
            '        l1.get(p0.other, seal(any.only(number), to_bits(canon(#0))))',
            '',
            'fn l1.get(a: any, b: any) -> any =',
            '    a',
            '',
            'fn l1.number(v: any) -> f64 =',
            '    0.0',
            '',
            'export f',
            '',
        ].join('\n'))
        // `.length` of `any` reads an array's or a string's length in place, and calls L1's `get` for the other kinds.
        assertEq(program('export const f = a => a.length'), [
            'fn f(p0: any) -> any =',
            '    match p0',
            '      array as p0.array =>',
            '        let #i0.x =',
            '            block #i0.: f64',
            '                float(Containers.length(p0.array))',
            '        seal(any.only(number), to_bits(canon(#i0.x)))',
            '      string as p0.string =>',
            '        let #i1.x =',
            '            block #i1.: f64',
            '                float(String.length(p0.string))',
            '        seal(any.only(number), to_bits(canon(#i1.x)))',
            '      else as p0.other =>',
            '        l1.get(p0.other, "length")',
            '',
            'fn l1.get(a: any, b: any) -> any =',
            '    a',
            '',
            'export f',
            '',
        ].join('\n'))
        // Where `get` is the program's own, not L1's, `.length` and a number-key read are its call for every kind.
        assertEq(ownGet('export const get = (a, k) => a\nexport const f = a => a[0]'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            0.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any) -> any =',
            '    get(p0, self.#n0)',
            '',
            'fn get(p0: any, p1: any) -> any =',
            '    p0',
            '',
            'export f, get',
            '',
        ].join('\n'))
        assertEq(ownGet('export const get = (a, k) => a\nexport const f = a => a.length'), [
            'fn f(p0: any) -> any =',
            '    get(p0, "length")',
            '',
            'fn get(p0: any, p1: any) -> any =',
            '    p0',
            '',
            'export f, get',
            '',
        ].join('\n'))
        // `===` and `!==` of `any` and a float take the number path, `eq` or `ne`; of two values of `any` they call L1 alone.
        assertEq(program('export const f = (a, b) => [a === 1, 2 !== a, a === b]'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            1.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'const #n1: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            2.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any, p1: any) -> any =',
            '    let #0 =',
            '        match p0',
            '          number as #0 =>',
            '            let #1 = canon(from_bits(unseal(#0)))',
            '            eq(#1, 1.0)',
            '          else =>',
            '            l1.strictEquals(p0, self.#n0)',
            '    let #1 =',
            '        match p0',
            '          number as #1 =>',
            '            let #2 = canon(from_bits(unseal(#1)))',
            '            if eq(2.0, #2) then false else true',
            '          else =>',
            '            if l1.strictEquals(self.#n1, p0) then false else true',
            '    let #2 = l1.strictEquals(p0, p1)',
            '    match Containers.seal(Containers.push(Containers.push(Containers.push(Containers.begin_array(3), if #0 then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)), if #1 then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)), if #2 then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)))',
            '      array as array =>',
            '        array',
            '      else =>',
            "        trap('not array')",
            '',
            'fn l1.strictEquals(a: any, b: any) -> bool =',
            '    false',
            '',
            'export f',
            '',
        ].join('\n'))
        // `%`, `>>` and `&` of `any` match each `any` once against `number`, for L1's native rows, and call L1 else; of two floats they call the rows alone.
        assertEq(program('export const f = (a, b) => [a % b, (a >> 1) & b, 7 % 2]'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            1.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any, p1: any) -> any =',
            '    let #0 =',
            '        match p0',
            '          number as #0 =>',
            '            let #1 = canon(from_bits(unseal(#0)))',
            '            match p1',
            '              number as #2 =>',
            '                let #3 = canon(from_bits(unseal(#2)))',
            '                let #i2.x = Native.numberRemainder(#1, #3)',
            '                seal(any.only(number), to_bits(canon(#i2.x)))',
            '              else =>',
            '                l1.remainder(p0, p1)',
            '          else =>',
            '            l1.remainder(p0, p1)',
            '    let #1 =',
            '        let #3 =',
            '            match p0',
            '              number as #1 =>',
            '                let #2 = canon(from_bits(unseal(#1)))',
            '                let #i4.x = Native.numberShiftRight(#2, 1.0)',
            '                seal(any.only(number), to_bits(canon(#i4.x)))',
            '              else =>',
            '                l1.shiftRight(p0, self.#n0)',
            '        match #3',
            '          number as #4 =>',
            '            let #5 = canon(from_bits(unseal(#4)))',
            '            match p1',
            '              number as #6 =>',
            '                let #7 = canon(from_bits(unseal(#6)))',
            '                let #i7.x = Native.numberAnd(#5, #7)',
            '                seal(any.only(number), to_bits(canon(#i7.x)))',
            '              else =>',
            '                l1.bitwiseAnd(#3, p1)',
            '          else =>',
            '            l1.bitwiseAnd(#3, p1)',
            '    let #2 = Native.numberRemainder(7.0, 2.0)',
            '    match Containers.seal(Containers.push(Containers.push(Containers.push(Containers.begin_array(3), #0), #1), seal(any.only(number), to_bits(canon(#2)))))',
            '      array as array =>',
            '        array',
            '      else =>',
            "        trap('not array')",
            '',
            'fn l1.remainder(a: any, b: any) -> any =',
            '    a',
            '',
            'fn l1.shiftRight(a: any, b: any) -> any =',
            '    a',
            '',
            'fn l1.bitwiseAnd(a: any, b: any) -> any =',
            '    a',
            '',
            'export f',
            '',
        ].join('\n'))
        // An operand that binds locals of its own, here in a loop and an arm, is bound after them, as `#1` after `#0`.
        assertEq(program('export const g = x => x\nexport const f = (a, b) => a + g([...b])'), [
            'fn f(p0: any, p1: any) -> any =',
            '    let #1 =',
            '        g(',
            '            let #0 = l1.toIterable(p1)',
            '            let S1.n.float = add(0.0, float(Containers.length(#0)))',
            '            let S1.n = trunc_sat(u(31), S1.n.float)',
            '            if eq(float(S1.n), S1.n.float)',
            '            then',
            '                let S1.b0 = Containers.push_all(Containers.begin_array(S1.n), #0)',
            '                match Containers.seal(S1.b0)',
            '                  array as array =>',
            '                    array',
            '                  else =>',
            "                    trap('not array')",
            '            else',
            "                trap('inexact')",
            '        )',
            '    match p0',
            '      number as #2 =>',
            '        let #3 = canon(from_bits(unseal(#2)))',
            '        match #1',
            '          number as #4 =>',
            '            let #5 = canon(from_bits(unseal(#4)))',
            '            let #i2.x = add(#3, #5)',
            '            seal(any.only(number), to_bits(canon(#i2.x)))',
            '          else =>',
            '            l1.add(p0, #1)',
            '      else =>',
            '        l1.add(p0, #1)',
            '',
            'fn g(p0: any) -> any =',
            '    p0',
            '',
            'fn l1.add(a: any, b: any) -> any =',
            '    a',
            '',
            'fn l1.toIterable(v: any) -> any.only(array) =',
            '    match v',
            '      array as v.array =>',
            '        v.array',
            '      else =>',
            "        trap('not array')",
            '',
            'export f, g',
            '',
        ].join('\n'))
        assertEq(program('export const g = a => -a\nexport const f = (a, b) => g(a) / (b - 1) + g(2)'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            1.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'const #n1: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            2.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any, p1: any) -> any =',
            '    let #8 =',
            '        let #2 = g(p0)',
            '        let #3 =',
            '            match p1',
            '              number as #0 =>',
            '                let #1 = canon(from_bits(unseal(#0)))',
            '                let #i1.x = sub(#1, 1.0)',
            '                seal(any.only(number), to_bits(canon(#i1.x)))',
            '              else =>',
            '                l1.subtract(p1, self.#n0)',
            '        match #2',
            '          number as #4 =>',
            '            let #5 = canon(from_bits(unseal(#4)))',
            '            match #3',
            '              number as #6 =>',
            '                let #7 = canon(from_bits(unseal(#6)))',
            '                let #i4.x = div(#5, #7)',
            '                seal(any.only(number), to_bits(canon(#i4.x)))',
            '              else =>',
            '                l1.divide(#2, #3)',
            '          else =>',
            '            l1.divide(#2, #3)',
            '    let #9 = g(self.#n1)',
            '    match #8',
            '      number as #10 =>',
            '        let #11 = canon(from_bits(unseal(#10)))',
            '        match #9',
            '          number as #12 =>',
            '            let #13 = canon(from_bits(unseal(#12)))',
            '            let #i7.x = add(#11, #13)',
            '            seal(any.only(number), to_bits(canon(#i7.x)))',
            '          else =>',
            '            l1.add(#8, #9)',
            '      else =>',
            '        l1.add(#8, #9)',
            '',
            'fn g(p0: any) -> any =',
            '    match p0',
            '      number as #0 =>',
            '        let #1 = canon(from_bits(unseal(#0)))',
            '        let #i1.x = neg(#1)',
            '        seal(any.only(number), to_bits(canon(#i1.x)))',
            '      else =>',
            '        l1.negate(p0)',
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
            '    let #i10.b =',
            '        if',
            '            match p0',
            '              number as #0 =>',
            '                let #1 = canon(from_bits(unseal(#0)))',
            '                match p1',
            '                  number as #2 =>',
            '                    let #3 = canon(from_bits(unseal(#2)))',
            '                    lt(#1, #3)',
            '                  else =>',
            '                    l1.lessThan(p0, p1)',
            '              else =>',
            '                l1.lessThan(p0, p1)',
            '        then',
            '            match p0',
            '              number as #0 =>',
            '                let #1 = canon(from_bits(unseal(#0)))',
            '                match p1',
            '                  number as #2 =>',
            '                    let #3 = canon(from_bits(unseal(#2)))',
            '                    le(#1, #3)',
            '                  else =>',
            '                    l1.lessThanOrEqual(p0, p1)',
            '              else =>',
            '                l1.lessThanOrEqual(p0, p1)',
            '        else',
            '            if',
            '                match p0',
            '                  number as #0 =>',
            '                    let #1 = canon(from_bits(unseal(#0)))',
            '                    match p1',
            '                      number as #2 =>',
            '                        let #3 = canon(from_bits(unseal(#2)))',
            '                        lt(#3, #1)',
            '                      else =>',
            '                        l1.greaterThan(p0, p1)',
            '                  else =>',
            '                    l1.greaterThan(p0, p1)',
            '            then',
            '                match p0',
            '                  number as #0 =>',
            '                    let #1 = canon(from_bits(unseal(#0)))',
            '                    match p1',
            '                      number as #2 =>',
            '                        let #3 = canon(from_bits(unseal(#2)))',
            '                        le(#3, #1)',
            '                      else =>',
            '                        l1.greaterThanOrEqual(p0, p1)',
            '                  else =>',
            '                    l1.greaterThanOrEqual(p0, p1)',
            '            else',
            '                if',
            '                    match p0',
            '                      number as #0 =>',
            '                        let #1 = canon(from_bits(unseal(#0)))',
            '                        match p1',
            '                          number as #2 =>',
            '                            let #3 = canon(from_bits(unseal(#2)))',
            '                            le(#3, #1)',
            '                          else =>',
            '                            l1.greaterThanOrEqual(p0, p1)',
            '                      else =>',
            '                        l1.greaterThanOrEqual(p0, p1)',
            '                then',
            '                    false',
            '                else',
            '                    true',
            '    if #i10.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)',
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
            '    let #i0.b = if #0 then #0 else if l1.toBoolean(p0) then false else true',
            '    if #i0.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)',
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
            '    let #i1.b =',
            '        l1.strictEquals(',
            '            l1.typeOf(p0),',
            '            l1.typeOf(',
            '                let #i0.b = true',
            '                if #i0.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)',
            '            )',
            '        )',
            '    if #i1.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)',
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
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            1.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any) -> any =',
            '    if l1.toBoolean(p0)',
            '    then',
            '        self.#n0',
            '    else',
            '        let #i0.b = true',
            '        if #i0.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)',
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
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            0.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any) -> any =',
            '    match p0',
            '      undefined | null =>',
            '        Any.undefined',
            '      boolean | number | string | bigint | array | object | function as p0.value =>',
            '        match p0.value',
            '          array as p0.value.array =>',
            '            let p0.value.index = trunc_sat(u(31), 0.0)',
            '            if eq(float(p0.value.index), 0.0)',
            '            then',
            '                if lt(p0.value.index, Containers.length(p0.value.array)) then Containers.item(p0.value.array, p0.value.index) else Any.undefined',
            '            else',
            '                Any.undefined',
            '          else as p0.value.other =>',
            '            l1.get(p0.value.other, self.#n0)',
            '',
            'fn l1.get(a: any, b: any) -> any =',
            '    a',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = o => \'x\'?.length'), [
            'fn f(p0: any) -> any =',
            '    match "x"',
            '      string as length.string =>',
            '        let #i0.x =',
            '            block #i0.: f64',
            '                float(String.length(length.string))',
            '        seal(any.only(number), to_bits(canon(#i0.x)))',
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
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            1.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any) -> any =',
            '    l1.get(',
            '        let #0 = l1.get(p0, "f")',
            '        l1.call(',
            '            #0,',
            '            match Containers.seal(Containers.push(Containers.begin_array(1), self.#n0))',
            '              array as args =>',
            '                args',
            '              else =>',
            "                trap('not array')",
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
        // A callee that holds no function, a boolean or a float, is boxed and called through L1, which throws JavaScript's TypeError.
        assertEq(program('export const f = (a, b) => (a < b)()'), [
            'fn f(p0: any, p1: any) -> any =',
            '    let #0 =',
            '        match p0',
            '          number as #0 =>',
            '            let #1 = canon(from_bits(unseal(#0)))',
            '            match p1',
            '              number as #2 =>',
            '                let #3 = canon(from_bits(unseal(#2)))',
            '                lt(#1, #3)',
            '              else =>',
            '                l1.lessThan(p0, p1)',
            '          else =>',
            '            l1.lessThan(p0, p1)',
            '    l1.call(',
            '        if #0 then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328),',
            '        match Containers.seal(Containers.begin_array(0))',
            '          array as args =>',
            '            args',
            '          else =>',
            "            trap('not array')",
            '    )',
            '',
            'fn l1.lessThan(a: any, b: any) -> bool =',
            '    false',
            '',
            'fn l1.call(f: any, args: any) -> any =',
            '    f',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = () => 1()'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            1.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f() -> any =',
            '    l1.call(',
            '        self.#n0,',
            '        match Containers.seal(Containers.begin_array(0))',
            '          array as args =>',
            '            args',
            '          else =>',
            "            trap('not array')",
            '    )',
            '',
            'fn l1.call(f: any, args: any) -> any =',
            '    f',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(assertError(over({}, 'export const f = a => (1n + 2n)(a)', programRuntime)), 'f: a call of int(3, 3) in a program is not in this slice: only one of any, a float or a boolean is')
        assertEq(program('import { asFunction } from \'../l0/module.f.js\'\nexport const f = g => asFunction(g)(1)'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            1.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any) -> any =',
            '    match p0',
            '      function as p0.function =>',
            '        Functions.call(',
            '            p0.function,',
            '            match Containers.seal(Containers.push(Containers.begin_array(1), self.#n0))',
            '              array as args =>',
            '                args',
            '              else =>',
            "                trap('not array')",
            '        )',
            '      else =>',
            "        trap('not function')",
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = () => 1 < 2'), [
            'fn f() -> any =',
            '    let #i0.b = lt(1.0, 2.0)',
            '    if #i0.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)',
            '',
            'export f',
            '',
        ].join('\n'))
        // A bigint literal in a program is a value of `any` that L1's native row makes of its decimal text, a wide one and a negative one too.
        assertEq(program('export const f = () => 1n'), [
            'fn f() -> any =',
            '    Native.stringToBigInt("1")',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = () => [-18446744073709551616n, -1n]'), [
            'fn f() -> any =',
            '    let #0 = Native.stringToBigInt("-18446744073709551616")',
            '    match Containers.seal(Containers.push(Containers.push(Containers.begin_array(2), #0), Native.stringToBigInt("-1")))',
            '      array as array =>',
            '        array',
            '      else =>',
            "        trap('not array')",
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(refusedProgram('export const f = () => (1n + 2n)'), 'f: the body is int(3, 3), not any')
        // Two equal bigint arms merge as one integer type, and each arm is boxed where it answers.
        assertEq(program('export const f = a => a ? 1n : 1n').split('Native.stringToBigInt("1")').length, 3)
        // A constant that `init` computes is read as itself, so a throw in it is kept.
        assertEq(program('export const g = () => { throw "x" }\nconst k = g()\nexport const f = () => [k]').includes('self.#c0'), true)
        // A constant of a bigint literal is read as the literal, which is boxed, and the negation of a sum stays a subtraction.
        assertEq(program('const k = 1n\nexport const f = () => [k]'), [
            'fn f() -> any =',
            '    match Containers.seal(Containers.push(Containers.begin_array(1), Native.stringToBigInt("1")))',
            '      array as array =>',
            '        array',
            '      else =>',
            "        trap('not array')",
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = () => -(1n + 2n) === -3n'), [
            'fn f() -> any =',
            '    let #i0.b = eq(sub(0, add(1, 2)), -3)',
            '    if #i0.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)',
            '',
            'export f',
            '',
        ].join('\n'))
        // The lowering ends with the inline pass, which types the plain stage, so a program that the checker refuses is refused there.
        assertEq(refusedProgram('export const f = () => -(1n + 2n)'), 'f: the body is int(-3, -3), not any')
        assertEq(refusedProgram('export const f = a => ({ a: 1 }).b'), 'f: { a: f64c } has no field b')
        assertEq(refusedProgram('export const f = a => ({ a: 1 }).b ? a : 1'), 'f: { a: f64c } has no field b')
        assertEq(refusedProgram('export const g = a => a\nexport const f = a => g(({ a: 1 }).b)'), 'f: { a: f64c } has no field b')
        assertEq(program('export const g = a => a\nexport const f = a => g(1n)'), [
            'fn f(p0: any) -> any =',
            '    g(Native.stringToBigInt("1"))',
            '',
            'fn g(p0: any) -> any =',
            '    p0',
            '',
            'export f, g',
            '',
        ].join('\n'))
        assertEq(refusedProgram('export const g = a => a\nexport const f = a => g(1n + 2n)'), 'f: g\'s p0 is any, not int(3, 3)')
        assertEq(refusedProgram('export const g = a => a\nexport const f = a => g(a, 1)'), 'f: g takes one argument, not 2')
        assertEq(assertError(over({}, 'export const f = a => typeof (1n + 2n)', programRuntime)), 'f: typeof of int(3, 3) is not in this slice')
        assertEq(assertError(over({}, 'export const f = a => (1n + 2n) + a', programRuntime)), 'f: add of int(3, 3) and any is not in this slice')
        assertEq(assertError(over({}, 'export const f = a => ({ a: 1 }).b + a', programRuntime)), 'f: { a: f64c } has no field b')
        assertEq(assertError(over({}, 'export const f = a => ((1n + 2n) + a) - a', programRuntime)), 'f: add of int(3, 3) and any is not in this slice')
        assertEq(assertError(over({}, 'export const f = o => (1n + 2n)?.length', programRuntime)), 'f: ?. of int(3, 3) is not in this slice')
        assertEq(assertError(over({}, 'export const f = o => o?.f?.(1)', programRuntime)), 'f: a guarded or asserted step after ?. is not in this slice')
        assertEq(assertError(over({}, 'export const f = o => o?.f(1n + 2n)', programRuntime)), 'f: an argument of a call is a value of any, and argument 0 is int(3, 3)')
        assertEq(assertError(over({}, 'export const f = o => ({ a: 1 }).b?.c', programRuntime)), 'f: { a: f64c } has no field b')
        assertEq(assertError(over({}, 'export const f = o => ((1n + 2n) + o)?.c', programRuntime)), 'f: add of int(3, 3) and any is not in this slice')
        assertEq(assertError(over({}, 'export const f = o => ((1n + 2n) + o)(1)', programRuntime)), 'f: add of int(3, 3) and any is not in this slice')
        assertEq(assertError(over({}, 'export const f = o => o?.f(...(1n + 2n))', programRuntime)), 'f: a spread of int(3, 3) is not in this slice')
        assertEq(assertError(over({}, 'export const f = o => o.f?.(1)', programRuntime)), 'f: a member read with a further step, such as a call of the member, is not in this slice')
        assertEq(assertError(over({}, 'export const k = 1', programRuntime)), 'k: an export that is not a function is not in this slice')
        assertEq(program('export const f = o => o?.a.b(1)'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            1.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any) -> any =',
            '    match p0',
            '      undefined | null =>',
            '        Any.undefined',
            '      boolean | number | string | bigint | array | object | function as p0.value =>',
            '        let #0 = l1.get(l1.get(p0.value, "a"), "b")',
            '        l1.call(',
            '            #0,',
            '            match Containers.seal(Containers.push(Containers.begin_array(1), self.#n0))',
            '              array as args =>',
            '                args',
            '              else =>',
            "                trap('not array')",
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
        assertEq(assertError(over({}, 'export const f = o => (1n + 2n).f(1)', programRuntime)), 'f: .f of int(3, 3) is not in this slice')
        assertEq(program('export const f = o => (1)?.length'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            1.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any) -> any =',
            '    l1.get(self.#n0, "length")',
            '',
            'fn l1.get(a: any, b: any) -> any =',
            '    a',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = a => (true).length + (1)[0]'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            1.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'const #n1: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            0.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any) -> any =',
            '    let #0 =',
            '        l1.get(',
            '            let #i0.b = true',
            '            if #i0.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328),',
            '            "length"',
            '        )',
            '    let #1 = l1.get(self.#n0, self.#n1)',
            '    match #0',
            '      number as #2 =>',
            '        let #3 = canon(from_bits(unseal(#2)))',
            '        match #1',
            '          number as #4 =>',
            '            let #5 = canon(from_bits(unseal(#4)))',
            '            let #i3.x = add(#3, #5)',
            '            seal(any.only(number), to_bits(canon(#i3.x)))',
            '          else =>',
            '            l1.add(#0, #1)',
            '      else =>',
            '        l1.add(#0, #1)',
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
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            1.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'const #n1: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            2.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any) -> any =',
            '    if',
            '        l1.greaterThan(',
            '            l1.add(',
            '                let #i0.b = true',
            '                if #i0.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328),',
            '                self.#n0',
            '            ),',
            '            let #i1.b = if l1.toBoolean(self.#n1) then false else true',
            '            if #i1.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)',
            '        )',
            '    then',
            '        l1.negate(',
            '            let #i2.b = true',
            '            if #i2.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)',
            '        )',
            '    else',
            '        let #i4.b =',
            '            l1.strictEquals(',
            '                self.#n0,',
            '                let #i3.b = true',
            '                if #i3.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)',
            '            )',
            '        if #i4.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)',
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
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            1.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'const #n1: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            2.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any) -> any =',
            '    if l1.toBoolean(self.#n0) then p0 else self.#n1',
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
        assertEq(assertError(over({}, 'export const f = o => !(1n + 2n)', programRuntime)), 'f: toBoolean of int(3, 3) is not in this slice')
        assertEq(assertError(over({}, 'export const f = o => (1n + 2n)[0]', programRuntime)), 'f: a read of int(3, 3) at a number is not in this slice: only an array\'s is')
        assertEq(assertError(over({}, 'export const f = o => (1n + 2n).k', programRuntime)), 'f: .k of int(3, 3) is not in this slice')
        assertEq(program('export const f = o => (true)?.k'), [
            'fn f(p0: any) -> any =',
            '    l1.get(',
            '        let #i0.b = true',
            '        if #i0.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328),',
            '        "k"',
            '    )',
            '',
            'fn l1.get(a: any, b: any) -> any =',
            '    a',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = (a, b) => (a ? 1 : 2) > (b ? 3 : 4)'), [
            'fn f(p0: any, p1: any) -> any =',
            '    let #i0.b =',
            '        let #0 = if l1.toBoolean(p0) then 1.0 else 2.0',
            '        lt(if l1.toBoolean(p1) then 3.0 else 4.0, #0)',
            '    if #i0.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)',
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
            '    let #i0.b = le(if l1.toBoolean(p0) then 3.0 else 4.0, 1.0)',
            '    if #i0.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)',
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
            '    let #i0.b =',
            '        if #0',
            '        then',
            '            if if lt(1.0, 2.0) then false else true',
            '            then',
            '                if true then false else true',
            '            else',
            '                true',
            '        else',
            '            #0',
            '    if #i0.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)',
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
    // A call of a method that L1 has an operation for is that operation of
    // the receiver and the argument.
    methods: () => {
        assertEq(program('export const f = s => s.charCodeAt(0)'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            0.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any) -> any =',
            '    l1.charCodeAt(p0, self.#n0)',
            '',
            'fn l1.charCodeAt(a: any, b: any) -> any =',
            '    a',
            '',
            'export f',
            '',
        ].join('\n'))
        // A receiver that may be `undefined` is checked before an argument that does something.
        assertEq(program('export const f = (s, i) => s.charCodeAt(i >> 3)'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            3.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any, p1: any) -> any =',
            '    let #0 = l1.requireObjectCoercible(p0)',
            '    let #1 =',
            '        match p1',
            '          number as #1 =>',
            '            let #2 = canon(from_bits(unseal(#1)))',
            '            let #i1.x = Native.numberShiftRight(#2, 3.0)',
            '            seal(any.only(number), to_bits(canon(#i1.x)))',
            '          else =>',
            '            l1.shiftRight(p1, self.#n0)',
            '    l1.charCodeAt(#0, #1)',
            '',
            'fn l1.shiftRight(a: any, b: any) -> any =',
            '    a',
            '',
            'fn l1.charCodeAt(a: any, b: any) -> any =',
            '    a',
            '',
            'fn l1.requireObjectCoercible(v: any) -> any =',
            '    v',
            '',
            'export f',
            '',
        ].join('\n'))
        // Neither a binding, an arrow, nor a receiver that is never nullish is checked.
        for (const [text, name] of [['(s, i) => s.at(i)', 'at'], ['a => a.filter(x => x)', 'filter'], ['a => a.every(x => x)', 'every'], ["() => 'ab'.charCodeAt(1 + 1)", 'charCodeAt']]) {
            const t = program(`export const f = ${text}`)
            assertEq(t.includes(`l1.${name}(`), true, text)
            assertEq(t.includes('requireObjectCoercible'), false, text)
        }
        // An arrow callback of `every` or `filter` is inlined into the loop over an array, and L1 is called for the other kinds.
        assertEq(program('export const f = a => a.every((x, i) => i < 1)'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            1.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any) -> any =',
            '    match p0',
            '      array as E0.array =>',
            '        let #i0.b =',
            '            let E0.n = Containers.length(E0.array)',
            '            loop E0 (E0.i: f64 = 0.0)',
            '                if lt(E0.i, float(E0.n))',
            '                then',
            '                    let E0.k = trunc_sat(u(31), E0.i)',
            '                    if eq(float(E0.k), E0.i)',
            '                    then',
            '                        let E0.item = Containers.item(E0.array, E0.k)',
            '                        if lt(E0.i, 1.0) then br E0 { E0.i: add(E0.i, 1.0) } else false',
            '                    else',
            "                        trap('inexact')",
            '                else',
            '                    true',
            '        if #i0.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)',
            '      else as E0.other =>',
            '        let #0 =',
            '            Functions.make_function(',
            '                code(#f1),',
            '                match Containers.seal(Containers.begin_array(0))',
            '                  array as array =>',
            '                    array',
            '                  else =>',
            "                    trap('not array'),",
            '                2,',
            '                Any.undefined',
            '            )',
            '        l1.every(E0.other, #0)',
            '',
            'fn #f1(#self: any.only(function), #args: any.only(array)) -> any =',
            '    let #0 = if lt(0, Containers.length(#args)) then Containers.item(#args, 0) else Any.undefined',
            '    let #1 = if lt(1, Containers.length(#args)) then Containers.item(#args, 1) else Any.undefined',
            '    let #i1.b =',
            '        match #1',
            '          number as #2 =>',
            '            let #3 = canon(from_bits(unseal(#2)))',
            '            lt(#3, 1.0)',
            '          else =>',
            '            l1.lessThan(#1, self.#n0)',
            '    if #i1.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)',
            '',
            'fn l1.lessThan(a: any, b: any) -> bool =',
            '    false',
            '',
            'fn l1.every(a: any, b: any) -> any =',
            '    a',
            '',
            'export f',
            '',
        ].join('\n'))
        const kept = program('export const f = (a, p) => a.filter((x, i, xs) => x < p)')
        assertEq(kept.includes('loop F0 (') && kept.includes('loop F0.kept (') && kept.includes('l1.filter(F0.other, '), true)
        // A receiver that holds an array alone has no other arm; a callback that is refused refuses the call.
        const only = program('export const f = () => [1, 2].every(x => x === 1)')
        assertEq(only.includes('loop E1 (') && !only.includes('l1.every('), true)
        assertEq(assertError(over({}, 'export const f = a => a.every(x => x ** 2)', programRuntime)).includes('**'), true)
        // A receiver that holds no array, or a callback of more than three parameters, calls L1 alone.
        assertEq(program("export const f = () => 'ab'.every(x => x)").includes('loop E'), false)
        assertEq(program('export const f = a => a.every((x, i, xs, y) => y)').includes('loop E'), false)
        assertEq(program('export const f = a => a.every((...xs) => xs)').includes('loop E'), false)
        assertEq(program('export const f = () => (1.5).every(x => x)').includes('loop E'), false)
        assertEq(program('export const f = a => a.at(x => x)').includes('loop E'), false)
        // A callback that answers a record, which no condition reads, is L1's call.
        for (const m of ['every', 'filter']) {
            const text = program(`export const f = a => a.${m}((x, i) => ({ i }))`)
            assertEq(text.includes('loop E') || text.includes('loop F'), false)
            assertEq(text.includes(`l1.${m}(`), true)
        }
        // A throw in `filter`'s callback would leave its mask's builder behind.
        assertEq(assertError(over({}, 'export const f = a => a.filter(x => { throw x })', programRuntime)), "f: a throw inside a callback of buildArray or buildObject is not in this slice: it would leave the builder of F0, which is linear, behind")
        // A receiver of no `any` is read and called as any callee is.
        assertEq(assertError(over({}, 'export const f = () => (1n + 2n).at(0)', programRuntime)), 'f: .at of int(3, 3) is not in this slice')
        assertEq(program('export const f = () => ({ at: 1 }).at(0)').includes('l1.call(\n        self.#n0,'), true)
        // A float receiver is boxed, and is never nullish.
        assertEq(program('export const f = () => (1.5).at(0)').includes('l1.at(self.#n0, self.#n1)'), true)
        // A missing field of a record fails, as the receiver or as the argument.
        assertEq(assertError(over({}, 'export const f = () => ({ a: 1 }).b.at(0)', programRuntime)), 'f: { a: f64c } has no field b')
        assertEq(assertError(over({}, 'export const f = s => s.at(({ a: 1 }).b)', programRuntime)), 'f: { a: f64c } has no field b')
        assertEq(assertError(over({}, 'export const f = s => s.charCodeAt()', programRuntime)), 'f: a call of the method charCodeAt with other than one argument is not in this slice')
        assertEq(assertError(over({}, 'export const f = s => s.at(...s)', programRuntime)), 'f: a call of the method at with other than one argument is not in this slice')
        assertEq(assertError(over({}, 'export const f = s => s.at(1n + 2n)', programRuntime)), 'f: the argument of the method at is int(3, 3)')
        assertEq(assertError(over({}, 'export const f = s => s.at(2n ** 2n)', programRuntime)), 'f: ** is not in this slice')
        assertEq(assertError(over({}, 'export const f = () => (2n ** 2n).at(0)', programRuntime)), 'f: ** is not in this slice')
    },
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
    // A boolean is no function: JavaScript throws a TypeError, as L1's `call` does.
    calledOriginal: { throw: () => calledP(1, 2) },
    // `link` names what it links `l1.`, and keeps what the program reaches.
    // Slice 11b: a function that a program makes as a value is `make_function` of its lifted code, `(#self, #args) -> any`,
    // whose frame holds its captures that read values of the function around it, each boxed, and whose parameters are
    // the items of `#args`, `undefined` past its length. A capture of the module stands for what it does in the module.
    closures: () => {
        assertEq(program('export const f = a => b => a'), [
            'fn f(p0: any) -> any =',
            '    Functions.make_function(',
            '        code(#f1),',
            '        match Containers.seal(Containers.push(Containers.begin_array(1), p0))',
            '          array as array =>',
            '            array',
            '          else =>',
            '            trap(\'not array\'),',
            '        1,',
            '        Any.undefined',
            '    )',
            '',
            'fn #f1(#self: any.only(function), #args: any.only(array)) -> any =',
            '    let #0 = Functions.frame(#self, 0)',
            '    let #1 = if lt(0, Containers.length(#args)) then Containers.item(#args, 0) else Any.undefined',
            '    #0',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('const k = 3\nexport const f = a => () => () => [a, k]'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            3.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any) -> any =',
            '    Functions.make_function(',
            '        code(#f1),',
            '        match Containers.seal(Containers.push(Containers.begin_array(1), p0))',
            '          array as array =>',
            '            array',
            '          else =>',
            "            trap('not array'),",
            '        0,',
            '        Any.undefined',
            '    )',
            '',
            'fn #f1(#self: any.only(function), #args: any.only(array)) -> any =',
            '    let #0 = Functions.frame(#self, 0)',
            '    Functions.make_function(',
            '        code(#f2),',
            '        match Containers.seal(Containers.push(Containers.begin_array(1), #0))',
            '          array as array =>',
            '            array',
            '          else =>',
            "            trap('not array'),",
            '        0,',
            '        Any.undefined',
            '    )',
            '',
            'fn #f2(#self: any.only(function), #args: any.only(array)) -> any =',
            '    let #0 = Functions.frame(#self, 0)',
            '    match Containers.seal(Containers.push(Containers.push(Containers.begin_array(2), #0), self.#n0))',
            '      array as array =>',
            '        array',
            '      else =>',
            "        trap('not array')",
            '',
            'export f',
            '',
        ].join('\n'))
        // A capture of a capture of the module's function stands for that function, so the frame holds nothing.
        assertEq(program('const double = x => x * 2\nexport const f = a => b => double(b)'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            2.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any) -> any =',
            '    Functions.make_function(',
            '        code(#f2),',
            '        match Containers.seal(Containers.begin_array(0))',
            '          array as array =>',
            '            array',
            '          else =>',
            "            trap('not array'),",
            '        1,',
            '        Any.undefined',
            '    )',
            '',
            'fn #f2(#self: any.only(function), #args: any.only(array)) -> any =',
            '    let #0 = if lt(0, Containers.length(#args)) then Containers.item(#args, 0) else Any.undefined',
            '    match #0',
            '      number as #1 =>',
            '        let #2 = canon(from_bits(unseal(#1)))',
            '        let #i1.x = mul(#2, 2.0)',
            '        seal(any.only(number), to_bits(canon(#i1.x)))',
            '      else =>',
            '        l1.multiply(#0, self.#n0)',
            '',
            'fn l1.multiply(a: any, b: any) -> any =',
            '    a',
            '',
            'export f',
            '',
        ].join('\n'))
        // A function read as a value is one value at each read, as JavaScript's `===` tells: a function of the module that it
        // does not export is a constant that `init` makes, and one that a function defines is made where it is defined.
        assertEq(program('const g = () => 0\nexport const f = () => g === g'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            0.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'const #v0: any.only(function) =',
            '    Functions.make_function(',
            '        code(#f0),',
            '        match Containers.seal(Containers.begin_array(0))',
            '          array as array =>',
            '            array',
            '          else =>',
            "            trap('not array'),",
            '        0,',
            '        Any.undefined',
            '    )',
            '',
            'fn f() -> any =',
            '    let #i0.b = l1.strictEquals(self.#v0, self.#v0)',
            '    if #i0.b then seal(any.only(boolean), 18442240474082181136) else seal(any.only(boolean), 9218868437227405328)',
            '',
            'fn #f0(#self: any.only(function), #args: any.only(array)) -> any =',
            '    self.#n0',
            '',
            'fn l1.strictEquals(a: any, b: any) -> bool =',
            '    false',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = a => {\n    const g = x => x + a\n    return [g, g]\n}'), [
            'fn f(p0: any) -> any =',
            '    let #0 =',
            '        Functions.make_function(',
            '            code(#f1),',
            '            match Containers.seal(Containers.push(Containers.begin_array(1), p0))',
            '              array as array =>',
            '                array',
            '              else =>',
            "                trap('not array'),",
            '            1,',
            '            Any.undefined',
            '        )',
            '    match Containers.seal(Containers.push(Containers.push(Containers.begin_array(2), #0), #0))',
            '      array as array =>',
            '        array',
            '      else =>',
            "        trap('not array')",
            '',
            'fn #f1(#self: any.only(function), #args: any.only(array)) -> any =',
            '    let #0 = Functions.frame(#self, 0)',
            '    let #1 = if lt(0, Containers.length(#args)) then Containers.item(#args, 0) else Any.undefined',
            '    match #1',
            '      number as #2 =>',
            '        let #3 = canon(from_bits(unseal(#2)))',
            '        match #0',
            '          number as #4 =>',
            '            let #5 = canon(from_bits(unseal(#4)))',
            '            let #i2.x = add(#3, #5)',
            '            seal(any.only(number), to_bits(canon(#i2.x)))',
            '          else =>',
            '            l1.add(#1, #0)',
            '      else =>',
            '        l1.add(#1, #0)',
            '',
            'fn l1.add(a: any, b: any) -> any =',
            '    a',
            '',
            'export f',
            '',
        ].join('\n'))
        // A capture of a constant of the module reads the constant, once `init` makes it.
        assertEq(program('const a = [1]\nexport const f = () => () => a'), [
            'const #c0: any.only(array) =',
            '    match',
            '        Containers.seal(',
            '            Containers.push(',
            '                Containers.begin_array(1),',
            '                let #i0.x =',
            '                    block #i0.: f64',
            '                        1.0',
            '                seal(any.only(number), to_bits(canon(#i0.x)))',
            '            )',
            '        )',
            '      array as array =>',
            '        array',
            '      else =>',
            "        trap('not array')",
            '',
            'fn f() -> any =',
            '    Functions.make_function(',
            '        code(#f1),',
            '        match Containers.seal(Containers.begin_array(0))',
            '          array as array =>',
            '            array',
            '          else =>',
            "            trap('not array'),",
            '        0,',
            '        Any.undefined',
            '    )',
            '',
            'fn #f1(#self: any.only(function), #args: any.only(array)) -> any =',
            '    self.#c0',
            '',
            'export f',
            '',
        ].join('\n'))
        // A function that only a call reads stays inlined.
        assertEq(program('export const f = a => {\n    const g = x => x\n    return g(a)\n}'), 'fn f(p0: any) -> any =\n    p0\n\nexport f\n')
        // A function of the module that calls itself, not last, and that it does not export is a function of the IR, of
        // `any` alone, which the export calls and no export names.
        assertEq(program('const g = x => x ? [g(x.a)] : x\nexport const f = a => g(a)'), [
            'fn f(p0: any) -> any =',
            '    #h0(p0)',
            '',
            'fn #h0(p0: any) -> any =',
            '    if l1.toBoolean(p0)',
            '    then',
            '        let #0 = #h0(l1.get(p0, "a"))',
            '        match Containers.seal(Containers.push(Containers.begin_array(1), #0))',
            '          array as array =>',
            '            array',
            '          else =>',
            "            trap('not array')",
            '    else',
            '        p0',
            '',
            'fn l1.get(a: any, b: any) -> any =',
            '    a',
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
        // A function of the module that calls itself and that nothing calls is not lowered, so what it holds is not refused.
        assertEq(program('const dead = x => x >>> x + dead(x)\nexport const f = x => x'), 'fn f(p0: any) -> any =\n    p0\n\nexport f\n')
        // One that something calls is lowered, and what it holds may be refused, by its name.
        assertEq(assertError(over({}, 'const g = x => x >>> 1 + g(x)\nexport const f = x => g(x)', programRuntime)), '#h0: >>> is not in this slice')
        // A function that calls itself, not in a loop, is refused.
        assertEq(assertError(over({}, 'export const f = a => {\n    const g = x => 1 + g(x)\n    return g\n}', programRuntime)), 'f: a function that calls itself is not in this slice')
        assertEq(assertError(over({}, 'export const f = n => { const a = x => x ? n : b; const b = x => x ? a : n; return a; }', programRuntime)),
            'f: a function group as a value is not in this slice')
        // A capture of a function that calls itself, a refusal in the lifted code, which names the code, and a capture of an
        // import that the module refuses.
        assertEq(assertError(over({}, 'export const f = a => {\n    const g = x => 1 + g(x)\n    return () => g\n}', programRuntime)), 'f: a function that calls itself is not in this slice')
        assertEq(assertError(over({}, 'export const f = a => b => b >>> a', programRuntime)), '#f1: >>> is not in this slice')
        assertEq(assertError(over({}, 'export const f = a => {\n    const g = x => x\n    return g >>> g\n}', programRuntime)), 'f: >>> is not in this slice')
        assertEq(assertError(over({}, "import { x } from './y.f.js'\nexport const f = a => b => x", programRuntime)), 'f: an import of ./y.f.js is not in this slice')
        assertEq(assertError(over({}, "import { x } from './y.f.js'\nconst g = () => x\nexport const f = () => g", programRuntime)), '#f0: an import of ./y.f.js is not in this slice')
        // An export as a value is refused: its signature is not the code of a function value.
        assertEq(assertError(over({}, 'export const g = a => a\nexport const f = a => g', programRuntime)), 'f: a function as a value is not in this slice')
    },
    // Slice 11c: a spread in an array, an object or the arguments of a call is
    // what L1's `toIterable` or `objectSpread` makes of it: an array's items pushed by one
    // `push_all`, an object's properties pushed one by one;
    // a rest parameter is an array of the arguments past the others.
    spreads: () => {
        assertEq(program('export const f = a => [1, ...a]'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            1.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any) -> any =',
            '    let #0 = l1.toIterable(p0)',
            '    let S1.n.float = add(1.0, float(Containers.length(#0)))',
            '    let S1.n = trunc_sat(u(31), S1.n.float)',
            '    if eq(float(S1.n), S1.n.float)',
            '    then',
            '        let S1.b0 = Containers.push(Containers.begin_array(S1.n), self.#n0)',
            '        let S1.b1 = Containers.push_all(S1.b0, #0)',
            '        match Containers.seal(S1.b1)',
            '          array as array =>',
            '            array',
            '          else =>',
            "            trap('not array')",
            '    else',
            "        trap('inexact')",
            '',
            'fn l1.toIterable(v: any) -> any.only(array) =',
            '    match v',
            '      array as v.array =>',
            '        v.array',
            '      else =>',
            "        trap('not array')",
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = (g, a) => g(...a, 2)'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            2.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any, p1: any) -> any =',
            '    l1.call(',
            '        p0,',
            '        let #0 = l1.toIterable(p1)',
            '        let S1.n.float = add(1.0, float(Containers.length(#0)))',
            '        let S1.n = trunc_sat(u(31), S1.n.float)',
            '        if eq(float(S1.n), S1.n.float)',
            '        then',
            '            let S1.b0 = Containers.push_all(Containers.begin_array(S1.n), #0)',
            '            let S1.b1 = Containers.push(S1.b0, self.#n0)',
            '            match Containers.seal(S1.b1)',
            '              array as array =>',
            '                array',
            '              else =>',
            "                trap('not array')",
            '        else',
            "            trap('inexact')",
            '    )',
            '',
            'fn l1.call(f: any, args: any) -> any =',
            '    f',
            '',
            'fn l1.toIterable(v: any) -> any.only(array) =',
            '    match v',
            '      array as v.array =>',
            '        v.array',
            '      else =>',
            "        trap('not array')",
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = o => ({ a: 1, ...o })'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            1.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any) -> any =',
            '    let #0 =',
            '        match l1.objectSpread(p0)',
            '          object as object =>',
            '            object',
            '          else =>',
            "            trap('not object')",
            '    let S1.n.float = add(1.0, float(Containers.length(#0)))',
            '    let S1.n = trunc_sat(u(31), S1.n.float)',
            '    if eq(float(S1.n), S1.n.float)',
            '    then',
            '        let S1.b0 = Containers.push_property(Containers.begin_object(S1.n), "a", self.#n0)',
            '        let S1.b1 =',
            '            loop S1.1 (S1.1.b: builder = S1.b0, S1.1.i: f64 = 0.0)',
            '                if lt(S1.1.i, float(Containers.length(#0)))',
            '                then',
            '                    let S1.1.k = trunc_sat(u(31), S1.1.i)',
            '                    if eq(float(S1.1.k), S1.1.i)',
            '                    then',
            '                        let S1.1.pushed = Containers.push_property(S1.1.b, Containers.key(#0, S1.1.k), Containers.item(#0, S1.1.k))',
            '                        br S1.1 { S1.1.b: S1.1.pushed, S1.1.i: add(S1.1.i, 1.0) }',
            '                    else',
            "                        trap('inexact')",
            '                else',
            '                    S1.1.b',
            '        match Containers.seal(S1.b1)',
            '          object as object =>',
            '            object',
            '          else =>',
            "            trap('not object')",
            '    else',
            "        trap('inexact')",
            '',
            'fn l1.objectSpread(v: any) -> any.only(array, object) =',
            '    match v',
            '      array | object as v.container =>',
            '        v.container',
            '      else =>',
            "        trap('not array or object')",
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('export const f = a => (x, ...r) => [x, r]'), [
            'fn f(p0: any) -> any =',
            '    Functions.make_function(',
            '        code(#f1),',
            '        match Containers.seal(Containers.begin_array(0))',
            '          array as array =>',
            '            array',
            '          else =>',
            '            trap(\'not array\'),',
            '        1,',
            '        Any.undefined',
            '    )',
            '',
            'fn #f1(#self: any.only(function), #args: any.only(array)) -> any =',
            '    let #0 = if lt(0, Containers.length(#args)) then Containers.item(#args, 0) else Any.undefined',
            '    let #1 =',
            '        let R.n.float = if lt(1.0, float(Containers.length(#args))) then sub(float(Containers.length(#args)), 1.0) else 0.0',
            '        let R.n = trunc_sat(u(31), R.n.float)',
            '        if eq(float(R.n), R.n.float)',
            '        then',
            '            loop R (R.b: builder = Containers.begin_array(R.n), R.i: f64 = 0.0)',
            '                if lt(R.i, float(R.n))',
            '                then',
            '                    let R.k.float = add(R.i, 1.0)',
            '                    let R.k = trunc_sat(u(31), R.k.float)',
            '                    if eq(float(R.k), R.k.float)',
            '                    then',
            '                        let R.pushed = Containers.push(R.b, Containers.item(#args, R.k))',
            '                        br R { R.b: R.pushed, R.i: add(R.i, 1.0) }',
            '                    else',
            '                        trap(\'inexact\')',
            '                else',
            '                    match Containers.seal(R.b)',
            '                      array as array =>',
            '                        array',
            '                      else =>',
            '                        trap(\'not array\')',
            '        else',
            '            trap(\'inexact\')',
            '    match Containers.seal(Containers.push(Containers.push(Containers.begin_array(2), #0), #1))',
            '      array as array =>',
            '        array',
            '      else =>',
            '        trap(\'not array\')',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program('const g = (a, ...r) => [a, r]\nexport const h = x => g(x, 1, 2)'), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            1.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'const #n1: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            2.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn h(p0: any) -> any =',
            '    let #0 =',
            '        match Containers.seal(Containers.push(Containers.push(Containers.begin_array(2), self.#n0), self.#n1))',
            '          array as array =>',
            '            array',
            '          else =>',
            "            trap('not array')",
            '    match Containers.seal(Containers.push(Containers.push(Containers.begin_array(2), p0), #0))',
            '      array as array =>',
            '        array',
            '      else =>',
            "        trap('not array')",
            '',
            'export h',
            '',
        ].join('\n'))
        // What a spread or a rest parameter of this slice refuses: a spread of what
        // is no value of any, a computed key, a spread into a function that is
        // inlined, too few arguments for one with a rest parameter, and an export
        // with one, whose signature has no rest.
        assertEq(assertError(over({}, 'export const f = a => [...(1n + 2n)]', programRuntime)), 'f: a spread of int(3, 3) is not in this slice')
        assertEq(assertError(over({}, 'export const f = a => [(1n + 2n), ...a]', programRuntime)), 'f: an item of an array is a value of any, and part 0 is int(3, 3)')
        assertEq(assertError(over({}, 'export const f = a => ({ ...a, b: (1n + 2n) })', programRuntime)), 'f: a value of an object is a value of any, and part 1 is int(3, 3)')
        assertEq(assertError(over({}, 'export const f = o => ({ [o]: 1, ...o })', programRuntime)), 'f: an entry of an object that is not a name and its value is not in this slice')
        assertEq(assertError(over({}, 'export const f = a => (1n + 2n)(...a)', programRuntime)), 'f: a call of int(3, 3) in a program is not in this slice: only one of any, a float or a boolean is')
        assertEq(assertError(over({}, 'const g = x => x\nexport const f = a => g(...a)', programRuntime)), 'f: a spread argument is not in this slice')
        assertEq(assertError(over({}, 'const g = (x, ...r) => r\nexport const f = () => g()', programRuntime)), 'f: a function that is inlined takes at least one argument, and its call gives 0')
        assertEq(assertError(over({}, 'const g = (...r) => r\nexport const f = () => g(1n + 2n)', programRuntime)), 'f: an item of a rest parameter is a value of any, and item 0 is int(3, 3)')
        assertEq(assertError(over({}, 'export const f = (...r) => r', programRuntime)), 'f: a rest parameter is not in this slice')
        // A pure term that does not type-check, as a spread, an item beside one, a rest item and a callee, and a callee that
        // does not lower; and a program whose L1 has no toIterable.
        assertEq(assertError(over({}, 'export const f = a => [...({ a: 1 }).b]', programRuntime)), 'f: { a: f64c } has no field b')
        assertEq(assertError(over({}, 'export const f = a => [({ a: 1 }).b, ...a]', programRuntime)), 'f: { a: f64c } has no field b')
        assertEq(assertError(over({}, 'const g = (...r) => r\nexport const f = () => g(({ a: 1 }).b)', programRuntime)), 'f: { a: f64c } has no field b')
        assertEq(assertError(over({}, 'export const f = a => (({ a: 1 }).b)(...a)', programRuntime)), 'f: { a: f64c } has no field b')
        assertEq(assertError(over({}, 'export const f = a => (1n + 2n).f(...a)', programRuntime)), 'f: .f of int(3, 3) is not in this slice')
        const noIterable = { ...programRuntime, l1: { ...standIn, functions: standIn.functions.filter(([k]) => k !== 'toIterable') } }
        assertEq(assertError(over({}, 'export const f = a => [...a]', noIterable)), "f: a spread uses L1's toIterable, which the program does not link")
    },
    // The originals of slice 11b, which the host proof runs against what the lowering makes of them.
    closureOriginals: () => {
        assertEq(adderC(1)(2), 3)
        assertEq(appliedC(1), 2)
        assertEq(callTwiceC(/** @type {(x: any) => any} */ (x => x + 1)), 3)
        assertEq(viaCallbackC(2), 5)
        assertStructurallySame(givenC(/** @type {(g: any, x: any) => any} */ ((g, x) => g(x))), [1, 3])
        assertEq(constantC()(), 42)
        const [a, b] = pairC(1, 2)
        assertEq(a() + b(), 3)
        const o = methodsC(1)
        assertEq(o.get() + o.add(2), 4)
        assertEq(nestedC(1)(2)(3), 6)
        assertEq(usesModuleC(1)(2), 15)
        assertEq(localC(1)(1), 3)
        assertEq(returnedC(1)(1), 2)
        assertEq(composeC(/** @type {(x: any) => any} */ (x => x * 3))(1), 9)
        assertEq(doublerC()(4), 8)
        assertEq(sameModuleC(), true)
        assertStructurallySame(sameLocalC(1), [true, 2])
        assertStructurallySame(listedC()(), [1, 2])
    },
    // The originals of slice 11c, which the host proof runs against what the lowering makes of them.
    // The records pass: a loop's state that is only read back by its keys is
    // a local for each key, and an object that leaves, or is read by a key
    // that it has not, stays one.
    records: () => {
        assertEq(program([
            'export const f = (a, b) => {',
            '    let s = { i: a, acc: b }',
            '    while (s.i < 3) {',
            '        s = { i: s.i + 1, acc: s.acc + s.i }',
            '    }',
            '    return s.acc',
            '}',
        ].join('\n')), [
            'const #n0: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            3.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'const #n1: any.only(number) =',
            '    let #i0.x =',
            '        block #i0.: f64',
            '            1.0',
            '    seal(any.only(number), to_bits(canon(#i0.x)))',
            '',
            'fn f(p0: any, p1: any) -> any =',
            '    let #1.i = p0',
            '    let #1.acc = p1',
            '    loop L0 (#2.i: any = #1.i, #2.acc: any = #1.acc)',
            '        if',
            '            match #2.i',
            '              number as #4 =>',
            '                let #5 = canon(from_bits(unseal(#4)))',
            '                lt(#5, 3.0)',
            '              else =>',
            '                l1.lessThan(#2.i, self.#n0)',
            '        then',
            '            let #2/#3 =',
            '                match #2.i',
            '                  number as #4 =>',
            '                    let #5 = canon(from_bits(unseal(#4)))',
            '                    let #i2.x = add(#5, 1.0)',
            '                    seal(any.only(number), to_bits(canon(#i2.x)))',
            '                  else =>',
            '                    l1.add(#2.i, self.#n1)',
            '            let #2/#4 =',
            '                match #2.acc',
            '                  number as #6 =>',
            '                    let #7 = canon(from_bits(unseal(#6)))',
            '                    match #2.i',
            '                      number as #8 =>',
            '                        let #9 = canon(from_bits(unseal(#8)))',
            '                        let #i5.x = add(#7, #9)',
            '                        seal(any.only(number), to_bits(canon(#i5.x)))',
            '                      else =>',
            '                        l1.add(#2.acc, #2.i)',
            '                  else =>',
            '                    l1.add(#2.acc, #2.i)',
            '            br L0 { #2.i: #2/#3, #2.acc: #2/#4 }',
            '        else',
            '            #2.acc',
            '',
            'fn l1.add(a: any, b: any) -> any =',
            '    a',
            '',
            'fn l1.get(a: any, b: any) -> any =',
            '    a',
            '',
            'fn l1.lessThan(a: any, b: any) -> bool =',
            '    false',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(program([
            'export const f = (a, b) => {',
            '    const r = { x: a, y: b }',
            '    return r.x === r.y ? r : r.z',
            '}',
        ].join('\n')), [
            'fn f(p0: any, p1: any) -> any =',
            '    let #0 =',
            '        match Containers.seal(Containers.push_property(Containers.push_property(Containers.begin_object(2), "x", p0), "y", p1))',
            '          object as object =>',
            '            object',
            '          else =>',
            "            trap('not object')",
            '    if l1.strictEquals(l1.get(#0, "x"), l1.get(#0, "y")) then #0 else l1.get(#0, "z")',
            '',
            'fn l1.get(a: any, b: any) -> any =',
            '    a',
            '',
            'fn l1.strictEquals(a: any, b: any) -> bool =',
            '    false',
            '',
            'export f',
            '',
        ].join('\n'))
    },
    recordOriginals: () => {
        assertEq(pairR(1, 2), 2)
        assertEq(countedR(10), 6)
        assertEq(countedR(2), 1)
        assertEq(bothR(0, 'x'), 2)
        assertEq(bothR(5, 'x'), 'x')
        assertEq(nestedR(1, 2), 1)
        assertStructurallySame(wholeR(1, 2), { x: 1, y: 2 })
        assertEq(missingR(1), undefined)
        const [r, q] = twiceR(1, 2)
        assertEq(r, q)
        assertEq(givenR(/** @type {(o: any) => any} */ (o => o.x), 3), 3)
        assertEq(chosenR(true, 1, 2), 1)
        assertEq(chosenR(0, 1, 2), 2)
        assertEq(reorderedR(10), 6)
        assertEq(keptR(10), 3)
    },
    spreadOriginals: () => {
        /** @type {(...xs: readonly any[]) => any} */
        const list = (...xs) => xs
        assertStructurallySame(prependS([1, 2]), [0, 1, 2])
        assertStructurallySame(aroundS([0], 'ab'), [0, 1, 'a', 'b'])
        assertStructurallySame(charsS('a\ud83d\ude00'), ['a', '\ud83d\ude00'])
        assertStructurallySame(spreadCallS(list, [1, 2]), [1, 2])
        assertStructurallySame(spreadMixedS(list, 'x'), [1, 'x', 2])
        assertStructurallySame(mergedS({ a: 1, k: 0 }, { k: 2 }), { a: 1, k: 2 })
        assertStructurallySame(copiedS('ab'), { 0: 'a', 1: 'b' })
        assertStructurallySame(nestedSpreadS([1]), [1, 1])
        assertStructurallySame(restLiftedS()(1, 2, 3), [1, [2, 3]])
        assertEq(restLiftedS().length, 1)
        assertStructurallySame(restInlinedS(1), [1, [1, 3]])
        assertStructurallySame(restEmptyS(), [])
        assertStructurallySame(restModuleS(0), [1, 2])
        assertStructurallySame(forwardedS(list)(1, 2), [1, 2])
        assertStructurallySame(restCapturedS(1), [1, 1, 2])
    },
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
    // A program reads a reference's kind from its bits; `checkedKind`, for a debug build, links the Any whose `kind` asks L0's checked `kind_ref`.
    checkedKind: () => {
        /** @type {(r: Parameters<typeof lower>[1]) => string} */
        const kindOf = r => {
            const m = assertOk(over({}, 'export const f = v => typeof v', r))
            const found = m.functions.find(([k]) => k === 'any.kind')
            assert(found !== undefined)
            return print({ imports: [], functions: [found], exports: [] })
        }
        assert(!kindOf(programRuntime).includes('Ref.kind_ref('))
        assert(kindOf({ ...programRuntime, checkedKind: true }).includes('Ref.kind_ref('))
        assert(!kindOf({ ...programRuntime, checkedKind: false }).includes('Ref.kind_ref('))
    },
}
