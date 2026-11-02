/** Named-let omission desugars to explicit undefined across compilation and readback. */

import { assertEq } from '../asserts/module.f.js'
import { compileSource, fjsRoundTrip } from './proof.f.mjs'

export const proof = /** @type {const} */ ({
    generatedOutputsShareExplicitUndefinedLowering: () => {
        for (const [bare, explicit] of [
            ['export default flag=>{let value;if(flag){value=3;}return value;};', 'export default flag=>{let value=undefined;if(flag){value=3;}return value;};'],
            ['export default n=>{let value;while(n>0){value=n;n-=1;}return value;};', 'export default n=>{let value=undefined;while(n>0){value=n;n-=1;}return value;};'],
        ]) {
            for (const output of ['output.js', 'output.f.js', 'output.edag.data.js', 'output.rs']) {
                assertEq(compileSource(bare)(output), compileSource(explicit)(output), output)
            }
        }
    },
    readsBeforeLaterWritesObserveUndefined: () => {
        const source = /** @type {const} */ (`
            let value;
            export const before=value===undefined;
            value=3;
            const snapshot=value;
            const choose=flag=>{let result;if(flag){result=snapshot;}return result;};
            export default [before,value,choose(false)===undefined,choose(true)];
        `)
        assertEq(compileSource(source)('output.json'), '[true,3,true,3]')
        const moduleValue = /** @type {const} */ ('let value;export default {missing:value===undefined};')
        const explicit = /** @type {const} */ ('let value=undefined;export default {missing:value===undefined};')
        for (const output of ['output.json', 'output.data.js', 'output.rs']) {
            assertEq(compileSource(moduleValue)(output), compileSource(explicit)(output), output)
        }
    },
    loopBodyResetsAndForHeaderInitializesOnce: () => {
        const source = /** @type {const} */ (`
            let count=0;
            let fresh=true;
            while(count<3){let local;fresh=fresh&&(local===undefined);local=count;count+=1;}
            let result=0;
            for(let cursor;count<6;count+=1){
                if(cursor===undefined){cursor=4;}else{cursor+=1;}
                result=cursor;
            }
            export default [fresh,count,result];
        `)
        assertEq(compileSource(source)('output.json'), '[true,6,6]')
    },
    emittedSourceReadsBackTwice: () => {
        for (const source of [
            'let value;export default value;',
            'export default flag=>{let value;if(flag){value=3;}return value;};',
        ]) {
            const first = fjsRoundTrip(source)
            assertEq(fjsRoundTrip(first), first)
        }
    },
})
