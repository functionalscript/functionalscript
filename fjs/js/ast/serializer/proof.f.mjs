/**
 * Prepared syntax retains operation grouping, lexical identities and token
 * marks. Evaluation and graph placement are tested at their own boundaries.
 *
 * @import { BindingId } from '../types.ts'
 * @import { Block, Function as PreparedFunction, Value } from '../prepare/types.ts'
 */

import { assert, assertEq } from '../../../asserts/module.f.js'
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

export const proof = {
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
            ['Number', '2'], ['String', 2], ['typeof', 2], ['~', 1], ['!', 1], ['-', 1], ['-', 3, 1],
            ['+', 1, ['*', 2, 3]], ['+', 1, ['+', 2, 3]], ['+', 1, ['+', 2]],
            ['**', ['**', 2, 3], 4], ['**', 2, ['**', 3, 2]],
            choice(false, false, 2), nullishValue, choice(true, 2, true),
            ['|', 1, 2], ['^', 1, 2], ['&', 1, 2], ['===', 1, 2], ['!==', 1, 2],
            ['<', 1, 2], ['<=', 1, 2], ['>', 1, 2], ['>=', 1, 2], ['instanceof', ['array', []], 'Array'],
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
        const text = stringify(block, 'expression')
        assert(text.includes('continue L0;'))
        assert(text.includes('break L0;'))
        assert(text.includes('while('))
        assert(text.includes('while(false){$5=$5;}'), text)
        assertEq(untagged(render(block, 'expression')), text)
    },
}
