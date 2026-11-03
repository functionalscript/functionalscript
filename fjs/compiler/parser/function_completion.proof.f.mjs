/** Syntax retains written bodies; FAST owns completion, terminality and dead work. */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { parse } from '../source/module.f.mjs'
import { _evaluate, tokenizeString } from './proof.f.mjs'
import { parseSyntax } from './syntax/module.f.mjs'
import { normalize } from '../../js/ast/sugar/module.f.mjs'
import { prepare } from '../../js/ast/prepare/module.f.mjs'
import { stringify } from '../../js/ast/serializer/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'

/** @type {(body: string, parameters?: string) => import('../../js/ast/types.ts').Function} */
const fastFunction = (body, parameters = 'a') => {
    const module = normalize(assertOk(parse('')(`export default (${parameters})=>{${body}};`)), [])
    assert(module.body.exit[0] === 'yield')
    const exports = module.body.exit[1][0]
    assert(exports instanceof Array && exports[0] === 'object')
    const entry = exports[1][0]
    assert(entry[0] === ':')
    const fn = entry[2]
    assert(fn instanceof Array && fn[0] === 'function')
    return fn[1]
}

export const proof = /** @type {const} */ ({
    normalFallthroughGetsUndefinedOnlyInFast: () => {
        const source = /** @type {const} */ ('export default ()=>{};')
        const ast = assertOk(parseSyntax(tokenizeString(source))).exported?.value
        assert(ast !== undefined && ast[0] === '=>' && ast[2][0] === 'block')
        assertEq(ast[2][1].length, 0)
        const fn = fastFunction('', '')
        assert(fn.body.exit[0] === 'return' && fn.body.exit[1] === fn.target)
        assertEq(fn.body.exit[2], undefined)
        assertEq(fastFunction('const x=[1];').body.exit[0], 'return')
        const partial = fastFunction('if(a){return 1;}')
        assert(partial.body.exit[0] === 'return')
        const value = partial.body.exit[2]
        assert(value instanceof Array && value[0] === 'if')
        assertStructurallySame(value[3].exit, ['yield', [undefined]])
    },
    allReturningBranchesAreTerminal: () => {
        const fn = fastFunction('if(a){return 1;}else{return 2;}const dead=null.x;')
        assert(fn.body.exit[0] === 'return' && fn.body.exit[1] === fn.target)
        const conditional = fn.body.exit[2]
        assert(conditional instanceof Array && conditional[0] === 'if')
        assertStructurallySame(conditional[2].exit, ['yield', [1]])
        assertStructurallySame(conditional[3].exit, ['yield', [2]])
        assertEq(fn.body.statements.length, 0)
        assertEq(fastFunction('if(a){if(a){return 1;}else{return 2;}}else{return 3;}').body.exit[0], 'return')
    },
    infiniteLoopsAreTerminalAndBreaksKeepFallthrough: () => {
        const fn = fastFunction('while(true){if(a){return true;}a=f(a);}const dead=null.x;', 'a,f')
        assertEq(fn.body.exit[0], 'loop')
        assertEq(fn.body.statements.length, 0)
        const loop = fn.body.exit
        assert(loop[0] === 'loop')
        assertEq(loop[1].results.length, 0)
        const breaks = fastFunction('while(true){if(a){break;}a=true;}')
        assertEq(breaks.body.exit[0], 'return')
        assertEq(fastFunction('while(false){}').body.exit[0], 'return')
        assertEq(fastFunction('for(;;){}').body.exit[0], 'loop')
        assertEq(fastFunction('for(const x of []){}').body.exit[0], 'return')
        assertEq(fastFunction('while(true){return 1;break;}').body.exit[0], 'loop')
    },
    unreachableAstSurvivesWhileFastDiscardsIt: () => {
        const source = /** @type {const} */ ('export default ()=>{return 7;const crash=null.x;};')
        const ast = assertOk(parseSyntax(tokenizeString(source))).exported?.value
        assert(ast !== undefined && ast[0] === '=>' && ast[2][0] === 'block')
        assertStructurallySame(ast[2][1].map(statement => statement[0]), ['return', 'const'])
        const fn = fastFunction('return 7;const crash=null.x;', '')
        assertEq(fn.body.statements.length, 0)
        assert(fn.body.exit[0] === 'return' && fn.body.exit[2] === 7)
        const module = normalize(assertOk(parse('')(source)), [])
        assertEq(stringify(prepare(module.body)), 'export default {"default":()=>7};')
    },
    terminalThrowsKeepTheirFailure: () => {
        for (const [source, expected] of /** @type {const} */ ([
            ['export default (()=>{if(true){throw 1;}else{throw 2;}})();', 1],
            ['const f=a=>{if(a){return 1;}else{throw 2;}};export default f(false);', 2],
            ['const f=a=>{if(a){throw 1;}else{throw 2;}};export default f(false);', 2],
            ['export default (()=>{while(true){throw 3;}const dead=null.x;})();', 3],
        ])) {
            const failure = assertError(memo(assertOk(analysis(unresolved(assertOk(parse('')(source))).edag)))({ args: [] }))
            assertEq(assertOk(toData(failure)), expected)
        }
    },
    evaluatedExamples: () => {
        for(const [source, expected] of /** @type {readonly (readonly [string, unknown])[]} */ ([
            ['export default (()=>{})();', undefined],
            ['const f=a=>{if(a){return 1;}else{return 2;}};export default [f(true),f(false)];', [1,2]],
            ['const run=(a,f)=>{while(true){if(a){return true;}a=f(a);}};export default run(false,a=>true);', true],
            ['export default (()=>{return 7;const crash=null.x;})();', 7],
            ['const f=a=>{if(a){return 1;}};export default [f(true),f(false)];', [1,undefined]],
        ])) { assertStructurallySame(assertOk(toData(_evaluate(assertOk(parse('')(source))))), { default: expected }, source) }
    },
})
