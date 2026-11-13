/**
 * Admitted invocation loops keep while statements; one-pass roots can recover
 * nonrecursive source. Unsupported potential backedges retain explicit refusals.
 *
 * @import { Block, Function as FastFunction, Loop, Statement, Value } from '../../../../js/ast/types.ts'
 * @import { Exp } from '../../../types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../../asserts/module.f.js'
import { parse } from '../../../../compiler/transpiler/module.f.mjs'
import { _defaultExport, unresolved } from '../../../../compiler/edag/module.f.mjs'
import { tryStringify } from '../../../../compiler/serializer/module.f.mjs'
import { fromAnalysis, toFast } from '../../module.f.mjs'
import { fromFast } from '../../../from_fast/module.f.mjs'
import { identityAnalysis } from '../../../analysis/module.f.mjs'
import { evaluate, failure } from '../../../from_fast/member_returns/proof.f.mjs'
import { _tailFunction } from '../../tail_calls/proof.f.mjs'
import { _sourceLoops } from './module.f.mjs'
import { _valueReturnFunction as valueReturnFunction } from './fixtures.f.js'

/** @type {(source: string) => Exp} */
export const _sourceGraph = source => _defaultExport(unresolved(assertOk(parse('/tail.f.js')(source))).edag)

const graph = _sourceGraph

/** @type {(value: Value) => Block} */
const yielded = value => ({ statements: [], exit: ['yield', [value]] })

const counter = /** @type {Exp} */ (['=>', 2, [], ['?:', ['>', ['arg', 0], 0], ['()', ['self'], [['-', ['arg', 0], 1], ['+', ['arg', 1], 1]]], ['arg', 1]]])

const lazyBinding = /** @type {const} */ ({ index: 1_000 })

/** A lazy allocation demanded by both the terminal test and repeated result. @returns {FastFunction} */
const lazyPrefixFunction = () => {
    const fn = _tailFunction(counter)
    const statement = fn.body.statements.at(-1)
    assert(statement !== undefined && statement[0] === 'loop')
    const terminal = statement[1].body.statements.at(-1)
    assert(terminal !== undefined && terminal[0] === 'if')
    /** @type {Block} */
    const normal = { ...terminal[4], exit: ['break', statement[1].target, [['array', [['ref', lazyBinding], ['ref', lazyBinding]]]]] }
    return { ...fn, body: { ...fn.body,
        statements: [...fn.body.statements.slice(0, -1), ['loop', { ...statement[1], body: { ...statement[1].body,
            statements: [['define', lazyBinding, ['array', [['ref', statement[1].parameters[0]]]], 'lazy'],
                ...statement[1].body.statements.slice(0, -1), ['if', terminal[1], ['>', ['.', ['ref', lazyBinding], 0], 0], terminal[3], normal]],
        } }]],
    } }
}

