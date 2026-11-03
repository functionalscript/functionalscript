/** Generic for-of syntax is retained, while every FJS entry keeps iteration refused. */

import { assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { identityAnalysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { stringToList } from '../../text/utf16/module.f.js'
import { unresolved } from '../edag/module.f.mjs'
import { parse } from '../source/module.f.mjs'
import { tokenize } from '../tokenizer/module.f.mjs'
import { parseSyntax } from './syntax/module.f.mjs'

const path = /** @type {const} */ ('/for-of.f.js')

/** @type {(source: string) => ReturnType<typeof parseSyntax>} */
const syntax = source => parseSyntax(tokenize(stringToList(source))(path))

/** @type {(prefix: string, loop: string, suffix: string) => void} */
const unsupported = (prefix, loop, suffix) => {
    const source = prefix + loop + suffix
    assertOk(syntax(source))
    const refusal = assertError(parse(path)(source))
    assertEq(refusal.message, 'for-of is not admitted')
    assertStructurallySame(refusal.metadata, { path, line: 1, column: prefix.length + 1 })
}

/** @type {(source: string) => unknown} */
const evaluated = source => {
    const graph = unresolved(assertOk(parse(path)(source))).edag
    return assertOk(toData(assertOk(memo(assertOk(identityAnalysis(graph)))({ args: [] }))))
}

export const proof = /** @type {const} */ ({
    syntaxAdmissionAndFjsRefusalStaySeparateInEveryStatementContext: () => {
        for (const [prefix, suffix] of [
            ['const xs=[];', 'export default 0;'],
            ['export const xs=[];', 'export default 0;'],
            ['export default xs=>{', 'return 0;};'],
            ['export default xs=>{', '};'],
            ['export default (a,xs)=>{if(a){', '}return 0;};'],
            ['export default (a,xs)=>{if(a){', 'const y=0;}else{}return 0;};'],
            ['export default (a,xs)=>{if(a){if(a){return 1;}', '}return 0;};'],
            ['export default xs=>{while(false){', '}return 0;};'],
            ['const xs=[];while(false){', '}export default 0;'],
            ['export default xs=>{for(let i=0;i<1;i+=1){', '}return 0;};'],
            ['export default (a,xs)=>{while(false){if(a){', '}}return 0;};'],
            ['export default (tag,xs)=>{while(false){switch(tag){case 0:{', 'break;}default:{break;}}}return 0;};'],
            ['export default (tag,xs)=>{switch(tag){case 0:{', 'return 1;}default:{return 0;}}};'],
        ]) { unsupported(prefix, 'for(const value of xs){}', suffix) }
    },
    genericHeadersDoNotAcquireFjsBindingOrIterablePolicies: () => {
        for (const header of [
            'const value of []',
            'let value of [1,2]',
            'const [left,right] of []',
            'let {value: item} of []',
            'const of of of',
            'let of of of',
            'const Object of missing',
            'const value of undefined',
        ]) {
            unsupported('export default ()=>{', `for(${header}){const ignored=unknown;}`, 'return 0;};')
        }
    },
    contextualOfRemainsAnOrdinaryBindingAndValue: () => {
        assertStructurallySame(evaluated(`
            const of=x=>x+1;
            const f=of=>{of+=2;return of;};
            const g=(of=3)=>of+1;
            const h=()=>{const {of}={of:7};return of;};
            export default [of(2),f(3),g(),h(),{of:9}.of];
        `), { default: [3, 5, 4, 7, 9] })
        for (const source of [
            'import {of} from "./value.f.js";export default of;',
            'import {value as of} from "./value.f.js";export default of;',
            'import {of as value} from "./value.f.js";export default value;',
            'export const of=1;',
        ]) { assertOk(parse(path)(source)) }
    },
    classicForStillAdmitsOfNamesAndItsExistingTransfers: () => {
        assertStructurallySame(evaluated(`
            const f=()=>{
                let n=0;
                for(let of=0;of<4;of+=1){if(of===1){continue;}n+=of;if(of===2){break;}}
                return n;
            };
            let of=0;
            for(;of<2;of+=1){}
            export default [f(),of];
        `), { default: [2, 2] })
        assertOk(parse(path)('export default ()=>{for(;;){return 7;}};'))
    },
})
