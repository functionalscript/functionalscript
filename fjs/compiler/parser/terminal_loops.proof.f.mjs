/** Terminal candidates retain source control evidence until admission. */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { parseFromTokens } from './module.f.mjs'
import { tokenizeString } from './proof.f.mjs'

/** @type {(body: string) => import('../../js/ast/sugar/source.ts').SourceFunction} */
const fn = body => {
    const module = assertOk(parseFromTokens(tokenizeString(`const f=()=>{${body}};export default f;`)))
    const declaration = module.body.statements[0]
    assert(declaration[0] === 'initialize')
    const value = declaration[2]
    assert(value instanceof Array && value[0] === 'function')
    return value[1]
}

export const proof = {
    candidateHasItsOwnTerminalExit: () => {
        const source = fn('let n=2;while((true)){if(n===0){return n;}n=n-1;}')
        assertEq(source.body.statements.length, 1)
        const terminal = source.body.exit
        assert(terminal[0] === 'terminal-loop')
        assertEq(terminal[1].condition, true)
        const returned = terminal[1].body.statements[0]
        assert(returned[0] === 'if')
        const result = returned[2].statements[0]
        assert(result[0] === 'return')
        assertEq(result[1], source.target)
    },
    innerBreaksAndOuterContinuesKeepTheirOwners: () => {
        const source = fn('while(true){while(true){break;}switch(1){case 1:{break;}default:{continue;}}return 1;}')
        const terminal = source.body.exit
        assert(terminal[0] === 'terminal-loop')
        const [inner, switched] = terminal[1].body.statements
        assert(inner[0] === 'while' && switched[0] === 'switch')
        const innerBreak = inner[1].body.statements[0]
        assert(innerBreak[0] === 'break')
        assertEq(innerBreak[1], inner[1].target)
        assert(innerBreak[1] !== terminal[1].target)
        const switchBreak = switched[1].cases[0].body.statements[0]
        assert(switchBreak[0] === 'break')
        assertEq(switchBreak[1], switched[1].target)
        const continued = switched[1].otherwise.statements[0]
        assert(continued[0] === 'continue')
        assertEq(continued[1], terminal[1].target)
    },
    sourceAfterAnExitIsStillChecked: () => {
        const source = fn('while(true){return 1;let unused=0;if(false){unused=unused+1;}}')
        const terminal = source.body.exit
        assert(terminal[0] === 'terminal-loop')
        assertStructurallySame(terminal[1].body.statements.map(statement => statement[0]), ['return', 'initialize', 'if'])
        for (const body of [
            'while(true){return 1;missing;}',
            'let n=0;while(true){return 1;const held=()=>n;n=n+1;}',
            'while(true){return 1;const invalid=()=>{break;};}',
        ]) {
            assertError(parseFromTokens(tokenizeString(`export default ()=>{${body}};`)))
        }
    },
    terminalReturnsKeepTheInvocationWriteBoundary: () => {
        for (const source of [
            'export default n=>(()=>{n=n+1;while(true){return n;}})();',
            'export default n=>(()=>{while(true){n+=1;return n;}})();',
            'export default n=>(()=>{n=n+1;if(n){while(true){return n;}}return n;})();',
            'export default n=>(()=>{n=n+1;switch(n){case 1:{while(true){return n;}}default:{return n;}}})();',
            'export default n=>(()=>{n=n+1;while(true){throw n;return n;}})();',
        ]) {
            const refusal = assertError(parseFromTokens(tokenizeString(source)))
            assertEq(refusal.message, 'reassigned variable captured', source)
        }
        // A throw-only terminal loop can become an expression block. A held
        // function's return belongs to that function and keeps no outer call.
        assertOk(parseFromTokens(tokenizeString('export default n=>(()=>{n=n+1;while(true){const inner=()=>{while(true){return 0;}};throw n;}})();')))
    },
    terminalAdmissionUsesSourceConditionAndBreaks: () => {
        for (const body of [
            'while(false){}', 'while(1){}', 'while(!false){}',
            'const always=true;while(always){}', 'while(true||false){}',
            'while(true){break;}', 'while(true){if(false){break;}}',
            'while(true){return 1;break;}', 'while(true){throw 1;break;}',
        ]) {
            const failure = assertError(parseFromTokens(tokenizeString(`export default ()=>{${body}};`)))
            assertEq(failure.message, 'terminal while must be literal true with no break targeting it', body)
        }
        for (const source of [
            'export default ()=>{};', 'export default ()=>{const n=1;};',
            'while(true){}', 'export default ()=>{while(true){};};',
        ]) { assertError(parseFromTokens(tokenizeString(source))) }
    },
}