export const proof = /** @type {const} */ ({
    explicitThrowRootsKeepFirstParseFixedPoints: () => {
        for (const source of /** @type {const} */ ([
            'const f=(n,a)=>{if(n===0){throw a;}return f(n-1,a+1);};export default f;',
            'const f=(n,a)=>{if(n!==0){return f(n-1,a+1);}throw a;};export default f;',
            'const f=(n,a)=>{const pair=[n,a];const read=()=>pair;if(read()[0]===0){throw pair;}return f(n-1,pair[1]+1);};export default f;',
            'const f=(n,...xs)=>{if(n===0){throw xs;}return f(n-1,...xs);};export default f;',
            'const f=(n,...xs)=>{if(n!==0){return f(n-1,...xs);}throw xs;};export default f;',
            'const f=(...xs)=>{if(xs[0]===0){throw xs;}return f(xs[0]-1,...xs.slice(1));};export default f;',
            'const f=(...xs)=>{if(xs[0]!==0){return f(xs[0]-1,...xs.slice(1));}throw xs;};export default f;',
            'const f=(n,a)=>{if(n===0){throw a;}return n<0?a:f(n-1,a+1);};export default f;',
            'const f=(n,...xs)=>{if(n===0){throw xs;}return n<0?xs:f(n-1,...xs);};export default f;',
            'const f=(...xs)=>{if(xs[0]===0){throw xs;}return xs[0]<0?xs:f(xs[0]-1,...xs.slice(1));};export default f;',
            'export default test=>{const f=()=>{if(test()===0){throw 7;}return test()===1?0:f();};return f;};',
            'export default test=>{const f=()=>{if(test()!==0){return test()===1?0:f();}throw 7;};return f;};',
        ])) {
            const original = graph(source)
            const output = assertOk(tryStringify(original))
            assert(output.includes('while('), output)
            assert(output.includes('throw '), output)
            const normalized = graph(output)
            const canonical = assertOk(tryStringify(normalized))
            const logical = fromFast(assertOk(toFast(original)))
            assertStructurallySame(assertOk(identityAnalysis(fromFast(assertOk(toFast(logical))))), assertOk(identityAnalysis(logical)), source)
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
    },
    explicitThrowRootsKeepReachedFailuresAndNormalResults: () => {
        for (const source of /** @type {const} */ ([
            'const f=(n,a)=>{if(n===0){throw a;}return f(n-1,a+1);};export default f(3,7);',
            'const f=(n,a)=>{if(n!==0){return f(n-1,a+1);}throw a;};export default f(3,7);',
            'const f=(n,...xs)=>{if(n===0){throw xs;}return f(n-1,...xs);};export default f(3,7,9);',
            'const f=(...xs)=>{if(xs[0]===0){throw xs;}return f(xs[0]-1,...xs.slice(1));};export default f(3,7,9);',
            'const f=(n,a)=>{const required=null.prefix;if(n===0){throw a;}return f(n-1,a);};export default f(3,7);',
            'const f=(n,a)=>{if(null.condition){throw a;}return f(n-1,a);};export default f(3,7);',
            'const f=(n,a)=>{if(n===0){throw null.payload;}return f(n-1,a);};export default f(3,7);',
            'const f=(n,a)=>{if(n===0){throw a;}return f(n-1,a,null.ignored);};export default f(3,7);',
            'const f=(n,a)=>{if(n===0){throw a;}return f(n-1,a,...null);};export default f(3,7);',
        ])) {
            const original = graph(source)
            const expected = failure(original)
            const output = assertOk(tryStringify(original))
            assert(output.includes('while('), output)
            const normalized = graph(output)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(failure(current), expected, source)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
        for (const [source, expected] of /** @type {const} */ ([
            ['const f=(n,a)=>{if(n===0){throw a;}return n<0?a:f(n-1,a+1);};export default f(-1,7);', 7],
            ['const f=(n,...xs)=>{if(n===0){throw xs;}return n<0?xs[0]:f(n-1,...xs);};export default f(-1,7);', 7],
            ['const f=(...xs)=>{if(xs[0]===0){throw xs;}return xs[0]<0?xs[1]:f(xs[0]-1,...xs.slice(1));};export default f(-1,7);', 7],
            ['const make=test=>{const f=()=>{if(test()===0){throw 7;}return test()===1?0:f();};return f;};export default make(()=>1)();', 0],
        ])) {
            const original = graph(source)
            const output = assertOk(tryStringify(original))
            assert(output.includes('while('), output)
            assertEq(evaluate(original), expected)
            assertEq(evaluate(graph(output)), expected)
        }
    },
    continuingOnlyRootsKeepFirstParseFixedPoints: () => {
        for (const source of /** @type {const} */ ([
            'const f=(a,b)=>f(b,a);export default f;',
            'const f=(a,b)=>a>0?f(b,a):f(b+1,a);export default f;',
            'const f=(n,a,b)=>{const pair=[n,a,b];const read=()=>[pair,f];return read()[0][0]>0?f(n+1,b,a):f(n+1,a,b);};export default f;',
            'const f=(a,...xs)=>f(xs[0],a);export default f;',
            'const f=(a,...xs)=>a>0?f(xs[0],a):f(xs[0]+1,a);export default f;',
            'const f=(...xs)=>f(xs[1],xs[0]);export default f;',
            'const f=(...xs)=>xs[0]>0?f(xs[1],xs[0]):f(xs[1]+1,xs[0]);export default f;',
            'const f=(a,...xs)=>{const read=()=>xs;return f(a,...read());};export default f;',
            'const f=(...xs)=>{const read=()=>xs;return f(...read());};export default f;',
        ])) {
            const original = graph(source)
            const output = assertOk(tryStringify(original))
            assert(output.includes('while('), output)
            const normalized = graph(output)
            const canonical = assertOk(tryStringify(normalized))
            const logical = fromFast(assertOk(toFast(original)))
            assertStructurallySame(assertOk(identityAnalysis(fromFast(assertOk(toFast(logical))))), assertOk(identityAnalysis(logical)), source)
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
    },
    continuingOnlyRootsKeepFiniteFailuresAndArgumentOrder: () => {
        const stop = /** @type {const} */ ('const stop=n=>{if(n===0){throw 7;}return n;};')
        for (const source of [
            `${stop}const f=(n,a,b)=>{const pair=[n,a,b];const read=()=>pair;stop(read()[0]);return n%2===0?f(n-1,b,a):f(n-1,a,b);};export default f(3,7,9);`,
            `${stop}const f=(n,...xs)=>{const pair=[n,xs];const read=()=>pair;stop(read()[0]);return n%2===0?f(n-1,xs[1],xs[0]):f(n-1,...xs);};export default f(3,7,9);`,
            `${stop}const f=(...xs)=>{const pair=[xs];const read=()=>pair;stop(read()[0][0]);return xs[0]%2===0?f(xs[0]-1,xs[2],xs[1]):f(xs[0]-1,...xs.slice(1));};export default f(3,7,9);`,
            'const f=(a,b)=>f(b,a,null.extra);export default f(7,9);',
            'const f=(a,b)=>f(b,a,...null);export default f(7,9);',
            'const f=(a,b)=>{const required=null.prefix;return f(b,a);};export default f(7,9);',
            'const f=(a,b)=>null.condition?f(b,a):f(b+1,a);export default f(7,9);',
        ]) {
            const original = graph(source)
            const expected = failure(original)
            const output = assertOk(tryStringify(original))
            assert(output.includes('while('), output)
            const normalized = graph(output)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(failure(current), expected, source)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
    },
    lazyTerminalPrefixesRetainTheirInvocationLoops: () => {
        const original = yielded(['function', lazyPrefixFunction()])
        const converted = assertOk(_sourceLoops(original))
        assertEq(converted, original)
        assert(converted.exit[0] === 'yield')
        const value = converted.exit[1][0]
        assert(value instanceof Array && value[0] === 'function')
        const root = value[1].body.statements.at(-1)
        assert(root !== undefined && root[0] === 'loop')
        assert(root[1].body.statements.some(statement => statement[0] === 'define' && statement[1] === lazyBinding && statement[3] === 'lazy'))
        const source = fromFast(original)
        const output = assertOk(tryStringify(source))
        assert(output.includes('while('), output)
        const restored = graph(output)
        for (const candidate of [source, restored]) {
            for (const input of /** @type {const} */ ([3, 0])) {
                const result = evaluate(['()', candidate, [input, 0]])
                assertStructurallySame(result, [[0], [0]])
                assert(result instanceof Array)
                assertEq(result[0], result[1])
            }
        }
    },
    terminalFunctionExitsRetainSelectedValueOwners: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['if(true){while(true){return 3;}return 0;}return 4;', 3],
            ['if(false){const skipped=null.x;while(true){return 3;}return 0;}return 4;', 4],
            ['switch(1){case 1:{while(true){return 3;}return 0;}default:{return 4;}}', 3],
            ['let i=0;while(i<1){const value=(()=>{if(true){while(true){return 3;}return 0;}return 4;})();return value;}return 9;', 3],
            ['const f=b=>{if(b){while(true){return 3;}return 0;}return 4;};return [f(true),f(false)];', [3, 4]],
        ]
        for (const [body, expected] of cases) {
            const original = graph(`export default (()=>{${body}})();`)
            assertStructurallySame(evaluate(original), expected, body)
            const normalized = graph(assertOk(tryStringify(original)))
            const canonical = assertOk(tryStringify(normalized))
            const restored = graph(canonical)
            assertStructurallySame(evaluate(restored), expected, body)
            assertStructurallySame(assertOk(identityAnalysis(restored)), assertOk(identityAnalysis(normalized)), body)
            assertEq(assertOk(tryStringify(restored)), canonical, body)
        }
        const required = graph('export default (()=>{if(true){const required=null.x;while(true){return 3;}return 0;}return 4;})();')
        failure(required)
        const normalized = graph(assertOk(tryStringify(required)))
        const canonical = assertOk(tryStringify(normalized))
        failure(graph(canonical))
        assertEq(assertOk(tryStringify(graph(canonical))), canonical)
    },
    sourceFunctionExitsKeepTheirOwnersAndFirstParseFixedPoints: () => {
        const declarations = Array.from({ length: 18 }, (_, index) => `let x${index}=${index};`).join('')
        const updates = Array.from({ length: 18 }, (_, index) => `x${index}=x${index}+1;`).join('')
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['let i=0;while(i<4){if(i===2){return [i,i+7];}i=i+1;}return [i,0];', [2, 9]],
            ['let i=0;while(i<4){if(i<2){i=i+1;}else{return [i];}const after=i+10;}return 0;', [2]],
            ['let i=0;while(i<4){let j=0;while(j<3){if(i===2){return [i,j];}j=j+1;}i=i+1;}return 0;', [2, 0]],
            ['let i=0;while(true){i=i+1;if(i===3){return i;}}return 99;', 3],
            ['let i=0;while(i<6){i=i+1;if(i===2){continue;}if(i===4){return i;}if(i===5){break;}}return 9;', 4],
            ['let i=0;while(i<3){const f=n=>{while(true){return n+2;}return 99;};const value=f(i);if(value===3){return [i,value];}i=i+1;}return 0;', [1, 3]],
            ['let i=0;while(i<3){const value=(()=>{let j=0;while(j<3){if(j===1){return j;}j=j+1;}return 99;})();i=i+1;if(i===2){return [i,value];}}return 0;', [2, 1]],
            ['let i=0;while(i<3){i=i+1;if(i===2){const snapshot=[i];const pair=()=>snapshot;return [pair()===pair(),pair()];}}return 0;', [true, [2]]],
            ['let i=0;while(true){i=i+1;if(i<3){continue;}if(i===3){return [i];}else{throw 0;}}return 9;', [3]],
            ['let i=0;while(i<3){if(i===2){return i;const skipped=null.x;}i=i+1;}return 99;', 2],
            [`let i=0;${declarations}while(true){if(i===3){return [i,x0,x17];}${updates}i=i+1;}return 99;`, [3, 3, 20]],
        ]
        for (const [body, expected] of cases) {
            const original = graph(`export default (()=>{${body}})();`)
            assertStructurallySame(evaluate(original), expected, body)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            const restored = graph(canonical)
            assertStructurallySame(evaluate(restored), expected, body)
            assertStructurallySame(assertOk(identityAnalysis(restored)), assertOk(identityAnalysis(normalized)), body)
            assertEq(assertOk(tryStringify(restored)), canonical, body)
        }
    },
    sourceFunctionExitsKeepReachedFailuresAndSkippedSuffixes: () => {
        /** @type {readonly string[]} */
        const cases = [
            'let i=0;while(i<4){if(i===2){throw [i];}i=i+1;}return 0;',
            'let i=0;while(i<4){let j=0;while(j<3){if(i===2){throw [i,j];}j=j+1;}i=i+1;}return 0;',
            'let i=0;while(true){i=i+1;if(i===3){throw i;}const reached=i;}return 99;',
            'let i=0;while(i<3){if(i===2){const required=null.x;return i;}i=i+1;}return 0;',
            'let i=0;while(i<3){if(i===2){throw null.x;}i=i+1;}return 0;',
            'let i=0;while(i<3){i=i+1;if(i===2){throw 7;const skipped=null.x;}}return 0;',
        ]
        for (const body of cases) {
            const original = graph(`export default (()=>{${body}})();`)
            failure(original)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            const restored = graph(canonical)
            failure(restored)
            assertStructurallySame(assertOk(identityAnalysis(restored)), assertOk(identityAnalysis(normalized)), body)
            assertEq(assertOk(tryStringify(restored)), canonical, body)
        }
    },
    infiniteSourceContinueKeepsItsCanonicalInvocation: () => {
        const original = graph('export default n=>{let i=0;while(true){i=i+1;continue;}return i;};')
        const first = assertOk(tryStringify(original))
        assert(first.includes('while(true)'), first)
        const normalized = graph(first)
        const canonical = assertOk(tryStringify(normalized))
        const restored = graph(canonical)
        assertStructurallySame(assertOk(identityAnalysis(restored)), assertOk(identityAnalysis(normalized)))
        assertEq(assertOk(tryStringify(restored)), canonical)
    },
    sourceLoopRetentionChecksLexicalTransferRegions: () => {
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const nested = /** @type {const} */ ({ kind: 'loop', index: 1 })
        const input = /** @type {const} */ ({ index: 0 })
        const state = /** @type {const} */ ({ index: 1 })
        const result = /** @type {const} */ ({ index: 2 })
        const first = /** @type {const} */ ({ index: 3 })
        const second = /** @type {const} */ ({ index: 4 })
        const inner = /** @type {const} */ ({ index: 5 })
        const captured = /** @type {const} */ ({ index: 6 })
        const nestedOwner = /** @type {const} */ ({ kind: 'function', index: 1 })
        /** @type {(body: Block) => Block} */
        const module = body => yielded(['function', {
            target: owner, parameters: [input], rest: null, self: null, captures: [],
            body: { statements: [['loop', { target, parameters: [state], initial: [['ref', input]], results: [result], body }]], exit: ['return', owner, ['ref', result]] },
        }])
        const own = /** @type {FastFunction} */ ({ target: nestedOwner, parameters: [], rest: null, self: null,
            captures: [{ binding: captured, value: ['block', yielded(1)] }], body: { statements: [], exit: ['throw', 7] } })
        const accepted = module({ statements: [
            ['define', first, ['function', own], 'required'],
            ['define', second, ['if', true, yielded(['ref', state]), { statements: [], exit: ['throw', 7] }], 'required'],
            ['if', [], true, { statements: [], exit: ['yield', []] }, { statements: [], exit: ['yield', []] }],
            ['loop', { target: nested, parameters: [inner], initial: [['array', [1]]], results: [], body: { statements: [], exit: ['break', nested, []] } }],
        ], exit: ['break', target, [['ref', state]]] })
        assertEq(assertOk(_sourceLoops(accepted)), accepted)
        const terminal = module({ statements: [], exit: ['loop', {
            target: nested, parameters: [], initial: [], results: [],
            body: { statements: [], exit: ['return', owner, 7] },
        }] })
        assertEq(assertOk(_sourceLoops(terminal)), terminal)
        const returned = module({ statements: [['define', first, ['block', { statements: [], exit: ['return', owner, 1] }], 'required']], exit: ['break', target, [1]] })
        assert(assertOk(_sourceLoops(returned)) !== returned)
        const backedge = module({ statements: [['define', first, ['block', { statements: [], exit: ['continue', target, [['ref', state]]] }], 'required']], exit: ['break', target, [1]] })
        assertEq(assertError(_sourceLoops(backedge)), 'an invocation backedge outside the source loop profile')
        for (const body of /** @type {readonly Block[]} */ ([
            { statements: [['block', [], { statements: [], exit: ['yield', []] }]], exit: ['break', target, [1]] },
            { statements: [['loop', { target: nested, parameters: [], initial: [], results: [], body: { statements: [], exit: ['break', target, [1]] } }]], exit: ['break', target, [1]] },
        ])) {
            assertEq(assertError(_sourceLoops(module(body))), 'a factored terminal continuation outside the source loop profile')
        }
        for (const exit of /** @type {readonly Block['exit'][]} */ ([['return', owner, 1], ['throw', 1]])) {
            const source = module({ statements: [], exit })
            assertEq(assertOk(_sourceLoops(source)), source)
        }
    },
    sourceLoopTransfersKeepStateAndFirstParseFixedPoints: () => {
        const locals = Array.from({ length: 18 }, (_, index) => `let x${index}=${index};`).join('')
        const updates = Array.from({ length: 18 }, (_, index) => `x${index}=x${index}+1;`).join('')
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['let i=0;while(true){i=i+1;break;}return i;', 1],
            ['let i=0;while(i<3){i=i+1;continue;}return i;', 3],
            ['let i=0;let sum=0;while(i<6){i=i+1;if(i%2===0){continue;}sum=sum+i;}return [i,sum];', [6, 9]],
            ['let i=0;let sum=0;while(i<5){if(i===2){break;}sum=sum+i;i=i+1;}return [i,sum];', [2, 1]],
            ['let i=0;let sum=0;while(true){if(i<3){sum=sum+i;i=i+1;continue;}else{sum=sum+10;break;}const skipped=null.x;}return [i,sum];', [3, 13]],
            ['let i=0;let sum=0;while(i<3){let j=0;while(j<5){j=j+1;if(j===2){continue;}if(j===4){break;}sum=sum+i+j;}i=i+1;}return [i,sum];', [3, 18]],
            ['let i=0;let saved=()=>[-1];while(true){i=i+1;const snapshot=[i];saved=()=>snapshot;if(i<3){continue;}break;}return saved();', [3]],
            ['let i=0;while(i<3){i=i+1;continue;const skipped=null.x;i=99;}return i;', 3],
            [`let i=0;${locals}while(true){i=i+1;if(i>4){break;}if(i%2===0){continue;}${updates}}return [i,x0,x17];`, [5, 2, 19]],
        ]
        for (const [body, expected] of cases) {
            const original = graph(`export default (()=>{${body}})();`)
            assertStructurallySame(evaluate(original), expected)
            const first = assertOk(tryStringify(original))
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            const restored = graph(canonical)
            assertStructurallySame(evaluate(restored), expected)
            assertStructurallySame(assertOk(identityAnalysis(restored)), assertOk(identityAnalysis(normalized)))
            assertEq(assertOk(tryStringify(restored)), canonical)
        }
    },
    sourceLoopTransfersRetainSelectedFailures: () => {
        /** @type {readonly string[]} */
        const sources = [
            'let i=0;while(i<1){const failed=null.x;i=i+1;continue;}return i;',
            'let i=0;while(true){if(i===0){const failed=null.x;break;}i=i+1;}return i;',
            'const test=i=>{const failed=i===2?null.x:0;return i<3;};let i=0;while(test(i)){i=i+1;continue;}return i;',
        ]
        for (const body of sources) {
            const original = graph(`export default (()=>{${body}})();`)
            failure(original)
            const first = assertOk(tryStringify(original))
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            const restored = graph(canonical)
            failure(restored)
            assertStructurallySame(assertOk(identityAnalysis(restored)), assertOk(identityAnalysis(normalized)))
            assertEq(assertOk(tryStringify(restored)), canonical)
        }
    },
    nestedSourceLoopsRetainResultsAndStableSpelling: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{let i=0;let sum=0;while(i<3){let j=0;while(j<2){sum=sum+i+j;j=j+1;}i=i+1;}return [i,sum];})();', [3, 9]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){let j=0;while(j<2){if(j===0){sum=sum+i;}else{sum=sum+10;}j=j+1;}i=i+1;}return [i,sum];})();', [3, 33]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){let j=0;while(j<1){i=i+1;j=j+1;}sum=sum+i;}return [i,sum];})();', [3, 6]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){if(i<1){let j=0;while(j<2){sum=sum+1;j=j+1;}}else{let j=0;while(j<3){sum=sum+10;j=j+1;}}i=i+1;}return [i,sum];})();', [3, 62]],
            ['export default (()=>{let i=0;let sum=0;while(i<2){let j=0;while(j<2){sum=sum+1;j=j+1;}while(j>0){sum=sum+10;j=j-1;}i=i+1;}return [i,sum];})();', [2, 44]],
            ['export default (()=>{let i=0;let sum=0;while(i<2){let j=0;while(j<2){let k=0;while(k<2){sum=sum+1;k=k+1;}j=j+1;}i=i+1;}return [i,sum];})();', [2, 8]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){let j=0;while(j<2){const i=7;sum=sum+i;j=j+1;}i=i+1;}return [i,sum];})();', [3, 42]],
            ['export default (()=>{let i=0;let saved=null;while(i<2){let j=0;while(j<2){const snapshot=[i,j];saved=()=>snapshot;j=j+1;}i=i+1;}return [saved(),saved()===saved()];})();', [[1, 1], true]],
            ['export default (()=>{let i=0;let old=null;let current=null;while(i<2){let j=0;while(j<1){old=current;current=[i];j=j+1;}i=i+1;}return [old,current,old===current];})();', [[0], [1], false]],
            ['export default (()=>{while(false){while(null.x){const skipped=null.y;}}return 7;})();', 7],
            ['export default (()=>{let i=0;while(i<2){while(false){const skipped=null.x;}i=i+1;}return i;})();', 2],
            ['export default (()=>{let i=0;let sum=0;while(i<3){if(i===0){let j=0;while(j<2){sum=sum+1;j=j+1;}}else if(i===1){let j=0;while(j<3){sum=sum+10;j=j+1;}}else{sum=sum+100;}i=i+1;}return [i,sum];})();', [3, 132]],
        ]
        for (const [source, expected] of cases) {
            const original = graph(source)
            assertStructurallySame(evaluate(original), expected, source)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            assert(!first.includes(':while('), first)
            const normalized = graph(first)
            assertStructurallySame(evaluate(normalized), expected, first)
            const canonical = assertOk(tryStringify(normalized))
            const restored = graph(canonical)
            assertStructurallySame(assertOk(identityAnalysis(restored)), assertOk(identityAnalysis(normalized)), source)
            assertEq(assertOk(tryStringify(restored)), canonical, source)
            assertStructurallySame(evaluate(restored), expected, canonical)
        }
    },
    nestedSourceLoopsKeepRequiredFailuresSelected: () => {
        /** @type {readonly string[]} */
        const sources = [
            'export default (()=>{let i=0;while(i<1){while(null.x){}i=i+1;}return i;})();',
            'export default (()=>{let i=0;while(i<1){while(true){const required=null.x;}i=i+1;}return i;})();',
            'export default (()=>{let i=0;while(i<1){let j=null.x;while(false){j=1;}i=i+1;}return i;})();',
            'export default (()=>{let i=0;while(i<1){let j=0;while(j<1){j=null.x;j=1;}i=i+1;}return i;})();',
            'export default (()=>{let i=0;while(i<1){if(false){}else{while(true){const required=null.x;}}i=i+1;}return i;})();',
        ]
        for (const source of sources) {
            const original = graph(source)
            failure(original)
            const first = assertOk(tryStringify(original))
            failure(graph(first))
            const canonical = assertOk(tryStringify(graph(first)))
            failure(graph(canonical))
            assertEq(assertOk(tryStringify(graph(canonical))), canonical)
        }
    },
    nestedSourceLoopHasAPinnedWhileSpelling: () => {
        const original = graph('export default ()=>{let i=0;while(i<2){let j=0;while(j<2){j=j+1;}i=i+1;}return i;};')
        assertEq(assertOk(tryStringify(original)), 'export default ()=>{const $0=($1)=>{let $2=$1;while((()=>{const $3=$2;const $4=$3[0];return $4<2;})()){const $5=$2;const $6=($7)=>{let $8=$7;while((()=>{const $9=$8;return $9<2;})()){const $10=$8;const $11=$10+1;$8=$11;}return $8;};const $12=$6(0);const $4=$5[0];const $13=[$4+1];$2=$13;}const $14=(()=>{const $15=$2;const $4=$15[0];return [$4];})();return $14;};return $0([0])[0];};')
    },
    nestedSelectedFailuresHaveAStableSourceGraph: () => {
        /** @type {readonly string[]} */
        const guards = [
            'if(i>0&&j===1){const bad=null.x;}',
            'if(i>0?j===1:false){const bad=null.x;}',
            'if(i>0){if(j===1){const bad=null.x;}}',
        ]
        for (const guard of guards) {
            const original = graph(`export default n=>{let i=0;let sum=0;while(i<n){let j=0;while(j<2){${guard}sum=sum+1;j=j+1;}i=i+1;}return [i,sum];};`)
            assertStructurallySame(evaluate(['()', original, [0]]), [0, 0])
            assertStructurallySame(evaluate(['()', original, [1]]), [1, 2])
            failure(['()', original, [2]])
            const first = assertOk(tryStringify(original))
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            const restored = graph(canonical)
            assertStructurallySame(assertOk(identityAnalysis(restored)), assertOk(identityAnalysis(normalized)))
            assertEq(assertOk(tryStringify(restored)), canonical)
            assertStructurallySame(evaluate(['()', restored, [1]]), [1, 2])
            failure(['()', restored, [2]])
        }
    },
    alternativeSourceBodiesRetainValuesAndStableSpelling: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{let i=0;let sum=0;while(i<4){if(i<2){sum=sum+i;}else{sum=sum+10;}i=i+1;}return [i,sum];})();', [4, 21]],
            ['export default (()=>{let i=0;let a=1;let b=2;while(i<4){if(i<2){a=a+i;}else{b=b+i;}i=i+1;}return [i,a,b];})();', [4, 2, 7]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){let local=1;if(i<2){local=local+2;}else{local=local+4;}sum=sum+local;i=i+1;}return [i,sum];})();', [3, 11]],
            ['export default (()=>{let i=0;let sum=0;while(i<4){if(i===0){sum=sum+1;}else if(i===1){sum=sum+2;}else if(i===2){sum=sum+4;}else{sum=sum+8;}i=i+1;}return [i,sum];})();', [4, 15]],
            ['export default (()=>{let i=0;let sum=0;while(i<4){if(i===0){sum=sum+1;}else if(i===1){sum=sum+2;}i=i+1;}return [i,sum];})();', [4, 3]],
            ['export default (()=>{let i=0;let sum=0;while(i<2){if(i<2){sum=sum+1;}else if(null.x){sum=99;}else{sum=100;}i=i+1;}return [i,sum];})();', [2, 2]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){if(false){const skipped=null.x;}else if(i<2){sum=sum+i;}else{sum=sum+10;}i=i+1;}return [i,sum];})();', [3, 11]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){if(i<2){if(i===0){sum=sum+1;}else{sum=sum+2;}}else{if(i===2){sum=sum+4;}else{const skipped=null.x;}}i=i+1;}return [i,sum];})();', [3, 7]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){if(i<2){const local=i+1;sum=sum+local;}else{let local=i+10;local=local+1;sum=sum+local;}i=i+1;}return [i,sum];})();', [3, 16]],
            ['export default (()=>{let i=0;let a=null;let b=null;while(i<2){if(i<1){const shared=[i];a=shared;b=shared;}else{const shared=[i+10];a=shared;b=shared;}i=i+1;}return [a===b,a];})();', [true, [11]]],
            ['export default (()=>{let i=0;let saved=null;while(i<2){if(i<1){const snapshot=i;saved=()=>snapshot;}else{const snapshot=i+10;saved=()=>snapshot;}i=i+1;}return saved();})();', 11],
            ['export default (()=>{let i=0;while(i<2){if(false){}else{}i=i+1;}return i;})();', 2],
            ['export default (()=>{while(false){if(null.x){}else if(null.y){}else{const skipped=null.z;}}return 7;})();', 7],
        ]
        for (const [source, expected] of cases) {
            const original = graph(source)
            assertStructurallySame(evaluate(original), expected, source)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            assert(!first.includes(':while('), first)
            const normalized = graph(first)
            assertStructurallySame(evaluate(normalized), expected, first)
            const canonical = assertOk(tryStringify(normalized))
            const restored = graph(canonical)
            assertStructurallySame(assertOk(identityAnalysis(restored)), assertOk(identityAnalysis(normalized)), source)
            assertEq(assertOk(tryStringify(restored)), canonical, source)
            assertStructurallySame(evaluate(restored), expected, canonical)
        }
    },
    alternativeSourceBodiesKeepRequiredFailuresSelected: () => {
        /** @type {readonly string[]} */
        const sources = [
            'export default (()=>{let i=0;while(i<1){if(true){const required=null.x;}else{i=10;}i=i+1;}return i;})();',
            'export default (()=>{let i=0;while(i<1){if(false){i=10;}else{const required=null.x;}i=i+1;}return i;})();',
            'export default (()=>{let i=0;while(i<1){if(false){}else if(null.x){i=10;}else{i=20;}i=i+1;}return i;})();',
            'export default (()=>{let i=0;let sum=0;while(i<1){if(false){sum=7;}else{sum=null.x;sum=1;}i=i+1;}return [i,sum];})();',
            'export default (()=>{let i=0;while(i<1){if(false){}else if(true){if(false){}else{const required=null.x;}}else{}i=i+1;}return i;})();',
        ]
        for (const source of sources) {
            const original = graph(source)
            failure(original)
            const first = assertOk(tryStringify(original))
            failure(graph(first))
            const canonical = assertOk(tryStringify(graph(first)))
            failure(graph(canonical))
            assertEq(assertOk(tryStringify(graph(canonical))), canonical)
        }
    },
    alternativeSourceBodyHasAPinnedWhileSpelling: () => {
        const original = graph('export default ()=>{let i=0;while(i<4){if(i<2){i=i+1;}else{i=i+2;}}return i;};')
        assertEq(assertOk(tryStringify(original)), 'export default ()=>{const $0=($1)=>{let $2=$1;while((()=>{const $3=$2;const $4=$3[0];return $4<4;})()){const $5=$2;const $4=$5[0];const $6=[$4<2?$4+1:$4+2];$2=$6;}const $7=(()=>{const $8=$2;const $4=$8[0];return [$4];})();return $7;};return $0([0])[0];};')
    },
    conditionalSourceBodiesRetainValuesAndStableSpelling: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{let i=0;let sum=0;while(i<7){if(i>3){sum=sum+i;}i=i+1;}return [i,sum];})();', [7, 15]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){if(i<2){sum=sum+i;}if(sum>0){sum=sum+10;}i=i+1;}return [i,sum];})();', [3, 21]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){let local=1;if(i>0){local=local+2;}sum=sum+local;i=i+1;}return [i,sum];})();', [3, 7]],
            ['export default (()=>{let i=0;let sum=0;while(i<4){if(i>0){if(i<3){sum=sum+i;}}i=i+1;}return [i,sum];})();', [4, 3]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){if(i<2){let sum=10;sum=sum+1;const own=sum;}sum=sum+1;i=i+1;}return [i,sum];})();', [3, 3]],
            ['export default (()=>{let i=0;let a=1;let b=2;while(i<3){if(i<2){const old=a;a=b;b=old;}i=i+1;}return [i,a,b];})();', [3, 1, 2]],
            ['export default (()=>{let i=0;let saved=null;while(i<3){if(i>0){const snapshot=i;saved=()=>snapshot;}i=i+1;}return saved();})();', 2],
            ['export default (()=>{let i=0;let a=null;let b=null;while(i<2){if(i<2){const shared=[i];a=shared;b=shared;}i=i+1;}return [a===b,a];})();', [true, [1]]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){if((()=>{const pair=[i];return pair===pair?i<2:false;})()){sum=sum+i;}i=i+1;}return [i,sum];})();', [3, 1]],
            ['export default (()=>{let i=0;while(i<2){if(false){const skipped=null.x;}i=i+1;}return i;})();', 2],
            ['export default (()=>{while(false){if(true){const skipped=null.x;}}return 7;})();', 7],
        ]
        for (const [source, expected] of cases) {
            const original = graph(source)
            assertStructurallySame(evaluate(original), expected, source)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            assert(!first.includes(':while('), first)
            const normalized = graph(first)
            assertStructurallySame(evaluate(normalized), expected, first)
            const canonical = assertOk(tryStringify(normalized))
            const restored = graph(canonical)
            assertStructurallySame(assertOk(identityAnalysis(restored)), assertOk(identityAnalysis(normalized)), source)
            assertEq(assertOk(tryStringify(restored)), canonical, source)
            assertStructurallySame(evaluate(restored), expected, canonical)
        }
    },
    conditionalSourceBodiesKeepRequiredFailuresSelected: () => {
        /** @type {readonly string[]} */
        const sources = [
            'export default (()=>{let i=0;while(i<1){if(null.x){i=1;}i=i+1;}return i;})();',
            'export default (()=>{let i=0;while(i<1){if(true){const required=null.x;}i=i+1;}return i;})();',
            'export default (()=>{let i=0;let sum=0;while(i<1){if(true){sum=null.x;sum=1;}i=i+1;}return [i,sum];})();',
            'export default (()=>{let i=0;while(i<1){if(true){if(true){const required=null.x;}}i=i+1;}return i;})();',
        ]
        for (const source of sources) {
            const original = graph(source)
            failure(original)
            const first = assertOk(tryStringify(original))
            failure(graph(first))
            const canonical = assertOk(tryStringify(graph(first)))
            failure(graph(canonical))
            assertEq(assertOk(tryStringify(graph(canonical))), canonical)
        }
    },
    conditionalSourceBodyHasAPinnedWhileSpelling: () => {
        const original = graph('export default ()=>{let i=0;while(i<4){if(i<2){i=i+1;}i=i+1;}return i;};')
        // The next-state array demands the update directly, so no separate
        // arithmetic anchor or temporary is required after the conditional.
        assertEq(assertOk(tryStringify(original)), 'export default ()=>{const $0=($1)=>{let $2=$1;while((()=>{const $3=$2;const $4=$3[0];return $4<4;})()){const $5=$2;const $4=$5[0];const $6=[($4<2?$4+1:$4)+1];$2=$6;}const $7=(()=>{const $8=$2;const $4=$8[0];return [$4];})();return $7;};return $0([0])[0];};')
    },
    aggregateSourceWhileHasAStableNormalForm: () => {
        for (const source of /** @type {const} */ ([
            'export default (n=>{let i=0;let sum=0;while(i<n){sum=sum+i;i=i+1;}return [i,sum];})(5);',
            'export default (()=>{let i=0;let a=1;let b=2;while(i<3){const old=a;a=b;b=old;i=i+1;}return [i,a,b];})();',
            'export default (()=>{while(false){const skipped=null.x;}return 7;})();',
            'export default (()=>{let i=0;let sum=0;while(i<2){sum=sum+i;i=i+1;}while(sum<4){i=i+1;sum=sum+2;}return [i,sum];})();',
            'export default (()=>{let i=0;let saved=null;while(i<3){const snapshot=i;saved=()=>snapshot;i=i+1;}return saved();})();',
            'export default (()=>{let i=0;let sum=0;while(i<3&&(false?null.x:true)){sum=sum+i;i=i+1;}return [i,sum];})();',
            'export default (()=>{let i=0;let sum=0;while((()=>{const pair=[i,sum];return pair===pair?pair[0]<3:false;})()){sum=sum+i;i=i+1;}return [i,sum];})();',
        ])) {
            const original = graph(source)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            assert(!first.includes(':while('), first)
            const normalized = graph(first)
            assertStructurallySame(evaluate(normalized), evaluate(original))
            const canonical = assertOk(tryStringify(normalized))
            assert(canonical.includes('while('), canonical)
            const restored = graph(canonical)
            assertStructurallySame(assertOk(identityAnalysis(restored)), assertOk(identityAnalysis(normalized)))
            assertEq(assertOk(tryStringify(restored)), canonical)
        }
    },
    plainSourceLoopsPreserveRequiredFailuresAndFinalCaptures: () => {
        for (const source of /** @type {const} */ ([
            'export default (()=>{while(null.x){}return 7;})();',
            'export default (()=>{while(true){const required=null.x;}return 7;})();',
            'export default (()=>{let i=0;let sum=0;while(i<1){sum=null.x;sum=1;i=i+1;}return [i,sum];})();',
            'export default (()=>{let limit=null.x;limit=limit;let i=0;while(i<0){const unused=limit;i=i+1;}return i;})();',
        ])) {
            const original = graph(source)
            const written = assertOk(tryStringify(original))
            failure(original)
            failure(graph(written))
        }
        const original = graph('const f=n=>n>0?f(n-1):()=>n;export default f(2)();')
        const written = assertOk(tryStringify(original))
        assert(written.includes('while('), written)
        assertEq(evaluate(graph(written)), 0)
        const canonical = assertOk(tryStringify(graph(written)))
        assertEq(assertOk(tryStringify(graph(canonical))), canonical)
    },
    multiInputSourceLoopsKeepFirstParseFixedPoints: () => {
        const names = Array.from({ length: 15 }, (_, index) => `x${index}`)
        const parameters = ['n', ...names].join(',')
        const updates = ['n-1', ...names.map(name => `${name}+1`)].join(',')
        const arguments_ = ['3', ...names.map((_, index) => `${index}`)].join(',')
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['const f=(n,a)=>n>0?f(n-1,a+n):a;export default f(4,0);', 10],
            ['const f=(n,a)=>n===0?a:f(n-1,a+n);export default f(4,0);', 10],
            ['const f=(n,a,b)=>n===0?[a,b]:f(n-1,b,a);export default f(3,1,2);', [2, 1]],
            ['const f=(n,a,b)=>n>0?f(n-1,b,a+b):[a,b];export default f(3,1,2);', [5, 8]],
            ['const f=(n,saved)=>n===0?saved:f(n-1,()=>n);export default f(2,null)();', 1],
            ['const seed=[9];const f=(n,a)=>n>0?f(n-1,[a,seed]):[a===seed,seed];export default [f(0,seed)[0],f(2,seed)[0],f(2,seed)[1]===seed];', [true, false, true]],
            ['const f=(n,a)=>n===0?a:f(n-1);export default f(3,9);', undefined],
            ['const f=(n,a)=>n>0?f(...[n-1,a+1]):a;export default f(3,0);', 3],
            ['const f=(n,a)=>{const pair=[n];return pair===pair&&n>0?f(n-1,a+n):a;};export default f(3,0);', 6],
            [`const f=(${parameters})=>n>0?f(${updates}):[x0,x14];export default [f.length,f(${arguments_})];`, [16, [3, 17]]],
        ]
        for (const [source, expected] of cases) {
            const original = graph(source)
            assertStructurallySame(evaluate(original), expected)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            assert(!first.includes(':while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(evaluate(current), expected)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)))
                assertEq(assertOk(tryStringify(current)), canonical)
                assert(canonical.includes('while('), canonical)
                current = graph(canonical)
            }
        }
    },
    multiInputNormalDefinitionsKeepSharingCapturesAndFirstParseFixedPoints: () => {
        const names = Array.from({ length: 15 }, (_, index) => `x${index}`)
        const parameters = ['n', ...names].join(',')
        const updates = ['n-1', ...names.map(name => `${name}+1`)].join(',')
        const arguments_ = ['3', ...names.map((_, index) => `${index}`)].join(',')
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['const f=(n,a)=>n>0?f(n-1,a+n):(()=>{const x=[a];return [x,x];})();export default [f.length,f(3,0)];', [2, [[6], [6]]]],
            ['const f=(n,a)=>n===0?(()=>{const x=[a];return [x,x];})():f(n-1,a+n);export default f(3,0);', [[6], [6]]],
            ['const f=(n,a)=>n>0?f(n-1,a+n):(()=>{const x=[a];return [x,x];})();const a=f(0,7);const b=f(0,7);export default [a[0]===a[1],a[0]===b[0],a===b,a];', [true, false, false, [[7], [7]]]],
            ['const f=(n,a)=>n>0?f(n-1,a+n):(()=>{const x=[a];const y=[a];return [x===y,x,x,y];})();export default f(2,0);', [false, [3], [3], [3]]],
            ['const f=(n,a)=>n>0?f(n-1,a+n):(()=>{const x=[n,a];return ()=>x;})();const read=f(3,0);export default [read()===read(),read()];', [true, [0, 6]]],
            ['const seed=[9];const f=(n,a)=>n===0?(()=>{const x=[a,seed];return [x,x];})():f(n-1,a);const result=f(2,seed);export default [result[0]===result[1],result[0][0]===seed,result[0][1]===seed];', [true, true, true]],
            ['const f=(n,a)=>n>0?f(n-1,a+1):(()=>{const arity=()=>f.length;const x=[arity];return [x,x];})();const result=f(3,0);export default [f.length,result[0]===result[1],result[0][0]()];', [2, true, 2]],
            ['const f=(n,a)=>n>0?f(...[n-1,a+1]):(()=>{const x={value:a};return [x,x];})();const result=f(3,0);export default [result[0]===result[1],result];', [true, [{ value: 3 }, { value: 3 }]]],
            ['const f=(n,a)=>n>0?f(n-1):(()=>{const x=[a];return [x,x];})();export default f(2,9);', [[undefined], [undefined]]],
            ['const f=(n,a)=>n===0?(()=>{const x=[a];return [x,x];})():f(n-1,a,7,8);export default f(2,9);', [[9], [9]]],
            ['const f=(n,a)=>n>0?f(n-1,a+1):(()=>{const x=[a];const y=()=>x;return [y,y];})();const result=f(3,0);export default [result[0]===result[1],result[0]()===result[1](),result[0]()];', [true, true, [3]]],
            [`const f=(${parameters})=>n>0?f(${updates}):(()=>{const x=[x0,x14];return [x,x];})();const result=f(${arguments_});export default [f.length,result[0]===result[1],result];`, [16, true, [[3, 17], [3, 17]]]],
        ]
        for (const [source, expected] of cases) {
            const original = graph(source)
            assertStructurallySame(evaluate(original), expected, source)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            assert(!first.includes(':while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(evaluate(current), expected, source)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
    },
    multiInputNormalDefinitionsKeepRequiredFailuresAndFirstParseFixedPoints: () => {
        for (const source of /** @type {const} */ ([
            'const f=(n,a)=>n>0?f(n-1,a):(()=>{const required=null.x;const x=[a];return [x,x];})();export default f(2,7);',
            'const f=(n,a)=>n===0?(()=>{const x=[a];const required=null.x;return [x,x];})():f(n-1,a);export default f(0,7);',
            'const f=(n,a)=>n>0?f(n-1,a,null.x):(()=>{const x=[a];return [x,x];})();export default f(1,7);',
            'const f=(n,a)=>n>0?f(n-1,a,...null):(()=>{const x=[a];return [x,x];})();export default f(1,7);',
            'const f=(n,a)=>n>0?f(n-1,a):(()=>{const x=[a];return [x,x];})();export default f(0,7,null.x);',
            'const f=(n,a)=>{const required=null.x;return n>0?f(n-1,a):(()=>{const x=[a];return [x,x];})();};export default f(0,7);',
        ])) {
            const original = graph(source)
            const expected = failure(original)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(failure(current), expected, source)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
    },
    observedRestPlainLoopsKeepArityFreshArraysAndFirstParseFixedPoints: () => {
        const names = Array.from({ length: 15 }, (_, index) => `x${index}`)
        const parameters = ['n', ...names, '...xs'].join(',')
        const updates = ['n-1', ...names.map(name => `${name}+1`), '...xs'].join(',')
        const arguments_ = ['3', ...names.map((_, index) => `${index}`), '99'].join(',')
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['const f=(n,...xs)=>n>0?f(n-1,xs[0]+n):xs[0];export default [f.length,f(4,0)];', [1, 10]],
            ['const f=(n,...xs)=>n===0?xs[0]:f(n-1,xs[0]+n);export default [f.length,f(4,0)];', [1, 10]],
            ['const f=(...xs)=>xs[0]>0?f(xs[0]-1,xs[1]+1):xs;export default [f.length,f(3,0)];', [0, [0, 3]]],
            ['const f=(...xs)=>xs[0]>0?f(xs[0]-1,()=>xs[0]):xs[1]();export default f(3,null);', 1],
            ['const f=(n,previous,...xs)=>n>0?f(n-1,xs,...xs):[previous===xs,xs===xs,xs];export default [f.length,f(3,null,7,8)];', [2, [false, true, [7, 8]]]],
            ['const f=(n,previous,...xs)=>n===0?[previous===xs,xs]:f(n-1,xs);const a=f(3,null,7);const b=f(3,null,7);export default [a[0],a[1],a[1]===b[1]];', [false, [], false]],
            ['const f=(n,...xs)=>n>0?f(n-1):xs;const a=f(0);const b=f(0);export default [a===b,f(3,7)];', [false, []]],
            ['const f=(n,saved,...xs)=>n>0?f(n-1,()=>xs,n):[saved(),xs];export default f(3,null,99);', [[2], [1]]],
            ['const f=(n,value,...xs)=>n>0?f(...[n-1]):[value,xs];export default f(3,7,8);', [undefined, []]],
            ['const f=(n,...xs)=>n>0?f(n-1,7,8,9):xs;export default f(3);', [7, 8, 9]],
            ['const f=(n,...xs)=>n>0?f(0,..."A𝄞",99):xs;export default f(1);', ['A', '𝄞', 99]],
            ['const seed=[9];const f=(n,...xs)=>n>0?f(n-1,...xs):[xs[0]===seed,xs];export default f(3,seed);', [true, [[9]]]],
            [`const f=(${parameters})=>n>0?f(${updates}):[x0,x14,xs];export default [f.length,f(${arguments_})];`, [16, [3, 17, [99]]]],
        ]
        for (const [source, expected] of cases) {
            const original = graph(source)
            assertStructurallySame(evaluate(original), expected, source)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            assert(!first.includes(':while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(evaluate(current), expected, source)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
    },
    fixedPlusRestNormalDefinitionsKeepSharingCapturesAndFirstParseFixedPoints: () => {
        const names = Array.from({ length: 15 }, (_, index) => `x${index}`)
        const parameters = ['n', ...names, '...xs'].join(',')
        const updates = ['n-1', ...names.map(name => `${name}+1`), 'xs[0]+1'].join(',')
        const arguments_ = ['3', ...names.map((_, index) => `${index}`), '99'].join(',')
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['const f=(n,...xs)=>n>0?f(n-1,xs[0]+n):(()=>{const x=[xs];return [x,x];})();export default [f.length,f(3,0)];', [1, [[[6]], [[6]]]]],
            ['const f=(n,...xs)=>n===0?(()=>{const x=[xs];return [x,x];})():f(n-1,xs[0]+n);export default f(3,0);', [[[6]], [[6]]]],
            ['const f=(n,...xs)=>n>0?f(n-1,...xs):(()=>{const x=[xs];return [x,x];})();const a=f(0);const b=f(0);export default [a[0]===a[1],a[0][0]===a[1][0],a[0]===b[0],a[0][0]===b[0][0],a];', [true, true, false, false, [[[]], [[]]]]],
            ['const f=(n,previous,...xs)=>n>0?f(n-1,xs,...xs):(()=>{const x=[previous===xs,xs];return [x,x];})();const result=f(3,null,7,8);export default [f.length,result[0]===result[1],result];', [2, true, [[false, [7, 8]], [false, [7, 8]]]]],
            ['const f=(n,previous,...xs)=>n===0?(()=>{const x=[previous===xs,xs];return [x,x];})():f(n-1,xs);const result=f(3,null,7);export default [result[0]===result[1],result];', [true, [[false, []], [false, []]]]],
            ['const f=(n,saved,...xs)=>n>0?f(n-1,()=>xs,n):(()=>{const x=[saved(),xs];return ()=>x;})();const read=f(3,null,99);export default [read()===read(),read()];', [true, [[2], [1]]]],
            ['const seed=[9];const f=(n,...xs)=>n===0?(()=>{const x=[xs[0],seed];return [x,x];})():f(n-1,...xs);const result=f(2,seed);export default [result[0]===result[1],result[0][0]===seed,result[0][1]===seed];', [true, true, true]],
            ['const f=(n,value,...xs)=>n>0?f(...[n-1]):(()=>{const x=[value,xs];return [x,x];})();export default f(3,7,8);', [[undefined, []], [undefined, []]]],
            ['const f=(n,...xs)=>n>0?f(0,..."A𝄞",99):(()=>{const x=[xs];return [x,x];})();export default f(1);', [[['A', '𝄞', 99]], [['A', '𝄞', 99]]]],
            ['const make=xs=>[xs];const f=(n,...xs)=>n>0?f(n-1,...xs):(()=>{const x=make(xs);return [x,x];})();export default f(3,7);', [[[7]], [[7]]]],
            ['const f=(n,...xs)=>n>0?f(n-1,...xs):(()=>{const x=[xs];const y=[xs];return [x===y,x,x,y];})();export default f(2,7);', [false, [[7]], [[7]], [[7]]]],
            [`const f=(${parameters})=>n>0?f(${updates}):(()=>{const x=[x0,x14,xs];return [x,x];})();const result=f(${arguments_});export default [f.length,result[0]===result[1],result];`, [16, true, [[3, 17, [102]], [3, 17, [102]]]]],
        ]
        for (const [source, expected] of cases) {
            const original = graph(source)
            assertStructurallySame(evaluate(original), expected, source)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            assert(!first.includes(':while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(evaluate(current), expected, source)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
    },
    fixedPlusRestNormalDefinitionsKeepRequiredFailuresAndFirstParseFixedPoints: () => {
        for (const source of /** @type {const} */ ([
            'const f=(n,...xs)=>n>0?f(n-1,...xs):(()=>{const required=null.x;const x=[xs];return [x,x];})();export default f(2,7);',
            'const f=(n,...xs)=>n===0?(()=>{const x=[xs];const required=null.x;return [x,x];})():f(n-1,...xs);export default f(0,7);',
            'const f=(n,...xs)=>n>0?f(n-1,null.x):(()=>{const x=[xs];return [x,x];})();export default f(1,7);',
            'const f=(n,...xs)=>n>0?f(n-1,...null):(()=>{const x=[xs];return [x,x];})();export default f(1,7);',
            'const f=(n,...xs)=>n>0?f(n-1,...xs):(()=>{const x=[xs];return [x,x];})();export default f(0,7,null.x);',
            'const f=(n,...xs)=>{const required=null.x;return n>0?f(n-1,...xs):(()=>{const x=[xs];return [x,x];})();};export default f(0,7);',
            'const make=xs=>xs[0].x;const f=(n,...xs)=>n===0?(()=>{const x=make(xs);return [x,x];})():f(n-1,...xs);export default f(2,null);',
        ])) {
            const original = graph(source)
            const expected = failure(original)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(failure(current), expected, source)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
    },
    restOnlyNormalDefinitionsKeepSharingCapturesAndFirstParseFixedPoints: () => {
        for (const source of /** @type {const} */ ([
            'const f=(...xs)=>xs[0]>0?f(xs[0]-1,xs[1]+xs[0]):(()=>{const x=[xs];return[x,x];})();export default f;',
            'const f=(...xs)=>xs[0]===0?(()=>{const x=[xs];return[x,x];})():f(xs[0]-1,xs[1]+xs[0]);export default f;',
        ])) {
            const original = graph(source)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(evaluate(['()', current, [3, 0]]), [[[0, 6]], [[0, 6]]])
                assertEq(evaluate(['.', current, 'length']), 0)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['const f=(...xs)=>xs[0]>0?f(xs[0]-1):(()=>{const x=[xs];return[x,x];})();export default f(2);', [[[0]], [[0]]]],
            ['const f=(...xs)=>xs[0]===0?(()=>{const x=[xs];return[x,x];})():f(xs[0]-1);export default f(2);', [[[0]], [[0]]]],
            ['const f=(...xs)=>xs.length>0?f():(()=>{const x=[xs];return[x,x];})();const a=f(3);const b=f(3);export default [a[0]===a[1],a[0][0]===a[1][0],a[0]===b[0],a[0][0]===b[0][0],a];', [true, true, false, false, [[[]], [[]]]]],
            ['const f=(...xs)=>xs.length===0?(()=>{const x=[xs];return[x,x];})():f();const a=f();const b=f();export default [a[0]===a[1],a[0]===b[0],a[0][0]===b[0][0],a];', [true, false, false, [[[]], [[]]]]],
            ['const f=(...xs)=>xs[0]>0?f(xs[0]-1,xs):(()=>{const x=[xs[1]===xs,xs[0]];return[x,x];})();const result=f(3,null);export default [result[0]===result[1],result];', [true, [[false, 0], [false, 0]]]],
            ['const f=(...xs)=>xs[0]>0?f(xs[0]-1,()=>xs):(()=>{const x=[xs[1]()[0],xs[0]];return()=>x;})();const read=f(3,null);export default [read()===read(),read()];', [true, [1, 0]]],
            ['const seed=[9];const f=(...xs)=>xs[0]===0?(()=>{const x=[xs[1],seed];return[x,x];})():f(xs[0]-1,xs[1]);const result=f(2,seed);export default [result[0]===result[1],result[0][0]===seed,result[0][1]===seed];', [true, true, true]],
            ['const f=(...xs)=>xs[0]>0?f(0,..."A𝄞",99):(()=>{const x=[xs];return[x,x];})();export default f(1);', [[[0, 'A', '𝄞', 99]], [[0, 'A', '𝄞', 99]]]],
            ['const make=xs=>[xs];const f=(...xs)=>xs[0]>0?f(xs[0]-1):(()=>{const x=make(xs);return[x,x];})();export default f(3,7);', [[[0]], [[0]]]],
            ['const f=(...xs)=>xs[0]>0?f(xs[0]-1):(()=>{const x=[xs];const y=[xs];return[x===y,x,x,y];})();export default f(2);', [false, [[0]], [[0]], [[0]]]],
        ]
        for (const [source, expected] of cases) {
            const original = graph(source)
            assertStructurallySame(evaluate(original), expected, source)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            assert(!first.includes(':while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(evaluate(current), expected, source)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
    },
    restOnlyProjectionFirstResultsKeepTheirFirstParseGraph: () => {
        for (const reversed of /** @type {const} */ ([false, true])) {
            for (const [declarations, base] of /** @type {const} */ ([
                ['', 'const pair=[xs];return [xs[1],()=>pair];'],
                ['', 'const pair=[xs];return [xs[1],pair,pair];'],
                ['', 'const pair=[xs];return [xs.length,pair,pair];'],
                ['', 'const saved=xs[1];const pair=[xs];return [saved,pair,pair];'],
                ['', 'const pair=[xs];const saved=xs[1];return [saved,pair,pair];'],
                ['const make=xs=>xs;', 'const required=make(xs);const pair=[xs];return [xs[1],pair,pair];'],
                ['', 'const required=xs[2].x;const pair=[xs];return [xs[1],pair,pair];'],
            ])) {
                const normal = `(()=>{${base}})()`
                const next = /** @type {const} */ ('f(xs[0]-1,()=>xs,...xs.slice(2))')
                const source = `${declarations}const f=(...xs)=>${reversed ? `xs[0]===0?${normal}:${next}` : `xs[0]>0?${next}:${normal}`};export default f;`
                const original = graph(source)
                const first = assertOk(tryStringify(original))
                assert(first.includes('while('), first)
                const normalized = graph(first)
                const canonical = assertOk(tryStringify(normalized))
                let current = normalized
                for (let generation = 0; generation < 7; generation += 1) {
                    assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                    assertEq(assertOk(tryStringify(current)), canonical, source)
                    current = graph(canonical)
                }
            }
            const normal = /** @type {const} */ ('(()=>{const pair=[xs];return [xs[1],()=>pair];})()')
            const next = /** @type {const} */ ('f(xs[0]-1,()=>xs,...xs.slice(2))')
            const source = `const f=(...xs)=>${reversed ? `xs[0]===0?${normal}:${next}` : `xs[0]>0?${next}:${normal}`};const result=f(3,null,7);const pair=result[1]();export default [result[0]()[0],pair===result[1](),pair[0][0],pair[0][2]];`
            const original = graph(source)
            assertStructurallySame(evaluate(original), [1, true, 0, 7])
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(evaluate(current), [1, true, 0, 7])
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
    },
    restOnlyNormalDefinitionsKeepRequiredFailuresAndFirstParseFixedPoints: () => {
        for (const source of /** @type {const} */ ([
            'const f=(...xs)=>xs[0]>0?f(xs[0]-1):(()=>{const required=null.x;const x=[xs];return[x,x];})();export default f(2);',
            'const f=(...xs)=>xs[0]===0?(()=>{const x=[xs];const required=null.x;return[x,x];})():f(xs[0]-1);export default f(0);',
            'const f=(...xs)=>xs[0]>0?f(xs[0]-1,null.x):(()=>{const x=[xs];return[x,x];})();export default f(1);',
            'const f=(...xs)=>xs[0]>0?f(xs[0]-1,...null):(()=>{const x=[xs];return[x,x];})();export default f(1);',
            'const f=(...xs)=>xs[0]>0?f(xs[0]-1):(()=>{const x=[xs];return[x,x];})();export default f(0,null.x);',
            'const f=(...xs)=>{const required=null.x;return xs[0]>0?f(xs[0]-1):(()=>{const x=[xs];return[x,x];})();};export default f(0);',
            'const make=xs=>xs[1].x;const f=(...xs)=>xs[0]===0?(()=>{const x=make(xs);return[x,x];})():f(xs[0]-1,null);export default f(2,null);',
        ])) {
            const original = graph(source)
            const expected = failure(original)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(failure(current), expected, source)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
    },
    zeroInputTerminalPrefixesKeepIdentityAndFirstParseFixedPoints: () => {
        for (const [prefix, test, normal, observe, expected] of /** @type {readonly (readonly [string, string, string, string, unknown])[]} */ ([
            ['const pair=[0];', 'pair[0]>0', 'pair', 'export default first;', [0]],
            ['const pair=[seed];const object={pair};const read=()=>[pair,object,seed,f];', 'read()[2][0]>9', '[pair,pair,object,read]', 'const held=first[3]();export default[first[0]===first[1],first[2]===held[1],first[0]===held[0],held[2]===seed,held[3]===f,first[0]===other[0],first[3]()[0]===held[0],held[0]];', [true, true, true, true, true, false, true, [[9]]]],
            ['const pair=make(seed);', 'pair[0][0]>9', 'pair', 'export default[first===other,first[0]===seed,first];', [false, true, [[9]]]],
            ['const pair=[f,seed];const read=()=>pair;', 'read()[1][0]>9', '[pair,read]', 'export default[first[0][0]===f,first[1]()===first[0],first[0]===other[0],first[0][1]===seed];', [true, true, false, true]],
        ])) {
            for (const baseFirst of /** @type {const} */ ([false, true])) {
                const source = `const seed=[9];const make=x=>[x];const f=()=>{${prefix}return ${baseFirst ? `!(${test})?${normal}:f()` : `${test}?f():${normal}`};};const first=f();const other=f();${observe}`
                const original = graph(source)
                assertStructurallySame(evaluate(original), expected, source)
                const output = assertOk(tryStringify(original))
                assert(output.includes('while('), output)
                const normalized = graph(output)
                const canonical = assertOk(tryStringify(normalized))
                let current = normalized
                for (let generation = 0; generation < 7; generation += 1) {
                    assertStructurallySame(evaluate(current), expected, source)
                    assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                    assertEq(assertOk(tryStringify(current)), canonical, source)
                    current = graph(canonical)
                }
            }
        }
    },
    zeroInputMixedTerminalTreesKeepSelectedResultsAndFirstParseFixedPoints: () => {
        for (const baseFirst of /** @type {const} */ ([false, true])) {
            for (const earlyFirst of /** @type {const} */ ([false, true])) {
                for (const completeEarly of /** @type {const} */ ([false, true])) {
                    const test = completeEarly ? 'pair[0]>=0' : 'pair[0]>0'
                    const normal = /** @type {const} */ ('[pair,pair,0,()=>pair]')
                    const early = /** @type {const} */ ('[pair,pair,1,()=>pair]')
                    const choice = /** @type {const} */ ('pair[0]===0')
                    const mixed = earlyFirst ? `${choice}?${early}:f()` : `!(${choice})?f():${early}`
                    const source = `const f=()=>{const pair=[0];return ${baseFirst ? `!(${test})?${normal}:(${mixed})` : `${test}?(${mixed}):${normal}`};};const first=f();const other=f();export default[first[0]===first[1],first[3]()===first[0],first[0]===other[0],first[2],first[0]];`
                    const expected = /** @type {const} */ ([true, true, false, completeEarly ? 1 : 0, [0]])
                    const original = graph(source)
                    assertStructurallySame(evaluate(original), expected, source)
                    const output = assertOk(tryStringify(original))
                    assert(output.includes('while('), output)
                    const normalized = graph(output)
                    const canonical = assertOk(tryStringify(normalized))
                    let current = normalized
                    for (let generation = 0; generation < 7; generation += 1) {
                        assertStructurallySame(evaluate(current), expected, source)
                        assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                        assertEq(assertOk(tryStringify(current)), canonical, source)
                        current = graph(canonical)
                    }
                }
            }
        }
    },
    zeroInputTerminalPrefixesKeepReachedFailuresAndSkippedArguments: () => {
        for (const source of /** @type {const} */ ([
            'const f=()=>{const pair=[0];const required=null.prefix;return pair[0]>0?f():pair;};export default f();',
            'const f=()=>{const pair=[0];return null.condition?f():pair;};export default f();',
            'const f=()=>{const pair=[1];return pair[0]>0?f(null.argument):pair;};export default f();',
            'const f=()=>{const pair=[1];return pair[0]>0?f(...null):pair;};export default f();',
            'const f=()=>{const pair=[0];return pair[0]>0?f():null.base;};export default f();',
            'const f=()=>{const pair=[1];return pair[0]>0?(null.choice?pair:f()):pair;};export default f();',
            'const f=()=>{const pair=[1];return pair[0]>0?(pair[0]===1?null.early:f()):pair;};export default f();',
        ])) {
            const original = graph(source)
            const expected = failure(original)
            const output = assertOk(tryStringify(original))
            assert(output.includes('while('), output)
            const normalized = graph(output)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(failure(current), expected, source)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
        const skipped = /** @type {const} */ ('const f=()=>{const pair=[0];return pair[0]>0?f(null.argument,...null):pair;};export default f();')
        const output = assertOk(tryStringify(graph(skipped)))
        assert(output.includes('while('), output)
        assertStructurallySame(evaluate(graph(output)), [0])
    },
    sharedRequiredPrefixesKeepIdentityAndFirstParseFixedPoints: () => {
        for (const [parameters, prefix, test, recur, normal, args, observe, expected] of /** @type {readonly (readonly [string, string, string, string, string, string, string, unknown])[]} */ ([
            ['n,a', 'const pair=[n,a];', 'pair[0]>0', 'f(n-1,pair[1]+1)', 'pair', '3,7', 'export default first;', [0, 10]],
            ['n,a', 'const pair=[f,n,a];', 'n>0', 'f(n-1,pair[2]+1)', 'pair', '3,4', 'export default[first[0]===f,first[1],first[2]];', [true, 0, 7]],
            ['n,a,b', 'const pair=[n,a,b];const object={pair};const read=()=>[pair,object,n,a,b];', 'read()[0][0]>0', 'f(n-1,object.pair[2],pair[1])', '[pair,pair,object,read]', '3,1,2', 'const held=first[3]();const other=f(2,5,6);export default[first[0]===first[1],first[2]===held[1],first[0]===held[0],first[0]===other[0],first[3]()[0]===held[0],first[0],held[2],held[3],held[4]];', [true, true, true, false, true, [0, 2, 1], 0, 2, 1]],
            ['n,...xs', 'const pair=[n,xs];const object={pair};const read=()=>[pair,object,n,xs];', 'read()[0][0]>0', 'f(n-1,...object.pair[1])', '[pair,pair,object,read]', '3,7,8', 'const held=first[3]();const other=f(2,9);export default[first[0]===first[1],first[2]===held[1],first[0][1]===held[3],first[0][1]===other[0][1],first[0]];', [true, true, true, false, [0, [7, 8]]]],
            ['n,...xs', 'const pair=[n,xs];const read=()=>pair;', 'read()[0]>0', 'f(n-1)', '[pair,read]', '3,7', 'const held=first[1]();const other=f(2);export default[first[0]===held,first[0][1]===other[0][1],held];', [true, false, [0, []]]],
            ['...xs', 'const pair=[xs];const object={pair};const read=()=>[pair,object,xs];', 'read()[2][0]>0', 'f(object.pair[0][0]-1,...pair[0].slice(1))', '[pair,pair,object,read]', '3,7,8', 'const held=first[3]();const other=f(2,9);export default[first[0]===first[1],first[2]===held[1],first[0][0]===held[2],first[0][0]===other[0][0],held[2]];', [true, true, true, false, [0, 7, 8]]],
        ])) {
            for (const baseFirst of /** @type {const} */ ([false, true])) {
                const source = `const f=(${parameters})=>{${prefix}return ${baseFirst ? `!(${test})?${normal}:${recur}` : `${test}?${recur}:${normal}`};};const first=f(${args});${observe}`
                const original = graph(source)
                assertStructurallySame(evaluate(original), expected, source)
                const output = assertOk(tryStringify(original))
                assert(output.includes('while('), output)
                const normalized = graph(output)
                const canonical = assertOk(tryStringify(normalized))
                let current = normalized
                for (let generation = 0; generation < 7; generation += 1) {
                    assertStructurallySame(evaluate(current), expected, source)
                    assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                    assertEq(assertOk(tryStringify(current)), canonical, source)
                    current = graph(canonical)
                }
            }
        }
    },
    sharedRequiredPrefixesKeepFailuresBeforeTheirUses: () => {
        for (const source of /** @type {const} */ ([
            'const f=(n,a)=>{const pair=[n,a];const reached=null.prefix;return pair[0]>0?f(n-1,pair[1]+1):pair;};export default f(3,0);',
            'const f=(n,a)=>{const pair=[n,a];return null.condition?f(n-1,pair[1]+1):pair;};export default f(3,0);',
            'const f=(n,a)=>{const pair=[n,a];return pair[0]>0?f(null.first,pair[1]+1):pair;};export default f(3,0);',
            'const f=(n,a)=>{const pair=[n,a];return pair[0]>0?f(n-1,null.second):pair;};export default f(3,0);',
            'const f=(n,a)=>{const pair=[n,a];return pair[0]>0?f(n-1,pair[1]+1,null.ignored):pair;};export default f(3,0);',
            'const f=(n,a)=>{const pair=[n,a];return pair[0]>0?f(n-1,pair[1]+1):null.base;};export default f(3,0);',
            'const f=(n,...xs)=>{const pair=[n,xs];return pair[0]>0?f(n-1,...null):pair;};export default f(3,0);',
        ])) {
            const original = graph(source)
            const expected = failure(original)
            const output = assertOk(tryStringify(original))
            assert(output.includes('while('), output)
            const normalized = graph(output)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(failure(current), expected, source)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
        const skipped = /** @type {const} */ ('const f=(n,a)=>{const pair=[n,a];return pair[0]>0?f(n-1,pair[1]+1,null.skipped):pair;};export default f(0,7);')
        const output = assertOk(tryStringify(graph(skipped)))
        assert(output.includes('while('), output)
        assertStructurallySame(evaluate(graph(output)), [0, 7])
    },
    mixedTailLeavesKeepSelectedResultsAndFirstParseFixedPoints: () => {
        for (const [parameters, test, early, recur, normal, args, expected] of /** @type {readonly (readonly [string, string, string, string, string, string, unknown])[]} */ ([
            ['n,a', 'n>0', 'n===1', 'f(n-1,a+1)', 'a', '4,7', 10],
            ['n,a,b', 'n>0', 'n===1', 'f(n-1,b,a)', '[a,b]', '4,1,2', [2, 1]],
            ['n,...xs', 'n>0', 'n===1', 'f(n-1,xs[1],xs[0])', 'xs', '4,1,2', [2, 1]],
            ['n,...xs', 'n>0', 'n===1', 'f(n-1)', 'xs', '4,1,2', []],
            ['...xs', 'xs[0]>0', 'xs[0]===1', 'f(xs[0]-1,xs[2],xs[1])', '[xs[1],xs[2]]', '4,1,2', [2, 1]],
        ])) {
            for (const baseFirst of /** @type {const} */ ([false, true])) {
                for (const earlyFirst of /** @type {const} */ ([false, true])) {
                    const mixed = earlyFirst ? `${early}?${normal}:${recur}` : `!(${early})?${recur}:${normal}`
                    for (const [inputs, result] of /** @type {readonly (readonly [string, unknown])[]} */ ([[args, expected], ['0,7,8', parameters === 'n,a' ? 7 : [7, 8]]])) {
                        const source = `const f=(${parameters})=>${baseFirst ? `!(${test})?${normal}:(${mixed})` : `${test}?(${mixed}):${normal}`};export default f(${inputs});`
                        const original = graph(source)
                        assertStructurallySame(evaluate(original), result, source)
                        const output = assertOk(tryStringify(original))
                        assert(output.includes('while('), output)
                        const normalized = graph(output)
                        const canonical = assertOk(tryStringify(normalized))
                        let current = normalized
                        for (let generation = 0; generation < 7; generation += 1) {
                            assertStructurallySame(evaluate(current), result, source)
                            assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                            assertEq(assertOk(tryStringify(current)), canonical, source)
                            current = graph(canonical)
                        }
                    }
                }
            }
        }
        for (const baseFirst of /** @type {const} */ ([false, true])) {
            for (const sharedRoot of /** @type {const} */ ([false, true])) {
                const prefix = sharedRoot ? 'const anchor=[n,a,b];' : ''
                const pair = sharedRoot ? 'anchor' : '[n,a,b]'
                const normal = `(()=>{const pair=${pair};return[pair,pair,()=>[pair,n,a,b],saved];})()`
                const recur = `(()=>{const pair=${pair};return f(n-1,b,a,()=>[pair,n,a,b]);})()`
                const mixed = `${sharedRoot ? 'anchor[0]' : 'n'}===1?${normal}:${recur}`
                const source = `const f=(n,a,b,saved)=>{${prefix}return ${baseFirst ? `n<=0?${normal}:(${mixed})` : `n>0?(${mixed}):${normal}`};};const first=f(4,1,2,()=>null);const held=first[3]();const other=f(2,5,6,()=>null);export default[first[0]===first[1],first[2]()[0]===first[0],first[0]===other[0],first[3]()[0]===held[0],first[0],first[2](),held];`
                const original = graph(source)
                const expected = /** @type {const} */ ([true, true, false, true, [1, 2, 1], [[1, 2, 1], 1, 2, 1], [[2, 1, 2], 2, 1, 2]])
                assertStructurallySame(evaluate(original), expected)
                const output = assertOk(tryStringify(original))
                assert(output.includes('while('), output)
                const normalized = graph(output)
                const canonical = assertOk(tryStringify(normalized))
                let current = normalized
                for (let generation = 0; generation < 7; generation += 1) {
                    assertStructurallySame(evaluate(current), expected)
                    assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)))
                    assertEq(assertOk(tryStringify(current)), canonical)
                    current = graph(canonical)
                }
            }
        }
    },
    mixedRootArmsKeepBothCompletionRoutesAndFirstParseFixedPoints: () => {
        for (const [input, expected] of /** @type {const} */ ([[3, 10], [-4, 10], [0, 7], [-1, 7]])) {
            const source = `const f=(n,a)=>n>=0?(n===0?a:f(n-1,a+1)):(n===-1?a:f(n+1,a+1));export default f(${input},7);`
            const original = graph(source)
            assertEq(evaluate(original), expected)
            const output = assertOk(tryStringify(original))
            assert(output.includes('while('), output)
            const normalized = graph(output)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertEq(evaluate(current), expected)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)))
                assertEq(assertOk(tryStringify(current)), canonical)
                current = graph(canonical)
            }
        }
    },
    mixedTailLeavesKeepRequiredFailuresAndSkippedWork: () => {
        for (const source of /** @type {const} */ ([
            'const f=(n,a)=>n>0?(null.selector?a:f(n-1,a+1)):a;export default f(3,0);',
            'const f=(n,a)=>n>0?(n===1?null.early:f(n-1,a+1)):a;export default f(3,0);',
            'const f=(n,a)=>n>0?(n===1?a:f(null.first,a+1)):a;export default f(3,0);',
            'const f=(n,a)=>n>0?(n===1?a:f(n-1,null.second)):a;export default f(3,0);',
            'const f=(n,a)=>n>0?(n===1?a:f(n-1,a+1,null.ignored)):a;export default f(3,0);',
            'const f=(n,a)=>n>0?(false?a:f(n-1,a+1)):null.normal;export default f(3,0);',
            'const f=(n,...xs)=>n>0?(n===1?xs:f(n-1,...null)):xs;export default f(3,0);',
            'const f=(...xs)=>xs[0]>0?(xs[0]===1?xs:f(xs[0]-1,null.selected)):xs;export default f(3,0);',
        ])) {
            const original = graph(source)
            const expected = failure(original)
            const output = assertOk(tryStringify(original))
            assert(output.includes('while('), output)
            const normalized = graph(output)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(failure(current), expected, source)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
        const skipped = /** @type {const} */ ('const f=(n,a)=>n>0?(n===1?a:f(n-1,a+1,null.skipped)):a;export default f(1,7);')
        const output = assertOk(tryStringify(graph(skipped)))
        assert(output.includes('while('), output)
        assertEq(evaluate(graph(output)), 7)
    },
    branchingTransitionsKeepSimultaneousUpdatesAndFirstParseFixedPoints: () => {
        for (const [parameters, test, choice, first, second, normal, args, expected] of /** @type {readonly (readonly [string, string, string, string, string, string, string, unknown])[]} */ ([
            ['', 'false', 'true', 'f(null.left)', 'f(null.right)', 'seed', '', [9]],
            ['n,a,b', 'n>0', 'n%2===0', 'f(n-1,b,a)', 'f(n-1,a,b)', '[a,b]', '3,1,2', [2, 1]],
            ['n,...xs', 'n>0', 'n%2===0', 'f(n-1,xs[1],xs[0])', 'f(n-1,...xs)', 'xs', '3,1,2', [2, 1]],
            ['...xs', 'xs[0]>0', 'xs[0]%2===0', 'f(xs[0]-1,xs[2],xs[1])', 'f(xs[0]-1,...xs.slice(1))', '[xs[1],xs[2]]', '3,1,2', [2, 1]],
        ])) {
            for (const baseFirst of /** @type {const} */ ([false, true])) {
                const step = `${choice}?${first}:${second}`
                const source = `const seed=[9];const f=(${parameters})=>${baseFirst ? `!(${test})?${normal}:(${step})` : `${test}?(${step}):${normal}`};export default f(${args});`
                const original = graph(source)
                assertStructurallySame(evaluate(original), expected, source)
                const output = assertOk(tryStringify(original))
                assert(output.includes('while('), output)
                const normalized = graph(output)
                const canonical = assertOk(tryStringify(normalized))
                let current = normalized
                for (let generation = 0; generation < 7; generation += 1) {
                    assertStructurallySame(evaluate(current), expected, source)
                    assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                    assertEq(assertOk(tryStringify(current)), canonical, source)
                    current = graph(canonical)
                }
            }
        }
        for (const baseFirst of /** @type {const} */ ([false, true])) {
            for (const [parameters, test, first, second, normal, args, observe, expected] of /** @type {readonly (readonly [string, string, string, string, string, string, string, unknown])[]} */ ([
                ['n,a,b,saved', 'n>0', '(()=>{const pair=[n,a,b];return f(n-1,b,a,()=>[pair,n,a,b]);})()', '(()=>{const pair=[n,a,b];return f(n-1,a,b,()=>[pair,n,a,b]);})()', 'saved', '3,1,2,null', 'const a=read();const other=f(2,5,6,null);export default[a[0]===read()[0],a[0]===other()[0],a[0],a[1],a[2],a[3]];', [true, false, [1, 2, 1], 1, 2, 1]],
                ['...xs', 'xs[0]>0', '(()=>{const pair=[xs];return f(xs[0]-1,()=>[pair,xs],...xs.slice(2));})()', '(()=>{const pair=[xs];return f(xs[0]-1,()=>[pair,xs],...xs.slice(2));})()', 'xs[1]', '3,null,7', 'const a=read();const other=f(2,null,9);export default[a[0][0]===a[1],read()[1]===a[1],other()[1]===a[1],a[1][0],a[1][2]];', [true, true, false, 1, 7]],
            ])) {
                const selector = parameters === '...xs' ? 'xs[0]%2===0' : 'n%2===0'
                const step = `${selector}?${first}:${second}`
                const source = `const f=(${parameters})=>${baseFirst ? `!(${test})?${normal}:(${step})` : `${test}?(${step}):${normal}`};const read=f(${args});${observe}`
                const original = graph(source)
                assertStructurallySame(evaluate(original), expected, source)
                const output = assertOk(tryStringify(original))
                assert(output.includes('while('), output)
                const normalized = graph(output)
                const canonical = assertOk(tryStringify(normalized))
                let current = normalized
                for (let generation = 0; generation < 7; generation += 1) {
                    assertStructurallySame(evaluate(current), expected, source)
                    assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                    assertEq(assertOk(tryStringify(current)), canonical, source)
                    current = graph(canonical)
                }
            }
        }
    },
    branchingTransitionsKeepRequiredFailuresAndSkippedLeaves: () => {
        for (const source of /** @type {const} */ ([
            'const f=(n,a)=>n>0?(null.selector?f(n-1,a):f(n-2,a)):a;export default f(3,0);',
            'const f=(n,a)=>n===0?a:(n>1?f(n-1,a,null.selected):f(n-1,a));export default f(3,0);',
            'const f=(n,a)=>n>0?(n>1?f(null.first,a):f(n-1,a)):a;export default f(3,0);',
            'const f=(n,a)=>n>0?(n>1?f(n-1,a):f(n-1,a)):null.base;export default f(3,0);',
            'const f=(n,...xs)=>n>0?(n>1?f(n-1,...null):f(n-1,...xs)):xs;export default f(3,0);',
            'const f=(...xs)=>xs[0]>0?(xs[0]>1?f(xs[0]-1,null.selected):f(xs[0]-1)):xs;export default f(3,0);',
        ])) {
            const original = graph(source)
            const expected = failure(original)
            const output = assertOk(tryStringify(original))
            assert(output.includes('while('), output)
            const normalized = graph(output)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(failure(current), expected, source)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
        const safe = /** @type {const} */ ('const f=(n,a)=>n>0?(true?f(n-1,a):f(null.skipped,a)):a;export default f(3,7);')
        const output = assertOk(tryStringify(graph(safe)))
        assert(output.includes('while('), output)
        assertEq(evaluate(graph(output)), 7)
    },
    conditionalNormalResultsKeepSelectedSharingCapturesAndFirstParseFixedPoints: () => {
        for (const choice of /** @type {const} */ ([2, 0, -2])) {
            for (const [parameters, test, next, state, selected, args, expectedState] of /** @type {readonly (readonly [string, string, string, string, string, string, unknown])[]} */ ([
                ['', 'false', 'f()', 'seed', `${choice}`, '', [9]],
                ['n,a', 'n>0', 'f(n-1,a)', 'a', 'a', `3,${choice}`, choice],
                ['n,...xs', 'n>0', 'f(n-1,...xs)', 'xs', 'xs[0]', `3,${choice}`, [choice]],
                ['...xs', 'xs[0]>0', 'f(xs[0]-1,xs[1])', 'xs', 'xs[1]', `3,${choice}`, [0, choice]],
            ])) {
                const n = parameters === '' ? '0' : parameters === '...xs' ? 'xs[0]' : 'n'
                const [positive, zero, negative] = [1, 0, -1].map(tag => `(()=>{const x=[shared,${tag}];return[x,x,()=>x,()=>shared];})()`)
                const normal = `(()=>{const shared=[${n},${state}];return ${selected}>0?${positive}:${selected}===0?${zero}:${negative};})()`
                for (const baseFirst of /** @type {const} */ ([false, true])) {
                    const source = `const seed=[9];const f=(${parameters})=>${baseFirst ? `!(${test})?${normal}:${next}` : `${test}?${next}:${normal}`};const a=f(${args});const b=f(${args});export default[a[0]===a[1],a[0]===b[0],a[2]()===a[0],a[3]()===a[0][0],a[0]];`
                    const original = graph(source)
                    const expected = /** @type {const} */ ([true, false, true, true, [[0, expectedState], Math.sign(choice)]])
                    assertStructurallySame(evaluate(original), expected, source)
                    const first = assertOk(tryStringify(original))
                    assert(first.includes('while('), first)
                    const normalized = graph(first)
                    const canonical = assertOk(tryStringify(normalized))
                    let current = normalized
                    for (let generation = 0; generation < 7; generation += 1) {
                        assertStructurallySame(evaluate(current), expected, source)
                        assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                        assertEq(assertOk(tryStringify(current)), canonical, source)
                        current = graph(canonical)
                    }
                }
            }
        }
    },
    conditionalNormalResultsKeepRequiredFailuresAndSkippedBranches: () => {
        for (const source of /** @type {const} */ ([
            'const f=(n,a)=>n>0?f(n-1,a):a>0?null.left:[n];export default f(3,1);',
            'const f=(n,a)=>n===0?a>0?[n]:null.right:f(n-1,a);export default f(3,0);',
            'const f=(n,a)=>n>0?f(n-1,a):(()=>{const required=null.prefix;return null.condition?[n]:null.right;})();export default f(3,0);',
            'const f=(n,a)=>n===0?(()=>{const x=[a];return null.condition?x:null.right;})():f(n-1,a);export default f(3,0);',
            'const f=(n,a)=>n>0?f(n-1,a,null.tail):a>0?null.left:null.right;export default f(3,0);',
            'const f=(n,...xs)=>n===0?xs[0]>0?null.left:xs:f(n-1,...xs);export default f(3,1);',
            'const f=(...xs)=>xs[0]>0?f(xs[0]-1,xs[1]):xs[1]>0?xs:null.right;export default f(3,0);',
            'const f=()=>false?f():true?null.left:null.right;export default f();',
        ])) {
            const original = graph(source)
            const expected = failure(original)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(failure(current), expected, source)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
        for (const source of /** @type {const} */ ([
            'const f=(n,a)=>n>0?f(n-1,a):a>0?[n]:null.right;export default f(3,1);',
            'const f=(n,a)=>n===0?a>0?null.left:[n]:f(n-1,a);export default f(3,0);',
        ])) {
            const original = graph(source)
            assertStructurallySame(evaluate(original), [0])
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            assertStructurallySame(evaluate(graph(first)), [0])
        }
    },
    zeroInputNormalDefinitionsKeepSharingCapturesAndFirstParseFixedPoints: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['const f=()=>false?f():(()=>{const x=[];return[x,x];})();const a=f();const b=f();export default[a[0]===a[1],a[0]===b[0],a];', [true, false, [[], []]]],
            ['const f=()=>true?(()=>{const x=[];return[x,x];})():f();const a=f();const b=f();export default[a[0]===a[1],a[0]===b[0],a];', [true, false, [[], []]]],
            ['const seed=[9];const f=()=>false?f():(()=>{const x=[seed];return()=>x;})();const a=f();const b=f();export default[a()===a(),a()===b(),a()[0]===seed,a()];', [true, false, true, [[9]]]],
            ['const seed=[9];const f=()=>true?(()=>{const x=[seed];return()=>x;})():f();const a=f();const b=f();export default[a()===a(),a()===b(),a()[0]===seed,a()];', [true, false, true, [[9]]]],
            ['const seed=[9];const make=()=>seed;const f=()=>false?f():(()=>{const x=make();return[x,x];})();const a=f();export default[a[0]===seed,a[0]===a[1]];', [true, true]],
            ['const seed=[9];const make=()=>seed;const f=()=>true?(()=>{const x=make();return[x,x];})():f();const a=f();export default[a[0]===seed,a[0]===a[1]];', [true, true]],
            ['const seed=[9];const f=()=>false?f():(()=>{const pair=[seed];return[seed[0],()=>pair];})();const a=f();export default[a[0],a[1]()===a[1](),a[1]()[0]===seed];', [9, true, true]],
            ['const seed=[9];const f=()=>true?(()=>{const pair=[seed];return[seed[0],()=>pair];})():f();const a=f();export default[a[0],a[1]()===a[1](),a[1]()[0]===seed];', [9, true, true]],
        ]
        for (const [source, expected] of cases) {
            const original = graph(source)
            assertStructurallySame(evaluate(original), expected, source)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(evaluate(current), expected, source)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
    },
    zeroInputNormalDefinitionsKeepCapturedTestsAndFirstParseFixedPoints: () => {
        for (const baseFirst of /** @type {const} */ ([false, true])) {
            for (const base of /** @type {const} */ ([
                'const x=[];return[x,x];',
                'const x=make();return[x,x];',
                'const x=[seed];return[seed[0],()=>x];',
                'const required=make();const x=[seed];return[seed[0],x,x];',
                'const required=seed.x;const x=[seed];return[seed[0],()=>x];',
            ])) {
                const normal = `(()=>{${base}})()`
                const source = `export default (test,make,seed)=>{const f=()=>${baseFirst ? `test()?${normal}:f()` : `test()?f():${normal}`};return f;};`
                const first = assertOk(tryStringify(graph(source)))
                assert(first.includes('while('), first)
                const normalized = graph(first)
                const canonical = assertOk(tryStringify(normalized))
                let current = normalized
                for (let generation = 0; generation < 7; generation += 1) {
                    assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                    assertEq(assertOk(tryStringify(current)), canonical, source)
                    current = graph(canonical)
                }
            }
        }
    },
    zeroInputNormalDefinitionsKeepReachedFailuresAndFirstParseFixedPoints: () => {
        for (const source of /** @type {const} */ ([
            'const f=()=>false?f():(()=>{const required=null.x;const x=[];return[x,x];})();export default f();',
            'const f=()=>true?(()=>{const x=[];const required=null.x;return[x,x];})():f();export default f();',
            'const f=()=>true?f(null.x):(()=>{const x=[];return[x,x];})();export default f();',
            'const f=()=>false?(()=>{const x=[];return[x,x];})():f(null.x);export default f();',
            'const f=()=>false?f():(()=>{const x=[];return[x,x];})();export default f(null.x);',
            'const f=()=>{const required=null.x;return false?f():(()=>{const x=[];return[x,x];})();};export default f();',
        ])) {
            const original = graph(source)
            const expected = failure(original)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(failure(current), expected, source)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
    },
    observedRestPlainLoopsKeepReachedFailuresAndFirstParseFixedPoints: () => {
        for (const source of /** @type {const} */ ([
            'const f=(n,...xs)=>n>0?f(n-1,null.x):xs;export default f(1);',
            'const f=(n,...xs)=>n>0?f(n-1,...null):xs;export default f(1);',
            'const f=(n,...xs)=>n>0?f(n-1,...xs):xs;export default f(0,null.x);',
            'const f=(n,...xs)=>{const required=null.x;return n>0?f(n-1):xs;};export default f(0,7);',
            'const f=(n,...xs)=>n>0?f(n-1,...xs):xs[0].x;export default f(0,null);',
            'const f=(...xs)=>xs[0]>0?f(xs[0]-1,...null):xs;export default f(1);',
        ])) {
            const original = graph(source)
            const expected = failure(original)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(failure(current), expected, source)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
    },
    baseFirstRestOnlyKeepsArityFreshSnapshotsAndFirstParseFixedPoints: () => {
        const original = graph('const f=(...xs)=>xs[0]===0?xs:f(xs[0]-1,xs[1]+1);export default f;')
        const first = assertOk(tryStringify(original))
        assert(first.includes('while('), first)
        const normalized = graph(first)
        const canonical = assertOk(tryStringify(normalized))
        let current = normalized
        for (let generation = 0; generation < 7; generation += 1) {
            assertStructurallySame(evaluate(['()', current, [3, 0]]), [0, 3])
            assertEq(evaluate(['.', current, 'length']), 0)
            assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)))
            assertEq(assertOk(tryStringify(current)), canonical)
            current = graph(canonical)
        }
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['const sum=(...xs)=>xs[0]===0?xs[1]:sum(xs[0]-1,xs[1]+xs[0]);export default sum(4,0);', 10],
            ['const f=(...xs)=>{const n=xs[0];return n===0?xs:f(n-1,xs[1]+1);};export default f(3,0);', [0, 3]],
            ['const f=(...xs)=>xs.length===0?xs:f();const a=f(1);const b=f(1);export default [a===b,a,b];', [false, [], []]],
            ['const f=(...xs)=>xs[0]===0?[xs[2]===xs,xs===xs,xs[1]]:f(xs[0]-1,xs[1]+1,xs);export default f(3,0,null);', [false, true, 3]],
            ['const f=(...xs)=>xs[0]===0?[xs[1]()===xs[2],xs[1]()===xs,xs[1]()[0]]:f(xs[0]-1,()=>xs,xs);export default f(3,null,null);', [true, false, 1]],
            ['const seed=[9];const f=(...xs)=>xs[0]===0?[xs[1]===seed,xs[1]]:f(...[xs[0]-1,xs[1]]);export default f(3,seed);', [true, [9]]],
            ['const f=(...xs)=>xs[0]===0?xs:f(0,..."A𝄞",99);export default f(1);', [0, 'A', '𝄞', 99]],
            ['const f=(...xs)=>xs[0]?xs[1]:f({done:true},7);export default [f(false,4),f(null,1),f([],9)];', [7, 7, 9]],
            ['const f=(...xs)=>xs[0]===0?7:f(0,null.x);export default f(0);', 7],
        ]
        for (const [source, expected] of cases) {
            const initial = graph(source)
            assertStructurallySame(evaluate(initial), expected, source)
            const output = assertOk(tryStringify(initial))
            assert(output.includes('while('), output)
            const parsed = graph(output)
            const stable = assertOk(tryStringify(parsed))
            let current = parsed
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(evaluate(current), expected, source)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(parsed)), source)
                assertEq(assertOk(tryStringify(current)), stable, source)
                current = graph(stable)
            }
        }
    },
    baseFirstRestOnlyKeepsReachedFailuresAndFirstParseFixedPoints: () => {
        for (const source of /** @type {const} */ ([
            'const f=(...xs)=>xs[0]===0?xs:f(xs[0]-1,null.x);export default f(1);',
            'const f=(...xs)=>xs[0]===0?xs:f(...null);export default f(1);',
            'const f=(...xs)=>xs[0]===0?xs:f(xs[0]-1);export default f(0,null.x);',
            'const f=(...xs)=>{const required=null.x;return xs[0]===0?xs:f(0);};export default f(0);',
            'const f=(...xs)=>xs[0]===0?xs[1].x:f(xs[0]-1);export default f(0,null);',
            'const f=(...xs)=>xs[0].x?xs:f(0);export default f(null);',
        ])) {
            const original = graph(source)
            const expected = failure(original)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(failure(current), expected, source)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)), source)
                assertEq(assertOk(tryStringify(current)), canonical, source)
                current = graph(canonical)
            }
        }
    },
    multiInputIgnoredArgumentsKeepSharedPairOrdering: () => {
        const observer = /** @type {Exp} */ (['=>', 2, [], ['?:', ['===', ['arg', 0], ['arg', 1]], 0, ['throw', 'lost pair identity']]])
        /** @type {readonly (readonly [string, Exp])[]} */
        const cases = [
            ['export default observer=>{const f=(n,a)=>n>0?f(n-1,a+1,(()=>{const pair=[n,a];return observer(pair,pair);})()):a;return f;};', observer],
            ['export default holder=>{const f=(n,a)=>n>0?f(n-1,a+1,(()=>{const call=(()=>{const pair=[n,a];const required=pair===pair;return holder.observe;})();return call(n,a);})()):a;return f;};', graph('export default {observe:(n,a)=>7};')],
        ]
        for (const [source, argument] of cases) {
            const original = graph(source)
            assertEq(evaluate(['()', ['()', original, [argument]], [3, 0]]), 3)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertEq(evaluate(['()', ['()', current, [argument]], [3, 0]]), 3)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)))
                assertEq(assertOk(tryStringify(current)), canonical)
                current = graph(canonical)
            }
        }
    },
    multiInputSourceLoopsPreserveRequiredFailures: () => {
        /** @type {readonly string[]} */
        const sources = [
            'const f=(n,a)=>n>0?f(n-1,a,null.x):a;export default f(1,0);',
            'const f=(n,a)=>n>0?f(n-1,a,...null):a;export default f(1,0);',
            'const f=(n,a)=>n>0?f(n-1,a):a;export default f(0,7,null.x);',
            'const f=(n,a)=>{const required=null.x;return n>0?f(n-1,a):a;};export default f(0,7);',
            'const f=(n,a)=>n>0?f(n-1,a):null.x;export default f(0,7);',
        ]
        for (const source of sources) {
            const original = graph(source)
            failure(original)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                failure(current)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)))
                assertEq(assertOk(tryStringify(current)), canonical)
                current = graph(canonical)
            }
        }
    },
    recursiveSourceRoundTrips: () => {
        const sources = /** @type {const} */ ([
            'const f=(n,a)=>n===0?a:f(n-1,a+n);export default f(4,0);',
            'const f=n=>n===0?({done:true}):f(n-1);export default f(3);',
            'const f=(n,a,b)=>n===0?[a,b]:f(n-1,b,a);export default f(3,1,2);',
            'const f=(n,saved)=>n===0?saved:f(n-1,()=>n);export default f(2,null)();',
            'const f=(n,a)=>n>0?(n%2===0?f(n-2,a+2):f(n-1,a+1)):a;export default f(7,0);',
            'const f=(n,a)=>{const x=[n];return n===0?[a,x]:f(n-1,a+1)};export default f(3,0);',
            'const f=(n,a)=>n===0?a:f(n-1);export default f(3,9);',
            'const f=(n,a,b)=>n===0?[a,b]:f(n-1,b,a,[n]);export default f(3,1,2);',
            'const f=(n,saved)=>n===0?saved:f(n-1,()=>n,7);export default f(2,null)();',
            'const f=(n,a)=>n===0?a:f(...[n-1,a+1]);export default f(3,0);',
            'const f=(n,a,b)=>n===0?[a,b]:f(n-1,...[b],...[],a);export default f(3,1,2);',
            'const f=(n,saved)=>n===0?saved:f(...[n-1,()=>n]);export default f(2,null)();',
            'const f=(n,a,b)=>n===0?[a,b]:f(0,..."A𝄞",99);export default f(1);',
            'const f=(n,previous,...xs)=>n===0?[previous===xs,xs===xs,xs]:f(n-1,xs,...xs);export default f(3,null,7,8);',
            'const f=(n,saved,...xs)=>n===0?saved:f(n-1,()=>xs,n);export default f(3,null,9)();',
            'const f=(...xs)=>xs[0]===0?xs:f(xs[0]-1,xs[1]+1);export default f(3,0);',
            'const f=(n,previous,value=[])=>n===0?[previous===value,value===value]:f(n-1,value);export default f(3,null);',
            'const f=(n,{value}={value:0})=>n===0?value:f(n-1,{value:value+1});export default f(3);',
        ])
        for (const source of sources) {
            const original = graph(source)
            const first = assertOk(tryStringify(original))
            const restored = graph(first)
            assertStructurallySame(evaluate(restored), evaluate(original))
            const second = assertOk(tryStringify(restored))
            assertEq(assertOk(tryStringify(graph(second))), second)
            assert(!first.includes(':while(true)'), first)
        }
    },
    invocationSourceSetupHasAStableCanonicalSpelling: () => {
        for (const source of /** @type {const} */ ([
            'const f=n=>n>0?f(n-1,null.x):7;export default f;',
            'const f=n=>n>0?f(0,...null):7;export default f;',
            'const f=n=>n>0?f(...[0,null.x]):7;export default f;',
            'const f=(n,value=null.x)=>n>0?f(n-1):7;export default f;',
        ])) {
            const original = graph(source)
            const first = assertOk(tryStringify(original))
            const restored = graph(first)
            assertEq(evaluate(['()', original, [0, 9]]), 7)
            assertEq(evaluate(['()', restored, [0, 9]]), 7)
            failure(['()', original, [1, 9]])
            failure(['()', restored, [1, 9]])
            const canonical = assertOk(tryStringify(restored))
            // Physical while output separates its normal result from the loop.
            // Parsing that first spelling establishes the source normal form.
            const converted = assertOk(tryStringify(fromFast(assertOk(toFast(original)))))
            assertEq(assertOk(tryStringify(graph(converted))), canonical)
            assertEq(assertOk(tryStringify(graph(canonical))), canonical)
        }
    },
    commonPlacementAndScalarSpellingStayIntact: () => {
        const ordinary = /** @type {Block} */ (yielded(['+', 1, 2]))
        assertEq(assertOk(_sourceLoops(ordinary)), ordinary)
        const scalar = /** @type {Exp} */ (['=>', 1, [], ['?:', ['<', ['arg', 0], 3], ['()', ['self'], [['+', ['arg', 0], 1]]], ['arg', 0]]])
        const placed = fromAnalysis(assertOk(identityAnalysis(scalar)))
        assertEq(assertOk(_sourceLoops(placed)), placed)
        assert(assertOk(tryStringify(['()', scalar, [0]])).includes('while('))
        const binding = /** @type {const} */ ({ index: 0 })
        const plain = /** @type {Block} */ ({ statements: [['block', [], yielded(1)], ['define', binding, 1, 'required']],
            exit: ['yield', [['if', true, yielded(1), yielded(2)]]] })
        assertEq(assertOk(_sourceLoops(plain)), plain)
    },
    emptyAndThrowingInvocationRoots: () => {
        const empty = _tailFunction(['=>', 0, [], ['()', ['self'], []]])
        const divergent = yielded(['function', empty])
        assertEq(assertOk(_sourceLoops(divergent)), divergent)
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const output = /** @type {const} */ ({ index: 0 })
        /** @type {Block} */
        const terminal = { statements: [], exit: ['loop', { target, parameters: [], initial: [], results: [],
            body: { statements: [], exit: ['continue', target, []] } }] }
        assertEq(assertOk(_sourceLoops(terminal)), terminal)
        const throwing = /** @type {FastFunction} */ ({ ...empty, body: {
            statements: [['loop', { target, parameters: [], initial: [], results: [output], body: { statements: [], exit: ['throw', 'stopped'] } }]],
            exit: ['return', empty.target, ['ref', output]],
        } })
        const stopped = yielded(['function', throwing])
        assertEq(assertOk(_sourceLoops(stopped)), stopped)
        const multi = _tailFunction(counter)
        const loop = multi.body.statements.at(-1)
        assert(loop !== undefined && loop[0] === 'loop')
        /** @type {FastFunction} */
        const multiThrowing = { ...multi, body: { ...multi.body,
            statements: [...multi.body.statements.slice(0, -1), ['loop', { ...loop[1], body: { statements: [], exit: ['throw', 'fallback stopped'] } }]],
        } }
        const retained = yielded(['function', multiThrowing])
        assertEq(assertOk(_sourceLoops(retained)), retained)
        failure(['()', fromFast(retained), [3, 0]])
        const original = graph('const f=n=>n>0?f(n-1):(()=>{throw 1})();export default f(3);')
        const written = assertOk(tryStringify(original))
        failure(original)
        failure(graph(written))
        const extra = graph('const f=n=>n===0?0:f(n-1,(()=>{throw 7})());export default f(1);')
        failure(extra)
        failure(graph(assertOk(tryStringify(extra))))
        const prefixed = /** @type {Exp} */ (['=>', 0, [], [',', [['throw', 1], 0]]])
        const restored = graph(assertOk(tryStringify(prefixed)))
        failure(['()', prefixed, []])
        failure(['()', restored, []])
    },
    zeroInputRootsKeepStableSourceLoops: () => {
        const recur = /** @type {Exp} */ (['()', ['self'], []])
        const flag = /** @type {Exp} */ (['[]', [false]])
        const payload = /** @type {Exp} */ (['[]', ['capture']])
        /** @type {readonly Exp[]} */
        const functions = [
            ['=>', 0, [], recur],
            ['=>', 0, [], ['?:', true, recur, ['throw', 7]]],
            ['=>', 0, [], ['?:', false, ['throw', 7], recur]],
            ['=>', 0, [], [',', [['throw', 'reached prefix'], recur]]],
            ['=>', 0, [flag, payload], ['?:', ['.', ['frame', 0], 0], recur, ['throw', ['.', ['frame', 1], 0]]]],
        ]
        for (const original of functions) {
            const first = assertOk(tryStringify(original))
            assert(first.includes('while(true)'), first)
            assert(!first.includes(':while('), first)
            const normalized = graph(first)
            const expected = assertOk(identityAnalysis(normalized))
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                const written = assertOk(tryStringify(current))
                assertEq(written, canonical)
                assert(written.includes('while('), written)
                current = graph(written)
                assertStructurallySame(assertOk(identityAnalysis(current)), expected)
            }
        }
    },
    zeroInputNormalResultsKeepSourceLoops: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['const f=()=>false?f():7;export default f();', 7],
            ['const f=()=>true?7:f();export default [f.length,f(8,...[9])];', [0, 7]],
            ['const f=()=>false?f((()=>{throw 7;})()):8;export default f();', 8],
            ['const a=[3];const b=[4];const f=()=>false?f():[b,a];const first=f();const second=f();export default [f.length,first!==second,first[0]===second[0],first[1]===a,first[0]===b];', [0, true, true, true, true]],
            ['const f=()=>false?f():null;export default f();', null],
            ['const f=()=>true?({done:7}):f();export default f();', { done: 7 }],
            ['const captured=[4];const f=()=>false?f():()=>captured;const first=f();const second=f();export default [f.length,first!==second,first()===second(),first()===captured];', [0, true, true, true]],
            ['const f=()=>{const reached=[7];return reached===reached?7:f();};export default f();', 7],
            ['const f=()=>false?f(...[7,8]):9;export default f(...[1,2]);', 9],
        ]
        for (const [source, expected] of cases) {
            const original = graph(source)
            assertStructurallySame(evaluate(original), expected)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            assert(!first.includes(':while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertStructurallySame(evaluate(current), expected)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)))
                assertEq(assertOk(tryStringify(current)), canonical)
                assert(canonical.includes('while('), canonical)
                current = graph(canonical)
            }
        }
    },
    zeroInputNormalResultsPreserveReachedFailures: () => {
        /** @type {readonly string[]} */
        const sources = [
            'const f=()=>false?f():null.x;export default f();',
            'const f=()=>true?null.x:f();export default f();',
            'const f=()=>{const reached=null.x;return false?f():7;};export default f();',
            'const f=()=>false?f():7;export default f((()=>{throw 7;})());',
            'const f=()=>false?f():7;export default f(...null);',
        ]
        for (const source of sources) {
            const original = graph(source)
            failure(original)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                failure(current)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)))
                assertEq(assertOk(tryStringify(current)), canonical)
                current = graph(canonical)
            }
        }
    },
    zeroInputRootsPreserveReachedFailures: () => {
        const recur = /** @type {Exp} */ (['()', ['self'], []])
        const divergent = /** @type {Exp} */ (['=>', 0, [], recur])
        const flag = /** @type {Exp} */ (['[]', [false]])
        const payload = /** @type {Exp} */ (['[]', ['capture']])
        /** @type {readonly (readonly [Exp, string])[]} */
        const cases = [
            [['()', ['=>', 0, [], ['?:', true, ['throw', 'body'], recur]], []], 'body'],
            [['()', ['=>', 0, [], [',', [['throw', 'prefix'], recur]]], []], 'prefix'],
            [['()', ['=>', 0, [], ['?:', true, ['()', ['self'], [['throw', 'recursive argument']]], ['throw', 'skipped result']]], []], 'recursive argument'],
            [['()', divergent, [['throw', 'initial argument']]], 'initial argument'],
            [['()', ['=>', 0, [flag, payload], ['?:', ['.', ['frame', 0], 0], recur, ['throw', ['.', ['frame', 1], 0]]]], []], 'capture'],
        ]
        for (const [original, expected] of cases) {
            assertEq(failure(original), expected)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            let current = normalized
            for (let generation = 0; generation < 7; generation += 1) {
                assertEq(failure(current), expected)
                assertStructurallySame(assertOk(identityAnalysis(current)), assertOk(identityAnalysis(normalized)))
                assertEq(assertOk(tryStringify(current)), canonical)
                current = graph(canonical)
            }
        }
    },
    nestedSourceValuesRetainTheirExecutionRegions: () => {
        // An owning value return removes its one-pass wrapper. Every containing
        // value must be remapped without crossing an ordinary function owner.
        const fn = valueReturnFunction()
        /** @type {Value} */
        const inner = ['function', fn]
        const original = yielded(inner)
        const converted = assertOk(_sourceLoops(original))
        assert(converted !== original)
        for (const candidate of [original, converted]) {
            assertEq(evaluate(['()', fromFast(candidate), [0]]), 7)
            assertEq(evaluate(['()', fromFast(candidate), [3]]), 3)
            failure(['()', fromFast(candidate), [-1]])
        }
        const binding = /** @type {const} */ ({ index: 0 })
        const parameter = /** @type {const} */ ({ index: 0 })
        const output = /** @type {const} */ ({ index: 0 })
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const own = /** @type {FastFunction} */ ({ ...fn, target: owner, parameters: [], self: null,
            body: { statements: [], exit: ['return', owner, inner] }, captures: [{ binding, value: inner }] })
        const loop = /** @type {Loop} */ ({ target, parameters: [parameter], initial: [inner], results: [output], body: { statements: [], exit: ['break', target, [inner]] } })
        const statements = /** @type {Block['statements']} */ ([
            ['define', binding, inner, 'required'], ['block', [], yielded(inner)],
            ['if', [], inner, yielded(inner), yielded(inner)], ['loop', loop],
        ])
        const values = /** @type {readonly Value[]} */ ([
            inner, ['block', yielded(inner)], ['if', inner, yielded(inner), yielded(inner)], ['function', own], ['array', [inner]],
        ])
        for (const value of values) {
            const source = /** @type {Block} */ ({ statements, exit: ['yield', [value]] })
            assert(assertOk(_sourceLoops(source)) !== source)
        }
        /** @type {readonly Block['exit'][]} */
        const exits = [['throw', inner], ['continue', target, [inner]], ['return', fn.target, inner],
            ['loop', { ...loop, results: [], body: { statements: [], exit: ['throw', inner] } }],
        ]
        for (const exit of exits) {
            const source = /** @type {Block} */ ({ statements: [], exit })
            assert(assertOk(_sourceLoops(source)) !== source)
        }
    },
    owningValueReturnsKeepTheirThrowingTail: () => {
        const fn = valueReturnFunction()
        const statement = fn.body.statements.at(-1)
        assert(statement !== undefined && statement[0] === 'loop')
        /** @type {FastFunction} */
        const throwing = { ...fn, body: { ...fn.body, statements: [['loop', { ...statement[1], body: {
            statements: statement[1].body.statements.slice(0, 1), exit: ['throw', 'following failure'],
        } }]] } }
        const original = yielded(['function', throwing])
        const converted = assertOk(_sourceLoops(original))
        assert(converted !== original)
        for (const candidate of [original, converted]) {
            assertEq(evaluate(['()', fromFast(candidate), [0]]), 7)
            failure(['()', fromFast(candidate), [3]])
        }
    },
    owningValueReturnsKeepUnsupportedNormalContinuationsRefused: () => {
        const fn = valueReturnFunction()
        const statement = fn.body.statements.at(-1)
        assert(statement !== undefined && statement[0] === 'loop')
        const loop = statement[1]
        const unused = /** @type {const} */ ({ index: 0 })
        /** @type {Statement} */
        const normal = ['if', [], true, { statements: [], exit: ['yield', []] }, { statements: [], exit: ['yield', []] }]
        /** @type {readonly Block[]} */
        const bodies = [
            { statements: [...loop.body.statements.slice(0, 1), normal], exit: ['break', loop.target, [9]] },
            { statements: [...loop.body.statements.slice(0, 1), normal, ['define', unused, 1, 'required']], exit: ['break', loop.target, [9]] },
        ]
        for (const body of bodies) {
            /** @type {FastFunction} */
            const unsupported = { ...fn, body: { ...fn.body, statements: [['loop', { ...loop, body }]] } }
            const source = yielded(['function', unsupported])
            const original = fromFast(source)
            assertEq(evaluate(['()', original, [0]]), 7)
            assertEq(evaluate(['()', original, [3]]), 9)
            assertEq(assertError(_sourceLoops(source)), 'a factored terminal continuation outside the source loop profile')
        }
    },
    deepValuesRetainIdentity: () => {
        /** @type {Value} */
        let value = 1
        for (let depth = 0; depth < 20_000; depth += 1) { value = ['~', value] }
        const source = yielded(value)
        assertEq(assertOk(_sourceLoops(source)), source)
    },
})
