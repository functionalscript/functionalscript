/** A written do-while stays post-test syntax until FAST normalization. */

import { assert, assertEq, assertError, assertOk } from '../../asserts/module.f.js'
import { parseSyntax } from './syntax/module.f.mjs'
import { parseFromTokens } from './module.f.mjs'
import { tokenizeString } from './proof.f.mjs'

export const proof = /** @type {const} */ ({
    writtenKindBodyAndEndingRemainIntact: () => {
        for (const ending of [';', '']) {
            const module = assertOk(parseSyntax(tokenizeString('do{break;const unreachable=1;}while(false)' + ending + 'export default 0;')))
            const statement = module.statements[0]
            assert(statement[0] === 'do')
            assertEq(statement[1].start.token.kind, 'id')
            assertEq(statement[1].postTest, true)
            assertEq(statement[1].semicolon, ending === ';')
            assertEq(statement[1].block[1].length, 2)
            assertOk(parseFromTokens(tokenizeString('do{}while(false)' + ending + 'export default 0;')))
        }
    },
    functionAndBranchPositionsAndKeywordProperties: () => {
        for (const source of [
            'export default ()=>{do{}while(false);};',
            'export default ()=>{if(true){do{}while(false);}else{do{}while(false);}return 1;};',
            'while(false){do{continue;}while(false);}export default 0;',
            'export default {do:1}.do;',
        ]) { assertOk(parseFromTokens(tokenizeString(source))) }
    },
    scopeAndMalformedFormsStillRefuse: () => {
        assertError(parseFromTokens(tokenizeString('do{const local=false;}while(local);export default 0;')))
        assertError(parseFromTokens(tokenizeString('do{return 1;}while(false);export default 0;')))
        for (const source of [
            'do{}(false);export default 0;',
            'do{}while();export default 0;',
            'do break;while(false);export default 0;',
            'do{}while(false);;export default 0;',
        ]) { assertError(parseSyntax(tokenizeString(source))) }
    },
})
