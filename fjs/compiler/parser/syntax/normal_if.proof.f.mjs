/**
 * Ordinary branches retain normal completion independently of an ordinary
 * function's required end and the legacy terminating-guard representation.
 *
 * @import { Block } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { unwrap } from '../../../types/result/module.f.js'
import { stringToList } from '../../../text/utf16/module.f.mjs'
import { tokenize } from '../../tokenizer/module.f.mjs'
import { parseSyntax } from './module.f.mjs'

/** @type {(source: string) => Block[1]} */
const statements = source => {
    const value = unwrap(parseSyntax(tokenize(stringToList(source))('normal-if.f.js'))).exported?.value
    assert(value !== undefined && value[0] === '=>')
    const body = value[2]
    assert(body[0] === 'block')
    return body[1]
}

export const proof = {
    normalArmsRetainAssignmentsAndDistinctMissingAlternates: () => {
        const arm = statements('export default b=>{let a=0;if(b){const x=2;a+=x;}return a;};')[1]
        assert(arm[0] === 'normal-if')
        assertEq(arm[1].start.metadata.column, 28)
        assertStructurallySame(arm[1].block[1].map(statement => statement[0]), ['const', 'assign'])
        assertEq(arm[1].block[2], null)
        assertEq(arm[1].otherwise, null)
        const empty = statements('export default b=>{if(b){}else{}return 0;};')[0]
        assert(empty[0] === 'normal-if')
        assertStructurallySame(empty[1].block, ['branch', [], null])
        assertStructurallySame(empty[1].otherwise, ['branch', [], null])
    },
    elseIfRetainsItsOwnLexicalArm: () => {
        const outer = statements('export default (a,b)=>{let x=0;if(a){x=1;}else if(b){x=2;}else{x=3;}return x;};')[1]
        assert(outer[0] === 'normal-if' && outer[1].otherwise !== null)
        const nested = outer[1].otherwise[1][0]
        assert(nested[0] === 'normal-if' && nested[1].otherwise !== null)
        assertEq(nested[1].block[1][0][0], 'assign')
        assertEq(nested[1].otherwise[1][0][0], 'assign')
        assertEq(outer[1].otherwise[2], null)
        const terminal = statements('export default (a,b)=>{if(a){}else if(b){return 1;}return 2;};')[0]
        assert(terminal[0] === 'normal-if' && terminal[1].otherwise !== null)
        assertEq(terminal[1].otherwise[1][0][0], 'if')
    },
    explicitArmEndsRemainAvailableToAdmission: () => {
        const arms = statements('export default b=>{if(b){return 1;}else{throw 2;}return 3;};')[0]
        assert(arms[0] === 'normal-if' && arms[1].otherwise !== null)
        assertEq(arms[1].block[2]?.[0], 'return')
        assertEq(arms[1].otherwise[2]?.[0], 'throw')
        const partial = statements('export default (a,b)=>{if(a){const x=1;if(b){return x;}}return 0;};')[0]
        assert(partial[0] === 'normal-if')
        assertEq(partial[1].block[1][1][0], 'if')
        assertEq(partial[1].block[2], null)
    },
    terminalGuardsKeepTheirEstablishedBlockShape: () => {
        const guard = statements('export default b=>{if(b){switch(b){case 1:{return 1;}}return 2;}return 3;};')[0]
        assert(guard[0] === 'if')
        assertStructurallySame(guard[1].block[1].map(statement => statement[0]), ['switch', 'return'])
        const terminalSwitch = statements('export default b=>{if(b){switch(b){case 1:{return 1;}default:{return 2;}}}return 3;};')[0]
        assert(terminalSwitch[0] === 'if')
        assertEq(terminalSwitch[1].block[1][0][0], 'switch')
    },
    branchLoopsKeepOrdinaryAndCandidateFinalForms: () => {
        for (const [loop, tag] of [
            ['while(true){}', 'while'],
            ['for(;;){}', 'for'],
        ]) {
            const final = statements(`export default b=>{if(b){${loop}}return 0;};`)[0]
            assert(final[0] === 'normal-if')
            assertEq(final[1].block[2]?.[0], `terminal-${tag}`)
            const following = statements(`export default b=>{if(b){${loop}const x=1;}return 0;};`)[0]
            assert(following[0] === 'normal-if')
            assertStructurallySame(following[1].block[1].map(statement => statement[0]), [tag, 'const'])
            assertEq(following[1].block[2], null)
            const ended = statements(`export default b=>{if(b){${loop}return 1;}return 0;};`)[0]
            assert(ended[0] === 'if')
            assertStructurallySame(ended[1].block[1].map(statement => statement[0]), [tag, 'return'])
        }
    },
}
