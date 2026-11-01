/**
 * Source control flow crosses the real generated-JavaScript execution boundary.
 * FunctionalScript proofs cover the pure representations; they cannot import
 * emitted modules or invoke the ordinary host functions those modules export.
 * These cases compare the general code-only writer with admitted FJS source
 * output, using immutable inputs and explicit source function returns.
 *
 * @import { Exp } from '../../../edag/types.ts'
 */

import { Buffer } from 'node:buffer'
import { throws } from 'node:assert/strict'

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { identityAnalysis } from '../../../edag/analysis/module.f.mjs'
import { _controlFlowFunctions } from '../../../edag/from_fast/control_flow.proof.f.mjs'
import { fromFast } from '../../../edag/from_fast/module.f.mjs'
import { fromAnalysis } from '../../../edag/to_fast/module.f.mjs'
import { prepare } from '../../../js/ast/prepare/module.f.mjs'
import { stringify as javascript } from '../../../js/ast/serializer/module.f.mjs'
import { _defaultExport, unresolved } from '../../edag/module.f.mjs'
import { parse } from '../../source/module.f.mjs'
import { tryModuleStringify, tryStringify } from '../module.f.mjs'

/** @type {(source: string) => Exp} */
const sourceGraph = source => _defaultExport(unresolved(assertOk(parse('/control-flow.f.mjs')(source))).edag)

/** General code-only output consumes the unevaluated source graph directly.
 * @type {(graph: Exp) => string}
 */
const codeOnly = graph => javascript(prepare(fromAnalysis(assertOk(identityAnalysis(graph)))), 'module', true)

/** Public source output must be accepted by the unchanged source parser.
 * @type {(graph: Exp) => readonly string[]}
 */
const graphOutputs = graph => {
    const source = assertOk(tryStringify(graph))
    assertOk(parse('/emitted-control-flow.f.mjs')(source))
    return [codeOnly(graph), source]
}

/** Both output APIs must reach native execution for these admitted profiles.
 * @type {(source: string) => readonly string[]}
 */
const outputs = source => graphOutputs(sourceGraph(source))

/** Load real module syntax without creating files.
 * @type {(source: string) => Promise<Readonly<Record<string, any>>>}
 */
const loadModule = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

/** Load a real default-export module.
 * @type {(source: string) => Promise<any>}
 */
const load = async source => (await loadModule(source)).default

/** A callback that must stay in an unselected region. @type {() => never} */
const unselected = () => { throw 'unselected computation' }

/** The nested fixture's normal continuation. @type {(value: number) => number} */
const timesTen = value => value * 10

/** Keep the break result's argument order. @type {(b: number, a: number) => readonly [number, number]} */
const breakPair = (b, a) => [b, a]

/** One fresh allocation is shared by both returned positions. @param {number} value */
const sharedAllocationPair = value => {
    const allocation = /** @type {const} */ ([value])
    return /** @type {const} */ ([allocation, allocation])
}

/** Both conditional arms reference the same call, rather than equal calls.
 * @type {() => Exp}
 */
const sharedTailGraph = () => {
    /** @type {Exp} */
    const call = ['()', ['self'], [
        ['-', ['arg', 0], 1], ['+', ['arg', 1], 1],
    ]]
    return ['=>', 2, [], ['?:',
        ['>', ['arg', 0], 0],
        ['?:', ['===', ['arg', 1], 0], call, call],
        ['arg', 1],
    ]]
}

