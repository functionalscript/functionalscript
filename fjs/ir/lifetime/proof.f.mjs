/**
 * Proofs of the lifetime pass: plain IR, the owned stage that the pass
 * writes for it, as text, which the checker takes, and a refusal for each
 * value of a linear type that the pass would have to copy or drop.
 *
 * @import { Interface, Module, Param, Sealed, Term, Type } from '../types.ts'
 */

import { assertEq, assertError, assertOk } from '../../asserts/module.f.js'
import { check } from '../check/module.f.js'
import { any, l0 } from '../l0/module.f.js'
import {
    add, block, bool, br, call, f64, field, float, fn, get, if_, int, let_, lit, loop, lt, make, match, next, only, own, return_, sealed,
    signature, trap, true_, trunc_sat, u, unit, variant,
} from '../module.f.js'
import { print } from '../print/module.f.js'
import { lifetime } from './module.f.js'

const string = only(any, 'string')

/** @type {Sealed} */
const res = sealed('Lin', 'res')

/** A linear type, which nothing copies or drops: `open` makes a value of it, `peek` borrows one and `close` owns one. @type {readonly [string, Interface]} */
const linear = ['Lin', {
    abi: 'test:lin',
    types: [['res', { variants: ['res'], kind: 'kind', carrier: 'i64' }]],
    functions: [
        ['kind', signature([['r', res]], int(0n, 0n))],
        ['open', signature([], res)],
        ['peek', signature([['r', res]], f64)],
        ['close', signature([own('r', res)], unit)],
    ],
}]

/** A module of one function `f` over L0 and the linear type, and any more functions before it. @type {(params: readonly Param[], result: Type, body: Term, more?: Module['functions']) => Module} */
const module_ = (params, result, body, more = []) => ({
    imports: [...l0, linear],
    functions: [...more, ['f', fn(params, result, body)]],
    exports: ['f'],
})

/** The functions of a module's owned stage, as text, which the checker takes. @type {(m: Module) => string} */
const owned = m => {
    const r = assertOk(lifetime(m))
    assertOk(check(r))
    return print({ imports: [], functions: r.functions, exports: [] })
}

/** @type {(m: Module, lines: readonly string[]) => void} */
const golden = (m, lines) => assertEq(owned(m), lines.map(line => `${line}\n`).join(''))

/** @type {(m: Module, message: string) => void} */
const refused = (m, message) => assertEq(assertError(lifetime(m)), message)

/** @type {(a: Term, b: Term) => Term} */
const concat = (a, b) => call('String', 'concat', [a, b])

/** @type {(c: Term) => Term} */
const fromUnit = c => call('String', 'from_unit', [c])

/** @type {(s: Term) => Term} */
const length = s => call('String', 'length', [s])

const open = call('Lin', 'open', [])

/** @type {(r: Term) => Term} */
const peek = r => call('Lin', 'peek', [r])

/** @type {(r: Term) => Term} */
const close = r => call('Lin', 'close', [r])

const a = get('a')
const b = get('b')
const c = get('c')
const k = get('k')
const x = get('x')
const one = lit(f64, 1)
const zero = lit(f64, 0)
const none = make([])
const letterA = lit(u(16), 0x61n)

/** A term that the pass refuses: a value of the linear type that is left over. @type {(name: string) => Term} */
const left = name => let_(name, open, r => peek(r))

/** The refusal of `left(name)`. @type {(name: string) => string} */
const leftOver = name => `f: ${name} is left over, and res is linear: nothing drops it`

