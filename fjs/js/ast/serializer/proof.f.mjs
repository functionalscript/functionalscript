/**
 * Prepared syntax retains operation grouping, lexical identities and token
 * marks. Evaluation and graph placement are tested at their own boundaries.
 *
 * @import { BindingId } from '../types.ts'
 * @import { Block, Function as PreparedFunction, Value } from '../prepare/types.ts'
 * @import { Values } from '../../../edag/value/types.ts'
 * @import { ValueResult } from '../../../edag/value/control/types.ts'
 */

import { assert, assertEq, assertError, assertOk } from '../../../asserts/module.f.js'
import { identityAnalysis } from '../../../edag/analysis/module.f.mjs'
import { invoke, memo } from '../../../edag/memo/module.f.mjs'
import { call } from '../../../edag/value/call/module.f.mjs'
import { ok } from '../../../types/result/module.f.js'
import { _defaultExport, unresolved } from '../../../compiler/edag/module.f.mjs'
import { parse } from '../../../compiler/source/module.f.mjs'
import { untagged } from '../../../text/marked/module.f.mjs'
import { functionStringify, render, renderModule, stringify } from './module.f.mjs'

/** @type {(index: number) => BindingId} */
const id = index => ({ index })

/** @type {(value: Value) => Block} */
const yielding = value => ({ statements: [], exit: ['yield', [value]] })

/** Prepared choice fixtures; source logical lowering is tested in sugar. @type {(condition: Value, then: Value, otherwise: Value) => Value} */
const choice = (condition, then, otherwise) => ['if', condition, yielding(then), yielding(otherwise)]

/** @type {(value: Value) => string} */
const expression = value => stringify(yielding(value), 'expression')

/** Read actual FJS source before calling its represented export.
 * @type {(source: string, args?: Values) => ValueResult}
 */
const invokeSource = (source, args = []) => {
    const graph = _defaultExport(unresolved(assertOk(parse('/prepared-guard.f.mjs')(source))).edag)
    const fn = memo(assertOk(identityAnalysis(graph)))({ args: [] })
    return call(fn, args.map(value => () => ok(value)), invoke)
}

