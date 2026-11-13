/**
 * @import { BindingId, Block, Exit, Function as FastFunction, LoopTarget, Statement, Value } from '../../js/ast/types.ts'
 * @import { Param, Signature, Type } from '../types.ts'
 */

import { assertEq, assertError, assertOk } from '../../asserts/module.f.js'
import { bool, f64, i, signature, u } from '../module.f.mjs'
import { print } from '../print/module.f.mjs'
import { lower } from './module.f.mjs'
import { fastOf } from './testlib.f.mjs'

/** @typedef {Readonly<Record<string, Signature>>} Signatures */

/** The signatures of a module of one function, `f`. @type {(params: readonly Param[], result: Type) => Signatures} */
const only = (params, result) => ({ f: signature(params, result) })

const fa = only([['a', f64]], f64)
const fab = only([['a', f64], ['b', f64]], f64)

/** The IR that the lowering makes of normalized FAST, printed. @type {(signatures: Signatures, fast: Block) => string} */
const ir = (signatures, fast) => print(assertOk(lower(signatures)(fast)))

/** The reason that the lowering gives for refusing normalized FAST. @type {(signatures: Signatures, fast: Block) => string} */
const why = (signatures, fast) => assertError(lower(signatures)(fast))

/** The normalized FAST of a module's text. @type {(text: string) => Block} */
const fast = text => assertOk(fastOf(text))

// FAST written by hand, for the forms that no text makes today

/** @type {(index: number) => BindingId} */
const id = index => ({ index })

const a = id(1)
const x = id(2)
const target = /** @type {const} */ ({ kind: 'function', index: 0 })
/** @type {LoopTarget} */
const loop = { kind: 'loop', index: 0 }

/** @type {(statements: readonly Statement[], exit: Exit) => Block} */
const blk = (statements, exit) => ({ statements, exit })

/** @type {(v: Value) => Block} */
const yields = v => blk([], ['yield', [v]])

/** @type {(body: Block, captures?: FastFunction['captures']) => FastFunction} */
const fun = (body, captures = []) => ({ target, parameters: [a], rest: null, self: null, captures, body })

/** A module of the function `f` of `a`: its body's statements, and the value it returns. @type {(statements: readonly Statement[], v: Value) => Block} */
const module = (statements, v) => blk([], ['yield', [['object', [[':', 'f', ['function', fun(blk(statements, ['return', target, v]))]]]]]])

/** A module that yields `exports`, after `statements`. @type {(statements: readonly Statement[], exit: Exit) => Block} */
const exporting = (statements, exit) => blk(statements, exit)

