/** Compound assignment through parsing, source desugaring and EDAG execution. */

import { assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { parse } from '../transpiler/module.f.mjs'
import { apply, compile, execute, value } from './proof.f.mjs'

/** @type {(source: string) => unknown} */
const run = source => execute(compile(source).edag)

export const proof = {
    eagerOperators: () => {
        /** @type {readonly (readonly [string, string, string, unknown])[]} */
        const cases = [
            ['+=', '7', '3', 10],
            ['-=', '7', '3', 4],
            ['*=', '7', '3', 21],
            ['/=', '7', '2', 3.5],
            ['%=', '7', '3', 1],
            ['**=', '2', '3', 8],
            ['<<=', '0x11', '2', 0x44],
            ['>>=', '-8', '1', -4],
            ['>>>=', '-1', '1', 0x7fff_ffff],
            ['&=', '0x35', '0x0f', 0x05],
            ['^=', '0x35', '0x0f', 0x3a],
            ['|=', '0x35', '0x0f', 0x3f],
            ['+=', '"first"', '"second"', 'firstsecond'],
            ['+=', '"first"', '2', 'first2'],
            ['<<=', '1', '33', 2],
            ['>>=', '-8', '33', -4],
            ['>>>=', '-1', '33', 0x7fff_ffff],
            ['**=', '2', '3 ** 2', 512],
            ['+=', '2', '3 * 4', 14],
        ]
        for (const [operator, initial, right, expected] of cases) {
            const source = `let a=${initial};a ${operator} ${right};export default a;`
            const expanded = `let a=${initial};a=a ${operator.slice(0, -1)} (${right});export default a;`
            assertStructurallySame(run(source), expected, source)
            assertStructurallySame(run(source), run(expanded), source)
        }
    },
    bigintOperators: () => {
        /** @type {readonly (readonly [string, bigint])[]} */
        const cases = [
            ['+=', 10n], ['-=', 6n], ['*=', 16n], ['/=', 4n], ['%=', 0n],
            ['**=', 64n], ['<<=', 32n], ['>>=', 2n],
            ['&=', 0n], ['^=', 10n], ['|=', 10n],
        ]
        for (const [operator, expected] of cases) {
            assertEq(run(`let a=8n;a ${operator} 2n;export default a;`), expected)
        }
        assertEq(run('let a=-8n;a >>= 1n;export default a;'), -4n)
        assertEq(run('let a=8n;a >>= -1n;export default a;'), 16n)
    },
    logicalValues: () => {
        /** @type {readonly (readonly [string, unknown, unknown, unknown])[]} */
        const cases = [
            ['false', false, 'rhs', false],
            ['0', 0, 'rhs', 0],
            ['-0', -0, 'rhs', -0],
            ['0n', 0n, 'rhs', 0n],
            ['""', '', 'rhs', ''],
            ['NaN', NaN, 'rhs', NaN],
            ['null', null, 'rhs', 'rhs'],
            ['undefined', undefined, 'rhs', 'rhs'],
            ['true', 'rhs', true, true],
            ['7', 'rhs', 7, 7],
            ['"text"', 'rhs', 'text', 'text'],
        ]
        for (const [initial, and, or, nullish] of cases) {
            assertStructurallySame(run(`let a=${initial};a &&= "rhs";export default a;`), and)
            assertStructurallySame(run(`let a=${initial};a ||= "rhs";export default a;`), or)
            assertStructurallySame(run(`let a=${initial};a ??= "rhs";export default a;`), nullish)
        }
        assertEq(run('let a=true;a &&= 7;export default a;'), 7)
        assertEq(run('let a=false;a ||= null;export default a;'), null)
        assertEq(run('let a=null;a ??= false;export default a;'), false)
    },
    logicalIdentityAndShortCircuit: () => {
        assertStructurallySame(run('const original=[];let a=original;a ||= [];a ??= [];export default [a===original,a];'), [true, []])
        assertEq(run('const original=[];let a=original;a &&= original;export default a===original;'), true)
        assertEq(run('let a=null;a ??= [];const saved=a;a ??= [];export default a===saved;'), true)
        /** @type {readonly string[]} */
        const skipped = [
            'let a=0;a &&= null.x;export default a;',
            'let a="kept";a ||= null.x;export default a;',
            'let a=false;a ??= null.x;export default a;',
        ]
        for (const source of skipped) { run(source) }
        /** @type {readonly string[]} */
        const reached = [
            'let a=1;a &&= null.x;export default 0;',
            'let a=0;a ||= null.x;export default 0;',
            'let a=null;a ??= null.x;export default 0;',
            'let a=1n;a += 1;export default a;',
            'let a=1;a *= 1n;export default a;',
            'let a=8n;a >>>= 1n;export default a;',
            'let a=8n;a /= 0n;export default a;',
        ]
        for (const source of reached) {
            assertError(memo(assertOk(analysis(compile(source).edag)))({ args: [] }))
        }
    },
    scopesAndCurrentValue: () => {
        assertEq(run('let a=8;a >>= a-7;export default a;'), 4)
        assertEq(run('let a=3;a += (()=>a)();export default a;'), 6)
        assertEq(apply(value(compile('export default a=>{a *= 3;return a;};').edag), [7]), 21)
        assertEq(apply(value(compile('export default a=>{if(a>0){a += 2;return a;}a -= 2;return a;};').edag), [3]), 5)
        assertEq(apply(value(compile('export default a=>{if(a>0){a += 2;return a;}a -= 2;return a;};').edag), [-3]), -5)
        assertStructurallySame(run('let i=0;let sum=0;let choice=null;while(i<4){sum += i;choice ??= i;i += 1;}export default [i,sum,choice];'), [4, 6, 0])
        assertStructurallySame(run('let i=0;let sum=0;while(i<3){if(i===1){sum += 10;}else{sum += 1;}i += 1;}export default [i,sum];'), [3, 12])
        assertEq(run('let a=1\na += 2\na *= 3\nexport default a'), 9)
        assertEq(run('let a=null;a ??= 2+3*4;export default a;'), 14)
    },
    sourceRefusals: () => {
        /** @type {readonly string[]} */
        const cases = [
            'const a=1;a += 2;export default a;',
            'const a=0;a &&= 2;export default a;',
            'import {a} from "./dep";a ||= 2;export default a;',
            'missing += 1;export default 0;',
            'a += 1;let a=0;export default a;',
            'let a=0;const held=()=>a;a += 1;export default held;',
            'let a=0;const held=()=>a;a &&= 1;export default held;',
            'let a=0;a &&= missing;export default a;',
            'let a=1;a ||= missing;export default a;',
            'let a=1;a ??= missing;export default a;',
            'let a={x:1};a.x += 1;export default a;',
            'let a=[1];a[0] ||= 2;export default a;',
            'let a=1;export default a += 1;',
            'let a=1;const b=(a += 1);export default b;',
            'let a=1;const f=x=>x;export default f(a += 1);',
            'let a=1;let b=2;a += b += 1;export default a;',
            'let a=1;a += 2 a += 3;export default a;',
        ]
        for (const source of cases) { assertError(parse('')(source)) }
    },
}
