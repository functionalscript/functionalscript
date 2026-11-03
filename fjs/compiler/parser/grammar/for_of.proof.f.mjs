/**
 * Declaration-based `for...of` is a syntax profile. Its contextual separator
 * must not change ordinary names or the classic loop's explicit separators.
 *
 * @import { Rule } from '../../../ebnf/types.ts'
 */

import { assertEq } from '../../../asserts/module.f.js'
import { parser } from '../../../ebnf/ll1/module.f.mjs'
import { stringToList } from '../../../text/utf16/module.f.js'
import { toArray } from '../../../types/list/alt/module.f.js'
import { tokenize } from '../../tokenizer/module.f.mjs'
import { forClassicTail, forDeclarationTail, forHeader, module, symbolsOf } from './module.f.mjs'

const parseModule = parser(/** @type {Rule} */ (module))

/** @type {(source: string) => 'ok' | 'error'} */
const read = source => parseModule(symbolsOf(toArray(tokenize(stringToList(source))('for-of.f.js')).slice(0, -1)))[0]

export const proof = /** @type {const} */ ({
    declarationHeadersKeepTheirBindingPatternAndBracedBody: () => {
        for (const source of [
            'for(const x of []){}export default 0;',
            'for(let x of values){x=x+1;}export default 0;',
            'for(const [x,,...rest] of values){}export default 0;',
            'for(let {of:alias,...rest} of values){}export default 0;',
            'for(const of of of){}export default 0;',
            'export default values=>{for(const x of values){return x;}return 0;};',
            'export default values=>{for(const x of values){for(let y of x){continue;}break;}};',
            'while(false){if(true){for(const x of values){throw x;}}}export default 0;',
        ]) { assertEq(read(source), 'ok', source) }
    },
    unsupportedHeadersAndBodiesRemainSyntaxErrors: () => {
        for (const source of [
            'for(x of values){}export default 0;',
            'for(const x=0 of values){}export default 0;',
            'for(const x,y of values){}export default 0;',
            'for(const x in values){}export default 0;',
            'for await(const x of values){}export default 0;',
            'for(const x of){}export default 0;',
            'for(const x of values)break;export default 0;',
            'for(const x of values){};export default 0;',
            'for(let x=0\nx<2;x+=1){}export default 0;',
            'for(let x=0;x<2\nx+=1){}export default 0;',
        ]) { assertEq(read(source), 'error', source) }
    },
    ofRemainsAnOrdinaryWordOutsideItsSeparatorPosition: () => {
        for (const source of [
            'import {of as from, as as of} from "./of.f.js";export default {of, from};',
            'export const of=1;export default of;',
            'export default of=>({of, value:of.of, type:typeof of});',
            'let of=0;of+=1;of();for(of=0;of<2;of+=1){}export default of;',
            'for(let of=0;of<2;of+=1){}export default 0;',
            'for(const {of}=value;false;){}export default 0;',
        ]) { assertEq(read(source), 'ok', source) }
    },
    ll1: {
        classicTail: () => { parser(/** @type {Rule} */ (forClassicTail)) },
        declarationTail: () => { parser(/** @type {Rule} */ (forDeclarationTail)) },
        header: () => { parser(/** @type {Rule} */ (forHeader)) },
    },
})