export const proof = {
    values: () => {
        assertEq(ir(fab, fast('export const f = (a, b) => a < b ? b : a')), [
            'fn f(a: f64, b: f64) -> f64 =',
            '    if lt(a, b) then b else a',
            '',
            'export f',
            '',
        ].join('\n'))
        const two = { f: fab.f, g: only([['a', bool]], bool).f }
        assertEq(ir(two, fast('export const f = (a, b) => a <= b ? a / b : b\nexport const g = a => a ? false : true')), [
            'fn f(a: f64, b: f64) -> f64 =',
            '    if le(a, b) then div(a, b) else b',
            '',
            'fn g(a: bool) -> bool =',
            '    if a then false else true',
            '',
            'export f, g',
            '',
        ].join('\n'))
        // A local is named by how many `let`s enclose it, so the arms each have a `#1`.
        assertEq(ir(fab, fast([
            'export const f = (a, b) => {',
            '    const s = a + b',
            '    if (s < 0) {',
            '        const t = s * s',
            '        return t + t',
            '    }',
            '    const v = s - a',
            '    return v * v',
            '}',
        ].join('\n'))), [
            'fn f(a: f64, b: f64) -> f64 =',
            '    let #0 = add(a, b)',
            '    if lt(#0, 0.0)',
            '    then',
            '        let #1 = mul(#0, #0)',
            '        add(#1, #1)',
            '    else',
            '        let #1 = sub(#0, a)',
            '        mul(#1, #1)',
            '',
            'export f',
            '',
        ].join('\n'))
        // `>` and `>=` swap their operands, `Math.sqrt` and `Math.abs` are operators.
        assertEq(ir(only([['a', f64], ['b', f64]], bool), fast('export const f = (a, b) => a > b && b >= a')), [
            'fn f(a: f64, b: f64) -> bool =',
            '    let #0 = lt(b, a)',
            '    if #0 then le(a, b) else #0',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(ir(fa, fast('export const f = a => Math.sqrt(Math.abs(a))')), [
            'fn f(a: f64) -> f64 =',
            '    sqrt(abs(a))',
            '',
            'export f',
            '',
        ].join('\n'))
    },
    types: () => {
        // The operand's type picks the operator.
        assertEq(ir(only([['a', i(32)], ['b', f64]], f64), fast('export const f = (a, b) => -b - Number(-a) - Number(b) - -(b < 0 ? 1 : 2)')), [
            'fn f(a: i(32), b: f64) -> f64 =',
            '    sub(sub(sub(neg(b), float(sub(0, a))), b), neg(if lt(b, 0.0) then 1.0 else 2.0))',
            '',
            'export f',
            '',
        ].join('\n'))
        const bools = { f: signature([['a', bool], ['b', bool]], bool), g: signature([['a', bool], ['b', bool]], bool), h: signature([['a', bool]], bool) }
        assertEq(ir(bools, fast('export const f = (a, b) => a === b\nexport const g = (a, b) => a !== b\nexport const h = a => !a')), [
            'fn f(a: bool, b: bool) -> bool =',
            '    if a then b else if b then false else true',
            '',
            'fn g(a: bool, b: bool) -> bool =',
            '    if a',
            '    then',
            '        if b then false else true',
            '    else',
            '        b',
            '',
            'fn h(a: bool) -> bool =',
            '    if a then false else true',
            '',
            'export f, g, h',
            '',
        ].join('\n'))
        assertEq(ir(only([['a', u(8)], ['b', f64]], bool), fast('export const f = (a, b) => a === 1n && b !== 1')), [
            'fn f(a: u(8), b: f64) -> bool =',
            '    let #0 = eq(a, 1)',
            '    if #0',
            '    then',
            '        if eq(b, 1.0) then false else true',
            '    else',
            '        #0',
            '',
            'export f',
            '',
        ].join('\n'))
    },
    calls: () => {
        const signatures = { g: signature([['a', f64]], f64), h: signature([['a', f64], ['b', f64]], f64) }
        assertEq(ir(signatures, fast([
            'export const g = a => a < 1 ? 1 : a * g(a - 1)',
            'export const h = (a, b) => g(a) + g(b)',
        ].join('\n'))), [
            'fn g(a: f64) -> f64 =',
            '    if lt(a, 1.0) then 1.0 else mul(a, g(sub(a, 1.0)))',
            '',
            'fn h(a: f64, b: f64) -> f64 =',
            '    add(g(a), g(b))',
            '',
            'export g, h',
            '',
        ].join('\n'))
        assertEq(why(fa, fast('export const f = g => g(1)')), 'f: a call of a value is not in this slice')
        assertEq(why({ ...fa, g: signature([['a', f64]], f64) }, fast('export const g = a => a\nexport const f = a => g(a)(a)')), 'f: a call of a value is not in this slice')
        assertEq(why({ ...fa, g: signature([['a', f64]], f64) }, fast('export const g = a => a\nexport const f = a => g(...a)')), 'f: a spread argument is not in this slice')
        assertEq(why({ ...fa, g: signature([['a', f64]], f64) }, fast('export const g = a => a\nexport const f = a => g("s")')), 'f: a string is not in this slice')
        assertEq(why({ ...fa, g: signature([['a', f64]], f64) }, fast('export const g = a => a\nexport const f = a => g')), 'f: a function as a value is not in this slice')
        assertEq(why(fa, fast('export const f = a => { const s = Math.sqrt; return s(a) + s }')), 'f: a function as a value is not in this slice')
        assertEq(why(fa, fast('export const f = a => Math.floor(a)')), 'f: Math.floor is not in this slice')
        assertEq(why(fa, fast('export const f = a => (b => b)(a)')), 'f: a function inside a function is not in this slice')
        assertEq(why(fa, module([], ['()', ['ref', id(99)], []])), 'f: a call of a value is not in this slice')
        assertEq(why(fa, module([], ['()', 1, []])), 'f: a call of a value is not in this slice')
    },
    refused: () => {
        const mixed = only([['a', f64], ['b', u(8)]], f64)
        assertEq(why(fa, fast('export const f = a => a % 2')), 'f: % is not in this slice')
        assertEq(why(fa, fast('export const f = a => "s"')), 'f: a string is not in this slice')
        assertEq(why(fa, fast('export const f = a => null')), 'f: null is not in this slice')
        assertEq(why(fa, fast('export const f = a => undefined')), 'f: undefined is not in this slice')
        assertEq(why(fa, fast('export const f = a => { throw a }')), 'f: throw is not in this slice')
        assertEq(why(only([['a', f64], ['b', f64]], f64), fast('export const f = (a, b) => a < 10 ? f(a + 1, b + a) : b')), 'f: a loop is not in this slice')
        assertEq(why(fa, fast('export const f = a => a < 0 ? "s" : a')), 'f: a string is not in this slice')
        assertEq(why(fa, fast('export const f = a => a % 2 + 1')), 'f: % is not in this slice')
        // What the checker refuses in a part, the lowering refuses where it asks for the part's type.
        assertEq(why(mixed, fast('export const f = (a, b) => { const s = a + b; return s * s }')), 'f: add of f64 and u(8): the operands are integers or floats, not both')
        assertEq(why(mixed, fast('export const f = (a, b) => -(a + b)')), 'f: add of f64 and u(8): the operands are integers or floats, not both')
        assertEq(why(mixed, fast('export const f = (a, b) => (a + b) === 1')), 'f: add of f64 and u(8): the operands are integers or floats, not both')
        assertEq(why(fa, fast('export const f = a => { const s = a % 2; return s * s }')), 'f: % is not in this slice')
        assertEq(why(fa, fast('export const f = a => { const s = a + a; return s % 2 }')), 'f: % is not in this slice')
        assertEq(why(fa, fast('export const f = a => -(a % 2)')), 'f: % is not in this slice')
        assertEq(why(fa, fast('export const f = a => (a % 2) === 1')), 'f: % is not in this slice')
        assertEq(why(only([['a', bool]], bool), fast('export const f = a => -a')), 'f: - of bool is not in this slice')
        assertEq(why(fa, fast('export const f = a => !a')), 'f: ! of f64 is not in this slice')
        assertEq(why(only([['a', bool]], f64), fast('export const f = a => Number(a)')), 'f: Number of bool is not in this slice')
    },
    functions: () => {
        assertEq(why(fa, fast('export const f = (...xs) => xs')), 'f: a rest parameter is not in this slice')
        assertEq(why(fa, fast('export const f = (a, b) => a')), 'f: the signature has one parameter, and the function 2')
        assertEq(why(fa, module([], ['ref', id(99)])), 'f: a binding from outside the function is not in this slice')
        const capturing = /** @type {(v: Value) => Block} */ (v => exporting([], ['yield', [['object', [[':', 'f', ['function', fun(yields(1), [{ binding: x, value: v }])]]]]]]))
        assertEq(why(fa, capturing(['ref', id(99)])), 'f: a capture that is not a function of the module is not in this slice')
        assertEq(why(fa, capturing(1)), 'f: a capture that is not a function of the module is not in this slice')
    },
    blocks: () => {
        // A statement of one result is a `let`, and a `return` in an arm is a `br` to `return`.
        assertEq(ir(fa, module([['block', [x], yields(['ref', a])]], ['ref', x])), [
            'fn f(a: f64) -> f64 =',
            '    let #0 = a',
            '    #0',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(ir(fa, module([['if', [x], ['<', ['ref', a], 0], yields(1), yields(['ref', a])]], ['ref', x])), [
            'fn f(a: f64) -> f64 =',
            '    let #0 = if lt(a, 0.0) then 1.0 else a',
            '    #0',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(ir(fa, module([['define', x, 1, 'required']], ['if', ['<', ['ref', a], 0], blk([], ['return', target, ['ref', x]]), yields(['ref', a])])), [
            'fn f(a: f64) -> f64 =',
            '    let #0 = 1.0',
            '    if lt(a, 0.0) then return #0 else a',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(ir(fa, module([], ['?:', ['<', ['ref', a], 0], 1, ['ref', a]])), [
            'fn f(a: f64) -> f64 =',
            '    if lt(a, 0.0) then 1.0 else a',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(why(fa, module([], ['?:', 's', 1, 2])), 'f: a string is not in this slice')
        assertEq(why(fa, module([], ['if', true, blk([], ['return', target, 's']), yields(1)])), 'f: a string is not in this slice')
        assertEq(why(fa, module([['define', x, 1, 'lazy']], ['ref', x])), 'f: a lazy definition is not in this slice')
        assertEq(why(fa, module([['if', [], true, yields(1), yields(1)]], 1)), 'f: a statement with 0 results is not in this slice')
        assertEq(why(fa, module([], ['block', blk([], ['yield', [1, 2]])])), 'f: a region that yields 2 values is not in this slice')
        assertEq(why(fa, module([], ['block', blk([], ['break', loop, []])])), 'f: a loop is not in this slice')
        assertEq(why(fa, module([], ['+', ['ref', a]])), 'f: + of one operand is not in this slice')
    },
    modules: () => {
        assertEq(why(fa, fast('const k = [1]\nexport const f = a => k')), 'a module constant is not in this slice')
        assertEq(why(fa, fast('export const k = 2')), 'k: an export that is not a function is not in this slice')
        assertEq(why({ g: fa.f, h: fa.f }, fast('const f = a => a\nexport const g = f\nexport const h = f')), 'h exports the same function as g')
        assertEq(why(fa, fast('const g = a => a\nexport const f = a => g(a)')), 'a function that the module does not export is not in this slice')
        assertEq(why({ ...fa, g: fa.f }, fast('export const f = a => a')), 'g has a signature, and the module exports no function g')
        assertEq(why({}, fast('export const f = a => a')), 'f has no signature')
        const f = /** @type {const} */ (['function', fun(yields(1))])
        assertEq(why(fa, exporting([['if', [], true, yields(1), yields(1)]], ['yield', [1]])), 'a module statement of the kind if is not in this slice')
        assertEq(why(fa, exporting([['define', x, f, 'lazy']], ['yield', [1]])), 'a lazy definition is not in this slice')
        assertEq(why(fa, exporting([], ['throw', 1])), 'a module that yields no object of exports is not in this slice')
        assertEq(why(fa, exporting([], ['yield', [1, 2]])), 'a module that yields no object of exports is not in this slice')
        assertEq(why(fa, exporting([], ['yield', [1]])), 'a module that yields no object of exports is not in this slice')
        assertEq(why(fa, exporting([], ['yield', [['array', []]]])), 'a module that yields no object of exports is not in this slice')
        assertEq(why(fa, exporting([], ['yield', [['object', [['...', ['ref', x]]]]]])), 'an export of a computed name is not in this slice')
        assertEq(why(fa, exporting([], ['yield', [['object', [[':', ['ref', x], f]]]]])), 'an export of a computed name is not in this slice')
        assertEq(why(fa, exporting([], ['yield', [['object', [[':', 'f', ['ref', x]]]]]])), 'f: an export that is not a function is not in this slice')
    },
    text: () => {
        assertEq(assertError(fastOf('export const f = a => {')), 'parse: unexpected end')
        assertEq(assertError(fastOf('import g from "./g.f.js"\nexport const f = a => g(a)')), 'an import is not in this slice')
        assertEq(assertError(fastOf('export const f = a => +a')), 'unary + AST-to-FAST conversion is not implemented')
    },
}