export const proof = /** @type {const} */ ({
    referenceConditionalExpression: async () => {
        const left = /** @type {const} */ ([1])
        const right = /** @type {const} */ ([2])
        for (const text of outputs('export default (c,a,b)=>c?a:b;')) {
            const choose = await load(text)
            assertEq(choose(true, left, right), left)
            assertEq(choose(false, left, right), right)
        }
    },
    referenceExpressionBlocks: async () => {
        const source = /** @type {const} */ ('export default c=>c?(()=>{const x=5;return x*x;})():(()=>{const y=6;return y*y;})();')
        for (const text of outputs(source)) {
            const choose = await load(text)
            assertEq(choose(true), 25)
            assertEq(choose(false), 36)
        }
    },
    referenceTerminatingGuard: async () => {
        for (const text of outputs('export default (a,f,g)=>{if(a){return f();}return g();};')) {
            const choose = await load(text)
            assertEq(choose(true, () => 7, () => { throw 'unselected g' }), 7)
            assertEq(choose(false, () => { throw 'unselected f' }, () => 9), 9)
        }
    },
    referenceReassignmentVersions: async () => {
        const source = /** @type {const} */ ('export default (f,g)=>{let a=0;const x=f(a);a=a+1;return g(a)+x;};')
        for (const text of outputs(source)) {
            const apply = await load(text)
            assertEq(apply(
                /** @param {number} a */ a => { assertEq(a, 0); return 3 },
                /** @param {number} a */ a => { assertEq(a, 1); return 10 },
            ), 13)
        }
    },
    referenceBreakIncludesPrecedingUpdate: async () => {
        const source = /** @type {const} */ ('export default (x,c)=>{let a=0;let b=1;while(true){if(x(b)){b+=1;break;}if(x(a)){a+=2;continue;}a+=b;b+=1;}return c(b,a);};')
        for (const text of outputs(source)) {
            const apply = await load(text)
            assertStructurallySame(apply(
                /** @param {number} value */ value => value === 0 || value === 4,
                breakPair,
            ), [5, 8])
        }
    },
    referenceBreakAndOwningReturn: async () => {
        const source = /** @type {const} */ ('export default (x,m,c)=>{let a=0;while(true){a+=1;if(x(a)){break;}a+=1;if(x(a)){return m(a);}a+=1;}return c(a);};')
        for (const text of outputs(source)) {
            const apply = await load(text)
            for (const [stop, expected] of /** @type {const} */ ([
                [1, ['break', 1]], [2, ['return', 2]], [4, ['break', 4]],
            ])) {
                assertStructurallySame(apply(
                    /** @param {number} value */ value => value === stop,
                    /** @param {number} value */ value => ['return', value],
                    /** @param {number} value */ value => ['break', value],
                ), expected)
            }
        }
    },
    referenceWhileConditionAndExplicitReturn: async () => {
        const sources = /** @type {const} */ ([
            'export default c=>{let a=0;while(c(a)){a+=1;}return a;};',
            'export default c=>{let a=0;while(true){if(c(a)){a+=1;continue;}break;}return a;};',
        ])
        for (const source of sources) {
            for (const text of outputs(source)) {
                assert(text.includes('while('), text)
                const apply = await load(text)
                assertEq(apply(/** @param {number} value */ value => value < 100_001), 100_001)
            }
        }
    },
    immediateWriteKeepsOneSharedAllocation: async () => {
        const source = /** @type {const} */ ('export default initial=>{let m=initial;const ignored=(()=>{m=[m];return undefined;})();return [m,m];};')
        const initial = /** @type {const} */ ([7])
        for (const text of outputs(source)) {
            const apply = await load(text)
            const first = apply(initial)
            const second = apply(initial)
            assertEq(first[0], first[1])
            assertEq(first[0][0], initial)
            assertEq(second[0], second[1])
            assert(first[0] !== second[0])
        }
    },
    expressionJoinKeepsSelectedWrite: async () => {
        const source = /** @type {const} */ ('export default (c,n)=>{const value=c?(()=>{n+=1;return n;})():n;return [value,n];};')
        for (const text of outputs(source)) {
            const apply = await load(text)
            assertStructurallySame(apply(false, 5), [5, 5])
            assertStructurallySame(apply(true, 5), [6, 6])
        }
    },
    suppliedNestedJoinKeepsNativeReturnOwnership: async () => {
        const graph = fromFast({ statements: [], exit: ['yield', [['function', _controlFlowFunctions.nested]]] })
        for (const text of graphOutputs(graph)) {
            const apply = await load(text)
            assertEq(apply(false, 5, unselected, timesTen), 50)
            assertEq(apply(true, 5, () => ({ a: 7, b: false, c: 99 }), timesTen), 70)
            assertEq(apply(true, 5, () => ({ a: 7, b: true, c: 99 }), unselected), 99)
        }
    },
    suppliedParameterizedContinuationsKeepNativeInputs: async () => {
        for (const fn of [_controlFlowFunctions.parameterizedJoin, _controlFlowFunctions.parameterizedHelper]) {
            const graph = fromFast({ statements: [], exit: ['yield', [['function', fn]]] })
            for (const text of graphOutputs(graph)) {
                const apply = await load(text)
                for (const [selected, stop, expected] of /** @type {const} */ ([
                    [false, false, 5], [false, true, 5], [true, false, 8],
                ])) {
                    const result = apply(selected, stop, sharedAllocationPair)
                    assertEq(result[0], result[1])
                    assertStructurallySame(result, [[expected], [expected]])
                }
                assertEq(apply(true, true, unselected), 42)
            }
        }
    },
    authoredSelfTailCallsUseDeepLoops: async () => {
        const sources = /** @type {const} */ ([
            'const loop=(n,a,b)=>n===0?[a,b]:loop(n-1,b,a);export default loop;',
            'const loop=(n,a,b)=>n===0?[a,b]:(()=>loop(n-1,b,a))();export default loop;',
        ])
        for (const source of sources) {
            for (const text of outputs(source)) {
                assert(text.includes('while('), text)
                const apply = await load(text)
                assertEq(apply.length, 3)
                assertStructurallySame(apply(100_001, 1, 2), [2, 1])
            }
        }
    },
    generatedLoopHelperUsesDeepLoop: async () => {
        const source = /** @type {const} */ ('export default n=>{let i=0;let sum=0;while(i<n){sum+=i;i+=1;}return sum;};')
        for (const text of outputs(source)) {
            assert(text.includes('while('), text)
            const apply = await load(text)
            assertEq(apply(100_000), 4_999_950_000)
        }
    },
    suppliedSharedTailProfileUsesDeepLoops: async () => {
        for (const text of graphOutputs(sharedTailGraph())) {
            assert(text.includes('while('), text)
            const apply = await load(text)
            assertEq(apply(100_001, 0), 100_001)
            assertEq(apply(3, 7), 10)
        }
    },
    sharedTailPrefixKeepsSelectedFailure: async () => {
        /** @type {Exp} */
        const call = ['()', ['self'], [
            ['-', ['arg', 0], 1], ['+', ['arg', 1], 1], ['arg', 2],
        ]]
        /** @type {Exp} */
        const graph = ['=>', 3, [], ['?:',
            ['>', ['arg', 0], 0],
            [',', [['()', ['arg', 2], []], ['?:', ['===', ['arg', 1], 0], call, call]]],
            ['arg', 1],
        ]]
        for (const text of graphOutputs(graph)) {
            assert(text.includes('while('), text)
            const apply = await load(text)
            assertEq(apply(0, 7, unselected), 7)
            throws(() => apply(1, 7, unselected))
            assertEq(apply(100_001, 0, () => undefined), 100_001)
        }
    },
    sharedTailRestKeepsInvocationArguments: async () => {
        /** @type {Exp} */
        const call = ['()', ['self'], [['-', ['arg', 0], 1], 7]]
        /** @type {Exp} */
        const graph = ['=>', 1, [], ['?:',
            ['>', ['arg', 0], 0],
            ['?:', ['===', ['%', ['arg', 0], 2], 0], call, call],
            ['rest'],
        ]]
        const initial = /** @type {const} */ ([5])
        for (const text of graphOutputs(graph)) {
            assert(text.includes('while('), text)
            const apply = await load(text)
            assertEq(apply.length, 1)
            const first = apply(0, initial)
            const second = apply(0, initial)
            assertEq(first[0], initial)
            assertEq(second[0], initial)
            assert(first !== second)
            assertStructurallySame(apply(100_001, initial), [7])
        }
    },
    namedExportsKeepSharedControlProfiles: async () => {
        const nested = fromFast({ statements: [], exit: ['yield', [['function', _controlFlowFunctions.nested]]] })
        /** @type {Exp} */
        const graph = ['{}', [
            [':', 'nested', nested], [':', 'tail', sharedTailGraph()],
        ]]
        const source = assertOk(tryModuleStringify(graph))
        assertOk(parse('/named-control-flow.f.mjs')(source))
        const general = await load(codeOnly(graph))
        const exported = await loadModule(source)
        for (const module of [general, exported]) {
            assertEq(module.nested(false, 5, unselected, timesTen), 50)
            assertEq(module.nested(true, 5, () => ({ a: 7, b: true, c: 99 }), unselected), 99)
            assertEq(module.tail(100_001, 0), 100_001)
        }
    },
})
