/**
 * @import { Exp } from '../../../edag/types.ts'
 * @import { Function as FastFunction } from '../types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { parse } from '../../../compiler/source/module.f.mjs'
import { fromFast } from '../../../edag/from_fast/module.f.mjs'
import { analysis } from '../../../edag/analysis/module.f.mjs'
import { memo } from '../../../edag/memo/module.f.mjs'
import { toData } from '../../../edag/value/to_unknown/module.f.mjs'
import { normalize } from './module.f.mjs'

/** @type {(source: string) => Exp} */
const graph = source => fromFast(normalize(assertOk(parse('')(source)), []).body)

/** Evaluate represented data through the EDAG interpreter. @param {string} source */
const result = source => assertOk(toData(assertOk(memo(assertOk(analysis(graph(source))))({ args: [] }))))

/** The function directly exported by the source fixture. @type {(source: string) => FastFunction} */
const fn = source => {
    const block = normalize(assertOk(parse('')(source)), []).body
    assert(block.exit[0] === 'yield')
    const object = block.exit[1][0]
    assert(object instanceof Array && object[0] === 'object')
    const member = object[1][0]
    assert(member[0] === ':')
    const value = member[2]
    assert(value instanceof Array && value[0] === 'function')
    return value[1]
}

export const proof = {
    identities: () => {
        const ast = assertOk(parse('')('const a = [1]; const b = a; export default [a, b];'))
        const fast = normalize(ast, [])
        const graph = /** @type {readonly ['{}', readonly (readonly [':', string, readonly ['[]', readonly unknown[]]])[]]} */ (fromFast(fast.body))
        const pair = graph[1][0][2][1]
        assert(pair[0] === pair[1])
        assertEq(fast.body.statements.length, 1)
    },
    blocks: () => {
        const ast = assertOk(parse('')('export default (() => { const x = [1]; return [x, x]; })();'))
        const fast = normalize(ast, [])
        assertStructurallySame(fromFast(fast.body), ['{}', [[':', 'default', ['[]', [['[]', [1]], ['[]', [1]]]]]]])
        const fn = normalize(assertOk(parse('')('export default a => { const b = a; return () => [a, b]; };')), [])
        assertStructurallySame(fromFast(fn.body), ['{}', [[':', 'default', ['=>', 1, [], ['=>', 0, [['arg', 0]], ['[]', [['frame', 0], ['frame', 0]]]]]]]])
    },
    imports: () => {
        const ast = assertOk(parse('')('import a from "./a"; import b from "./a"; export default a;'))
        const imported = ['same']
        const fast = normalize(ast, [imported, imported])
        assertStructurallySame(fromFast(fast.body, fast.parameters.map(id => [id, 1])), ['{}', [[':', 'default', 1]]])
    },
    throwing: () => {
        const ast = assertOk(parse('')('export default () => { throw 4; };'))
        assertStructurallySame(fromFast(normalize(ast, []).body), ['{}', [[':', 'default', ['=>', 0, [], ['throw', 4]]]]])
    },
    primitiveCapture: () => {
        assertStructurallySame(graph('const value=null; export default (()=>value)();'), ['{}', [[':', 'default', null]]])
        assertStructurallySame(result('const value=null; export default (()=>()=>value)()();'), { default: null })
    },
    parameters: () => {
        const expanded = fn('export default (first,{value},late=null,...rest)=>[first,value,late,rest];')
        assertEq(expanded.parameters.length, 2)
        assert(expanded.rest !== null)
        const raw = expanded.body.statements.find(statement => statement[0] === 'define' && statement[2] instanceof Array && statement[2][0] === '.' && statement[2][2] === 0)
        assert(raw !== undefined && raw[0] === 'define')
        const selected = expanded.body.statements.find(statement => statement[0] === 'define' && statement[2] instanceof Array && statement[2][0] === '?:')
        assert(selected !== undefined && selected[0] === 'define' && selected[2] instanceof Array && selected[2][0] === '?:')
        const test = selected[2][1]
        const otherwise = selected[2][3]
        assert(test instanceof Array && test[0] === '===' && test[1] instanceof Array && test[1][0] === 'ref')
        assert(otherwise instanceof Array && otherwise[0] === 'ref')
        assertEq(test[1][1], raw[1])
        assertEq(otherwise[1], raw[1])
        assertStructurallySame(result('export default ((first,{value},late=null,...rest)=>[first,value,late,rest.length])(3,{value:4},undefined,5,6);'), { default: [3, 4, null, 2] })
        assertStructurallySame(result('export default ((a=2,b,...rest)=>[a,b,rest])(undefined,3,4);'), { default: [2, 3, [4]] })
        assertStructurallySame(result('export default (([first],{value},...rest)=>[first,value,rest.length])([3],{value:3},4);'), { default: [3, 3, 1] })
        assertStructurallySame(graph('const {is}=Object; export default ()=>is;'), ['{}', [[':', 'default', ['=>', 0, [['Object.is']], ['frame', 0]]]]])
        assertEq(fn('export default (...unused)=>1;').rest, null)
        assertStructurallySame(result('export default ((...unused)=>1)();'), { default: 1 })
        assertStructurallySame(result('export default ((...used)=>used.length)();'), { default: 0 })
        assertStructurallySame(result('export default (a=>a)();'), { default: undefined })
    },
    capturedSourceDeclarations: () => {
        const nested = fn('export default value=>()=>()=>value;')
        assertEq(nested.captures.length, 0)
        assertEq(nested.body.exit[0], 'return')
        assertStructurallySame(result('export default (value=>()=>()=>value)(9)()();'), { default: 9 })
        assertStructurallySame(result('const outside=2; export default (()=>{const unused=outside; return 3;})();'), { default: 3 })
        const pruned = fn('const outside=2; export default ()=>{const unused=outside; return 3;};')
        assertEq(pruned.captures.length, 0)
        assertStructurallySame(result('const self=n=>n?self(n-1):7; export default self(3);'), { default: 7 })
        assertStructurallySame(result('const self=n=>n?(()=>self)(n-1)(n-1):7; export default self(2);'), { default: 7 })
    },
    directRegions: () => {
        const guarded = fn('export default value=>{if(value){const answer=value+1; return answer;} const answer=value+2; return answer;};')
        assertEq(guarded.captures.length, 0)
        assert(guarded.body.exit[0] === 'return')
        const branch = guarded.body.exit[2]
        assert(branch instanceof Array && branch[0] === 'if')
        assertEq(branch[2].exit[0], 'yield')
        assertEq(branch[3].exit[0], 'yield')
        assertStructurallySame(result('export default (value=>{if(value){return value+1;} return value+2;})(2);'), { default: 3 })
        assertStructurallySame(result('export default (value=>{switch(value){case 1:case 2:{return "low";}case 3:{throw 3;}default:{const answer="other";return answer;}}})(4);'), { default: 'other' })
        assertStructurallySame(result('export default (()=>{switch(2){case 1:{const answer=3;return answer;}default:{const answer=4;return answer;}}})();'), { default: 4 })
    },
    scalarAssignments: () => {
        const source = 'export default start=>{let value=start;while(value<3){const snapshot=value;const read=()=>snapshot;value=read()+1;}return value;};'
        const resolved = assertOk(parse('')(source))
        const variable = resolved.origins.find(origin => origin.kind === 'let')
        assert(variable !== undefined)
        assert(resolved.bindings.some(fact => fact.id === variable.id && fact.isMutable))
        const normalized = fn(source)
        const statement = normalized.body.statements[0]
        assert(statement[0] === 'loop')
        const loop = statement[1]
        assert(loop.parameters[0] !== variable.id && loop.results[0] !== variable.id && loop.parameters[0] !== loop.results[0])
        assertStructurallySame(result('export default (start=>{let value=start;while(value<3){const snapshot=value;const read=()=>snapshot;value=read()+1;}return value;})(0);'), { default: 3 })
        assertStructurallySame(result('export default (()=>{let value=0;while(value<3){const observed=(()=>value)();value=observed+1;}return value;})();'), { default: 3 })
        assertStructurallySame(result('export default (()=>{let value=0;while(value<2){value=value+1;}const snapshot=value;return ()=>snapshot;})()();'), { default: 2 })
        assertStructurallySame(result('export default (()=>{let value=1;while(false){value=value;}return value;})();'), { default: 1 })
        assertError(memo(assertOk(analysis(graph('export default (()=>{let value=null.x;while(false){value=1;}return value;})();'))))({ args: [] }))
        assertError(memo(assertOk(analysis(graph('export default (()=>{let value=0;while(value<1){const required=null.x;value=1;}return value;})();'))))({ args: [] }))
    },
    discardedCommas: () => {
        assertStructurallySame(graph('const value=[]; const alias=value; export default (alias,value.length);'), ['{}', [[':', 'default', ['.', ['[]', []], 'length']]]])
        assertStructurallySame(graph('export default (...args)=>(1,args,()=>1,Object.is,((s,a,b)=>s.slice(a,b)),args[0]);'), ['{}', [[':', 'default', ['=>', 0, [], ['.', ['rest'], 0]]]]])
        assertStructurallySame(result('export default ((...args)=>((args.x,()=>1),2))();'), { default: 2 })
    },
    explicitSourceRegion: () => {
        const resolved = assertOk(parse('')('const value=[1]; export default [value,value];'))
        const fast = normalize({ ...resolved, body: { statements: [], exit: ['yield', ['block', resolved.body]] } }, [])
        assertStructurallySame(fromFast(fast.body), graph('const value=[1]; export default [value,value];'))
    },
    importEvaluation: () => {
        const resolved = assertOk(parse('')('import {} from "./dependency"; export default 1;'))
        const fast = normalize(resolved, [2])
        assertStructurallySame(fromFast(fast.body, [[fast.parameters[0], 2]]), [',', [2, ['{}', [[':', 'default', 1]]]]])
        const numbers = assertOk(parse('')('import a from "./a";import b from "./b";import c from "./c";export default [a,b,c];'))
        const values = [NaN, -0, 0]
        const normalized = normalize(numbers, values)
        assertStructurallySame(fromFast(normalized.body, normalized.parameters.map((id, index) => [id, values[index]])), ['{}', [[':', 'default', ['[]', values]]]])
    },
}
