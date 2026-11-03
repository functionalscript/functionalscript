/** Written source shapes survive the shared block grammar before FAST lowering. */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { toData } from '../../../edag/value/to_unknown/module.f.mjs'
import { parseFromTokens } from '../module.f.mjs'
import { _evaluate, tokenizeString } from '../proof.f.mjs'
import { parseSyntax } from './module.f.mjs'

export const proof = /** @type {const} */ ({
    importsKeepBindingsAttributesAndSourcePositions: () => {
        const module = assertOk(parseSyntax(tokenizeString('import first,{x as y,z} from "./a";\nimport {default as other} from "./b" with {type:"json"};\nimport {} from "./c";\nimport alone from "./d";export default first;')))
        assertStructurallySame(module.imports.map(statement => statement.module), ['./a','./b','./c','./d'])
        assertStructurallySame(module.imports.map(statement => statement.bindings.map(binding => binding.name)), [['default','x','z'],['default'],[],['default']])
        const alias = module.imports[0].bindings[1].local
        assertStructurallySame(alias.token, {kind:'id',value:'y'})
        assertEq(alias.metadata.column, 20)
        assertEq(module.imports[1].start.metadata.line, 2)
        assert(module.imports[1].attribute !== null)
        assertStructurallySame(module.imports[1].attribute[1].token, {kind:'string',value:'json'})
        assertEq(module.imports[2].attribute, null)
    },
    importNamesAndSyntaxFailuresKeepTheirOriginalTokens: () => {
        const module = assertOk(parseSyntax(tokenizeString('import {true as t,false as f,null as n,undefined as u,NaN as nan,Infinity as inf} from "./values";export default 0;')))
        assertStructurallySame(module.imports[0].bindings.map(binding => binding.name), ['true','false','null','undefined','NaN','Infinity'])
        for (const [source, message] of [
            ['export default ;','unexpected token'],
            ['export default','unexpected end'],
        ]) {
            const result = parseSyntax(tokenizeString(source))
            assert(result[0] === 'error')
            assertEq(result[1].message, message)
        }
        const trailing = assertOk(parseSyntax(tokenizeString('export default (1,);'))).exported?.value
        assert(trailing !== undefined && trailing[0] === ',' && trailing[2] !== null)
        assertEq(trailing[2].metadata.column, 19)
        const arrow = assertOk(parseSyntax(tokenizeString('export default (a)\n=>a;'))).exported?.value
        assert(arrow !== undefined && arrow[0] === '=>' && 'arrow' in arrow[1])
        assertEq(arrow[1].arrow.metadata.line, 2)
        const operators = assertOk(parseSyntax(tokenizeString('export default [{} instanceof Array,"x" in {x:1}];'))).exported?.value
        assert(operators !== undefined && operators[0] === 'array')
        const first = operators[1][0]
        const second = operators[1][1]
        assert(first[0] === 'instanceof' && second[0] === 'in')
        assertStructurallySame(first[3].token, {kind:'id',value:'instanceof'})
        assertStructurallySame(second[3].token, {kind:'id',value:'in'})
    },
    declarationGroupsRemainOneWrittenStatement: () => {
        const module = assertOk(parseSyntax(tokenizeString('export const first=[1],second=first;export const third=second;')))
        assertEq(module.statements.length, 2)
        const first = module.statements[0]
        assert(first[0] === 'const')
        assertEq(first[1].exported, true)
        assertEq(first[1].declaration.following?.length, 1)
        assertEq(first[1].declaration.following?.[0].start.metadata.column, 23)
    },
    expressionsKeepTheirMeaningAcrossBlockReaders: () => {
        for (const [source, expected] of /** @type {readonly (readonly [string, unknown])[]} */ ([
            ['export default [typeof (1+2),~(1<<2),-((2+3)),!~-(1)];', ['number',-5,-5,true]],
            ['export default [(1+2)&&3,1||2&&3,null??(false||4),1===2?3:4];', [3,1,4,4]],
            ['export default (1,2);', 2],
            ['export default ((a,)=>a)(1);', 1],
            ['export default ((a=1,)=>a)();', 1],
            ['export default ((a,b=2)=>b)(1);', 2],
            ['export default [{} instanceof Array];', [false]],
            ['const f=()=>3;f();export default 0;', 0],
            ['export default (()=>{{const x=1;}return 0;})();', 0],
            ['const obj={x:3};export default obj?.["x"];', 3],
            ['const f=()=>()=>({x:3});export default f?.()().x;', 3],
            ['const obj={x:()=>({y:3})};export default (obj?.x)()?.y;', 3],
            ['const f=()=>()=>3;export default (f?.())();', 3],
            ['const obj={x:()=>({y:()=>3})};export default obj.x?.().y?.();', 3],
            ['const obj={x:()=>({y:3})};export default obj.x?.().y;', 3],
            ['const obj={x:()=>()=>3};export default obj.x?.()();', 3],
            ['const obj={x:()=>null};export default obj.x?.()?.y;', undefined],
            ['const obj={x:{y:3}};export default (obj?.x).y;', 3],
            ['const obj={x:()=>3};export default (obj?.x)();', 3],
            ['const obj={x:()=>3};export default (obj?.x)?.();', 3],
            ['const obj={x:()=>3};export default (obj.x)();', 3],
            ['const obj={x:()=>({y:()=>3})};export default obj.x?.().y?.().value;', undefined],
        ])) {
            const ast = assertOk(parseSyntax(tokenizeString(source)))
            assert(ast.exported !== null)
            assertStructurallySame(assertOk(toData(_evaluate(assertOk(parseFromTokens(tokenizeString(source)))))), {default:expected}, source)
        }
    },
})
