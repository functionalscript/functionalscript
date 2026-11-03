/** Function-body fallthrough is syntax evidence, not an admitted return. */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { stringToList } from '../../../text/utf16/module.f.js'
import { tokenize } from '../../tokenizer/module.f.mjs'
import { parse } from '../../source/module.f.mjs'
import { parseSyntax } from './module.f.mjs'

/** @type {(source: string) => import('./types.ts').Block[1]} */
const statements = source => {
    const module = assertOk(parseSyntax(tokenize(stringToList(source))('implicit-return.f.js')))
    const value = module.exported?.value
    assert(value !== undefined && value[0] === '=>')
    const body = value[2]
    assert(body[0] === 'block')
    return body[1]
}

export const proof = /** @type {const} */ ({
    emptyAndOrdinaryBodiesRetainOmission: () => {
        const empty = statements('export default ()=>{};')[0]
        assert(empty[0] === 'implicit-return' && empty[1] !== null)
        assertEq(empty[1].metadata.column, 21)
        assertStructurallySame(statements('export default value=>{const copy=value;assert(copy)};').map(s => s[0]),
            ['const', 'const', 'implicit-return'])
        assertStructurallySame(statements('export default flag=>{if(flag){return 1;}};').map(s => s[0]),
            ['if', 'implicit-return'])
        assertEq(statements('export default ()=>{const nested=()=>{};};')[0][0], 'const')
    },
    explicitEndingsRemainDistinct: () => {
        const explicit = statements('export default ()=>{return undefined;};')[0]
        assert(explicit[0] === 'return')
        assertStructurallySame(explicit[1].value, ['primitive', undefined])
        assertEq(statements('export default ()=>{throw 1;};')[0][0], 'throw')
    },
    loopCandidatesKeepTheirExistingShape: () => {
        for (const [loop, tag] of [
            ['while(false){}', 'while'],
            ['for(;;){}', 'for'],
            ['for(const value of missing){}', 'for-of'],
        ]) {
            assertEq(statements(`export default ()=>{${loop}};`)[0][0], `terminal-${tag}`)
            assertStructurallySame(statements(`export default ()=>{${loop}const value=1;};`).map(s => s[0]),
                [tag, 'const', 'implicit-return'])
        }
    },
    switchContinuationRetainsOmission: () => {
        const body = statements('export default tag=>{switch(tag){case 1:{return 1;}}};')
        assertStructurallySame(body.map(s => s[0]), ['switch', 'implicit-return'])
        assert(body[1][0] === 'implicit-return' && body[1][1] !== null)
        assertEq(body[1][1].metadata.path, 'implicit-return.f.js')
        const conditional = statements('export default (flag,tag)=>{if(flag){switch(tag){case 1:{return 1;}}}return 0;};')[0]
        assert(conditional[0] === 'normal-if')
        assertEq(conditional[1].block[2], null)
    },
    omissionDoesNotRelaxAdmissionOrBareTerminators: () => {
        for (const source of [
            'export default ()=>{};',
            'export default ()=>{const value=1;};',
            'export default flag=>{if(flag){return 1;}};',
            'export default tag=>{switch(tag){case 1:{const value=1;}}return 0;};',
        ]) {
            assertOk(parseSyntax(tokenize(stringToList(source))('implicit-return.f.js')))
            assertEq(assertError(parse('implicit-return.f.js')(source)).message, 'implicit return is not admitted')
        }
        for (const body of ['return;', 'throw;', 'return 1;const value=2;']) {
            assertError(parseSyntax(tokenize(stringToList(`export default ()=>{${body}};`))('implicit-return.f.js')))
        }
    },
})
