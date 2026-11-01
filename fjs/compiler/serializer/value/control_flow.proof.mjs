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

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { identityAnalysis } from '../../../edag/analysis/module.f.mjs'
import { controlFlowFunctions } from '../../../edag/from_fast/control_flow.proof.f.mjs'
import { fromFast } from '../../../edag/from_fast/module.f.mjs'
import { fromAnalysis } from '../../../edag/to_fast/module.f.mjs'
import { prepare } from '../../../js/ast/prepare/module.f.mjs'
import { stringify as javascript } from '../../../js/ast/serializer/module.f.mjs'
import { _defaultExport, unresolved } from '../../edag/module.f.mjs'
import { parse } from '../../source/module.f.mjs'
import { tryStringify } from '../module.f.mjs'

/** @type {(source: string) => Exp} */
const sourceGraph = source => _defaultExport(unresolved(assertOk(parse('/control-flow.f.mjs')(source))).edag)

/** General code-only output consumes the unevaluated source graph directly.
 * @type {(graph: Exp) => string}
 */
const codeOnly = graph => javascript(prepare(fromAnalysis(assertOk(identityAnalysis(graph)))), 'module', true)

/** Both output APIs must reach native execution for these admitted profiles.
 * @type {(source: string) => readonly string[]}
 */
const outputs = source => {
    const graph = sourceGraph(source)
    return [codeOnly(graph), assertOk(tryStringify(graph))]
}

/** Load real module syntax without creating files.
 * @type {(source: string) => Promise<any>}
 */
const load = async source => (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default

export const proof = {
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
        const source = 'export default c=>c?(()=>{const x=5;return x*x;})():(()=>{const y=6;return y*y;})();'
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
        const source = 'export default (f,g)=>{let a=0;const x=f(a);a=a+1;return g(a)+x;};'
        for (const text of outputs(source)) {
            const apply = await load(text)
            assertEq(apply(
                /** @param {number} a */ a => { assertEq(a, 0); return 3 },
                /** @param {number} a */ a => { assertEq(a, 1); return 10 },
            ), 13)
        }
    },
    referenceBreakIncludesPrecedingUpdate: async () => {
        const source = 'export default (x,c)=>{let a=0;let b=1;while(true){if(x(b)){b+=1;break;}if(x(a)){a+=2;continue;}a+=b;b+=1;}return c(b,a);};'
        for (const text of outputs(source)) {
            const apply = await load(text)
            assertStructurallySame(apply(
                /** @param {number} value */ value => value === 0 || value === 4,
                /** @type {(b: number, a: number) => readonly number[]} */ ((b, a) => [b, a]),
            ), [5, 8])
        }
    },
    referenceBreakAndOwningReturn: async () => {
        const source = 'export default (x,m,c)=>{let a=0;while(true){a+=1;if(x(a)){break;}a+=1;if(x(a)){return m(a);}a+=1;}return c(a);};'
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
        const source = 'export default initial=>{let m=initial;const ignored=(()=>{m=[m];return undefined;})();return [m,m];};'
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
        const source = 'export default (c,n)=>{const value=c?(()=>{n+=1;return n;})():n;return [value,n];};'
        for (const text of outputs(source)) {
            const apply = await load(text)
            assertStructurallySame(apply(false, 5), [5, 5])
            assertStructurallySame(apply(true, 5), [6, 6])
        }
    },
    suppliedNestedJoinKeepsNativeReturnOwnership: async () => {
        const graph = fromFast({ statements: [], exit: ['yield', [['function', controlFlowFunctions.nested]]] })
        const apply = await load(codeOnly(graph))
        const skipped = () => { throw 'unselected computation' }
        /** @param {number} value */
        const following = value => value * 10
        assertEq(apply(false, 5, skipped, following), 50)
        assertEq(apply(true, 5, () => ({ a: 7, b: false, c: 99 }), following), 70)
        assertEq(apply(true, 5, () => ({ a: 7, b: true, c: 99 }), skipped), 99)
    },
    suppliedParameterizedContinuationsKeepNativeInputs: async () => {
        for (const fn of [controlFlowFunctions.parameterizedJoin, controlFlowFunctions.parameterizedHelper]) {
            const graph = fromFast({ statements: [], exit: ['yield', [['function', fn]]] })
            const apply = await load(codeOnly(graph))
            /** @param {number} value */
            const operation = value => {
                const allocation = [value]
                return [allocation, allocation]
            }
            for (const [selected, stop, expected] of /** @type {const} */ ([
                [false, false, 5], [false, true, 5], [true, false, 8],
            ])) {
                const result = apply(selected, stop, operation)
                assertEq(result[0], result[1])
                assertStructurallySame(result, [[expected], [expected]])
            }
            assertEq(apply(true, true, () => { throw 'unselected continuation' }), 42)
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
        const source = 'export default n=>{let i=0;let sum=0;while(i<n){sum+=i;i+=1;}return sum;};'
        for (const text of outputs(source)) {
            assert(text.includes('while('), text)
            const apply = await load(text)
            assertEq(apply(100_000), 4_999_950_000)
        }
    },
    suppliedSharedTailProfileHasSourceRefusal: async () => {
        // This is supplied EDAG, not two independently written source calls.
        // Source reconstruction currently refuses its shared continuation;
        // the general writer still lowers and executes the self tail loop.
        const call = /** @type {Exp} */ (['()', ['self'], [
            ['-', ['arg', 0], 1], ['+', ['arg', 1], 1],
        ]])
        const graph = /** @type {Exp} */ (['=>', 2, [], ['?:',
            ['>', ['arg', 0], 0],
            ['?:', ['===', ['arg', 1], 0], call, call],
            ['arg', 1],
        ]])
        assertEq(assertError(tryStringify(graph)), 'a factored terminal continuation outside the source loop profile')
        const text = codeOnly(graph)
        assert(text.includes('while('), text)
        const apply = await load(text)
        assertEq(apply(100_001, 0), 100_001)
        assertEq(apply(3, 7), 10)
    },
}
