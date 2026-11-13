/**
 * @import { BindingId, Block, Exit, Function as FastFunction, LoopTarget, Statement, Value } from '../../js/ast/types.ts'
 * @import { Param, Signature, Type } from '../types.ts'
 */

import { assertEq, assertError, assertOk } from '../../asserts/module.f.js'
import { check } from '../check/module.f.mjs'
import { any, l0 } from '../l0/module.f.js'
import { bool, f64, i, signature, u } from '../module.f.js'
import { print } from '../print/module.f.js'
import { lower } from './module.f.mjs'
import { sourceOf, view } from './testlib.f.mjs'

/** The signatures of a module of one function, `f`. @type {(params: readonly Param[], result: Type) => Readonly<Record<string, Signature>>} */
const only = (params, result) => ({ f: signature(params, result) })

const fa = only([['a', f64]], f64)
const fab = only([['a', f64], ['b', f64]], f64)

/** The IR that the lowering makes of normalized FAST, printed. @type {(signatures: Readonly<Record<string, Signature>>, fast: Block) => string} */
const ir = (signatures, fast) => print(assertOk(lower(signatures)(fast)))

/** The reason that the lowering gives for refusing normalized FAST. @type {(signatures: Readonly<Record<string, Signature>>, fast: Block) => string} */
const why = (signatures, fast) => assertError(lower(signatures)(fast))

/** The normalized FAST of a module's text that imports nothing. @type {(text: string) => Block} */
const fast = text => {
    const { fast, imports } = assertOk(sourceOf(text))
    assertEq(imports.length, 0)
    return fast
}

/** What the lowering makes of a module's text, with its imports, over the L0 view `v`. @type {(signatures: Readonly<Record<string, Signature>>, text: string, v?: string | null) => ReturnType<ReturnType<typeof lower>>} */
const over = (signatures, text, v = view) => {
    const { fast, imports } = assertOk(sourceOf(text))
    return lower(signatures, v)(fast, imports)
}

/** The IR of a module's text over the L0 view, printed without the interfaces of L0, which it imports. @type {(signatures: Readonly<Record<string, Signature>>, text: string) => string} */
const irOver = (signatures, text) => {
    const m = assertOk(over(signatures, text))
    assertEq(m.imports, l0)
    return print({ ...m, imports: [] })
}