export const proof = {
    emptyAlternativeSpellsAnAdmittedTerminatingGuard: () => {
        const target = /** @type {const} */ ({ kind: 'function', index: 0 })
        const selected = id(0)
        /** @type {PreparedFunction} */
        const fn = { target, parameters: [selected], rest: null, self: null, captures: [], body: {
            statements: [['if', ['ref', selected], { statements: [], exit: ['return', target, 7] }, { statements: [], exit: ['yield', []] }]],
            exit: ['return', target, 9],
        } }
        for (const runtime of [false, true]) {
            const block = yielding(['function', fn])
            const source = stringify(block, 'module', runtime)
            assertEq(source, 'export default ($0)=>{if($0){return 7;}return 9;};')
            assertEq(untagged(render(block, 'module', runtime)), source)
            assertEq(assertOk(invokeSource(source, [true])), 7)
            assertEq(assertOk(invokeSource(source, [false])), 9)
            /** @type {PreparedFunction} */
            const failing = { ...fn, parameters: [], body: { ...fn.body,
                statements: [['if', ['.', null, 'required test'], { statements: [], exit: ['return', target, 7] }, { statements: [], exit: ['yield', []] }]],
            } }
            assertError(invokeSource(stringify(yielding(['function', failing]), 'module', runtime)))
        }
    },
    nonemptyAlternativesKeepTheirLexicalScope: () => {
        const target = /** @type {const} */ ({ kind: 'function', index: 0 })
        const loop = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const selected = id(0)
        /** @type {PreparedFunction} */
        const fn = { target, parameters: [selected], rest: null, self: null, captures: [], body: {
            statements: [], exit: ['loop', loop, {
                statements: [['if', ['ref', selected], { statements: [], exit: ['return', target, 7] },
                    { statements: [['define', selected, false]], exit: ['return', target, ['ref', selected]] },
                ]], exit: ['continue', loop],
            }],
        } }
        for (const runtime of [false, true]) {
            const block = yielding(['function', fn])
            const source = stringify(block, 'module', runtime)
            assertEq(source, `export default ($0)=>{${runtime ? 'L0:' : ''}while(true){if($0){return 7;}else{const $0=false;return $0;}continue${runtime ? ' L0' : ''};}};`)
            assertEq(untagged(render(block, 'module', runtime)), source)
            if (!runtime) {
                assertEq(assertOk(invokeSource(source, [true])), 7)
                assertEq(assertOk(invokeSource(source, [false])), false)
            }
        }
    },
    stackSafety: () => {
        const count = 20_000
        /** @type {Value} */
        let unary = 1
        /** @type {Value} */
        let binary = 1
        /** @type {Value} */
        let access = 1
        /** @type {Value} */
        let pure = 1
        /** @type {Value} */
        let required = 1
        for (let index = 0; index < count; index += 1) {
            unary = ['!', unary]
            binary = ['+', binary, 1]
            access = ['.', access, 'x']
            pure = ['block', yielding(pure)]
            required = ['block', { statements: [['define', id(index), index]], exit: ['yield', [required]] }]
        }
        assertEq(expression(unary), `${'!'.repeat(count)}1`)
        assertEq(expression(binary), `1${'+1'.repeat(count)}`)
        assertEq(expression(access), `(1)${'.x'.repeat(count)}`)
        assertEq(expression(pure), '1')
        assertEq(expression(required), `(()=>{${Array.from({ length: count }, (_, index) => `const $${index}=${count - index - 1};`).join('')}return 1;})()`)
    },
    operatorGrouping: () => {
        const andValue = choice(true, 1, true)
        const orValue = choice(false, false, 1)
        const nullishValue = choice(choice(['===', undefined, null], true, ['===', undefined, undefined]), 2, undefined)
        /** @type {readonly Value[]} */
        const values = [
            undefined, null, true, false, NaN, Infinity, -0, 4n, 'literal',
            ['block', yielding(['block', yielding(1)])],
            ['entry'], ['hasEntry'], ['slice'], ['Object.is'],
            ['array', [1, ['...', ['array', [2, 3]]]]],
            ['object', [[':', 'x', 1], [':', '__proto__', 2], [':', ['+', 'x', 'y'], 3], ['...', ['object', [[':', 'z', 4]]]]]],
            ['.', ['array', [2]], 0], ['.', ['object', [[':', 'a-b', 2]]], 'a-b'],
            ['memberPresent', ['array', [2]], 'map'], ['memberPresent', ['array', [2]], ['Number', '0']],
            ['?.', null, 'key'], ['?.', null, 0], ['?.', null, ['Number', 'x']],
            ['.', ['object', [[':', 'NaN', 3]]], ['Number', 'x']],
            ['()', ['entry'], [['object', [[':', 'x', 3]]], 'x']],
            ['()', ['.', ['object', [[':', 'f', ['entry']]]], 'f'], []],
            ['?.()', undefined, [2]],
            ['?.()', undefined, [], ['|.', 'length']],
            ['?.', null, 'a', ['|.', ['Number', 'x'], ['|()', [1], ['|.', 0]]]],
            ['.', ['object', []], 'f', ['|?.()', [], ['|.', 'x']]],
            ['?.', null, 'f', ['|!()', []]],
            [',', []], [',', [1, 2]], ['?:', true, 1, 2],
            ['Number', '2'], ['BigInt', '2'], ['String', 2], ['typeof', 2], ['~', 1], ['!', 1], ['-', 1], ['-', 3, 1],
            ['+', 1, ['*', 2, 3]], ['+', 1, ['+', 2, 3]], ['+', 1, ['+', 2]],
            ['**', ['**', 2, 3], 4], ['**', 2, ['**', 3, 2]],
            choice(false, false, 2), nullishValue, choice(true, 2, true),
            ['|', 1, 2], ['^', 1, 2], ['&', 1, 2], ['===', 1, 2], ['!==', 1, 2],
            ['<', 1, 2], ['<=', 1, 2], ['>', 1, 2], ['>=', 1, 2], ['instanceof', ['array', []], 'Array'],
            ['in', 'x', ['object', []]], ['in', 'a-b', ['<', 1, 2]],
            ['<<', 1, 2], ['>>', 8, 2], ['>>>', -1, 2], ['*', 2, 3], ['/', 4, 2], ['%', 5, 2],
            choice(choice(['===', andValue, null], true, ['===', andValue, undefined]), 2, andValue), choice(true, nullishValue, true),
            choice(choice(['===', orValue, null], true, ['===', orValue, undefined]), choice(true, 2, true), orValue),
            ['block', yielding(['+', 1, 2])],
            ['if', ['?:', false, 0, true], yielding(1), yielding(2)],
        ]
        for (const value of values) {
            const block = yielding(value)
            assertEq(untagged(render(block, 'expression')), stringify(block, 'expression'))
            assertEq(typeof expression(value), 'string')
        }
        assertEq(expression(['+', 1, ['*', 2, 3]]), '1+2*3')
        assertEq(expression(['+', 1, ['+', 2, 3]]), '1+(2+3)')
        assertEq(expression(choice(choice(['===', andValue, null], true, ['===', andValue, undefined]), 2, andValue)), '((true?1:true)===null?true:(true?1:true)===undefined)?2:true?1:true')
        assertEq(expression(['.', ['object', [[':', 'a-b', 2]]], 'a-b']), '{"a-b":2}["a-b"]')
        assertEq(expression(['()', -1, []]), '(-1)()')
        assertEq(expression(['?.()', -1n, []]), '(-1n)?.()')
        // the key is a string literal, and the right operand groups as `<`'s right operand would
        assertEq(expression(['in', 'a-b', ['<', 1, 2]]), '"a-b" in (1<2)')
        assertEq(expression(['in', 'x', ['+', 1, 2]]), '"x" in 1+2')
    },
    expressionBoundaryGrouping: () => {
        assertEq(expression(['()', ['Object.is'], [1, 1]]), 'Object.is(1,1)')
        assertEq(expression(['()', ['slice'], ['abc', 1, 2]]), '(($0,$1,$2)=>$0.slice($1,$2))("abc",1,2)')
        assertEq(expression(['.', ['?.', null, 'x'], 'y']), '(null?.x).y')
        assertEq(expression(['.', ['.', 'a', 'b', ['|?.()', []]], 'c']), '("a".b?.()).c')
        assertEq(expression(['+', 1, ['+', 2]]), '1+ +2')
        assertEq(expression(['+', ['+', 2]]), '+ +2')
        assertEq(expression(['-', ['-', 1]]), '- -1')
        assertEq(expression(['-', 1, -2]), '1- -2')
        assertEq(expression(['**', -2n, 3]), '(-2n)**3')
        assertEq(expression(['**', ['-', 2], 3]), '(-2)**3')
    },
    detachedWrappedCallees: () => {
        const member = /** @type {Value} */ (['.', 'abc', 'slice'])
        const optional = /** @type {Value} */ (['?.', null, 'slice'])
        for (const value of /** @type {readonly Value[]} */ ([member, optional])) {
            const syntax = expression(value)
            const block = /** @type {Value} */ (['block', yielding(value)])
            const nested = /** @type {Value} */ (['block', yielding(['block', yielding(value)])])
            for (const callee of /** @type {readonly Value[]} */ ([value, block, nested])) {
                assertEq(expression(['()', callee, [1]]), `(0,${syntax})(1)`)
            }
            assertEq(expression(['()', [',', [value]], [1]]), `(0,(${syntax}))(1)`)
            assertEq(expression(['()', ['block', yielding([',', [['block', yielding(value)]]])], [1]]), `(0,(${syntax}))(1)`)
            assertEq(expression(['()', [',', [0, value]], [1]]), `(0,${syntax})(1)`)
            assertEq(expression(['()', choice(true, value, value), [1]]), `(true?${syntax}:${syntax})(1)`)
        }
        assertEq(expression(['()', [',', [3]], [1]]), '(3)(1)')
        assertEq(expression(['()', [',', []], [1]]), '(undefined)(1)')
        assertEq(expression(['.', 'abc', 'slice', ['|()', [1]]]), '"abc".slice(1)')
        assertEq(expression(['?.', null, 'slice', ['|()', [1]]]), 'null?.slice(1)')
    },
    identityCapture: () => {
        const outer = id(0)
        const target = /** @type {const} */ ({ kind: 'function', index: 0 })
        const fn = /** @type {PreparedFunction} */ ({ target, parameters: [], rest: null, self: null,
            captures: [{ binding: outer, value: ['ref', outer] }],
            body: { statements: [], exit: ['return', target, ['ref', outer]] },
        })
        const source = stringify({ statements: [['define', outer, 42]], exit: ['yield', [['function', fn]]] }, 'expression')
        assert(source.includes('return ()=>$0;'))
    },
    exportsAndModes: () => {
        const binding = id(0)
        const block = { statements: [], exit: /** @type {const} */ (['yield', [3]]) }
        assertEq(stringify(block), 'export default 3;')
        assertEq(stringify(block, 'factory'), 'export default()=>{return 3;};')
        assertEq(stringify({ statements: [], exit: ['yield', []] }), '')
        assertEq(stringify({ statements: [], exit: ['throw', 3] }), 'throw 3;')
        const module = renderModule({
            statements: [['define', binding, ['array', [3]]]],
            exit: ['yield', [['object', [[':', 'default', ['ref', binding]], [':', 'value', ['ref', binding]]]]]],
        })
        assertEq(untagged(module), 'const $0=[3];export const value=$0;export default $0;')
        assertEq(untagged(renderModule(yielding(['object', [[':', 'a', 1]]]))), 'export const a=1;')
    },
    functionsAndScopes: () => {
        const target = { kind: /** @type {const} */ ('function'), index: 0 }
        const a = id(0)
        const rest = id(1)
        const self = id(2)
        const captured = id(3)
        const binding = id(4)
        /** @type {PreparedFunction} */
        const plain = { target, parameters: [a], rest: null, self: null, captures: [], body: { statements: [], exit: ['return', target, ['ref', a]] } }
        assertEq(functionStringify(plain), '($0)=>$0')
        assertEq(functionStringify({ ...plain, parameters: [], rest, body: { statements: [], exit: ['return', target, ['ref', rest]] } }), '(...$0)=>$0')
        assertEq(functionStringify({ ...plain, parameters: [], captures: [{ binding: captured, value: 1 }], body: { statements: [], exit: ['return', target, ['ref', captured]] } }), '()=>$0')
        assert(functionStringify({ ...plain, self, body: { statements: [], exit: ['return', target, ['ref', self]] } }).includes('function '))
        assert(functionStringify({ ...plain, body: { statements: [], exit: ['return', target, ['object', []]] } }).includes('return {}'))
        assert(functionStringify({ ...plain, body: { statements: [['define', captured, 1]], exit: ['return', target, ['ref', captured]] } }).includes('const '))
        const source = stringify({
            statements: [['define', binding, ['function', { ...plain, parameters: [], self, body: { statements: [], exit: ['return', target, ['ref', self]] } }]]],
            exit: ['yield', [['ref', binding]]],
        }, 'expression')
        assert(source.includes('const $0=()=>$0;'))
        const outer = id(5)
        /** @type {PreparedFunction} */
        const closure = { ...plain, parameters: [], captures: [{ binding: captured, value: ['ref', outer] }], body: { statements: [], exit: ['return', target, ['ref', captured]] } }
        /** @type {Block} */
        const captureBlock = { statements: [['define', outer, ['array', [1]]]], exit: ['yield', [['function', closure]]] }
        assert(stringify(captureBlock, 'expression').includes('()=>'))
        assertEq(stringify(captureBlock, 'expression', true), stringify(captureBlock, 'expression'))
        assertEq(expression(['()', ['function', plain], [3]]), '(($0)=>$0)(3)')
        const second = id(6)
        const secondCapture = id(7)
        /** @type {PreparedFunction} */
        const reordered = {
            ...plain, parameters: [],
            captures: [{ binding: captured, value: ['ref', outer] }, { binding: secondCapture, value: ['ref', second] }],
            body: { statements: [], exit: ['return', target, ['array', [['ref', secondCapture], ['ref', captured]]]] },
        }
        const reversed = stringify({ statements: [['define', outer, ['array', [1]]], ['define', second, ['array', [2]]]], exit: ['yield', [['function', reordered]]] }, 'expression')
        assert(reversed.includes('const $2=$0;const $3=$1;'))
        assertEq(functionStringify(reordered), '()=>[$1,$0]')
        assertEq(expression(['function', { ...plain, parameters: [], body: { statements: [['define', id(8), 0]], exit: ['return', target, ['block', yielding(3)]] } }]), '()=>{const $0=0;return 3;}')
    },
    runtimeCaptureWrappersRetainValuesAndRepeatedSlots: () => {
        const target = /** @type {const} */ ({ kind: 'function', index: 0 })
        const first = id(0), second = id(1), outer = id(2)
        /** @type {PreparedFunction} */
        const fn = { target, parameters: [], rest: null, self: null,
            captures: [{ binding: first, value: ['array', [7]] }],
            body: { statements: [], exit: ['return', target, ['ref', first]] },
        }
        assertEq(stringify(yielding(['function', fn]), 'expression', true), '(($0)=>(()=>$0))([7])')
        /** @type {PreparedFunction} */
        const repeated = { ...fn, captures: [{ binding: first, value: ['ref', outer] }, { binding: second, value: ['ref', outer] }],
            body: { statements: [], exit: ['return', target, ['array', [['ref', first], ['ref', second]]]] },
        }
        const block = /** @type {Block} */ ({ statements: [['define', outer, ['array', [7]]]], exit: ['yield', [['function', repeated]]] })
        assertEq(stringify(block, 'expression', true), '(()=>{const $0=[7];return (($1,$2)=>(()=>[$1,$2]))($0,$0);})()')
    },
    physicalControl: () => {
        const slot = id(0)
        const memo = id(1)
        const valueSlot = id(2)
        const doneSlot = id(3)
        const whileSlot = id(4)
        const whileResult = id(5)
        const target = { kind: /** @type {const} */ ('loop'), index: 0 }
        const scalar = { kind: /** @type {const} */ ('loop'), index: 1 }
        const unchangedSlot = id(6)
        const unchangedResult = id(7)
        const unchanged = { kind: /** @type {const} */ ('loop'), index: 2 }
        /** @type {Block} */
        const block = {
            statements: [
                ['slot', slot, 0, true],
                ['block', { statements: [], exit: ['yield', []] }],
                ['memo', { binding: memo, valueSlot, doneSlot, initializer: yielding(['array', [3]]) }],
                ['loop', target, {
                    statements: [['if', ['<', ['ref', slot], 2], { statements: [['write', slot, ['+', ['ref', slot], 1]]], exit: ['continue', target] }, { statements: [], exit: ['break', target] }]],
                    exit: ['continue', target],
                }],
                ['while', { target: scalar, slot: whileSlot, initial: 0, condition: ['<', ['ref', whileSlot], 2], body: { statements: [['write', whileSlot, ['+', ['ref', whileSlot], 1]]], exit: ['yield', []] }, result: whileResult, mutable: true }],
                // a loop writing its variable nowhere writes it back
                // unchanged, so that the source reads back as a loop
                ['while', { target: unchanged, slot: unchangedSlot, initial: 1, condition: false, body: { statements: [], exit: ['yield', []] }, result: unchangedResult, mutable: false }],
            ],
            exit: ['yield', [['array', [['ref', slot], ['demand', memo], ['ref', whileResult], ['ref', unchangedResult]]]]],
        }
        const text = stringify(block, 'expression', true)
        assert(text.includes('continue L0;'))
        assert(text.includes('break L0;'))
        assert(text.includes('while('))
        assert(text.includes('while(false){$5=$5;}'), text)
        assertEq(untagged(render(block, 'expression', true)), text)
    },
    sourceLoopTransfersHaveNoLabels: () => {
        const slot = id(0)
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        /** @type {Block} */
        const block = { statements: [['slot', slot, 0, true], ['loop', target, {
            statements: [['if', ['<', ['ref', slot], 2],
                { statements: [['write', slot, ['+', ['ref', slot], 1]]], exit: ['continue', target] },
                { statements: [], exit: ['break', target] },
            ]], exit: ['yield', []],
        }]], exit: ['yield', [['ref', slot]]] }
        assertEq(stringify(block, 'expression'), '(()=>{let $0=0;while(true){if($0<2){$0=$0+1;continue;}else{break;}}return $0;})()')
        assertEq(untagged(render(block, 'expression')), stringify(block, 'expression'))
    },
    terminalLoopExitsKeepTheirActualTail: () => {
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const local = id(0)
        /** @type {PreparedFunction} */
        const fn = { target: owner, parameters: [], rest: null, self: null, captures: [], body: {
            statements: [], exit: ['loop', target, {
                statements: [['define', local, 7]], exit: ['return', owner, ['ref', local]],
            }],
        } }
        assertEq(functionStringify(fn), '()=>{L0:while(true){const $0=7;return $0;}}')
        assertEq(expression(['function', fn]), '()=>{while(true){const $0=7;return $0;}}')
        const block = yielding(['function', fn])
        assertEq(untagged(render(block, 'expression', true)), stringify(block, 'expression', true))
        /** @type {Block} */
        const failing = { statements: [['define', local, 9]], exit: ['loop', target, {
            statements: [], exit: ['throw', ['ref', local]],
        }] }
        assertEq(stringify(failing), 'const $0=9;while(true){throw $0;}')
        assertEq(untagged(renderModule(failing)), stringify(failing))
        assertEq(stringify(failing, 'factory'), 'export default()=>{const $0=9;while(true){throw $0;}};')
        assertEq(stringify({ statements: [], exit: ['loop', target, { statements: [], exit: ['continue', target] }] }),
            'while(true){continue;}')
    },
    terminalLoopTargetsUseIdentity: () => {
        const outer = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {const} */ ({ kind: 'loop', index: 0 })
        /** @type {Block} */
        const block = { statements: [], exit: ['loop', outer, {
            statements: [], exit: ['loop', inner, { statements: [], exit: ['continue', outer] }],
        }] }
        assertEq(stringify(block, 'module', true), 'L0:while(true){L1:while(true){continue L0;}}')
    },
    // A statement or an exit no case names is refused, not written as
    // `undefined`.
    throw: {
        unknownStatement: () => render({ statements: [/** @type {never} */ (['bogus'])], exit: ['yield', []] }),
        unknownExit: () => render({ statements: [], exit: /** @type {never} */ (['bogus']) }),
    },
}
