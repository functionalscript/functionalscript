/**
 * Proofs of the owned-stage check: hand-written IR that consumes each owned
 * value once on every path, and a refusal for each rule.
 *
 * @import { Module, Param, Term, Type } from '../../types.ts'
 */

import { assertEq, assertError, assertOk } from '../../../asserts/module.f.js'
import { any, l0 } from '../../l0/module.f.js'
import {
    add, block, bool, br, call, constant, f64, field, float, fn, get, if_, let_, lit, loop, lt, make, match, next, only, own, return_, trap, true_, u, unit,
    variant,
} from '../../module.f.js'
import { check } from '../module.f.js'

const string = only(any, 'string')

/** A module of one function `f` over L0, and any more functions before it. @type {(params: readonly Param[], result: Type, body: Term, more?: Module['functions']) => Module} */
const overL0 = (params, result, body, more = []) => ({
    imports: l0,
    functions: [...more, ['f', fn(params, result, body)]],
    exports: ['f'],
})

/** @type {(m: Module) => void} */
const fine = m => { assertOk(check(m)) }

/** @type {(m: Module) => string} */
const why = m => assertError(check(m))

/** @type {(a: Term, b: Term) => Term} */
const concat = (a, b) => call('String', 'concat', [a, b])

/** @type {(c: Term) => Term} */
const fromUnit = c => call('String', 'from_unit', [c])

/** @type {(v: Term) => Term} */
const drop = v => call('Any', 'drop', [v])

/** @type {(v: Term) => Term} */
const dup = v => call('Any', 'dup', [v])

/** @type {(s: Term) => Term} */
const length = s => call('String', 'length', [s])

/** A term of a type that never completes. @type {(t: Type) => Term} */
const stuck = t => block('X', t, trap('stuck'))

const c = get('c')
const a = get('a')
const b = get('b')
const k = get('k')
const one = lit(f64, 1)
const zero = lit(f64, 0)
const none = make([])

/** A term whose value is `v`, and which leaves the string `s` over. @type {(v: Term) => Term} */
const leak = v => let_('s', fromUnit(lit(u(16), 0x61n)), () => v)

const left = 'f: s is left over'

/** `c`, a unit for `from_unit`, and `b`, a condition. */
const cb = /** @type {const} */ ([['c', u(16)], ['b', bool]])

/** `a`, a borrowed string, and `b`, a condition. */
const ab = /** @type {const} */ ([['a', string], ['b', bool]])

/** A module over L0 of constants and functions, which exports none. @type {(cs: NonNullable<Module['constants']>, fs?: Module['functions']) => Module} */
const withConstants = (cs, fs = []) => ({ imports: l0, constants: cs, functions: fs, exports: [] })

/** A constant of the module. @type {(name: string) => Term} */
const self = name => constant('self', name)

const letterA = lit(u(16), 0x61n)

