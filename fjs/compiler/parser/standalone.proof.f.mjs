/**
 * Lexical braces survive syntax parsing and disappear after name resolution.
 * @import { SourceFunction } from '../../js/ast/sugar/source.ts'
 */
import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { parse } from '../source/module.f.mjs'
import { parseSyntax } from './syntax/module.f.mjs'
import { tokenizeString, _evaluate } from './proof.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { normalize } from '../../js/ast/sugar/module.f.mjs'
import { prepare } from '../../js/ast/prepare/module.f.mjs'
import { stringify } from '../../js/ast/serializer/module.f.mjs'

/** @type {(source: string) => SourceFunction} */
export const _function = source => {
    const module = assertOk(parse('')(source))
    assert(module.body.exit[0] === 'yield')
    const exports = module.body.exit[1]
    assert(exports instanceof Array && exports[0] === 'object')
    const entry = exports[1][0]
    assert(entry[0] === ':')
    const value = entry[2]
    assert(value instanceof Array && value[0] === 'function')
    return value[1]
}

/** @type {(source: string, expected: unknown) => void} */
const evaluates = (source, expected) => assertStructurallySame(assertOk(toData(_evaluate(assertOk(parse('')(source))))), { default: expected })

export const proof = {
    syntax: () => {
        const module = assertOk(parseSyntax(tokenizeString('{const x=1;{const x=2;}}export default 0;')))
        const block = module.statements[0]
        assert(block[0] === 'block')
        assertEq(block[1].start.token.kind, '{')
        assertEq(block[1].block[1][1][0], 'block')
        const fn = _function('export default ()=>{{}{}return {};};')
        assertEq(fn.body.statements.length, 0)
    },
    moduleBindings: () => {
        evaluates('const x=[1];let y=[];{const x=[2];y=x;}export default [x,y];', [[1], [2]])
        evaluates('let x=1;let y=0;{let x=2;x=x+1;y=x;}{const x=4;y=y+x;}export default [x,y];', [1, 7])
        evaluates('let f=()=>0;{const x=7;f=()=>x;}export default f();', 7)
        evaluates('{}{const x=1;}const x=2;export default x;', 2)
    },
    functionBindings: () => {
        evaluates('export default (()=>{const x=[1];let y=[];{const x=[2];{const x=[3];y=x;}y=[x,y];}return [x,y];})();', [[1], [[2], [3]]])
        evaluates('export default (()=>{let x=1;{x=2;}return x;})();', 2)
    },
    loopTransfers: () => {
        evaluates('export default (()=>{let i=0;let n=0;while(i<4){{i=i+1;if(i===1){continue;}if(i===3){break;}n=n+i;}}return n;})();', 2)
        evaluates('let n=0;{while(n<2){n=n+1;}}{for(let i=0;i<2;i=i+1){n=n+1;}}{for(const x of [1,2]){n=n+x;}}export default n;', 7)
        evaluates('export default (()=>{let n=0;while(n<2){switch(n){case 0:{{n=n+1;break;}}default:{{n=n+1;break;}}}}return n;})();', 2)
    },
    flatFastAndFreshNames: () => {
        const resolved = assertOk(parse('')('const x=[1];{const x=[2];}{const x=[3];}export default x;'))
        const origins = resolved.origins.filter(origin => origin.name === 'x')
        assertEq(origins.length, 3)
        assert(origins[0].id !== origins[1].id && origins[1].id !== origins[2].id && origins[0].id !== origins[2].id)
        const fast = normalize(resolved, [])
        assertEq(fast.body.statements.length, 3)
        const [a,b,c] = fast.body.statements
        assert(a[0] === 'define' && b[0] === 'define' && c[0] === 'define')
        assert(a[1] !== b[1] && b[1] !== c[1] && a[1] !== c[1])
        const text = stringify(prepare(fast.body))
        assert(text.includes('const $0=[1]') && text.includes('const $1=[2]') && text.includes('const $2=[3]'))
        assert(!text.includes('()=>'))
    },
    terminalTransfers: () => {
        const fn = _function('export default ()=>{{return 7;}return 8;};')
        const statement = fn.body.statements[0]
        assert(statement[0] === 'return' && statement[1] === fn.target)
        const resolved = assertOk(parse('')('export default ()=>{{return 7;}return 8;};'))
        assertEq(stringify(prepare(normalize(resolved, []).body)), 'export default {"default":()=>7};')
        const thrown = assertOk(parse('')('{throw 3;}export default 0;'))
        assertEq(thrown.body.statements[0][0], 'throw')
        const nested = _function('export default ()=>{{if(true){return 1;}else{return 2;}}return 3;};')
        assertEq(nested.body.statements[0][0], 'if')
    },
    deepScopes: () => {
        const braces = '{'.repeat(5000)
        const ends = '}'.repeat(5000)
        for (const source of [
            `${braces}${ends}export default 0;`,
            `export default ()=>{${braces}${ends}return 0;};`,
            `export default ()=>{while(false){${braces}${ends}}return 0;};`,
        ]) { assertOk(parse('')(source)) }
    },
    admission: () => {
        for (const [source, message] of [
            ['{const x=1;const x=2;}export default 0;', 'duplicate id'],
            ['const x=1;{const x=x;}export default x;', 'capture shadowed'],
            ['{const x=1;}export default x;', 'const not found'],
            ['{return 1;}export default 0;', 'unexpected token'],
        ]) {
            const result = parse('')(source)
            assert(result[0] === 'error')
            assertEq(result[1].message, message)
        }
        for (const source of [
            '{export default 1;}export default 0;', '{import x from "x";}export default 0;',
            '{var x=1;}export default 0;', '{};export default 0;',
            'export default ()=>{{return 1;}};', 'const x=1{}export default x;',
        ]) { assert(parse('')(source)[0] === 'error', source) }
    },
}
