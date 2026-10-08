/**
 * Every expression and continuation has concrete JavaScript text. Host execution
 * of that text is covered separately at the serializer's JavaScript boundary.
 * @import { Exp, Function as FunctionExp, Op2Id } from '../../../edag/types.ts'
 */

import { assertEq, assertOk } from '../../../asserts/module.f.mjs'
import { analysis } from '../../../edag/analysis/module.f.mjs'
import { renderFunction, _renderSymbolic } from './module.f.mjs'
import { _resolve as resolve } from '../names/module.f.mjs'

/** @type {(e: FunctionExp) => string} */
const render = e => {
    const a = assertOk(analysis(e))
    return renderFunction(a, /** @type {readonly ['#', number]} */ (a.root)[1])
}

/** @type {(body: Exp) => string} */
const text = body => render(['=>', 0, [], body])

export const proof = {
    // a body reading its own `self` is a named function expression, the
    // name made of its depth's parameter; a nested function captures the
    // name as it captures any value of the scope around it
    self: () => {
        assertEq(render(['=>', 1, [], ['()', ['self'], [['arg', 0]]]]), '(function $0($1){return ((0,($0))(($1)));})')
        assertEq(render(['=>', 0, [], ['=>', 0, [['self']], ['frame', 0]]]), '(function $0(){return (($1)=>(()=>($1)))(($0));})')
    },
    names: () => {
        const a = assertOk(analysis(['=>', 0, [], 1]))
        assertEq(resolve([_renderSymbolic(a, /** @type {readonly ['#', number]} */ (a.root)[1], 'test', [])]).join(''), '()=>(1)')
        assertEq(render(['=>', 2, [], ['arg', 1]]), '($0,$1)=>($1)')
        assertEq(text(['rest']), '(...$0)=>($0)')
        assertEq(text(['undefined']), '()=>(undefined)')
        assertEq(render(['=>', 0, [8, 9], ['frame', 1]]), '()=>($1)')
        assertEq(render(['=>', 0, [null, ['[]', [1]]], ['frame', 1]]), '()=>($1)')
    },
    containers: () => {
        assertEq(text(['[]', [1, ['...', 'ab'], null, false, 1n, -0]]), '()=>([(1),...("ab"),(null),(false),(1n),(-0)])')
        assertEq(text(['{}', [[':', '__proto__', 1], ['...', null], [':', ['+', 1, 2], 3]]]),
            '()=>({[("__proto__")]:(1),...(null),[((1)+(2))]:(3)})')
        assertEq(text(['[]', []]), '()=>([])')
        assertEq(text(['{}', []]), '()=>({})')
    },
    operators: () => {
        /** @type {readonly (readonly [Exp, string])[]} */
        const cases = [
            [['!', 1], '(! (1))'], [['~', 1], '(~ (1))'], [['typeof', 1], '(typeof (1))'],
            [['instanceof', ['[]', []], 'Array'], '(([]) instanceof Array)'],
            [['+', 1], '(+ (1))'], [['-', 1], '(- (1))'],
            [['+', 1, 2], '((1)+(2))'], [['-', 1, 2], '((1)-(2))'],
            [['String', 1], '(String((1)))'], [['Number', '2'], '(Number(("2")))'],
            [['is', 1, 2], '(Object.is((1),(2)))'],
            [['?:', true, 1, 2], '((true)?(1):(2))'],
            [[',', []], '(undefined)'], [[',', [1]], '((1))'], [[',', [1, 2]], '((1),(2))'],
            [['throw', 1], '(()=>{throw (1);})()'],
            [['own', ['{}', []], 'x'], '(($0,$1)=>{if(typeof $1!=="string"){throw undefined;}return Object.getOwnPropertyDescriptor($0,$1)?.value;})(({}),("x"))'],
        ]
        for (const [body, expected] of cases) { assertEq(text(body), `()=>${expected}`) }
        for (const op of /** @type {readonly Op2Id[]} */ ([
            '===', '!==', '<', '<=', '>', '>=', '*', '/', '%', '**',
            '&', '|', '^', '<<', '>>', '>>>', '&&', '||', '??',
        ])) { assertEq(text([op, 1, 2]), `()=>((1)${op}(2))`) }
    },
    chains: () => {
        /** @type {readonly (readonly [Exp, string])[]} */
        const cases = [
            [['.', 1, 'x'], '((1)[("x")])'],
            [['?.', null, 'x'], '((null)?.[("x")])'],
            [['.', 1, 'x', ['|()', [2, ['...', 'ab']]]], '((1)[("x")]((2),...("ab")))'],
            [['.', 1, 'x', ['|?.()', []]], '((1)[("x")]?.())'],
            [['()', 1, []], '((0,(1))())'],
            [['?.()', null, []], '((0,(null))?.())'],
            [['?.()', 1, [2], ['|.', 'x', ['|()', [3], ['|()', [4]]]]], '((0,(1))?.((2))[("x")]((3))((4)))'],
            [['?.', null, 'x', ['|.', 'y', ['|?.()', [], ['|.', 'z']]]], '((null)?.[("x")][("y")]?.()[("z")])'],
            [['?.', null, 'x', ['|!()', [3]]], '(((null)?.[("x")])((3)))'],
            [['.', 1, ['Number', 2]], '((1)[(Number((2)))])'],
        ]
        for (const [body, expected] of cases) { assertEq(text(body), `()=>${expected}`) }
    },
    closures: () => {
        assertEq(text(['=>', 0, [], 1]), '()=>(()=>(1))')
        assertEq(text(['=>', 0, [], ['rest']]), '()=>((...$0)=>($0))')
        assertEq(text(['=>', 1, [1, 1], ['[]', [['frame', 0], ['frame', 1], ['arg', 0]]]]),
            '()=>(($0,$1)=>(($2)=>([($0),($1),($2)])))((1),(1))')
        assertEq(text(['=>', 0, [['throw', 'unused']], 1]),
            '()=>(($0)=>(()=>(1)))((()=>{throw ("unused");})())')
        const inner = /** @type {const} */ (['=>', 1, [['arg', 0]], ['frame', 0]])
        const outer = /** @type {const} */ (['=>', 1, [], inner])
        const table = assertOk(analysis(['[]', [['[]', ['unrelated']], outer]]))
        const index = table.nodes.findIndex(n => n[0] === '=>' && n[3] instanceof Array && table.nodes[n[3][1]][0] === 'frame')
        assertEq(renderFunction(table, index), render(inner))
    },
    lazySharing: () => {
        const shared = /** @type {const} */ (['[]', []])
        const body = /** @type {const} */ (['[]', [['&&', false, shared], ['||', true, shared]]])
        assertEq(text(body), '()=>{const $0=(()=>{let $1,$2=false;return()=>{if(!$2){$1=([]);$2=true;}return $1;};})();return ([((false)&&($0())),((true)||($0()))]);}')
        const withCapture = '()=>{const $1=(()=>{let $2,$3=false;return()=>{if(!$3){$2=([]);$3=true;}return $2;};})();return ([((false)&&($1())),((true)||($1()))]);}'
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
