/**
 * Boolean conversion syntax, reserved names and operand admission, split from
 * `proof.f.mjs` so the website can read each proof within its whole-file limit.
 *
 * @import { Exp } from '../../edag/types.ts'
 */

import { expectModule, expectRefused } from './proof.f.mjs'
import { _stringifyTree } from '../module.f.mjs'

export const proof = /** @type {const} */ ({
    booleanConversion: {
        read: () => {
            /** @type {readonly (readonly [string, Exp])[]} */
            const cases = [
                ['Boolean(0)', ['Boolean', 0]],
                ['(Boolean)(1)', ['Boolean', 1]],
                ['Boolean\n(1)', ['Boolean', 1]],
                ['Boolean(1,)', ['Boolean', 1]],
                ['Boolean(Boolean(0))', ['Boolean', ['Boolean', 0]]],
                ['Boolean(undefined)', ['Boolean', ['undefined']]],
                ['Boolean(1).x', ['.', ['Boolean', 1], 'x']],
                ['Boolean(1)(2)', ['()', ['Boolean', 1], [2]]],
                ['!Boolean(1)', ['!', ['Boolean', 1]]],
                ['(...a) => Boolean(a[0])', ['=>', 0, [], ['Boolean', ['.', ['rest'], 0]]]],
            ]
            for (const [source, value] of cases) {
                expectModule(`export default ${source};`, _stringifyTree(['{}', [[':', 'default', value]]]))
            }
        },
        empty: () => {
            expectModule('export default Boolean();', _stringifyTree(['{}', [[':', 'default', ['Boolean', ['undefined']]]]]))
            expectModule('export default !Boolean();', _stringifyTree(['{}', [[':', 'default', ['!', ['Boolean', ['undefined']]]]]]))
        },
        reserved: () => {
            /** @type {readonly (readonly [string, number])[]} */
            const cases = [
                ['const Boolean = 1; export default 2;', 7],
                ['export const Boolean = 1;', 14],
                ['export default (Boolean) => 1;', 17],
                ['export default (...Boolean) => 1;', 20],
                ['import Boolean from "./m.f.js"; export default 1;', 8],
                ['import { Boolean } from "./m.f.js"; export default 1;', 10],
                ['import { a as Boolean } from "./m.f.js"; export default 1;', 15],
                ['export default () => { const Boolean = 1; return 2; };', 30],
                ['export default Boolean;', 16],
                ['const convert = Boolean; export default convert;', 17],
                ['export default [Boolean];', 17],
                ['export default { Boolean };', 18],
                ['export default Boolean.prototype;', 16],
                ['export default Boolean?.(1);', 16],
            ]
            for (const [source, column] of cases) { expectRefused(source, 'reserved word', column) }
        },
        arity: () => {
            for (const source of /** @type {const} */ (['Boolean(1, 2)', 'Boolean(...[1])', 'Boolean(...[])'])) {
                expectRefused(`export default ${source};`, 'Boolean takes one argument', 16)
            }
        },
        key: () => {
            expectModule('export default { Boolean: 1 }.Boolean;', _stringifyTree(['{}', [[':', 'default', ['.', ['{}', [[':', 'Boolean', 1]]], 'Boolean']]]]))
            expectModule('export default { Boolean: 1 }["Boolean"];', _stringifyTree(['{}', [[':', 'default', ['.', ['{}', [[':', 'Boolean', 1]]], 'Boolean']]]]))
        },
        indexRefused: () => {
            expectRefused('export default [1][Boolean(0)];', 'computed key is not Number(...)', 20)
            expectRefused('export default [1][Boolean()];', 'computed key is not Number(...)', 20)
        },
        operandRefused: () => {
            expectRefused('export default Boolean(missing);', 'const not found', 24)
        },
    },
})
