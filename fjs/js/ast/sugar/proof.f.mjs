/**
 * @import { Exp } from '../../../edag/types.ts'
 * @import { Function as FastFunction } from '../types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { parse } from '../../../compiler/source/module.f.mjs'
import { tryModuleStringify } from '../../../compiler/serializer/module.f.mjs'
import { fromFast } from '../../../edag/from_fast/module.f.mjs'
import { freeLoopBindings } from '../../../edag/from_fast/control/module.f.mjs'
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
    compoundEagerWritesNormalizeToTheExistingBinaryValues: () => {
        for (const [tag, left, right] of [
            ['+', '8', '3'], ['-', '8', '3'], ['*', '8', '3'], ['/', '8', '2'],
            ['%', '8', '3'], ['**', '2', '3'], ['<<', '3', '2'], ['>>', '-8', '2'],
            ['>>>', '-8', '2'], ['&', '7', '3'], ['^', '7', '3'], ['|', '4', '3'],
            ['+', '"a"', '"b"'], ['>>', '8n', '1n'],
        ]) {
            assertStructurallySame(
                graph(`let value=${left};value ${tag}= ${right};export default value;`),
                graph(`let value=${left};value=value ${tag} ${right};export default value;`), tag)
        }
        assertStructurallySame(result('let value=8;value+=value;export default value;'), { default: 16 })
    },
    compoundLogicalWritesExistOnlyInTheSelectedRegion: () => {
        for (const tag of ['&&', '||', '??']) {
            const normalized = fn(`export default (value,right)=>{value ${tag}= right;return value;};`)
            const branch = normalized.body.statements.find(statement => statement[0] === 'if')
            assert(branch !== undefined && branch[0] === 'if')
            const selected = tag === '||' ? branch[4] : branch[3]
            const skipped = tag === '||' ? branch[3] : branch[4]
            assertEq(branch[1].length, 2)
            assertEq(selected.statements.length, 1)
            assertEq(selected.statements[0][0], 'define')
            assertEq(skipped.statements.length, 0)
            assert(skipped.exit[0] === 'yield')
            const previous = skipped.exit[1][0]
            assert(previous instanceof Array && previous[0] === 'ref')
            assertEq(previous[1], normalized.parameters[0])
            assertStructurallySame(result(`let value=null;value ${tag}= 37;export default value;`),
                { default: tag === '&&' ? null : 37 })
        }
        const skipped = /** @type {const} */ ([
            ['let value=0;value&&=null.x;export default value;', 0],
            ['let value=1;value||=null.x;export default value;', 1],
            ['let value=false;value??=null.x;export default value;', false],
        ])
        for (const [source, expected] of skipped) { assertStructurallySame(result(source), { default: expected }) }
        assertStructurallySame(result('const initial=[];let value=initial;value??=null.x;export default value===initial;'), { default: true })
    },
    terminalLoopsHaveNoNormalResultsOrConditionFalseExit: () => {
        for (const body of ['', 'continue;']) {
            // Inspect deliberate divergence; never execute either function.
            const normalized = fn(`export default ()=>{while(true){${body}}};`)
            assertEq(normalized.body.statements.length, 1)
            const loop = normalized.body.statements[0]
            assert(loop[0] === 'loop')
            assertEq(loop[1].parameters.length, 0)
            assertEq(loop[1].results.length, 0)
            assertEq(loop[1].body.statements.length, 0)
            assert(loop[1].body.exit[0] === 'continue')
            assertEq(loop[1].body.exit[1], loop[1].target)
            // FAST requires an exit record even after a non-completing loop.
            // The unreachable guard is not an implicit returned undefined.
            assertStructurallySame(normalized.body.exit, ['throw', 'a terminal loop completed normally'])
        }
    },
    terminalLoopReturnsKeepTheirOwningFunction: () => {
        const cases = /** @type {const} */ ([
            ['export default (()=>{let n=0;while(true){n=n+1;if(n===4){return n;}}})();', 4],
            ['export default (()=>{let n=0;while(true){n=n+1;if(n<3){continue;}return n;}})();', 3],
            ['export default (()=>{while(true){while(true){break;}return 7;}})();', 7],
            ['export default (()=>{let n=0;while(true){n=n+1;switch(n){case 1:{continue;}default:{break;}}return n;}})();', 2],
            ['export default (()=>{if(true){while(true){return 5;}}return 9;})();', 5],
            ['export default (()=>{switch(1){case 1:{while(true){return 6;}}default:{return 9;}}})();', 6],
            ['export default (()=>{while(true){const inner=()=>{while(true){return 11;}};return inner();}})();', 11],
        ])
        for (const [source, expected] of cases) { assertStructurallySame(result(source), { default: expected }, source) }
        assertError(memo(assertOk(analysis(graph('export default (()=>{while(true){throw "terminal failure";}})();'))))({ args: [] }))
    },
    terminalLoopRegionsPreserveExpressionBlockUpdates: () => {
        const cases = /** @type {const} */ ([
            ['export default (()=>{let n=0;while(true){const reached=(()=>{n+=1;return n;})();if(reached<3){continue;}return n;}})();', 3],
            ['export default (()=>{let n=0;let count=0;while(true){while((()=>{n+=1;return n<3;})()){count+=1;}return [n,count];}})();', [3, 2]],
            ['export default (()=>{let n=0;while(true){switch((()=>{n+=1;return n;})()){case 1:{continue;}default:{return n;}}}})();', 2],
        ])
        for (const [source, expected] of cases) { assertStructurallySame(result(source), { default: expected }, source) }
    },
    switchBreaksMergeStateAndResumeTheirLoop: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{let i=0;let sum=0;while(i<4){i=i+1;switch(i){case 1:{sum=sum+10;break;}case 2:{continue;}default:{sum=sum+i;break;}}sum=sum+100;}return [i,sum];})();', [4, 317]],
            ['export default (()=>{let i=0;let x=1;let y=2;while(i<3){i=i+1;switch(i){case 1:{x=y;y=x+1;break;}case 3:{y=x+y;break;}}x=x+10;}return [i,x,y];})();', [3, 32, 25]],
            ['let i=0;let sum=0;while(i<3){i=i+1;switch(i){case 2:{sum=sum+10;break;}default:{sum=sum+i;break;}}sum=sum+100;}export default [i,sum];', [3, 314]],
            ['export default (()=>{let i=0;while(i<3){i=i+1;switch(i){case 1:{break;}default:{continue;}}i=i+1;}return i;})();', 3],
        ]
        for (const [source, expected] of cases) { assertStructurallySame(result(source), { default: expected }, source) }
    },
    switchBreakAndContinueKeepDifferentFastOwners: () => {
        const normalized = fn('export default n=>{let i=0;let value=1;while(i<n){i=i+1;switch(i){case 1:{value=value+2;break;const skipped=null.x;}default:{continue;}}value=value+10;}return [i,value];};')
        const outer = normalized.body.statements.find(statement => statement[0] === 'loop')
        assert(outer !== undefined && outer[0] === 'loop')
        const guard = outer[1].body.statements[0]
        assert(guard[0] === 'if')
        const body = guard[3]
        const selected = body.statements.find(statement => statement[0] === 'loop')
        assert(selected !== undefined && selected[0] === 'loop')
        assertEq(selected[1].parameters.length, 0)
        assertEq(selected[1].initial.length, 0)
        assertEq(selected[1].results.length, 1)
        assert(selected[1].target !== outer[1].target)
        const branch = selected[1].body.statements[0]
        assert(branch[0] === 'if')
        assertEq(branch[3].statements.length, 1)
        const stopped = branch[3].exit
        assert(stopped[0] === 'break')
        assertEq(stopped[1], selected[1].target)
        assertEq(stopped[2].length, 1)
        const continued = branch[4].exit
        assert(continued[0] === 'continue')
        assertEq(continued[1], outer[1].target)
        assertEq(continued[2].length, 2)
        const discriminant = body.statements[body.statements.indexOf(selected) - 1]
        assert(discriminant[0] === 'define')
        assertEq(discriminant[3], 'required')
        assert(branch[2] instanceof Array && branch[2][0] === '===')
        assert(branch[2][1] instanceof Array && branch[2][1][0] === 'ref')
        assertEq(branch[2][1][1], discriminant[1])
    },
    nestedSwitchesAndLoopsConsumeOnlyTheirOwnBreaks: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{let i=0;let sum=0;while(i<2){i=i+1;switch(i){case 1:{switch(i){case 1:{sum=sum+1;break;const skipped=null.x;}default:{throw 9;}}sum=sum+10;break;}default:{sum=sum+100;break;}}sum=sum+1000;}return sum;})();', 2111],
            ['export default (()=>{let i=0;let sum=0;while(i<2){i=i+1;switch(i){case 1:{let j=0;while(j<3){j=j+1;if(j===2){break;}}sum=sum+j;break;}default:{sum=sum+10;break;}}sum=sum+100;}return [i,sum];})();', [2, 212]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){i=i+1;switch(i){case 1:{switch(i){case 1:{continue;}default:{break;}}break;}default:{sum=sum+i;break;}}sum=sum+100;}return [i,sum];})();', [3, 205]],
            ['export default (()=>{let i=0;let sum=0;while(i<2){i=i+1;if(i===1){switch(i){case 1:{sum=7;break;}default:{throw 9;}}}else{switch(i){case 1:{throw 9;}default:{sum=sum+3;break;}}}sum=sum+100;}return [i,sum];})();', [2, 210]],
        ]
        for (const [source, expected] of cases) { assertStructurallySame(result(source), { default: expected }, source) }
    },
    switchLabelsRemainOrderedAndLazy: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{let i=0;let value=0;while(i<1){i=i+1;switch(i){case 1:case null.x:{value=3;break;}case null.x:{throw 9;}default:{throw 8;}}}return value;})();', 3],
            ['export default (()=>{let i=0;let value=0;while(i<2){i=i+1;switch(i){case 0:case 2:{value=value+7;break;}default:{value=value+1;break;}}}return value;})();', 8],
            ['export default (()=>{while(false){switch(null.x){case null.x:{throw 9;}}}return 7;})();', 7],
        ]
        for (const [source, expected] of cases) { assertStructurallySame(result(source), { default: expected }, source) }
        for (const source of [
            'export default (()=>{while(true){switch(null.x){case 1:{return 3;}}}return 0;})();',
            'export default (()=>{while(true){switch(1){case null.x:{return 3;}default:{return 4;}}}return 0;})();',
            'export default (()=>{while(true){switch(1){case 0:case null.x:{return 3;}default:{return 4;}}}return 0;})();',
            'export default (()=>{while(true){switch(1){case 1:{const required=null.x;break;}default:{return 4;}}return 3;}return 0;})();',
        ]) { assertError(memo(assertOk(analysis(graph(source))))({ args: [] })) }
    },
    switchFunctionExitsSkipFollowingWorkAndKeepFunctionBoundaries: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{while(true){switch(1){case 1:{return 7;const skipped=null.x;}default:{throw 8;}}const skipped=null.x;}return 0;})();', 7],
            ['export default (()=>{while(true){switch(1){case 1:{switch(0){case 0:{return 7;}default:{throw 8;}}}default:{throw 9;}}const skipped=null.x;}return 0;})();', 7],
            ['export default (()=>{let i=0;while(i<3){i=i+1;switch(i){case 1:{switch(i){case 1:{if(i===1){return 7;}else{throw 8;}}default:{throw 9;}}}default:{continue;}}const skipped=null.x;}return 0;})();', 7],
            ['export default (()=>{let x=0;let y=2;while(true){x=y;switch(0){case 0:{return 7;}default:{return 8;}}}return x;})();', 7],
            ['export default (()=>{let i=0;let value=0;while(i<2){i=i+1;switch(i){case 1:{const read=()=>{while(true){switch(0){case 0:{return 3;}default:{throw 8;}}}return 0;};value=read();break;}default:{value=value+4;break;}}}return [i,value];})();', [2, 7]],
            ['export default (()=>{let i=0;let value=0;while(i<2){i=i+1;switch(i){case 1:{value=(()=>{while(true){switch(0){case 0:{return 3;}default:{throw 8;}}}return 0;})();break;}default:{value=value+4;break;}}}return [i,value];})();', [2, 7]],
        ]
        for (const [source, expected] of cases) { assertStructurallySame(result(source), { default: expected }, source) }
        for (const source of [
            'while(true){switch(0){case 0:{throw 7;}default:{break;}}const skipped=null.x;}export default 0;',
            'export default (()=>{while(true){switch(0){case 0:{throw 7;}default:{return 3;}}const skipped=null.x;}return 0;})();',
        ]) { assertError(memo(assertOk(analysis(graph(source))))({ args: [] })) }
        const normalized = fn('export default ()=>{while(true){switch(1){case 1:{return 7;}default:{throw 8;}}const skipped=null.x;}return 0;};')
        const loop = normalized.body.statements[0]
        assert(loop[0] === 'loop')
        assertEq(loop[1].body.statements.length, 2)
        assertEq(loop[1].body.statements[0][0], 'define')
        assertEq(loop[1].body.statements[1][0], 'loop')
        assertStructurallySame(loop[1].body.exit, ['continue', loop[1].target, []])
    },
    switchResultsKeepSnapshotsAndSharedAliases: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{let i=0;let left=null;let right=null;while(i<3){i=i+1;switch(i){case 1:case 2:{const shared=[i];left=shared;right=shared;break;}default:{const shared=[i+10];left=shared;right=shared;break;}}}return [left,right,left===right];})();', [[13], [13], true]],
            ['export default (()=>{let i=0;let read=()=>0;while(i<3){i=i+1;switch(i){case 2:{const snapshot=i;const value=[snapshot];read=()=>value;break;}default:{break;}}}return [read(),read()===read()];})();', [[2], true]],
            ['export default (()=>{let i=0;let value=1;while(i<2){i=i+1;switch(i){case 1:{let value=7;value=value+3;const read=()=>3;read();break;}default:{const value=9;break;}}}return value;})();', 1],
        ]
        for (const [source, expected] of cases) { assertStructurallySame(result(source), { default: expected }, source) }
    },
    switchSourceCyclesKeepIdentityWithoutUnusedStateCaptures: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{let i=0;let left=null;let right=null;while(i<3){i=i+1;const d=[i];switch(d){case [i]:{throw 9;}case d:case null.x:{left=d;right=d;break;}default:{throw 8;}}}return [left,right,left===right];})();', [[3], [3], true]],
            ['export default (()=>{let i=0;let a=()=>null;let b=a;while(i<3){i=i+1;switch(i){case 1:{const d=[i];const f=()=>d;a=f;b=f;break;}case 2:{const snapshot=i;const f=()=>[snapshot];const value=f();a=()=>value;break;}default:{break;}}}return [a(),b(),a===b,a()===a(),b()===b()];})();', [[2], [1], false, true, true]],
        ]
        for (const [source, expected] of cases) {
            let current = graph(source)
            let previous = ''
            let previousGraph = assertOk(analysis(current))
            for (let round = 0; round < 3; round = round + 1) {
                const text = assertOk(tryModuleStringify(current))
                current = graph(text)
                const normalized = assertOk(analysis(current))
                assertStructurallySame(assertOk(toData(assertOk(memo(normalized)({ args: [] })))), { default: expected }, text)
                if (round === 2) {
                    assertEq(text, previous)
                    assertStructurallySame(normalized, previousGraph)
                }
                previous = text
                previousGraph = normalized
            }
        }
    },
    functionExitsLeaveTheOwningBodyAndSkipFollowingWork: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{while(true){return 7;const skipped=null.x;}return null.x;})();', 7],
            ['export default (()=>{let i=0;while(i<4){i=i+1;if(i===2){return i;}i=i+1;}return i;})();', 4],
            ['export default (()=>{let i=0;while(i<4){i=i+1;if(i===2){return i;}else{i=i+1;}}return i;})();', 4],
            ['export default (()=>{let i=0;while(i<4){i=i+1;if(i<2){continue;}else{return i;}i=null.x;}return null.x;})();', 2],
            ['export default (()=>{let i=0;while(i<4){i=i+1;if(i<2){return i;}else{continue;}i=null.x;}return null.x;})();', 1],
            ['export default (()=>{while(false){throw 7;}return 3;})();', 3],
            ['export default (()=>{while(true){if(false){throw 7;}return 3;}return null.x;})();', 3],
            ['while(false){throw 7;}export default 3;', 3],
            ['const f=n=>{while(n>0){return f(n-1);}return 0;};export default f(3);', 0],
        ]
        for (const [source, expected] of cases) { assertStructurallySame(result(source), { default: expected }, source) }
    },
    functionExitsKeepReturnValuesAndReachedFailures: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{let value=1;while(true){value=value+2;const alias=value;return alias;}return null.x;})();', 3],
            ['export default ((...args)=>{while(true){return args;}return null.x;})(1,2,3);', [1, 2, 3]],
            ['const value=[7];export default (()=>{while(true){return value;}return null.x;})();', [7]],
            ['export default (()=>{let value=0;while(value<2){value=value+1;if(value===1){value=value+1;}else{return 9;}}return value;})();', 2],
        ]
        for (const [source, expected] of cases) { assertStructurallySame(result(source), { default: expected }, source) }
        /** @type {readonly string[]} */
        const failures = [
            'export default (()=>{while(true){const reached=null.x;return 7;}return 0;})();',
            'export default (()=>{let value=0;while(true){value=null.x;value=1;return value;}return 0;})();',
            'export default (()=>{while(true){return null.x;}return 0;})();',
            'export default (()=>{while(true){throw 7;const skipped=null.x;}return 0;})();',
            'export default (()=>{while(true){throw null.x;}return 0;})();',
            'export default (()=>{while(true){const reached=null.x;throw 7;}return 0;})();',
            'export default (()=>{while(true){if(false){return 3;}else{throw 7;}const skipped=null.x;}return 0;})();',
            'while(true){throw 7;const skipped=null.x;}export default 0;',
        ]
        for (const source of failures) { assertError(memo(assertOk(analysis(graph(source))))({ args: [] })) }
    },
    nestedLoopReturnsCrossHelpersButStayLocalToFunctions: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{let i=0;while(i<3){let j=0;while(j<2){if(j===1){return [i,j];}j=j+1;}i=i+1;}return null.x;})();', [0, 1]],
            ['export default (()=>{let i=0;while(i<3){while(true){return i;}const skipped=null.x;}return null.x;})();', 0],
            ['export default (()=>{let i=0;while(i<3){const add=(()=>{while(true){return 1;}return null.x;})();i=i+add;}return i;})();', 3],
            ['export default (()=>{const add=()=>{while(true){return 2;}return null.x;};let i=0;while(i<3){i=i+add();}return i;})();', 4],
            ['export default (()=>{let i=0;while(i<2){const read=()=>{while(true){return 3;}return null.x;};i=i+1;if(i===2){return read();}}return null.x;})();', 3],
            ['export default (()=>{if(true){while(true){return 3;}return null.x;}return 4;})();', 3],
            ['export default (()=>{if(false){while(true){return 4;}return null.x;}return 3;})();', 3],
            ['export default (()=>{switch(1){case 1:{while(true){return 3;}return null.x;}default:{return 4;}}})();', 3],
        ]
        for (const [source, expected] of cases) { assertStructurallySame(result(source), { default: expected }, source) }
    },
    normalizedOwningExitsKeepTargetsAndInvocationReads: () => {
        const normalized = fn('export default n=>{while(true){const alias=n;return alias;const skipped=null.x;}return 0;};')
        const statement = normalized.body.statements[0]
        assert(statement[0] === 'loop')
        const returned = statement[1].body.exit
        assert(returned[0] === 'return')
        assertEq(returned[1], normalized.target)
        assertEq(statement[1].body.statements.length, 1)
        const alias = statement[1].body.statements[0]
        assert(alias[0] === 'define')
        assertStructurallySame(returned[2], ['ref', alias[1]])
        assertStructurallySame(alias[2], ['ref', normalized.parameters[0]])
        const rest = fn('export default (...args)=>{while(true){return args;}return 0;};')
        assert(rest.rest !== null)
        const captured = fn('const value=7;export default ()=>{while(true){return value;}return 0;};')
        assertEq(captured.captures.length, 1)
        const immediate = fn('export default ()=>{let i=0;while(i<2){const add=(()=>{while(true){return 1;}return 0;})();i=i+add;}return i;};')
        const loop = immediate.body.statements.find(statement => statement[0] === 'loop')
        assert(loop !== undefined && loop[0] === 'loop')
        const guard = loop[1].body.statements[0]
        assert(guard[0] === 'if')
        const declaration = guard[3].statements[0]
        assert(declaration[0] === 'define')
        const called = declaration[2]
        assert(called instanceof Array && called[0] === '()')
        assert(called[1] instanceof Array && called[1][0] === 'function')
    },
    constantGuardsRetainOnlyTheirOwnFunctionExits: () => {
        for (const source of [
            'export default ()=>{while(true){while(true){return 3;}}return 0;};',
            'export default ()=>{while(true){while(true){throw 3;}}return 0;};',
        ]) {
            const normalized = fn(source)
            const outer = normalized.body.statements[0]
            assert(outer[0] === 'loop')
            const inner = outer[1].body.statements[0]
            assert(inner[0] === 'loop')
            assert(inner[1].body.exit[0] === 'return' || inner[1].body.exit[0] === 'throw')
        }
        const normalized = fn('export default ()=>{while(true){const local=()=>{while(true){return 1;}return 0;};}return 0;};')
        const outer = normalized.body.statements[0]
        assert(outer[0] === 'loop')
        const guard = outer[1].body.statements[0]
        assert(guard[0] === 'if')
        assertEq(guard[2], true)
    },
    directLoopExitsKeepStateAndSkipRemainingWork: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{while(true){break;const skipped=null.x;}return 7;})();', 7],
            ['export default (()=>{let i=0;while(i<3){i=i+1;continue;const skipped=null.x;}return i;})();', 3],
            ['export default (()=>{let i=0;let sum=0;while(i<5){i=i+1;sum=sum+i;break;sum=null.x;}return [i,sum];})();', [1, 1]],
            ['export default (()=>{let i=0;while(true){break;i=i+1;}return i;})();', 0],
            ['let i=0;const first=i;while(i<4){i=i+1;if(i<3){continue;}break;i=null.x;}export default [first,i];', [0, 3]],
        ]
        for (const [source, expected] of cases) { assertStructurallySame(result(source), { default: expected }, source) }
    },
    conditionalLoopExitsMergeOnlyNormalArms: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{let i=0;let sum=0;while(i<4){i=i+1;if(i===3){sum=40;break;}else{sum=sum+i;}sum=sum+10;}return [i,sum];})();', [3, 40]],
            ['export default (()=>{let i=0;let sum=0;while(i<4){i=i+1;if(i<3){sum=sum+i;}else{sum=40;break;}sum=sum+10;}return [i,sum];})();', [3, 40]],
            ['export default (()=>{let i=0;let sum=0;while(i<5){i=i+1;if(i<3){sum=sum+i;continue;}else{sum=sum+10;break;}sum=null.x;}return [i,sum];})();', [3, 13]],
            ['export default (()=>{let i=0;let sum=0;while(i<5){i=i+1;if(i<3){sum=sum+i;continue;}sum=sum+10;}return [i,sum];})();', [5, 33]],
            ['export default (()=>{let i=0;let sum=0;while(i<5){i=i+1;if(i===1){sum=1;}else if(i===2){continue;}else{break;}sum=sum+10;}return [i,sum];})();', [3, 11]],
        ]
        for (const [source, expected] of cases) { assertStructurallySame(result(source), { default: expected }, source) }
    },
    nestedLoopExitsKeepTheInnermostTargetAndFreshLocals: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{let i=0;let sum=0;while(i<3){let j=0;while(j<4){j=j+1;if(j===2){break;}sum=sum+10;}i=i+1;if(i===2){continue;}sum=sum+i;}return [i,sum];})();', [3, 34]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){let j=0;while(j<3){j=j+1;if(j===2){continue;}sum=sum+j;}i=i+1;}return [i,sum];})();', [3, 12]],
            ['export default (()=>{let i=0;let saved=null;while(i<3){const snapshot=[i];saved=()=>snapshot;i=i+1;continue;saved=null;}return [i,saved(),saved()===saved()];})();', [3, [2], true]],
            ['export default (()=>{let i=0;while(i<3){const amount=(()=>{let j=0;while(j<3){j=j+1;if(j===1){continue;}break;}return j;})();i=i+amount;}return i;})();', 4],
            ['export default (()=>{let i=0;const amount=()=>{let j=0;while(j<3){j=j+1;if(j===1){continue;}break;}return j;};while(i<3){i=i+amount();continue;}return i;})();', 4],
        ]
        for (const [source, expected] of cases) { assertStructurallySame(result(source), { default: expected }, source) }
    },
    loopExitsRetainReachedFailuresAndRetestConditions: () => {
        const sources = [
            'export default (()=>{while(true){const reached=null.x;break;}return 7;})();',
            'export default (()=>{let i=0;while(i<3){i=i+1;const reached=null.x;continue;}return i;})();',
            'export default (()=>{let i=0;while(i<2?true:null.x){i=i+1;continue;}return i;})();',
        ]
        for (const source of sources) { assertError(memo(assertOk(analysis(graph(source))))({ args: [] })) }
        assertStructurallySame(result('export default (()=>{let i=0;while(i<2?true:null.x){i=i+1;break;}return i;})();'), { default: 1 })
    },
    loopTransferSignaturesUseCurrentVersionsAndNoDeadDefinitions: () => {
        const normalized = fn('export default ()=>{let a=1;let b=2;while(true){a=b;b=3;continue;const skipped=null.x;}return [a,b];};')
        const statement = normalized.body.statements.find(statement => statement[0] === 'loop')
        assert(statement !== undefined && statement[0] === 'loop')
        const loop = statement[1]
        assertEq(loop.parameters.length, 2)
        const step = loop.body
        assertEq(step.exit[0], 'continue')
        assert(step.exit[0] === 'continue')
        assertEq(step.exit[1], loop.target)
        assertEq(step.exit[2].length, 2)
        assertEq(step.statements.length, 2)
        assertStructurallySame(step.exit[2], step.statements.map(statement => {
            assert(statement[0] === 'define')
            return ['ref', statement[1]]
        }))
    },
    constantLoopGuardsChangeOnlyForOwnSourceExits: () => {
        const own = fn('export default ()=>{let i=0;while(true){if(i===0){i=i+1;continue;}if(i===1){break;}i=i+1;}return i;};')
        const ownLoop = own.body.statements.find(statement => statement[0] === 'loop')
        assert(ownLoop !== undefined && ownLoop[0] === 'loop')
        const first = ownLoop[1].body.statements[0]
        assert(first[0] === 'if')
        assert(first[2] instanceof Array && first[2][0] === '===')
        assertStructurallySame(result('export default (()=>{let i=0;while(true){if(i===0){i=i+1;continue;}if(i===1){break;}i=i+1;}return i;})();'), { default: 1 })
        for (const source of [
            'export default ()=>{while(true){}return 0;};',
            'export default ()=>{while(true){while(false){break;}}return 0;};',
            'export default ()=>{while(true){const local=()=>{while(true){break;}return 1;};}return 0;};',
        ]) {
            const normalized = fn(source)
            const statement = normalized.body.statements.find(statement => statement[0] === 'loop')
            assert(statement !== undefined && statement[0] === 'loop')
            const guard = statement[1].body.statements[0]
            assert(guard[0] === 'if')
            assertEq(guard[2], true)
        }
    },
    nestedLoopSignaturesSelectEnclosingStateAndKeepLocals: () => {
        const normalized = fn('export default n=>{let i=0;let sum=0;while(i<n){let j=0;while(j<2){sum=sum+i+j;j=j+1;}i=i+1;}return [i,sum];};')
        const outer = normalized.body.statements.find(statement => statement[0] === 'loop')
        assert(outer !== undefined && outer[0] === 'loop')
        assertEq(outer[1].parameters.length, 2)
        const guard = outer[1].body.statements[0]
        assert(guard[0] === 'if')
        const inner = guard[3].statements.find(statement => statement[0] === 'loop')
        assert(inner !== undefined && inner[0] === 'loop')
        // i is read-only in the inner loop; sum and j are written. The local
        // j is carried only by that inner loop, in source introduction order.
        assertEq(inner[1].parameters.length, 3)
        assertEq(inner[1].results.length, 3)
        assertEq(outer[1].results.length, 2)
        assert(outer[1].target !== inner[1].target)
        assertStructurallySame(inner[1].initial.slice(0, 2), outer[1].parameters.map(id => ['ref', id]))
        assertStructurallySame(result('export default (n=>{let i=0;let sum=0;while(i<n){let j=0;while(j<2){sum=sum+i+j;j=j+1;}i=i+1;}return [i,sum];})(3);'), { default: [3, 9] })
    },
    nestedLoopEntriesAndSnapshotsRemainFresh: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{let i=0;let sum=0;while(i<3){let j=0;while(j<2){let local=1;local=local+j;sum=sum+local;j=j+1;}i=i+1;}return [i,sum];})();', [3, 9]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){let j=0;while(j<1){i=i+1;j=j+1;}sum=sum+i;}return [i,sum];})();', [3, 6]],
            ['export default (()=>{let i=0;let saved=null;while(i<2){let j=0;while(j<2){const snapshot=[i,j];saved=()=>snapshot;j=j+1;}i=i+1;}return [saved(),saved()===saved()];})();', [[1, 1], true]],
            ['export default (()=>{let i=0;let sum=0;while(i<2){if(i===0){let j=0;while(j<2){sum=sum+1;j=j+1;}}else{let j=0;while(j<3){sum=sum+10;j=j+1;}}i=i+1;}return [i,sum];})();', [2, 32]],
            ['export default (()=>{let i=0;while(i<2){while(false){const skipped=null.x;}i=i+1;}return i;})();', 2],
        ]
        for (const [source, expected] of cases) { assertStructurallySame(result(source), { default: expected }, source) }
    },
    identities: () => {
        const ast = assertOk(parse('')('const a = [1]; const b = a; export default [a, b];'))
        const fast = normalize(ast, [])
        const graph = /** @type {readonly ['{}', readonly (readonly [':', string, readonly ['[]', readonly unknown[]]])[]]} */ (fromFast(fast.body))
        const pair = graph[1][0][2][1]
        assert(pair[0] === pair[1])
        // The alias retains source order while both reads name one graph node.
        assertEq(fast.body.statements.length, 2)
    },
    aliasCaptureOrder: () => {
        const value = fn('export default (b,f)=>{let w=0;while(w<3){const unused=b;const first=f;const second=first;const third=b;w=third+second(third);}return w;};')
        const statement = value.body.statements.find(statement => statement[0] === 'loop')
        assert(statement !== undefined && statement[0] === 'loop')
        const captures = freeLoopBindings(statement[1])
        assertEq(captures.length, 2)
        assertEq(captures[0], value.parameters[1])
        assertEq(captures[1], value.parameters[0])
        const unused = fn('export default b=>{let w=0;while(w<1){const unused=b;w=w+1;}return w;};')
        const loop = unused.body.statements.find(statement => statement[0] === 'loop')
        assert(loop !== undefined && loop[0] === 'loop')
        assertEq(freeLoopBindings(loop[1]).length, 0)
    },
    lazyAliasReads: () => {
        // Capture-order aliases must not add comma anchors to lazy frame reads.
        assertStructurallySame(graph('const captured={};export default selected=>()=>{const test=selected;const value=captured;return test?value:0;};'),
            ['{}', [[':', 'default', ['=>', 1, [['{}', []]], ['=>', 0, [['arg', 0], ['frame', 0]], ['?:', ['frame', 0], ['frame', 1], 0]]]]]])
        // A real declaration still evaluates before a lazily read alias of it.
        assertError(memo(assertOk(analysis(graph('export default (()=>{const value=null.x;const alias=value;return false?alias:0;})();'))))({ args: [] }))
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
        const statement = normalized.body.statements.find(statement => statement[0] === 'loop')
        assert(statement !== undefined)
        assert(statement[0] === 'loop')
        const loop = statement[1]
        assert(loop.parameters[0] !== variable.id && loop.results[0] !== variable.id && loop.parameters[0] !== loop.results[0])
        assertStructurallySame(result('export default (start=>{let value=start;while(value<3){const snapshot=value;const read=()=>snapshot;value=read()+1;}return value;})(0);'), { default: 3 })
        assertStructurallySame(result('export default (()=>{let value=0;while(value<3){const observed=(()=>value)();value=observed+1;}return value;})();'), { default: 3 })
        assertStructurallySame(result('export default (()=>{let value=0;value=value+1;value=value*3;return value;})();'), { default: 3 })
        assertStructurallySame(result('export default (start=>{while(start<3){start=start+1;}return start;})(0);'), { default: 3 })
        assertStructurallySame(result('export default (()=>{let value=0;while(value<2){value=value+1;}const snapshot=value;return ()=>snapshot;})()();'), { default: 2 })
        assertStructurallySame(result('export default (()=>{let value=1;while(false){value=value;}return value;})();'), { default: 1 })
        assertError(memo(assertOk(analysis(graph('export default (()=>{let value=null.x;while(false){value=1;}return value;})();'))))({ args: [] }))
        assertError(memo(assertOk(analysis(graph('export default (()=>{let value=0;while(value<1){const required=null.x;value=1;}return value;})();'))))({ args: [] }))
        assertError(memo(assertOk(analysis(graph('export default (()=>{let value=null.x;value=1;return value;})();'))))({ args: [] }))
        assertError(memo(assertOk(analysis(graph('export default (()=>{let value=0;value=null.x;value=1;return value;})();'))))({ args: [] }))
    },
    generalLoopStateUsesDeclarationOrderAndSharedWriteFacts: () => {
        const source = /** @type {const} */ ('export default ()=>{let first=0;let second=1;let unused=9;unused=8;while(second<4){second=second+1;first=first+second;}return [first,second,unused];};')
        const normalized = fn(source)
        const initializers = normalized.body.statements.filter(statement => statement[0] === 'define')
        const statement = normalized.body.statements.find(statement => statement[0] === 'loop')
        assert(statement !== undefined && statement[0] === 'loop')
        const loop = statement[1]
        assertEq(loop.parameters.length, 2)
        assertEq(loop.results.length, 2)
        // The condition first reads second; the state signature still starts
        // with first, introduced before it, and excludes unreferenced unused.
        assertStructurallySame(loop.initial, initializers.slice(0, 2).map(statement => ['ref', statement[1]]))
        assert(loop.parameters[0] !== loop.parameters[1])
        assert(loop.results[0] !== loop.results[1])
        for (const parameter of loop.parameters) { assert(!loop.results.includes(parameter)) }
        assertStructurallySame(result('export default (()=>{let first=0;let second=1;let unused=9;unused=8;while(second<4){second=second+1;first=first+second;}return [first,second,unused];})();'), { default: [9, 4, 8] })
        const defaults = fn('export default limit=>{let carried=limit;carried=carried+1;let count=0;while(count<3){const observed=((value=carried)=>value)();count=count+observed;}return [count,carried];};')
        const withDefault = defaults.body.statements.find(statement => statement[0] === 'loop')
        assert(withDefault !== undefined && withDefault[0] === 'loop')
        // carried is mutable in the whole scope and read by the nested
        // parameter default; it remains state even though this body never writes it.
        assertEq(withDefault[1].parameters.length, 2)
        assertStructurallySame(result('export default (limit=>{let carried=limit;carried=carried+1;let count=0;while(count<3){const observed=((value=carried)=>value)();count=count+observed;}return [count,carried];})(0);'), { default: [3, 1] })
    },
    generalLoopAssignmentsRemainSequentialAcrossPlacements: () => {
        for (const [source, expected] of /** @type {readonly (readonly [string, unknown])[]} */ ([
            ['export default (()=>{let x=0;let y=0;while(x<2){x=x+1;y=y+1;}while(y<5){x=x+2;y=y+1;}return [x,y];})();', [8, 5]],
            ['export default (selected=>{let x=0;let y=1;if(selected){while(x<3){y=y+x;x=x+1;}return [x,y];}while(y<4){x=x+y;y=y+1;}return [x,y];})(true);', [3, 4]],
            ['export default (selected=>{let x=0;let y=1;if(selected){while(x<3){y=y+x;x=x+1;}return [x,y];}while(y<4){x=x+y;y=y+1;}return [x,y];})(false);', [6, 4]],
            ['export default (selected=>{let x=0;let y=1;switch(selected){case 1:{while(x<2){x=x+1;y=y*2;}return [x,y];}default:{while(y<3){y=y+1;x=x+y;}return [x,y];}}})(1);', [2, 4]],
            ['export default (selected=>{let x=0;let y=1;switch(selected){case 1:{while(x<2){x=x+1;y=y*2;}return [x,y];}default:{while(y<3){y=y+1;x=x+y;}return [x,y];}}})(0);', [5, 3]],
            ['export default (()=>{let x=0;let y=6;while((()=>{const pair=[x,y];return pair[0]<pair[1];})()){x=x+1;y=y-1;}return [x,y];})();', [3, 3]],
            ['export default (()=>{let x=0;let y=1;while(x<3){let local=1;local=local+1;x=x+1;y=y+local;}return [x,y];})();', [3, 7]],
        ])) { assertStructurallySame(result(source), { default: expected }, source) }
    },
    conditionalBodyResultsMergeOnlyOuterWrites: () => {
        /** @type {string} */
        const source = 'export default (n,selected)=>{let i=0;let sum=0;while(i<n){if(selected){let local=1;local=local+1;sum=sum+i;i=i+local;}i=i+1;}return [i,sum];};'
        const normalized = fn(source)
        const statement = normalized.body.statements.find(statement => statement[0] === 'loop')
        assert(statement !== undefined && statement[0] === 'loop')
        const guard = statement[1].body.statements[0]
        assert(guard[0] === 'if')
        const branch = guard[3].statements.find(statement => statement[0] === 'if')
        assert(branch !== undefined && branch[0] === 'if')
        // Local is written too, but only the two enclosing bindings cross the
        // branch. Their shared declaration order is i, sum, not write order.
        assertEq(branch[1].length, 2)
        assert(branch[1][0] !== branch[1][1])
        assert(branch[3].exit[0] === 'yield' && branch[4].exit[0] === 'yield')
        assertEq(branch[3].exit[1].length, 2)
        assertStructurallySame(branch[4].exit[1], statement[1].parameters.map(id => ['ref', id]))
        assertStructurallySame(result(`export default (${source.slice('export default '.length, -1)})(4,true);`), { default: [6, 3] })
        assertStructurallySame(result(`export default (${source.slice('export default '.length, -1)})(4,false);`), { default: [4, 0] })
    },
    conditionalBodiesPreserveSequentialAndNestedVersions: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{let i=0;let x=1;let y=2;while(i<2){if(i===0){x=y;y=x+1;x=y+1;}y=y+1;i=i+1;}return [x,y];})();', [4, 5]],
            ['export default (()=>{let i=0;let x=0;while(i<3){if(i>0){let local=i;if(i===2){local=local+3;x=x+local;}x=x+local;}i=i+1;}return [i,x];})();', [3, 11]],
            ['export default (()=>{let i=0;let x=1;while(i<2){if(i===0){const x=7;const read=()=>x;read();}i=i+1;}return x;})();', 1],
            ['export default (()=>{let i=0;let first=[0];const second=[1];while(i<2){if(i===0){first=second;}i=i+1;}return first===second;})();', true],
            ['export default (()=>{let i=0;let read=()=>0;while(i<2){if(i===1){const snapshot=i;const local=[snapshot];read=()=>local;}i=i+1;}return [read()[0],read()===read()];})();', [1, true]],
        ]
        for (const [source, expected] of cases) { assertStructurallySame(result(source), { default: expected }, source) }
    },
    conditionalBodiesKeepSelectedRequiredWork: () => {
        assertStructurallySame(result('export default (()=>{let i=0;while(i<2){if(false){const skipped=null.x;}if(i===0){}i=i+1;}return i;})();'), { default: 2 })
        assertStructurallySame(result('export default (()=>{while(false){if(null.x){const skipped=null.x;}}return 7;})();'), { default: 7 })
        /** @type {readonly string[]} */
        const failures = [
            'export default (()=>{let i=0;while(i<1){if(null.x){}i=i+1;}return i;})();',
            'export default (()=>{let i=0;while(i<1){if(true){const required=null.x;}i=i+1;}return i;})();',
            'export default (()=>{let i=0;while(i<1){if(true){i=null.x;i=1;}i=i+1;}return i;})();',
        ]
        for (const source of failures) { assertError(memo(assertOk(analysis(graph(source))))({ args: [] })) }
    },
    alternativeBodyResultsJoinBothEnvironments: () => {
        /** @type {string} */
        const source = 'export default (n,selected)=>{let i=0;let a=1;let b=2;while(i<n){if(selected){let local=a;local=local+3;b=local;}else{let local=b;local=local+5;a=local;}i=i+1;}return [i,a,b];};'
        const normalized = fn(source)
        const statement = normalized.body.statements.find(statement => statement[0] === 'loop')
        assert(statement !== undefined && statement[0] === 'loop')
        const guard = statement[1].body.statements[0]
        assert(guard[0] === 'if')
        const branch = guard[3].statements.find(statement => statement[0] === 'if')
        assert(branch !== undefined && branch[0] === 'if')
        // The true arm writes b first; the union is still a, b, with neither
        // arm's local declaration crossing the branch boundary.
        assertEq(branch[1].length, 2)
        assert(branch[3].exit[0] === 'yield' && branch[4].exit[0] === 'yield')
        assertStructurallySame(branch[3].exit[1][0], ['ref', statement[1].parameters[1]])
        assertStructurallySame(branch[4].exit[1][1], ['ref', statement[1].parameters[2]])
        assertStructurallySame(result(`export default (${source.slice('export default '.length, -1)})(2,true);`), { default: [2, 1, 4] })
        assertStructurallySame(result(`export default (${source.slice('export default '.length, -1)})(2,false);`), { default: [2, 7, 2] })
    },
    alternativeBodiesPreserveLocalsAliasesAndSnapshots: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{let i=0;let x=1;while(i<4){if(i===0){x=10;}else if(i===1){x=20;}else if(i===2){}else{x=x+3;}i=i+1;}return [i,x];})();', [4, 23]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){let local=1;if(i===0){if(false){local=7;}else{local=local+2;}}else{if(i===1){local=5;}else if(false){local=null.x;}else{local=9;}}sum=sum+local;i=i+1;}return [i,sum];})();', [3, 17]],
            ['export default (()=>{let i=0;const first=[1];const second=[2];let left=first;let right=second;while(i<2){if(i===0){left=second;}else{right=first;}i=i+1;}return [left===second,right===first,left===right];})();', [true, true, false]],
            ['export default (()=>{let i=0;let a=null;let b=null;while(i<3){if(i<1){const shared=[i];a=shared;b=shared;}else{const shared=[i+10];a=shared;b=shared;}i=i+1;}return [a,b,a===b];})();', [[12], [12], true]],
            ['export default (()=>{let i=0;let read=()=>-1;while(i<3){if(i===1){const snapshot=i;read=()=>snapshot;}else if(i===2){const snapshot=i+10;read=()=>snapshot;}else{const snapshot=i;read=()=>snapshot;}i=i+1;}return read();})();', 12],
            ['export default (()=>{let i=0;let x=1;while(i<2){if(i===0){const x=2;const read=()=>x;read();}else{let x=3;x=x+1;}i=i+1;}return x;})();', 1],
        ]
        for (const [source, expected] of cases) { assertStructurallySame(result(source), { default: expected }, source) }
    },
    alternativeBodiesKeepTestsAndWorkSelected: () => {
        assertStructurallySame(result('export default (()=>{let i=0;while(i<2){if(true){}else if(null.x){const skipped=null.x;}else{const skipped=null.x;}i=i+1;}return i;})();'), { default: 2 })
        assertStructurallySame(result('export default (()=>{let i=0;while(i<2){if(false){const skipped=null.x;}else if(true){}else{const skipped=null.x;}i=i+1;}return i;})();'), { default: 2 })
        /** @type {readonly string[]} */
        const failures = [
            'export default (()=>{let i=0;while(i<1){if(false){}else if(null.x){}i=i+1;}return i;})();',
            'export default (()=>{let i=0;while(i<1){if(false){}else{const required=null.x;}i=i+1;}return i;})();',
            'export default (()=>{let i=0;while(i<1){if(false){}else if(false){}else{i=null.x;i=1;}i=i+1;}return i;})();',
        ]
        for (const source of failures) { assertError(memo(assertOk(analysis(graph(source))))({ args: [] })) }
    },
    zeroStateLoopsRetainTheirEvaluationRegions: () => {
        const normalized = fn('export default ()=>{while(false){let local=0;local=local+1;}return 7;};')
        const statement = normalized.body.statements.find(statement => statement[0] === 'loop')
        assert(statement !== undefined && statement[0] === 'loop')
        assertEq(statement[1].parameters.length, 0)
        assertEq(statement[1].initial.length, 0)
        assertEq(statement[1].results.length, 0)
        assertStructurallySame(result('export default (()=>{while(false){let local=0;local=local+1;}return 7;})();'), { default: 7 })
        assertStructurallySame(result('export default (()=>{while(false){const skipped=null.x;}const value=[];return [value,value];})();'), { default: [[], []] })
        for (const source of /** @type {const} */ ([
            'export default (()=>{while(null.x){const local=0;}return 7;})();',
            'export default (()=>{while(true){const required=null.x;}return 7;})();',
            'export default (()=>{let x=null.x;let y=0;while(false){x=1;y=2;}return [x,y];})();',
            'export default (()=>{let x=0;let y=0;while(x<2?true:null.x){x=x+1;y=y+1;}return [x,y];})();',
            'export default (()=>{let x=0;let y=0;while(x<1){x=null.x;x=3;y=y+1;}return [x,y];})();',
        ])) { assertError(memo(assertOk(analysis(graph(source))))({ args: [] })) }
    },
    loopLocalsAndCaptureSnapshotsStayFresh: () => {
        const source = /** @type {const} */ ('export default (()=>{let count=3;let history=null;while(count>0){const snapshot=count;const local=[snapshot];const read=()=>local;history=[history,local,read];count=count-1;}return [history[1],history[2](),history[0][1],history[0][2](),history[1]===history[2](),history[1]===history[0][1]];})();')
        assertStructurallySame(result(source), { default: [[1], [1], [2], [2], true, false] })
    },
    readOnlyStateDoesNotBecomeAnEscapingWrite: () => {
        const normalized = fn('export default n=>{let outer=0;while(outer<n){outer=(()=>{let inner=0;while(inner<outer+1){inner=inner+1;}return inner;})();}return outer;};')
        const statement = normalized.body.statements.find(statement => statement[0] === 'loop')
        assert(statement !== undefined && statement[0] === 'loop')
        const guard = statement[1].body.statements[0]
        assert(guard[0] === 'if')
        const update = guard[3].statements.find(statement => statement[0] === 'define')
        assert(update !== undefined && update[0] === 'define' && update[2] instanceof Array && update[2][0] === 'block')
        const inner = update[2][1].statements.find(statement => statement[0] === 'loop')
        assert(inner !== undefined && inner[0] === 'loop')
        // outer is still carried by the inner loop, but its unchanged value
        // introduces no write across the surrounding immediately invoked body.
        assertEq(inner[1].parameters.length, 2)
        assertEq(inner[1].results.length, 2)
        assertStructurallySame(result('export default (n=>{let outer=0;while(outer<n){outer=(()=>{let inner=0;while(inner<outer+1){inner=inner+1;}return inner;})();}return outer;})(3);'), { default: 3 })
    },
    loopStateIsNotLimitedByFunctionArity: () => {
        const width = /** @type {const} */ (18)
        const names = Array.from({ length: width }, (_, index) => `value${index}`)
        const declarations = names.map(name => `let ${name}=0;`).join('')
        const assignments = names.map(name => `${name}=${name}+1;`).join('')
        const source = /** @type {string} */ (`export default ()=>{${declarations}while(value0<2){${assignments}}return [${names.join(',')}];};`)
        const normalized = fn(source)
        const statement = normalized.body.statements.find(statement => statement[0] === 'loop')
        assert(statement !== undefined && statement[0] === 'loop')
        assertEq(normalized.parameters.length, 0)
        assertEq(statement[1].parameters.length, width)
        assertEq(statement[1].results.length, width)
        assertStructurallySame(result(`export default (()=>{${declarations}while(value0<2){${assignments}}return [${names.join(',')}];})();`), { default: Array.from({ length: width }, () => 2) })
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
    deepTerminalSwitchCases: () => {
        const width = 6_000
        const cases = Array.from({ length: width }, (_, index) => `case ${index}:{return ${index};}`).join('')
        const normalized = fn(`export default value=>{switch(value){${cases}default:{return -1;}}};`)
        assert(normalized.body.exit[0] === 'return')
        let value = normalized.body.exit[2]
        for (let index = 0; index < width; index = index + 1) {
            assert(value instanceof Array && value[0] === 'if')
            const branch = value[2]
            assertStructurallySame(branch.exit, ['yield', [index]])
            const otherwise = value[3]
            assert(otherwise.exit[0] === 'yield')
            value = otherwise.exit[1][0]
        }
        assertStructurallySame(value, ['-', 1])
    },
    deepStatefulSwitchCases: () => {
        const width = 6_000
        const cases = Array.from({ length: width }, (_, index) => `case ${index}:{break;}`).join('')
        const normalized = fn(`export default n=>{while(n<1){switch((()=>{n=n+1;return n;})()){${cases}default:{break;}}}return n;};`)
        const loop = normalized.body.statements.find(statement => statement[0] === 'loop')
        assert(loop !== undefined && loop[0] === 'loop')
        const guard = loop[1].body.statements[0]
        assert(guard[0] === 'if')
        const selected = guard[3].statements.find(statement => statement[0] === 'loop')
        assert(selected !== undefined && selected[0] === 'loop')
        let body = selected[1].body
        for (let index = 0; index < width; index = index + 1) {
            const branch = body.statements[body.statements.length - 1]
            assert(branch[0] === 'if')
            assert(branch[2] instanceof Array && branch[2][0] === '===')
            assertEq(branch[2][2], index)
            assertEq(branch[3].exit[0], 'break')
            body = branch[4]
        }
        assertEq(body.exit[0], 'break')
    },
    deepStatefulSwitchLabels: () => {
        const width = 6_000
        const labels = Array.from({ length: width }, (_, index) => `case ${index}:`).join('')
        const normalized = fn(`export default n=>{switch(-1){${labels}case (()=>{n=n+1;return n;})():{return n;}default:{return n;}}};`)
        assert(normalized.body.exit[0] === 'return')
        assert(normalized.body.statements.some(statement => statement[0] === 'if'))
    },
    expressionBlockWrites: {
        deepStatefulOperators: () => {
            const width = /** @type {const} */ (5_000)
            const source = `export default n=>((()=>{n=n+1;return n;})()${'+1'.repeat(width)});`
            const fast = normalize(assertOk(parse('')(source)), [])
            assert(fast.body.exit[0] === 'yield')
            assert(fast.body.statements.length === 0)
        },
        expressionsRetainOrderAndLazyState: () => {
            const next = /** @type {const} */ ('(()=>{n=n+1;return n;})()')
            /** @type {readonly (readonly [string, unknown])[]} */
            const cases = [
                [next, [1, 1]],
                [`[n,${next},n,${next},n]`, [[0, 1, 1, 2, 2], 2]],
                [`n+${next}+n`, [2, 1]],
                [`(${next},n+2)`, [3, 1]],
                [`(${next},${next},n)`, [2, 2]],
                [`!${next}`, [false, 1]],
                [`true?${next}:0`, [1, 1]],
                [`false?${next}:0`, [0, 0]],
                [`true?0:${next}`, [0, 0]],
                [`false?0:${next}`, [1, 1]],
                [`false&&${next}`, [false, 0]],
                [`true&&${next}`, [1, 1]],
                [`false||${next}`, [1, 1]],
                [`true||${next}`, [true, 0]],
                [`null??${next}`, [1, 1]],
                [`0??${next}`, [0, 0]],
                [`[${next}]?.[Number(${next})]`, [undefined, 2]],
                [`null?.[Number(${next})]`, [undefined, 0]],
                [`null?.at(${next})`, [undefined, 0]],
                [`[4,5].at(${next})`, [5, 1]],
                [`((a,b)=>[a,b])(${next},${next})`, [[1, 2], 2]],
                [`[...[${next}],${next}]`, [[1, 2], 2]],
                [`((...args)=>args)(...[${next}],${next})`, [[1, 2], 2]],
                [`({[String(${next})]:${next},tail:n})`, [{ 1: 2, tail: 2 }, 2]],
                [`({...{first:${next}},tail:${next}})`, [{ first: 1, tail: 2 }, 2]],
                [`(()=>{const x=${next};return x+n;})()`, [2, 1]],
                [`(()=>{if(n===0){n=3;return n;}return 9;})()`, [3, 3]],
                [`(()=>{if(false){n=n+1;throw 7;}return 0;})()`, [0, 0]],
                [`(()=>{switch(${next}){case 1:{n=n+2;return n;}default:{return 9;}}})()`, [3, 3]],
            ]
            for (const [expression, expected] of cases) {
                assertStructurallySame(result(`export default (()=>{let n=0;const r=${expression};return [r,n];})();`), { default: expected }, expression)
            }
        },
        conditionsDefaultsAndLabelsCarryTheirUpdates: () => {
            /** @type {readonly (readonly [string, unknown])[]} */
            const cases = [
                ['export default ((n,x=(()=>{n=n+1;return n;})(),y=n)=>[n,x,y])(0);', [1, 1, 1]],
                ['export default ((n,x=(()=>{n=n+1;return n;})(),y=n)=>[n,x,y])(0,7);', [0, 7, 0]],
                ['export default (()=>{let n=0;while((()=>{n=n+1;return n<3;})()){n=n+1;}return n;})();', 3],
                ['export default (()=>{let n=0;while(n<1){if((()=>{n=n+1;return true;})()){n=n+1;}else{n=9;}}return n;})();', 2],
                ['export default (()=>{let n=0;switch((()=>{n=n+1;return n;})()){case 1:{n=n+1;return n;}default:{return 9;}}})();', 2],
                ['export default (()=>{let n=0;switch(2){case (()=>{n=n+1;return n;})():{return 8;}case (()=>{n=n+1;return n;})():{return n;}default:{return 9;}}})();', 2],
                ['export default (()=>{let n=0;switch(1){case (()=>{n=n+1;return n;})():case (()=>{n=n+1;return n;})():{return n;}default:{return 9;}}})();', 1],
                ['export default (()=>{let n=0;while(n<3){switch(2){case (()=>{n=n+1;return n;})():{break;}default:{n=n+1;break;}}}return n;})();', 4],
                ['export default (()=>{let n=0;while(n<1){switch((()=>{n=n+1;return n;})()){case 1:{n=n+1;break;}default:{break;}}}return n;})();', 2],
                ['export default (()=>{let n=0;while(n<1){switch(2){case (()=>{n=n+1;return n;})():{n=n+1;break;}}}return n;})();', 1],
                ['export default (()=>{let n=0;const r=(()=>{n=n+1;return n;})();return [r,n];})();', [1, 1]],
            ]
            for (const [source, expected] of cases) { assertStructurallySame(result(source), { default: expected }, source) }
        },
        failuresKeepReachedAssignmentsAndSkipContinuations: () => {
            const fail = /** @type {const} */ ('(()=>{n=n+1;throw 7;})()')
            const next = /** @type {const} */ ('(()=>{n=n+1;return n;})()')
            /** @type {readonly string[]} */
            const bodies = [
                `return ${fail};`,
                `const r=${fail};return n;`,
                `n=${fail};return n;`,
                `return [n,${fail},${next}];`,
                `return -${fail};`,
                `return ${fail}&&${next};`,
                `return true?${fail}:${next};`,
                `return false?${next}:${fail};`,
                `if(${fail}){return 1;}return 2;`,
                `switch(${fail}){case 1:{return n;}default:{return 0;}}`,
                `switch(1){case ${fail}:{return n;}default:{return 0;}}`,
                `switch(1){case 0:case ${fail}:{return n;}default:{return 0;}}`,
                `while(n<1){if(${fail}){n=3;}else{n=4;}}return n;`,
                `while(n<1){switch(${fail}){case 1:{break;}default:{break;}}}return n;`,
                `while(n<1){switch(1){case ${fail}:{break;}default:{break;}}}return n;`,
                `return (()=>{if(true){n=n+1;throw 7;}n=n+2;throw 8;})();`,
                `return [4]?.[Number(${fail})];`,
                `return [4].at(${fail});`,
            ]
            for (const body of bodies) {
                const source = `export default (()=>{let n=0;${body}})();`
                assertError(memo(assertOk(analysis(graph(source))))({ args: [] }))
            }
        },
        sourceBlockControlKeepsLexicalBindings: () => {
            /** @type {readonly (readonly [string, unknown])[]} */
            const cases = [
                ['let local=0;local=1;while(local<1){if(true){local=2;}else{local=3;}switch(local){case 1:{break;}default:{continue;}}}return (()=>{outer=outer+1;return outer;})();', 1],
                ['if(outer===0){outer=outer+1;return outer;}outer=outer+2;return outer;', 1],
                ['switch(outer){case 0:{outer=outer+1;return outer;}default:{outer=outer+2;return outer;}}', 1],
            ]
            for (const [body, expected] of cases) {
                const resolved = assertOk(parse('')(`let outer=0;export default (()=>{${body}})();`))
                const object = resolved.body.exit[0] === 'yield' ? resolved.body.exit[1] : null
                assert(object instanceof Array && object[0] === 'object')
                const member = object[1][0]
                assert(member[0] === ':' && member[2] instanceof Array && member[2][0] === '()')
                const callee = member[2][1]
                assert(callee instanceof Array && callee[0] === 'function')
                const fast = normalize({ ...resolved, body: { ...resolved.body, exit: ['yield', ['block', callee[1].body]] } }, [])
                assertEq(assertOk(toData(assertOk(memo(assertOk(analysis(fromFast(fast.body))))({ args: [] })))), expected)
            }
        },
        explicitSourceBlock: () => {
            const resolved = assertOk(parse('')('export default ()=>{let value=0; value=1; return value;};'))
            const object = resolved.body.exit[0] === 'yield' ? resolved.body.exit[1] : null
            assert(object instanceof Array && object[0] === 'object')
            const member = object[1][0]
            assert(member[0] === ':' && member[2] instanceof Array && member[2][0] === 'function')
            const [initialize, write] = member[2][1].body.statements
            assert(initialize[0] === 'initialize' && write[0] === 'write')
            const fast = normalize({ ...resolved, body: { statements: [initialize], exit: ['yield', ['block', { statements: [write], exit: ['yield', ['ref', write[1]]] }]] } }, [])
            assertEq(assertOk(toData(assertOk(memo(assertOk(analysis(fromFast(fast.body))))({ args: [] })))), 1)
        },
        // the same write at the block's own level is the block's business: a
        // scalar loop's step and a rest parameter's assignment are such writes
        kept: () => {
            assertStructurallySame(result('export default (()=>{let value=0;const block=(()=>{let inner=value;inner=inner+1;return inner;})();return [value,block];})();'), { default: [0, 1] })
        },
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
