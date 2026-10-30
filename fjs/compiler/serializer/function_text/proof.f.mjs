/**
 * Every expression and continuation has concrete JavaScript text. Host execution
 * of that text is covered separately at the serializer's JavaScript boundary.
 * @import { Exp, Function as FunctionExp, Op2Id } from '../../../edag/types.ts'
 */

import { conditional } from '../../../edag/testlib.f.js'
import { assertEq, assertOk } from '../../../asserts/module.f.js'
import { analysis } from '../../../edag/analysis/module.f.mjs'
import { staticIds } from '../../../edag/module.f.mjs'
import { renderFunction } from './module.f.mjs'

/** @type {(e: FunctionExp) => string} */
const render = e => {
    const a = assertOk(analysis(e))
    return renderFunction(a, /** @type {readonly ['#', number]} */ (a.root)[1])
}

/** @type {(body: Exp) => string} */
const text = body => render(['=>', 0, [], body])

export const proof = {
    // A direct self-tail call becomes a transition. A self value captured
    // by a nested function still needs the named function expression.
    self: () => {
        assertEq(render(['=>', 1, [], ['()', ['self'], [['arg', 0]]]]),
            '($0)=>{const $1=$0;let $2=$1;L0:while(true){const $3=$2;const $4=$3;$2=$4;continue L0;}}')
        assertEq(render(['=>', 0, [], ['=>', 0, [['self']], ['frame', 0]]]), '(function $0(){return ()=>$0;})')
    },
    // a loop, `r => COND ? self(NEXT) : r`, is an arrow whose body is the
    // language's loop, the one spelling every writer has: a `let` of the
    // parameter, the `while` over it, the asserts and the memo cells inside
    // the body, the assignment omitted where the next value is the
    // variable, and no `self` name
    loops: () => {
        /** @type {(next: Exp) => Exp} */
        const call = next => ['()', ['self'], [next]]
        assertEq(render(['=>', 1, [], ['?:', ['<', ['arg', 0], 10], call(['+', ['arg', 0], 1]), ['arg', 0]]]),
            '($0)=>{let $1=$0;while((()=>{const $2=$1;return $2<10;})()){const $3=$1;const $4=$3+1;$1=$4;}return $1;}')
        assertEq(render(['=>', 1, [], ['?:', true, [',', [['[]', [2]], call(0)]], ['arg', 0]]]),
            '($0)=>{let $1=$0;while((()=>{const $2=$1;return true;})()){const $3=$1;const $4=[2];const $5=0;$1=$5;}return $1;}')
        assertEq(render(['=>', 1, [], ['?:', ['arg', 0], call(['arg', 0]), ['arg', 0]]]),
            '($0)=>{let $1=$0;while((()=>{const $2=$1;return $2;})()){const $3=$1;$1=$1;}return $1;}')
        // a shared body value is established once in each iteration
        const shared = /** @type {const} */ (['[]', [['arg', 0]]])
        assertEq(render(['=>', 1, [], ['?:', ['<', ['arg', 0], 3], call(['+', ['.', shared, 0], ['.', shared, 'length']]), ['arg', 0]]]),
            '($0)=>{let $1=$0;while((()=>{const $2=$1;return $2<3;})()){const $3=$1;const $4=[$3];const $5=$4[0]+$4.length;$1=$5;}return $1;}')
        // a frame slot reads as its name, as in any body, the slots
        // numbered before the parameter
        assertEq(render(['=>', 1, [['[]', []]], ['?:', ['frame', 0], call(['frame', 0]), ['arg', 0]]]),
            '($1)=>{let $2=$1;while((()=>{const $3=$2;return $0;})()){const $4=$2;const $5=$0;$2=$5;}return $2;}')
        // Condition-only root work runs in each test. Condition/arm sharing
        // retains the general loop; rest arrays refresh at each transition.
        assertEq(render(['=>', 1, [], [',', [['[]', [1]], ['?:', true, call(0), ['arg', 0]]]]]),
            '($0)=>{let $1=$0;while((()=>{const $2=$1;const $3=[1];return true;})()){const $4=$1;const $5=0;$1=$5;}return $1;}')
        assertEq(render(['=>', 1, [], ['?:', ['.', shared, 0], call(['.', shared, 'length']), ['arg', 0]]]),
            '($0)=>{const $1=$0;let $2=$1;let $3=undefined;L0:while(true){const $4=$2;const $5=[$4];if($5[0]){const $6=$5.length;$2=$6;continue L0;}else{const $7=$4;$3=$7;break L0;}}const $8=$3;return $8;}')
        assertEq(render(['=>', 1, [], ['?:', ['.', ['rest'], 'length'], call(['arg', 0]), ['arg', 0]]]),
            '($0,...$1)=>{const $2=$0;const $3=$1;let $4=$2;let $5=$3;let $6=undefined;L0:while(true){const $7=$4;const $8=$5;if($8.length){const $9=[$7];const $10=$9[0];const $11=(($12,$13,$14)=>$12.slice($13,$14))($9,1);$4=$10;$5=$11;continue L0;}else{const $15=$7;$6=$15;break L0;}}const $16=$6;return $16;}')
        // a next value that throws is assigned as the applied function a
        // throw is spelled as anywhere, and throws there
        assertEq(render(['=>', 1, [], ['?:', true, call(['throw', 1]), ['arg', 0]]]),
            '($0)=>{let $1=$0;while((()=>{const $2=$1;return true;})()){const $3=$1;const $4=(()=>{throw 1;})();$1=$4;}return $1;}')
        // a condition reaches a shared value through a nested capture too,
        // and not through one holding something else
        assertEq(render(['=>', 1, [], ['?:', ['()', ['=>', 0, [shared], ['frame', 0]], []], call(['.', shared, 0]), ['arg', 0]]]),
            '($0)=>{const $1=$0;let $2=$1;let $3=undefined;L0:while(true){const $4=$2;const $5=[$4];const $6=()=>$5;if($6()){const $7=$5[0];$2=$7;continue L0;}else{const $8=$4;$3=$8;break L0;}}const $9=$3;return $9;}')
        assertEq(render(['=>', 1, [], ['?:', ['()', ['=>', 0, [['[]', [1]]], ['frame', 0]], []], call(0), ['arg', 0]]]),
            '($0)=>{let $1=$0;while((()=>{const $2=$1;const $3=[1];const $4=()=>$3;return $4();})()){const $5=$1;const $6=0;$1=$6;}return $1;}')
    },
    // standalone text numbers external captures in declared slot order,
    // including slots the body leaves unused
    closure: () => {
        const a = assertOk(analysis(['=>', 0, [1, 2], ['frame', 1]]))
        const i = /** @type {readonly ['#', number]} */ (a.root)[1]
        assertEq(renderFunction(a, i), '()=>$1')
    },
    names: () => {
        const a = assertOk(analysis(['=>', 0, [], 1]))
        assertEq(renderFunction(a, /** @type {readonly ['#', number]} */ (a.root)[1]), '()=>1')
        assertEq(render(['=>', 2, [], ['arg', 1]]), '($0,$1)=>$1')
        assertEq(text(['rest']), '(...$0)=>$0')
        assertEq(text(['undefined']), '()=>undefined')
        assertEq(render(['=>', 0, [8, 9], ['frame', 1]]), '()=>$1')
        assertEq(render(['=>', 0, [null, ['[]', [1]]], ['frame', 1]]), '()=>$1')
    },
    containers: () => {
        assertEq(text(['[]', [1, ['...', 'ab'], null, false, 1n, -0]]), '()=>[1,..."ab",null,false,1n,-0]')
        assertEq(text(['{}', [[':', '__proto__', 1], ['...', null], [':', ['+', 1, 2], 3]]]),
            '()=>{return {["__proto__"]:1,...null,[1+2]:3};}')
        assertEq(text(['[]', []]), '()=>[]')
        assertEq(text(['{}', []]), '()=>{return {};}')
    },
    operators: () => {
        /** @type {readonly (readonly [Exp, string])[]} */
        const cases = [
            [['!', 1], '!1'], [['~', 1], '~1'], [['typeof', 1], 'typeof 1'],
            [['instanceof', ['[]', []], 'Array'], '[] instanceof Array'],
            [['in', 'x', ['{}', []]], '"x" in {}'],
            [['+', 1], '+1'], [['-', 1], '-1'],
            [['+', 1, 2], '1+2'], [['-', 1, 2], '1-2'],
            [['String', 1], 'String(1)'], [['Number', '2'], 'Number("2")'],
            [['?:', true, 1, 2], 'true?1:2'],
            [[',', []], 'undefined'], [[',', [1]], '1'], [[',', [1, 2]], '{const $0=1;return 2;}'],
            [['throw', 1], '{throw 1;}'],
            [['()', ['entry'], [['{}', []], 'x']], '{const $0=($1,$2)=>{const $3=Object.getOwnPropertyDescriptor($1,$2);return $3?.enumerable?$3.value:undefined;};return $0({},"x");}'],
            [['()', ['hasEntry'], [['{}', []], 'x']], '{const $0=($1,$2)=>{const $3=Object.getOwnPropertyDescriptor($1,$2);return $3?.enumerable===true;};return $0({},"x");}'],
            // an intrinsic's helper is written in its one spelling too
            [['()', ['slice'], ['abc', 1, 2]], '{const $0=($1,$2,$3)=>$1.slice($2,$3);return $0("abc",1,2);}'],
            [['slice'], '($0,$1,$2)=>$0.slice($1,$2)'],
            [['charCodeAt'], '($0,$1)=>$0.charCodeAt($1)'],
            // a static function is written as the source reads it
            [['()', ['Object.is'], [1, 2]], '{const $0=Object.is;return $0(1,2);}'],
            [['Object.is'], 'Object.is'],
            [['()', ['Number.isInteger'], [1]], '{const $0=Number.isInteger;return $0(1);}'],
        ]
        for (const [body, expected] of cases) { assertEq(text(body), `()=>${expected}`) }
        // every static, each its own tag, with no case of its own to miss
        for (const id of staticIds) { assertEq(text([id]), `()=>${id}`) }
        for (const op of /** @type {readonly Op2Id[]} */ ([
            '===', '!==', '<', '<=', '>', '>=', '*', '/', '%', '**',
            '&', '|', '^', '<<', '>>', '>>>',
        ])) { assertEq(text([op, 1, 2]), `()=>1${op}2`) }
        assertEq(text(conditional('&&', 1, 2)), '()=>1?2:1')
        assertEq(text(conditional('||', 1, 2)), '()=>1?1:2')
        assertEq(text(conditional('??', 1, 2)), '()=>(1===null?true:1===undefined)?2:1')
    },
    chains: () => {
        /** @type {readonly (readonly [Exp, string])[]} */
        const cases = [
            [['.', 1, 'x'], '(1).x'],
            [['?.', null, 'x'], 'null?.x'],
            [['.', 1, 'x', ['|()', [2, ['...', 'ab']]]], '(1).x(2,..."ab")'],
            [['.', 1, 'x', ['|?.()', []]], '(1).x?.()'],
            [['()', 1, []], '1()'],
            [['?.()', null, []], 'null?.()'],
            [['?.()', 1, [2], ['|.', 'x', ['|()', [3], ['|()', [4]]]]], '1?.(2).x(3)(4)'],
            [['?.', null, 'x', ['|.', 'y', ['|?.()', [], ['|.', 'z']]]], 'null?.x.y?.().z'],
            [['?.', null, 'x', ['|!()', [3]]], '(null?.x)(3)'],
            [['.', 1, ['Number', 2]], '(1)[Number(2)]'],
        ]
        for (const [body, expected] of cases) { assertEq(text(body), `()=>${expected}`) }
    },
    closures: () => {
        assertEq(text(['=>', 0, [], 1]), '()=>()=>1')
        assertEq(text(['=>', 0, [], ['rest']]), '()=>(...$0)=>$0')
        assertEq(text(['=>', 1, [1, 1], ['[]', [['frame', 0], ['frame', 1], ['arg', 0]]]]),
            '()=>(($0,$1)=>(($2)=>[$0,$1,$2]))(1,1)')
        assertEq(text(['=>', 0, [['throw', 'unused']], 1]),
            '()=>{const $0=(()=>{throw "unused";})();return ()=>1;}')
        const inner = /** @type {const} */ (['=>', 1, [['arg', 0]], ['frame', 0]])
        const outer = /** @type {const} */ (['=>', 1, [], inner])
        const table = assertOk(analysis(['[]', [['[]', ['unrelated']], outer]]))
        const index = table.nodes.findIndex(n => n[0] === '=>' && n[3] instanceof Array && table.nodes[n[3][1]][0] === 'frame')
        assertEq(renderFunction(table, index), render(inner))
    },
    lazySharing: () => {
        const shared = /** @type {const} */ (['[]', []])
        const body = /** @type {const} */ (['[]', [conditional('&&', false, shared), conditional('||', true, shared)]])
        assertEq(text(body), '()=>{const $0=(()=>{let $1,$2=false;return()=>{if(!$2){$1=[];$2=true;}return $1;};})();return [false?$0():false,true?true:$0()];}')
        const withCapture = '()=>{const $1=(()=>{let $2,$3=false;return()=>{if(!$3){$2=[];$3=true;}return $2;};})();return [false?$1():false,true?true:$1()];}'
        const captured = /** @type {const} */ (['[]', [2]])
        assertEq(render(['=>', 0, [captured], body]), withCapture)
        const other = /** @type {const} */ (['[]', [7]])
        const fn = /** @type {const} */ (['=>', 0, [captured], body])
        const table = assertOk(analysis(['[]', [
            ['=>', 1, [], ['[]', [other, other]]], fn, ['=>', 0, [], ['rest']],
        ]]))
        const index = table.nodes.findIndex(n => n[0] === '=>' && n[2].length === 1)
        assertEq(renderFunction(table, index), withCapture)
    },
}
