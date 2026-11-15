/**
 * Proofs of the lifetime pass: plain IR, the owned stage that the pass
 * writes for it, as text, which the checker takes, and a refusal for each
 * value of a linear type that the pass would have to copy or drop.
 *
 * @import { Interface, Module, Param, Sealed, Term, Type } from '../types.ts'
 */

import { assertEq, assertError, assertOk } from '../../asserts/module.f.js'
import { check } from '../check/module.f.js'
import { any, builder, l0 } from '../l0/module.f.js'
import {
    add, block, bool, br, call, constant, f64, field, float, fn, get, if_, int, let_, lit, loop, lt, make, match, n, never, next, only, own,
    return_, sealed, signature, throw_, trap, true_, trunc_sat, u, unit, variant,
} from '../module.f.js'
import { print } from '../print/module.f.js'
import { lifetime } from './module.f.js'

const string = only(any, 'string')

/** @type {Sealed} */
const res = sealed('Lin', 'res')

/**
 * A linear type, which nothing copies or drops: `open` makes a value of it,
 * `peek` borrows one and `close` owns one, `give` owns one and a value of
 * `any`, `it` is a constant of it, and its interface makes its literals.
 * `both` owns two values of `any`.
 *
 * @type {readonly [string, Interface]}
 */
const linear = ['Lin', {
    abi: 'test:lin',
    types: [['res', { variants: ['res'], kind: 'kind', carrier: 'i64', literal: { variant: 'res', module: 'Lin', member: 'make' } }]],
    constants: [['it', res]],
    functions: [
        ['kind', signature([['r', res]], int(0n, 0n))],
        ['open', signature([], res)],
        ['peek', signature([['r', res]], f64)],
        ['close', signature([own('r', res)], unit)],
        ['give', signature([own('r', res), own('v', any)], unit)],
        ['both', signature([own('a', any), own('b', any)], unit)],
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

/** A module over L0 and the linear type of constants and functions, which exports none. @type {(cs: NonNullable<Module['constants']>, fs?: Module['functions']) => Module} */
const withConstants = (cs, fs = []) => ({ imports: [...l0, linear], constants: cs, functions: fs, exports: [] })

/** The constants and the functions of a module's owned stage, as text, which the checker takes. @type {(m: Module, lines: readonly string[]) => void} */
const constantsGolden = (m, lines) => {
    const r = assertOk(lifetime(m))
    assertOk(check(r))
    assertEq(print({ ...r, imports: [] }), lines.map(line => `${line}\n`).join(''))
}

/** A constant of the module. @type {(name: string) => Term} */
const self = name => constant('self', name)

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

/** @type {(x: Term, y: Term) => Term} */
const both = (x, y) => call('Lin', 'both', [x, y])

/** Containers' `begin_array` of `k` items. @type {(k: Term) => Term} */
const begin = k => call('Containers', 'begin_array', [k])

/** Containers' `push` of `v` onto `b`, which gives `b` back. @type {(b: Term, v: Term) => Term} */
const push = (b, v) => call('Containers', 'push', [b, v])

/** Containers' `seal` of `b`. @type {(b: Term) => Term} */
const seal = b => call('Containers', 'seal', [b])

/** A string literal, which the pass copies where a push takes it over. */
const letters = lit(string, 'ab')

/** A string that is never made: its block leaves the function first. */
const away = block('B', string, return_(none))

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
        // A constant owns its value, so a term that takes one over takes a dup of it, and one that reads it reads it as it is. A
        // constant's term drops what it owns, as a body does, and a constant of a float is plain.
        constants: () => constantsGolden(withConstants([
            ['a', { type: string, value: fromUnit(letterA) }],
            ['aa', { type: string, value: concat(self('a'), self('a')) }],
            ['n', { type: only(any, 'null'), value: constant('Any', 'null') }],
            ['x', { type: f64, value: one }],
            ['len', { type: u(31), value: let_('s', fromUnit(letterA), s => length(s)) }],
        ], [
            ['f', fn([], string, self('aa'))],
            ['g', fn([], u(31), length(self('a')))],
            ['h', fn([], f64, self('x'))],
            ['p', fn([], f64, peek(constant('Lin', 'it')))],
        ]), [
            'const a: any.only(string) =',
            '    String.from_unit(97 as u(16))',
            '',
            'const aa: any.only(string) =',
            '    String.concat(self.a, self.a)',
            '',
            'const n: any.only(null) =',
            '    Any.dup(Any.null)',
            '',
            'const x: f64 =',
            '    1.0 as f64',
            '',
            'const len: u(31) =',
            '    let s = String.from_unit(97 as u(16))',
            '    let $0 = String.length(s)',
            '    let $1 = Any.drop(s)',
            '    $0',
            '',
            'fn f() -> any.only(string) =',
            '    Any.dup(self.aa)',
            '',
            'fn g() -> u(31) =',
            '    String.length(self.a)',
            '',
            'fn h() -> f64 =',
            '    self.x',
            '',
            'fn p() -> f64 =',
            '    Lin.peek(Lin.it)',
        ]),
        // A string literal is a borrow, as a constant is: a term that takes one over takes a dup of it, and one that reads it
        // reads it as it is. A let owns its value, so it takes a dup of one.
        literals: () => constantsGolden(withConstants([
            ['s', { type: string, value: lit(string, 'a') }],
        ], [
            ['f', fn([], string, lit(string, 'abc'))],
            ['g', fn([], u(31), length(lit(string, '')))],
            ['h', fn([], string, let_('t', lit(string, 'é'), t => concat(t, t)))],
            ['k', fn([], string, let_('t', lit(string, '😀'), t => t))],
        ]), [
            'const s: any.only(string) =',
            '    Any.dup("a")',
            '',
            'fn f() -> any.only(string) =',
            '    Any.dup("abc")',
            '',
            'fn g() -> u(31) =',
            '    String.length("")',
            '',
            'fn h() -> any.only(string) =',
            '    let t = Any.dup("é")',
            '    let $0 = String.concat(t, t)',
            '    let $1 = Any.drop(t)',
            '    $0',
            '',
            'fn k() -> any.only(string) =',
            '    let t = Any.dup("😀")',
            '    t',
        ]),
        linear: () => golden(module_([], f64, let_('r', open, r => let_('x', peek(r), x => let_('d', close(r), () => x)))), [
            'fn f() -> f64 =',
            '    let r = Lin.open()',
            '    let x = Lin.peek(r)',
            '    let d = Lin.close(r)',
            '    x',
        ]),
        // A part that may leave by a br is bound, after what the parts before it give, which the br drops: an
        // argument, an owned local that the call would take over, a loop's first value and a repeat's next value.
        leaving: {
            argument: () => golden(module_([['c', u(16)]], unit, both(fromUnit(c), away)), [
                'fn f(c: u(16)) -> unit =',
                '    let $0 = String.from_unit(c)',
                '    let $1 =',
                '        block B: any.only(string)',
                '            let $2 = {}',
                '            let $3 = Any.drop($0)',
                '            return $2',
                '    Lin.both($0, $1)',
            ]),
            moved: () => golden(module_([['c', u(16)]], unit, let_('s', fromUnit(c), s => both(s, away))), [
                'fn f(c: u(16)) -> unit =',
                '    let s = String.from_unit(c)',
                '    let $0 =',
                '        block B: any.only(string)',
                '            let $1 = {}',
                '            let $2 = Any.drop(s)',
                '            return $1',
                '    Lin.both(s, $0)',
            ]),
            first: () => golden(module_([['c', u(16)]], unit, loop('L', [['x', any, fromUnit(c)], ['y', any, away]], (x, y) => both(x, y))), [
                'fn f(c: u(16)) -> unit =',
                '    let $0 = String.from_unit(c)',
                '    let $1 =',
                '        block B: any.only(string)',
                '            let $2 = {}',
                '            let $3 = Any.drop($0)',
                '            return $2',
                '    loop L (x: any = $0, y: any = $1)',
                '        Lin.both(x, y)',
            ]),
            next: () => golden(module_([['c', u(16)], ['k', f64]], unit, loop('L', [['s', string, fromUnit(c)], ['i', f64, zero]], (s, i) =>
                if_(lt(i, k), next('L', [['s', concat(s, s)], ['i', block('B', f64, return_(none))]]), none))), [
                'fn f(c: u(16), k: f64) -> unit =',
                '    loop L (s: any.only(string) = String.from_unit(c), i: f64 = 0.0 as f64)',
                '        let $6 =',
                '            if lt(i, k)',
                '            then',
                '                let $0 = String.concat(s, s)',
                '                let $1 =',
                '                    block B: f64',
                '                        let $2 = {}',
                '                        let $3 = Any.drop(s)',
                '                        let $4 = Any.drop($0)',
                '                        return $2',
                '                let $5 = Any.drop(s)',
                '                br L { s: $0, i: $1 }',
                '            else',
                '                {}',
                '        let $7 = Any.drop(s)',
                '        $6',
            ]),
        },
        // Containers' builder is linear: each push takes it over and gives it back, and seal ends it, while the items that
        // it takes over are copies of what the function borrows.
        builders: {
            items: () => golden(module_([['a', any]], any, seal(push(push(begin(n(2n)), a), letters))), [
                'fn f(a: any) -> any =',
                '    Containers.seal(Containers.push(Containers.push(Containers.begin_array(2), Any.dup(a)), Any.dup("ab")))',
            ]),
            bound: () => golden(module_([['a', any]], any, let_('b', begin(n(1n)), b => let_('c', push(b, a), seal))), [
                'fn f(a: any) -> any =',
                '    let b = Containers.begin_array(1)',
                '    let c = Containers.push(b, Any.dup(a))',
                '    Containers.seal(c)',
            ]),
            loop: () => golden(module_([['a', any], ['k', u(8)]], any, loop('L', [['b', builder, begin(k)], ['i', f64, zero]], (b, i) =>
                if_(lt(i, float(k)), next('L', [['b', push(b, a)], ['i', add(i, one)]]), seal(b)))), [
                'fn f(a: any, k: u(8)) -> any =',
                '    loop L (b: builder = Containers.begin_array(k), i: f64 = 0.0 as f64)',
                '        if lt(i, float(k)) then br L { b: Containers.push(b, Any.dup(a)), i: add(i, 1.0 as f64) } else Containers.seal(b)',
            ]),
        },
        // A call that answers never, as a throw does, drops what the function owns first, after its arguments, but what
        // it borrows: what the regions around it own, and a loop's parameters, which it does not take over.
        throws: {
            drops: () => golden(module_([own('v', any), ['a', string]], never, let_('t', concat(a, a), () => throw_(lit(string, 'no')))), [
                'fn f(own v: any, a: any.only(string)) -> never =',
                '    let t = String.concat(a, a)',
                '    let $0 = Any.dup("no")',
                '    let $1 = Any.drop(v)',
                '    let $2 = Any.drop(t)',
                '    Functions.throw($0)',
            ]),
            lends: () => golden(module_([own('v', any), ['a', string]], never, let_('t', concat(a, a), t => call('self', 'g', [t])),
                [['g', fn([['x', any]], never, x => throw_(x))]]), [
                'fn g(x: any) -> never =',
                '    Functions.throw(Any.dup(x))',
                '',
                'fn f(own v: any, a: any.only(string)) -> never =',
                '    let t = String.concat(a, a)',
                '    let $0 = Any.drop(v)',
                '    g(t)',
            ]),
            block: () => golden(module_([['a', string], ['b', bool]], f64, let_('t', concat(a, a), t =>
                add(float(length(t)), block('L', f64, let_('s', concat(t, t), s => if_(b, throw_(s), br('L', float(length(s))))))))), [
                'fn f(a: any.only(string), b: bool) -> f64 =',
                '    let t = String.concat(a, a)',
                '    let $3 =',
                '        add(',
                '            float(String.length(t)),',
                '            block L: f64',
                '                let s = String.concat(t, t)',
                '                if b',
                '                then',
                '                    let $0 = Any.drop(t)',
                '                    Functions.throw(s)',
                '                else',
                '                    let $1 = float(String.length(s))',
                '                    let $2 = Any.drop(s)',
                '                    br L $1',
                '        )',
                '    let $4 = Any.drop(t)',
                '    $3',
            ]),
            loop: () => golden(module_([['a', string], ['k', f64]], f64, loop('L', [['s', string, concat(a, a)], ['i', f64, zero]], (s, i) =>
                if_(lt(i, k), next('L', [['s', concat(s, s)], ['i', add(i, one)]]), throw_(s)))), [
                'fn f(a: any.only(string), k: f64) -> f64 =',
                '    loop L (s: any.only(string) = String.concat(a, a), i: f64 = 0.0 as f64)',
                '        if lt(i, k)',
                '        then',
                '            let $0 = String.concat(s, s)',
                '            let $1 = add(i, 1.0 as f64)',
                '            let $2 = Any.drop(s)',
                '            br L { s: $0, i: $1 }',
                '        else',
                '            Functions.throw(s)',
            ]),
        },
    },
    // What the pass refuses: a copy or a drop of a value of a linear type.
    refuse: {
        // A builder that is never sealed.
        unsealed: () => refused(module_([['a', any]], int(0n, 8n), let_('b', begin(n(0n)), () => call('Any', 'kind', [a]))), 'f: b is left over, and builder is linear: nothing drops it'),
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
        // A throw that would have to drop a value of a linear type.
        throwing: () => refused(module_([], never, let_('r', open, () => throw_(lit(string, 'no')))), leftOver('r')),
        // A br that leaves before the call takes a linear value over would have to drop it.
        leaving: () => refused(module_([], unit, call('Lin', 'give', [open, away])), leftOver('$0')),
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
        // A literal of a linear type, which a term takes over.
        literal: () => refused(module_([], only(res, 'res'), lit(only(res, 'res'), 'x')), 'f: a copy of "x" is needed, and res.only(res) is linear: nothing copies it'),
        // A constant of a linear type, which a term takes over, and a constant's term that leaves a value of one over.
        constant: () => refused(withConstants([], [['f', fn([], res, constant('Lin', 'it'))]]), 'f: a copy of Lin.it is needed, and res is linear: nothing copies it'),
        constantLeft: () => refused(withConstants([['k', { type: f64, value: left('r') }]]), 'k: r is left over, and res is linear: nothing drops it'),
        // The checker refuses the plain stage before the pass sees it.
        plain: () => refused(module_([], f64, get('nope')), 'f: no local nope'),
    },
}