export const proof = {
    // What the pass writes, which the checker takes.
    accept: {
        // Both arguments of concat borrow, and the caller owns its result, so nothing is copied or dropped.
        borrows: () => golden(module_([['a', string]], string, concat(a, a)), [
            'fn f(a: any.only(string)) -> any.only(string) =',
            '    String.concat(a, a)',
        ]),
        // A local moves at its last use, where its context takes it over.
        moved: () => golden(module_([['c', u(16)]], string, let_('s', fromUnit(c), s => s)), [
            'fn f(c: u(16)) -> any.only(string) =',
            '    let s = String.from_unit(c)',
            '    s',
        ]),
        // A local that its scope still owns where it ends is dropped there, after the scope's value.
        dropped: () => golden(module_([['c', u(16)]], u(31), let_('s', fromUnit(c), s => length(s))), [
            'fn f(c: u(16)) -> u(31) =',
            '    let s = String.from_unit(c)',
            '    let $0 = String.length(s)',
            '    let $1 = Any.drop(s)',
            '    $0',
        ]),
        // A use that takes a local over before its last use is a copy, and each copy is dropped where its scope ends.
        copied: () => golden(module_([['c', u(16)]], string, let_('s', fromUnit(c), s => let_('t', s, t => concat(s, t)))), [
            'fn f(c: u(16)) -> any.only(string) =',
            '    let s = String.from_unit(c)',
            '    let $2 =',
            '        let t = Any.dup(s)',
            '        let $0 = String.concat(s, t)',
            '        let $1 = Any.drop(t)',
            '        $0',
            '    let $3 = Any.drop(s)',
            '    $2',
        ]),
        // A parameter that owns its argument takes a borrow as a copy, and the callee drops what it does not give away.
        ownParam: () => golden(module_([['a', string]], unit, call('self', 'g', [a]), [['g', fn([own('v', any)], unit, none)]]), [
            'fn g(own v: any) -> unit =',
            '    let $0 = {}',
            '    let $1 = Any.drop(v)',
            '    $0',
            '',
            'fn f(a: any.only(string)) -> unit =',
            '    g(Any.dup(a))',
        ]),
        // A match lends its operand to its arms, so the function drops it after the match's value.
        lends: () => golden(module_([own('v', any)], u(31), match(get('v'), [[['string'], 's', length(get('s'))], [null, null, lit(u(31), 0n)]])), [
            'fn f(own v: any) -> u(31) =',
            '    let $0 =',
            '        match v',
            '          string as s =>',
            '            String.length(s)',
            '          else =>',
            '            0 as u(31)',
            '    let $1 = Any.drop(v)',
            '    $0',
        ]),
        // What one arm of a match consumes, each other arm drops.
        arms: () => golden(module_([own('v', any), ['b', bool]], any, if_(b, get('v'), fromUnit(letterA))), [
            'fn f(own v: any, b: bool) -> any =',
            '    if b',
            '    then',
            '        v',
            '    else',
            '        let $0 = String.from_unit(97 as u(16))',
            '        let $1 = Any.drop(v)',
            '        $0',
        ]),
        // An arm that names no operand borrows nothing of it, so it moves what the operand read: here the arms of an if, whose condition reads s.
        condition: () => golden(module_([['a', string]], string, let_('s', concat(a, a), s => if_(lt(lit(u(31), 2n), length(s)), s, a))), [
            'fn f(a: any.only(string)) -> any.only(string) =',
            '    let s = String.concat(a, a)',
            '    if lt(2 as u(31), String.length(s))',
            '    then',
            '        s',
            '    else',
            '        let $0 = Any.dup(a)',
            '        let $1 = Any.drop(s)',
            '        $0',
        ]),
        // A temporary that a call only borrows gets a name, which its scope drops, and so does every argument before it that does something.
        temporaries: () => golden(module_([['c', u(16)], ['x', f64]], f64, call('self', 'g', [add(x, one), fromUnit(c), x]), [['g', fn([['y', f64], ['s', string], ['z', f64]], f64, get('y'))]]), [
            'fn g(y: f64, s: any.only(string), z: f64) -> f64 =',
            '    y',
            '',
            'fn f(c: u(16), x: f64) -> f64 =',
            '    let $0 = add(x, 1.0 as f64)',
            '    let $1 = String.from_unit(c)',
            '    let $2 = g($0, $1, x)',
            '    let $3 = Any.drop($1)',
            '    $2',
        ]),
        // So does the operand of a match.
        operand: () => golden(module_([['c', u(16)]], u(31), match(fromUnit(c), [[['string'], 's', length(get('s'))]])), [
            'fn f(c: u(16)) -> u(31) =',
            '    let $0 = String.from_unit(c)',
            '    let $1 =',
            '        match $0',
            '          string as s =>',
            '            String.length(s)',
            '    let $2 = Any.drop($0)',
            '    $1',
        ]),
        // A loop owns its string, which a repeat moves and the last iteration gives as the result.
        loop: () => golden(module_([['a', string], ['k', f64]], string, loop('L', [['s', string, concat(a, a)], ['i', f64, one]], (s, i) =>
            if_(lt(i, k), let_('t', concat(s, s), t => next('L', [['s', t], ['i', add(i, one)]])), s))), [
            'fn f(a: any.only(string), k: f64) -> any.only(string) =',
            '    loop L (s: any.only(string) = String.concat(a, a), i: f64 = 1.0 as f64)',
            '        if lt(i, k)',
            '        then',
            '            let t = String.concat(s, s)',
            '            let $0 = add(i, 1.0 as f64)',
            '            let $1 = Any.drop(s)',
            '            br L { s: t, i: $0 }',
            '        else',
            '            s',
        ]),
        // A path that leaves the function early drops what it owns first, after its value.
        early: () => golden(module_([['a', string], ['b', bool]], f64, let_('t', concat(a, a), t =>
            let_('x', if_(b, return_(zero), one), x => add(x, float(length(t)))))), [
            'fn f(a: any.only(string), b: bool) -> f64 =',
            '    let t = String.concat(a, a)',
            '    let $1 =',
            '        let x =',
            '            if b',
            '            then',
            '                let $0 = Any.drop(t)',
            '                return 0.0 as f64',
            '            else',
            '                1.0 as f64',
            '        add(x, float(String.length(t)))',
            '    let $2 = Any.drop(t)',
            '    $1',
        ]),
        // A br to a block drops what the block owns, and a br that gives a local moves it.
        exit: () => golden(module_([['c', u(16)], ['b', bool]], f64, block('L', f64, let_('s', fromUnit(c), s => if_(b, br('L', zero), float(length(s)))))), [
            'fn f(c: u(16), b: bool) -> f64 =',
            '    block L: f64',
            '        let s = String.from_unit(c)',
            '        let $1 =',
            '            if b',
            '            then',
            '                let $0 = Any.drop(s)',
            '                br L 0.0 as f64',
            '            else',
            '                float(String.length(s))',
            '        let $2 = Any.drop(s)',
            '        $1',
        ]),
        exitMoves: () => golden(module_([['c', u(16)], ['b', bool]], string, block('L', string, let_('s', fromUnit(c), s => if_(b, br('L', s), concat(s, s))))), [
            'fn f(c: u(16), b: bool) -> any.only(string) =',
            '    block L: any.only(string)',
            '        let s = String.from_unit(c)',
            '        let $0 = if b then br L s else String.concat(s, s)',
            '        let $1 = Any.drop(s)',
            '        $0',
        ]),
        // Inside a block, the locals around it are lent, so a use that takes one over copies it.
        lent: () => golden(module_([['c', u(16)]], string, let_('s', fromUnit(c), s => block('L', string, s))), [
            'fn f(c: u(16)) -> any.only(string) =',
            '    let s = String.from_unit(c)',
            '    let $0 =',
            '        block L: any.only(string)',
            '            Any.dup(s)',
            '    let $1 = Any.drop(s)',
            '    $0',
        ]),
        // A br out of a loop drops what the loop and the regions around it own, and a loop that never ends drops nothing after it.
        out: () => golden(module_([['c', u(16)], ['k', f64]], f64, let_('s', fromUnit(c), s => loop('L', [['t', string, concat(s, s)], ['i', f64, zero]], (t, i) =>
            if_(lt(i, k), next('L', [['t', t], ['i', add(i, one)]]), return_(float(length(t))))))), [
            'fn f(c: u(16), k: f64) -> f64 =',
            '    let s = String.from_unit(c)',
            '    loop L (t: any.only(string) = String.concat(s, s), i: f64 = 0.0 as f64)',
            '        if lt(i, k)',
            '        then',
            '            br L { t: t, i: add(i, 1.0 as f64) }',
            '        else',
            '            let $0 = float(String.length(t))',
            '            let $1 = Any.drop(t)',
            '            let $2 = Any.drop(s)',
            '            return $0',
        ]),
        // A product leans on the locals it was made from, so they live while it does.
        leans: () => golden(module_([['c', u(16)]], string, let_('s', fromUnit(c), s => let_('p', make([['x', s]]), p => let_('t', s, t => concat(t, field(p, 'x')))))), [
            'fn f(c: u(16)) -> any.only(string) =',
            '    let s = String.from_unit(c)',
            '    let $2 =',
            '        let p = { x: s }',
            '        let t = Any.dup(s)',
            '        let $0 = String.concat(t, p.x)',
            '        let $1 = Any.drop(t)',
            '        $0',
            '    let $3 = Any.drop(s)',
            '    $2',
        ]),
        // A field of a sealed type that is taken over is a copy, and one that is borrowed or of no sealed type is read as it is.
        field: () => golden(module_([['c', u(16)]], string, let_('s', fromUnit(c), s => let_('p', make([['x', s], ['n', one]]), p =>
            let_('y', add(field(p, 'n'), float(length(field(p, 'x')))), () => field(p, 'x'))))), [
            'fn f(c: u(16)) -> any.only(string) =',
            '    let s = String.from_unit(c)',
            '    let $0 =',
            '        let p = { x: s, n: 1.0 as f64 }',
            '        let y = add(p.n, float(String.length(p.x)))',
            '        Any.dup(p.x)',
            '    let $1 = Any.drop(s)',
            '    $0',
        ]),
        // A name that the function binds is no new name.
        fresh: () => golden(module_([['c', u(16)]], u(31), let_('$0', lit(u(31), 0n), () => length(fromUnit(c)))), [
            'fn f(c: u(16)) -> u(31) =',
            '    let $0 = 0 as u(31)',
            '    let $1 = String.from_unit(c)',
            '    let $2 = String.length($1)',
            '    let $3 = Any.drop($1)',
            '    $2',
        ]),
        // A value of no sealed type is neither copied nor dropped.
        plain: () => golden(module_([['x', f64]], bool, let_('n', trunc_sat(u(31), x), n => let_('m', add(n, n), () => let_('y', true_, y => y)))), [
            'fn f(x: f64) -> bool =',
            '    let n = trunc_sat(u(31), x)',
            '    let m = add(n, n)',
            '    let y = true',
            '    y',
        ]),
        // A value of the linear type that a parameter that owns it takes over.
        linear: () => golden(module_([], f64, let_('r', open, r => let_('x', peek(r), x => let_('d', close(r), () => x)))), [
            'fn f() -> f64 =',
            '    let r = Lin.open()',
            '    let x = Lin.peek(r)',
            '    let d = Lin.close(r)',
            '    x',
        ]),
    },
    // What the pass refuses: a copy or a drop of a value of a linear type.
    refuse: {
        // A local of a linear type that its scope still owns where it ends.
        left: () => refused(module_([], f64, left('r')), leftOver('r')),
        // A use that takes a local of a linear type over before its last use.
        copy: () => refused(module_([], unit, let_('r', open, r => let_('d', close(r), () => close(r)))), 'f: a copy of r is needed, and res is linear: nothing copies it'),
        // A field of a linear type that is taken over.
        fieldCopy: () => refused(module_([], unit, let_('r', open, r => let_('p', make([['x', r]]), p => close(field(p, 'x'))))), 'f: a copy of field x is needed, and res is linear: nothing copies it'),
        // A parameter that owns a value of a linear type, and does not give it away.
        ownParam: () => refused(module_([own('r', res)], f64, peek(get('r'))), leftOver('r')),
        // A drop that one arm of a match needs, where another consumed the value.
        arm: () => refused(module_([['b', bool]], unit, let_('r', open, r => if_(b, none, close(r)))), leftOver('r')),
        // A br that leaves a region that owns a value of the linear type.
        exit: () => refused(module_([], f64, block('L', f64, let_('r', open, r => br('L', peek(r))))), leftOver('r')),
        // A parameter of a loop of the linear type, left over where the loop ends.
        loop: () => refused(module_([], f64, loop('L', [['r', res, open]], r => peek(r))), leftOver('r')),
        // A refusal inside each kind of term reaches the function.
        inside: {
            letValue: () => refused(module_([], f64, let_('y', left('r'), y => y)), leftOver('r')),
            op: () => refused(module_([], f64, add(left('r'), one)), leftOver('r')),
            args: () => refused(module_([], f64, call('self', 'g', [left('r'), left('q')]), [['g', fn([['y', f64], ['z', f64]], f64, get('y'))]]), leftOver('r')),
            make: () => refused(module_([], f64, field(make([['y', left('r')]]), 'y')), leftOver('r')),
            variant: () => refused(module_([], bool, variant(bool, 'true', let_('r', open, () => none))), leftOver('r')),
            operand: () => refused(module_([], f64, if_(lt(left('r'), one), one, zero)), leftOver('r')),
            arm: () => refused(module_([['b', bool]], f64, if_(b, left('r'), one)), leftOver('r')),
            block: () => refused(module_([], f64, block('L', f64, left('r'))), leftOver('r')),
            first: () => refused(module_([], f64, loop('L', [['i', f64, left('r')]], i => i)), leftOver('r')),
            body: () => refused(module_([], f64, loop('L', [['i', f64, one]], () => left('r'))), leftOver('r')),
            br: () => refused(module_([], f64, block('L', f64, br('L', left('r')))), leftOver('r')),
        },
        // The checker refuses the plain stage before the pass sees it.
        plain: () => refused(module_([], f64, get('nope')), 'f: no local nope'),
    },
}
