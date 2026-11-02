/**
 * Keep source syntax/admission separate from the control-flow model. These
 * characterizations deliberately name the current unsupported forms; supplied
 * FAST conformance lives in edag/from_fast/control_flow.proof.f.mjs.
 */

import { assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { identityAnalysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { stringToList } from '../../text/utf16/module.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { parse } from '../source/module.f.mjs'
import { tokenize } from '../tokenizer/module.f.mjs'
import { parseSyntax } from './syntax/module.f.mjs'

const path = /** @type {const} */ ('/control-flow.f.js')

/** @type {(source: string) => ReturnType<typeof parseSyntax>} */
const syntax = source => parseSyntax(tokenize(stringToList(source))(path))

/** @type {(source: string) => unknown} */
const evaluated = source => {
    const graph = unresolved(assertOk(parse(path)(source))).edag
    return assertOk(toData(assertOk(memo(assertOk(identityAnalysis(graph)))({ args: [] }))))
}

export const proof = /** @type {const} */ ({
    partlyReturningConditionalsStillNeedAdmission: () => {
        for (const source of [
            // Reference Case 4: the outer arm can complete normally.
            'export default (a,f,c)=>{if(a){const x=f();if(x.a()){return x.b();}}return c();};',
            // Reference Case 7: a returning path bypasses the joined value.
            'export default (a,f,c)=>{let z=0;if(a){const x=f();if(x.a()){return x.b();}z=z+x.c();}return c(z+5);};',
            // The task owner's nested example.
            'export default (a,m,f,g)=>{if(a){const x=f();m=x.a;if(x.b){return x.c;}}return g(m);};',
        ]) {
            assertOk(syntax(source))
            assertError(parse(path)(source))
        }
    },
    caseFallthroughHasSyntaxButRemainsOutsideAdmission: () => {
        for (const cases of [
            'case 0:{m=m+1;}case 1:{m=m+2;break;}default:{break;}',
            'case 0:{break;}default:{m=m+3;}',
        ]) {
            const source = `export default ()=>{let m=0;while(false){switch(0){${cases}}}return m;};`
            assertOk(syntax(source))
            assertEq(assertError(parse(path)(source)).message, 'switch case does not terminate')
        }
    },
    switchBreakOutsideALoopStillNeedsSyntaxAdmission: () => {
        const source = /** @type {const} */ ('export default tag=>{let m=0;switch(tag){case 1:{m=m+1;break;}}return m;};')
        assertError(syntax(source))
        assertError(parse(path)(source))
    },
    implicitFunctionReturnsRemainRefused: () => {
        for (const source of [
            'export default ()=>{};',
            'export default ()=>{const x=1;};',
            'export default a=>{if(a){return 1;}};',
        ]) {
            assertError(syntax(source))
            assertError(parse(path)(source))
        }
        // An explicit throw or an admitted non-returning terminal loop has no
        // successful function-end fallthrough; neither gains an implicit return.
        assertOk(parse(path)('export default ()=>{throw 1;};'))
        assertOk(parse(path)('export default ()=>{while(true){}};'))
    },
    normalRegionCompletionResumesTheFollowingStatements: () => {
        assertStructurallySame(evaluated(`
            const f=()=>{
                let n=0;
                while(n<3){
                    if(n===1){n=n+1;}else{n=n+1;}
                }
                return n+10;
            };
            export default f();
        `), { default: 13 })
    },
    immediateReturnKeepsItsOwnOwnerWhileWritesEscape: () => {
        assertStructurallySame(evaluated(`
            const f=n=>{
                const r=(()=>{n=n+1;return 10;})();
                return [n,r];
            };
            export default f(2);
        `), { default: [3, 10] })
    },
})