/** The L0 view's names that the proofs of the view read. */
const imports = "import { NUMBER, asBoolean, asNumber, asString, kind, length, unit } from '../l0/module.f.js'\n"

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
        // Where the left operand does something, it is bound first, so that it is still done first.
        assertEq(ir(only([['a', f64], ['b', f64]], bool), fast('export const f = (a, b) => a + 1 > b * 2')), [
            'fn f(a: f64, b: f64) -> bool =',
            '    let #0 = add(a, 1.0)',
            '    lt(mul(b, 2.0), #0)',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(why(only([['a', f64], ['b', f64]], bool), fast('export const f = (a, b) => a % 2 > b')), 'f: % is not in this slice')
        assertEq(why(only([['a', f64], ['b', f64]], bool), fast('export const f = (a, b) => a > b % 2')), 'f: % is not in this slice')
        assertEq(why(only([['a', f64], ['b', f64]], bool), fast('export const f = (a, b) => a + 1 > b % 2')), 'f: % is not in this slice')
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
    inline: () => {
        // A function inside a function is inlined where it is called. A parameter stands for its
        // argument, which is bound to a local first where it does something.
        assertEq(ir(fa, fast('export const f = a => (b => b * 2)(a + 1)')), [
            'fn f(a: f64) -> f64 =',
            '    let #0 = add(a, 1.0)',
            '    mul(#0, 2.0)',
            '',
            'export f',
            '',
        ].join('\n'))
        // It is inlined at each call, and its captures read what they name where the call stands.
        assertEq(ir(fa, fast([
            'export const f = a => {',
            '    const c = a + 1',
            '    const g = b => b * c',
            '    return g(a) + g(2)',
            '}',
        ].join('\n'))), [
            'fn f(a: f64) -> f64 =',
            '    let #0 = add(a, 1.0)',
            '    add(mul(a, #0), mul(2.0, #0))',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(why(fa, fast('export const f = a => {\n    const g = b => b\n    return g\n}')), 'f: a function as a value is not in this slice')
        assertEq(why(fa, fast('export const f = a => [b => b]')), 'f: array is not in this slice')
        assertEq(why(fa, fast('export const f = a => (b => b)(a, a)')), 'f: a function inside a function takes one argument, and its call gives 2')
        /** A module whose `f` calls a function that it defines, `g`, on `a`. @type {(g: FastFunction) => Block} */
        const calling = g => module([['define', x, ['function', g], 'required']], ['()', ['ref', x], [['ref', a]]])
        const b = id(3)
        const g = /** @type {const} */ ({ target, parameters: [b], rest: null, self: null, captures: [], body: yields(['ref', b]) })
        assertEq(ir(fa, calling(g)), [
            'fn f(a: f64) -> f64 =',
            '    a',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(why(fa, calling({ ...g, rest: id(4) })), 'f: a rest parameter is not in this slice')
        assertEq(why(fa, module([['define', x, ['()', ['function', g], [['ref', a]]], 'required']], ['ref', x])), 'f: a call of a value is not in this slice')
        assertEq(why(fa, calling({ ...g, self: id(4) })), 'f: a function inside a function that names itself is not in this slice')
        assertEq(why(fa, calling({ ...g, captures: [{ binding: id(4), value: 1 }] })), 'f: a capture that is no binding of the function is not in this slice')
        assertEq(why(fa, calling({ ...g, captures: [{ binding: id(4), value: ['ref', id(99)] }] })), 'f: a capture that is no binding of the function is not in this slice')
        // Its `return` must end its body: one in an arm would leave the function that calls it.
        const early = blk([], ['return', target, ['if', ['<', ['ref', b], 0], blk([], ['return', target, 1]), yields(['ref', b])]])
        assertEq(why(fa, calling({ ...g, body: early })), 'f: a return before the end of a function inside a function is not in this slice')
    },
    loops: () => {
        // A loop's parameters are locals of their first values' types, a float widened to `f64`.
        // `continue` repeats the loop, and `break` at the end of its body is its value.
        assertEq(ir(fa, fast([
            'export const f = a => {',
            '    let i = 0',
            '    while (i < a) { i = i + 1 }',
            '    return i',
            '}',
        ].join('\n'))), [
            'fn f(a: f64) -> f64 =',
            '    loop L0 (#0: f64 = 0.0)',
            '        if lt(#0, a) then br L0 { #0: add(#0, 1.0) } else #0',
            '',
            'export f',
            '',
        ].join('\n'))
        // A call of the function itself in its tail is a loop already in normalized FAST.
        assertEq(ir(fab, fast('export const f = (a, b) => a < 10 ? f(a + 1, b + a) : b')), [
            'fn f(a: f64, b: f64) -> f64 =',
            '    loop L0 (#0: f64 = a, #1: f64 = b)',
            '        if lt(#0, 10.0) then br L0 { #0: add(#0, 1.0), #1: add(#1, #0) } else #1',
            '',
            'export f',
            '',
        ].join('\n'))
        // A loop in a loop is labelled by how many loops enclose it.
        assertEq(ir(fa, fast([
            'export const f = a => {',
            '    const up = k => {',
            '        let j = 0',
            '        while (j < k) { j = j + 1 }',
            '        return j',
            '    }',
            '    let i = 0',
            '    while (i < a) { i = up(i) + 1 }',
            '    return i',
            '}',
        ].join('\n'))), [
            'fn f(a: f64) -> f64 =',
            '    loop L0 (#0: f64 = 0.0)',
            '        if lt(#0, a)',
            '        then',
            '            br L0',
            '                {',
            '                    #0:',
            '                        add(',
            '                            loop L1 (#1: f64 = 0.0)',
            '                                if lt(#1, #0) then br L1 { #1: add(#1, 1.0) } else #1,',
            '                            1.0',
            '                        )',
            '                }',
            '        else',
            '            #0',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(ir(only([['a', f64]], bool), fast([
            'export const f = a => {',
            '    let b = false',
            '    while (a < 0) { b = !b }',
            '    return b',
            '}',
        ].join('\n'))), [
            'fn f(a: f64) -> bool =',
            '    loop L0 (#0: bool = false)',
            '        if lt(a, 0.0) then br L0 { #0: if #0 then false else true } else #0',
            '',
            'export f',
            '',
        ].join('\n'))
        // Normalized FAST keeps the variables of a loop of more than one in an array.
        assertEq(why(fa, fast([
            'export const f = a => {',
            '    let i = 0',
            '    let s = 0',
            '    while (i < a) { s = s + i; i = i + 1 }',
            '    return s',
            '}',
        ].join('\n'))), 'f: . is not in this slice')
        // No bound holds what a later round gives an integer.
        assertEq(why(fa, fast([
            'export const f = a => {',
            '    let i = 0n',
            '    while (i < 5n) { i = i + 1n }',
            '    return a',
            '}',
        ].join('\n'))), 'f: a loop parameter of int(0, 0) is not in this slice')
        /** A module whose `f` loops on `p`, from `first`, with `body`, and returns its result `x`. @type {(body: Block, first?: Value, results?: readonly BindingId[]) => Block} */
        const looping = (body, first = 1, results = [x]) => module([['loop', { target: loop, parameters: [p], initial: [first], results, body }]], ['ref', x])
        const p = id(5)
        assertEq(why(fa, looping(blk([], ['break', loop, [1]]), 's')), 'f: a string is not in this slice')
        assertEq(why(fa, looping(blk([], ['break', loop, [1]]), ['+', 1, true])), 'f: add of f64c and bool: an operator takes integers or floats')
        assertEq(why(fa, looping(blk([], ['break', loop, [1]]), 1, [])), 'f: a loop with 0 results is not in this slice')
        assertEq(why(fa, looping(blk([], ['yield', []]))), "f: a loop's body that ends in neither continue nor break is not in this slice")
        assertEq(why(fa, looping(blk([], ['return', target, 1]))), 'f: a return inside a loop is not in this slice')
        assertEq(why(fa, looping(blk([], ['continue', loop, ['s']]))), 'f: a string is not in this slice')
        assertEq(why(fa, looping(blk([['define', id(6), ['block', blk([], ['break', loop, [1]])], 'required']], ['continue', loop, [1]]))), "f: a break before the end of its loop's body is not in this slice")
        assertEq(why(fa, module([], ['block', blk([], ['loop', { target: loop, parameters: [], initial: [], results: [], body: blk([], ['continue', loop, []]) }])])), 'f: a loop that never breaks is not in this slice')
    },
    blocks: () => {
        // A statement of one result is a `let`, and a `return` in an arm is a `br` to `return`.
        assertEq(ir(fa, module([['block', [x], yields(['+', ['ref', a], 1])]], ['*', ['ref', x], ['ref', x]])), [
            'fn f(a: f64) -> f64 =',
            '    let #0 = add(a, 1.0)',
            '    mul(#0, #0)',
            '',
            'export f',
            '',
        ].join('\n'))
        // A binding of a local is the local, and a `let` whose body is only its local is its value.
        assertEq(ir(fa, module([['block', [x], yields(['ref', a])]], ['ref', x])), [
            'fn f(a: f64) -> f64 =',
            '    a',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(ir(fa, module([['if', [x], ['<', ['ref', a], 0], yields(1), yields(['ref', a])]], ['ref', x])), [
            'fn f(a: f64) -> f64 =',
            '    if lt(a, 0.0) then 1.0 else a',
            '',
            'export f',
            '',
        ].join('\n'))
        // A statement that never completes ends its block, and what follows it is never read.
        assertEq(ir(fa, module([['if', [], ['<', ['ref', a], 0], blk([], ['return', target, 1]), blk([], ['return', target, 2])], ['define', x, 's', 'required']], 's')), [
            'fn f(a: f64) -> f64 =',
            '    if lt(a, 0.0) then 1.0 else 2.0',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(ir(fa, module([['block', [], blk([], ['return', target, ['ref', a]])]], 's')), [
            'fn f(a: f64) -> f64 =',
            '    a',
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
        // A block completes where each of its statements does: a block, or an `if` with an arm that does.
        const t = id(3)
        const y = id(4)
        const z = id(5)
        assertEq(ir(fa, module([['block', [x], blk([
            ['define', t, ['*', ['ref', a], 2], 'required'],
            ['block', [y], yields(['ref', t])],
            ['if', [z], ['<', ['ref', a], 0], blk([], ['return', target, 1]), yields(['ref', y])],
        ], ['yield', [['+', ['ref', t], ['ref', z]]]])]], ['ref', x])), [
            'fn f(a: f64) -> f64 =',
            '    let #0 = mul(a, 2.0)',
            '    let #1 = if lt(a, 0.0) then return 1.0 else #0',
            '    add(#0, #1)',
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
        assertEq(why(fa, module([['block', [x, t], blk([], ['yield', [1, 2]])]], 1)), 'f: a statement with 2 results is not in this slice')
        assertEq(why(fa, module([], ['block', blk([], ['yield', [1, 2]])])), 'f: a region that yields 2 values is not in this slice')
        assertEq(why(fa, module([], ['block', blk([], ['break', loop, []])])), "f: a break before the end of its loop's body is not in this slice")
        assertEq(why(fa, module([], ['+', ['ref', a]])), 'f: + of one operand is not in this slice')
    },
    modules: () => {
        // The table names the functions to lower; the module's other bindings are read where they are captured.
        assertEq(ir({}, fast('export const f = a => a')), '')
        assertEq(ir(fa, fast('const k = [1]\nexport const g = a => k\nexport const f = a => a')), [
            'fn f(a: f64) -> f64 =',
            '    a',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(why(fa, fast('const k = [1]\nexport const f = a => k')), 'f: a module constant is not in this slice')
        // A constant that reads a constant the way an import is read is a constant.
        assertEq(why(fa, fast('const o = [[1]]\nconst k = o[0].length\nexport const f = a => k')), 'f: a module constant is not in this slice')
        assertEq(why(fa, fast('const o = [[1]]\nconst k = o.a.b\nexport const f = a => k')), 'f: a module constant is not in this slice')
        assertEq(why({ k: fa.f }, fast('export const k = 2')), 'k: an export that is not a function is not in this slice')
        assertEq(why({ g: fa.f, h: fa.f }, fast('const f = a => a\nexport const g = f\nexport const h = f')), 'h exports the same function as g')
        assertEq(why(fa, fast('const g = a => a\nexport const f = a => g(a)')), 'f: a function that the module does not export is not in this slice')
        assertEq(why(fa, fast('export const g = a => a\nexport const f = a => g(a)')), 'f: g has no signature')
        assertEq(why({ ...fa, g: fa.f }, fast('export const f = a => a')), 'g has a signature, and the module exports no function g')
        const f = /** @type {const} */ (['function', fun(yields(1))])
        /** A module that exports `f`, which captures `x`, after `statements`. @type {(statements: readonly Statement[]) => Block} */
        const reading = statements => exporting(statements, ['yield', [['object', [[':', 'f', ['function', fun(yields(['ref', x]), [{ binding: x, value: ['ref', x] }])]]]]]])
        assertEq(why(fa, reading([['if', [x], true, yields(1), yields(1)]])), 'f: a module statement of the kind if is not in this slice')
        assertEq(why(fa, reading([['loop', { target: loop, parameters: [], initial: [], results: [x], body: blk([], ['break', loop, [1]]) }]])), 'f: a module statement of the kind loop is not in this slice')
        assertEq(why(fa, reading([['define', x, 1, 'lazy']])), 'f: a lazy definition is not in this slice')
        assertEq(why(fa, exporting([['define', x, f, 'lazy']], ['yield', [['object', [[':', 'f', ['ref', x]]]]]])), 'f: a lazy definition is not in this slice')
        // The normalization may put a block around an export, for the bindings that only it reads.
        assertEq(ir(fa, exporting([], ['yield', [['object', [[':', 'f', ['block', blk([['define', x, 1, 'required']], ['yield', [f]])]]]]]])), [
            'fn f(a: f64) -> f64 =',
            '    1.0',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(why(fa, exporting([], ['yield', [['object', [[':', 'f', ['block', blk([], ['throw', 1])]]]]]])), 'f: an export that is not a function is not in this slice')
        assertEq(why(fa, exporting([], ['throw', 1])), 'a module that yields no object of exports is not in this slice')
        assertEq(why(fa, exporting([], ['yield', [1, 2]])), 'a module that yields no object of exports is not in this slice')
        assertEq(why(fa, exporting([], ['yield', [1]])), 'a module that yields no object of exports is not in this slice')
        assertEq(why(fa, exporting([], ['yield', [['array', []]]])), 'a module that yields no object of exports is not in this slice')
        assertEq(why(fa, exporting([], ['yield', [['object', [['...', ['ref', x]]]]]])), 'an export of a computed name is not in this slice')
        assertEq(why(fa, exporting([], ['yield', [['object', [[':', ['ref', x], f]]]]])), 'an export of a computed name is not in this slice')
        assertEq(why(fa, exporting([], ['yield', [['object', [[':', 'f', ['ref', x]]]]]])), 'f: an export that is not a function is not in this slice')
    },
    text: () => {
        assertEq(assertError(sourceOf('export const f = a => {')), 'parse: unexpected end')
        assertEq(assertError(sourceOf('export const f = a => +a')), 'unary + AST-to-FAST conversion is not implemented')
    },
    view: () => {
        const fv = only([['v', any]], f64)
        const bv = only([['v', any]], bool)
        // A tag is a number in JavaScript, so a float here, and so is what `kind` answers.
        assertEq(irOver(bv, `${imports}export const f = v => kind(v) === NUMBER`), [
            'fn f(v: any) -> bool =',
            '    eq(float(Any.kind(v)), 3.0)',
            '',
            'export f',
            '',
        ].join('\n'))
        // A cast names its operand at the kind that it takes.
        assertEq(irOver(bv, `${imports}export const f = v => asBoolean(v)`), [
            'fn f(v: any) -> bool =',
            '    match v',
            '      boolean as v.boolean =>',
            '        Any.to_bool(v.boolean)',
            '      else =>',
            "        trap('not boolean')",
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(irOver(fv, `${imports}export const f = v => asNumber(v)`), [
            'fn f(v: any) -> f64 =',
            '    match v',
            '      number as v.number =>',
            '        Any.to_f64(v.number)',
            '      else =>',
            "        trap('not number')",
            '',
            'export f',
            '',
        ].join('\n'))
        // `length` is the `length` of each module of L0, and a trap for the kinds that have none.
        // An operand that is no local is named for the function.
        assertEq(irOver(only([['c', bool], ['v', any]], f64), `${imports}export const f = (c, v) => length(c ? v : v)`), [
            'fn f(c: bool, v: any) -> f64 =',
            '    float(',
            '        match if c then v else v',
            '          string as length.string =>',
            '            String.length(length.string)',
            '          bigint as length.bigint =>',
            '            BigInt.length(length.bigint)',
            '          array | object as length.containers =>',
            '            Containers.length(length.containers)',
            '          function as length.functions =>',
            '            Functions.length(length.functions)',
            '          undefined | null | boolean | number =>',
            "            trap('no length')",
            '    )',
            '',
            'export f',
            '',
        ].join('\n'))
        // `asString` is its operand at `string`, and the `length` of a string is String's.
        assertEq(irOver(fv, `${imports}export const f = v => length(asString(v))`), [
            'fn f(v: any) -> f64 =',
            '    float(',
            '        String.length(',
            '            match v',
            '              string as v.string =>',
            '                v.string',
            '              else =>',
            "                trap('not string')",
            '        )',
            '    )',
            '',
            'export f',
            '',
        ].join('\n'))
        // Where the first thing that a definition does is a cast of a local, the cast narrows the
        // rest of its block, which reads the local at the cast's kind.
        assertEq(irOver(fv, `${imports}export const f = v => {\n    const s = asString(v)\n    return length(s) + length(v) + length(s)\n}`), [
            'fn f(v: any) -> f64 =',
            '    match v',
            '      string as v.string =>',
            '        add(add(float(String.length(v.string)), float(String.length(v.string))), float(String.length(v.string)))',
            '      else =>',
            "        trap('not string')",
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(irOver(fv, `${imports}export const f = v => {\n    const k = asNumber(v)\n    return k * asNumber(v) * k\n}`), [
            'fn f(v: any) -> f64 =',
            '    match v',
            '      number as v.number =>',
            '        let #0 = Any.to_f64(v.number)',
            '        mul(mul(#0, Any.to_f64(v.number)), #0)',
            '      else =>',
            "        trap('not number')",
            '',
            'export f',
            '',
        ].join('\n'))
        // A cast that is not the first thing that its definition does, or not of a local, narrows nothing.
        assertEq(irOver(only([['v', any], ['a', f64]], f64), `${imports}export const f = (v, a) => {\n    const k = a + length(asString(v))\n    return k * k\n}`), [
            'fn f(v: any, a: f64) -> f64 =',
            '    let #0 =',
            '        add(',
            '            a,',
            '            float(',
            '                String.length(',
            '                    match v',
            '                      string as v.string =>',
            '                        v.string',
            '                      else =>',
            "                        trap('not string')",
            '                )',
            '            )',
            '        )',
            '    mul(#0, #0)',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(irOver(only([['v', any], ['c', bool]], f64), `${imports}export const f = (v, c) => {\n    const s = asString(c ? v : v)\n    return length(s) * length(s)\n}`), [
            'fn f(v: any, c: bool) -> f64 =',
            '    let #0 =',
            '        match if c then v else v',
            '          string as asString.string =>',
            '            asString.string',
            '          else =>',
            "            trap('not string')",
            '    mul(float(String.length(#0)), float(String.length(#0)))',
            '',
            'export f',
            '',
        ].join('\n'))
        // `unit` reads the integer that its index holds exactly, after the cast of the string.
        const fvi = only([['v', any], ['i', f64]], f64)
        assertEq(irOver(fvi, `${imports}export const f = (v, i) => unit(v, i)`), [
            'fn f(v: any, i: f64) -> f64 =',
            '    float(',
            '        match v',
            '          string as v.string =>',
            '            let i.index = trunc_sat(u(31), i)',
            "            if eq(float(i.index), i) then String.unit(v.string, i.index) else trap('inexact')",
            '          else =>',
            "            trap('not string')",
            '    )',
            '',
            'export f',
            '',
        ].join('\n'))
        // JavaScript reads both arguments first, so an index that does something is bound before the
        // cast, and an operand that does something before it.
        assertEq(irOver(fvi, `${imports}export const f = (v, i) => unit(v, unit(v, i + 1))`), [
            'fn f(v: any, i: f64) -> f64 =',
            '    let #0 =',
            '        let #0 = add(i, 1.0)',
            '        float(',
            '            match v',
            '              string as v.string =>',
            '                let #0.index = trunc_sat(u(31), #0)',
            "                if eq(float(#0.index), #0) then String.unit(v.string, #0.index) else trap('inexact')",
            '              else =>',
            "                trap('not string')",
            '        )',
            '    float(',
            '        match v',
            '          string as v.string =>',
            '            let #0.index = trunc_sat(u(31), #0)',
            "            if eq(float(#0.index), #0) then String.unit(v.string, #0.index) else trap('inexact')",
            '          else =>',
            "            trap('not string')",
            '    )',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(irOver(only([['v', any], ['c', bool], ['i', f64]], f64), `${imports}export const f = (v, c, i) => unit(c ? v : v, i + 1)`), [
            'fn f(v: any, c: bool, i: f64) -> f64 =',
            '    let #0 = if c then v else v',
            '    let #1 = add(i, 1.0)',
            '    float(',
            '        match #0',
            '          string as #0.string =>',
            '            let #1.index = trunc_sat(u(31), #1)',
            "            if eq(float(#1.index), #1) then String.unit(#0.string, #1.index) else trap('inexact')",
            '          else =>',
            "            trap('not string')",
            '    )',
            '',
            'export f',
            '',
        ].join('\n'))
        assertEq(irOver(only([['v', any], ['c', bool]], f64), `${imports}export const f = (v, c) => unit(c ? v : v, 0)`), [
            'fn f(v: any, c: bool) -> f64 =',
            '    float(',
            '        match if c then v else v',
            '          string as unit.string =>',
            '            let unit.index = trunc_sat(u(31), 0.0)',
            "            if eq(float(unit.index), 0.0) then String.unit(unit.string, unit.index) else trap('inexact')",
            '          else =>',
            "            trap('not string')",
            '    )',
            '',
            'export f',
            '',
        ].join('\n'))
        // What the view does not read.
        assertEq(assertError(over(fvi, "import { item } from '../l0/module.f.js'\nexport const f = (v, i) => item(v, i)")), 'f: item of L0 is not in this slice')
        assertEq(assertError(over(fv, `${imports}export const f = v => unit(v)`)), 'f: unit takes 2 arguments, not 1')
        assertEq(assertError(over(fv, `${imports}export const f = v => unit(v, 1n)`)), 'f: unit at int(1, 1) is not in this slice')
        assertEq(assertError(over(fv, `${imports}export const f = v => unit(1, 0)`)), 'f: unit of f64c is not in this slice')
        assertEq(assertError(over(fv, `${imports}export const f = v => unit(v, 1 + true)`)), 'f: add of f64c and bool: an operator takes integers or floats')
        assertEq(assertError(over(fv, `${imports}export const f = v => {\n    const s = asString(NUMBER)\n    return length(s) * length(s)\n}`)), 'f: asString of f64c is not in this slice')
        assertEq(assertError(over(fa, `${imports}export const f = a => {\n    const s = asString(a)\n    return length(s) * length(s)\n}`)), 'f: asString of f64 is not in this slice')
        assertEq(assertError(over(fv, `${imports}export const f = v => {\n    const s = asString(...v)\n    return length(s) * length(s)\n}`)), 'f: a spread argument is not in this slice')
        assertEq(assertError(over(fv, `${imports}export const f = v => {\n    const s = asString(v)\n    return length(s) % length(s)\n}`)), 'f: % is not in this slice')
        assertEq(assertError(over(fv, `${imports}export const f = v => kind(v, v)`)), 'f: kind takes one argument, not 2')
        assertEq(assertError(over(fv, `${imports}export const f = v => kind(1)`)), 'f: kind of f64c is not in this slice')
        assertEq(assertError(over(fv, `${imports}export const f = v => kind(1 + true)`)), 'f: add of f64c and bool: an operator takes integers or floats')
        assertEq(assertError(over(fv, `${imports}export const f = v => kind`)), 'f: a function as a value is not in this slice')
        assertEq(assertError(over(fv, `${imports}export const f = v => kind(v)`, null)), 'f: an import of ../l0/module.f.js is not in this slice')
        assertEq(assertError(over(fv, 'import g from "./g.f.js"\nexport const f = a => g(a)')), 'f: an import of ./g.f.js is not in this slice')
        assertEq(assertError(over(fv, 'import d from "./d.json" with { type: "json" }\nexport const f = a => d', './d.json')), 'f: an import of ./d.json is not in this slice')
        assertEq(assertError(lower(fv, view)(assertOk(sourceOf(`${imports}export const f = v => kind(v)`)).fast)), 'f: no import 4')
        // Without the L0 view, the module imports no interface, so the checker finds none that names `any`.
        assertEq(assertError(check(assertOk(lower(fv)(fast('export const f = v => 1'))))), 'f: no interface Any')
    },
}