export const proof = {
    // What consumes each owned value once on every path.
    accept: {
        // Both arguments of concat borrow, and the caller owns its result.
        concat: () => fine(overL0([['a', string]], string, concat(a, a))),
        // from_unit answers an owned string, which drop consumes.
        fromUnitDrop: () => fine(overL0([['c', u(16)]], unit, let_('s', fromUnit(c), s => drop(s)))),
        // A dup of a borrow is owned, keeps its argument's type, and may be the result.
        dup: () => fine(overL0([['a', string]], u(31), let_('t', dup(a), t => let_('n', length(t), n => let_('d', drop(t), () => n))))),
        dupResult: () => fine(overL0([['v', any]], any, dup(get('v')))),
        // An own parameter is consumed by a drop, by a let that takes it over, or as the result.
        ownDrop: () => fine(overL0([own('v', any)], unit, drop(get('v')))),
        ownMoved: () => fine(overL0([own('v', any)], any, let_('w', get('v'), w => w))),
        // A match lends its operand, whose arm's name is used before the operand is consumed.
        lends: () => fine(overL0([own('v', any)], u(31), match(get('v'), [
            [['string'], 'v.s', let_('n', length(get('v.s')), n => let_('d', drop(get('v')), () => n))],
            [null, null, let_('d', drop(get('v')), () => lit(u(31), 0n))],
        ]))),
        // A borrow may be passed through a match, a block or a product, and leans on no more than its parts.
        borrows: () => fine(overL0(ab, u(31), length(if_(b, a, a)))),
        exitBorrows: () => fine(overL0(ab, u(31), length(block('L', string, if_(b, br('L', a), a))))),
        product: () => fine(overL0([['a', string]], u(31), let_('p', make([['x', a], ['n', one]]), p => length(field(p, 'x'))))),
        // The exits of a block agree: each consumes v, and each owns its value.
        exits: () => fine(overL0([own('v', any), ['b', bool]], unit, block('L', unit, if_(b, br('L', drop(get('v'))), drop(get('v')))))),
        exitOwns: () => fine(overL0(cb, string, block('L', string, if_(b, br('L', fromUnit(c)), fromUnit(c))))),
        // A br consumes only what the regions it leaves own: v, alive before the block, is alive after it.
        exitKeeps: () => fine(overL0([own('v', any), ['b', bool]], f64, let_('x', block('L', f64, if_(b, br('L', one), zero)), x => let_('d', drop(get('v')), () => x)))),
        // A path that leaves the function drops what it owns first, and the paths that go on agree.
        early: () => fine(overL0(ab, f64, let_('t', concat(a, a), t =>
            let_('x', if_(b, let_('d', drop(t), () => return_(zero)), one), x =>
                let_('n', float(length(t)), n => let_('e', drop(t), () => add(x, n))))))),
        // A trap abandons what the function owns.
        trap: () => fine(overL0([['c', u(16)]], unit, let_('s', fromUnit(c), () => trap('abandon')))),
        // A loop owns its string: each repeat drops the old one and passes the new one on.
        loopOwns: () => fine(overL0([['c', u(16)], ['k', f64]], string, loop('L', [['s', string, fromUnit(c)], ['i', f64, zero]], (s, i) =>
            if_(lt(i, k), let_('t', concat(s, s), t => let_('d', drop(s), () => next('L', [['s', t], ['i', add(i, one)]]))), s)))),
        // A loop borrows a parameter that its first value borrows, and passes the borrow on.
        loopBorrows: () => fine(overL0([['a', string], ['k', f64]], f64, loop('L', [['s', string, a], ['i', f64, zero]], (s, i) =>
            if_(lt(i, k), next('L', [['s', s], ['i', add(i, one)]]), float(length(s)))))),
        // A br may leave several blocks, and a match whose arms all leave completes no more than they do.
        nested: () => fine(overL0([], f64, block('M', f64, block('L', f64, br('M', one))))),
        noArm: () => fine(overL0([['b', bool]], f64, if_(b, trap('yes'), trap('no')))),
        // An arm that never completes is left out of the join, so the arm that moves v agrees with nothing.
        armTraps: () => fine(overL0([own('v', any)], any, match(get('v'), [[['string'], null, get('v')], [null, null, trap('no')]]))),
        variant: () => fine(overL0([], bool, true_)),
        // A constant owns its value: a string that from_unit answers, a dup of a constant, or a float, which is plain.
        // A term borrows a constant, and a function answers a dup of one.
        constants: () => fine(withConstants([
            ['a', { type: string, value: fromUnit(letterA) }],
            ['n', { type: only(any, 'null'), value: dup(constant('Any', 'null')) }],
            ['x', { type: f64, value: one }],
        ], [
            ['f', fn([], string, dup(self('a')))],
            ['g', fn([], u(31), length(self('a')))],
            ['h', fn([], f64, self('x'))],
        ])),
        // A call that never returns, and terms that never complete, end the paths they are on.
        never: () => fine(overL0([['x', f64]], f64, call('self', 'g', [get('x')]), [['g', fn([['x', f64]], ['sum', []], trap('g'))]])),
        stuck: {
            argument: () => fine(overL0([], u(31), length(stuck(string)))),
            operand: () => fine(overL0([], f64, add(stuck(f64), one))),
            field: () => fine(overL0([], f64, field(make([['x', stuck(f64)]]), 'x'))),
            let: () => fine(overL0([], f64, let_('x', stuck(f64), x => x))),
            match: () => fine(overL0([], f64, if_(stuck(bool), one, zero))),
            first: () => fine(overL0([], f64, loop('L', [['i', f64, stuck(f64)]], i => i))),
            exit: () => fine(overL0([], f64, block('L', f64, br('L', stuck(f64))))),
            repeat: () => fine(overL0([], f64, loop('L', [['i', f64, zero]], () => next('L', [['i', stuck(f64)]])))),
            result: () => fine(overL0([], f64, return_(stuck(f64)))),
            forever: () => fine(overL0([], f64, loop('L', [['i', f64, zero]], i => next('L', [['i', i]])))),
        },
    },
    // One refusal per rule.
    refuse: {
        // A constant owns its value, which a borrow is not, and its term leaves nothing over.
        constantBorrowed: () => assertEq(why(withConstants([['k', { type: only(any, 'null'), value: constant('Any', 'null') }]])), 'k: the value is borrowed, and the constant would own it'),
        constantLeft: () => assertEq(why(withConstants([['k', { type: f64, value: leak(one) }]])), 'k: s is left over'),
        // A function that answers a constant answers a borrow.
        constantResult: () => assertEq(
            why(withConstants([['a', { type: string, value: fromUnit(letterA) }]], [['f', fn([], string, self('a'))]])),
            'f: the result is borrowed, and its caller would own it',
        ),
        // A refusal inside a term is the term's, wherever the term stands.
        inside: {
            field: () => assertEq(why(overL0([], f64, field(make([['x', leak(one)]]), 'x'))), left),
            operand: () => assertEq(why(overL0([], f64, add(leak(one), one))), left),
            argument: () => assertEq(why(overL0([], unit, call('self', 'g', [leak(one), one]), [['g', fn([['x', f64], ['y', f64]], unit, none)]])), left),
            match: () => assertEq(why(overL0([], f64, if_(leak(true_), one, zero))), left),
            payload: () => assertEq(why(overL0([], bool, variant(bool, 'true', leak(none)))), left),
            first: () => assertEq(why(overL0([], f64, loop('L', [['i', f64, leak(one)]], i => i))), left),
            repeat: () => assertEq(why(overL0([], f64, loop('L', [['i', f64, zero]], () => next('L', [['i', leak(one)]])))), left),
            exit: () => assertEq(why(overL0([], f64, block('L', f64, br('L', leak(one))))), left),
            result: () => assertEq(why(overL0([], f64, return_(leak(one)))), left),
        },
        // Only an owned value may be consumed.
        borrowedDrop: () => assertEq(why(overL0([['a', string]], unit, drop(a))), "f: Any.drop's v: a is borrowed"),
        borrowedArgument: () => assertEq(why(overL0(ab, unit, drop(if_(b, a, a)))), "f: Any.drop's v is own, and its argument is borrowed"),
        // An owned value is consumed once, and a borrow does not outlive it.
        afterConsume: () => assertEq(
            why(overL0([['c', u(16)]], unit, let_('s', fromUnit(c), s => let_('d', drop(s), () => drop(s))))),
            'f: s is used after it was consumed',
        ),
        borrowAfter: () => assertEq(
            why(overL0([['a', string]], u(31), let_('t', concat(a, a), t => match(t, [
                [['string'], 't.s', let_('d', drop(t), () => length(get('t.s')))],
            ])))),
            'f: t.s is used after t, which it borrows, was consumed',
        ),
        lentAndConsumed: () => assertEq(
            why(overL0([own('v', any)], unit, call('self', 'g', [get('v'), get('v')]), [['g', fn([['x', any], own('y', any)], unit, drop(get('y')))]])),
            'f: g borrows v, which an argument of the call consumes',
        ),
        // A value that nothing takes over is bound first.
        temporary: () => assertEq(
            why(overL0([['a', string]], u(31), length(concat(a, a)))),
            'f: String.concat answers an owned value that nothing takes over: bind it first',
        ),
        productAfter: () => assertEq(
            why(overL0([['a', string]], u(31), let_('t', concat(a, a), t => let_('p', make([['x', t]]), p => let_('d', drop(t), () => length(field(p, 'x'))))))),
            'f: p is used after t, which it borrows, was consumed',
        ),
        productConsumed: () => assertEq(
            why(overL0([['a', string]], f64, let_('t', concat(a, a), t => let_('p', make([['x', t], ['d', drop(t)]]), () => one)))),
            'f: a product borrows t, which one of its fields consumes',
        ),
        // Every owned value is consumed by the end of its scope, or of the function.
        leftOver: () => assertEq(why(overL0([['c', u(16)]], f64, let_('s', fromUnit(c), () => one))), 'f: s is left over'),
        ownLeft: () => assertEq(why(overL0([own('v', any), own('w', any)], unit, none)), 'f: v, w are left over'),
        exitLeft: () => assertEq(why(overL0([['c', u(16)]], f64, block('L', f64, let_('s', fromUnit(c), () => br('L', one))))), 'f: s is left over'),
        returnLeft: () => assertEq(why(overL0([['c', u(16)]], f64, let_('s', fromUnit(c), () => return_(one)))), 'f: s is left over'),
        // The function owns a result of a sealed type.
        borrowedResult: () => assertEq(why(overL0([['a', string]], string, a)), 'f: the result is borrowed, and its caller would own it'),
        borrowedReturn: () => assertEq(why(overL0([['a', string]], string, return_(a))), 'f: the result is borrowed, and its caller would own it'),
        // The arms of a match, and the exits of a block, agree.
        arms: () => assertEq(
            why(overL0(cb, unit, let_('s', fromUnit(c), s => if_(b, drop(s), none)))),
            'f: s is consumed on one arm of a match and not on another',
        ),
        armsOwning: () => assertEq(why(overL0(ab, string, if_(b, a, concat(a, a)))), 'f: one arm of a match owns its value and another borrows it'),
        exits: () => assertEq(
            why(overL0(cb, unit, let_('s', fromUnit(c), s => block('L', unit, if_(b, br('L', drop(s)), none))))),
            'f: s is consumed on one exit of block L and not on another',
        ),
        exitsOwning: () => assertEq(
            why(overL0(ab, string, block('L', string, if_(b, br('L', a), concat(a, a))))),
            'f: one exit of block L owns its value and another borrows it',
        ),
        // A loop owns or borrows each parameter, and an iteration leaves what was alive before it.
        loopProduct: () => assertEq(
            why(overL0([['a', string]], f64, loop('L', [['p', ['product', [['s', string]]], make([['s', a]])]], () => one))),
            'f: p of loop L is a product that holds a sealed value: not in this slice',
        ),
        loopFirsts: () => assertEq(
            why(overL0([['a', string]], unit, let_('t', concat(a, a), t => match(t, [
                [['string'], 't.s', loop('L', [['x', string, get('t.s')], ['y', string, t]], (_, y) => drop(y))],
            ])))),
            "f: a parameter of loop L borrows t, which another's first value consumes",
        ),
        loopMoved: () => assertEq(
            why(overL0([['a', string]], unit, let_('t', concat(a, a), t => loop('L', [['s', string, t]], s => let_('d', drop(t), () => drop(s)))))),
            'f: t is used after it was consumed',
        ),
        loopLeft: () => assertEq(why(overL0([['c', u(16)]], f64, loop('L', [['s', string, fromUnit(c)]], () => one))), 'f: s is left over'),
        repeatBorrowed: () => assertEq(
            why(overL0([['a', string], ['c', u(16)], ['k', f64]], unit, loop('L', [['s', string, fromUnit(c)], ['i', f64, zero]], (s, i) =>
                if_(lt(i, k), let_('d', drop(s), () => next('L', [['s', a], ['i', add(i, one)]])), drop(s))))),
            'f: s of loop L is owned, and its next value is borrowed',
        ),
        repeatWider: () => assertEq(
            why(overL0([['a', string], ['k', f64]], f64, let_('t', concat(a, a), t =>
                let_('r', loop('L', [['s', string, a], ['i', f64, zero]], (s, i) =>
                    if_(lt(i, k), next('L', [['s', t], ['i', add(i, one)]]), float(length(s)))), r =>
                    let_('d', drop(t), () => r))))),
            'f: the next s of loop L borrows more than its first value',
        ),
        repeatLeft: () => assertEq(
            why(overL0([['c', u(16)], ['k', f64]], f64, loop('L', [['i', f64, zero]], i =>
                if_(lt(i, k), let_('s', fromUnit(c), () => next('L', [['i', add(i, one)]])), one)))),
            'f: s is left over',
        ),
        repeatConsumed: () => assertEq(
            why(overL0([['c', u(16)], ['k', f64]], unit, let_('s', fromUnit(c), s => loop('L', [['i', f64, zero]], i =>
                if_(lt(i, k), let_('d', drop(s), () => next('L', [['i', add(i, one)]])), drop(s)))))),
            'f: loop L repeats after s was consumed',
        ),
    },
}
